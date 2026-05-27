from __future__ import annotations
import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings
from .supabase_client import close_client, get_client
from . import frigate_config, frigate_client, alerts, mqtt_consumer


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("smartsnap.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    mqtt_consumer.start_mqtt(asyncio.get_running_loop())
    try:
        if settings.supabase_url and settings.supabase_service_key:
            try:
                path = await frigate_config.write_config_file()
                log.info("frigate config written on boot: %s", path)
            except Exception as e:  # noqa: BLE001
                log.warning("frigate config bootstrap failed: %s", e)
        yield
    finally:
        mqtt_consumer.stop_mqtt()
        await close_client()


app = FastAPI(title="SmartSnap API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"service": "smartsnap-api", "status": "ok", "version": app.version}


@app.get("/healthz")
async def healthz():
    out = {
        "ok": True,
        "supabase_configured": bool(settings.supabase_url and settings.supabase_service_key),
        "mqtt_host": settings.mqtt_host,
        "frigate_url": settings.frigate_url,
        "ultramsg_configured": bool(settings.ultramsg_instance_id and settings.ultramsg_token),
    }
    out["frigate"] = await frigate_client.get_stats() is not None
    return out


@app.post("/frigate/regenerate")
async def regenerate_frigate():
    if not (settings.supabase_url and settings.supabase_service_key):
        raise HTTPException(503, "supabase not configured")
    try:
        path = await frigate_config.write_config_file()
    except Exception as e:  # noqa: BLE001
        log.exception("frigate config write failed")
        raise HTTPException(500, f"config write failed: {e}") from e
    restart_result = await frigate_client.restart()
    return {"ok": True, "config_path": str(path), "restart": restart_result}


class TestAlert(BaseModel):
    to: str
    body: str
    image_url: str | None = None


@app.post("/alerts/test")
async def alerts_test(payload: TestAlert):
    result = await alerts.send_whatsapp(payload.to, payload.body, payload.image_url)
    if not result.get("ok"):
        raise HTTPException(502, str(result))
    return result


@app.get("/frigate/cameras")
async def list_frigate_cameras():
    """Public list of camera slugs so the Live page can build a selector."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(f"{settings.frigate_url.rstrip('/')}/api/config")
        if r.status_code != 200:
            return {"cameras": []}
        cams = r.json().get("cameras", {}) or {}
        return {"cameras": [
            {"slug": slug, "enabled": bool(cfg.get("enabled", True))}
            for slug, cfg in cams.items()
        ]}


@app.get("/frigate/snapshot/{camera}")
async def frigate_snapshot(
    camera: str,
    height: int = 720,
    bbox: int = 0,           # draw bounding boxes around detected objects
    motion: int = 0,         # outline motion regions
    regions: int = 0,        # outline inference regions
    timestamp: int = 0,      # overlay timestamp
    quality: int = 80,
):
    """Public proxy: returns the latest snapshot of a camera from Frigate.
    Forwards the optional annotation flags (bbox/motion/regions/timestamp)."""
    base = settings.frigate_url.rstrip("/")
    params = {
        "height": height,
        "bbox": bbox,
        "motion": motion,
        "regions": regions,
        "timestamp": timestamp,
        "quality": quality,
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        for ext in ("webp", "jpg"):
            try:
                r = await client.get(f"{base}/api/{camera}/latest.{ext}", params=params)
            except httpx.HTTPError:
                continue
            if r.status_code == 200 and r.content:
                return Response(
                    content=r.content,
                    media_type=r.headers.get("content-type", f"image/{ext}"),
                    headers={"Cache-Control": "no-store"},
                )
    raise HTTPException(404, "snapshot not available")


@app.get("/debug/counts")
async def debug_counts():
    sb = get_client()
    out = {}
    for t in ["branches", "cameras", "zones", "rules", "events", "users"]:
        rows = await sb.select(t, params={"select": "id", "limit": "1000"})
        out[t] = len(rows)
    return out
