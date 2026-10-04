import {ACTION_MAP,type ActionId,type RevealedAction,type RoundReveal} from './game.ts';
import type {DocumentEffectId} from '../app/document-effects';

export type BasicGestureId='accumulate'|'five6'|'five7'|'five8'|'five9'|'five10'|'push'|'pull';
export type RevealEffect=
  | {kind:'mark'}
  | {kind:'gesture';id:BasicGestureId}
  | {kind:'gun'}
  | {kind:'document';id:DocumentEffectId;count:1|2;scenario:'cast'};

const basicGestures=new Set<string>(['accumulate','five6','five7','five8','five9','five10','push','pull']);
// Every public action has an explicit route. Existing reviewed assets are reused.
const effects={
  accumulate:'accumulate',five6:'five6',five7:'five7',five8:'five8',five9:'five9',five10:'five10',
  push:'push',pull:'pull',mass:'mass',gun:'targetedGun',punch:'punch',execute:'executePierce',super:'super',
  plastic:'plastic',iron:'iron',snap:'snap',knife1:'knife1',knife2:'knife2',knife3:'knife3',
  guard:'guard',fly:'fly',friction:'friction',heat:'heat',ice:'ice',raiseFist:'raiseFist',
  smallShield:'smallShield',doubleShield:'smallShield',bigShield:'bigShield',holyWater:'holyWater',holyBlock:'holyBlock',
  fistThunder:'fistThunder',shieldThunder:'shieldThunder',pointThunder:'pointThunder',thunder:'thunder',
  convert:'convert',cotton:'cotton',cottonShovel:'cottonShovel',popShield:'iron',popWater:'iron',skip:null,
  smallHeal:'smallHeal',bigHeal:'bigHeal',
} as const satisfies Record<ActionId,DocumentEffectId|BasicGestureId|'targetedGun'|null>;

type VisualEntry=Pick<RevealedAction,'id'|'label'|'status'>&{count?:number};
/** Counts are public action quantities, never inferred from player resources. */
export function revealedActionCount(entry:VisualEntry):number{
  if(entry.id==='doubleShield')return 2;
  const definition=ACTION_MAP[entry.id];
  if(!definition.count)return 1;
  const count=entry.count;
  if(typeof count==='number'&&Number.isInteger(count)&&count>=1&&count<=99)return count;
  // Compatibility for saved reveals created before the public count field existed.
  // Ignore the target name, which can contain arbitrary text such as "×9".
  const actionLabel=entry.label.split(' → ')[0];
  if(!actionLabel.startsWith(definition.name))return 1;
  const match=/^ ×([1-9]\d?)$/.exec(actionLabel.slice(definition.name.length));
  return match?Number(match[1]):1;
}

export function revealEffect(entry:VisualEntry):RevealEffect{
  if(entry.status!=='played')return {kind:'mark'};
  const id=effects[entry.id];
  if(id===null)return {kind:'mark'};
  if(id==='targetedGun')return {kind:'gun'};
  if(basicGestures.has(id))return {kind:'gesture',id:id as BasicGestureId};
  const count=revealedActionCount(entry);
  return {
    kind:'document',
    id:entry.id==='punch'&&count>1?'multiPunch':id as DocumentEffectId,
    count:(id==='smallShield'||id==='bigShield')&&count>1?2:1,
    // A reveal's aggregate HP delta cannot prove an individual hit or heal.
    scenario:'cast',
  };
}

export function revealedEntries(action:RoundReveal['actions'][number]):RevealedAction[]{
  // Old delayed labels have no reliable action IDs; do not guess from names.
  return action.entries??[
    {id:action.mainId??'skip',label:action.main,targetId:action.targetId,stage:'main',burstPoints:0,status:'played'},
    ...action.delayed.map(label=>({id:'skip' as const,label,stage:'delayed' as const,burstPoints:0,status:'played' as const})),
  ];
}
