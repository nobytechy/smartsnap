# SmartSnap — Claude Code context

Project-level instructions, auto-loaded by Claude Code in any session started inside `C:\xampp\htdocs\smartsnap\`.

## What this is

AI CCTV alerting platform. Takes feeds from existing IP cameras (or uploaded video / YouTube URLs during trial), runs YOLOv8 detection through Frigate, applies user-defined zone + rule logic, fires WhatsApp + dashboard alerts.

**Trial client:** Biggie's Hollies & Redcafe nightclubs in Harare. Go-ahead given 2026-05-26.

**Plan B positioning:** cross-vertical security platform — same product re-pitched per industry (warehouses, retail, schools, hotels). Multi-vertical landing copy ships in week 5.

**Tagline:** *"Turn your existing CCTV into a smart alerting platform."*

## Architecture (locked — do not re-architect without explicit ask)

```
Cameras / uploads / YouTube
        │
        ▼
┌─────────────────────────────┐
│  Frigate    Mosquitto       │ — Docker Compose on Noby's laptop
│           +                 │   (trial) or Hetzner CX21 (live)
│         FastAPI             │
└──────────┬──────────────────┘
           │
   ┌───────┼──────────────┐
   │       │              │
   ▼       ▼              ▼
Supabase  UltraMsg     Claude API
(events,  WhatsApp     (weekly
 storage, alerts)      summaries,
 auth)                 POS correlation)
   ▲
   │
React frontend (Netlify) ─── operator phones / dashboards
```

- **Frontend:** React 19 + Vite + Tailwind v4 + Supabase JS client. Netlify-hosted.
- **Backend:** Docker Compose with three services — Frigate (CV), Mosquitto (MQTT), FastAPI (Python rule engine + Supabase writer + alert dispatcher).
- **Database:** Supabase project `eiuucoqzafeadmjfvikk` in Frankfurt. Anon JWT + RLS pattern (same as Till).
- **Trial tunnel:** Tailscale Funnel — stable HTTPS URL, free. URL stored in `app_settings.api_base_url` (single source of truth — change via Admin Settings, never hardcode).
- **Live tunnel (post-payment):** Caddy on Hetzner CX21 (€6/mo) fronting the same Compose. Same code, only the `app_settings.api_base_url` value changes.

## Folder structure

```
smartsnap/
├── frontend/          # React 19 + Vite + Tailwind v4
│   └── src/
├── backend/           # Docker Compose root
│   ├── api/           # FastAPI service (Python)
│   ├── frigate/       # Frigate config + media volumes
│   ├── mosquitto/     # MQTT broker config
│   └── docker-compose.yml
├── supabase/
│   └── install.sql    # idempotent schema — re-runnable
├── CLAUDE.md          # this file
├── README.md          # pitch-language overview (per packaging convention)
└── Instructions.md    # operator manual (per packaging convention)
```

## Tech stack locks

- **Python + FastAPI** for the backend service — NOT Node. Chosen for CV ecosystem + reuse from CV Studio. Don't suggest switching.
- **Frigate is the AI engine** — open source, free, runs YOLOv8 — never roll a custom CV model. If accuracy gaps appear, tune zones + thresholds first.
- **Per-row tables from day one** — not whole-blob sync. Lessons from the Till data-loss incident apply preemptively.
- **`app_settings` table for all config** — no hardcoded secrets in code, ever. Includes `api_base_url`, all third-party tokens, retention, business hours, branding, feature flags.

## Branding

- **Palette: Carbon Burgundy** — `--color-zim-red-600: #9C1C2A` (primary, matches zimFDMS) + zinc-900 base + `#D89A00` gold accents + pink/red for alert severity scale. Gradient hero on landing for an "alive" feel.
- **Logo:** text-logo for v1.
- **Voice:** professional + Zim-grounded. Use polished pitch language — no "MVP / demo / POC / bug" (see `feedback_client_pitch_language.md` in memory). Use "trial / pilot / first version / issue / fix" instead.

## Detection rules SmartSnap promises

| Rule | Reliability | In-scope? |
|---|---|---|
| Crowd density at entrance | 90%+ | ✅ v1 |
| VIP / restricted zone intrusion | 90%+ | ✅ v1 |
| After-hours presence | 95%+ | ✅ v1 |
| Loitering | 85%+ | ✅ v1 |
| Parking occupancy | 90%+ | ✅ v1 |
| Door dwell time | 85%+ | ✅ v1 |
| Vehicle counting | 90%+ | ✅ v1 |
| **Fight detection** | unreliable | ❌ NEVER promise |
| **Theft detection** | requires custom training | ❌ NEVER promise |
| **Face recognition** | legal grey area | ❌ NEVER promise |
| **Bartender inactivity / staff sleeping** | lawsuit risk | ❌ NEVER promise |
| **Weapon detection** | unreliable off-the-shelf | ❌ NEVER promise |

If a client asks for the ❌ items, redirect to the ✅ list. Never agree to build them.

## Killer differentiator (the moat)

**POS correlation worker.** Cross-references SmartSnap crowd counts with Till POS sales data from the Hollies Supabase project. Example: *"80 patrons in bar zone, only 12 transactions — variance flag."* Only Noby has Till data access. This is week 4-5 work (#109). When discussing competitive positioning, lean on this hard.

## Conventions to follow

- **PIN auth pattern:** 4-digit PINs, hashed via Postgres `crypt(pin, gen_salt('bf'))`, lockout after 3/5 wrong attempts. RPCs: `verify_pin`, `set_pin`, `generate_random_pin`. Auto-gen + re-roll on register.
- **Soft delete everywhere:** `deleted_at timestamptz` column on all editable tables. Never hard-delete data.
- **`updated_at` + `updated_by`:** every editable table. Trigger keeps `updated_at` fresh.
- **Audit log:** every admin action (role change, PIN rotation, user create/delete, settings change) writes to `audit_log` with before/after JSON via the FastAPI service.
- **Daily backup:** pg_cron schedule `0 1 * * *` UTC (3am Harare) snapshots all non-event tables into `daily_backups`. Last 30 days retained.
- **Realtime:** all admin-edited tables added to `supabase_realtime` publication — frontend subscribes via Supabase JS realtime.
- **Git author:** `Noby <nobytechy@gmail.com>` per-repo. Never add Claude/AI co-author or attribution (see `feedback_no_claude_attribution.md` in memory).

## Defaults (in install.sql seed)

| Setting | Value |
|---|---|
| Admin user | name `Admin`, PIN `0000` |
| Roles | Admin · Head Security · Security · Loss Control Officer · Manager |
| Business hours | 09:00 → 02:00 (Africa/Harare) |
| Camera defaults | 5 fps, 1080p |
| Retention | events 90d · snapshots 30d · clips 7d |
| Alert rate limit | 5/min per rule |
| Weekly Claude summary | Monday 08:00 |

All editable from Admin → Settings without code change.

## Trial protocol (current phase)

- Backend (Frigate + Mosquitto + FastAPI Docker Compose) runs on Noby's laptop
- Tailscale Funnel exposes the FastAPI port via a stable HTTPS URL
- Frontend on Netlify reads `api_base_url` from Supabase `app_settings` row at boot
- Laptop must be on + Tailscale up when testers hit the URL
- If Noby travels: WhatsApp Biggie "trial offline today" before unplugging
- Constraint disappears once Biggie pays → migrate to Hetzner CX21 (same Compose, only `api_base_url` row changes)

## Common commands (will fill in as code lands)

```bash
# Frontend dev (once scaffolded)
cd frontend && npm run dev

# Backend up (once Docker Compose written)
cd backend && docker compose up -d

# Tailscale Funnel for the trial
tailscale funnel 8080      # or whichever port FastAPI binds

# Schema re-run (safe — idempotent)
# Paste supabase/install.sql into Supabase SQL editor
```

## Where to look first when picking up SmartSnap work

| Question | Look here |
|---|---|
| Active tasks + status | TaskList tool (look for #94-#112 prefixed "SmartSnap" or "AI CCTV") |
| Project state, recent decisions, pitch context | `~/.claude/projects/C--xampp-htdocs-smartsnap/memory/project_smartsnap.md` |
| Schema + RLS + RPCs | `supabase/install.sql` (single source of truth) |
| All config values | Supabase `app_settings` table (NOT in code) |
| Supabase credentials | memory `project_smartsnap.md` (gitignored from repo) |
| Cross-app context | `C:\xampp\htdocs\CLAUDE.md` (parent) |
| Universal Noby rules | memory `feedback_*.md` files |

## House rules specific to SmartSnap

- **Never hardcode the API base URL.** Read it from `app_settings.api_base_url` at app boot. The whole point is being able to change it without redeploying.
- **Never commit `.env` files or Supabase service keys.** Service key stays backend-only and goes via Docker secrets / env vars at deploy time.
- **Never seed real customer data.** Synthetic-data-only rule applies (per parent CLAUDE.md).
- **When detection accuracy comes up:** tune Frigate zones + thresholds first, custom-trained models only if the client commits to Phase 3.
- **When a client asks for fight/theft/face-rec:** redirect. Don't agree to build something that won't work in production.
- **`Sync Now` / data-loss patterns from Till don't apply here** — SmartSnap's data shape is admin-edits + append-only events. No concurrent offline writes from multiple cashier devices. Keep architecture simple.
