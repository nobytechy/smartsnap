import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Bell, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import { Select } from '@/components/FormField';
import { cn } from '@/lib/cn';

const SEV_STYLES = {
  low:      'bg-gold-100 text-gold-800 border-gold-200',
  medium:   'bg-orange-100 text-orange-800 border-orange-200',
  high:     'bg-burgundy-100 text-burgundy-800 border-burgundy-200',
  critical: 'bg-burgundy-700 text-white border-burgundy-700',
};

function SeverityBadge({ value }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase',
      SEV_STYLES[value] || SEV_STYLES.medium
    )}>{value}</span>
  );
}

export default function Events() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  async function load() {
    setLoading(true);
    let q = supabase
      .from('events')
      .select('*, cameras(name), branches(name), rules(name)')
      .order('fired_at', { ascending: false })
      .limit(200);
    if (filter === 'unacked') q = q.is('acknowledged_at', null);
    const { data, error } = await q;
    if (error) toast.error('Failed to load events');
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    const ch = supabase
      .channel('events-feed')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ack(row) {
    const session = getSession();
    const { error } = await supabase
      .from('events')
      .update({ acknowledged_by: session?.userId, acknowledged_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success('Acknowledged');
    load();
  }

  const columns = [
    { key: 'fired_at', label: 'Time',
      render: (r) => <span className="whitespace-nowrap text-ink-600">{new Date(r.fired_at).toLocaleString()}</span> },
    { key: 'severity', label: 'Severity', render: (r) => <SeverityBadge value={r.severity} /> },
    { key: 'rule', label: 'Rule', render: (r) => r.rules?.name || <span className="text-ink-400">—</span> },
    { key: 'camera', label: 'Camera', render: (r) => r.cameras?.name || <span className="text-ink-400">—</span> },
    { key: 'branch', label: 'Branch', render: (r) => r.branches?.name || <span className="text-ink-400">—</span> },
    { key: 'object_label', label: 'Object', render: (r) => r.object_label || '—' },
    { key: 'confidence', label: 'Conf.', align: 'right',
      render: (r) => r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '—' },
    { key: 'ack', label: '', align: 'right',
      render: (r) => r.acknowledged_at
        ? <span className="text-xs text-ink-400">acked</span>
        : <button onClick={(e) => { e.stopPropagation(); ack(r); }} className="inline-flex items-center gap-1 rounded-md bg-burgundy-50 px-2 py-1 text-xs font-medium text-burgundy-700 hover:bg-burgundy-100"><Check size={12} /> Ack</button>,
    },
  ];

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-ink-500">Live feed of fired rules. Updates in realtime.</p>
        </div>
        <div className="inline-flex items-center gap-2">
          <Filter size={14} className="text-ink-500" />
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All events</option>
            <option value="unacked">Unacknowledged only</option>
          </Select>
        </div>
      </div>

      <div className="mt-6">
        {rows.length === 0 && !loading ? (
          <EmptyState icon={Bell} title="No events yet" body="Fire a rule or wait for one — events stream here in realtime." />
        ) : (
          <DataTable columns={columns} rows={rows} loading={loading} />
        )}
      </div>
    </div>
  );
}
