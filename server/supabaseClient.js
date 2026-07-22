const { createClient } = require('@supabase/supabase-js');

const PHOTOS_BUCKET = 'afterlight-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6; // 6 hours

let supabase = null;

function getClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    // Prefer the secret (service-role) key: once RLS on the afterlight_*
    // tables is locked down to deny anon, the server MUST run on the secret
    // key or every query dies. SUPABASE_SERVICE_ROLE_KEY is Supabase's own
    // name for this (what their Netlify integration provisions automatically
    // -- confirmed already present on the live site under this exact name);
    // SUPABASE_SECRET_KEY is kept as an alias for anywhere it was set by
    // hand under our own naming. SUPABASE_KEY (publishable) is the last
    // resort so nothing breaks before either is provisioned.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY / SUPABASE_KEY) must be set (see server/.env.example)');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

module.exports = { get supabase() { return getClient(); }, PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS };
