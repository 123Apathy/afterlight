// Seeds the REAL sales-demo memorial in production: a genuine project named
// Margaret with the same photos, family, favourites and comments as the
// offline /demo, so a rep can hand a prospect a real join link on their own
// phone. Run from a machine with network access to the site (this cannot run
// inside the sandboxed agent session):
//
//   EVERLIT_CREATE_CODE=<the operator start code> node scripts/seed-demo-project.mjs
//
// Optional: SEED_BASE_URL (default https://everlit.co.za), SEED_NAME
// (default Margaret). Prints the join link when done. Photos come from
// assets/demo/01..08.jpg, so run scripts/prepare-demo-photos.mjs first (or
// npm install, which runs it) or drop the real licensed set in.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.SEED_BASE_URL || 'https://everlit.co.za';
const NAME = process.env.SEED_NAME || 'Margaret';
const START_CODE = process.env.EVERLIT_CREATE_CODE;
if (!START_CODE) {
  console.error('Set EVERLIT_CREATE_CODE (the operator start code) and run again.');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Must mirror constants/demo.ts, which drives the offline /demo. Photo index
// refers to assets/demo/0<n+1>.jpg.
const CAST = ['Sarah', 'James', 'Lily', 'Uncle Ray', 'Thandi'];
const SEEDS = [
  { photo: 0, favouritedBy: ['Sarah', 'James', 'Lily'],
    comments: [{ author: 'Sarah', text: 'That golden hour again. She never missed a sunset on the stoep.' }] },
  { photo: 1, favouritedBy: ['James', 'Lily'],
    comments: [{ author: 'Lily', text: 'The day she taught me to bake. Flour everywhere, both of us laughing.' }] },
  { photo: 2, favouritedBy: ['Uncle Ray'],
    comments: [{ author: 'Uncle Ray', text: 'Found this box in her cupboard. Sixty years of us, all kept safe.' }] },
  { photo: 3, favouritedBy: ['Sarah'],
    comments: [{ author: 'James', text: 'The view from the farm gate. She called it her front row seat.' }] },
  { photo: 4 },
  { photo: 5, favouritedBy: ['Thandi'],
    comments: [{ author: 'Thandi', text: 'She brought me soup every winter for twenty years. I miss her knock.' }] },
  { photo: 6, favouritedBy: ['Lily'] },
  { photo: 7 },
];

async function call(path, { method = 'GET', headers = {}, body, invite } = {}) {
  const h = { ...headers };
  if (invite) h['X-Invite-Code'] = invite;
  if (body && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

console.log(`Creating "${NAME}" on ${BASE} ...`);
const project = await call('/api/projects', {
  method: 'POST',
  body: { name: NAME, startCode: START_CODE, contact: 'sales demo project' },
});
const invite = project.inviteCode;
if (!invite) throw new Error('project created but no inviteCode in response');
console.log(`  project ${project.id}, invite ${invite}`);

// The family walks in: each cast member becomes a real named member.
const members = {};
for (const name of CAST) {
  const m = await call(`/api/projects/${project.id}/members`, {
    method: 'POST', invite, body: { name },
  });
  members[name] = m.id ?? m.member?.id;
  console.log(`  member ${name} (${members[name] ?? 'no id returned'})`);
}

// All eight photos in one multipart request (the API takes up to 40).
const form = new FormData();
for (let i = 1; i <= 8; i++) {
  const file = join(root, 'assets/demo', `${String(i).padStart(2, '0')}.jpg`);
  form.append('photos', new Blob([readFileSync(file)], { type: 'image/jpeg' }), `margaret-${i}.jpg`);
}
const uploaded = await call(`/api/projects/${project.id}/photos`, { method: 'POST', invite, body: form });
const photos = Array.isArray(uploaded) ? uploaded : uploaded.photos ?? uploaded.created ?? [];
console.log(`  uploaded ${photos.length} photos`);
if (photos.length < SEEDS.length) throw new Error('fewer photos than seeds; aborting before hearts/comments');

for (const seed of SEEDS) {
  const photoId = photos[seed.photo].id;
  for (const rater of seed.favouritedBy ?? []) {
    await call(`/api/photos/${photoId}/favorite`, {
      method: 'POST', invite, body: { rater, memberId: members[rater] },
    });
  }
  for (const c of seed.comments ?? []) {
    await call(`/api/photos/${photoId}/comments`, {
      method: 'POST', invite, body: { author: c.author, text: c.text, memberId: members[c.author] },
    });
  }
}
console.log('  hearts and comments seeded');

console.log('\nDone. Rep-facing join link:');
console.log(`  ${BASE}/join/${invite}`);
console.log('\nNote: this is a real memorial; anything a prospect adds persists.');
console.log('To reset between pitches, delete stray hearts/comments in the app,');
console.log('or delete the project and run this script again.');
