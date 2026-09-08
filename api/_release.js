const manifest = require('../version.json');

module.exports = function releaseInfo() {
  const commit = String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '').trim();
  return {
    version: manifest.version,
    channel: manifest.channel,
    releaseId: manifest.releaseId,
    schemaVersion: manifest.schemaVersion,
    commit: commit ? commit.slice(0, 12) : null,
    environment: String(process.env.VERCEL_ENV || process.env.NODE_ENV || 'local'),
    region: String(process.env.VERCEL_REGION || '').trim() || null
  };
};
