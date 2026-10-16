/**
 * Speow! avatar characters: pure vector data on a 100x100 viewBox.
 *
 * The renderer draws `<circle cx=50 cy=50 r=50 fill={bg}>` first, clips
 * everything to that circle, then draws these shapes in order. Shapes use
 * color roles instead of literal colors:
 *   body  -> #FFFFFF  main character fill
 *   ink   -> #111111  outlines, eyes, mouths
 *   blush -> #FF6AD5  cheeks / small accents
 *   bg    -> the avatar's background color (cut-outs, inner ears)
 * Attribute names are camelCase (react-native-svg style); convert to
 * kebab-case for plain SVG.
 */

export type AvatarRole = 'body' | 'ink' | 'blush' | 'bg';

export interface AvatarShape {
  kind: 'path' | 'circle' | 'ellipse' | 'rect';
  /** SVG attributes as numbers/strings: d, cx, cy, r, rx, ry, x, y, width, height, transform, strokeWidth, opacity, strokeLinecap, strokeLinejoin */
  attrs: Record<string, string | number>;
  fill?: AvatarRole | 'none';
  stroke?: AvatarRole;
}

export const AVATAR_ART_IDS = [
  'cat',
  'alien',
  'robot',
  'ghost',
  'frog',
  'bear',
  'bunny',
  'blob',
  'dino',
  'owl',
  'fox',
  'monster',
] as const;

export type AvatarArtId = (typeof AVATAR_ART_IDS)[number];

const SW = 4.5;
const ROUND = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** A body-colored shape with the standard ink outline. */
function outlined(kind: AvatarShape['kind'], attrs: AvatarShape['attrs']): AvatarShape {
  return { kind, attrs: { ...attrs, strokeWidth: SW, ...ROUND }, fill: 'body', stroke: 'ink' };
}

/** An open ink stroke (mouths, brows). */
function line(d: string, width: number = SW): AvatarShape {
  return { kind: 'path', attrs: { d, strokeWidth: width, ...ROUND }, fill: 'none', stroke: 'ink' };
}

function fill(kind: AvatarShape['kind'], attrs: AvatarShape['attrs'], role: AvatarRole): AvatarShape {
  return { kind, attrs, fill: role };
}

/** Solid ink pupil with a white catch-light. */
function eye(cx: number, cy: number, r: number): AvatarShape[] {
  return [
    fill('circle', { cx, cy, r }, 'ink'),
    fill('circle', { cx: cx + r * 0.32, cy: cy - r * 0.36, r: Math.max(1.6, r * 0.34) }, 'body'),
  ];
}

function cheeks(y: number, dx: number, rx = 5, ry = 3.4): AvatarShape[] {
  return [
    fill('ellipse', { cx: 50 - dx, cy: y, rx, ry, opacity: 0.9 }, 'blush'),
    fill('ellipse', { cx: 50 + dx, cy: y, rx, ry, opacity: 0.9 }, 'blush'),
  ];
}

/** Shoulders peeking in from the bottom edge (clipped by the circle). */
function shoulders(top: number, halfWidth = 36): AvatarShape {
  const l = 50 - halfWidth;
  const r = 50 + halfWidth;
  return outlined('path', {
    d: `M${l - 6} 112 C${l - 4} ${top + 8} ${l + 12} ${top} 50 ${top} C${r - 12} ${top} ${r + 4} ${top + 8} ${r + 6} 112 Z`,
  });
}

const cat: AvatarShape[] = [
  shoulders(84),
  outlined('path', {
    d: 'M20 60 C20 47 23 40 27 35 L24 13 L43 26 C47.5 25 52.5 25 57 26 L76 13 L73 35 C77 40 80 47 80 60 C80 78 67 89 50 89 C33 89 20 78 20 60 Z',
  }),
  fill('path', { d: 'M29.5 31 L28 20 L37.5 27 Z', ...ROUND, strokeWidth: 2 }, 'blush'),
  fill('path', { d: 'M70.5 31 L72 20 L62.5 27 Z', ...ROUND, strokeWidth: 2 }, 'blush'),
  ...eye(37, 56, 5.5),
  ...eye(63, 56, 5.5),
  fill('path', { d: 'M46.5 64.5 H53.5 L50 68.5 Z', ...ROUND }, 'ink'),
  line('M42 70 Q46 75 50 70 Q54 75 58 70', 4),
  ...cheeks(68, 22, 4.5, 3),
];

const alien: AvatarShape[] = [
  shoulders(86, 26),
  line('M40 26 L33 11'),
  line('M60 26 L67 11'),
  outlined('circle', { cx: 32, cy: 10, r: 5.5 }),
  outlined('circle', { cx: 68, cy: 10, r: 5.5 }),
  outlined('path', {
    d: 'M50 22 C71 22 84 36 84 52 C84 71 64 89 50 89 C36 89 16 71 16 52 C16 36 29 22 50 22 Z',
  }),
  fill('ellipse', { cx: 35, cy: 54, rx: 11, ry: 7, transform: 'rotate(32 35 54)' }, 'ink'),
  fill('ellipse', { cx: 65, cy: 54, rx: 11, ry: 7, transform: 'rotate(-32 65 54)' }, 'ink'),
  fill('ellipse', { cx: 37, cy: 50.5, rx: 3, ry: 2.2, transform: 'rotate(32 37 50.5)' }, 'body'),
  fill('ellipse', { cx: 67, cy: 50.5, rx: 3, ry: 2.2, transform: 'rotate(-32 67 50.5)' }, 'body'),
  line('M44 74 Q50 78 56 74', 4),
];

const robot: AvatarShape[] = [
  shoulders(88, 28),
  outlined('rect', { x: 43, y: 80, width: 14, height: 12, rx: 3 }),
  line('M50 30 V17'),
  fill('circle', { cx: 50, cy: 13, r: 6, strokeWidth: SW }, 'blush'),
  { kind: 'circle', attrs: { cx: 50, cy: 13, r: 6, strokeWidth: SW }, fill: 'none', stroke: 'ink' },
  outlined('rect', { x: 10, y: 46, width: 10, height: 18, rx: 4 }),
  outlined('rect', { x: 80, y: 46, width: 10, height: 18, rx: 4 }),
  outlined('rect', { x: 17, y: 29, width: 66, height: 53, rx: 13 }),
  fill('rect', { x: 26, y: 39, width: 48, height: 24, rx: 9 }, 'ink'),
  fill('rect', { x: 33, y: 45, width: 10, height: 12, rx: 3 }, 'body'),
  fill('rect', { x: 57, y: 45, width: 10, height: 12, rx: 3 }, 'body'),
  line('M40 72 H60', 4.5),
  line('M45 69.5 V74.5 M50 69.5 V74.5 M55 69.5 V74.5', 3),
];

const ghost: AvatarShape[] = [
  outlined('ellipse', { cx: 20, cy: 60, rx: 9, ry: 5.5, transform: 'rotate(-30 20 60)' }),
  outlined('ellipse', { cx: 79, cy: 54, rx: 9, ry: 5.5, transform: 'rotate(20 79 54)' }),
  outlined('path', {
    d: 'M21 52 C21 31 34 17 50 17 C66 17 79 31 79 52 V80 A7.25 7.25 0 0 1 64.5 80 A7.25 7.25 0 0 1 50 80 A7.25 7.25 0 0 1 35.5 80 A7.25 7.25 0 0 1 21 80 Z',
    transform: 'rotate(-6 50 50)',
  }),
  fill('ellipse', { cx: 39, cy: 48, rx: 5, ry: 7 }, 'ink'),
  fill('ellipse', { cx: 59, cy: 46, rx: 5, ry: 7 }, 'ink'),
  fill('circle', { cx: 40.6, cy: 45.5, r: 1.8 }, 'body'),
  fill('circle', { cx: 60.6, cy: 43.5, r: 1.8 }, 'body'),
  fill('ellipse', { cx: 50.5, cy: 61, rx: 4.5, ry: 5.5 }, 'ink'),
  fill('ellipse', { cx: 31, cy: 59, rx: 4.5, ry: 3, opacity: 0.9 }, 'blush'),
  fill('ellipse', { cx: 69, cy: 56, rx: 4.5, ry: 3, opacity: 0.9 }, 'blush'),
];

const frog: AvatarShape[] = [
  shoulders(86, 30),
  outlined('path', {
    d: 'M19.9 41 A14 14 0 1 1 44.1 41 Q50 44 55.9 41 A14 14 0 1 1 80.1 41 C84 46 86 54 86 62 C86 80 70 90 50 90 C30 90 14 80 14 62 C14 54 16 46 19.9 41 Z',
  }),
  ...eye(32, 34, 6.5),
  ...eye(68, 34, 6.5),
  line('M28 64 Q50 80 72 64'),
  ...cheeks(66, 27, 5, 3.4),
];

const bear: AvatarShape[] = [
  shoulders(86),
  outlined('circle', { cx: 25, cy: 30, r: 11 }),
  outlined('circle', { cx: 75, cy: 30, r: 11 }),
  fill('circle', { cx: 25, cy: 30, r: 5 }, 'blush'),
  fill('circle', { cx: 75, cy: 30, r: 5 }, 'blush'),
  outlined('circle', { cx: 50, cy: 56, r: 32 }),
  outlined('ellipse', { cx: 50, cy: 67, rx: 13, ry: 10 }),
  fill('ellipse', { cx: 50, cy: 62.5, rx: 5.5, ry: 4 }, 'ink'),
  line('M50 65 V69 M44.5 69.5 Q50 74 55.5 69.5', 3.5),
  ...eye(37, 51, 5),
  ...eye(63, 51, 5),
];

const bunny: AvatarShape[] = [
  shoulders(88, 26),
  outlined('ellipse', { cx: 36, cy: 30, rx: 9.5, ry: 22, transform: 'rotate(-10 36 30)' }),
  outlined('ellipse', { cx: 64, cy: 30, rx: 9.5, ry: 22, transform: 'rotate(10 64 30)' }),
  fill('ellipse', { cx: 36, cy: 30, rx: 4, ry: 14, transform: 'rotate(-10 36 30)' }, 'blush'),
  fill('ellipse', { cx: 64, cy: 30, rx: 4, ry: 14, transform: 'rotate(10 64 30)' }, 'blush'),
  outlined('ellipse', { cx: 50, cy: 66, rx: 28, ry: 24 }),
  ...eye(39, 63, 5),
  ...eye(61, 63, 5),
  fill('ellipse', { cx: 50, cy: 71, rx: 3.5, ry: 2.6 }, 'blush'),
  line('M45 75 Q47.5 78 50 75 Q52.5 78 55 75', 3.5),
  ...cheeks(72, 18, 4, 2.8),
];

const blob: AvatarShape[] = [
  outlined('path', {
    d: 'M50 14 C53 23 60 28 67 31 C78 36 84 47 84 59 V74 C84 79 77 79 76 75 C75 72 72 72 71 76 V83 C71 89 63 89 63 83 V80 C63 77 59 76 56 78 C52 80 46 80 42 78 C38 76 35 77 35 80 V86 C35 92 27 92 27 86 V78 C27 75 24 74 22 76 C19 79 16 77 16 73 V59 C16 47 22 36 33 31 C40 28 47 23 50 14 Z',
  }),
  line('M30 50 Q35.5 44 41 50', 4.5),
  line('M59 50 Q64.5 44 70 50', 4.5),
  { kind: 'path', attrs: { d: 'M39 57 H61 C61 66 56 71 50 71 C44 71 39 66 39 57 Z', strokeWidth: 3.5, ...ROUND }, fill: 'ink', stroke: 'ink' },
  fill('path', { d: 'M43.5 66.8 C45.5 63.5 54.5 63.5 56.5 66.8 C53.5 69.6 46.5 69.6 43.5 66.8 Z' }, 'blush'),
  ...cheeks(58, 24, 4.5, 3),
];

const dino: AvatarShape[] = [
  shoulders(86),
  outlined('path', { d: 'M31 36 C27 28 29 20 36 18 C40 22 42 27 42 32 Z' }),
  outlined('path', { d: 'M43 30 C41 20 45 11 51 9 C56 13 58 21 56 30 Z' }),
  outlined('path', { d: 'M58 32 C58 26 61 21 66 19 C72 22 72 30 69 36 Z' }),
  outlined('path', {
    d: 'M50 27 C66 27 76 38 78 52 C79 60 84 66 84 74 C84 85 70 90 50 90 C30 90 16 85 16 74 C16 66 21 60 22 52 C24 38 34 27 50 27 Z',
  }),
  ...eye(37, 49, 5.5),
  ...eye(63, 49, 5.5),
  fill('ellipse', { cx: 45, cy: 62, rx: 2.4, ry: 1.8 }, 'ink'),
  fill('ellipse', { cx: 55, cy: 62, rx: 2.4, ry: 1.8 }, 'ink'),
  { kind: 'path', attrs: { d: 'M27 70 Q50 88 73 70 Z', strokeWidth: 4, ...ROUND }, fill: 'ink', stroke: 'ink' },
  fill('path', { d: 'M33 72.2 L37 78 L41 74.9 Z' }, 'body'),
  fill('path', { d: 'M67 72.2 L63 78 L59 74.9 Z' }, 'body'),
  ...cheeks(60, 24, 4.5, 3),
];

const owl: AvatarShape[] = [
  outlined('path', { d: 'M15 72 C10 80 12 92 20 98 C24 90 26 82 26 74 Z' }),
  outlined('path', { d: 'M85 72 C90 80 88 92 80 98 C76 90 74 82 74 74 Z' }),
  outlined('path', {
    d: 'M24 34 C21 29 17 26 13 24 C17 18 26 18 32 25 C38 22.5 44 22 50 22 C56 22 62 22.5 68 25 C74 18 83 18 87 24 C83 26 79 29 76 34 C82 42 84 52 84 64 C84 86 69 100 50 100 C31 100 16 86 16 64 C16 52 18 42 24 34 Z',
  }),
  line('M22 41 C30 36 42 37 50 45 C58 37 70 36 78 41', 4),
  outlined('circle', { cx: 35, cy: 53, r: 12.5 }),
  outlined('circle', { cx: 65, cy: 53, r: 12.5 }),
  ...eye(35, 54, 6.5),
  ...eye(65, 54, 6.5),
  { kind: 'path', attrs: { d: 'M45.5 63 H54.5 L50 71 Z', strokeWidth: 3, ...ROUND }, fill: 'blush', stroke: 'ink' },
  line('M38 82 L42 86 L46 82 M54 82 L58 86 L62 82', 3.5),
];

const fox: AvatarShape[] = [
  shoulders(86),
  outlined('path', {
    d: 'M50 88 C44 88 37 83 31 77 L12 68 L21 62 C16 54 17 46 21 40 L17 10 L41 28 C47 27 53 27 59 28 L83 10 L79 40 C83 46 84 54 79 62 L88 68 L69 77 C63 83 56 88 50 88 Z',
  }),
  fill('path', { d: 'M24 34 L22 19 L35 28 Z', ...ROUND, strokeWidth: 2 }, 'ink'),
  fill('path', { d: 'M76 34 L78 19 L65 28 Z', ...ROUND, strokeWidth: 2 }, 'ink'),
  line('M24 60 C32 60 40 62 44 68 M76 60 C68 60 60 62 56 68', 3.5),
  ...eye(36, 51, 5.5),
  ...eye(64, 51, 5.5),
  fill('ellipse', { cx: 50, cy: 75, rx: 6.5, ry: 4.8 }, 'ink'),
  fill('circle', { cx: 51.8, cy: 73.6, r: 1.7 }, 'body'),
  line('M45 82 Q50 85 55 82', 3.5),
];

const monster: AvatarShape[] = [
  outlined('path', { d: 'M29 31 C21 26 19 17 22 10 C29 14 35 20 40 25 Z' }),
  outlined('path', { d: 'M71 31 C79 26 81 17 78 10 C71 14 65 20 60 25 Z' }),
  outlined('path', { d: 'M15 110 V52 C15 32 30 21 50 21 C70 21 85 32 85 52 V110 Z' }),
  outlined('circle', { cx: 50, cy: 48, r: 15 }),
  ...eye(50, 49, 8),
  { kind: 'path', attrs: { d: 'M27 67 C33 86 67 86 73 67 Z', strokeWidth: 4, ...ROUND }, fill: 'ink', stroke: 'ink' },
  fill('path', { d: 'M33 68 L37.5 75.5 L42 68 Z', ...ROUND }, 'body'),
  fill('path', { d: 'M58 68 L62.5 75.5 L67 68 Z', ...ROUND }, 'body'),
  fill('ellipse', { cx: 50, cy: 79, rx: 7, ry: 3 }, 'blush'),
];

export const AVATAR_ART: Record<AvatarArtId, readonly AvatarShape[]> = {
  cat,
  alien,
  robot,
  ghost,
  frog,
  bear,
  bunny,
  blob,
  dino,
  owl,
  fox,
  monster,
};
