import { supabase } from './supabase';

let cache = null;

export async function loadSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value, is_secret');

  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    map[row.key] = row.value;
  }
  cache = map;
  return map;
}

export function getSetting(key, fallback = null) {
  if (!cache) return fallback;
  return cache[key] ?? fallback;
}

export function getApiBaseUrl() {
  return getSetting('api_base_url', '');
}

export function getBranding() {
  return {
    name: getSetting('brand_name', 'SmartSnap'),
    tagline: getSetting(
      'brand_tagline',
      'Turn your existing CCTV into a smart alerting platform.'
    ),
  };
}

export function getBusinessHours() {
  return {
    open: getSetting('business_hours_open', '09:00'),
    close: getSetting('business_hours_close', '02:00'),
  };
}

export function snapshotSettings() {
  return cache ? { ...cache } : null;
}
