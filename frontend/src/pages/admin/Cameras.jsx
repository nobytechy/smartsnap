import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { FormField, TextInput, Select, Checkbox } from '@/components/FormField';

const SOURCES = [
  { value: 'rtsp',       label: 'RTSP stream',     hint: 'rtsp://user:pass@host:554/stream' },
  { value: 'http_mjpeg', label: 'HTTP MJPEG',      hint: 'http://host/video.mjpeg' },
  { value: 'phone',      label: 'Phone (IP Webcam)', hint: 'http://phone-ip:8080/video' },
  { value: 'file',       label: 'Uploaded file',   hint: '/media/frigate/uploads/file.mp4' },
  { value: 'youtube',    label: 'YouTube URL',     hint: 'https://youtu.be/...' },
];

const RESOLUTIONS = ['480p', '720p', '1080p'];

const blank = {
  branch_id: '',
  name: '',
  source_kind: 'rtsp',
  source_url: '',
  position_description: '',
  fps: 4,
  resolution: '720p',
  active: true,
};

export default function Cameras() {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  async function load() {
    setLoading(true);
    const [{ data: cams, error: e1 }, { data: brs, error: e2 }] = await Promise.all([
      supabase.from('cameras')
        .select('*, branches(name)')
        .is('deleted_at', null)
        .order('name'),
      supabase.from('branches')
        .select('id, name')
        .is('deleted_at', null)
        .eq('active', true)
        .order('name'),
    ]);
    if (e1 || e2) toast.error('Failed to load cameras');
    setRows(cams || []);
    setBranches(brs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...blank, branch_id: branches[0]?.id || '' });
    setEditing('new');
  }
  function openEdit(row) {
    setForm({
      branch_id: row.branch_id || '',
      name: row.name || '',
      source_kind: row.source_kind || 'rtsp',
      source_url: row.source_url || '',
      position_description: row.position_description || '',
      fps: row.fps || 4,
      resolution: row.resolution || '720p',
      active: !!row.active,
    });
    setEditing(row);
  }

  async function save() {
    if (!form.branch_id) return toast.error('Pick a branch');
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.source_url.trim()) return toast.error('Source URL is required');
    setBusy(true);
    const session = getSession();
    const payload = {
      ...form,
      fps: Number(form.fps) || 4,
      updated_by: session?.userId,
      updated_at: new Date().toISOString(),
    };
    const op = editing === 'new'
      ? supabase.from('cameras').insert(payload).select().single()
      : supabase.from('cameras').update(payload).eq('id', editing.id).select().single();
    const { error } = await op;
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    toast.success(editing === 'new' ? 'Camera added' : 'Camera updated');
    setEditing(null);
    setBusy(false);
    regenerateFrigate();
    load();
  }

  async function doDelete() {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await supabase
      .from('cameras')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', toDelete.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Camera removed');
    setToDelete(null);
    regenerateFrigate();
    load();
  }

  async function regenerateFrigate() {
    try {
      await api.regenerateFrigate();
      toast.success('Frigate config refreshed');
    } catch (err) {
      console.warn('Frigate regen failed (backend may be offline):', err);
    }
  }

  const sourceMeta = (k) => SOURCES.find((s) => s.value === k) || SOURCES[0];

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'branch', label: 'Branch', render: (r) => r.branches?.name || <span className="text-ink-400">—</span> },
    { key: 'source_kind', label: 'Source', render: (r) => sourceMeta(r.source_kind).label },
    { key: 'fps', label: 'fps', align: 'right', render: (r) => `${r.fps} fps` },
    { key: 'resolution', label: 'Res' },
    { key: 'last_seen_at', label: 'Last seen', render: (r) => r.last_seen_at
      ? new Date(r.last_seen_at).toLocaleString()
      : <span className="text-ink-400">never</span> },
    { key: 'active', label: 'Active', render: (r) => r.active
      ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">On</span>
      : <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">Off</span> },
    {
      key: 'actions', label: '', align: 'right',
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
          <h1 className="text-2xl font-bold tracking-tight">Cameras</h1>
          <p className="mt-1 text-sm text-ink-500">Feeds SmartSnap is watching. Saving a change re-pushes Frigate config.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={regenerateFrigate} className="btn-ghost" title="Re-push Frigate config">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={openNew} className="btn-primary" disabled={branches.length === 0}>
            <Plus size={16} /> New camera
          </button>
        </div>
      </div>

      {branches.length === 0 && !loading && (
        <div className="mt-6 rounded-lg border border-gold-300 bg-gold-50 p-4 text-sm text-gold-900">
          Add a <strong>branch</strong> first — cameras need somewhere to live.
        </div>
      )}

      <div className="mt-6">
        {rows.length === 0 && !loading && branches.length > 0 ? (
          <EmptyState
            icon={CameraIcon}
            title="No cameras yet"
            body="Plug in your first RTSP stream, IP-webcam phone, or even a YouTube test feed."
            action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Add camera</button>}
          />
        ) : (
          <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openEdit} />
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New camera' : `Edit camera — ${editing?.name || ''}`}
        size="lg"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-ghost" disabled={busy}>Cancel</button>
            <button onClick={save} className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Branch" required>
              <Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">— pick branch —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Name" required>
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Front entrance" />
            </FormField>
          </div>

          <FormField label="Source type">
            <Select value={form.source_kind} onChange={(e) => setForm({ ...form, source_kind: e.target.value, source_url: '' })}>
              {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </FormField>

          <FormField label="Source URL" required hint={sourceMeta(form.source_kind).hint}>
            <TextInput value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder={sourceMeta(form.source_kind).hint} />
          </FormField>

          <FormField label="Position description" hint="Where in the venue this camera points">
            <TextInput value={form.position_description} onChange={(e) => setForm({ ...form, position_description: e.target.value })} placeholder="Above main door, facing west" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Frames per second" hint="Lower = lighter on CPU">
              <Select value={form.fps} onChange={(e) => setForm({ ...form, fps: Number(e.target.value) })}>
                {[2,3,4,5,6,8,10].map((n) => <option key={n} value={n}>{n} fps</option>)}
              </Select>
            </FormField>
            <FormField label="Detect resolution">
              <Select value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })}>
                {RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </FormField>
          </div>

          <Checkbox label="Active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Remove camera?"
        body={`Soft-delete "${toDelete?.name}". Frigate will stop watching this feed.`}
        confirmLabel="Remove"
        busy={busy}
      />
    </div>
  );
}
