(() => {
  'use strict';
  const config = window.SB_CONFIG || {};
  let client;

  function getSupabaseClient() {
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      throw new Error('Supabase is not configured. Add the project URL and publishable key in supabase-config.js.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('The Supabase client could not be loaded. Check your connection and try again.');
    }
    if (!client) client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
    return client;
  }

  function mapKeys(value, convertKey) {
    if (Array.isArray(value)) return value.map(item => mapKeys(item, convertKey));
    if (!value || typeof value !== 'object' || value instanceof Date) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      convertKey(key),
      mapKeys(item, convertKey)
    ]));
  }

  const toCamel = key => key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
  const toSnake = key => key.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`);

  window.SB.supabaseClient = getSupabaseClient;
  window.SB.fromSupabase = value => mapKeys(value, toCamel);
  window.SB.toSupabase = value => mapKeys(value, toSnake);
})();
