import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Camera, Bell, ShieldCheck, ArrowRight, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

function Kpi({ icon: Icon, label, value, to, accent = 'burgundy' }) {
  const body = (
    <div className="card flex items-center gap-4 p-5 transition hover:border-burgundy-300 hover:shadow-[var(--shadow-card-hover)]">
      <div className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-xl',
        accent === 'burgundy' ? 'bg-burgundy-50 text-burgundy-600' : 'bg-gold-50 text-gold-600'
      )}>
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
        <div className="mt-0.5 text-2xl font-bold text-ink-900">{value}</div>
      </div>
      {to && <ArrowRight size={16} className="text-ink-300" />}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const session = getSession();
  const [counts, setCounts] = useState({ branches: 0, cameras: 0, rules: 0, events_today: 0, events_unacked: 0 });
  const [recent, setRecent] = useState([]);
  const [backend, setBackend] = useState(null);

  async function load() {
    const today = new Date(); today.setHours(0,0,0,0);
    const [b, c, r, et, eu, recentEv] = await Promise.all([
      supabase.from('branches').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('cameras').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('active', true),
      supabase.from('rules').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('active', true),
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('fired_at', today.toISOString()),
      supabase.from('events').select('id', { count: 'exact', head: true }).is('acknowledged_at', null),
      supabase.from('events').select('id, fired_at, severity, object_label, cameras(name), rules(name)').order('fired_at', { ascending: false }).limit(6),
    ]);
    setCounts({
      branches: b.count || 0,
      cameras: c.count || 0,
      rules: r.count || 0,
      events_today: et.count || 0,
      events_unacked: eu.count || 0,
    });
    setRecent(recentEv.data || []);
  }

  async function checkBackend() {
    try {
      const h = await api.health();
      setBackend(h);
    } catch {
      setBackend({ ok: false });
    }
  }

  useEffect(() => {
    load();
    checkBackend();
    const ch = supabase
      .channel('dashboard-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => load())
      .subscribe();
    const t = setInterval(checkBackend, 30_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  return (
    <div className="container-page py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, {session?.name}</h1>
        <p className="mt-1 text-sm text-ink-500">{session?.roleName} · Snapshot of today's activity.</p>
      </header>

      <div className="mt-2 inline-flex items-center gap-2 text-xs">
        <span className={cn(
          'inline-flex h-2 w-2 rounded-full',
          backend?.ok ? 'bg-green-500' : 'bg-burgundy-500'
        )} />
        <span className="text-ink-500">
          Backend {backend?.ok ? 'online' : 'offline'}
          {backend?.frigate ? ' · Frigate connected' : backend?.ok ? ' · Frigate offline' : ''}
        </span>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi icon={MapPin}      label="Branches"      value={counts.branches} to="/app/branches" />
        <Kpi icon={Camera}      label="Cameras live"  value={counts.cameras}  to="/app/cameras" />
        <Kpi icon={ShieldCheck} label="Rules active"  value={counts.rules}    to="/app/rules" />
        <Kpi icon={Bell}        label="Events today"  value={counts.events_today} to="/app/events" accent="gold" />
        <Kpi icon={Activity}    label="Unacked"       value={counts.events_unacked} to="/app/events" accent="gold" />
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent events</h2>
          <Link to="/app/events" className="text-sm text-burgundy-600 hover:text-burgundy-700">View all →</Link>
        </div>
        <div className="mt-3 card divide-y divide-ink-100">
          {recent.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-ink-500">No events yet.</div>
          )}
          {recent.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <div className="font-medium text-ink-900">{e.rules?.name || e.object_label || 'event'}</div>
                <div className="text-xs text-ink-500">{e.cameras?.name || '—'} · {new Date(e.fired_at).toLocaleString()}</div>
              </div>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                e.severity === 'critical' ? 'bg-burgundy-700 text-white'
                : e.severity === 'high' ? 'bg-burgundy-100 text-burgundy-800'
                : e.severity === 'low' ? 'bg-gold-100 text-gold-800'
                : 'bg-orange-100 text-orange-800'
              )}>{e.severity}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
