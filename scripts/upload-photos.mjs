import fs from 'fs';
import path from 'path';

// Both arguments are supplied on the command line. They used to be hardcoded,
// which put a real grieving client's name and the operator's local folder
// layout into a PUBLIC repo for anyone to read.
const PROJECT_ID = process.argv[2];
const SOURCE_DIR = process.argv[3];
const API_BASE = process.env.API_BASE || 'http://localhost:4400';
const BATCH_SIZE = 12;

if (!PROJECT_ID || !SOURCE_DIR) {
  console.error('usage: node upload-photos.mjs <projectId> <sourceDir>');
  console.error('  optional: API_BASE=https://... (defaults to http://localhost:4400)');
  process.exit(1);
}

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`source directory not found: ${SOURCE_DIR}`);
  process.exit(1);
}

function collectImages(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectImages(full));
    } else if (/\.(jpe?g|png|heic|webp)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const files = collectImages(SOURCE_DIR);
console.log(`Found ${files.length} image files`);

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  return 'image/jpeg';
}

async function uploadBatch(batch) {
  const form = new FormData();
  for (const filePath of batch) {
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer], { type: mimeFor(filePath) });
    form.append('photos', blob, path.basename(filePath));
  }
  const res = await fetch(`${API_BASE}/api/projects/${PROJECT_ID}/photos`, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  const created = await res.json();
  return created.length;
}

let uploaded = 0;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  const count = await uploadBatch(batch);
  uploaded += count;
  console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count} photos (${uploaded}/${files.length} total)`);
}

console.log(`Done. ${uploaded} photos uploaded.`);
