import test from 'node:test';
import assert from 'node:assert/strict';
import {clientPhaseClock} from './client-phase-clock.ts';

test('同步准备不占正式15秒，且不显示成17秒',()=>{
  const game={phase:'main' as const,phaseStartedAt:3000,deadline:18000,phaseDurationMs:15000};
  assert.deepEqual(clientPhaseClock(game,1000,0),{durationMs:15000,remainingMs:15000,preparingMs:2000,seconds:15,progress:100});
  assert.equal(clientPhaseClock(game,1000,2000).seconds,15);
  assert.equal(clientPhaseClock(game,1000,2000).preparingMs,0);
  assert.equal(clientPhaseClock(game,1000,5000).seconds,12);
  assert.equal(clientPhaseClock(game,1000,17000).seconds,0);
});
test('以后端时长为准，旧快照仍按截止时间，刷新不重置倒计时',()=>{
  assert.equal(clientPhaseClock({phase:'main',deadline:20000,phaseDurationMs:15000},10000,2000).seconds,8);
  assert.equal(clientPhaseClock({phase:'main',deadline:20000},12000,0).seconds,8);
  assert.equal(clientPhaseClock({phase:'reveal',deadline:15000,phaseStartedAt:10000,phaseDurationMs:5000},10000,0).seconds,5);
  assert.equal(clientPhaseClock({phase:'lobby',deadline:null},10000,0).preparingMs,0);
});
