'use strict';
const { clean, authenticate, begin } = require('./_shared');

module.exports = async function handler(req, res) {
  if (begin(req, res, ['PATCH']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const courseId = clean(req.body?.courseId, 80); const accessLevel = clean(req.body?.accessLevel, 20);
  const price = Number(req.body?.price || 0); const revenueShare = Number(req.body?.revenueShare ?? 70);
  const currency = clean(req.body?.currency || 'VND', 3).toUpperCase(); const landingSlug = clean(req.body?.landingSlug, 120) || null;
  const previewLessonId = clean(req.body?.previewLessonId, 80) || null;
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || !['free','premium'].includes(accessLevel) || !Number.isFinite(price) || price < 0 || price > 100000000 || (accessLevel === 'free' && price !== 0) || !Number.isFinite(revenueShare) || revenueShare < 0 || revenueShare > 100 || !/^[A-Z]{3}$/.test(currency) || (landingSlug && !/^[a-z0-9-]{3,120}$/.test(landingSlug)) || (previewLessonId && !/^[0-9a-f-]{36}$/i.test(previewLessonId))) return res.status(400).json({ error: 'Invalid course commerce settings' });
  const payload = { access_level: accessLevel, price, currency, revenue_share: revenueShare, subscription_eligible: Boolean(req.body?.subscriptionEligible), landing_slug: landingSlug, preview_lesson_id: previewLessonId, updated_at: new Date().toISOString() };
  const response = await fetch(`${auth.config.url}/rest/v1/education_creator_courses?id=eq.${encodeURIComponent(courseId)}&owner_id=eq.${encodeURIComponent(auth.user.id)}&status=in.(draft,rejected)`, { method: 'PATCH', headers: { apikey: auth.config.anonKey, authorization: `Bearer ${auth.token}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: JSON.stringify(payload) });
  const rows = await response.json().catch(() => ([]));
  if (!response.ok) return res.status(response.status).json({ error: clean(rows?.message || 'Course update failed', 160) });
  if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'Owned draft course not found' });
  return res.status(200).json({ course: rows[0], paymentEnabled: accessLevel === 'premium', source: 'server' });
};
