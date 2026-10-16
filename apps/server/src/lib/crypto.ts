import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

// OWASP-recommended scrypt parameters (N=2^17 is ideal; 2^15 keeps login < 100ms on small instances).
const PARAMS = { N: 32768, r: 8, p: 1 };
const KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { ...PARAMS, maxmem: 128 * PARAMS.N * PARAMS.r * 2 });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !saltB64 || !keyB64) return false;
  const N = Number(n), R = Number(r), P = Number(p);
  const expected = Buffer.from(keyB64, 'base64url');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64url'), expected.length, {
    N, r: R, p: P, maxmem: 128 * N * R * 2,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A pre-computed hash used to keep login timing uniform for unknown usernames. */
let dummyHash: Promise<string> | undefined;
export const getDummyHash = () => (dummyHash ??= hashPassword('zynk-dummy-password'));

export function newSessionToken(): string {
  return `zk_${randomBytes(32).toString('base64url')}`;
}

export function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function safeEqual(a: string, b: string): boolean {
  const ab = sha256(a);
  const bb = sha256(b);
  return timingSafeEqual(ab, bb);
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function newInviteCode(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const b of bytes) out += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
  return out;
}
