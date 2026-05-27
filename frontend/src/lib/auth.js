import { supabase } from './supabase';

const SESSION_KEY = 'smartsnap.session.v1';

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function listLoginUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role_id, locked_until, roles(name)')
    .eq('active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((u) => ({
    id: u.id,
    name: u.name,
    roleId: u.role_id,
    roleName: u.roles?.name || '',
    lockedUntil: u.locked_until,
  }));
}

export async function loginWithPin(userId, pin) {
  const { data: ok, error } = await supabase.rpc('verify_pin', {
    p_user_id: userId,
    p_pin: pin,
  });
  if (error) throw error;
  if (!ok) {
    const e = new Error('invalid_pin');
    e.code = 'invalid_pin';
    throw e;
  }

  const { data: user, error: uerr } = await supabase
    .from('users')
    .select('id, name, role_id, branch_id, roles(name)')
    .eq('id', userId)
    .single();
  if (uerr) throw uerr;

  const { data: perms, error: perr } = await supabase
    .from('role_permissions')
    .select('screen_key, can_view, can_edit')
    .eq('role_id', user.role_id);
  if (perr) throw perr;

  const permMap = {};
  for (const p of perms || []) {
    permMap[p.screen_key] = { view: !!p.can_view, edit: !!p.can_edit };
  }

  const session = {
    userId: user.id,
    name: user.name,
    branchId: user.branch_id,
    roleId: user.role_id,
    roleName: user.roles?.name || '',
    permissions: permMap,
    loggedInAt: new Date().toISOString(),
  };
  setSession(session);
  return session;
}

export function logout() {
  clearSession();
}

export function canView(screenKey) {
  const s = getSession();
  if (!s) return false;
  if (s.roleName === 'Admin') return true;
  return !!s.permissions?.[screenKey]?.view;
}

export function canEdit(screenKey) {
  const s = getSession();
  if (!s) return false;
  if (s.roleName === 'Admin') return true;
  return !!s.permissions?.[screenKey]?.edit;
}
