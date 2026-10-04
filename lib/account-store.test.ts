import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as security from './account-security.ts';
import type * as Store from './account-store.ts';

// Exercise the exact store and SQL with an in-memory D1-shaped adapter. No real
// accounts, persistent files, network requests, or production database are used.
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const control = { rankingBatches: 0, failNextRankingBatch: false };
  class Prepared {
    readonly sql: string;
    readonly values: SQLInputValue[];
    constructor(sql: string, values: SQLInputValue[] = []) { this.sql = sql; this.values = values }
    bind(...values: SQLInputValue[]) { return new Prepared(this.sql, values) }
    async first() { return sqlite.prepare(this.sql).get(...this.values) ?? null }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.values) } }
    async run() { return { meta: sqlite.prepare(this.sql).run(...this.values) } }
  }
  const db = {
    prepare: (sql: string) => new Prepared(sql),
    batch: async (statements: Prepared[]) => {
      if (statements.some(statement => statement.sql.startsWith('INSERT OR IGNORE INTO account_match_results'))) {
        control.rankingBatches++;
        if (control.failNextRankingBatch) { control.failNextRankingBatch = false; throw new Error('temporary ranking write failure') }
      }
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  };
  const source = readFileSync(new URL('./account-store.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(js, {
    exports, crypto,
    require: (id: string) => {
      if (id === 'server-only') return {};
      if (id === 'cloudflare:workers') return { env: { DB: db } };
      if (id === './account-security') return security;
      throw new Error(`Unexpected store dependency: ${id}`);
    },
  });
  return { store: exports as typeof Store, sqlite, control };
}

test('account store rotates the current session, retains other devices, and never returns secrets', async () => {
  const { store, sqlite } = fixture();
  try {
    const registered = await store.authenticateAccount('register', '玩家Test', 'long password!', 'ip-one');
    assert.equal(registered.account.username, '玩家Test');
    assert.equal(registered.account.games, 0);
    assert.deepEqual(Object.keys(registered.account).sort(), ['id', 'username', 'points', 'wins', 'draws', 'losses', 'games', 'kills'].sort());
    const firstDevice = await store.authenticateAccount('login', '玩家test', 'long password!', 'ip-one', registered.token);
    assert.equal(await store.accountForSession(registered.token), null);
    const secondDevice = await store.authenticateAccount('login', '玩家TEST', 'long password!', 'ip-two');
    assert.equal((await store.accountForSession(firstDevice.token))?.id, registered.account.id);
    assert.equal((await store.accountForSession(secondDevice.token))?.id, registered.account.id);
    const row = sqlite.prepare('SELECT token_hash FROM account_sessions LIMIT 1').get();
    assert.ok(row?.token_hash);
    assert.notEqual(row?.token_hash, firstDevice.token);
    await store.revokeAccountSession(firstDevice.token);
    assert.equal(await store.accountForSession(firstDevice.token), null);
    assert.ok(await store.accountForSession(secondDevice.token));
    sqlite.prepare('UPDATE account_sessions SET expires_at=0').run();
    assert.equal(await store.accountForSession(secondDevice.token), null);
    assert.equal(await store.accountForSession('old-anonymous-cookie'), null);
  } finally { sqlite.close() }
});

test('account store duplicate names and invalid credentials cannot create or authenticate another user', async () => {
  const { store, sqlite } = fixture();
  try {
    await store.authenticateAccount('register', 'ＡＢＣ', 'long password!', 'ip-one');
    await assert.rejects(store.authenticateAccount('register', 'abc', 'another password', 'ip-two'), { message: '无法创建账号，请更换用户名或稍后再试' });
    const messages = [];
    for (const [name, password] of [['ABC', 'wrong password'], ['Nobody', 'wrong password']]) {
      try { await store.authenticateAccount('login', name, password, 'ip-three'); assert.fail('login must fail') }
      catch (error) { messages.push((error as Error).message) }
    }
    assert.deepEqual(messages, ['用户名或密码不正确', '用户名或密码不正确']);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM accounts').get()?.count, 1);
  } finally { sqlite.close() }
});

test('ranked results are persisted once and queried as win 3 / draw 1 / loss 0', async () => {
  const { store, sqlite } = fixture();
  try {
    const a = await store.authenticateAccount('register', 'Alice', 'long password!', 'ip-one');
    const b = await store.authenticateAccount('register', 'Bob', 'long password!', 'ip-two');
    const results = [{ accountId: a.account.id, outcome: 'win' as const, kills: 2, forfeit: false }, { accountId: b.account.id, outcome: 'loss' as const, kills: 0, forfeit: false }];
    await store.recordMatchResults('ROOM:unique-match', 1, results);
    await store.recordMatchResults('ROOM:unique-match', 1, results);
    await store.recordMatchResults('ROOM:unique-match', 2, results.map(r => ({ ...r, outcome: 'draw', kills: 0 })));
    const board = await store.accountLeaderboard();
    assert.equal(board[0].id, a.account.id);
    assert.equal(board[0].points, 4);
    assert.equal(board[0].games, 2);
    assert.equal(board[0].kills, 2);
    assert.equal(board[0].wins, 1);
    assert.equal(board[0].draws, 1);
    assert.equal(board[1].points, 1);
    assert.equal(board[1].losses, 1);
    assert.equal((await store.accountForSession(a.token))?.points, 4);
    await assert.rejects(store.recordMatchResults('ROOM', 3, [results[0], results[0]]), { message: '无效玩家战绩' });
  } finally { sqlite.close() }
});

test('failed writes roll back the entire match and rate windows atomically count attempts', async () => {
  const { store, sqlite } = fixture();
  try {
    const a = await store.authenticateAccount('register', 'Alice', 'long password!', 'ip-one');
    await assert.rejects(store.recordMatchResults('ROOM', 1, [{ accountId: a.account.id, outcome: 'win', kills: 1, forfeit: false }, { accountId: 'unknown-player', outcome: 'loss', kills: 0, forfeit: false }]));
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM account_match_results').get()?.count, 0);
    for (let index = 0; index < 30; index++) await assert.rejects(store.authenticateAccount('login', 'a', 'invalid', 'rate-ip'), error => (error as { status: number }).status === 401);
    await assert.rejects(store.authenticateAccount('login', 'a', 'invalid', 'rate-ip'), error => (error as { status: number }).status === 429);
    assert.equal(sqlite.prepare('SELECT MAX(attempts) AS attempts FROM account_rate_limits').get()?.attempts, 31);
    const rate = sqlite.prepare('SELECT key_hash FROM account_rate_limits LIMIT 1').get();
    assert.match(String(rate?.key_hash), /^[a-f0-9]{64}$/);
  } finally { sqlite.close() }
});

test('identical complete match results share concurrent writes and skip repeated polling batches', async () => {
  const { store, sqlite, control } = fixture();
  try {
    const a = await store.authenticateAccount('register', 'Alice', 'long password!', 'ip-one');
    const b = await store.authenticateAccount('register', 'Bob', 'long password!', 'ip-two');
    const results = [{ accountId: a.account.id, outcome: 'win' as const, kills: 2, forfeit: false }, { accountId: b.account.id, outcome: 'loss' as const, kills: 0, forfeit: false }];
    await Promise.all(Array.from({ length: 12 }, () => store.recordMatchResults('ROOM:cached-match', 1, results)));
    assert.equal(control.rankingBatches, 1);
    for (let index = 0; index < 6; index++) await store.recordMatchResults('ROOM:cached-match', 1, [...results].reverse());
    assert.equal(control.rankingBatches, 1, 'equivalent results in a different order still hit the cache');
    await store.recordMatchResults('ROOM:cached-match', 1, results.map(result => ({ ...result, kills: result.kills + 1 })));
    assert.equal(control.rankingBatches, 2, 'a changed complete result must reach the durable ledger');
    assert.equal((await store.accountForSession(a.token))?.games, 1);
    assert.equal((await store.accountForSession(a.token))?.kills, 2, 'the durable first result remains authoritative');
  } finally { sqlite.close() }
});

test('failed cached ranking writes are removed and the same result can be retried', async () => {
  const { store, sqlite, control } = fixture();
  try {
    const a = await store.authenticateAccount('register', 'Alice', 'long password!', 'ip-one');
    const results = [{ accountId: a.account.id, outcome: 'win' as const, kills: 1, forfeit: false }];
    control.failNextRankingBatch = true;
    const failed = await Promise.allSettled([store.recordMatchResults('ROOM:retry', 1, results), store.recordMatchResults('ROOM:retry', 1, results)]);
    assert.ok(failed.every(result => result.status === 'rejected'));
    assert.equal(control.rankingBatches, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM account_match_results').get()?.count, 0);
    await store.recordMatchResults('ROOM:retry', 1, results);
    await store.recordMatchResults('ROOM:retry', 1, results);
    assert.equal(control.rankingBatches, 2);
    assert.equal((await store.accountForSession(a.token))?.points, 3);
  } finally { sqlite.close() }
});

test('ranking cache is bounded and evicted results remain safe to persist again', async () => {
  const { store, sqlite, control } = fixture();
  try {
    const a = await store.authenticateAccount('register', 'Alice', 'long password!', 'ip-one');
    const results = [{ accountId: a.account.id, outcome: 'draw' as const, kills: 0, forfeit: false }];
    for (let match = 1; match <= 257; match++) await store.recordMatchResults('ROOM:bounded', match, results);
    assert.equal(control.rankingBatches, 257);
    await store.recordMatchResults('ROOM:bounded', 257, results);
    assert.equal(control.rankingBatches, 257);
    await store.recordMatchResults('ROOM:bounded', 1, results);
    assert.equal(control.rankingBatches, 258, 'the oldest entry was evicted after the 256-entry limit');
    assert.equal((await store.accountForSession(a.token))?.games, 257);
    assert.equal((await store.accountForSession(a.token))?.points, 257);
  } finally { sqlite.close() }
});
