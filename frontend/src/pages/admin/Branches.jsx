import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { FormField, TextInput, Checkbox } from '@/components/FormField';

const blank = {
  name: '',
  location: '',
  contact_whatsapp: '',
  timezone: 'Africa/Harare',
  active: true,
};

export default function Branches() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .is('deleted_at', null)
      .order('name');
    if (error) toast.error('Failed to load branches');
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm(blank);
    setEditing('new');
  }
  function openEdit(row) {
    setForm({
      name: row.name || '',
      location: row.location || '',
      contact_whatsapp: row.contact_whatsapp || '',
      timezone: row.timezone || 'Africa/Harare',
      active: !!row.active,
    });
    setEditing(row);
  }

  async function save() {
    if (!form.name.trim()) return toast.error('Name is required');
    setBusy(true);
    const session = getSession();
    const payload = { ...form, updated_by: session?.userId, updated_at: new Date().toISOString() };
    const op = editing === 'new'
      ? supabase.from('branches').insert(payload).select().single()
      : supabase.from('branches').update(payload).eq('id', editing.id).select().single();
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing === 'new' ? 'Branch added' : 'Branch updated');
    setEditing(null);
    load();
  }

  async function doDelete() {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await supabase
      .from('branches')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', toDelete.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Branch removed');
    setToDelete(null);
    load();
  }

  const columns = [
    { key: 'name',     label: 'Name',     render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'location', label: 'Location', render: (r) => r.location || <span className="text-ink-400">—</span> },
    { key: 'contact_whatsapp', label: 'WhatsApp', render: (r) => r.contact_whatsapp || <span className="text-ink-400">—</span> },
    { key: 'timezone', label: 'Timezone' },
    { key: 'active',   label: 'Active',   render: (r) => r.active
      ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
      : <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">Disabled</span> },
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
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="mt-1 text-sm text-ink-500">Sites where SmartSnap watches cameras.</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> New branch</button>
      </div>

      <div className="mt-6">
        {rows.length === 0 && !loading ? (
          <EmptyState
            icon={MapPin}
            title="No branches yet"
            body="Add your first site to get cameras assigned."
            action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Add branch</button>}
          />
        ) : (
          <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openEdit} />
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New branch' : `Edit branch — ${editing?.name || ''}`}
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-ghost" disabled={busy}>Cancel</button>
            <button onClick={save} className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hollies Harare" />
          </FormField>
          <FormField label="Location">
            <TextInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="123 Main Street" />
          </FormField>
          <FormField label="Contact WhatsApp" hint="Default recipient for branch-scoped alerts">
            <TextInput value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} placeholder="+263..." />
          </FormField>
          <FormField label="Timezone">
            <TextInput value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </FormField>
          <Checkbox label="Active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Remove branch?"
        body={`Soft-delete "${toDelete?.name}". All its cameras and rules will stop watching. You can restore from the database.`}
        confirmLabel="Remove"
        busy={busy}
      />
    </div>
  );
}
