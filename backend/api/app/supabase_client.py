"""
Thin async PostgREST client over httpx. Service-role key — backend only.
Don't import this from anything the frontend can reach.
"""
from __future__ import annotations
from typing import Any
import httpx

from .config import settings


class SupabaseError(RuntimeError):
    pass


class SupabaseClient:
    def __init__(self) -> None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise SupabaseError("SUPABASE_URL / SUPABASE_SERVICE_KEY not configured")
        self._base = settings.supabase_url.rstrip("/") + "/rest/v1"
        self._headers = {
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=15.0, headers=self._headers)

    async def close(self) -> None:
        await self._client.aclose()

    async def select(self, table: str, *, params: dict[str, Any] | None = None) -> list[dict]:
        r = await self._client.get(f"{self._base}/{table}", params=params)
        self._raise(r)
        return r.json()

    async def insert(self, table: str, payload: dict | list[dict]) -> list[dict]:
        r = await self._client.post(
            f"{self._base}/{table}",
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        self._raise(r)
        return r.json()

    async def update(self, table: str, *, match: dict, payload: dict) -> list[dict]:
        params = {k: f"eq.{v}" for k, v in match.items()}
        r = await self._client.patch(
            f"{self._base}/{table}",
            params=params,
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        self._raise(r)
        return r.json()

    async def rpc(self, name: str, payload: dict | None = None) -> Any:
        r = await self._client.post(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/{name}",
            json=payload or {},
        )
        self._raise(r)
        return r.json()

    @staticmethod
    def _raise(r: httpx.Response) -> None:
        if r.status_code >= 400:
            raise SupabaseError(f"{r.status_code} {r.text}")


_client: SupabaseClient | None = None


def get_client() -> SupabaseClient:
    global _client
    if _client is None:
        _client = SupabaseClient()
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
