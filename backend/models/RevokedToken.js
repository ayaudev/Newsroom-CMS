const { createHash } = require('node:crypto');
const { query } = require('../config/db');
const digest = token => createHash('sha256').update(token).digest('hex');

exports.isRevoked = async token => {
  const result = await query('SELECT 1 FROM revoked_tokens WHERE token_hash = $1 AND expires_at > now()', [digest(token)]);
  return result.rowCount > 0;
};
exports.revoke = async (token, expiresAt) => {
  await query('INSERT INTO revoked_tokens(token_hash, expires_at) VALUES($1,$2) ON CONFLICT(token_hash) DO NOTHING', [digest(token), new Date(expiresAt * 1000)]);
};
