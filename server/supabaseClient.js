const { createClient } = require('@supabase/supabase-js');

const PHOTOS_BUCKET = 'afterlight-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6; // 6 hours

let supabase = null;

function getClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    // Prefer the secret (service-role) key: once RLS on the afterlight_*
    // tables is locked down to deny anon, the server MUST run on the secret
    // key or every query dies. SUPABASE_KEY (publishable) remains the
    // fallback so nothing breaks before the key is provisioned.
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_KEY) must be set (see server/.env.example)');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

module.exports = { get supabase() { return getClient(); }, PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS };
