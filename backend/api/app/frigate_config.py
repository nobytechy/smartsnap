"""
Generates Frigate's config.yml from Supabase rows.

Source of truth for cameras/zones is the database — never edit /config/config.yml
by hand. Run /frigate/regenerate after any camera/zone change to push.
"""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Any
import yaml

from .supabase_client import get_client
from . import youtube

log = logging.getLogger("smartsnap.frigate_config")


FRIGATE_CONFIG_PATH = Path("/config/config.yml")

RESOLUTIONS = {
    "480p":  (854, 480),
    "720p":  (1280, 720),
    "1080p": (1920, 1080),
}


def _slug(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in (name or "")).strip("_").lower() or "cam"


async def _resolve_input_path(cam: dict) -> str | None:
    kind = cam.get("source_kind")
    url = (cam.get("source_url") or "").strip()
    if not url:
        return None
    if kind in ("rtsp", "http_mjpeg", "phone"):
        return url
    if kind == "file":
        if url.startswith("/"):
            return url
        return f"/media/frigate/uploads/{url}"
    if kind == "youtube":
        try:
            path = await youtube.ensure_local(url)
            return str(path)
        except Exception as e:  # noqa: BLE001
            log.warning("youtube download failed for %s: %s", url, e)
            return None
    return url


async def _build_camera_block(cam: dict, zones: list[dict]) -> dict[str, Any]:
    res = RESOLUTIONS.get(cam.get("resolution") or "720p", RESOLUTIONS["720p"])
    width, height = res
    input_path = (await _resolve_input_path(cam)) or "rtsp://127.0.0.1:8554/placeholder"
    kind = cam.get("source_kind")

    zones_block: dict[str, Any] = {}
    for z in zones:
        zones_block[_slug(z["name"])] = {
            "coordinates": _polygon_to_coords(z.get("polygon_json"), width, height),
        }

    # File/YouTube trial sources rarely have audio — keep them detect-only
    # so the record pipeline (which uses an audio-aac preset) doesn't choke.
    roles = ["detect"] if kind in ("file", "youtube") else ["detect", "record"]

    # Per-source ffmpeg input args. The default Frigate preset is RTSP-tuned and
    # breaks HTTP MJPEG — pass empty args for those and let ffmpeg auto-detect mpjpeg.
    if kind in ("file", "youtube"):
        per_input_args: Any = ["-re", "-stream_loop", "-1"]
    elif kind in ("phone", "http_mjpeg"):
        per_input_args = ["-fflags", "+genpts+discardcorrupt", "-flags", "low_delay", "-rtbufsize", "100M"]
    else:
        per_input_args = []

    ffmpeg_block: dict[str, Any] = {
        "inputs": [{
            "path": input_path,
            "roles": roles,
            "input_args": per_input_args,
        }],
    }

    block: dict[str, Any] = {
        "enabled": bool(cam.get("active", True)),
        "ffmpeg": ffmpeg_block,
        "detect": {
            "enabled": True,
            "width": width,
            "height": height,
            "fps": max(5, int(cam.get("fps") or 5)),
        },
        # More sensitive motion for looped trial videos — looped content
        # otherwise gets averaged into the background model.
        "motion": {"threshold": 20, "contour_area": 5, "frame_alpha": 0.05},
    }
    if zones_block:
        block["zones"] = zones_block
    return block


def _polygon_to_coords(polygon: Any, width: int, height: int) -> str:
    """
    Accepts polygon_json shapes: [[x,y], [x,y], ...] or {"points": [...]}.
    Returns Frigate's "x1,y1,x2,y2,..." string format. Treats floats <=1 as fractions.
    """
    pts = polygon
    if isinstance(polygon, dict):
        pts = polygon.get("points") or polygon.get("coordinates") or []
    if not isinstance(pts, list) or not pts:
        return f"0,0,{width},0,{width},{height},0,{height}"
    parts: list[str] = []
    for p in pts:
        if isinstance(p, dict):
            x, y = p.get("x"), p.get("y")
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            x, y = p[0], p[1]
        else:
            continue
        if isinstance(x, float) and 0 <= x <= 1:
            x = int(x * width)
        if isinstance(y, float) and 0 <= y <= 1:
            y = int(y * height)
        parts.append(f"{int(x)},{int(y)}")
    return ",".join(parts) or f"0,0,{width},0,{width},{height},0,{height}"


async def fetch_state() -> tuple[list[dict], list[dict]]:
    sb = get_client()
    cams = await sb.select("cameras", params={
        "select": "*",
        "active": "eq.true",
        "deleted_at": "is.null",
    })
    zones = await sb.select("zones", params={
        "select": "*",
        "deleted_at": "is.null",
    })
    return cams, zones


async def build_config() -> dict[str, Any]:
    cams, zones = await fetch_state()
    zones_by_cam: dict[str, list[dict]] = {}
    for z in zones:
        zones_by_cam.setdefault(z["camera_id"], []).append(z)

    cameras_block: dict[str, Any] = {}
    if not cams:
        cameras_block["trial_placeholder"] = {
            "enabled": False,
            "ffmpeg": {"inputs": [{"path": "rtsp://127.0.0.1:8554/placeholder", "roles": ["detect"]}]},
            "detect": {"width": 1280, "height": 720, "fps": 4},
        }
    else:
        for c in cams:
            cameras_block[_slug(c["name"])] = await _build_camera_block(c, zones_by_cam.get(c["id"], []))

    return {
        "mqtt": {"host": "mosquitto", "port": 1883, "topic_prefix": "frigate"},
        "detectors": {"ov": {"type": "openvino", "device": "CPU"}},
        "model": {
            "model_type": "ssd",
            "width": 300, "height": 300,
            "input_tensor": "nhwc", "input_pixel_format": "bgr",
            "path": "/openvino-model/ssdlite_mobilenet_v2.xml",
            "labelmap_path": "/openvino-model/coco_91cl_bkgr.txt",
        },
        # Frigate v0.17 record schema. Tuned for laptop trial.
        "record": {
            "enabled": True,
            "alerts":     {"retain": {"days": 14}},
            "detections": {"retain": {"days": 14}},
            "continuous": {"days": 0},
            "motion":     {"days": 3},
        },
        "snapshots": {"enabled": True, "retain": {"default": 14}},
        # NOTE: Intel QSV hwaccel needs /dev/dri mapped, which Docker Desktop on Windows
        # cannot do. Software decode on trial laptop; flip to preset-intel-qsv-h264 on Hetzner.
        # Enable YOLO detection for the labels we actually act on in rules.
        "objects": {
            # COCO classes — kept to what's actually useful in venue/CCTV
            # security contexts plus common test objects.
            "track": [
                "person", "car", "truck", "motorcycle", "bicycle", "bus",
                "dog", "cat",
                "backpack", "handbag", "suitcase",
                "bottle", "cup", "knife",
                "tv", "laptop", "cell phone", "book",
                "chair", "couch", "dining table", "potted plant",
                "oven", "refrigerator", "microwave",
                "sports ball", "teddy bear",
            ],
        },
        # v0.17 surfaces detections through the review pipeline.
        "review": {
            "alerts":     {"labels": ["person"]},
            "detections": {"labels": ["person", "car", "motorcycle", "bicycle", "bus", "dog", "cat"]},
        },
        "cameras": cameras_block,
    }


async def write_config_file() -> Path:
    cfg = await build_config()
    FRIGATE_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    text = yaml.safe_dump(cfg, sort_keys=False, default_flow_style=False)
    FRIGATE_CONFIG_PATH.write_text(text, encoding="utf-8")
    return FRIGATE_CONFIG_PATH
