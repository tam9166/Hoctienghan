module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabasePublishableKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  let publicKey = supabasePublishableKey.startsWith('sb_publishable_');
  if (!publicKey && supabasePublishableKey.startsWith('eyJ')) {
    try { const payload = JSON.parse(Buffer.from(supabasePublishableKey.split('.')[1], 'base64url').toString('utf8')); publicKey = payload.role === 'anon'; } catch (_) { publicKey = false; }
  }
  let validUrl = false;
  try { const parsed = new URL(supabaseUrl); validUrl = parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co'); } catch (_) { validUrl = false; }
  if (!validUrl || !publicKey) return res.status(200).json({ configured: false });
  return res.status(200).json({ configured: true, supabaseUrl, supabasePublishableKey });
};
