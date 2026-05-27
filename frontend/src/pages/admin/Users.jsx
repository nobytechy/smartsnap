import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, KeyRound, Users as UsersIcon, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { FormField, TextInput, Select, Checkbox } from '@/components/FormField';

const blank = {
  name: '',
  email: '',
  role_id: '',
  branch_id: null,
  active: true,
};

export default function Users() {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [showPin, setShowPin] = useState(null); // { name, pin } after create/reroll

  async function load() {
    setLoading(true);
    const [u, r, b] = await Promise.all([
      supabase.from('users').select('*, roles(name), branches(name)').is('deleted_at', null).order('name'),
      supabase.from('roles').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('branches').select('id, name').is('deleted_at', null).eq('active', true).order('name'),
    ]);
    if (u.error || r.error || b.error) toast.error('Failed to load users');
    setRows(u.data || []);
    setRoles(r.data || []);
    setBranches(b.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ ...blank, role_id: roles[0]?.id || '' });
    setEditing('new');
  }
  function openEdit(row) {
    setForm({
      name: row.name || '',
      email: row.email || '',
      role_id: row.role_id || '',
      branch_id: row.branch_id || null,
      active: !!row.active,
    });
    setEditing(row);
  }

  async function save() {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.role_id) return toast.error('Pick a role');
    setBusy(true);
    const session = getSession();

    if (editing === 'new') {
      const { data: pinData, error: pe } = await supabase.rpc('generate_random_pin');
      if (pe) { setBusy(false); return toast.error('PIN generation failed'); }
      const pin = String(pinData);

      const { data: inserted, error } = await supabase
        .from('users')
        .insert({
          name: form.name,
          email: form.email || null,
          role_id: form.role_id,
          branch_id: form.branch_id || null,
          active: form.active,
          pin_hash: '$2a$06$placeholder',
          updated_by: session?.userId,
        })
        .select()
        .single();
      if (error) { setBusy(false); return toast.error(error.message); }

      const { error: setErr } = await supabase.rpc('set_pin', { p_user_id: inserted.id, p_new_pin: pin });
      if (setErr) { setBusy(false); return toast.error('PIN set failed: ' + setErr.message); }

      setBusy(false);
      setEditing(null);
      setShowPin({ name: inserted.name, pin });
      load();
    } else {
      const { error } = await supabase
        .from('users')
        .update({
          name: form.name,
          email: form.email || null,
          role_id: form.role_id,
          branch_id: form.branch_id || null,
          active: form.active,
          updated_by: session?.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success('User updated');
      setEditing(null);
      load();
    }
  }

  async function rerollPin(user) {
    setBusy(true);
    const { data: pinData, error: pe } = await supabase.rpc('generate_random_pin');
    if (pe) { setBusy(false); return toast.error('PIN gen failed'); }
    const pin = String(pinData);
    const { error } = await supabase.rpc('set_pin', { p_user_id: user.id, p_new_pin: pin });
    setBusy(false);
    if (error) return toast.error('PIN reroll failed');
    setShowPin({ name: user.name, pin });
  }

  async function doDelete() {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq('id', toDelete.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('User removed');
    setToDelete(null);
    load();
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'role', label: 'Role', render: (r) => r.roles?.name || <span className="text-ink-400">—</span> },
    { key: 'branch', label: 'Branch', render: (r) => r.branches?.name || <span className="text-ink-400">all</span> },
    { key: 'email', label: 'Email', render: (r) => r.email || <span className="text-ink-400">—</span> },
    { key: 'last_login_at', label: 'Last login',
      render: (r) => r.last_login_at ? new Date(r.last_login_at).toLocaleString() : <span className="text-ink-400">never</span> },
    { key: 'active', label: 'Active',
      render: (r) => r.active
        ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
        : <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">Off</span> },
    { key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); rerollPin(r); }} className="rounded p-1.5 text-ink-500 hover:bg-gold-50 hover:text-gold-700" title="Reroll PIN"><KeyRound size={16} /></button>
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
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-ink-500">Operators who can log in with a 4-digit PIN.</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> New user</button>
      </div>

      <div className="mt-6">
        {rows.length === 0 && !loading ? (
          <EmptyState icon={UsersIcon} title="No users yet" body="Default admin can sign in with PIN 0000 until you add more." />
        ) : (
          <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openEdit} />
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New user' : `Edit — ${editing?.name || ''}`}
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn-ghost" disabled={busy}>Cancel</button>
            <button onClick={save} className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tariro" />
          </FormField>
          <FormField label="Email">
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Role" required>
              <Select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                <option value="">— pick role —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Branch" hint="Leave blank for all branches">
              <Select value={form.branch_id || ''} onChange={(e) => setForm({ ...form, branch_id: e.target.value || null })}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </FormField>
          </div>
          <Checkbox label="Active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          {editing === 'new' && (
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">A random 4-digit PIN will be generated and shown once. Save it and pass it on.</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        title="Remove user?"
        body={`Soft-delete "${toDelete?.name}". They lose login access immediately.`}
        confirmLabel="Remove"
        busy={busy}
      />

      <Modal
        open={!!showPin}
        onClose={() => setShowPin(null)}
        title={`PIN for ${showPin?.name}`}
        footer={<button onClick={() => setShowPin(null)} className="btn-primary">Done</button>}
        size="sm"
      >
        <div className="text-center">
          <p className="text-sm text-ink-600">This is the only time the PIN will be shown.</p>
          <div className="my-6 flex items-center justify-center gap-3">
            <code className="rounded-lg bg-ink-900 px-6 py-4 text-4xl font-mono font-bold tracking-widest text-gold-400">
              {showPin?.pin}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(showPin?.pin || ''); toast.success('Copied'); }}
              className="rounded-lg p-3 text-ink-500 hover:bg-ink-100"
              title="Copy"
            ><Copy size={20} /></button>
          </div>
          <p className="text-xs text-ink-500">If lost, reroll the PIN from the user list.</p>
        </div>
      </Modal>
    </div>
  );
}
