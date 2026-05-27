"""
Rule evaluator. Given a Frigate event payload, find matching rules, write
events rows, fire alerts (with per-rule rate limiting).

Frigate's `frigate/events` topic publishes JSON like:
  { "type": "new" | "update" | "end",
    "before": {...}, "after": {
      "id": "...", "camera": "front_door", "label": "person",
      "top_score": 0.78, "score": 0.78,
      "current_zones": ["entry"], "entered_zones": ["entry"],
      "start_time": 1234567890.12, "end_time": null }}
"""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime, time, timezone
from typing import Any

import httpx

from .config import settings
from . import alerts

log = logging.getLogger("smartsnap.rules")


# Per-rule last-fired cache for rate limiting.
_last_fire: dict[str, datetime] = {}
_rate_limit_seconds = 60  # min seconds between fires for the same rule; tuned by alert_rate_limit_per_minute


def _slug(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in (name or "")).strip("_").lower() or "cam"


async def _sb_get(client: httpx.AsyncClient, path: str, params: dict | None = None) -> list[dict]:
    r = await client.get(
        f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}",
        params=params or {},
        headers=_headers(),
        timeout=8.0,
    )
    r.raise_for_status()
    return r.json()


async def _sb_post(client: httpx.AsyncClient, path: str, json: dict) -> dict | list:
    r = await client.post(
        f"{settings.supabase_url.rstrip('/')}/rest/v1/{path}",
        json=json,
        headers={**_headers(), "Prefer": "return=representation"},
        timeout=8.0,
    )
    r.raise_for_status()
    return r.json()


def _headers() -> dict:
    return {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
    }


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_within_window(rule: dict) -> bool:
    """Check time window + day-of-week."""
    now = _now()
    dow = now.weekday()  # Mon=0..Sun=6; SQL stores 0..6 per Python convention.
    dows = rule.get("days_of_week") or [0, 1, 2, 3, 4, 5, 6]
    if dow not in dows:
        return False

    ts = rule.get("time_window_start")
    te = rule.get("time_window_end")
    if not ts or not te:
        return True

    def _parse(t):
        if isinstance(t, str):
            parts = t.split(":")
            return time(int(parts[0]), int(parts[1]))
        return t

    start = _parse(ts)
    end = _parse(te)
    nowt = now.time().replace(microsecond=0)
    if start <= end:
        return start <= nowt <= end
    # Overnight window (e.g. 22:00 → 02:00)
    return nowt >= start or nowt <= end


def _rate_limited(rule_id: str) -> bool:
    last = _last_fire.get(rule_id)
    if last is None:
        return False
    return (_now() - last).total_seconds() < _rate_limit_seconds


def _mark_fired(rule_id: str) -> None:
    _last_fire[rule_id] = _now()


async def evaluate(after: dict) -> None:
    """Entry point — called once per Frigate `new` event."""
    camera_name = (after.get("camera") or "").strip()
    label = (after.get("label") or "").strip().lower()
    score = float(after.get("top_score") or after.get("score") or 0)
    zones_in = set(after.get("current_zones") or after.get("entered_zones") or [])
    if not camera_name or not label:
        return

    async with httpx.AsyncClient() as client:
        # Resolve camera by name slug (Frigate uses the slug we generated).
        cams = await _sb_get(client, "cameras", params={
            "select": "id,name,branch_id",
            "deleted_at": "is.null",
        })
        cam = _find_camera_by_slug(cams, camera_name)
        if not cam:
            log.info("no camera matches frigate name %s", camera_name)
            return

        rules = await _sb_get(client, "rules", params={
            "select": "*",
            "camera_id": f"eq.{cam['id']}",
            "active": "eq.true",
            "deleted_at": "is.null",
        })

        # Pull zones for slug→id mapping if needed.
        zones_by_slug: dict[str, str] = {}
        if zones_in:
            zone_rows = await _sb_get(client, "zones", params={
                "select": "id,name,camera_id",
                "camera_id": f"eq.{cam['id']}",
                "deleted_at": "is.null",
            })
            zones_by_slug = {_slug(z["name"]): z["id"] for z in zone_rows}

        for rule in rules:
            if rule["object_label"] != label:
                continue
            if score < float(rule.get("min_confidence") or 0):
                continue
            if rule.get("zone_id"):
                # Frigate gives zone slugs, not UUIDs.
                rule_zone_id = rule["zone_id"]
                slugs_for_rule = [s for s, zid in zones_by_slug.items() if zid == rule_zone_id]
                if not any(s in zones_in for s in slugs_for_rule):
                    continue
            if not _is_within_window(rule):
                continue
            if _rate_limited(rule["id"]):
                continue

            await _fire(client, rule, cam, after)


def _find_camera_by_slug(cams: list[dict], frigate_name: str) -> dict | None:
    for c in cams:
        if _slug(c["name"]) == frigate_name:
            return c
    return None


async def _fire(client: httpx.AsyncClient, rule: dict, cam: dict, after: dict) -> None:
    _mark_fired(rule["id"])
    log.info("rule fired: %s (camera=%s label=%s)", rule["name"], cam["name"], rule["object_label"])

    event_body = {
        "rule_id": rule["id"],
        "camera_id": cam["id"],
        "branch_id": cam.get("branch_id"),
        "object_label": rule["object_label"],
        "confidence": after.get("top_score") or after.get("score"),
        "severity": rule.get("severity") or "medium",
        "metadata": {
            "frigate_event_id": after.get("id"),
            "zones": after.get("current_zones"),
            "score": after.get("score"),
            "start_time": after.get("start_time"),
        },
    }
    try:
        await _sb_post(client, "events", event_body)
    except httpx.HTTPError as e:
        log.warning("event insert failed: %s", e)

    # Bump rule fire counter.
    try:
        await client.patch(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/rules",
            params={"id": f"eq.{rule['id']}"},
            json={"fire_count": (rule.get("fire_count") or 0) + 1, "last_fired_at": _now().isoformat()},
            headers=_headers(),
            timeout=5.0,
        )
    except httpx.HTTPError:
        pass

    # Dispatch alerts to recipients on this rule.
    recipient_ids = rule.get("alert_recipient_ids") or []
    if not recipient_ids:
        return
    try:
        rec_rows = await _sb_get(client, "alert_recipients", params={
            "select": "id,whatsapp_number,email,active",
            "id": f"in.({','.join(recipient_ids)})",
            "active": "eq.true",
            "deleted_at": "is.null",
        })
    except httpx.HTTPError as e:
        log.warning("recipient lookup failed: %s", e)
        return

    body = _format_alert_body(rule, cam, after)
    for rec in rec_rows:
        wa = rec.get("whatsapp_number")
        if wa:
            try:
                await alerts.send_whatsapp(wa, body)
            except Exception as e:  # noqa: BLE001
                log.warning("whatsapp send failed for %s: %s", wa, e)


def _format_alert_body(rule: dict, cam: dict, after: dict) -> str:
    score = after.get("top_score") or after.get("score") or 0
    sev = (rule.get("severity") or "medium").upper()
    return (
        f"🔔 SmartSnap [{sev}]\n"
        f"{rule['name']}\n"
        f"Camera: {cam['name']}\n"
        f"Detected: {rule['object_label']} (conf {round(float(score)*100)}%)\n"
        f"Time: {_now().strftime('%Y-%m-%d %H:%M:%S UTC')}"
    )


def schedule(after: dict) -> None:
    """Fire-and-forget wrapper for callers that aren't already in an event loop."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(evaluate(after))
        else:
            loop.run_until_complete(evaluate(after))
    except RuntimeError:
        asyncio.run(evaluate(after))
