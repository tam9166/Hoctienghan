/* Optional Supabase REST adapter. The host application must provide
   window.KLEARN_CLOUD_CONFIG = { url, anonKey, accessToken } after Supabase Auth.
   Without it, CloudSyncService stays local-first and makes no network calls. */
(() => {
  const config = window.KLEARN_CLOUD_CONFIG || {};
  if (!config.url || !config.anonKey) return;
  let accessToken = config.accessToken || '';
  const headers = () => ({ apikey: config.anonKey, Authorization: `Bearer ${accessToken || config.anonKey}`, 'Content-Type': 'application/json' });
  window.KLEARN_CLOUD_PROVIDER = {
    setAccessToken(token) { accessToken = String(token || ''); },
    async pull(snapshot) {
      if (!accessToken) throw new Error('Supabase Auth token is required');
      const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/learning_sync?user_id=eq.${encodeURIComponent(snapshot.userId)}&select=payload`, { headers: headers() });
      if (!response.ok) throw new Error('Cloud read failed');
      const rows = await response.json();
      return rows?.[0]?.payload || null;
    },
    async push(snapshot) {
      if (!accessToken) throw new Error('Supabase Auth token is required');
      const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/learning_sync`, { method: 'POST', headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: snapshot.userId, payload: snapshot, schema_version: snapshot.schemaVersion, updated_at: snapshot.updatedAt }) });
      if (!response.ok) throw new Error('Cloud write failed');
    }
  };
})();
