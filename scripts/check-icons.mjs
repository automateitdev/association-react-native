/**
 * Every name in ICONS must exist in the icon font.
 *
 * WHY THIS IS A SCRIPT AND NOT A CODE REVIEW
 * ------------------------------------------
 * Material Symbols is a LIGATURE font: rendering the text "receipt_long"
 * produces the glyph. A name the font does not know does not fail, throw, or
 * render a box - it renders the literal word. "recipt_long" would print
 * "recipt_long" in the middle of a toolbar, on every platform, and only a
 * person looking at that screen would ever find out.
 *
 * TypeScript already stops a typo at the CALL SITE, because IconName is
 * keyed off ICONS. It cannot check the VALUES, which are the half that has to
 * match something outside the codebase. This does.
 *
 * It reads the shipped .ttf rather than a list committed beside it, so
 * upgrading @expo-google-fonts/material-symbols cannot silently invalidate the
 * check: a name the new font drops fails here the same as a name that was
 * never real.
 *
 *   node scripts/check-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FONT = join(
  root,
  'node_modules/@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf',
);

/**
 * The glyph names in a TrueType `post` table, version 2.0.
 *
 * The font names each glyph for the icon it draws - glyph "gavel" is the
 * gavel - and the ligature for that icon carries the same name, so the post
 * table is the list of legal values. Parsed by hand because the alternative is
 * a font-tooling dependency for one assertion.
 */
function glyphNames(file) {
  const buf = readFileSync(file);

  const numTables = buf.readUInt16BE(4);
  let post = null;

  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === 'post') {
      post = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
      break;
    }
  }

  if (!post) throw new Error('No post table: this is not the font we expect.');
  if (buf.readUInt32BE(post.offset) !== 0x00020000) {
    throw new Error('post table is not version 2.0, so it carries no glyph names.');
  }

  const count = buf.readUInt16BE(post.offset + 32);
  const indices = [];
  for (let i = 0; i < count; i++) indices.push(buf.readUInt16BE(post.offset + 34 + i * 2));

  // Pascal strings, packed one after another, for every index past the 258
  // standard Macintosh names.
  const names = [];
  let at = post.offset + 34 + count * 2;
  const end = post.offset + post.length;
  while (at < end) {
    const len = buf.readUInt8(at);
    names.push(buf.toString('utf8', at + 1, at + 1 + len));
    at += 1 + len;
  }

  return new Set(indices.filter((i) => i >= 258).map((i) => names[i - 258]));
}

/** The values out of ui/Icon.tsx, without asking Node to parse TypeScript. */
function iconValues() {
  const src = readFileSync(join(root, 'src/ui/Icon.tsx'), 'utf8');
  const block = src.slice(src.indexOf('export const ICONS'), src.indexOf('} as const;'));

  return [...block.matchAll(/^\s*([A-Za-z]+):\s*'([a-z0-9_]+)',/gm)].map((m) => ({
    key: m[1],
    value: m[2],
  }));
}

const available = glyphNames(FONT);
const icons = iconValues();

if (icons.length === 0) {
  console.error('Read no icons out of ui/Icon.tsx - the ICONS block has moved or changed shape.');
  process.exit(1);
}

const missing = icons.filter((i) => !available.has(i.value));

// A second pass, for the OTHER half of the rule: one glyph, one meaning. This
// only warns. Two names for one glyph is sometimes deliberate - `empty` and
// `approvals` are both an inbox tray, and they never appear on the same screen
// - but it should be a decision rather than an accident.
const byValue = new Map();
for (const { key, value } of icons) {
  byValue.set(value, [...(byValue.get(value) ?? []), key]);
}
const shared = [...byValue.entries()].filter(([, keys]) => keys.length > 1);

for (const [value, keys] of shared) {
  console.warn(`  shared glyph: ${keys.join(', ')} all render '${value}'`);
}

if (missing.length > 0) {
  console.error(`\n${missing.length} icon name(s) the font cannot draw:\n`);
  for (const { key, value } of missing) {
    console.error(`  ${key}: '${value}'  - would render as the literal text "${value}"`);
  }
  process.exit(1);
}

console.log(`${icons.length} icons, all present in the font.`);
