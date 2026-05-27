import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadSettings } from '@/lib/settings';
import { getSession } from '@/lib/auth';
import { FormField, TextInput } from '@/components/FormField';
import EmptyState from '@/components/EmptyState';

const GROUPS = [
  { title: 'API & Branding',     keys: ['api_base_url', 'brand_name', 'brand_tagline'] },
  { title: 'Business hours',     keys: ['business_hours_open', 'business_hours_close', 'timezone'] },
  { title: 'Camera defaults',    keys: ['camera_default_fps', 'camera_default_resolution'] },
  { title: 'Retention',          keys: ['retention_events_days', 'retention_snapshots_days', 'retention_clips_days'] },
  { title: 'Alerts',             keys: ['alert_rate_limit_per_minute', 'weekly_summary_day', 'weekly_summary_time'] },
  { title: 'Integrations',       keys: ['ultramsg_instance_id', 'ultramsg_token', 'anthropic_api_key', 'resend_api_key'] },
];

function jsonToDisplay(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}
function displayToJson(s) {
  const t = s.trim();
  if (t === '') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try { return JSON.parse(t); } catch { /* fall through to string */ }
  }
  return t;
}

export default function Settings() {
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value, description, is_secret, updated_at')
      .order('key');
    if (error) toast.error('Failed to load settings');
    setRows(data || []);
    setDirty({});
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function onChange(key, raw) {
    setDirty((d) => ({ ...d, [key]: raw }));
  }

  async function saveAll() {
    const session = getSession();
    const entries = Object.entries(dirty);
    if (entries.length === 0) return toast('Nothing changed');
    setBusy(true);
    let okCount = 0;
    for (const [key, raw] of entries) {
      const value = displayToJson(raw);
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString(), updated_by: session?.userId })
        .eq('key', key);
      if (!error) okCount += 1;
      else toast.error(`${key}: ${error.message}`);
    }
    setBusy(false);
    if (okCount > 0) {
      toast.success(`Saved ${okCount} setting${okCount > 1 ? 's' : ''}`);
      await loadSettings();
      load();
    }
  }

  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: g.keys.filter((k) => byKey[k]).map((k) => byKey[k]),
  }));
  const knownKeys = new Set(GROUPS.flatMap((g) => g.keys));
  const others = rows.filter((r) => !knownKeys.has(r.key));

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-ink-500">Stored in <code>app_settings</code>. Frontend re-reads on next page load.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost" disabled={busy}><RefreshCw size={16} /> Reload</button>
          <button onClick={saveAll} className="btn-primary" disabled={busy || Object.keys(dirty).length === 0}>
            <Save size={16} /> {busy ? 'Saving…' : `Save${Object.keys(dirty).length ? ` (${Object.keys(dirty).length})` : ''}`}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {loading && <EmptyState icon={SettingsIcon} title="Loading…" />}
        {!loading && rows.length === 0 && (
          <EmptyState icon={SettingsIcon} title="No settings rows" body="install.sql may not have run." />
        )}
        {grouped.filter((g) => g.items.length > 0).map((g) => (
          <section key={g.title} className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">{g.title}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {g.items.map((row) => (
                <FormField
                  key={row.key}
                  label={row.key}
                  hint={row.is_secret ? 'secret' : null}
                  error={null}
                >
                  <TextInput
                    type={row.is_secret ? 'password' : 'text'}
                    value={dirty[row.key] !== undefined ? dirty[row.key] : jsonToDisplay(row.value)}
                    onChange={(e) => onChange(row.key, e.target.value)}
                  />
                  {row.description && <p className="mt-1 text-xs text-ink-500">{row.description}</p>}
                </FormField>
              ))}
            </div>
          </section>
        ))}
        {others.length > 0 && (
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">Other</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {others.map((row) => (
                <FormField key={row.key} label={row.key}>
                  <TextInput
                    value={dirty[row.key] !== undefined ? dirty[row.key] : jsonToDisplay(row.value)}
                    onChange={(e) => onChange(row.key, e.target.value)}
                  />
                </FormField>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
