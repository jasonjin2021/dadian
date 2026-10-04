import {PHASE_SECONDS, phaseRemainingMs, type PublicGame} from './game.ts';

type ClockGame=Pick<PublicGame,'phase'|'deadline'|'phaseStartedAt'|'phaseDurationMs'>;
export function clientPhaseClock(game:ClockGame,serverNow:number,elapsedMs:number){
  const durationMs=game.phaseDurationMs??PHASE_SECONDS[game.phase]*1000;
  const estimatedNow=serverNow+Math.max(0,elapsedMs);
  const preparingMs=game.deadline===null?0:Math.max(0,(game.phaseStartedAt??0)-estimatedNow);
  const remainingMs=Math.min(durationMs,phaseRemainingMs(game.deadline,serverNow,elapsedMs));
  return{durationMs,remainingMs,preparingMs,seconds:Math.ceil(remainingMs/1000),progress:durationMs?remainingMs/durationMs*100:0};
}
