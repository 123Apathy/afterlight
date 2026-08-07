// Regenerates the landing page's CSS design tokens from constants/theme.ts,
// so the app theme stays the single source of truth and the two lanes cannot
// drift (DESIGN.md flagged the hand-copied palette as "drift is a matter of
// time"). Rewrites the block between the everlit-tokens markers in each
// public/*.html page that carries them. Run: node scripts/sync-landing-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const themeSrc = readFileSync(join(root, 'constants/theme.ts'), 'utf8');

// Pull the colors object out of the TS source without executing it (no TS
// runtime here, and the file's require() calls can't run in plain node).
const colorsBlock = themeSrc.match(/export const colors = \{([\s\S]*?)\};/)?.[1];
if (!colorsBlock) throw new Error('colors object not found in constants/theme.ts');
const colors = {};
for (const m of colorsBlock.matchAll(/^\s*(\w+):\s*'([^']+)'/gm)) colors[m[1]] = m[2];

const need = ['gold', 'goldWarm', 'goldDeep', 'heart', 'comment', 'detail', 'ink', 'cream', 'dark', 'darkWarm'];
for (const k of need) if (!colors[k]) throw new Error(`colors.${k} missing from theme.ts`);

const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const lines = need.map((k) => `      --${kebab(k)}: ${colors[k]};`).join('\n');
const block = [
  '      /* everlit-tokens:start -- GENERATED from constants/theme.ts by',
  '         scripts/sync-landing-tokens.mjs; edit the theme, not these. */',
  lines,
  '      /* everlit-tokens:end */',
].join('\n');

const marker = /      \/\* everlit-tokens:start[\s\S]*?everlit-tokens:end \*\//;
for (const page of ['public/landing.html']) {
  const path = join(root, page);
  const html = readFileSync(path, 'utf8');
  if (!marker.test(html)) throw new Error(`token markers not found in ${page}`);
  writeFileSync(path, html.replace(marker, block));
  console.log(`synced ${page}`);
}
