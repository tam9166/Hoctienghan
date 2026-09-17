'use strict';
const { authenticate, select, begin } = require('./_shared');

module.exports = async function handler(req, res) {
  if (begin(req, res, ['GET']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const fields = 'id,owner_id,title,description,level,goal,thumbnail_url,category,access_level,price,currency,revenue_share,subscription_eligible,landing_slug,preview_lesson_id,sales_count,status';
  const result = await select(auth, `education_creator_courses?status=eq.published&select=${fields}&order=sales_count.desc`);
  if (!result.ok) return res.status(result.status || 503).json({ error: result.error });
  return res.status(200).json({ courses: result.data || [], source: 'server' });
};
