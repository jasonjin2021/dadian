import type { PublicGame } from './game.ts';

export const phaseKey=(game:PublicGame)=>`${game.match}:${game.round}:${game.phase}:${game.deadline}`;
export interface SubmissionContext {code:string;command:string;phase:string;playerId?:string;duelId?:string}
type SubmissionView={code:string;game:PublicGame};

/** Only server-confirmed public state can dismiss an uncertain submission. */
export function submissionProgress(context:SubmissionContext,latest:SubmissionView|null):'pending'|'confirmed'|'expired'{
  if(!latest)return 'pending';
  if(latest.code!==context.code)return 'expired';
  if(!['action','delayed','rps'].includes(context.command))return 'pending';
  if(phaseKey(latest.game)!==context.phase)return 'expired';
  if(!context.playerId)return 'pending';
  if(context.command==='action'||context.command==='delayed'){
    return latest.game.players.find(p=>p.id===context.playerId)?.confirmed?'confirmed':'pending';
  }
  if(context.duelId==='priority')return latest.game.priority?.submittedIds.includes(context.playerId)?'confirmed':'pending';
  return latest.game.rps.find(duel=>duel.id===context.duelId)?.submittedIds.includes(context.playerId)?'confirmed':'pending';
}
