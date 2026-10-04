import { PHASE_SECONDS, type Phase } from './game.ts';

export const PHASE_SYNC_MS = 2_000;
export interface PhaseClockState {
  match: number;
  round: number;
  phase: Phase;
  deadline: number | null;
  phaseStartedAt?: number;
}
const inputPhases = new Set<Phase>(['main', 'delayed', 'rps', 'priorityRps']);

export function phaseClockKey(state: PhaseClockState): string {
  return `${state.match}:${state.round}:${state.phase}:${state.deadline}`;
}

// Called only immediately before a new phase is committed. Polling, confirmations
// within a phase, and legacy snapshots without a start time must not renew it.
export function synchronizeNewPhase(previousKey: string, state: PhaseClockState, now: number): boolean {
  if (!inputPhases.has(state.phase) || phaseClockKey(state) === previousKey) return false;
  state.phaseStartedAt = now + PHASE_SYNC_MS;
  state.deadline = state.phaseStartedAt + PHASE_SECONDS[state.phase] * 1_000;
  return true;
}

export function phaseIsPreparing(state: Pick<PhaseClockState, 'phase' | 'phaseStartedAt'>, now: number): boolean {
  return inputPhases.has(state.phase) && typeof state.phaseStartedAt === 'number' && Number.isFinite(state.phaseStartedAt) && now < state.phaseStartedAt;
}
