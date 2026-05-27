# SmartSnap

**Turn your existing CCTV into a smart alerting platform.**

SmartSnap watches the camera feeds you already have, learns the rules that matter to your site, and pings the right person the moment something goes wrong — no rip-and-replace, no custom hardware to start.

---

## What it does

| | |
|---|---|
| **Crowd density** at the entrance | *"15+ people clustered at the door"* |
| **Restricted-zone intrusion** | *"Someone stepped behind the bar"* |
| **After-hours presence** | *"Movement at 03:14"* |
| **Loitering** | *"Person at the back gate for 8 minutes"* |
| **Vehicle counting** | *"3rd vehicle in 2 minutes"* |
| **Object detection** | *"Backpack left at table 14"* |

Each rule fires a WhatsApp alert with a snapshot of the moment, in under a second.

## Who it's for

Nightclubs · Bars · Restaurants · Warehouses · Retail · Schools · Hotels · Mines · Industrial sites — anywhere with existing IP cameras and a security operator who would benefit from being told *exactly when* to look.

## How it works

Three steps, milliseconds apart:

1. **Connect your cameras** — RTSP, IP, MJPEG, or even a phone running the IP Webcam app.
2. **Draw your rules** — Pick objects (person, car, bag, etc.), zones, dwell times, who gets pinged.
3. **Get the right alerts** — WhatsApp + a live dashboard. Snapshot attached. No noise.

## Architecture

```
Cameras / phones / uploaded video
         │
         ▼
  Frigate + Mosquitto + FastAPI   ← Docker Compose
         │
   ┌─────┼──────────────┐
   ▼     ▼              ▼
Supabase  UltraMsg      Claude (weekly summaries)
(events,  (WhatsApp
 storage,  alerts)
 auth)
   ▲
   │
React frontend (Netlify) ── operator phones / dashboards
```

- **Frontend:** React 19 · Vite · Tailwind v4 · Supabase JS
- **Backend:** FastAPI · Frigate (YOLOv8 via OpenVINO) · Mosquitto · Docker Compose
- **Data:** Supabase (Postgres + RLS + realtime)
- **Alerts:** UltraMsg WhatsApp · email fallback · Claude API for weekly insights

## Detection rules we promise

✅ Crowd density · restricted zones · after-hours · loitering · parking occupancy · door dwell · vehicle counting

We do **not** promise fight detection, theft detection, or face recognition with off-the-shelf gear — those need custom-trained models and a different conversation.

## Live

- Landing & login: *deployed on Netlify (link added once site is live)*
- Live camera feed: `/live` (public, polled snapshots)
- Operator console: `/app` (PIN auth)

## Local development

```bash
# Frontend (port 5173)
cd frontend && npm install && npm run dev

# Backend (Frigate + Mosquitto + FastAPI on Docker)
cd backend && docker compose up -d

# Database
# Paste supabase/install.sql into the Supabase SQL editor
```

See `CLAUDE.md` for the full project map and `Instructions.md` for the operator manual.

---

Powered by [Noby](https://nobie.netlify.app).
