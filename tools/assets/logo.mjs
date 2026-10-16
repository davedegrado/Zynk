// Speow! logo geometry + SVG builders.
//
// The symbol: a bold, compact speech bubble (Acid Lime) with a small impact
// burst popping off its top-right corner, and a slanted "!" punched out of the
// bubble (Near-black). Every shape is a flat filled path on a 512x512 viewBox.
// The burst never touches the bubble and the "!" sits fully inside it, so the
// same geometry combined with fill-rule="evenodd" gives a one-color silhouette.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIEWBOX = '0 0 512 512';

export const COLORS = {
  ink: '#111111',
  lime: '#D7FF36',
  white: '#FFFFFF',
  // Secondary accents used by premium themes.
  purple: '#B892FF',
  blue: '#37C8FF',
  pink: '#FF6AD5',
};

const r1 = (n) => Math.round(n * 10) / 10;
const pt = (x, y) => `${r1(x)} ${r1(y)}`;

// ---- Speech bubble: chunky rounded square with a sharp tail (bottom-left) --
function bubblePath() {
  // body: x 40..392, y 136..408, corner radius 116
  return [
    'M156 136',
    'H276',
    'A116 116 0 0 1 392 252',
    'V292',
    'A116 116 0 0 1 276 408',
    'H190',
    'L58 474', // tail tip
    'L86 370',
    'A116 116 0 0 1 40 292',
    'V252',
    'A116 116 0 0 1 156 136',
    'Z',
  ].join(' ');
}

// ---- Impact burst: small 8-point star, slightly irregular, top-right -------
function burstPath(cx = 418, cy = 102, scale = 1) {
  const n = 8;
  const rotation = 12;
  const outer = [82, 66, 78, 62, 66, 60, 76, 64];
  const inner = [38, 40, 37, 39, 38, 40, 37, 39];
  const parts = [];
  for (let i = 0; i < n; i++) {
    const aOut = ((i * 360) / n + rotation) * (Math.PI / 180) - Math.PI / 2;
    const aIn = (((i + 0.5) * 360) / n + rotation) * (Math.PI / 180) - Math.PI / 2;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${pt(cx + Math.cos(aOut) * outer[i] * scale, cy + Math.sin(aOut) * outer[i] * scale)}`,
      `L${pt(cx + Math.cos(aIn) * inner[i] * scale, cy + Math.sin(aIn) * inner[i] * scale)}`,
    );
  }
  return parts.join(' ') + ' Z';
}

// ---- "!" : slanted tapered bar + dot, centred in the bubble ----------------
function bangPath() {
  const bar = [
    [208, 190], // top-left
    [258, 190], // top-right
    [236, 300], // bottom-right
    [206, 300], // bottom-left
  ];
  const barD = `M${bar.map(([x, y]) => pt(x, y)).join(' L')} Z`;
  const dx = 214, dy = 344, r = 24;
  const dotD = `M${pt(dx - r, dy)} A${r} ${r} 0 1 0 ${pt(dx + r, dy)} A${r} ${r} 0 1 0 ${pt(dx - r, dy)} Z`;
  return `${barD} ${dotD}`;
}

export const PATHS = {
  bubble: bubblePath(),
  burst: burstPath(),
  bang: bangPath(),
};

// The layered, colored symbol.
// fg     = bubble + burst colour (default Acid Lime)
// cutout = "!" colour (default Near-black; usually the background it sits on)
// bg     = optional full-bleed background colour (null = transparent)
// scale  = symbol size as a fraction of the canvas (1 = fills the viewBox)
export function symbolSvg({
  size = 512,
  fg = COLORS.lime,
  cutout = COLORS.ink,
  bg = null,
  scale = 1,
} = {}) {
  const t = 256 * (1 - scale);
  const bgRect = bg ? `<rect width="512" height="512" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bgRect}<g transform="translate(${r1(t)} ${r1(t)}) scale(${scale})"><path d="${PATHS.bubble}" fill="${fg}"/><path d="${PATHS.burst}" fill="${fg}"/><path d="${PATHS.bang}" fill="${cutout}"/></g></svg>`;
}

// One path, one colour, transparent background. The "!" is a true hole.
export const MONO_PATH = `${PATHS.bubble} ${PATHS.burst} ${PATHS.bang}`;

export function monoSvg({ size = 512, color = '#FFFFFF', bg = null, scale = 1 } = {}) {
  const t = 256 * (1 - scale);
  const bgRect = bg ? `<rect width="512" height="512" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bgRect}<g transform="translate(${r1(t)} ${r1(t)}) scale(${scale})"><path d="${MONO_PATH}" fill="${color}" fill-rule="evenodd"/></g></svg>`;
}

export function pathsJson() {
  return {
    name: 'speow-symbol',
    viewBox: VIEWBOX,
    width: 512,
    height: 512,
    colors: COLORS,
    // Colored rendering: draw in order, each with its own fill.
    layers: [
      { id: 'bubble', d: PATHS.bubble, fill: COLORS.lime, role: 'fg' },
      { id: 'burst', d: PATHS.burst, fill: COLORS.lime, role: 'fg' },
      { id: 'bang', d: PATHS.bang, fill: COLORS.ink, role: 'cutout' },
    ],
    // Single-colour silhouette: one path, fillRule evenodd, any colour.
    mono: { d: MONO_PATH, fillRule: 'evenodd' },
  };
}

// Write canonical brand files into the mobile app.
export function writeBrandFiles(outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'logo-symbol.svg'), symbolSvg() + '\n');
  writeFileSync(resolve(outDir, 'logo-mono.svg'), monoSvg({ color: COLORS.ink }) + '\n');
  writeFileSync(resolve(outDir, 'logo-paths.json'), JSON.stringify(pathsJson(), null, 2) + '\n');
}

const here = dirname(fileURLToPath(import.meta.url));
export const MOBILE_ASSETS = resolve(here, '../../apps/mobile/assets');
