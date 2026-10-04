import 'server-only';
import { env } from 'cloudflare:workers';
import { accountCredentials, DUMMY_PASSWORD_DIGEST, hashPassword, hashSessionToken, randomToken, SESSION_MAX_AGE_SECONDS, sessionTokenIsValid, verifyPassword } from './account-security';

export interface PublicAccount { id: string; username: string; points: number; wins: number; draws: number; losses: number; games: number; kills: number }
export interface MatchAccountResult { accountId: string; outcome: 'win' | 'draw' | 'loss'; kills: number; forfeit: boolean }
export class AccountError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'AccountError'; this.status = status }
}
let schemaReady: Promise<void> | null = null;
const MATCH_RESULT_CACHE_LIMIT = 256;
const matchResultCache = new Map<string, Promise<void>>();
function db() { if (!env.DB) throw new Error('账号数据库暂不可用'); return env.DB }

export function ensureAccountSchema(): Promise<void> {
  schemaReady ??= (async () => {
    const d = db();
    await d.batch([
      d.prepare(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL, username_normalized TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, password_iterations INTEGER NOT NULL, created_at INTEGER NOT NULL)`),
      d.prepare(`CREATE TABLE IF NOT EXISTS account_sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`),
      d.prepare(`CREATE INDEX IF NOT EXISTS idx_account_sessions_expiry ON account_sessions(expires_at)`),
      d.prepare(`CREATE TABLE IF NOT EXISTS account_match_results (room_code TEXT NOT NULL, match_number INTEGER NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), outcome TEXT NOT NULL CHECK (outcome IN ('win','draw','loss')), kills INTEGER NOT NULL CHECK (kills >= 0), forfeit INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, PRIMARY KEY (room_code, match_number, account_id))`),
      d.prepare(`CREATE INDEX IF NOT EXISTS idx_account_results_player ON account_match_results(account_id)`),
      d.prepare(`CREATE TABLE IF NOT EXISTS account_rate_limits (key_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)`),
      d.prepare(`CREATE INDEX IF NOT EXISTS idx_account_rate_expiry ON account_rate_limits(expires_at)`),
    ]);
  })().catch(error => { schemaReady = null; throw error });
  return schemaReady;
}

const statsSelection = `a.id, a.username,
  COALESCE(SUM(CASE r.outcome WHEN 'win' THEN 3 WHEN 'draw' THEN 1 ELSE 0 END), 0) AS points,
  COALESCE(SUM(CASE WHEN r.outcome='win' THEN 1 ELSE 0 END), 0) AS wins,
  COALESCE(SUM(CASE WHEN r.outcome='draw' THEN 1 ELSE 0 END), 0) AS draws,
  COALESCE(SUM(CASE WHEN r.outcome='loss' THEN 1 ELSE 0 END), 0) AS losses,
  COUNT(r.account_id) AS games, COALESCE(SUM(r.kills), 0) AS kills`;

function publicAccount(row: Record<string, unknown>): PublicAccount {
  return { id: String(row.id), username: String(row.username), points: Number(row.points), wins: Number(row.wins), draws: Number(row.draws), losses: Number(row.losses), games: Number(row.games), kills: Number(row.kills) };
}

async function accountById(id: string): Promise<PublicAccount | null> {
  const row = await db().prepare(`SELECT ${statsSelection} FROM accounts a LEFT JOIN account_match_results r ON r.account_id=a.id WHERE a.id=? GROUP BY a.id`).bind(id).first<Record<string, unknown>>();
  return row ? publicAccount(row) : null;
}

export async function accountForSession(rawSid: string | undefined | null): Promise<PublicAccount | null> {
  if (!sessionTokenIsValid(rawSid)) return null;
  await ensureAccountSchema();
  const session = await db().prepare('SELECT account_id FROM account_sessions WHERE token_hash=? AND expires_at>?').bind(await hashSessionToken(rawSid), Date.now()).first<{ account_id: string }>();
  return session ? accountById(session.account_id) : null;
}

export async function accountLeaderboard(): Promise<PublicAccount[]> {
  await ensureAccountSchema();
  const rows = await db().prepare(`SELECT ${statsSelection} FROM accounts a LEFT JOIN account_match_results r ON r.account_id=a.id GROUP BY a.id ORDER BY points DESC, wins DESC, (1.0 * (SUM(CASE WHEN r.outcome='win' THEN 1 WHEN r.outcome='loss' THEN -1 ELSE 0 END)) / MAX(COUNT(r.account_id), 1)) DESC, a.id ASC LIMIT 50`).all<Record<string, unknown>>();
  return rows.results.map(publicAccount);
}

async function takeRateLimit(scope: string, identity: string, limit: number, durationMs: number): Promise<void> {
  const now = Date.now(), windowStart = Math.floor(now / durationMs) * durationMs;
  const key = await hashSessionToken(`${scope}:${identity}:${windowStart}`);
  const row = await db().prepare(`INSERT INTO account_rate_limits (key_hash, attempts, expires_at) VALUES (?,1,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(key, windowStart + durationMs).first<{ attempts: number }>();
  if (!row || row.attempts > limit) throw new AccountError('尝试次数太多，请稍后再试', 429);
}

export async function authenticateAccount(command: 'register' | 'login', username: unknown, password: unknown, clientIp: string, oldSid?: string): Promise<{ account: PublicAccount; token: string }> {
  await ensureAccountSchema();
  // Count malformed requests too; rate checks precede expensive password derivation.
  // A six-person party may share one home/school network and public address.
  await takeRateLimit(command, clientIp.slice(0, 100) || 'unknown', command === 'register' ? 10 : 30, command === 'register' ? 3_600_000 : 900_000);
  let credentials;
  try { credentials = accountCredentials(username, password) } catch (error) {
    if (command === 'login') throw new AccountError('用户名或密码不正确', 401);
    throw new AccountError(error instanceof Error ? error.message : '请输入有效用户名和密码');
  }
  if (command === 'login') await takeRateLimit('login-name', credentials.normalized, 10, 900_000);
  const now = Date.now();
  await db().batch([
    db().prepare('DELETE FROM account_sessions WHERE expires_at<=?').bind(now),
    db().prepare('DELETE FROM account_rate_limits WHERE expires_at<=?').bind(now),
  ]);
  let id: string;
  if (command === 'register') {
    const digest = await hashPassword(credentials.password);
    id = crypto.randomUUID();
    const result = await db().prepare(`INSERT OR IGNORE INTO accounts (id,username,username_normalized,password_salt,password_hash,password_iterations,created_at) VALUES (?,?,?,?,?,?,?)`).bind(id, credentials.username, credentials.normalized, digest.salt, digest.hash, digest.iterations, now).run();
    if (!Number(result.meta.changes)) throw new AccountError('无法创建账号，请更换用户名或稍后再试', 400);
  } else {
    const row = await db().prepare('SELECT id,password_salt,password_hash,password_iterations FROM accounts WHERE username_normalized=?').bind(credentials.normalized).first<{ id: string; password_salt: string; password_hash: string; password_iterations: number }>();
    // Unknown names still pay the same KDF cost and produce the same login error.
    const valid = await verifyPassword(credentials.password, row ? { salt: row.password_salt, hash: row.password_hash, iterations: row.password_iterations } : DUMMY_PASSWORD_DIGEST);
    if (!row || !valid) throw new AccountError('用户名或密码不正确', 401);
    id = row.id;
  }
  const token = randomToken();
  const statements = [db().prepare('INSERT INTO account_sessions (token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)').bind(await hashSessionToken(token), id, now, now + SESSION_MAX_AGE_SECONDS * 1000)];
  if (sessionTokenIsValid(oldSid)) statements.push(db().prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await hashSessionToken(oldSid)));
  await db().batch(statements);
  const account = await accountById(id);
  if (!account) throw new Error('创建会话失败');
  return { account, token };
}

export async function revokeAccountSession(rawSid: string | undefined): Promise<void> {
  if (!sessionTokenIsValid(rawSid)) return;
  await ensureAccountSchema();
  await db().prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await hashSessionToken(rawSid)).run();
}

export async function recordMatchResults(roomCode: string, matchNumber: number, results: MatchAccountResult[]): Promise<void> {
  if (!roomCode || !Number.isSafeInteger(matchNumber) || matchNumber < 1 || results.length > 6) throw new Error('无效对局结果');
  if (!results.length) return;
  const ids = new Set<string>();
  for (const result of results) {
    if (!result.accountId || ids.has(result.accountId) || !['win', 'draw', 'loss'].includes(result.outcome) || !Number.isSafeInteger(result.kills) || result.kills < 0) throw new Error('无效玩家战绩');
    ids.add(result.accountId);
  }
  // Snapshot the complete result before awaiting, so caller mutations cannot
  // disagree with the cache key. Seat/result ordering does not change a match.
  const snapshot = results.map(result => ({ accountId: result.accountId, outcome: result.outcome, kills: result.kills, forfeit: result.forfeit }))
    .sort((left, right) => left.accountId < right.accountId ? -1 : left.accountId > right.accountId ? 1 : 0);
  const key = JSON.stringify([roomCode, matchNumber, snapshot]);
  const cached = matchResultCache.get(key);
  if (cached) {
    matchResultCache.delete(key);
    matchResultCache.set(key, cached);
    return cached;
  }
  const write = (async () => {
    await ensureAccountSchema();
    const now = Date.now();
    // The durable primary key remains authoritative across isolates/restarts and
    // cache eviction. One D1 transaction commits every player's result together.
    await db().batch(snapshot.map(result => db().prepare(`INSERT OR IGNORE INTO account_match_results (room_code,match_number,account_id,outcome,kills,forfeit,created_at) VALUES (?,?,?,?,?,?,?)`).bind(roomCode, matchNumber, result.accountId, result.forfeit ? 'loss' : result.outcome, result.kills, result.forfeit ? 1 : 0, now)));
  })().catch(error => {
    if (matchResultCache.get(key) === write) matchResultCache.delete(key);
    throw error;
  });
  // Share pending writes too: simultaneous room polling should not each insert
  // the same six rows. Successful promises stay in this small LRU cache.
  matchResultCache.set(key, write);
  while (matchResultCache.size > MATCH_RESULT_CACHE_LIMIT) matchResultCache.delete(matchResultCache.keys().next().value!);
  return write;
}
