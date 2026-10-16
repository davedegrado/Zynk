# @zynk/assets-tools

Generates Speow! brand icons and notification sounds into `apps/mobile/assets/`.

```bash
npm install                       # from repo root (installs @resvg/resvg-js)
npm run generate -w @zynk/assets-tools   # or: cd tools/assets && npm run generate
```

- `logo.mjs`: the logo geometry (512x512 viewBox) plus the SVG builders `symbolSvg()` and `monoSvg()`.
- `generate-icons.mjs`: writes `apps/mobile/assets/brand/` (SVGs + `logo-paths.json` for react-native-svg) and rasterises the Expo PNGs in `apps/mobile/assets/images/` with resvg.
- `generate-sounds.mjs`: synthesises `apps/mobile/assets/sounds/*.wav` (16-bit PCM mono, 44.1 kHz, peak -3 dBFS) with no dependencies. Noise comes from a seeded PRNG, so every run gives the same bytes.

To change the logo, edit `logo.mjs` and run the generator again. To change a sound, edit its function in `generate-sounds.mjs`.
