-- =====================================================================
-- SmartSnap — patch: open RLS to anon (frontend) role
-- =====================================================================
-- The frontend uses the Supabase anon key — its JWT role is `anon`, not
-- `authenticated`. The first install.sql created policies for `authenticated`
-- only, which blocks every read/write from the browser. This patch widens
-- each policy to `anon, authenticated` while keeping the existing predicate.
--
-- Safe to re-run. Run AFTER install.sql.
-- =====================================================================

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

drop policy if exists "audit_read" on public.audit_log;
create policy "audit_read"
    on public.audit_log for select
    to anon, authenticated
    using (true);

-- Verify:
-- select tablename, policyname, roles from pg_policies where schemaname = 'public' order by tablename, policyname;
