import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as security from './account-security.ts';
import * as game from './game.ts';
import * as phaseClock from './phase-clock.ts';
import type * as Accounts from './account-store.ts';
import type * as Rooms from './room-store.ts';

function fixture(clock?: { now: number; queryMs: number }) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const activity = { accountReads: 0, queries: [] as string[] };
  function query(sql: string) { activity.queries.push(sql); if (clock) clock.now += clock.queryMs }
  class FixtureDate extends Date { static now() { return clock?.now ?? Date.now() } }
  class Prepared {
    sql: string;
    values: SQLInputValue[];
    constructor(sql: string, values: SQLInputValue[] = []) { this.sql = sql; this.values = values }
    bind(...values: SQLInputValue[]) { return new Prepared(this.sql, values) }
    async first() { query(this.sql); return sqlite.prepare(this.sql).get(...this.values) ?? null }
    async all() { query(this.sql); return { results: sqlite.prepare(this.sql).all(...this.values) } }
    syncRun() { return { meta: sqlite.prepare(this.sql).run(...this.values) } }
    async run() { query(this.sql); return this.syncRun() }
  }
  const db = {
    prepare: (sql: string) => new Prepared(sql),
    // A D1 batch is one atomic transaction: do not yield midway in this adapter.
    batch: async (statements: Prepared[]) => {
      query('BATCH');
      sqlite.exec('BEGIN');
      try { const results = statements.map(statement => statement.syncRun()); sqlite.exec('COMMIT'); return results }
      catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  };
  function load<T>(filename: string, dependencies: Record<string, unknown>): T {
    const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    runInNewContext(js, { exports, crypto, Date: FixtureDate, require: (id: string) => {
      if (id === 'server-only') return {};
      if (id === 'cloudflare:workers') return { env: { DB: db } };
      if (id in dependencies) return dependencies[id];
      throw new Error(`Unexpected dependency: ${id}`);
    } });
    return exports as T;
  }
  const accounts = load<typeof Accounts>('./account-store.ts', { './account-security': security });
  const rankingSnapshots: game.GameState[] = [];
  const rooms = load<typeof Rooms>('./room-store.ts', { './account-store': {
    ...accounts,
    accountForSession: async (...args: Parameters<typeof Accounts.accountForSession>) => { activity.accountReads++; return accounts.accountForSession(...args) },
    recordMatchResults: async (...args: Parameters<typeof Accounts.recordMatchResults>) => {
      const row = sqlite.prepare('SELECT state_json FROM rooms WHERE code=?').get(args[0].split(':')[0]);
      if (row) rankingSnapshots.push(JSON.parse(String(row.state_json)) as game.GameState);
      await accounts.recordMatchResults(...args);
    },
  }, './game': game, './phase-clock': phaseClock });
  function apiForSession(sid: string) {
    return load<{ GET(request: Request, context: { params: Promise<{ code: string }> }): Promise<Response>; POST(request: Request, context: { params: Promise<{ code: string }> }): Promise<Response> }>('../app/api/rooms/[code]/route.ts', {
      'next/headers': { cookies: async () => ({ get: () => ({ value: sid }) }) },
      'next/server': { NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) } },
      '@/lib/game': game,
      '@/lib/room-store': rooms,
      '@/lib/account-security': security,
      '@/lib/phase-clock': phaseClock,
    });
  }
  async function users(count: number) {
    const results = [];
    for (let index = 0; index < count; index++) results.push(await accounts.authenticateAccount('register', `Player${index + 1}`, 'room test password', `ip-${index}`));
    return results;
  }
  async function finish(code: string, winnerId: string) {
    await rooms.mutateRoom(code, room => {
      room.game.phase = 'finished'; room.game.deadline = null; room.game.winnerIds = [winnerId];
      for (const player of room.game.players) { player.alive = player.id === winnerId; player.hp = player.alive ? 5 : 0; player.kills = player.alive ? room.game.players.length - 1 : 0 }
    });
  }
  return { sqlite, accounts, rooms, users, finish, rankingSnapshots, activity, apiForSession };
}

test('room membership supports two through six players, a seventh spectator, and cross-device seat/host recovery', async () => {
  const { sqlite, accounts, rooms, users } = fixture();
  try {
    const people = await users(7), { code } = await rooms.createRoom(people[0].token, 'ignored nickname');
    for (let index = 1; index < 6; index++) {
      await rooms.joinRoom(code, people[index].token, 'ignored nickname');
      const view = await rooms.roomView(code, people[0].token);
      assert.equal(view.game.players.length, index + 1);
      assert.equal(view.canStart, true);
    }
    const hostBefore = await rooms.getMember(code, people[0].token);
    const secondDevice = await accounts.authenticateAccount('login', 'Player1', 'room test password', 'second-device');
    const hostAfter = await rooms.joinRoom(code, secondDevice.token, 'cannot change name');
    assert.equal(hostAfter.id, hostBefore?.id);
    assert.equal(hostAfter.seat, 1);
    assert.equal(hostAfter.name, 'Player1');
    const recovered = await rooms.roomView(code, secondDevice.token);
    assert.equal(recovered.host, true);
    assert.equal(recovered.game.players.length, 6);
    assert.equal((await rooms.joinRoom(code, people[6].token, '')).role, 'spectator');
    assert.equal((await rooms.getMembers(code)).filter(m => m.role === 'player').length, 6);
    const visible = JSON.stringify(recovered);
    assert.equal(visible.includes('sessionId'), false);
    assert.equal(visible.includes(people[0].token), false);
    assert.equal(visible.includes('accountIds'), false);
    assert.equal(recovered.game.players.some(player => 'points' in player), false);
  } finally { sqlite.close() }
});

test('waiting-room host exit frees the seat, transfers host, and another device cannot duplicate membership', async () => {
  const { sqlite, accounts, rooms, users } = fixture();
  try {
    const people = await users(3), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.joinRoom(code, people[2].token, '');
    const originalHost = await rooms.getMember(code, people[0].token);
    await rooms.leaveRoom(code, people[0].token);
    assert.equal(await rooms.getMember(code, people[0].token), null);
    assert.equal((await rooms.roomView(code, people[1].token)).host, true);
    assert.equal((await rooms.roomView(code, people[1].token)).game.players.length, 2);
    const device = await accounts.authenticateAccount('login', 'Player1', 'room test password', 'another-ip');
    const rejoined = await rooms.joinRoom(code, device.token, '');
    assert.equal(rejoined.id, originalHost?.id);
    assert.equal(rejoined.seat, 1);
    assert.equal((await rooms.roomView(code, device.token)).host, false);
    assert.equal((await rooms.getMembers(code)).length, 3);
    await rooms.leaveRoom(code, people[2].token);
    await rooms.leaveRoom(code, people[2].token);
    assert.equal((await rooms.getMembers(code)).length, 2);
  } finally { sqlite.close() }
});

test('playing players cannot leave; finished results persist once and remaining members can rematch', async () => {
  const { sqlite, accounts, rooms, users, finish } = fixture();
  try {
    const people = await users(3), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, ''); await rooms.joinRoom(code, people[2].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game) });
    await assert.rejects(rooms.leaveRoom(code, people[0].token), { message: '请在整局结束后退出房间' });
    assert.equal((await rooms.getMembers(code)).length, 3);
    const winner = (await rooms.getMember(code, people[1].token))!;
    await finish(code, winner.id);
    for (let count = 0; count < 3; count++) await rooms.roomView(code, people[1].token);
    assert.equal((await accounts.accountForSession(people[1].token))?.points, 3);
    assert.equal((await accounts.accountForSession(people[1].token))?.games, 1);
    assert.equal((await accounts.accountForSession(people[1].token))?.kills, 2);
    await rooms.leaveRoom(code, people[0].token);
    const view = await rooms.roomView(code, people[1].token);
    assert.equal(view.host, true); assert.equal(view.canRematch, true);
    assert.equal(view.game.players.length, 3, 'finished history must keep the departed player');
    await rooms.mutateRoom(code, async room => { await rooms.saveFinishedRanking(room); await rooms.prepareRoster(room); game.rematch(room.game) });
    const restarted = await rooms.roomView(code, people[1].token);
    assert.equal(restarted.game.phase, 'main'); assert.equal(restarted.game.players.length, 2);
    assert.equal(restarted.game.match, 2);
    assert.equal((await accounts.accountForSession(people[1].token))?.games, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM account_match_results').get()?.count, 3);
  } finally { sqlite.close() }
});

test('concurrent confirmations and retries atomically persist one state and one idempotency key', async () => {
  const { sqlite, rooms, users } = fixture();
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game) });
    const room = (await rooms.getRoom(code))!, actor = (await rooms.getMember(code, people[0].token))!;
    const confirm = (state: Rooms.RoomRecord) => { game.submitMain(state.game, actor.id, { id: 'accumulate' }) };
    await Promise.all([rooms.mutateCommand(code, people[0].token, 'same-request', room.version, confirm), rooms.mutateCommand(code, people[0].token, 'same-request', room.version, confirm)]);
    const saved = (await rooms.getRoom(code))!;
    assert.equal(saved.version, room.version + 1);
    assert.equal(Object.keys(saved.game.submissions).length, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM idempotency_keys').get()?.count, 1);
    await rooms.mutateCommand(code, people[0].token, 'same-request', room.version, () => { assert.fail('a successful retry must not execute again') });
    await assert.rejects(rooms.mutateCommand(code, people[0].token, 'stale-request', room.version, confirm), { message: '房间状态已更新，请重新确认' });
    await assert.rejects(rooms.mutateCommand(code, people[0].token, 'invalid-request', saved.version, () => { throw new Error('invalid action') }), { message: 'invalid action' });
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM idempotency_keys').get()?.count, 1);
    assert.equal((await rooms.getRoom(code))?.version, saved.version);
  } finally { sqlite.close() }
});

test('concurrent joins cannot duplicate a seat or a cross-device account', async () => {
  const { sqlite, accounts, rooms, users } = fixture();
  try {
    const people = await users(3), { code } = await rooms.createRoom(people[0].token, '');
    const device = await accounts.authenticateAccount('login', 'Player2', 'room test password', 'second-device');
    await Promise.all([rooms.joinRoom(code, people[1].token, ''), rooms.joinRoom(code, device.token, ''), rooms.joinRoom(code, people[2].token, '')]);
    const members = await rooms.getMembers(code), stored = (await rooms.getRoom(code))!;
    assert.equal(members.length, 3);
    assert.equal(new Set(members.map(member => member.seat)).size, 3);
    assert.equal(new Set(members.map(member => member.accountId)).size, 3);
    assert.equal(stored.game.players.length, 3);
  } finally { sqlite.close() }
});

test('a finished room accepts a replacement player for rematch without changing the finished roster', async () => {
  const { sqlite, rooms, users, finish } = fixture();
  try {
    const people = await users(3), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game) });
    const host = (await rooms.getMember(code, people[0].token))!;
    await finish(code, host.id);
    await rooms.leaveRoom(code, people[1].token);
    const newcomer = await rooms.joinRoom(code, people[2].token, '');
    assert.equal(newcomer.role, 'player');
    assert.equal(newcomer.seat, 2);
    assert.equal((await rooms.getRoom(code))?.game.players.some(player => player.id === newcomer.id), false);
    assert.equal((await rooms.roomView(code, people[0].token)).canRematch, true);
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.rematch(room.game) });
    assert.equal((await rooms.getRoom(code))?.game.players.some(player => player.id === newcomer.id), true);
  } finally { sqlite.close() }
});

test('a spectator leaving on a final timeout may only record ranking after the final state commits', async () => {
  const { sqlite, rooms, users, rankingSnapshots } = fixture();
  try {
    const people = await users(3), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game) });
    assert.equal((await rooms.joinRoom(code, people[2].token, '')).role, 'spectator');
    await rooms.mutateRoom(code, room => {
      room.game.phase = 'rps'; room.game.deadline = 0;
      room.game.players[1].hp = 1;
      room.game.rps = [{ id: 'final-timeout', attackerId: room.game.players[0].id, targetId: room.game.players[1].id, kind: 'iron', choices: {} }];
    });
    // Simulate a persisted phase whose preparation and response window elapsed;
    // a newly entered rps phase now correctly receives a synchronization period.
    sqlite.prepare("UPDATE rooms SET state_json=json_set(state_json,'$.deadline',0,'$.phaseStartedAt',0) WHERE code=?").run(code);
    await rooms.leaveRoom(code, people[2].token);
    assert.ok(rankingSnapshots.length >= 1, 'the terminal match should be recorded');
    for (const snapshot of rankingSnapshots) assert.ok(snapshot.phase === 'finished' || snapshot.reveal?.finish, 'do not award points from an uncommitted simulated result');
    assert.equal((await rooms.getRoom(code))?.game.reveal?.finish, true);
  } finally { sqlite.close() }
});

test('legacy anonymous room migration preserves seats and never retroactively awards account points', async () => {
  const { sqlite, rooms } = fixture();
  try {
    sqlite.exec(`CREATE TABLE room_members (id TEXT PRIMARY KEY,room_code TEXT NOT NULL,session_id TEXT NOT NULL,name TEXT NOT NULL,seat INTEGER,role TEXT NOT NULL,joined_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL)`);
    await rooms.ensureSchema();
    const columns = sqlite.prepare('PRAGMA table_info(room_members)').all().map(row => row.name);
    assert.ok(columns.includes('account_id')); assert.ok(columns.includes('left_at'));
    const oldGame = game.createGame([{ id: 'old-one', name: '旧玩家一', seat: 1 }, { id: 'old-two', name: '旧玩家二', seat: 2 }]);
    const now = Date.now();
    sqlite.prepare('INSERT INTO rooms (code,status,host_session_id,version,state_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('OLD123', 'lobby', 'old-cookie-one', 1, JSON.stringify(oldGame), now, now);
    for (const [index, player] of oldGame.players.entries()) sqlite.prepare('INSERT INTO room_members (id,room_code,session_id,name,seat,role,joined_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?)').run(player.id, 'OLD123', index ? 'old-cookie-two' : 'old-cookie-one', player.name, player.seat, 'player', now, now);
    const view = await rooms.roomView('OLD123', 'old-cookie-one');
    assert.equal(view.host, true); assert.equal(view.member?.id, 'old-one'); assert.equal(view.account, null);
    await rooms.mutateRoom('OLD123', async room => { await rooms.prepareRoster(room); game.startGame(room.game) });
    assert.equal((await rooms.getRoom('OLD123'))?.game.ranked, false);
    await assert.rejects(rooms.createRoom('old-cookie-one', 'legacy cannot create new'), { message: '请先登录账号' });
  } finally { sqlite.close() }
});

test('new phases keep full fifteen-second play time after two-second sync despite slow database responses', async () => {
  const clock = { now: Date.now(), queryMs: 0 };
  const { sqlite, rooms, users, activity } = fixture(clock);
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    clock.queryMs = 300;
    const viewer = await rooms.getRoomViewer(code, people[0].token);
    const before = (await rooms.getRoom(code))!;
    const committed = await rooms.mutateCommand(code, people[0].token, 'start-clock', before.version, async room => {
      await rooms.prepareRoster(room); game.startGame(room.game, clock.now);
    });
    const queriesBeforeView = activity.queries.length;
    const view = await rooms.roomView(code, people[0].token, { viewer, room: committed });
    assert.equal(activity.queries.length, queriesBeforeView, 'POST must reuse already-authenticated and committed snapshots');
    const stored = (await rooms.getRoom(code))!;
    assert.equal(stored.game.deadline! - stored.game.phaseStartedAt!, 15_000);
    assert.equal(stored.game.phaseStartedAt! - view.serverNow, 1_700, 'only the final 300ms commit consumes preparation');
    assert.equal(phaseClock.phaseIsPreparing(stored.game, view.serverNow), true);
    const deadline = stored.game.deadline;
    const startedAt = stored.game.phaseStartedAt;
    const accountReads = activity.accountReads;
    for (let index = 0; index < 2; index++) await rooms.roomView(code, people[0].token);
    assert.equal(activity.accountReads - accountReads, 2, 'each GET authenticates the account once');
    const polled = (await rooms.getRoom(code))!;
    assert.equal(polled.game.deadline, deadline); assert.equal(polled.game.phaseStartedAt, startedAt);
    await rooms.mutateCommand(code, people[0].token, 'start-clock', before.version, () => { assert.fail('duplicate request must not reset the clock') });
    assert.equal((await rooms.getRoom(code))?.game.deadline, deadline);
    clock.queryMs = 0;
    clock.now = deadline! - 1;
    assert.equal((await rooms.tickRoom(code)).game.phase, 'main');
    clock.now = deadline!;
    const reveal = await rooms.tickRoom(code);
    assert.equal(reveal.game.phase, 'reveal'); assert.equal(reveal.game.deadline, clock.now + 5_000);
  } finally { sqlite.close() }
});

test('next-round polling does prefetch work before the clock starts and old phases are not restarted', async () => {
  const clock = { now: Date.now(), queryMs: 0 };
  const { sqlite, rooms, users } = fixture(clock);
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game, clock.now); room.game.phase = 'reveal'; room.game.deadline = clock.now - 1; room.game.reveal = { round: 1, actions: [], hpChanges: [], highlights: [], finish: false } });
    clock.queryMs = 300;
    const view = await rooms.roomView(code, people[0].token);
    const next = (await rooms.getRoom(code))!;
    assert.equal(view.game.phase, 'main');
    assert.equal(next.game.deadline! - next.game.phaseStartedAt!, 15_000);
    assert.equal(next.game.phaseStartedAt! - view.serverNow, 1_700);
    clock.queryMs = 0;
    const legacyDeadline = clock.now + 9_000;
    sqlite.prepare("UPDATE rooms SET state_json=json_remove(json_set(state_json,'$.deadline',?),'$.phaseStartedAt') WHERE code=?").run(legacyDeadline, code);
    const legacy = await rooms.tickRoom(code);
    assert.equal(legacy.game.deadline, legacyDeadline);
    assert.equal(legacy.game.phaseStartedAt, undefined);
  } finally { sqlite.close() }
});

test('room API rejects input during synchronization, accepts the exact start boundary, and settles all-confirmed immediately', async () => {
  const clock = { now: Date.now(), queryMs: 0 };
  const { sqlite, rooms, users, apiForSession } = fixture(clock);
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    async function post(sid: string, body: Record<string, unknown>) {
      const request = new Request(`https://game.test/api/rooms/${code}`, { method: 'POST', headers: { Origin: 'https://game.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return apiForSession(sid).POST(request, { params: Promise.resolve({ code }) });
    }
    const first = (await rooms.getRoom(code))!;
    assert.equal((await post(people[0].token, { command: 'start', version: first.version, requestId: 'start' })).status, 200);
    const starting = (await rooms.getRoom(code))!;
    const command = { command: 'action', version: starting.version, requestId: 'action-one', action: { id: 'accumulate' } };
    const tooEarly = await post(people[0].token, command);
    assert.equal(tooEarly.status, 400);
    assert.match((await tooEarly.json() as { error: string }).error, /同步/);
    assert.equal((await rooms.getRoom(code))?.version, starting.version);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM idempotency_keys WHERE key LIKE '%action-one'").get()?.count, 0);
    clock.now = starting.game.phaseStartedAt!;
    assert.equal((await post(people[0].token, command)).status, 200, 'a rejected request remains safely retryable at the exact boundary');
    const oneConfirmed = (await rooms.getRoom(code))!;
    assert.equal(oneConfirmed.game.deadline, starting.game.deadline);
    assert.equal((await post(people[1].token, { command: 'action', version: oneConfirmed.version, requestId: 'action-two', action: { id: 'accumulate' } })).status, 200);
    const reveal = (await rooms.getRoom(code))!;
    assert.equal(reveal.game.phase, 'reveal');
    assert.equal(reveal.game.deadline, clock.now + 5_000);
    assert.ok(clock.now < starting.game.deadline!);
  } finally { sqlite.close() }
});

test('room API preparation gate also protects delayed actions and both guessing phases', async () => {
  const clock = { now: Date.now(), queryMs: 0 };
  const { sqlite, rooms, users, apiForSession } = fixture(clock);
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game, clock.now) });
    for (const phase of ['delayed', 'rps', 'priorityRps'] as const) {
      const room = (await rooms.getRoom(code))!;
      const [one, two] = room.game.players;
      room.game.phase = phase; room.game.phaseStartedAt = clock.now + 2_000;
      room.game.deadline = room.game.phaseStartedAt + game.PHASE_SECONDS[phase] * 1_000;
      room.game.delayedSubmissions = {}; room.game.delayedQueue = undefined;
      one.delayed = phase === 'delayed' ? { kind: 'fist', budget: 1, max: 1 } : undefined;
      two.delayed = undefined;
      room.game.rps = phase === 'rps' ? [{ id: 'duel', attackerId: one.id, targetId: two.id, kind: 'plastic', choices: {} }] : [];
      room.game.priority = phase === 'priorityRps' ? { playerIds: [one.id, two.id], choices: {}, attempts: 0 } : undefined;
      sqlite.prepare('UPDATE rooms SET state_json=? WHERE code=?').run(JSON.stringify(room.game), code);
      const body = phase === 'delayed'
        ? { command: 'delayed', actions: [{ id: 'accumulate' }], version: room.version, requestId: `prepare-${phase}` }
        : { command: 'rps', duelId: phase === 'priorityRps' ? 'priority' : 'duel', choice: 'rock', version: room.version, requestId: `prepare-${phase}` };
      const request = () => new Request(`https://game.test/api/rooms/${code}`, { method: 'POST', headers: { Origin: 'https://game.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const api = apiForSession(people[0].token);
      assert.equal((await api.POST(request(), { params: Promise.resolve({ code }) })).status, 400, `${phase} rejects before phaseStartedAt`);
      clock.now = room.game.phaseStartedAt;
      assert.equal((await api.POST(request(), { params: Promise.resolve({ code }) })).status, 200, `${phase} accepts at phaseStartedAt`);
    }
  } finally { sqlite.close() }
});

test('each authenticated player sees only their own live balance, including dead players; hosts and spectators gain no extra visibility', async () => {
  const { sqlite, rooms, users } = fixture();
  try {
    const people = await users(8), { code } = await rooms.createRoom(people[0].token, '');
    for (let index = 1; index < 7; index++) await rooms.joinRoom(code, people[index].token, '');
    const balances = [2, 5, 11, 17, 23, 31];
    await rooms.mutateRoom(code, async room => {
      await rooms.prepareRoster(room); game.startGame(room.game);
      room.game.players.forEach((player, index) => { player.points = balances[index]; player.swap = { id: 'five7', added: 2, hits: 0, triggered: false } });
      room.game.players[5].alive = false; room.game.players[5].hp = 0;
    });
    const views = await Promise.all(people.slice(0, 6).map(person => rooms.roomView(code, person.token)));
    for (const [index, view] of views.entries()) {
      assert.equal(view.selfPoints?.playerId, view.member?.id);
      assert.equal(view.selfPoints?.points, balances[index]);
      assert.deepEqual(Object.keys(view.selfPoints!).sort(), ['playerId', 'points']);
      assert.equal(view.host, index === 0);
      assert.equal(view.game.players.some(player => 'points' in player || 'swap' in player), false);
      assert.doesNotMatch(JSON.stringify(view.game), /"points"|"swap"|accountIds|roundVoiceFacts|roundActionResults/);
      assert.doesNotMatch(JSON.stringify(view), /sessionId|token_hash|accountIds/);
    }
    assert.equal(views[5].game.players.find(player => player.id === views[5].member?.id)?.alive, false);
    const spectator = await rooms.roomView(code, people[6].token);
    assert.equal(spectator.member?.role, 'spectator'); assert.equal(spectator.selfPoints, undefined);
    const notJoined = await rooms.roomView(code, people[7].token);
    assert.equal(notJoined.member, null); assert.equal(notJoined.selfPoints, undefined);
    for (const sid of ['', 'anonymous-browser', 'invalid-account-session']) {
      const anonymous = await rooms.roomView(code, sid);
      assert.equal(anonymous.member, null); assert.equal(anonymous.selfPoints, undefined);
      assert.equal(JSON.stringify(anonymous).includes('selfPoints'), false);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(spectator.game)), JSON.parse(JSON.stringify(views[0].game)), 'the shared PublicGame is not personalized with point balances');
  } finally { sqlite.close() }
});

test('cross-device login recovers the same own balance while account switching and revoked sessions do not inherit it', async () => {
  const { sqlite, rooms, accounts, users } = fixture();
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, room => { room.game.players[0].points = 17; room.game.players[1].points = 29 });
    const original = await rooms.roomView(code, people[0].token);
    const secondDevice = await accounts.authenticateAccount('login', 'Player1', 'room test password', 'second-device');
    const recovered = await rooms.roomView(code, secondDevice.token);
    assert.equal(recovered.member?.id, original.member?.id);
    assert.equal(recovered.selfPoints?.playerId, original.selfPoints?.playerId); assert.equal(recovered.selfPoints?.points, 17);
    const switched = await rooms.roomView(code, people[1].token);
    assert.equal(switched.selfPoints?.points, 29); assert.notEqual(switched.selfPoints?.playerId, original.selfPoints?.playerId);
    await accounts.revokeAccountSession(people[0].token);
    const loggedOut = await rooms.roomView(code, people[0].token);
    assert.equal(loggedOut.account, null); assert.equal(loggedOut.member, null); assert.equal(loggedOut.host, false); assert.equal(loggedOut.selfPoints, undefined);
    assert.equal((await rooms.roomView(code, secondDevice.token)).selfPoints?.points, 17, 'logout only revokes the current device');
  } finally { sqlite.close() }
});

test('prepared viewers are single-use and scoped to their authenticated cookie and room; unrelated prepared room snapshots are ignored', async () => {
  const { sqlite, rooms, accounts, users, activity } = fixture();
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, room => { room.game.players[0].points = 13; room.game.players[1].points = 24 });
    const stored = (await rooms.getRoom(code))!;
    const ownerViewer = await rooms.getRoomViewer(code, people[0].token), readsBeforeWrongUser = activity.accountReads;
    const other = await rooms.roomView(code, people[1].token, { viewer: ownerViewer, room: stored });
    assert.equal(activity.accountReads, readsBeforeWrongUser + 1);
    assert.equal(other.selfPoints?.points, 24); assert.equal(other.member?.id, other.selfPoints?.playerId);
    const queriesBefore = activity.queries.length;
    const correct = await rooms.roomView(code.toLowerCase(), people[0].token, { viewer: ownerViewer, room: stored });
    assert.equal(activity.queries.length, queriesBefore, 'a legitimate prepared POST keeps its no-extra-query fast path');
    assert.equal(correct.selfPoints?.points, 13);
    await accounts.revokeAccountSession(people[0].token);
    const reused = await rooms.roomView(code, people[0].token, { viewer: ownerViewer, room: stored });
    assert.equal(reused.selfPoints, undefined); assert.equal(reused.member, null);
    const forged = { account: correct.account, member: { ...ownerViewer.member! }, members: ownerViewer.members };
    const forgedView = await rooms.roomView(code, 'anonymous', { viewer: forged, room: stored });
    assert.equal(forgedView.selfPoints, undefined); assert.equal(forgedView.member, null);
    const second = await rooms.createRoom(people[1].token, '');
    await rooms.mutateRoom(second.code, room => { room.game.players[0].points = 37 });
    const otherRoom = (await rooms.getRoom(second.code))!, firstRoomViewer = await rooms.getRoomViewer(code, people[1].token);
    const scoped = await rooms.roomView(second.code, people[1].token, { viewer: firstRoomViewer, room: stored });
    assert.equal(scoped.code, second.code); assert.equal(scoped.selfPoints?.points, 37); assert.equal(scoped.selfPoints?.playerId, otherRoom.game.players[0].id);
  } finally { sqlite.close() }
});

test('legacy anonymous membership reveals its own balance only to the exact original cookie, never to an anonymous spectator', async () => {
  const { sqlite, rooms } = fixture();
  try {
    await rooms.ensureSchema();
    const oldGame = game.createGame([{ id: 'legacy-player', name: '旧玩家', seat: 1 }, { id: 'legacy-other', name: '另一玩家', seat: 2 }]);
    oldGame.players[0].points = 19; oldGame.players[1].points = 28;
    const now = Date.now();
    sqlite.prepare('INSERT INTO rooms (code,status,host_session_id,version,state_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('OLD456', 'lobby', 'legacy-cookie', 1, JSON.stringify(oldGame), now, now);
    sqlite.prepare('INSERT INTO room_members (id,room_code,session_id,name,seat,role,joined_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?)').run('legacy-player', 'OLD456', 'legacy-cookie', '旧玩家', 1, 'player', now, now);
    sqlite.prepare('INSERT INTO room_members (id,room_code,session_id,name,seat,role,joined_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?)').run('legacy-spectator', 'OLD456', 'spectator-cookie', '旧观战者', null, 'spectator', now, now);
    const owner = await rooms.roomView('OLD456', 'legacy-cookie');
    assert.equal(owner.account, null); assert.equal(owner.selfPoints?.playerId, 'legacy-player'); assert.equal(owner.selfPoints?.points, 19);
    for (const sid of ['spectator-cookie', 'wrong-cookie', 'legacy-player']) assert.equal((await rooms.roomView('OLD456', sid)).selfPoints, undefined);
    assert.doesNotMatch(JSON.stringify(owner.game), /"points"/);
  } finally { sqlite.close() }
});

test('departed players and replacement seats cannot read the finished match balances of other participants', async () => {
  const { sqlite, rooms, users, finish } = fixture();
  try {
    const people = await users(3), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game); room.game.players[0].points = 12; room.game.players[1].points = 26 });
    const host = (await rooms.getMember(code, people[0].token))!;
    await finish(code, host.id);
    const member = (await rooms.getMember(code, people[1].token))!, preparedViewer = await rooms.getRoomViewer(code, people[1].token);
    await rooms.roomView(code, people[1].token, { viewer: preparedViewer });
    await rooms.leaveRoom(code, people[1].token);
    const departed = await rooms.roomView(code, people[1].token, { viewer: preparedViewer });
    assert.equal(departed.member, null); assert.equal(departed.selfPoints, undefined);
    const newcomer = await rooms.joinRoom(code, people[2].token, ''); assert.equal(newcomer.seat, member.seat);
    const replacement = await rooms.roomView(code, people[2].token);
    assert.equal(replacement.member?.role, 'player'); assert.equal(replacement.selfPoints, undefined, 'seat number alone cannot claim the prior player balance');
    assert.equal((await rooms.roomView(code, people[0].token)).selfPoints?.points, 12);
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.rematch(room.game) });
    assert.equal((await rooms.roomView(code, people[2].token)).selfPoints?.points, 0);
  } finally { sqlite.close() }
});

test('GET and POST expose only cookie-derived self points, ignore injected player IDs, and stay private with no-store responses', async () => {
  const clock = { now: Date.now(), queryMs: 0 };
  const { sqlite, rooms, users, apiForSession } = fixture(clock);
  try {
    const people = await users(2), { code } = await rooms.createRoom(people[0].token, '');
    await rooms.joinRoom(code, people[1].token, '');
    await rooms.mutateRoom(code, async room => { await rooms.prepareRoster(room); game.startGame(room.game, clock.now); room.game.players[0].points = 5; room.game.players[1].points = 9 });
    const starting = (await rooms.getRoom(code))!; clock.now = starting.game.phaseStartedAt!;
    const [one, two] = starting.game.players;
    async function post(sid: string, body: Record<string, unknown>) {
      const response = await apiForSession(sid).POST(new Request(`https://game.test/api/rooms/${code}`, { method: 'POST', headers: { Origin: 'https://game.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ code }) });
      assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store'); assert.equal(response.headers.get('Vary'), 'Cookie');
      return await response.json() as Rooms.RoomView;
    }
    const firstCommand = { command: 'action', version: starting.version, requestId: 'private-first', playerId: two.id, member: { id: two.id }, selfPoints: { playerId: two.id, points: 999 }, action: { id: 'accumulate', playerId: two.id } };
    const first = await post(people[0].token, firstCommand);
    assert.equal(first.selfPoints?.playerId, one.id); assert.equal(first.selfPoints?.points, 5);
    const second = await post(people[1].token, { command: 'action', version: first.version, requestId: 'private-second', playerId: one.id, action: { id: 'accumulate' } });
    assert.equal(second.game.phase, 'reveal'); assert.equal(second.selfPoints?.playerId, two.id); assert.equal(second.selfPoints?.points, 11);
    const retry = await post(people[0].token, firstCommand);
    assert.equal(retry.selfPoints?.points, 7, 'idempotent retries return the current snapshot, not a cached personalized response');
    const get = await apiForSession(people[1].token).GET(new Request(`https://game.test/api/rooms/${code}?playerId=${one.id}`), { params: Promise.resolve({ code }) });
    assert.equal(get.headers.get('Cache-Control'), 'private, no-store'); assert.equal(get.headers.get('Vary'), 'Cookie');
    const current = await get.json() as Rooms.RoomView;
    assert.equal(current.selfPoints?.playerId, two.id); assert.equal(current.selfPoints?.points, 11);
    assert.doesNotMatch(JSON.stringify(current.game), /"points"|"burst"|roundActionResults|accountIds/);
    const anonymousResponse = await apiForSession('anonymous-spectator').GET(new Request(`https://game.test/api/rooms/${code}?playerId=${one.id}`), { params: Promise.resolve({ code }) });
    const anonymous = await anonymousResponse.json() as Rooms.RoomView;
    assert.equal(anonymous.selfPoints, undefined); assert.equal(anonymous.member, null);
  } finally { sqlite.close() }
});
