import { getApiBaseUrl } from './settings';

async function call(path, options = {}) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('api_base_url not configured');
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export const api = {
  health: () => call('/healthz'),
  regenerateFrigate: () => call('/frigate/regenerate', { method: 'POST' }),
  testAlert: (payload) => call('/alerts/test', { method: 'POST', body: JSON.stringify(payload) }),
};
