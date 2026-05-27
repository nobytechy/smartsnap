import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Shield, Power } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { FormField, TextInput, Select, Checkbox } from '@/components/FormField';
import { cn } from '@/lib/cn';

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
// COCO classes Frigate tracks — keep in sync with frigate_config.py objects.track.
const LABELS = [
  'person', 'car', 'truck', 'motorcycle', 'bicycle', 'bus',
  'dog', 'cat',
  'backpack', 'handbag', 'suitcase',
  'bottle', 'cup', 'knife',
  'tv', 'laptop', 'cell phone', 'book',
  'chair', 'couch', 'dining table', 'potted plant',
  'oven', 'refrigerator', 'microwave',
  'sports ball', 'teddy bear',
];
const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const blank = {
  name: '',
  camera_id: '',
  zone_id: null,
  object_label: 'person',
  min_dwell_seconds: 0,
  min_confidence: 0.5,
  time_window_start: '',
  time_window_end: '',
  days_of_week: [0,1,2,3,4,5,6],
  severity: 'medium',
  alert_recipient_ids: [],
  active: true,
};

const SEV_BADGE = {
  low:      'bg-gold-100 text-gold-800',
  medium:   'bg-orange-100 text-orange-800',
  high:     'bg-burgundy-100 text-burgundy-800',
  critical: 'bg-burgundy-700 text-white',
};

export default function Rules() {
  const [rows, setRows] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [zones, setZones] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  async function load() {
    setLoading(true);
    const [rl, cm, zn, rc] = await Promise.all([
      supabase.from('rules').select('*, cameras(name), zones(name)').is('deleted_at', null).order('name'),
      supabase.from('cameras').select('id, name, branch_id').is('deleted_at', null).eq('active', true).order('name'),
      supabase.from('zones').select('id, name, camera_id').is('deleted_at', null),
      supabase.from('alert_recipients').select('id, name').is('deleted_at', null).eq('active', true).order('name'),
    ]);
    if (rl.error || cm.error || zn.error || rc.error) toast.error('Failed to load rules');
    setRows(rl.data || []);
    setCameras(cm.data || []);
    setZones(zn.data || []);
    setRecipients(rc.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...blank, camera_id: cameras[0]?.id || '' });
    setEditing('new');
  }
  function openEdit(row) {
    setForm({
      name: row.name || '',
      camera_id: row.camera_id || '',
      zone_id: row.zone_id || null,
      object_label: row.object_label || 'person',
      min_dwell_seconds: row.min_dwell_seconds || 0,
      min_confidence: row.min_confidence || 0.5,
      time_window_start: row.time_window_start || '',
      time_window_end: row.time_window_end || '',
      days_of_week: row.days_of_week || [0,1,2,3,4,5,6],
      severity: row.severity || 'medium',
      alert_recipient_ids: row.alert_recipient_ids || [],
      active: !!row.active,
    });
    setEditing(row);
  }

  function toggleDay(d) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d].sort(),
    }));
  }
  function toggleRecipient(id) {
    setForm((f) => ({
      ...f,
      alert_recipient_ids: f.alert_recipient_ids.includes(id)
        ? f.alert_recipient_ids.filter((x) => x !== id)
        : [...f.alert_recipient_ids, id],
    }));
  }

  async function save() {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.camera_id) return toast.error('Pick a camera');
    if (form.days_of_week.length === 0) return toast.error('Pick at least one day');
    setBusy(true);
    const session = getSession();
    const payload = {
      ...form,
      zone_id: form.zone_id || null,
      time_window_start: form.time_window_start || null,
      time_window_end: form.time_window_end || null,
      min_dwell_seconds: Number(form.min_dwell_seconds) || 0,
      min_confidence: Number(form.min_confidence) || 0.5,
      updated_by: session?.userId,
      updated_at: new Date().toISOString(),
    };
    const op = editing === 'new'
      ? supabase.from('rules').insert(payload).select().single()
      : supabase.from('rules').update(payload).eq('id', editing.id).select().single();
    const { error } = await op;
    if (error) { setBusy(false); return toast.error(error.message); }
    toast.success(editing === 'new' ? 'Rule added' : 'Rule updated');
    setEditing(null);
    setBusy(false);
    api.regenerateFrigate().catch(() => {});
    load();
  }

  async function toggleActive(row) {
    const { error } = await supabase.from('rules').update({ active: !row.active, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function doDelete() {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await supabase.from('rules').update({ deleted_at: new Date().toISOString() }).eq('id', toDelete.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Rule removed');
    setToDelete(null);
    load();
  }

  const camZones = zones.filter((z) => z.camera_id === form.camera_id);

  const columns = [
    { key: 'name', label: 'Rule', render: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-ink-500">
          {r.object_label} {r.min_dwell_seconds > 0 && `· dwell ${r.min_dwell_seconds}s`} {r.time_window_start && `· ${r.time_window_start.slice(0,5)}-${r.time_window_end?.slice(0,5)}`}
        </div>
      </div>
    ) },
    { key: 'camera', label: 'Camera', render: (r) => r.cameras?.name || <span className="text-ink-400">—</span> },
    { key: 'zone', label: 'Zone', render: (r) => r.zones?.name || <span className="text-ink-400">whole frame</span> },
    { key: 'severity', label: 'Severity', render: (r) => (
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold uppercase', SEV_BADGE[r.severity])}>{r.severity}</span>
    ) },
    { key: 'fire_count', label: 'Fired', align: 'right', render: (r) => r.fire_count || 0 },
    { key: 'active', label: '', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); toggleActive(r); }}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
          r.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
        )}>
        <Power size={11} /> {r.active ? 'On' : 'Off'}
      </button>
    ) },
    { key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="rounded p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"><Pencil size={16} /></button>
          <button onClick={(e) => { e.stopPropagation(); setToDelete(r); }} className="rounded p-1.5 text-ink-500 hover:bg-burgundy-50 hover:text-burgundy-700"><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rules</h1>
          <p className="mt-1 text-sm text-ink-500">What SmartSnap watches for and who it pings.</p>
        </div>
        <button onClick={openNew} className="btn-primary" disabled={cameras.length === 0}>
          <Plus size={16} /> New rule
        </button>
      </div>

      {cameras.length === 0 && !loading && (
        <div className="mt-6 rounded-lg border border-gold-300 bg-gold-50 p-4 text-sm text-gold-900">
          Add a camera first — rules attach to a specific camera.
        </div>
      )}

      <div className="mt-6">
        {rows.length === 0 && !loading && cameras.length > 0 ? (
          <EmptyState
            icon={Shield}
            title="No rules yet"
            body="A rule says: 'when X object is in Y zone for Z seconds, ping these people.'"
            action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Add rule</button>}
          />
        ) : (
          <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openEdit} />
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New rule' : `Edit — ${editing?.name || ''}`}
        size="lg"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-ghost" disabled={busy}>Cancel</button>
            <button onClick={save} className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Rule name" required hint="Plain-English: 'Late-night intrusion'">
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="After-hours person in VIP zone" />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Camera" required>
              <Select value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value, zone_id: null })}>
                <option value="">— pick camera —</option>
                {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Zone" hint="Optional — leave blank for whole frame">
              <Select value={form.zone_id || ''} onChange={(e) => setForm({ ...form, zone_id: e.target.value || null })}>
                <option value="">Whole frame</option>
                {camZones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Object to detect">
              <Select value={form.object_label} onChange={(e) => setForm({ ...form, object_label: e.target.value })}>
                {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </FormField>
            <FormField label="Min dwell" hint="Seconds before firing">
              <TextInput type="number" min={0} max={3600} value={form.min_dwell_seconds} onChange={(e) => setForm({ ...form, min_dwell_seconds: e.target.value })} />
            </FormField>
            <FormField label="Min confidence" hint="0.0 — 1.0">
              <TextInput type="number" step={0.05} min={0} max={1} value={form.min_confidence} onChange={(e) => setForm({ ...form, min_confidence: e.target.value })} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Time window start" hint="HH:MM (24h). Blank = always.">
              <TextInput type="time" value={form.time_window_start} onChange={(e) => setForm({ ...form, time_window_start: e.target.value })} />
            </FormField>
            <FormField label="Time window end" hint="HH:MM (24h)">
              <TextInput type="time" value={form.time_window_end} onChange={(e) => setForm({ ...form, time_window_end: e.target.value })} />
            </FormField>
          </div>

          <FormField label="Days of week">
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    form.days_of_week.includes(d.value)
                      ? 'border-burgundy-600 bg-burgundy-50 text-burgundy-700'
                      : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
                  )}
                >{d.label}</button>
              ))}
            </div>
          </FormField>

          <FormField label="Severity">
            <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FormField>

          <FormField label="Alert recipients" hint={`${form.alert_recipient_ids.length} selected`}>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {recipients.length === 0 && <p className="text-xs text-ink-500">No recipients defined. Add some on the Recipients page.</p>}
              {recipients.map((r) => (
                <label key={r.id} className="inline-flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-ink-50">
                  <input
                    type="checkbox"
                    checked={form.alert_recipient_ids.includes(r.id)}
                    onChange={() => toggleRecipient(r.id)}
                    className="h-4 w-4 rounded border-ink-300 text-burgundy-600 focus:ring-burgundy-500/30"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </FormField>

          <Checkbox label="Active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Remove rule?"
        body={`Soft-delete "${toDelete?.name}". It stops firing immediately.`}
        confirmLabel="Remove"
        busy={busy}
      />
    </div>
  );
}
