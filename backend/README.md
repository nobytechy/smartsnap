# SmartSnap — backend

Docker Compose stack: Frigate (CV) · Mosquitto (MQTT) · FastAPI (rule engine + Supabase writer + alert dispatcher).

## Start

```bash
cp api/.env.example api/.env   # then edit
docker compose up -d
```

## Endpoints (FastAPI)

- `GET /`         — service identity
- `GET /healthz`  — config check (Supabase configured?, MQTT host, Frigate URL)

## Tailscale Funnel

The FastAPI service binds `:8080`. The Tailscale Funnel route on the host laptop forwards
`https://desktop-vkmofe4.tail489ce7.ts.net` → `localhost:8080`. The frontend reads this URL
from Supabase `app_settings.api_base_url` at boot — never hardcode it.

## Frigate

- UI:    http://localhost:5000
- RTSP:  rtsp://localhost:8554
- Config is generated from Supabase `cameras` + `zones` + `rules` at boot (TODO).
- For now `frigate/config/config.yml` is a placeholder with a disabled camera so the container boots clean.

## MQTT

Mosquitto listens on `:1883` with anonymous access (trial). Frigate publishes detection events to
`frigate/<camera>/<label>/...`; the FastAPI service subscribes and applies rule logic.
