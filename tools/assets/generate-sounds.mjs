// ZYNK notification sounds — original, procedurally synthesised.
// Pure Node, no dependencies. Output: 16-bit PCM mono 44.1 kHz WAV.
// Deterministic: all noise comes from a seeded PRNG.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MOBILE_ASSETS } from './logo.mjs';

const SR = 44100;
const OUT = resolve(MOBILE_ASSETS, 'sounds');
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- helpers --
const buf = (sec) => new Float64Array(Math.round(sec * SR));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const osc = {
  sine: (p) => Math.sin(p * TAU),
  tri: (p) => 1 - 4 * Math.abs((((p % 1) + 1) % 1) - 0.5),
  // band-limited-ish: few harmonics so square/saw are not harsh
  square: (p, h = 7) => {
    let s = 0;
    for (let k = 1; k <= h; k += 2) s += Math.sin(p * TAU * k) / k;
    return s * (4 / Math.PI) * 0.8;
  },
  saw: (p, h = 8) => {
    let s = 0;
    for (let k = 1; k <= h; k++) s += Math.sin(p * TAU * k) / k;
    return s * (2 / Math.PI) * 0.8;
  },
};

// Attack/decay/sustain/release envelope; t and all times in seconds.
function adsr(t, dur, { a = 0.005, d = 0.05, s = 0.6, r = 0.05 } = {}) {
  if (t < 0 || t > dur) return 0;
  let v;
  if (t < a) v = t / a;
  else if (t < a + d) v = 1 - (1 - s) * ((t - a) / d);
  else v = s;
  const rel = dur - t;
  if (rel < r) v *= rel / r;
  return v;
}
const expDecay = (t, tau) => (t < 0 ? 0 : Math.exp(-t / tau));

// Render a tone with a frequency function f(t) into `out` starting at `start` s.
function tone(out, start, dur, freqFn, { wave = 'sine', gain = 1, env, h } = {}) {
  const i0 = Math.round(start * SR);
  const n = Math.round(dur * SR);
  let phase = 0;
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / SR;
    phase += freqFn(t) / SR;
    const e = env ? env(t, dur) : adsr(t, dur);
    out[i0 + i] += osc[wave](phase, h) * e * gain;
  }
}

// Two-operator FM bell.
function bell(out, start, dur, f, { ratio = 3.5, index = 2.5, tau = 0.25, gain = 1 } = {}) {
  const i0 = Math.round(start * SR);
  const n = Math.round(dur * SR);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    const t = i / SR;
    const e = expDecay(t, tau) * Math.min(1, t / 0.002);
    const mod = Math.sin(TAU * f * ratio * t) * index * expDecay(t, tau * 0.6);
    out[i0 + i] += Math.sin(TAU * f * t + mod) * e * gain;
  }
}

// RBJ biquad, coefficients may vary per sample via cutoff function.
function biquad(input, type, cutoffFn, q = 0.707) {
  const out = new Float64Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const fc = Math.min(SR * 0.45, Math.max(20, cutoffFn(i / SR)));
    const w = (TAU * fc) / SR;
    const cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; } // bandpass (0 dB peak)
    const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    const x = input[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}
const constant = (v) => () => v;

function onePoleLP(input, fc) {
  const out = new Float64Array(input.length);
  const k = 1 - Math.exp((-TAU * fc) / SR);
  let y = 0;
  for (let i = 0; i < input.length; i++) out[i] = y += k * (input[i] - y);
  return out;
}

function noise(sec, seed) {
  const rnd = mulberry32(seed);
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) b[i] = rnd() * 2 - 1;
  return b;
}

function mixInto(out, src, start = 0, gain = 1, env) {
  const i0 = Math.round(start * SR);
  for (let i = 0; i < src.length && i0 + i < out.length; i++) {
    out[i0 + i] += src[i] * gain * (env ? env(i / SR) : 1);
  }
}

// Remove DC, normalise to -3 dBFS, apply short fades.
function finish(b, { fadeIn = 0.003, fadeOut = 0.02 } = {}) {
  let mean = 0;
  for (const v of b) mean += v;
  mean /= b.length;
  let peak = 0;
  for (let i = 0; i < b.length; i++) {
    b[i] -= mean;
    peak = Math.max(peak, Math.abs(b[i]));
  }
  const target = Math.pow(10, -3 / 20);
  const g = peak > 0 ? target / peak : 0;
  const fi = Math.round(fadeIn * SR), fo = Math.round(fadeOut * SR);
  for (let i = 0; i < b.length; i++) {
    let e = 1;
    if (i < fi) e = i / fi;
    const fromEnd = b.length - 1 - i;
    if (fromEnd < fo) e *= fromEnd / fo;
    b[i] *= g * e;
  }
  return b;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const note = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

// ----------------------------------------------------------------- sounds --
const sounds = {
  // Signature: two rising "pop" chirps, the second higher and brighter.
  zynk_classic() {
    const b = buf(0.42);
    const pop = (start, f0, f1, dur, gain) => {
      const env = (t, d) => Math.min(1, t / 0.003) * expDecay(t, d * 0.35);
      const fn = (t) => f0 + (f1 - f0) * (1 - Math.exp(-t / 0.018));
      tone(b, start, dur, fn, { wave: 'tri', gain, env });
      tone(b, start, dur, (t) => fn(t) * 2, { wave: 'sine', gain: gain * 0.25, env });
    };
    pop(0.0, 520, 880, 0.16, 0.9);
    pop(0.13, 780, 1320, 0.28, 1.0);
    return finish(b);
  },

  zynk_boing() {
    const b = buf(0.6);
    const fn = (t) => {
      const base = 180 + 260 * (1 - Math.exp(-t / 0.05)) - 120 * (t / 0.6);
      const vib = 1 + 0.12 * Math.sin(TAU * 14 * t) * Math.exp(-t / 0.35);
      return base * vib;
    };
    tone(b, 0, 0.6, fn, {
      wave: 'sine',
      env: (t, d) => Math.min(1, t / 0.004) * expDecay(t, 0.22) * adsr(t, d, { a: 0.001, d: 0, s: 1, r: 0.06 }),
    });
    tone(b, 0, 0.6, (t) => fn(t) * 2.01, { wave: 'sine', gain: 0.18, env: (t) => expDecay(t, 0.12) });
    return finish(b);
  },

  zynk_laser() {
    const b = buf(0.38);
    const fn = (t) => 200 + 1800 * Math.exp(-t / 0.07);
    tone(b, 0, 0.38, fn, {
      wave: 'square', h: 5,
      env: (t, d) => Math.min(1, t / 0.002) * expDecay(t, 0.12) * adsr(t, d, { a: 0.001, d: 0, s: 1, r: 0.05 }),
    });
    tone(b, 0, 0.38, (t) => fn(t) * 1.5, { wave: 'saw', h: 4, gain: 0.3, env: (t) => expDecay(t, 0.08) });
    return finish(onePoleLP(b, 5000));
  },

  zynk_coin() {
    const b = buf(0.36);
    tone(b, 0, 0.075, constant(note(83)), { wave: 'square', h: 9, env: (t, d) => adsr(t, d, { a: 0.002, d: 0.02, s: 0.8, r: 0.005 }) });
    tone(b, 0.07, 0.29, constant(note(88)), {
      wave: 'square', h: 9,
      env: (t, d) => Math.min(1, t / 0.002) * expDecay(t, 0.12) * adsr(t, d, { a: 0.001, d: 0, s: 1, r: 0.03 }),
    });
    return finish(onePoleLP(b, 7000));
  },

  zynk_knock() {
    const b = buf(0.45);
    const knock = (start, seed, gain) => {
      const n = biquad(noise(0.08, seed), 'bp', constant(1400), 1.6);
      mixInto(b, n, start, gain * 0.9, (t) => Math.min(1, t / 0.001) * expDecay(t, 0.012));
      tone(b, start, 0.12, (t) => 90 + 120 * Math.exp(-t / 0.015), {
        wave: 'sine', gain: gain * 0.8, env: (t) => Math.min(1, t / 0.001) * expDecay(t, 0.03),
      });
    };
    knock(0.0, 11, 1.0);
    knock(0.17, 12, 0.85);
    return finish(onePoleLP(b, 6000));
  },

  zynk_chime() {
    const b = buf(0.8);
    const notes = [note(79), note(83), note(86), note(91)]; // G5 B5 D6 G6
    notes.forEach((f, i) => bell(b, i * 0.075, 0.8 - i * 0.075, f, { ratio: 3.01, index: 1.6, tau: 0.22, gain: 1 - i * 0.12 }));
    notes.forEach((f, i) => tone(b, i * 0.075, 0.6, constant(f * 2), { gain: 0.08, env: (t) => expDecay(t, 0.1) }));
    return finish(b, { fadeOut: 0.06 });
  },

  zynk_whoosh() {
    const d = 0.5;
    const n = noise(d, 23);
    const sweep = (t) => 300 * Math.pow(12, Math.sin(Math.PI * Math.min(1, t / d)));
    let b = biquad(n, 'bp', sweep, 1.2);
    b = biquad(b, 'lp', (t) => sweep(t) * 2.5);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] *= Math.pow(Math.sin(Math.PI * Math.min(1, t / d)), 1.6);
    }
    return finish(b, { fadeOut: 0.03 });
  },

  zynk_thunder() {
    const d = 0.9;
    const b = buf(d);
    // crack
    const crack = biquad(noise(0.12, 31), 'hp', constant(900));
    mixInto(b, crack, 0, 0.7, (t) => Math.min(1, t / 0.001) * expDecay(t, 0.025));
    // rumble: lowpassed noise with slow random amplitude wobble
    const rumbleN = biquad(biquad(noise(d, 37), 'lp', (t) => 500 * Math.exp(-t / 0.4) + 120), 'lp', constant(400));
    const wob = mulberry32(41);
    const knots = Array.from({ length: 20 }, () => 0.5 + wob() * 0.5);
    mixInto(b, rumbleN, 0.015, 3.2, (t) => {
      const k = (t / d) * (knots.length - 1);
      const j = Math.floor(k), f = k - j;
      const w = knots[j] * (1 - f) + (knots[j + 1] ?? knots[j]) * f;
      return Math.min(1, t / 0.03) * expDecay(t, 0.3) * w;
    });
    tone(b, 0.01, 0.6, (t) => 55 - 15 * t, { wave: 'sine', gain: 0.35, env: (t) => Math.min(1, t / 0.01) * expDecay(t, 0.18) });
    return finish(onePoleLP(b, 3500), { fadeOut: 0.12 });
  },

  zynk_bubble() {
    const b = buf(0.45);
    const blub = (start, f0, rise, dur, gain) =>
      tone(b, start, dur, (t) => f0 * (1 + rise * (t / dur) ** 1.5), {
        wave: 'sine', gain,
        env: (t, d) => Math.min(1, t / 0.004) * expDecay(t, d * 0.45),
      });
    blub(0.0, 300, 1.4, 0.09, 0.8);
    blub(0.11, 380, 1.5, 0.09, 0.8);
    blub(0.25, 520, 2.2, 0.14, 1.0); // pop
    tone(b, 0.25, 0.05, (t) => 1800 + 4000 * t, { wave: 'tri', gain: 0.15, env: (t) => expDecay(t, 0.01) });
    return finish(b);
  },
};

mkdirSync(OUT, { recursive: true });
console.log('ZYNK sounds →', OUT);
for (const [name, fn] of Object.entries(sounds)) {
  const data = wav(fn());
  writeFileSync(resolve(OUT, `${name}.wav`), data);
  console.log(`  sounds/${name}.wav  ${((data.length - 44) / 2 / SR * 1000).toFixed(0)} ms  ${(data.length / 1024).toFixed(1)} KB`);
}

writeFileSync(
  resolve(OUT, 'LICENSE.md'),
  `# ZYNK sounds — license

All \`.wav\` files in this directory are original works created for ZYNK.
They were synthesised procedurally (oscillators, FM, filtered seeded noise)
by \`tools/assets/generate-sounds.mjs\` in this repository.

No third-party samples, recordings, or sound libraries were used.
Regenerate them with \`npm run generate -w @zynk/assets-tools\`.

Copyright (c) ZYNK. All rights reserved.
`,
);
console.log('  sounds/LICENSE.md');
