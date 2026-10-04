import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{code:text('code').primaryKey(),status:text('status').notNull().default('lobby'),hostSessionId:text('host_session_id').notNull(),version:integer('version').notNull().default(1),stateJson:text('state_json').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()},t=>[index('idx_rooms_updated_at').on(t.updatedAt)]);
export const roomMembers=sqliteTable('room_members',{id:text('id').primaryKey(),roomCode:text('room_code').notNull(),sessionId:text('session_id').notNull(),name:text('name').notNull(),seat:integer('seat'),role:text('role').notNull(),joinedAt:integer('joined_at').notNull(),lastSeenAt:integer('last_seen_at').notNull(),accountId:text('account_id'),leftAt:integer('left_at')},t=>[uniqueIndex('uq_room_members_room_session').on(t.roomCode,t.sessionId),uniqueIndex('uq_room_members_room_seat').on(t.roomCode,t.seat),index('idx_room_members_room').on(t.roomCode),uniqueIndex('uq_room_account').on(t.roomCode,t.accountId).where(sql`${t.accountId} IS NOT NULL`)]);
export const roomEvents=sqliteTable('room_events',{id:integer('id').primaryKey({autoIncrement:true}),roomCode:text('room_code').notNull(),matchNumber:integer('match_number').notNull(),roundNumber:integer('round_number').notNull(),message:text('message').notNull(),createdAt:integer('created_at').notNull()},t=>[index('idx_room_events_room_created').on(t.roomCode,t.createdAt)]);
export const idempotencyKeys=sqliteTable('idempotency_keys',{key:text('key').primaryKey(),roomCode:text('room_code').notNull(),sessionId:text('session_id').notNull(),createdAt:integer('created_at').notNull()},t=>[index('idx_idempotency_created').on(t.createdAt)]);

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  usernameNormalized: text('username_normalized').notNull().unique(),
  passwordSalt: text('password_salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordIterations: integer('password_iterations').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const accountSessions = sqliteTable('account_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('idx_account_sessions_expiry').on(table.expiresAt)]);

export const accountMatchResults = sqliteTable('account_match_results', {
  roomCode: text('room_code').notNull(),
  matchNumber: integer('match_number').notNull(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  outcome: text('outcome', { enum: ['win', 'draw', 'loss'] }).notNull(),
  kills: integer('kills').notNull(),
  forfeit: integer('forfeit').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, table => [
  primaryKey({ columns: [table.roomCode, table.matchNumber, table.accountId] }),
  index('idx_account_results_player').on(table.accountId),
  check('account_results_outcome', sql`${table.outcome} IN ('win', 'draw', 'loss')`),
  check('account_results_kills', sql`${table.kills} >= 0`),
]);

export const accountRateLimits = sqliteTable('account_rate_limits', {
  keyHash: text('key_hash').primaryKey(),
  attempts: integer('attempts').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('idx_account_rate_expiry').on(table.expiresAt)]);
