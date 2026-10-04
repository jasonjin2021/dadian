import type { ActionId } from './game.ts';

export function actionCountLimit(id:ActionId){return id==='raiseFist'?3:id==='smallShield'||id==='bigShield'?2:99;}

export type ActionCountResult={valid:true;value:number}|{valid:false;message:string};
/** Keep editing text untouched; validate only its meaning before constructing a submission. */
export function parseActionCount(raw:string,limit:number):ActionCountResult{
  const text=raw.trim();
  if(!text)return{valid:false,message:'请填写数量'};
  if(!/^\d+$/.test(text))return{valid:false,message:'请输入整数，不能有小数或符号'};
  const value=Number(text);
  if(!Number.isSafeInteger(value)||value<1||value>limit)return{valid:false,message:`数量须为 1～${limit}`};
  return{valid:true,value};
}

export function availableTargets<T extends {id:string;alive:boolean}>(players:ReadonlyArray<T>,selfId:string){return players.filter(p=>p.alive&&p.id!==selfId);}
export function selectedTargetId(targets:ReadonlyArray<{id:string}>,selected:string){return targets.some(p=>p.id===selected)?selected:targets[0]?.id??'';}
