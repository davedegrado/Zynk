// ZYNK logo geometry + SVG builders.
//
// The symbol: a jagged comic "impact burst" (Acid Lime) with a rounded speech
// bubble punched out of it (Night) carrying a slanted "!" (Acid Lime).
// Every shape is a flat filled path on a 512x512 viewBox. Because the bubble
// sits fully inside the burst and the "!" fully inside the bubble, the same
// geometry combined with fill-rule="evenodd" gives a one-color silhouette.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIEWBOX = '0 0 512 512';

export const COLORS = {
  night: '#0B0B12',
  lime: '#DFFF00',
  offWhite: '#F7F7F2',
  purple: '#B892FF',
  blue: '#37C8FF',
  pink: '#FF6AD5',
};

const r1 = (n) => Math.round(n * 10) / 10;
const pt = (x, y) => `${r1(x)} ${r1(y)}`;

// ---- Burst: 12 irregular spikes, hand-tuned radii (deterministic) ----------
function burstPath(cx = 256, cy = 256, scale = 1) {
  const n = 12;
  const rotation = -22; // degrees, gives it a little attitude
  const outer = [252, 212, 240, 204, 250, 216, 234, 206, 254, 214, 238, 210];
  const inner = [170, 174, 168, 176, 170, 172, 166, 174, 172, 168, 174, 170];
  // small angular jitter per spike so it doesn't look mechanical
  const jitter = [0, 4, -3, 2, -4, 3, 0, -2, 4, -3, 2, -1];
  const parts = [];
  for (let i = 0; i < n; i++) {
    const aOut = ((i * 360) / n + rotation + jitter[i]) * (Math.PI / 180) - Math.PI / 2;
    const aIn = (((i + 0.5) * 360) / n + rotation) * (Math.PI / 180) - Math.PI / 2;
    const ox = cx + Math.cos(aOut) * outer[i] * scale;
    const oy = cy + Math.sin(aOut) * outer[i] * scale;
    const ix = cx + Math.cos(aIn) * inner[i] * scale;
    const iy = cy + Math.sin(aIn) * inner[i] * scale;
    parts.push(`${i === 0 ? 'M' : 'L'}${pt(ox, oy)}`, `L${pt(ix, iy)}`);
  }
  return parts.join(' ') + ' Z';
}

// ---- Speech bubble: ellipse with a tail pointing down-left -----------------
function bubblePath() {
  const cx = 262, cy = 246, rx = 114, ry = 92;
  const deg = (d) => (d * Math.PI) / 180;
  const at = (d) => [cx + Math.cos(deg(d)) * rx, cy + Math.sin(deg(d)) * ry];
  // tail leaves the ellipse between 112deg and 146deg (SVG y-down: bottom-left)
  const [sx, sy] = at(146);
  const [ex, ey] = at(112);
  const tip = [cx - 116, cy + 126];
  // arc the long way round from the tail's left base to its right base
  return [
    `M${pt(ex, ey)}`,
    `A${rx} ${ry} 0 1 0 ${pt(sx, sy)}`,
    `L${pt(tip[0], tip[1])}`,
    'Z',
  ].join(' ');
}

// ---- "!" : slanted tapered bar + dot ---------------------------------------
function bangPath() {
  // bar is a trapezoid leaning right (comic italic)
  const bar = [
    [264, 182], // top-left
    [302, 182], // top-right
    [280, 266], // bottom-right
    [256, 266], // bottom-left
  ];
  const barD = `M${bar.map(([x, y]) => pt(x, y)).join(' L')} Z`;
  const dx = 259, dy = 298, r = 18;
  const dotD = `M${pt(dx - r, dy)} A${r} ${r} 0 1 0 ${pt(dx + r, dy)} A${r} ${r} 0 1 0 ${pt(dx - r, dy)} Z`;
  return `${barD} ${dotD}`;
}

export const PATHS = {
  burst: burstPath(),
  bubble: bubblePath(),
  bang: bangPath(),
};

// The layered, colored symbol.
// fg     = burst + "!" colour (default Acid Lime)
// cutout = bubble colour (default Night)
// bg     = optional full-bleed background colour (null = transparent)
// scale  = symbol size as a fraction of the canvas (1 = fills the viewBox)
export function symbolSvg({
  size = 512,
  fg = COLORS.lime,
  cutout = COLORS.night,
  bang = fg,
  bg = null,
  scale = 1,
} = {}) {
  const t = 256 * (1 - scale);
  const bgRect = bg ? `<rect width="512" height="512" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bgRect}<g transform="translate(${r1(t)} ${r1(t)}) scale(${scale})"><path d="${PATHS.burst}" fill="${fg}"/><path d="${PATHS.bubble}" fill="${cutout}"/><path d="${PATHS.bang}" fill="${bang}"/></g></svg>`;
}

// One path, one colour, transparent background. Bubble is a true hole.
export const MONO_PATH = `${PATHS.burst} ${PATHS.bubble} ${PATHS.bang}`;

export function monoSvg({ size = 512, color = '#FFFFFF', bg = null, scale = 1 } = {}) {
  const t = 256 * (1 - scale);
  const bgRect = bg ? `<rect width="512" height="512" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bgRect}<g transform="translate(${r1(t)} ${r1(t)}) scale(${scale})"><path d="${MONO_PATH}" fill="${color}" fill-rule="evenodd"/></g></svg>`;
}

export function pathsJson() {
  return {
    name: 'zynk-symbol',
    viewBox: VIEWBOX,
    width: 512,
    height: 512,
    colors: COLORS,
    // Colored rendering: draw in order, each with its own fill.
    layers: [
      { id: 'burst', d: PATHS.burst, fill: COLORS.lime, role: 'fg' },
      { id: 'bubble', d: PATHS.bubble, fill: COLORS.night, role: 'cutout' },
      { id: 'bang', d: PATHS.bang, fill: COLORS.lime, role: 'fg' },
    ],
    // Single-colour silhouette: one path, fillRule evenodd, any colour.
    mono: { d: MONO_PATH, fillRule: 'evenodd' },
  };
}

// Write canonical brand files into the mobile app.
export function writeBrandFiles(outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'logo-symbol.svg'), symbolSvg() + '\n');
  writeFileSync(resolve(outDir, 'logo-mono.svg'), monoSvg({ color: COLORS.night }) + '\n');
  writeFileSync(resolve(outDir, 'logo-paths.json'), JSON.stringify(pathsJson(), null, 2) + '\n');
}

const here = dirname(fileURLToPath(import.meta.url));
export const MOBILE_ASSETS = resolve(here, '../../apps/mobile/assets');
