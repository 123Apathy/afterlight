// assets/demo/ is gitignored on purpose (real demo photos must never be
// committed as family PII), but constants/demo.ts statically requires its
// eight numbered files, so a fresh clone would fail to bundle without them.
// This fills any missing slot from the committed, licensed fallbacks in
// assets/demo-fallback/. Runs on postinstall; real photos dropped into
// assets/demo/ are never overwritten.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = join(root, 'assets/demo');
const fallbackDir = join(root, 'assets/demo-fallback');

mkdirSync(demoDir, { recursive: true });
let filled = 0;
for (let i = 1; i <= 8; i++) {
  const name = `${String(i).padStart(2, '0')}.jpg`;
  const target = join(demoDir, name);
  if (!existsSync(target)) {
    copyFileSync(join(fallbackDir, name), target);
    filled++;
  }
}
if (filled) console.log(`prepare-demo-photos: filled ${filled} missing slot(s) from fallbacks`);
