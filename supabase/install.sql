-- =====================================================================
-- SmartSnap — install.sql
-- =====================================================================
-- One-shot, idempotent. Safe to re-run on a fresh OR existing project.
-- Run this in Supabase SQL editor of the `smartsnap` project.
--
-- What this creates:
--   1.  Extensions:        pgcrypto (PIN hashing), pg_cron (daily backup)
--   2.  app_settings:      key/value config — no hardcoded secrets in code
--   3.  roles + role_permissions:  Admin / Head Security / Security / LCO / Manager
--   4.  users:             PIN-hashed, lockout-aware, soft-delete
--   5.  branches:          multi-site support
--   6.  cameras:           multi-source (rtsp / http_mjpeg / phone / file / youtube)
--   7.  zones:             polygon-on-still
--   8.  rules:             camera + zone + label + dwell + time window + recipients
--   9.  alert_recipients:  branch- or rule-scoped WhatsApp / email targets
--  10.  events:            append-only fired-rule log with snapshots
--  11.  audit_log:         actor + action + before/after JSON
--  12.  daily_backups:     pg_cron snapshot at 1am UTC (3am Africa/Harare)
--  13.  RPCs:              verify_pin · set_pin · generate_random_pin
--  14.  touch_updated_at:  trigger function (on every updateable table)
--  15.  RLS:               every table enabled, anon JWT read/write under policy
--
-- Seeds:
--   * 5 system roles with default per-screen permissions
--   * 1 Admin user with PIN 0000
--   * 18 app_settings rows (api_base_url, business_hours, retention, branding…)
--
-- Verify after running:
--   select count(*) from public.roles;          -- expect 5
--   select count(*) from public.users;          -- expect 1 (Admin)
--   select count(*) from public.app_settings;   -- expect 18
-- =====================================================================


-- =====================================================================
-- 1. EXTENSIONS
-- =====================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_cron;


-- =====================================================================
-- 2. APP SETTINGS  (key/value — single source of truth for config)
-- =====================================================================
create table if not exists public.app_settings (
    key         text primary key,
    value       jsonb not null,
    description text,
    is_secret   boolean default false,
    updated_at  timestamptz default now(),
    updated_by  uuid
);

insert into public.app_settings (key, value, description, is_secret) values
    ('api_base_url',                '"https://example.ts.net"',                                     'Backend URL (Tailscale Funnel during trial, Hetzner subdomain later). Set after tunnel starts.', false),
    ('business_hours_open',         '"09:00"',                                                       'Default opening time for after-hours rules.',                                                    false),
    ('business_hours_close',        '"02:00"',                                                       'Default closing time for after-hours rules.',                                                    false),
    ('default_camera_fps',          '5',                                                              'Default detection FPS for new cameras.',                                                         false),
    ('default_resolution',          '"1080p"',                                                       'Default detection resolution for new cameras.',                                                  false),
    ('retention_days_events',       '90',                                                             'How long event records are kept.',                                                              false),
    ('retention_days_snapshots',    '30',                                                             'How long snapshots are kept in Storage.',                                                       false),
    ('retention_days_clips',        '7',                                                              'How long video clips are kept on the edge box.',                                                false),
    ('alert_rate_limit_per_minute', '5',                                                              'Max alerts per rule per minute before throttle.',                                               false),
    ('weekly_summary_day',          '"monday"',                                                      'Day of week the Claude executive summary fires.',                                               false),
    ('weekly_summary_hour',         '8',                                                              'Hour (24h) the Claude executive summary fires.',                                                false),
    ('default_alert_phone',         '""',                                                            'Default WhatsApp recipient when a rule has no recipients set.',                                 false),
    ('branding_app_name',           '"SmartSnap"',                                                   'App name shown in UI.',                                                                         false),
    ('branding_tagline',            '"Turn your existing CCTV into a smart alerting platform"',     'Marketing tagline shown on landing.',                                                           false),
    ('feature_flags',               '{}',                                                            'Feature toggles (JSON object).',                                                                false),
    ('ultramsg_token',              '""',                                                            'UltraMsg API token. Set via Admin Settings.',                                                  true),
    ('ultramsg_instance_id',        '""',                                                            'UltraMsg instance ID. Set via Admin Settings.',                                                true),
    ('claude_api_key',              '""',                                                            'Anthropic Claude API key (weekly summaries + POS correlation).',                                true),
    ('resend_api_key',              '""',                                                            'Resend email API key (fallback delivery).',                                                    true)
on conflict (key) do nothing;


-- =====================================================================
-- 3. ROLES + ROLE PERMISSIONS
-- =====================================================================
create table if not exists public.roles (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text,
    is_system   boolean default false,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),
    deleted_at  timestamptz
);

create table if not exists public.role_permissions (
    role_id     uuid not null references public.roles(id) on delete cascade,
    screen_key  text not null,
    can_view    boolean default false,
    can_edit    boolean default false,
    primary key (role_id, screen_key)
);

insert into public.roles (name, description, is_system) values
    ('Admin',                'Full system access',                       true),
    ('Head Security',        'Manages security ops + reviews events',    false),
    ('Security',             'Acks and reviews live events',             false),
    ('Loss Control Officer', 'POS correlation + financial event review', false),
    ('Manager',              'Branch-level oversight + reports',         false)
on conflict (name) do nothing;

-- Seed default per-screen permissions
do $$
declare
    admin_id    uuid;
    head_id     uuid;
    sec_id      uuid;
    lco_id      uuid;
    mgr_id      uuid;
begin
    select id into admin_id from public.roles where name = 'Admin';
    select id into head_id  from public.roles where name = 'Head Security';
    select id into sec_id   from public.roles where name = 'Security';
    select id into lco_id   from public.roles where name = 'Loss Control Officer';
    select id into mgr_id   from public.roles where name = 'Manager';

    -- Admin: everything
    insert into public.role_permissions (role_id, screen_key, can_view, can_edit) values
        (admin_id, 'dashboard',   true, true),
        (admin_id, 'events',      true, true),
        (admin_id, 'branches',    true, true),
        (admin_id, 'cameras',     true, true),
        (admin_id, 'zones',       true, true),
        (admin_id, 'rules',       true, true),
        (admin_id, 'recipients',  true, true),
        (admin_id, 'users',       true, true),
        (admin_id, 'roles',       true, true),
        (admin_id, 'insights',    true, true),
        (admin_id, 'settings',    true, true),
        (admin_id, 'audit',       true, false)
    on conflict do nothing;

    -- Head Security
    insert into public.role_permissions (role_id, screen_key, can_view, can_edit) values
        (head_id, 'dashboard',  true, false),
        (head_id, 'events',     true, true),
        (head_id, 'cameras',    true, false),
        (head_id, 'zones',      true, false),
        (head_id, 'rules',      true, true),
        (head_id, 'recipients', true, true),
        (head_id, 'insights',   true, false)
    on conflict do nothing;

    -- Security
    insert into public.role_permissions (role_id, screen_key, can_view, can_edit) values
        (sec_id, 'dashboard', true, false),
        (sec_id, 'events',    true, true)
    on conflict do nothing;

    -- Loss Control Officer
    insert into public.role_permissions (role_id, screen_key, can_view, can_edit) values
        (lco_id, 'dashboard', true, false),
        (lco_id, 'events',    true, true),
        (lco_id, 'insights',  true, false)
    on conflict do nothing;

    -- Manager
    insert into public.role_permissions (role_id, screen_key, can_view, can_edit) values
        (mgr_id, 'dashboard', true, false),
        (mgr_id, 'events',    true, true),
        (mgr_id, 'insights',  true, false),
        (mgr_id, 'cameras',   true, false),
        (mgr_id, 'rules',     true, false)
    on conflict do nothing;
end $$;


-- =====================================================================
-- 4. USERS  (PIN-hashed, lockout-aware, soft-delete)
-- =====================================================================
create table if not exists public.users (
    id                  uuid primary key default gen_random_uuid(),
    name                text not null,
    email               text unique,
    pin_hash            text not null,
    role_id             uuid not null references public.roles(id),
    branch_id           uuid,
    active              boolean default true,
    failed_pin_attempts int default 0,
    locked_until        timestamptz,
    last_login_at       timestamptz,
    created_at          timestamptz default now(),
    updated_at          timestamptz default now(),
    deleted_at          timestamptz,
    updated_by          uuid
);

-- Seed Admin user (PIN 0000)
do $$
declare
    admin_role_id uuid;
begin
    select id into admin_role_id from public.roles where name = 'Admin';
    if not exists (select 1 from public.users where name = 'Admin') then
        insert into public.users (name, pin_hash, role_id, active)
        values ('Admin', crypt('0000', gen_salt('bf')), admin_role_id, true);
    end if;
end $$;


-- =====================================================================
-- 5. BRANCHES
-- =====================================================================
create table if not exists public.branches (
    id               uuid primary key default gen_random_uuid(),
    name             text not null,
    location         text,
    contact_whatsapp text,
    timezone         text default 'Africa/Harare',
    active           boolean default true,
    created_at       timestamptz default now(),
    updated_at       timestamptz default now(),
    deleted_at       timestamptz,
    updated_by       uuid
);


-- =====================================================================
-- 6. CAMERAS  (multi-source: rtsp, http_mjpeg, phone, file, youtube)
-- =====================================================================
create table if not exists public.cameras (
    id                   uuid primary key default gen_random_uuid(),
    branch_id            uuid references public.branches(id) on delete cascade,
    name                 text not null,
    source_kind          text not null check (source_kind in ('rtsp','http_mjpeg','phone','file','youtube')),
    source_url           text not null,
    position_description text,
    fps                  int default 5,
    resolution           text default '1080p',
    active               boolean default true,
    last_seen_at         timestamptz,
    snapshot_url         text,
    created_at           timestamptz default now(),
    updated_at           timestamptz default now(),
    deleted_at           timestamptz,
    updated_by           uuid
);


-- =====================================================================
-- 7. ZONES  (polygon over a camera's still frame)
-- =====================================================================
create table if not exists public.zones (
    id           uuid primary key default gen_random_uuid(),
    camera_id    uuid not null references public.cameras(id) on delete cascade,
    name         text not null,
    polygon_json jsonb not null,
    color        text default '#9C1C2A',
    created_at   timestamptz default now(),
    updated_at   timestamptz default now(),
    deleted_at   timestamptz,
    updated_by   uuid
);


-- =====================================================================
-- 8. RULES  (camera + zone + label + dwell + time + recipients)
-- =====================================================================
create table if not exists public.rules (
    id                  uuid primary key default gen_random_uuid(),
    name                text not null,
    camera_id           uuid not null references public.cameras(id) on delete cascade,
    zone_id             uuid references public.zones(id) on delete cascade,
    object_label        text not null default 'person',
    min_dwell_seconds   int default 0,
    min_confidence      numeric(3,2) default 0.50,
    time_window_start   time,
    time_window_end     time,
    days_of_week        int[] default '{0,1,2,3,4,5,6}',
    severity            text default 'medium' check (severity in ('low','medium','high','critical')),
    alert_recipient_ids uuid[] default '{}',
    active              boolean default true,
    fire_count          bigint default 0,
    last_fired_at       timestamptz,
    created_at          timestamptz default now(),
    updated_at          timestamptz default now(),
    deleted_at          timestamptz,
    updated_by          uuid
);


-- =====================================================================
-- 9. ALERT RECIPIENTS
-- =====================================================================
create table if not exists public.alert_recipients (
    id              uuid primary key default gen_random_uuid(),
    branch_id       uuid references public.branches(id) on delete cascade,
    name            text not null,
    whatsapp_number text,
    email           text,
    scope           text default 'branch' check (scope in ('branch','all','rule')),
    active          boolean default true,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now(),
    deleted_at      timestamptz,
    updated_by      uuid
);


-- =====================================================================
-- 10. EVENTS  (append-only)
-- =====================================================================
create table if not exists public.events (
    id              uuid primary key default gen_random_uuid(),
    rule_id         uuid references public.rules(id) on delete set null,
    camera_id       uuid references public.cameras(id) on delete set null,
    branch_id       uuid references public.branches(id) on delete set null,
    fired_at        timestamptz not null default now(),
    object_label    text,
    confidence      numeric(3,2),
    metadata        jsonb default '{}',
    snapshot_url    text,
    clip_url        text,
    severity        text default 'medium',
    acknowledged_by uuid references public.users(id) on delete set null,
    acknowledged_at timestamptz,
    notes           text,
    delivery_status jsonb default '{}',
    created_at      timestamptz default now()
);

create index if not exists idx_events_fired_at on public.events (fired_at desc);
create index if not exists idx_events_branch   on public.events (branch_id, fired_at desc);
create index if not exists idx_events_rule     on public.events (rule_id);
create index if not exists idx_events_unack    on public.events (acknowledged_at) where acknowledged_at is null;


-- =====================================================================
-- 11. AUDIT LOG
-- =====================================================================
create table if not exists public.audit_log (
    id            bigserial primary key,
    actor_user_id uuid references public.users(id) on delete set null,
    action        text not null,
    target_table  text,
    target_id     uuid,
    before_json   jsonb,
    after_json    jsonb,
    metadata      jsonb default '{}',
    at            timestamptz default now()
);

create index if not exists idx_audit_at    on public.audit_log (at desc);
create index if not exists idx_audit_actor on public.audit_log (actor_user_id, at desc);


-- =====================================================================
-- 12. DAILY BACKUPS  (pg_cron at 1am UTC = 3am Africa/Harare)
-- =====================================================================
create table if not exists public.daily_backups (
    id          bigserial primary key,
    snapshot    jsonb not null,
    table_count int,
    created_at  timestamptz default now()
);

create or replace function public.snapshot_daily()
returns void
language plpgsql
security definer
as $$
declare
    blob jsonb;
begin
    blob := jsonb_build_object(
        'taken_at',         now(),
        'app_settings',     coalesce((select jsonb_agg(s) from public.app_settings s),                                    '[]'::jsonb),
        'roles',            coalesce((select jsonb_agg(r) from public.roles r            where r.deleted_at is null),    '[]'::jsonb),
        'role_permissions', coalesce((select jsonb_agg(rp) from public.role_permissions rp),                              '[]'::jsonb),
        'users',            coalesce((select jsonb_agg(u) from public.users u            where u.deleted_at is null),    '[]'::jsonb),
        'branches',         coalesce((select jsonb_agg(b) from public.branches b         where b.deleted_at is null),    '[]'::jsonb),
        'cameras',          coalesce((select jsonb_agg(c) from public.cameras c          where c.deleted_at is null),    '[]'::jsonb),
        'zones',            coalesce((select jsonb_agg(z) from public.zones z            where z.deleted_at is null),    '[]'::jsonb),
        'rules',            coalesce((select jsonb_agg(r) from public.rules r            where r.deleted_at is null),    '[]'::jsonb),
        'alert_recipients', coalesce((select jsonb_agg(ar) from public.alert_recipients ar where ar.deleted_at is null), '[]'::jsonb)
    );
    insert into public.daily_backups (snapshot, table_count) values (blob, 9);
    delete from public.daily_backups where created_at < now() - interval '30 days';
end;
$$;

-- Schedule daily backup
do $$
begin
    if not exists (select 1 from cron.job where jobname = 'smartsnap_daily_backup') then
        perform cron.schedule('smartsnap_daily_backup', '0 1 * * *', $cron$select public.snapshot_daily()$cron$);
    end if;
end $$;


-- =====================================================================
-- 13. RPCs:  PIN verify / set / random-generate
-- =====================================================================
create or replace function public.verify_pin(p_user_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
as $$
declare
    stored_hash text;
    is_valid    boolean;
    locked      timestamptz;
    attempts    int;
begin
    select pin_hash, locked_until, failed_pin_attempts
      into stored_hash, locked, attempts
      from public.users
     where id = p_user_id and deleted_at is null and active = true;

    if stored_hash is null then return false; end if;
    if locked is not null and locked > now() then return false; end if;

    is_valid := (stored_hash = crypt(p_pin, stored_hash));

    if is_valid then
        update public.users
           set failed_pin_attempts = 0,
               locked_until        = null,
               last_login_at       = now()
         where id = p_user_id;
    else
        update public.users
           set failed_pin_attempts = failed_pin_attempts + 1,
               locked_until = case
                                  when failed_pin_attempts + 1 >= 5 then now() + interval '30 minutes'
                                  when failed_pin_attempts + 1 >= 3 then now() + interval '60 seconds'
                                  else locked_until
                              end
         where id = p_user_id;
    end if;
    return is_valid;
end;
$$;

create or replace function public.set_pin(p_user_id uuid, p_new_pin text)
returns boolean
language plpgsql
security definer
as $$
begin
    update public.users
       set pin_hash            = crypt(p_new_pin, gen_salt('bf')),
           failed_pin_attempts = 0,
           locked_until        = null,
           updated_at          = now()
     where id = p_user_id and deleted_at is null;
    return found;
end;
$$;

create or replace function public.generate_random_pin()
returns text
language plpgsql
as $$
begin
    return lpad(floor(random() * 10000)::text, 4, '0');
end;
$$;


-- =====================================================================
-- 14. updated_at TRIGGERS
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

do $$
declare
    t text;
begin
    for t in select unnest(array[
        'app_settings','roles','users','branches','cameras','zones','rules','alert_recipients'
    ]) loop
        execute format('drop trigger if exists tr_%I_updated_at on public.%I', t, t);
        execute format(
            'create trigger tr_%I_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
            t, t
        );
    end loop;
end $$;


-- =====================================================================
-- 15. ROW-LEVEL SECURITY  (anon JWT → read/write under policy)
-- =====================================================================
alter table public.app_settings     enable row level security;
alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users            enable row level security;
alter table public.branches         enable row level security;
alter table public.cameras          enable row level security;
alter table public.zones            enable row level security;
alter table public.rules            enable row level security;
alter table public.alert_recipients enable row level security;
alter table public.events           enable row level security;
alter table public.audit_log        enable row level security;
alter table public.daily_backups    enable row level security;

-- Generic open read/write for authenticated (anon JWT) on all non-secret tables
do $$
declare
    t text;
begin
    for t in select unnest(array[
        'roles','role_permissions','users','branches','cameras','zones','rules','alert_recipients','events'
    ]) loop
        execute format('drop policy if exists "%I_read"  on public.%I', t, t);
        execute format('drop policy if exists "%I_write" on public.%I', t, t);
        execute format(
            'create policy "%I_read" on public.%I for select to anon, authenticated using (true)',
            t, t
        );
        execute format(
            'create policy "%I_write" on public.%I for all to anon, authenticated using (true) with check (true)',
            t, t
        );
    end loop;
end $$;

-- app_settings: non-secret rows readable by anon, secrets reachable only via service_role
drop policy if exists "app_settings_read_nonsecret" on public.app_settings;
create policy "app_settings_read_nonsecret"
    on public.app_settings for select
    to anon, authenticated
    using (is_secret = false);

drop policy if exists "app_settings_write_all" on public.app_settings;
create policy "app_settings_write_all"
    on public.app_settings for all
    to anon, authenticated
    using (true) with check (true);

-- audit_log: read-only for the app, inserts only via service_role
drop policy if exists "audit_read" on public.audit_log;
create policy "audit_read"
    on public.audit_log for select
    to anon, authenticated
    using (true);

-- daily_backups: service_role only (no public policies)


-- =====================================================================
-- 16. REALTIME PUBLICATION  (so the frontend can subscribe)
-- =====================================================================
do $$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
end $$;

do $$
declare
    t text;
begin
    for t in select unnest(array[
        'events','rules','cameras','zones','branches','alert_recipients','users','app_settings'
    ]) loop
        begin
            execute format('alter publication supabase_realtime add table public.%I', t);
        exception when duplicate_object then null;
        end;
    end loop;
end $$;


-- =====================================================================
-- 17. STORAGE BUCKETS  (create via Supabase Studio after running this)
-- =====================================================================
-- In Supabase Studio → Storage → New bucket:
--   1) Name: snapshots   Public: NO   File size limit: 5 MB
--   2) Name: clips       Public: NO   File size limit: 50 MB
--   3) Name: uploads     Public: NO   File size limit: 500 MB   (for trial video uploads)


-- =====================================================================
-- DONE — verification queries
-- =====================================================================
-- select count(*) from public.roles;            -- expect 5
-- select count(*) from public.users;            -- expect 1 (Admin / PIN 0000)
-- select count(*) from public.app_settings;     -- expect 19
-- select count(*) from public.role_permissions; -- expect ~30
-- select public.verify_pin(
--     (select id from public.users where name = 'Admin'),
--     '0000'
-- );  -- expect true
