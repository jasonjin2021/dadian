import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCredentials, constantTimeDigestEqual, hashPassword, hashSessionToken, isSameOriginRequest, PASSWORD_ITERATIONS, randomToken, sessionTokenIsValid, verifyPassword } from './account-security.ts';

test('account names normalize width and case while keeping a display form', () => {
  assert.deepEqual(accountCredentials('  ＡＢＣ_玩家  ', '  秘密abc  '), { username: 'ABC_玩家', normalized: 'abc_玩家', password: '  秘密abc  ' });
  assert.equal(accountCredentials('abc', '01234567').normalized, accountCredentials('ＡＢＣ', '01234567').normalized);
});

test('account credentials reject invalid names and weak length without trimming passwords', () => {
  for (const name of ['ab', 'a'.repeat(21), '<script>', 'abc def', '😀😀😀', 'abc@example.com']) assert.throws(() => accountCredentials(name, '01234567'));
  for (const password of ['short', 'x'.repeat(129), null, 12345678]) assert.throws(() => accountCredentials('玩家甲', password));
  assert.equal(accountCredentials('玩家甲', ' 123456 ').password, ' 123456 ');
});

test('PBKDF2 digests are salted, verify exactly, and fit the Workers iteration cap', async () => {
  const left = await hashPassword('my password 123'), right = await hashPassword('my password 123');
  assert.equal(PASSWORD_ITERATIONS, 100_000);
  assert.notEqual(left.salt, right.salt);
  assert.notEqual(left.hash, right.hash);
  assert.equal(await verifyPassword('my password 123', left), true);
  assert.equal(await verifyPassword('my password 123 ', left), false);
  assert.equal(await verifyPassword('wrong password', left), false);
  assert.equal(await verifyPassword('my password 123', { ...left, iterations: 1 }), false);
  assert.equal(await verifyPassword('my password 123', { ...left, salt: 'malformed' }), false);
});

test('fixed-length comparison checks full digests and rejects malformed input', () => {
  assert.equal(constantTimeDigestEqual('a'.repeat(64), 'a'.repeat(64)), true);
  assert.equal(constantTimeDigestEqual('a'.repeat(64), 'a'.repeat(63) + 'b'), false);
  assert.equal(constantTimeDigestEqual('a'.repeat(64), 'b' + 'a'.repeat(63)), false);
  assert.equal(constantTimeDigestEqual('', ''), false);
});

test('sessions use random 256-bit tokens and store only a separate SHA-256 digest', async () => {
  const token = randomToken();
  assert.equal(sessionTokenIsValid(token), true);
  assert.notEqual(token, randomToken());
  assert.equal(sessionTokenIsValid(crypto.randomUUID()), false);
  assert.equal(sessionTokenIsValid(undefined), false);
  const hashed = await hashSessionToken(token);
  assert.match(hashed, /^[a-f0-9]{64}$/);
  assert.notEqual(hashed, token);
  assert.equal(await hashSessionToken(token), hashed);
});

test('account writes accept only explicit matching Origin and reject cross-site attempts', () => {
  const url = 'https://dadian.yyxyzljyz.xyz/api/account';
  assert.equal(isSameOriginRequest(new Request(url, { headers: { Origin: 'https://dadian.yyxyzljyz.xyz' } })), true);
  for (const origin of ['', 'null', 'https://evil.test', 'http://dadian.yyxyzljyz.xyz']) assert.equal(isSameOriginRequest(new Request(url, { headers: origin ? { Origin: origin } : {} })), false);
  assert.equal(isSameOriginRequest(new Request(url, { headers: { Origin: 'https://dadian.yyxyzljyz.xyz', 'Sec-Fetch-Site': 'cross-site' } })), false);
  assert.equal(isSameOriginRequest(new Request('http://127.0.0.1:8787/api/account', { headers: { Origin: 'http://127.0.0.1:8787' } })), true);
});
