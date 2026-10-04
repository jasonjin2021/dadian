/** Personal balances belong to a separate authenticated response field, never the public roster. */
export interface PersonalBalanceView {
  member:{id:string;role:'player'|'spectator'}|null;
  game:{players:Array<{id:string}>};
  selfPoints?:{playerId:string;points:number};
}
export function visibleSelfPoints(view:PersonalBalanceView):number|undefined{
  const {member,selfPoints}=view;
  if(member?.role!=='player'||!selfPoints||selfPoints.playerId!==member.id)return;
  if(!view.game.players.some(player=>player.id===member.id))return;
  return Number.isSafeInteger(selfPoints.points)&&selfPoints.points>=0?selfPoints.points:undefined;
}
