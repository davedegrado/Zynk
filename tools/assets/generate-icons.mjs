// Rasterises the ZYNK symbol into the PNGs Expo expects.
// Run: npm run generate (from tools/assets) or node generate-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { COLORS, MOBILE_ASSETS, monoSvg, symbolSvg, writeBrandFiles } from './logo.mjs';

const IMAGES = resolve(MOBILE_ASSETS, 'images');
const BRAND = resolve(MOBILE_ASSETS, 'brand');
mkdirSync(IMAGES, { recursive: true });

function render(svg, size, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, shapeRendering: 2 })
    .render()
    .asPng();
  writeFileSync(resolve(IMAGES, file), png);
  console.log(`  images/${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

const solid = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="${color}"/></svg>`;

console.log('ZYNK icons →', IMAGES);

// App store icon: full bleed Night, symbol ~70%.
render(symbolSvg({ bg: COLORS.night, scale: 0.7 }), 1024, 'icon.png');
// Android adaptive: symbol within the inner 66% safe zone (~600px of 1024).
render(symbolSvg({ scale: 0.58 }), 1024, 'android-icon-foreground.png');
render(solid(COLORS.night), 1024, 'android-icon-background.png');
render(monoSvg({ color: '#FFFFFF', scale: 0.58 }), 1024, 'android-icon-monochrome.png');
// Splash: symbol only, transparent; splash background is Night.
render(symbolSvg({ scale: 0.9 }), 1024, 'splash-icon.png');
// Android notification icon: white alpha silhouette.
render(monoSvg({ color: '#FFFFFF', scale: 0.94 }), 96, 'notification-icon.png');
// Web favicon.
render(symbolSvg({ bg: COLORS.night, scale: 0.9 }), 48, 'favicon.png');

writeBrandFiles(BRAND);
console.log('  brand/logo-symbol.svg, brand/logo-mono.svg, brand/logo-paths.json');

// Remove Expo template images that no longer apply.
const stale = [
  'images/react-logo.png',
  'images/react-logo@2x.png',
  'images/react-logo@3x.png',
  'images/expo-logo.png',
  'images/expo-badge.png',
  'images/expo-badge-white.png',
  'images/logo-glow.png',
  'images/tutorial-web.png',
  'images/tabIcons',
  'expo.icon',
];
for (const p of stale) {
  const full = resolve(MOBILE_ASSETS, p);
  if (existsSync(full)) {
    rmSync(full, { recursive: true, force: true });
    console.log(`  removed ${p}`);
  }
}
