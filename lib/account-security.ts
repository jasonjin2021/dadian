// The Workers production PBKDF2 cap is 100,000 iterations per deriveBits call.
// Keep this version explicit so stored credentials can be upgraded later.
export const PASSWORD_ITERATIONS = 100_000;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

export interface AccountCredentials { username: string; normalized: string; password: string }
export interface PasswordDigest { salt: string; hash: string; iterations: number }

export function accountCredentials(username: unknown, password: unknown): AccountCredentials {
  if (typeof username !== 'string' || typeof password !== 'string') throw new Error('请输入用户名和密码');
  const display = username.normalize('NFKC').trim();
  if (!/^[\p{Script=Han}A-Za-z0-9_]{3,20}$/u.test(display)) throw new Error('用户名需要 3–20 个汉字、字母、数字或下划线');
  // A password is never normalized or trimmed: spaces may be intentional.
  if (password.length < 8 || password.length > 128) throw new Error('密码需要 8–128 个字符');
  return { username: display, normalized: display.toLowerCase(), password };
}

export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

function toHex(bytes: Uint8Array): string { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') }
function fromHex(value: string): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index++) output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return output;
}

export async function hashSessionToken(token: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));
}

async function derivePassword(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations }, key, 256)));
}

export async function hashPassword(password: string): Promise<PasswordDigest> {
  const salt = randomToken(16);
  return { salt, hash: await derivePassword(password, salt, PASSWORD_ITERATIONS), iterations: PASSWORD_ITERATIONS };
}

// Both inputs are fixed-length derived digests. Do not exit at the first mismatch.
export function constantTimeDigestEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  let difference = 0;
  for (let index = 0; index < 64; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyPassword(password: string, digest: PasswordDigest): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(digest.salt) || !/^[a-f0-9]{64}$/.test(digest.hash) || digest.iterations !== PASSWORD_ITERATIONS) return false;
  return constantTimeDigestEqual(await derivePassword(password, digest.salt, digest.iterations), digest.hash);
}

export const DUMMY_PASSWORD_DIGEST: PasswordDigest = {
  salt: 'bd2c7e8089a042a65b521e019831d513',
  hash: 'cc4e4102c4ded7e1d9b995d8153436578b602f53c7d227e30a3fa2179f548da5',
  iterations: PASSWORD_ITERATIONS,
};

export function sessionTokenIsValid(token: unknown): token is string { return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) }

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}
