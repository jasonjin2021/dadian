import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASE_SECONDS, advanceGame, createGame, startGame } from './game.ts';
import { PHASE_SYNC_MS, phaseClockKey, phaseIsPreparing, synchronizeNewPhase, type PhaseClockState } from './phase-clock.ts';

test('new input phases get a distinct two-second preparation followed by their full duration', () => {
  for (const phase of ['main', 'delayed', 'rps', 'priorityRps'] as const) {
    const previous: PhaseClockState = { match: 1, round: 0, phase: 'lobby', deadline: null };
    const next: PhaseClockState = { ...previous, round: 1, phase, deadline: 5_000, phaseStartedAt: 0 };
    assert.equal(synchronizeNewPhase(phaseClockKey(previous), next, 10_000), true);
    assert.equal(next.phaseStartedAt, 10_000 + PHASE_SYNC_MS);
    assert.equal(next.deadline! - next.phaseStartedAt!, PHASE_SECONDS[phase] * 1_000);
    assert.equal(phaseIsPreparing(next, 11_999), true);
    assert.equal(phaseIsPreparing(next, 12_000), false);
  }
});

test('same-phase polling and duplicate keys never extend the persisted clock, including old snapshots', () => {
  const state: PhaseClockState = { match: 1, round: 4, phase: 'main', deadline: 17_000, phaseStartedAt: 2_000 };
  const key = phaseClockKey(state);
  for (const now of [100, 2_000, 7_000, 16_999]) assert.equal(synchronizeNewPhase(key, state, now), false);
  assert.equal(state.deadline, 17_000);
  assert.equal(state.phaseStartedAt, 2_000);
  const legacy: PhaseClockState = { match: 1, round: 1, phase: 'main', deadline: 12_000 };
  assert.equal(synchronizeNewPhase(phaseClockKey(legacy), legacy, 9_000), false);
  assert.equal(legacy.deadline, 12_000);
  assert.equal(legacy.phaseStartedAt, undefined);
  assert.equal(phaseIsPreparing(legacy, 9_000), false);
});

test('guessing tie restarts and new rounds synchronize once, while reveal stays exactly five seconds', () => {
  const state: PhaseClockState = { match: 1, round: 1, phase: 'rps', deadline: 10_000, phaseStartedAt: 2_000 };
  const prior = phaseClockKey(state); state.deadline = 20_000;
  assert.equal(synchronizeNewPhase(prior, state, 12_000), true);
  assert.equal(state.phaseStartedAt, 14_000); assert.equal(state.deadline, 22_000);
  const after = phaseClockKey(state);
  assert.equal(synchronizeNewPhase(after, state, 15_000), false);
  state.phase = 'reveal'; state.phaseStartedAt = 22_000; state.deadline = 27_000;
  assert.equal(synchronizeNewPhase(after, state, 23_000), false);
  assert.equal(state.deadline - state.phaseStartedAt, 5_000);
  assert.equal(phaseIsPreparing(state, 21_000), false);
});

test('prepared main phase expires only after the complete fifteen-second action window', () => {
  const state = createGame([{ id: 'a', name: '甲', seat: 1 }, { id: 'b', name: '乙', seat: 2 }]);
  const previous = phaseClockKey(state);
  startGame(state, 0); synchronizeNewPhase(previous, state, 0);
  assert.equal(state.deadline, 17_000);
  advanceGame(state, 14_999); assert.equal(state.phase, 'main');
  advanceGame(state, 16_999); assert.equal(state.phase, 'main');
  advanceGame(state, 17_000); assert.equal(state.phase, 'reveal');
  assert.equal(state.deadline, 22_000);
});
