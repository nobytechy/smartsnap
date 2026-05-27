"""
Minimal Frigate control plane. Restart Frigate to pick up a fresh config.yml.
"""
from __future__ import annotations
import httpx

from .config import settings


async def restart() -> dict:
    """
    Frigate's /api/restart endpoint restarts the internal process so it re-reads
    config.yml. Available since v0.14. If it ever 404s we'll fall back to
    docker.sock + container restart.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(f"{settings.frigate_url.rstrip('/')}/api/restart")
        if r.status_code >= 400:
            return {"ok": False, "status": r.status_code, "body": r.text}
        return {"ok": True, "status": r.status_code}


async def get_stats() -> dict | None:
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get(f"{settings.frigate_url.rstrip('/')}/api/stats")
            if r.status_code == 200:
                return r.json()
        except httpx.HTTPError:
            pass
    return None
