import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Send, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { FormField, TextInput, Select, Checkbox } from '@/components/FormField';

const SCOPES = [
  { value: 'branch', label: 'Branch — applies to all rules for one branch' },
  { value: 'all',    label: 'All branches' },
  { value: 'rule',   label: 'Specific rule (advanced)' },
];

const blank = {
  branch_id: '',
  name: '',
  whatsapp_number: '',
  email: '',
  scope: 'branch',
  active: true,
};

export default function AlertRecipients() {
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [testingId, setTestingId] = useState(null);

  async function load() {
    setLoading(true);
    const [{ data: recs, error: e1 }, { data: brs, error: e2 }] = await Promise.all([
      supabase.from('alert_recipients').select('*, branches(name)').is('deleted_at', null).order('name'),
      supabase.from('branches').select('id, name').is('deleted_at', null).eq('active', true).order('name'),
    ]);
    if (e1 || e2) toast.error('Failed to load recipients');
    setRows(recs || []);
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
      whatsapp_number: row.whatsapp_number || '',
      email: row.email || '',
      scope: row.scope || 'branch',
      active: !!row.active,
    });
    setEditing(row);
  }

  async function save() {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.whatsapp_number && !form.email) return toast.error('Need WhatsApp or email');
    setBusy(true);
    const session = getSession();
    const payload = { ...form, updated_by: session?.userId, updated_at: new Date().toISOString() };
    const op = editing === 'new'
      ? supabase.from('alert_recipients').insert(payload).select().single()
      : supabase.from('alert_recipients').update(payload).eq('id', editing.id).select().single();
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing === 'new' ? 'Recipient added' : 'Recipient updated');
    setEditing(null);
    load();
  }

  async function doDelete() {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await supabase
      .from('alert_recipients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', toDelete.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Recipient removed');
    setToDelete(null);
    load();
  }

  async function sendTest(row) {
    if (!row.whatsapp_number) return toast.error('No WhatsApp number on this recipient');
    setTestingId(row.id);
    try {
      await api.testAlert({
        to: row.whatsapp_number,
        body: `🔔 SmartSnap test from your dashboard at ${new Date().toLocaleTimeString()}`,
      });
      toast.success('Test sent');
    } catch (err) {
      toast.error(err.message || 'Test failed');
    } finally {
      setTestingId(null);
    }
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'branch', label: 'Branch', render: (r) => r.branches?.name || <span className="text-ink-400">—</span> },
    { key: 'whatsapp_number', label: 'WhatsApp', render: (r) => r.whatsapp_number || <span className="text-ink-400">—</span> },
    { key: 'email', label: 'Email', render: (r) => r.email || <span className="text-ink-400">—</span> },
    { key: 'scope', label: 'Scope', render: (r) => SCOPES.find((s) => s.value === r.scope)?.label.split(' — ')[0] || r.scope },
    { key: 'active', label: 'Active', render: (r) => r.active
      ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
      : <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">Off</span> },
    { key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); sendTest(r); }} disabled={testingId === r.id}
            className="rounded p-1.5 text-ink-500 hover:bg-green-50 hover:text-green-700" title="Send test WhatsApp">
            <Send size={16} className={testingId === r.id ? 'animate-pulse' : ''} />
          </button>
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
          <h1 className="text-2xl font-bold tracking-tight">Alert recipients</h1>
          <p className="mt-1 text-sm text-ink-500">Who gets pinged when a rule fires. WhatsApp first, email fallback.</p>
        </div>
        <button onClick={openNew} className="btn-primary" disabled={branches.length === 0}>
          <Plus size={16} /> New recipient
        </button>
      </div>

      {branches.length === 0 && !loading && (
        <div className="mt-6 rounded-lg border border-gold-300 bg-gold-50 p-4 text-sm text-gold-900">
          Add a branch first.
        </div>
      )}

      <div className="mt-6">
        {rows.length === 0 && !loading && branches.length > 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No recipients yet"
            body="Add someone to receive alerts. Test the WhatsApp number before going live."
            action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Add recipient</button>}
          />
        ) : (
          <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openEdit} />
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New recipient' : `Edit — ${editing?.name || ''}`}
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-ghost" disabled={busy}>Cancel</button>
            <button onClick={save} className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Biggie (Owner)" />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="WhatsApp number" hint="Format: +263...">
              <TextInput value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+263 77 123 4567" />
            </FormField>
            <FormField label="Email" hint="Fallback if WhatsApp fails">
              <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@example.com" />
            </FormField>
          </div>
          <FormField label="Scope">
            <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </FormField>
          {form.scope !== 'all' && (
            <FormField label="Branch">
              <Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">— pick branch —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FormField>
          )}
          <Checkbox label="Active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Remove recipient?"
        body={`Soft-delete "${toDelete?.name}". They'll stop receiving alerts immediately.`}
        confirmLabel="Remove"
        busy={busy}
      />
    </div>
  );
}
