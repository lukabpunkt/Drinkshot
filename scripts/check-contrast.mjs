/**
 * Kontrast-Prüfung der Textfarben (Audit A5: ≥ 4.5:1, grosser Text ≥ 3:1).
 *
 * Liest die CSS-Dateien, löst `var(--token)` gegen `tokens.css` auf und prüft jede Regel,
 * die **Vorder- und Hintergrundfarbe selbst setzt** — genau dort entstehen die Paare, die
 * ein Mensch später liest. Rein geerbte Kombinationen kann eine statische Prüfung nicht
 * sehen; die stehen in `EXTRA_PAIRS`, aus dem UI abgelesen.
 *
 * Absichtlich ohne Browser: So läuft die Prüfung in der CI mit, statt einmalig in axe.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/* --- Farbrechnung (WCAG 2.1) --- */
const parseHex = (h) => {
  const v = h.replace('#', '');
  const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = parseHex(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* --- Tokens --- */
const tokens = new Map();
for (const [, name, value] of read('src/styles/tokens.css').matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
  tokens.set(name, value);
}

/** Löst `var(--x)` und Rohfarben auf; alles andere (Verläufe, rgb(/%)) wird übersprungen. */
function resolve(value) {
  const trimmed = value.trim();
  const varMatch = /^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/.exec(trimmed);
  if (varMatch) return tokens.get(varMatch[1]) ?? (varMatch[2] ? resolve(varMatch[2]) : null);
  if (/^#[0-9a-fA-F]{3,6}$/.test(trimmed)) return trimmed;
  return null;
}

/* --- Regeln mit eigenem Vorder- und Hintergrund --- */
const FILES = ['src/styles/base.css', 'src/styles/components.css'];
/** Grosser Text (≥ 24 px oder ≥ 19 px fett) darf auf 3:1 (WCAG 1.4.3). */
const LARGE_TEXT = /logo|headline|hero|title__|__value|bet__|pass__name|result__headline|score__/;

const pairs = [];
for (const file of FILES) {
  const css = read(file);
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    /*
     * Buttons setzen ihre Farben über eigene Custom Properties (`--btn-face` /
     * `--btn-text`) statt über `background` / `color` — ohne das hier fielen genau die
     * Flächen durch die Prüfung, auf denen am meisten Text steht.
     */
    const bg =
      /(?:^|[;\s])background(?:-color)?:\s*([^;]+)/.exec(body) ??
      /(?:^|[;\s])--btn-face:\s*([^;]+)/.exec(body);
    const fg =
      /(?:^|[;\s])color:\s*([^;]+)/.exec(body) ??
      /(?:^|[;\s])--btn-text:\s*([^;]+)/.exec(body);
    if (!bg || !fg) continue;
    const back = resolve(bg[1]);
    const front = resolve(fg[1]);
    if (!back || !front) continue;
    pairs.push({ label: `${file.split('/').pop()} · ${selector.trim().split('\n').join(' ')}`, front, back, large: LARGE_TEXT.test(selector) });
  }
}

/**
 * Paare, die durch Vererbung entstehen — Text erbt die Farbe, die Fläche kommt vom
 * Screen darunter. Aus dem laufenden UI abgelesen.
 */
const EXTRA_PAIRS = [
  ['Fliesstext auf Panel', '#fff8e7', '#1c1b2e', false],
  ['Fliesstext auf Deep-BG', '#fff8e7', '#0f0e1a', false],
  ['Gedimmter Text (62 % Papier auf Panel)', '#a39fb0', '#1c1b2e', false],
  ['Akzent-Text klein auf Panel', '#ffb800', '#1c1b2e', false],
  ...['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'].map((id) => [
    `Spielername ${id} auf Panel`,
    tokens.get(`--c-player-${id}`),
    '#1c1b2e',
    false,
  ]),
];
for (const [label, front, back, large] of EXTRA_PAIRS) pairs.push({ label, front, back, large });

/* --- Ausgabe --- */
let failures = 0;
let worst = { ratio: Infinity, label: '' };
for (const { label, front, back, large } of pairs) {
  const ratio = contrast(front, back);
  const min = large ? 3 : 4.5;
  const ok = ratio >= min;
  if (!ok) failures++;
  if (ratio < worst.ratio) worst = { ratio, label };
  if (!ok || process.env.VERBOSE) {
    console.log(`${ok ? '✅' : '❌'} ${ratio.toFixed(2)}:1 (min ${min})  ${front} auf ${back}  ${label}`);
  }
}

console.log(`\n${pairs.length} Paare geprüft · schlechtestes ${worst.ratio.toFixed(2)}:1 (${worst.label})`);
if (failures > 0) {
  console.error(`${failures} Paar(e) unter der Grenze.`);
  process.exit(1);
}
console.log('Alle Textfarben erfüllen WCAG AA.');
