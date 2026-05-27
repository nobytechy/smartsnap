"""
Alert dispatcher. UltraMsg WhatsApp primary, email fallback (TODO).
"""
from __future__ import annotations
import httpx

from .config import settings


async def send_whatsapp(to: str, body: str, image_url: str | None = None) -> dict:
    if not settings.ultramsg_instance_id or not settings.ultramsg_token:
        return {"ok": False, "reason": "ultramsg_not_configured"}
    base = f"https://api.ultramsg.com/{settings.ultramsg_instance_id}"
    if image_url:
        endpoint = f"{base}/messages/image"
        payload = {"token": settings.ultramsg_token, "to": to, "image": image_url, "caption": body}
    else:
        endpoint = f"{base}/messages/chat"
        payload = {"token": settings.ultramsg_token, "to": to, "body": body}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(endpoint, data=payload)
        return {"ok": r.status_code == 200, "status": r.status_code, "body": r.text}
