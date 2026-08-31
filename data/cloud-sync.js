/* Supabase Auth + sync provider. Public config comes from /api/config.
   The official client owns access/refresh tokens; they are never exposed to app data. */
(() => {
  const state = { client: null, session: null, configStatus: 'loading', error: '', initPromise: null };
  const emit = (event, detail) => window.dispatchEvent(new CustomEvent(event, { detail }));
  const timeout = (milliseconds) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), milliseconds));
  const validConfig = (value) => {
    try { const url = new URL(value?.supabaseUrl); const key = String(value?.supabasePublishableKey || ''); return url.protocol === 'https:' && (key.startsWith('sb_publishable_') || key.startsWith('eyJ')); } catch (_) { return false; }
  };
  const loadOfficialClient = () => new Promise((resolve, reject) => {
    if (window.supabase?.createClient) return resolve();
    const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'; script.async = true;
    script.onload = () => window.supabase?.createClient ? resolve() : reject(new Error('Supabase client unavailable'));
    script.onerror = () => reject(new Error('Supabase client load failed')); document.head.appendChild(script);
  });
  const friendlyError = (error) => {
    const message = String(error?.message || '');
    if (/invalid login credentials/i.test(message)) return 'Email hoặc mật khẩu cloud không đúng.';
    if (/email not confirmed/i.test(message)) return 'Hãy xác nhận email trước khi đăng nhập.';
    if (/user already registered/i.test(message)) return 'Email này đã có tài khoản cloud.';
    if (/invalid.*email|email.*invalid/i.test(message)) return 'Email cloud chưa hợp lệ.';
    if (/rate limit|too many requests/i.test(message)) return 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.';
    if (/signup.*disabled/i.test(message)) return 'Đăng ký cloud đang bị tắt trong cấu hình Supabase.';
    if (/password/i.test(message) && /short|least/i.test(message)) return 'Mật khẩu cloud cần ít nhất 6 ký tự.';
    if (/timeout|fetch|network/i.test(message)) return 'Không thể kết nối Supabase. Bạn vẫn có thể học bằng dữ liệu trên thiết bị.';
    return message || 'Cloud hiện chưa sẵn sàng. Vui lòng thử lại.';
  };
  const SupabaseService = {
    get client() { return state.client; }, get session() { return state.session; }, get status() { return state.configStatus; }, get error() { return state.error; },
    init() {
      if (state.initPromise) return state.initPromise;
      state.initPromise = (async () => {
        try {
          const response = await Promise.race([fetch('/api/config', { cache: 'no-store', headers: { Accept: 'application/json' } }), timeout(6000)]);
          if (!response.ok) throw new Error('config request failed'); const config = await response.json();
          if (!config.configured || !validConfig(config)) { state.configStatus = 'unconfigured'; emit('klearn-cloud-ready', { configured: false }); return null; }
          await Promise.race([loadOfficialClient(), timeout(8000)]);
          state.client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'klearn_supabase_auth' } });
          state.client.auth.onAuthStateChange((event, session) => { state.session = session || null; emit('klearn-cloud-auth', { event, user: session?.user || null }); });
          const { data, error } = await state.client.auth.getSession(); if (error) throw error; state.session = data.session || null; state.configStatus = 'ready';
          window.KLEARN_CLOUD_PROVIDER = this.createProvider(); emit('klearn-cloud-ready', { configured: true, user: state.session?.user || null });
          if (state.session?.user) emit('klearn-cloud-auth', { event: 'INITIAL_SESSION', user: state.session.user });
          return state.client;
        } catch (error) { state.configStatus = navigator.onLine === false ? 'offline' : 'error'; state.error = friendlyError(error); emit('klearn-cloud-ready', { configured: false, error: state.error }); return null; }
      })();
      return state.initPromise;
    },
    createProvider() {
      return {
        getUserId: () => state.session?.user?.id || null,
        async pull() { const userId = state.session?.user?.id; if (!userId) throw new Error('Cloud authentication required'); const { data, error } = await state.client.from('learning_sync').select('payload,schema_version,updated_at').eq('user_id', userId).maybeSingle(); if (error) throw error; return data?.payload || null; },
        async push(snapshot) { const userId = state.session?.user?.id; if (!userId) throw new Error('Cloud authentication required'); const { error } = await state.client.from('learning_sync').upsert({ user_id: userId, payload: snapshot, schema_version: snapshot.schemaVersion || 1, updated_at: snapshot.updatedAt }, { onConflict: 'user_id' }); if (error) throw error; }
      };
    }
  };
  const AuthService = {
    async signUp(email, password) { await SupabaseService.init(); if (!state.client) throw new Error(state.error || 'Cloud chưa được cấu hình.'); const { data, error } = await state.client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}${location.pathname}` } }); if (error) throw new Error(friendlyError(error)); return { user: data.user, session: data.session, confirmationRequired: Boolean(data.user && !data.session) }; },
    async signIn(email, password) { await SupabaseService.init(); if (!state.client) throw new Error(state.error || 'Cloud chưa được cấu hình.'); const { data, error } = await state.client.auth.signInWithPassword({ email, password }); if (error) throw new Error(friendlyError(error)); state.session = data.session; return data; },
    async getSession() { await SupabaseService.init(); return state.client ? (await state.client.auth.getSession()).data.session : null; },
    async getUser() { await SupabaseService.init(); return state.client ? (await state.client.auth.getUser()).data.user : null; },
    async signOut() { if (!state.client) return; const { error } = await state.client.auth.signOut(); if (error) throw new Error(friendlyError(error)); state.session = null; }
  };
  window.SupabaseService = SupabaseService; window.AuthService = AuthService; SupabaseService.init();
})();
