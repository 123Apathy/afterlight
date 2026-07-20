const { createClient } = require('@supabase/supabase-js');

const PHOTOS_BUCKET = 'afterlight-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6; // 6 hours

let supabase = null;

function getClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set (see server/.env.example)');
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

module.exports = { get supabase() { return getClient(); }, PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS };
