import {selectRoundVoice,type VoiceFacts,type VoiceId,type VoiceCue,type ResourceEvent} from './round-feedback.ts';
export type Category = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I';
export type Phase = 'lobby'|'main'|'priorityRps'|'rps'|'delayed'|'reveal'|'finished';
export const PHASE_SECONDS:Record<Phase,number>={lobby:0,main:15,priorityRps:8,rps:8,delayed:15,reveal:5,finished:0};
export function phaseRemainingMs(deadline:number|null,serverNow:number,elapsedMs:number){
  return deadline===null?0:Math.max(0,deadline-serverNow-Math.max(0,elapsedMs));
}
export type ActionId =
  | 'accumulate'|'five6'|'five7'|'five8'|'five9'|'five10'
  | 'push'|'pull'|'mass'|'gun'|'punch'|'execute'|'super'|'plastic'|'iron'|'snap'
  | 'knife1'|'knife2'|'knife3'|'guard'|'fly'|'friction'|'heat'|'ice'
  | 'raiseFist'|'smallShield'|'doubleShield'|'bigShield'|'holyWater'|'holyBlock'
  | 'fistThunder'|'shieldThunder'|'pointThunder'|'thunder'
  | 'convert'|'cotton'|'cottonShovel'|'popShield'|'popWater'|'skip'|'smallHeal'|'bigHeal';

export interface ActionDef { id:ActionId; name:string; category:Category; cost:number; target?:boolean; group?:boolean; count?:boolean; burst?:boolean; summary:string }
export const ACTIONS: ActionDef[] = [
  {id:'accumulate',name:'积点',category:'A',cost:0,summary:'点 +2'},
  {id:'five6',name:'5换6',category:'A',cost:5,summary:'净增1点，增点受变点'},
  {id:'five7',name:'5换7',category:'A',cost:5,summary:'净增2点，特殊推拉判定'},
  {id:'five8',name:'5换8',category:'A',cost:5,summary:'净增3点'},
  {id:'five9',name:'5换9',category:'A',cost:5,summary:'净增4点，首个B/C特殊判定'},
  {id:'five10',name:'5换10',category:'A',cost:5,summary:'净增5点，高风险'},
  {id:'push',name:'推',category:'B',cost:2,target:true,burst:true,summary:'清空目标点数'},
  {id:'pull',name:'拉',category:'B',cost:3,target:true,burst:true,summary:'掠夺目标剩余点'},
  {id:'mass',name:'密集气功',category:'B',cost:4,group:true,burst:true,summary:'群体清点，无视冰块'},
  {id:'gun',name:'枪',category:'C',cost:1,target:true,count:true,summary:'每枪耗1点、伤1'},
  {id:'punch',name:'拳',category:'C',cost:0,target:true,count:true,summary:'每拳伤1，消耗拳'},
  {id:'execute',name:'点杀',category:'C',cost:6,target:true,summary:'伤7，特殊穿透'},
  {id:'super',name:'super',category:'C',cost:5,target:true,summary:'清点、爆盾水或伤5'},
  {id:'plastic',name:'塑料铲',category:'C',cost:2,target:true,summary:'抵消B/C/D或猜拳1/2/3'},
  {id:'iron',name:'铁铲',category:'C',cost:4,target:true,summary:'抵消B/C/D或猜拳3/4/5'},
  {id:'snap',name:'响指',category:'C',cost:8,group:true,summary:'向所有人打8枪'},
  {id:'knife1',name:'小角刀',category:'D',cost:1,burst:true,summary:'向每名攻击者反击2枪；无人攻击自扣1血'},
  {id:'knife2',name:'大角刀',category:'D',cost:3,burst:true,summary:'向每名攻击者反击4枪；无人攻击自扣1血'},
  {id:'knife3',name:'大大刀',category:'D',cost:5,burst:true,summary:'向每名攻击者反击7枪；无人攻击自扣2血'},
  {id:'guard',name:'防',category:'E',cost:0,summary:'每个来源伤害-3'},
  {id:'fly',name:'飞',category:'E',cost:0,summary:'枪伤-1，免疫拳'},
  {id:'friction',name:'摩擦',category:'E',cost:0,summary:'来袭效果转为资源'},
  {id:'heat',name:'热气',category:'E',cost:3,burst:true,summary:'反弹B/C并融冰'},
  {id:'ice',name:'冰块',category:'E',cost:2,burst:true,summary:'绝对防御，破冰动作被吸收'},
  {id:'raiseFist',name:'举拳',category:'F',cost:3,count:true,summary:'每个耗3点、拳+1、延判1点，最多3个'},
  {id:'smallShield',name:'举盾',category:'F',cost:7,count:true,summary:'每个耗7点、盾+1、延判3点，最多2个'},
  {id:'doubleShield',name:'举双盾',category:'F',cost:14,summary:'盾+2，延判6点'},
  {id:'bigShield',name:'举大盾',category:'F',cost:12,count:true,summary:'每个耗12点、盾+1、延判8点，最多2个'},
  {id:'holyWater',name:'圣水',category:'F',cost:6,summary:'每回合开始点+1'},
  {id:'holyBlock',name:'圣块',category:'F',cost:8,summary:'圣水与冰块一起出'},
  {id:'fistThunder',name:'拳劈',category:'G',cost:3,group:true,burst:true,summary:'举拳受3真伤并失去延判'},
  {id:'shieldThunder',name:'盾劈',category:'G',cost:3,group:true,burst:true,summary:'大小盾受3真伤'},
  {id:'pointThunder',name:'点劈',category:'G',cost:4,group:true,burst:true,summary:'A类受3真伤'},
  {id:'thunder',name:'雷劈',category:'G',cost:4,group:true,burst:true,summary:'其他G类受3真伤并失效'},
  {id:'convert',name:'n枪换n-1拳',category:'H',cost:1,count:true,summary:'消耗n点获得n-1拳'},
  {id:'cotton',name:'纺棉',category:'H',cost:6,summary:'获得8棉花'},
  {id:'cottonShovel',name:'棉花铲',category:'H',cost:0,target:true,summary:'赢伤1，输0，平重判'},
  {id:'popShield',name:'爆盾铲',category:'H',cost:0,target:true,summary:'消耗盾，按铁铲结算'},
  {id:'popWater',name:'爆水铲',category:'H',cost:0,target:true,summary:'消耗圣水，按铁铲结算'},
  {id:'smallHeal',name:'小治疗',category:'I',cost:3,summary:'整回合末回血1；遇伤害、推拉或铲子挡一次后爆裂；密无视'},
  {id:'bigHeal',name:'大治疗',category:'I',cost:5,summary:'整回合末回血2；遇伤害、推拉或铲子挡一次后爆裂；密无视'},
  {id:'skip',name:'跳过',category:'H',cost:0,summary:'本回合不行动'},
];
export const ACTION_MAP = Object.fromEntries(ACTIONS.map(a=>[a.id,a])) as Record<ActionId,ActionDef>;

export interface ActionInput { id:ActionId; targetId?:string; count?:number; burst?:number }
export interface PlayerState {
  id:string; name:string; seat:number; hp:number; points:number; fists:number; shields:number; waters:number; cotton:number;
  kills:number; alive:boolean; confirmed:boolean; swap?:{id:'five6'|'five7'|'five8'|'five9'|'five10'; added:number; hits:number; triggered:boolean};
  delayed?:{kind:'fist'|'small'|'double'|'big'; budget:number; max:number};
}
export type RpsChoice = 'rock'|'paper'|'scissors';
export interface RpsDuel { id:string; attackerId:string; targetId:string; kind:'plastic'|'iron'|'cotton'|'pop'; choices:Record<string,RpsChoice>; targetAction?:ActionId }
export interface DelayPriority { playerIds:string[]; choices:Record<string,RpsChoice>; attempts:number; order?:string[] }
export interface RevealedAction {
  id:ActionId; label:string; targetId?:string; stage:'main'|'delayed';
  count?:number; burstPoints:number; status:'played'|'failed'|'skipped';
}
export interface PublicHistoryAction {
  id:ActionId; label:string; targetId?:string; count?:number; stage:'main'|'delayed';
  burstPoints?:number; status:'played'|'failed'|'skipped'|'unknown'; waitingForRps?:boolean;
}
export interface PublicActionHistory {
  round:number;
  players:Array<{playerId:string;name:string;seat:number;actions:PublicHistoryAction[]}>;
}
interface RoundActionResult {
  playerId:string; input:ActionInput; stage:'main'|'delayed'; burstPoints:number; status:RevealedAction['status'];
}
export interface RoundReveal {
  round:number;
  actions:Array<{playerId:string;name:string;main:string;mainId?:ActionId;targetId?:string;delayed:string[];entries?:RevealedAction[]}>;
  hpChanges:Array<{playerId:string;name:string;before:number;after:number}>;
  highlights:string[];
  finish:boolean;
}
export interface GameState {
  match:number; round:number; phase:Phase; deadline:number|null; winnerIds:string[]; players:PlayerState[];
  phaseStartedAt?:number;
  submissions:Record<string,ActionInput>; delayedSubmissions:Record<string,ActionInput[]>; rps:RpsDuel[]; events:string[];
  priority?:DelayPriority; delayedQueue?:Array<{playerId:string;input:ActionInput}>; delayedIndex?:number;
  roundStartHp?:Record<string,number>; reveal?:RoundReveal; roundActionResults?:RoundActionResult[];
  pendingHeals?:Array<{playerId:string;action:'smallHeal'|'bigHeal';amount:1|2}>;
  roundVoiceFacts?:Record<string,VoiceFacts>;roundVoices?:Record<string,VoiceId>;
  resourceEvents?:ResourceEvent[];
}
export interface PublicGame {
  match:number; round:number; phase:Phase; deadline:number|null; winnerIds:string[]; confirmed:number; required:number;
  phaseStartedAt?:number; phaseDurationMs?:number;
  players:Array<Omit<PlayerState,'points'|'swap'|'delayed'>&{delayed?:PlayerState['delayed']}>; events:string[];
  rps:Array<Omit<RpsDuel,'choices'>&{submittedIds:string[]}>;
  priority?:{playerIds:string[];submittedIds:string[]};
  reveal?:RoundReveal;
  actionHistory?:PublicActionHistory;
  resourceEvents?:ResourceEvent[];
}

const nowPlus = (now:number,seconds:number)=>now+seconds*1000;
const clampCount=(n:unknown)=>Math.max(1,Math.min(99,Number.isFinite(Number(n))?Math.floor(Number(n)):1));
const def=(id:ActionId)=>ACTION_MAP[id];
const player=(g:GameState,id:string)=>g.players.find(p=>p.id===id);
const active=(g:GameState)=>g.players.filter(p=>p.alive);
const label=(g:GameState,id:string)=>player(g,id)?.name??'未知玩家';
const log=(g:GameState,msg:string)=>{g.events.unshift(`第${g.round}回合 · ${msg}`);g.events=g.events.slice(0,80)};
const facts=(g:GameState,id:string)=>((g.roundVoiceFacts??={})[id]??={results:[],acted:false,suppressEmpty:false});
function feedback(g:GameState,id:string,result:VoiceId){const f=facts(g,id);if(!f.results.includes(result))f.results.push(result);}
function effective(g:GameState,id:string){facts(g,id).suppressEmpty=true;}
function gainPoints(g:GameState,p:PlayerState,amount:number){p.points+=amount;if(amount>0)feedback(g,p.id,'R08');}
function publicGain(g:GameState,p:PlayerState,key:'fists'|'shields'|'waters'|'cotton',amount:number){if(amount<=0)return;p[key]+=amount;const f=facts(g,p.id);(f.publicGains??=[]).push(key);effective(g,p.id);}
function pointLoss(g:GameState,p:PlayerState,before:number){if(p.points<before)feedback(g,p.id,'R07');}
function clearPoints(g:GameState,p:PlayerState){const before=p.points;p.points=0;pointLoss(g,p,before);}
function resourceChange(g:GameState,p:PlayerState,resource:ResourceEvent['resource'],delta:number,cause:ResourceEvent['cause']){
  const key=resource==='shield'?'shields':'waters',actual=delta<0?-Math.min(p[key],-delta):delta;if(!actual)return;
  p[key]+=actual;const list=g.resourceEvents??=[];list.push({id:`${g.match}:${g.round}:${list.length}`,playerId:p.id,resource,delta:actual,remaining:p[key],cause});
  if(cause==='gain'){(facts(g,p.id).publicGains??=[]).push(key);effective(g,p.id);}if(cause==='destroyed')feedback(g,p.id,'R10');if(cause==='blocked')effective(g,p.id);
}
function absorbWithResource(g:GameState,p:PlayerState){const resource=p.shields>0?'shield':'water';resourceChange(g,p,resource,-1,'blocked');return resource;}
function destroyResources(g:GameState,p:PlayerState){resourceChange(g,p,'shield',-p.shields,'destroyed');resourceChange(g,p,'water',-p.waters,'destroyed');}

export function createGame(players:Array<{id:string;name:string;seat:number}>):GameState {
  return {match:1,round:0,phase:'lobby',deadline:null,winnerIds:[],players:players.map(p=>({...p,hp:10,points:0,fists:3,shields:0,waters:0,cotton:0,kills:0,alive:true,confirmed:false})),submissions:{},delayedSubmissions:{},rps:[],events:[]};
}
export function startGame(g:GameState,now=Date.now()){
  g.players.forEach(p=>Object.assign(p,{hp:10,points:0,fists:3,shields:0,waters:0,cotton:0,kills:0,alive:true,confirmed:false,swap:undefined,delayed:undefined}));
  g.round=0;g.winnerIds=[];g.events=[];g.submissions={};g.delayedSubmissions={};g.rps=[];g.priority=undefined;g.delayedQueue=undefined;g.delayedIndex=undefined;g.reveal=undefined;beginRound(g,now);return g;
}
export function rematch(g:GameState,now=Date.now()){g.match+=1;return startGame(g,now)}
function beginRound(g:GameState,now:number){
  g.round+=1;g.phase='main';g.phaseStartedAt=now;g.deadline=nowPlus(now,PHASE_SECONDS.main);g.submissions={};g.delayedSubmissions={};g.rps=[];g.priority=undefined;g.delayedQueue=undefined;g.delayedIndex=undefined;g.reveal=undefined;
  g.players.forEach(p=>{p.confirmed=false;p.swap=undefined;p.delayed=undefined;if(p.alive&&p.waters>0)p.points+=p.waters});
  g.roundStartHp=Object.fromEntries(g.players.map(p=>[p.id,p.hp]));
  g.roundActionResults=[];
  g.pendingHeals=[];
  g.roundVoiceFacts={};g.roundVoices={};g.resourceEvents=[];
  log(g,`第 ${g.round} 回合开始`);
}
export function submitMain(g:GameState,playerId:string,input:ActionInput){
  const p=player(g,playerId);if(!p||!p.alive||g.phase!=='main'||p.confirmed)throw new Error('当前不能提交动作');
  validateInput(g,p,input);g.submissions[playerId]=normalizeInput(input);p.confirmed=true;return g;
}
export function submitDelayed(g:GameState,playerId:string,inputs:ActionInput[]){
  const p=player(g,playerId);if(!p||!p.alive||g.phase!=='delayed'||!p.delayed)throw new Error('当前不能延判');
  if(g.delayedSubmissions[playerId])throw new Error('延判已经确认');
  validateDelayed(g,p,inputs);g.delayedSubmissions[playerId]=inputs.map(normalizeInput);return g;
}
export function submitRps(g:GameState,playerId:string,duelId:string,choice:RpsChoice){
  if(g.phase==='priorityRps'&&duelId==='priority'){
    if(!g.priority?.playerIds.includes(playerId))throw new Error('无权参与延判先后猜拳');
    if(g.priority.choices[playerId])throw new Error('猜拳已经确认');
    g.priority.choices[playerId]=choice;return g;
  }
  if(g.phase!=='rps')throw new Error('当前不在猜拳阶段');const d=g.rps.find(x=>x.id===duelId);if(!d||![d.attackerId,d.targetId].includes(playerId))throw new Error('无权参与本次猜拳');
  if(d.choices[playerId])throw new Error('猜拳已经确认');
  d.choices[playerId]=choice;return g;
}
function normalizeInput(input:ActionInput):ActionInput{return {id:input.id,targetId:input.targetId,count:clampCount(input.count),burst:Math.max(0,Math.min(99,Math.floor(Number(input.burst)||0)))}}
function validateInput(g:GameState,p:PlayerState,input:ActionInput){
  const a=def(input.id);if(!a)throw new Error('未知动作');if(a.target){const t=player(g,input.targetId??'');if(!t||!t.alive||t.id===p.id)throw new Error('请选择一名其他存活玩家')}
  if(input.id==='raiseFist'&&clampCount(input.count)>3)throw new Error('举拳一次最多3个');
  if((input.id==='smallShield'||input.id==='bigShield')&&clampCount(input.count)>2)throw new Error('盾一次最多举2个');
}
function nominalCost(input:ActionInput){const a=def(input.id);if(input.id==='gun'||input.id==='convert')return clampCount(input.count);if(['raiseFist','smallShield','bigShield'].includes(input.id))return a.cost*clampCount(input.count);return a.cost}
function validateDelayed(g:GameState,p:PlayerState,inputs:ActionInput[]){
  const d=p.delayed!;if(inputs.length>d.max)throw new Error('延判动作数量超过上限');inputs.forEach(i=>validateInput(g,p,i));
  if(inputs.some(i=>def(i.id).category==='F'))throw new Error('延判中不能再次使用延判类动作');
  if(inputs.filter(i=>['plastic','iron','cottonShovel','popShield','popWater'].includes(i.id)).length>1)throw new Error('每次延判最多使用一把铲子');
  const fives=inputs.filter(i=>i.id.startsWith('five'));if((d.kind==='small'||d.kind==='double')&&fives.length)throw new Error('普通盾内不能5换');
  if(d.kind==='fist'&&inputs.some(i=>!i.id.startsWith('five')&&nominalCost(i)>1))throw new Error('每个举拳只能延判一件不超过1点的事');
  const normal=inputs.filter(i=>!i.id.startsWith('five'));const sum=normal.reduce((s,i)=>s+nominalCost(i),0);
  if(sum>d.budget)throw new Error('延判点数超过额度');if(d.kind==='small'&&inputs.length===2&&normal.some(i=>nominalCost(i)>1))throw new Error('小盾做两件事时每件只能耗0或1点');
}

interface Runtime { actor:PlayerState; input:ActionInput; action:ActionDef; valid:boolean; canceled:boolean; disabled:boolean; pointCost:number; waived:boolean; burstPoints:number }
interface Effect { source:string; target:string; kind:'gun'|'punch'|'damage'|'execute'|'super'|'push'|'pull'|'mass'|'shovel'; amount:number; action:ActionId; category:Category; removed?:boolean }
interface Damage {source:string;target:string;amount:number;trueDamage?:boolean;action:ActionId}

function pay(g:GameState,p:PlayerState,input:ActionInput,waived=false):Runtime{
  const action=def(input.id);const pointCost=nominalCost(input);const r:Runtime={actor:p,input,action,valid:true,canceled:false,disabled:false,pointCost,waived,burstPoints:0};
  if(input.id==='punch'){const n=clampCount(input.count);if(p.fists<n)r.valid=false;else p.fists-=n;return r}
  if(input.id==='cottonShovel'){if(p.cotton<1)r.valid=false;else p.cotton-=1;return r}
  if(input.id==='popShield'){if(p.shields<1)r.valid=false;else resourceChange(g,p,'shield',-1,'spent');return r}
  if(input.id==='popWater'){if(p.waters<1)r.valid=false;else resourceChange(g,p,'water',-1,'spent');return r}
  if(waived&&!input.id.startsWith('five'))return r;
  if(p.points>=pointCost){p.points-=pointCost;return r}
  const shortage=pointCost-p.points;if(!action.burst){r.valid=false;return r}
  if(p.hp<shortage){r.valid=false;return r}
  p.hp-=shortage;p.points=0;r.burstPoints=shortage;feedback(g,p.id,'R06');log(g,`${p.name} 爆点消耗了 ${shortage} 血`);return r;
}

export function advanceGame(g:GameState,now=Date.now()){
  if(g.phaseStartedAt!==undefined&&now<g.phaseStartedAt)return g;
  if(g.phase==='main'){
    const all=active(g).every(p=>p.confirmed);if(all||((g.deadline??Infinity)<=now)){active(g).forEach(p=>{if(!p.confirmed){g.submissions[p.id]={id:'skip'};p.confirmed=true;feedback(g,p.id,'R19');log(g,`${p.name} 超时，本回合跳过`)}});resolveBatch(g,g.submissions,now,false)}
  }else if(g.phase==='priorityRps'){
    const priority=g.priority;const done=priority?.playerIds.every(id=>priority.choices[id]);if(done||((g.deadline??Infinity)<=now))resolvePriority(g,now);
  }else if(g.phase==='rps'){
    const done=g.rps.every(d=>d.choices[d.attackerId]&&d.choices[d.targetId]);if(done||((g.deadline??Infinity)<=now))resolveRps(g,now);
  }else if(g.phase==='delayed'){
    const eligible=active(g).filter(p=>p.delayed);const done=eligible.every(p=>g.delayedSubmissions[p.id]);if(done||((g.deadline??Infinity)<=now)){eligible.forEach(p=>{if(!g.delayedSubmissions[p.id])feedback(g,p.id,'R19');g.delayedSubmissions[p.id]??=[]});resolveDelayed(g,now)}
  }else if(g.phase==='reveal'&&(g.deadline??Infinity)<=now){
    if(g.reveal?.finish){g.phase='finished';g.phaseStartedAt=undefined;g.deadline=null}else beginRound(g,now);
  }
  return g;
}

function resolveBatch(g:GameState,inputs:Record<string,ActionInput>,now:number,delayed:boolean,finalize=true){
  const runtimes=new Map<string,Runtime>();const damage:Damage[]=[];const effects:Effect[]=[];
  const chosenAction=(id:string)=>inputs[id]?.id??'skip';
  for(const p of [...g.players].sort((a,b)=>a.seat-b.seat)){const input=inputs[p.id];if(!input)continue;const r=pay(g,p,input,delayed);runtimes.set(p.id,r);if(input.id!=='skip')facts(g,p.id).acted=true;(g.roundActionResults??=[]).push({playerId:p.id,input:{...input},stage:delayed?'delayed':'main',burstPoints:r.burstPoints,status:r.valid?'played':'failed'});if(!r.valid){feedback(g,p.id,'R18');log(g,`${p.name} 的${r.action.name}失败（资源不足）`);}else log(g,`${p.name} 选择了${r.action.name}`)}
  const valid=()=>[...runtimes.values()].filter(r=>r.valid&&!r.canceled);
  const thunderUsers=valid().filter(r=>r.input.id==='thunder');
  if(!delayed){
    if(thunderUsers.length>1)thunderUsers.forEach(r=>{r.disabled=true;feedback(g,r.actor.id,'R17');effective(g,r.actor.id);});
    else if(thunderUsers.length===1)valid().filter(r=>r.action.category==='G'&&r.actor.id!==thunderUsers[0].actor.id).forEach(r=>{r.disabled=true;feedback(g,r.actor.id,'R17');damage.push({source:thunderUsers[0].actor.id,target:r.actor.id,amount:3,trueDamage:true,action:'thunder'})});
    for(const r of valid()){
      if(r.disabled)continue;
      if(r.input.id==='fistThunder')valid().filter(x=>x.input.id==='raiseFist').forEach(x=>{x.disabled=true;feedback(g,x.actor.id,'R17');damage.push({source:r.actor.id,target:x.actor.id,amount:3,trueDamage:true,action:r.input.id})});
      if(r.input.id==='shieldThunder')valid().filter(x=>['smallShield','doubleShield','bigShield'].includes(x.input.id)).forEach(x=>damage.push({source:r.actor.id,target:x.actor.id,amount:3,trueDamage:true,action:r.input.id}));
      if(r.input.id==='pointThunder')valid().filter(x=>x.action.category==='A').forEach(x=>damage.push({source:r.actor.id,target:x.actor.id,amount:3,trueDamage:true,action:r.input.id}));
    }
  }else{
    for(const r of valid().filter(x=>x.action.category==='G'&&!x.disabled)){
      const targets=g.players.filter(p=>p.id!==r.actor.id&&p.alive).filter(p=>{const main=def(g.submissions[p.id]?.id??'skip');return r.input.id==='fistThunder'?main.id==='raiseFist':r.input.id==='shieldThunder'?['smallShield','doubleShield','bigShield'].includes(main.id):r.input.id==='pointThunder'?main.category==='A':main.category==='G'});
      targets.forEach(t=>damage.push({source:r.actor.id,target:t.id,amount:3,trueDamage:true,action:r.input.id}));
    }
  }
  // Resource gains happen even when举拳 is disabled; other disabled G actions have no effect.
  for(const r of valid()){
    const p=r.actor,id=r.input.id;if(r.disabled&&id!=='raiseFist')continue;
    if(id==='accumulate')gainPoints(g,p,2);
    if(id.startsWith('five')){const n=Number(id.replace('five',''));const added=n-5;gainPoints(g,p,n);p.swap={id:id as NonNullable<PlayerState['swap']>['id'],added,hits:0,triggered:false}}
    if(id==='convert')publicGain(g,p,'fists',Math.max(0,clampCount(r.input.count)-1));
    if(id==='cotton')publicGain(g,p,'cotton',8);
    if(id==='raiseFist'){const n=clampCount(r.input.count);publicGain(g,p,'fists',n);if(!r.disabled)p.delayed={kind:'fist',budget:n,max:n}}
    if(id==='smallShield'){const n=clampCount(r.input.count);resourceChange(g,p,'shield',n,'gain');p.delayed={kind:n===2?'double':'small',budget:3*n,max:2}}
    if(id==='doubleShield'){resourceChange(g,p,'shield',2,'gain');p.delayed={kind:'double',budget:6,max:2}}
    if(id==='bigShield'){const n=clampCount(r.input.count);resourceChange(g,p,'shield',n,'gain');p.delayed={kind:'big',budget:8*n,max:2}}
    if(id==='holyWater')resourceChange(g,p,'water',1,'gain');
    if(id==='holyBlock')resourceChange(g,p,'water',1,'gain');
    if(id==='smallHeal'||id==='bigHeal')(g.pendingHeals??=[]).push({playerId:p.id,action:id,amount:id==='smallHeal'?1:2});
  }
  // Both shovels cancel a B/C/D action (except点杀); no猜拳 then occurs.
  for(const r of valid().filter(x=>['plastic','iron'].includes(x.input.id)&&!x.disabled)){
    const t=runtimes.get(r.input.targetId??'');if(t&&t.valid&&!t.canceled&&['B','C','D'].includes(t.action.category)&&t.input.id!=='execute'){r.canceled=true;t.canceled=true;effective(g,r.actor.id);effective(g,t.actor.id);log(g,`${r.actor.name} 的${r.action.name}与${t.actor.name}的${t.action.name}完全抵消`)}
  }
  const hostile=(r:Runtime,targetId:string)=>r.valid&&!r.canceled&&!r.disabled&&r.actor.id!==targetId&&((r.input.targetId===targetId)||r.action.group)&&['B','C','D'].includes(r.action.category);
  const melted=valid().some(r=>r.input.id==='heat'&&!r.disabled);
  for(const r of valid()){
    if(r.canceled||r.disabled)continue;const p=r.actor,i=r.input,a=r.action;
    if(a.category==='G'||a.category==='I'||['accumulate','five6','five7','five8','five9','five10','convert','cotton','raiseFist','smallShield','doubleShield','bigShield','holyWater','holyBlock','guard','fly','friction','heat','ice','skip'].includes(i.id))continue;
    if(['knife1','knife2','knife3'].includes(i.id)){
      const attackers=valid().filter(x=>hostile(x,p.id));const shots=i.id==='knife1'?2:i.id==='knife2'?4:7;if(!attackers.length)damage.push({source:p.id,target:p.id,amount:i.id==='knife3'?2:1,action:i.id});else attackers.forEach(x=>effects.push({source:p.id,target:x.actor.id,kind:'gun',amount:shots,action:i.id,category:'D'}));continue;
    }
    if(a.category==='B'){
      const triggers=valid().filter(x=>hostile(x,p.id)||(['knife1','knife2','knife3'].includes(x.input.id)&&(a.group||i.targetId===x.actor.id)));if(triggers.length){
        triggers.filter(x=>x.input.id!=='execute'||x.input.targetId!==p.id).forEach(x=>effects.push({source:p.id,target:x.actor.id,kind:'gun',amount:a.cost,action:i.id,category:'B'}));
        if(triggers.some(x=>x.input.id==='execute'&&x.input.targetId===p.id))log(g,`${p.name} 的${a.name}反击被点杀压制`);
        continue;
      }
      const targets=a.group?g.players.filter(x=>x.alive&&x.id!==p.id):[player(g,i.targetId??'')].filter(Boolean) as PlayerState[];
      targets.forEach(t=>effects.push({source:p.id,target:t.id,kind:i.id==='push'?'push':i.id==='pull'?'pull':'mass',amount:a.cost,action:i.id,category:'B'}));continue;
    }
    if(i.id==='gun'||i.id==='punch')effects.push({source:p.id,target:i.targetId!,kind:i.id,amount:clampCount(i.count),action:i.id,category:'C'});
    if(i.id==='snap')g.players.filter(x=>x.alive&&x.id!==p.id).forEach(t=>effects.push({source:p.id,target:t.id,kind:'gun',amount:8,action:i.id,category:'C'}));
    if(i.id==='execute'){
      const t=runtimes.get(i.targetId??'');const mutual=t?.input.id==='execute'&&t.input.targetId===p.id;if(mutual){r.canceled=true;t!.canceled=true;effective(g,p.id);effective(g,t!.actor.id);log(g,`${p.name} 与${t!.actor.name}的点杀完全抵消`);continue}
      if(t&&t.valid&&!t.canceled&&!t.disabled&&['B','C','D'].includes(t.action.category)){if(t.input.id==='punch')publicGain(g,p,'fists',clampCount(t.input.count)*2);else gainPoints(g,p,Math.max(1,nominalCost(t.input))*2);if(t.input.id==='gun'&&clampCount(t.input.count)===1)damage.push({source:p.id,target:t.actor.id,amount:1,action:i.id});}
      else effects.push({source:p.id,target:i.targetId!,kind:'execute',amount:7,action:i.id,category:'C'});
    }
    if(i.id==='super')effects.push({source:p.id,target:i.targetId!,kind:'super',amount:5,action:i.id,category:'C'});
    if(['plastic','iron','cottonShovel','popShield','popWater'].includes(i.id))effects.push({source:p.id,target:i.targetId!,kind:'shovel',amount:0,action:i.id,category:i.id==='cottonShovel'||i.id.startsWith('pop')?'H':'C'});
  }
  // 点杀吸收目标的B/C/D动作：其原动作不能再反伤点杀者，群攻对其他人仍按规则结算。
  for(const r of valid().filter(x=>x.input.id==='execute'&&!x.disabled)){
    const target=runtimes.get(r.input.targetId??'');
    if(!target?.valid||target.canceled||target.disabled||!['B','C','D'].includes(target.action.category))continue;
    for(const e of effects.filter(e=>e.source===target.actor.id&&e.target===r.actor.id&&!e.removed))e.removed=true;
  }
  // Heat and 防 reflect super; heat reflects B/C except点杀. 飞 nullifies super.
  for(const e of effects){const targetAction=chosenAction(e.target);if(targetAction==='heat'&&e.category!=='D'&&e.kind!=='execute'&&['B','C'].includes(e.category)){const old=e.source;e.source=e.target;e.target=old;effective(g,e.source);log(g,`${label(g,e.source)} 用热气反弹了${def(e.action).name}`)}else if(targetAction==='guard'&&e.kind==='super'){const old=e.source;e.source=e.target;e.target=old;effective(g,e.source)}else if(targetAction==='fly'&&e.kind==='super'){e.removed=true;effective(g,e.target);}}
  // A pending heal absorbs the entire source before a later 5换9/10 can react.
  // Main healing cannot coexist with a defensive main action; delayed actions run one at a time.
  protectWithHealing(g,effects,damage);
  // 5换9/10 special first incoming source; pulls never affect 5换9.
  for(const t of g.players){const incoming=effects.filter(e=>!e.removed&&e.target===t.id&&['B','C'].includes(e.category)).sort((a,b)=>(player(g,a.source)?.seat??99)-(player(g,b.source)?.seat??99));if(!t.swap)continue;
    if(t.swap.id==='five9'){incoming.filter(e=>e.kind==='pull').forEach(e=>{e.removed=true;effective(g,t.id);});const first=incoming.find(e=>!e.removed&&e.kind!=='pull');if(first&&!t.swap.triggered){t.swap.triggered=true;clearPoints(g,t);effective(g,t.id);effective(g,first.source);first.removed=true;log(g,`${t.name} 的5换9化解了首个来袭动作`)}}
    if(t.swap.id==='five10'){const first=incoming.find(e=>!e.removed);if(first&&!t.swap.triggered){t.swap.triggered=true;clearPoints(g,t);destroyResources(g,t);first.removed=true;damage.push({source:first.source,target:t.id,amount:5,action:'five10'});log(g,`${t.name} 的5换10被触发`)}}
  }
  // Ice blocks in seat order. 密 ignores it; heat melts all ice. Breaker is absorbed and opens later effects.
  if(!melted)for(const t of g.players){const ta=chosenAction(t.id);if(ta!=='ice'&&ta!=='holyBlock')continue;let intact=true;for(const e of effects.filter(x=>x.target===t.id&&!x.removed).sort((a,b)=>(player(g,a.source)?.seat??99)-(player(g,b.source)?.seat??99))){if(e.kind==='mass')continue;if(intact){e.removed=true;effective(g,t.id);if(['execute','push','pull'].includes(e.kind)){intact=false;effective(g,e.source);log(g,`${def(e.action).name}击碎了${t.name}的冰块，但破冰动作被吸收`)}}}}
  else if(g.players.some(t=>['ice','holyBlock'].includes(chosenAction(t.id))))valid().filter(r=>r.input.id==='heat').forEach(r=>effective(g,r.actor.id));
  cancelOpposed(g,effects);
  // 热气与摩擦是特殊交互：每个有效热气来源令摩擦者失去3血，且摩擦不算空摩。
  const heatSources=valid().filter(r=>r.input.id==='heat'&&!r.disabled);
  // Current-turn defenses and cotton.
  for(const t of g.players){const ta=chosenAction(t.id);let frictionHits=0;
    if(ta==='friction')for(const heat of heatSources){if(heat.actor.id===t.id)continue;frictionHits++;damage.push({source:heat.actor.id,target:t.id,amount:3,action:'heat'})}
    for(const e of effects.filter(x=>x.target===t.id&&!x.removed)){
      const beforeAmount=e.amount;
      if(ta==='guard'){if(e.kind==='push'||e.kind==='pull')e.removed=true;else if(['gun','punch','damage'].includes(e.kind))e.amount=Math.max(0,e.amount-3)}
      if(ta==='fly'){if(e.kind==='push'||e.kind==='pull'||e.kind==='punch'||e.kind==='super')e.removed=true;else if(e.kind==='gun')e.amount=Math.max(0,e.amount-1)}
      if(ta==='friction'){
        frictionHits++;
        if(e.kind!=='execute'){
          if(e.kind==='punch')publicGain(g,t,'fists',e.amount);
          else gainPoints(g,t,e.kind==='gun'||e.kind==='damage'?e.amount:Math.max(1,def(e.action).cost));
          e.removed=true;
        }
      }
      if(ta==='cotton'&&t.cotton>0&&!e.removed){if(['push','pull','mass'].includes(e.kind)){t.cotton-=1;e.removed=true}else if(['gun','punch','damage'].includes(e.kind)){const used=Math.min(t.cotton,e.amount);t.cotton-=used;e.amount-=used}}
      if(e.removed||e.amount<beforeAmount)effective(g,t.id);
    }if(ta==='friction'&&frictionHits===0)damage.push({source:t.id,target:t.id,amount:2,action:'friction'})}
  // Shields/water stop one still-effective C/D source. B and点杀 bypass; super has its own rule.
  for(const e of effects.filter(x=>!x.removed&&x.amount>0)){const t=player(g,e.target)!;if(['C','D'].includes(e.category)&&e.kind!=='execute'&&e.kind!=='super'&&(t.shields>0||t.waters>0)){const name=t.shields>0?'盾':'圣水';absorbWithResource(g,t);effective(g,e.source);e.removed=true;log(g,`${t.name} 的${name}挡住了一次攻击`)}}
  const protectedPulls=new Map<Effect,number>();
  for(const t of g.players){
    if(t.swap?.id!=='five7')continue;
    const incoming=effects.filter(e=>!e.removed&&e.target===t.id&&(e.kind==='push'||e.kind==='pull')).sort((a,b)=>(player(g,a.source)?.seat??99)-(player(g,b.source)?.seat??99));
    const first=incoming[0];
    const clearing=effects.some(e=>!e.removed&&e.target===t.id&&(e.kind==='mass'||e.kind==='super'));
    if(first?.kind==='pull'&&!clearing){const n=Math.min(t.swap.added,t.points);t.points-=n;if(n>0)feedback(g,t.id,'R07');t.swap.added-=n;t.swap.hits++;protectedPulls.set(first,n)}
  }
  const pulls:Effect[]=[];
  for(const e of effects.filter(x=>!x.removed)){
    const t=player(g,e.target);if(!t)continue;
    if(e.kind==='super'){const had=t.points>0||t.shields>0||t.waters>0;clearPoints(g,t);if(t.shields||t.waters)destroyResources(g,t);else damage.push({source:e.source,target:e.target,amount:5,action:e.action});if(had)effective(g,e.source);continue}
    if(e.kind==='push'||e.kind==='mass'){const before=t.points;applyPointHit(t,e.kind);pointLoss(g,t,before);if(t.points<before)effective(g,e.source);else if(t.swap?.id==='five6'||t.swap?.id==='five7')effective(g,t.id);continue}if(e.kind==='pull'){pulls.push(e);continue}
    if(e.kind==='shovel'){g.rps.push({id:`${g.round}-${e.source}-${e.target}-${g.rps.length}`,attackerId:e.source,targetId:e.target,kind:e.action==='plastic'?'plastic':e.action==='cottonShovel'?'cotton':e.action==='iron'?'iron':'pop',choices:{},targetAction:chosenAction(e.target)});continue}
    if(e.amount>0)damage.push({source:e.source,target:e.target,amount:e.amount,action:e.action});
  }
  for(const e of pulls.sort((a,b)=>(player(g,a.source)?.seat??99)-(player(g,b.source)?.seat??99))){const s=player(g,e.source)!,t=player(g,e.target)!;const before=t.points;const stolen=protectedPulls.get(e)??takeForPull(t);pointLoss(g,t,before);gainPoints(g,s,stolen);if(stolen>0)effective(g,s.id);else if(t.swap?.id==='five6'||t.swap?.id==='five7')effective(g,t.id);}
  applyDamage(g,damage);
  g.players.forEach(p=>{if(p.hp<=0)p.alive=false});
  if(finalize){if(g.rps.length){g.phase='rps';g.phaseStartedAt=now;g.deadline=nowPlus(now,PHASE_SECONDS.rps)}else afterActionStage(g,now,delayed)}
}

function protectWithHealing(g:GameState,effects:Effect[],damage:Damage[]){
  const incoming=[
    ...effects.filter(e=>!e.removed&&e.source!==e.target&&e.kind!=='mass'&&(e.amount>0||e.kind==='shovel')).map(e=>({source:e.source,target:e.target,action:e.action,absorb:()=>{e.removed=true}})),
    ...damage.filter(d=>d.source!==d.target&&d.amount>0).map(d=>({source:d.source,target:d.target,action:d.action,absorb:()=>{d.amount=0}})),
  ].sort((a,b)=>(player(g,a.source)?.seat??99)-(player(g,b.source)?.seat??99));
  for(const hit of incoming){
    const index=(g.pendingHeals??[]).findIndex(h=>h.playerId===hit.target);
    if(index<0)continue;
    const [heal]=g.pendingHeals!.splice(index,1);hit.absorb();effective(g,hit.target);
    log(g,`${label(g,hit.target)} 的${def(heal.action).name}被${label(g,hit.source)}的${def(hit.action).name}打爆，抵挡本次效果，不再回血`);
  }
}

function cancelOpposed(g:GameState,effects:Effect[]){
  const ps=[...g.players];for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
    const a=effects.filter(e=>!e.removed&&e.source===ps[i].id&&e.target===ps[j].id&&(e.kind==='gun'||e.kind==='punch'));
    const b=effects.filter(e=>!e.removed&&e.source===ps[j].id&&e.target===ps[i].id&&(e.kind==='gun'||e.kind==='punch'));
    const left=Math.min(a.reduce((s,e)=>s+e.amount,0),b.reduce((s,e)=>s+e.amount,0));for(const arr of [a,b]){let n=left;for(const e of arr){const used=Math.min(n,e.amount);e.amount-=used;n-=used;if(!e.amount)e.removed=true}}if(left>0){effective(g,ps[i].id);effective(g,ps[j].id);log(g,`${ps[i].name} 与${ps[j].name}的枪拳互相抵消了 ${left} 点`);}
  }
}
function applyPointHit(t:PlayerState,kind:'push'|'mass'){
  const s=t.swap;if(!s){t.points=0;return}if(s.id==='five6'){const n=Math.min(s.added,t.points);t.points-=n;s.added-=n;return}if(s.id==='five7'&&kind==='push'){if(s.hits++===0){const n=Math.min(s.added,t.points);t.points-=n;s.added-=n}else t.points=0;return}t.points=0;
}
function takeForPull(t:PlayerState){const s=t.swap;if(s?.id==='five9')return 0;if(s?.id==='five6'){const n=Math.min(s.added,t.points);t.points-=n;s.added-=n;return n}if(s?.id==='five7'&&s.hits++===0){const n=Math.min(s.added,t.points);t.points-=n;s.added-=n;return n}const n=t.points;t.points=0;return n}
function applyDamage(g:GameState,damage:Damage[]){
  for(const d of damage.filter(x=>x.amount>0).sort((a,b)=>(player(g,a.source)?.seat??99)-(player(g,b.source)?.seat??99))){const t=player(g,d.target),s=player(g,d.source);if(!t)continue;const before=t.hp;t.hp-=d.amount;feedback(g,t.id,d.source===d.target?'R06':'R05');if(s&&s.id!==t.id)effective(g,s.id);log(g,`${s?.name??t.name} 的${def(d.action).name}令${t.name}失去 ${d.amount} 血`);if(before>0&&t.hp<=0&&s&&s.id!==t.id){s.kills+=1;feedback(g,s.id,'R04');log(g,`${s.name} 淘汰了${t.name}`)}}
}
function afterActionStage(g:GameState,now:number,delayed:boolean){
  if(delayed){finishRound(g,now);return}
  const eligible=active(g).filter(p=>p.delayed).sort((a,b)=>a.seat-b.seat);
  if(!eligible.length){finishRound(g,now);return}
  g.priority={playerIds:eligible.map(p=>p.id),choices:{},attempts:0,order:eligible.length===1?[eligible[0].id]:undefined};
  g.phase=eligible.length===1?'delayed':'priorityRps';g.phaseStartedAt=now;g.deadline=nowPlus(now,eligible.length===1?PHASE_SECONDS.delayed:PHASE_SECONDS.priorityRps);
}
function resolvePriority(g:GameState,now:number){
  const priority=g.priority;if(!priority)return;
  const ids=priority.playerIds;const selected=ids.filter(id=>priority.choices[id]);
  if(ids.length===2&&selected.length===2&&priority.choices[ids[0]]===priority.choices[ids[1]]&&priority.attempts<2){
    priority.choices={};priority.attempts++;g.phaseStartedAt=now;g.deadline=nowPlus(now,PHASE_SECONDS.priorityRps);log(g,'延判先后猜拳平局，重新猜拳');return;
  }
  const score=(id:string)=>ids.reduce((total,other)=>{
    if(id===other)return total;
    const own=priority.choices[id],opponent=priority.choices[other];
    return total+(own&&!opponent?1:!own&&opponent?-1:own&&opponent&&own!==opponent?(beats(own,opponent)?1:-1):0);
  },0);
  priority.order=[...ids].sort((a,b)=>score(b)-score(a)||(player(g,a)?.seat??99)-(player(g,b)?.seat??99));
  g.phase='delayed';g.phaseStartedAt=now;g.deadline=nowPlus(now,PHASE_SECONDS.delayed);
  log(g,`${priority.order.map(id=>label(g,id)).join('、')} 依次延判`);
}
function resolveDelayed(g:GameState,now:number){
  const order=g.priority?.order??active(g).filter(p=>p.delayed).sort((a,b)=>a.seat-b.seat).map(p=>p.id);
  g.delayedQueue=order.flatMap(playerId=>(g.delayedSubmissions[playerId]??[]).map(input=>({playerId,input})));
  g.delayedIndex=0;advanceDelayedQueue(g,now);
}
function advanceDelayedQueue(g:GameState,now:number){
  const queue=g.delayedQueue??[];
  while((g.delayedIndex??0)<queue.length){
    const item=queue[g.delayedIndex??0];g.delayedIndex=(g.delayedIndex??0)+1;
    const actor=player(g,item.playerId);if(!actor?.alive){(g.roundActionResults??=[]).push({playerId:item.playerId,input:{...item.input},stage:'delayed',burstPoints:0,status:'skipped'});log(g,`${label(g,item.playerId)} 在延判行动前已阵亡，动作跳过`);continue}
    resolveBatch(g,{[item.playerId]:item.input},now,true,false);
    if(g.rps.length){g.phase='rps';g.phaseStartedAt=now;g.deadline=nowPlus(now,PHASE_SECONDS.rps);return}
  }
  g.delayedQueue=undefined;g.delayedIndex=undefined;finishRound(g,now);
}
function beats(a:string,b:string){return (a==='rock'&&b==='scissors')||(a==='scissors'&&b==='paper')||(a==='paper'&&b==='rock')}
function randomChoice(): 'rock'|'paper'|'scissors' {return ['rock','paper','scissors'][Math.floor(Math.random()*3)] as 'rock'|'paper'|'scissors'}
function resolveRps(g:GameState,now:number){
  const damage:Damage[]=[];const reroll:RpsDuel[]=[];
  for(const d of g.rps){
    let a=d.choices[d.attackerId],b=d.choices[d.targetId];if(!a&&!b){a=randomChoice();b=randomChoice()}
    const attackerWins=a&&!b?true:!a&&b?false:a===b?null:beats(a!,b!);
    if(d.kind==='cotton'&&attackerWins===null){d.choices={};reroll.push(d);continue}
    let amount=0;
    if(d.kind==='cotton')amount=attackerWins?1:0;
    else{const [lose,tie,win]=d.kind==='plastic'?[1,2,3]:[3,4,5];amount=attackerWins===true?win:attackerWins===false?lose:tie}
    const target=player(g,d.targetId)!,before=amount,defense=d.targetAction;
    if(defense==='guard')amount=Math.max(0,amount-3);
    if(defense==='cotton'&&target.cotton>0){const used=Math.min(target.cotton,amount);target.cotton-=used;amount-=used}
    if(amount<before)effective(g,target.id);
    if(amount&&['plastic','iron'].includes(d.kind)&&(target.shields>0||target.waters>0)){
      const resource=absorbWithResource(g,target);amount=0;effective(g,d.attackerId);
      log(g,`${target.name} 的${resource==='shield'?'盾':'圣水'}挡住了一次攻击`);
    }
    if(amount)damage.push({source:d.attackerId,target:d.targetId,amount,action:d.kind==='cotton'?'cottonShovel':d.kind==='plastic'?'plastic':'iron'});
  }
  applyDamage(g,damage);g.players.forEach(p=>{if(p.hp<=0)p.alive=false});if(reroll.length){g.rps=reroll;g.phaseStartedAt=now;g.deadline=nowPlus(now,PHASE_SECONDS.rps);return}g.rps=[];if(g.delayedQueue){g.phase='delayed';advanceDelayedQueue(g,now)}else afterActionStage(g,now,false);
}
function finishRound(g:GameState,now:number){
  // Settle once, only after every delayed action and shovel duel has completed.
  const heals=g.pendingHeals??[];g.pendingHeals=[];
  for(const heal of heals){const p=player(g,heal.playerId);if(p?.alive&&p.hp>0){p.hp+=heal.amount;feedback(g,p.id,'R21');log(g,`${p.name} 的${def(heal.action).name}在整回合结束时恢复 ${heal.amount} 血`)}}
  const alivePlayers=active(g);let finish=false;
  if(alivePlayers.length===1){finish=true;g.winnerIds=[alivePlayers[0].id];log(g,`${alivePlayers[0].name} 成为最后的幸存者`)}
  else if(alivePlayers.length===0){finish=true;const max=Math.max(...g.players.map(p=>p.kills));const winners=g.players.filter(p=>p.kills===max);g.winnerIds=winners.length===1?[winners[0].id]:[];log(g,winners.length===1?`${winners[0].name} 凭人头数获胜`:'所有玩家阵亡，本局平局')}
  g.roundVoices={};
  for(const p of g.players){
    if((g.roundStartHp?.[p.id]??p.hp)>0&&!p.alive)feedback(g,p.id,'R03');
    if(facts(g,p.id).publicGains?.some(key=>p[key]>0))feedback(g,p.id,'R09');
    if(finish&&g.winnerIds.includes(p.id))feedback(g,p.id,'R01');
    else if(finish&&!g.winnerIds.length)feedback(g,p.id,'R02');
    const voice=selectRoundVoice(facts(g,p.id));if(voice)g.roundVoices[p.id]=voice;
  }
  const describe=(input:ActionInput)=>`${def(input.id).name}${def(input.id).count&&clampCount(input.count)>1?` ×${clampCount(input.count)}`:''}${input.targetId?` → ${label(g,input.targetId)}`:''}`;
  const publicCount=(input:ActionInput)=>def(input.id).count?{count:clampCount(input.count)}:{};
  g.reveal={
    round:g.round,
    actions:[...g.players].sort((a,b)=>a.seat-b.seat).map(p=>{
      const main=g.submissions[p.id]??{id:'skip' as const};
      const results=(g.roundActionResults??[]).filter(result=>result.playerId===p.id);
      const entries:RevealedAction[]=results.map(result=>({id:result.input.id,label:describe(result.input),targetId:result.input.targetId,...publicCount(result.input),stage:result.stage,burstPoints:result.burstPoints,status:result.status}));
      if(!entries.some(entry=>entry.stage==='main'))entries.unshift({id:main.id,label:describe(main),targetId:main.targetId,...publicCount(main),stage:'main',burstPoints:0,status:main.id==='skip'?'skipped':'played'});
      return{playerId:p.id,name:p.name,main:describe(main),mainId:main.id,targetId:main.targetId,delayed:(g.delayedSubmissions[p.id]??[]).map(describe),entries};
    }),
    hpChanges:g.players.filter(p=>(g.roundStartHp?.[p.id]??p.hp)!==p.hp).map(p=>({playerId:p.id,name:p.name,before:g.roundStartHp?.[p.id]??p.hp,after:p.hp})),
    highlights:g.events.filter(e=>e.startsWith(`第${g.round}回合 ·`)&&/爆点|抵消|失去|反弹|击碎|淘汰|幸存者|获胜|平局|治疗/.test(e)).slice(0,4),
    finish,
  };
  g.phase='reveal';g.phaseStartedAt=now;g.deadline=nowPlus(now,PHASE_SECONDS.reveal);
}
/** Announced actions only: never reconstruct unexecuted delayed submissions or their queue. */
function publicActionHistory(g:GameState):PublicActionHistory|undefined{
  if(!['priorityRps','rps','delayed','reveal','finished'].includes(g.phase))return;
  const records=g.roundActionResults??[];
  const describe=(input:ActionInput,stage:PublicHistoryAction['stage'],status:PublicHistoryAction['status'],burstPoints?:number):PublicHistoryAction|undefined=>{
    if(!Object.hasOwn(ACTION_MAP,input.id))return;
    const action=def(input.id);
    const target=action.target&&input.targetId?player(g,input.targetId):undefined;
    const count=action.count?clampCount(input.count):undefined;
    // 'played' means announced, not necessarily successful: an opponent may have canceled its effect.
    return {id:input.id,label:`${action.name}${count!==undefined&&count>1?` ×${count}`:''}${target?` → ${target.name}`:''}`,
      ...(target?{targetId:target.id}:{}),...(count!==undefined?{count}:{}),stage,
      ...(burstPoints!==undefined&&Number.isFinite(burstPoints)&&burstPoints>=0?{burstPoints}:{}),
      status:input.id==='skip'?'skipped':status};
  };
  const players=[...g.players].sort((a,b)=>a.seat-b.seat).map(p=>{
    const actions:PublicHistoryAction[]=[];
    for(const record of records){
      if(record.playerId!==p.id||(record.stage!=='main'&&record.stage!=='delayed'))continue;
      const status=['played','failed','skipped'].includes(record.status)?record.status:'unknown';
      const action=describe(record.input,record.stage,status,record.burstPoints);
      if(action)actions.push(action);
    }
    // Older saves have no execution ledger. Their announced main choice is known, its outcome is not.
    if(!actions.some(action=>action.stage==='main')&&g.submissions[p.id]){
      const main=describe(g.submissions[p.id],'main','unknown');if(main)actions.unshift(main);
    }
    if(g.phase==='rps'){
      const stage=g.delayedQueue!==undefined?'delayed':'main';
      for(const duel of g.rps){
        if(duel.attackerId!==p.id)continue;
        const ids:ActionId[]=duel.kind==='plastic'?['plastic']:duel.kind==='iron'?['iron']:duel.kind==='cotton'?['cottonShovel']:['popShield','popWater'];
        // Only the pending executed action is waiting; an earlier same-target shovel has already settled.
        const action=actions.findLast(entry=>entry.stage===stage&&entry.targetId===duel.targetId&&ids.includes(entry.id)&&(entry.status==='played'||entry.status==='unknown'));
        if(action)action.waitingForRps=true;
      }
    }
    return {playerId:p.id,name:p.name,seat:p.seat,actions};
  });
  return {round:g.round,players};
}
export function publicGame(g:GameState):PublicGame{
  const players=g.players.map(p=>({id:p.id,name:p.name,seat:p.seat,hp:p.hp,fists:p.fists,shields:p.shields,waters:p.waters,cotton:p.cotton,kills:p.kills,alive:p.alive,confirmed:g.phase==='delayed'?Boolean(g.delayedSubmissions[p.id]):p.confirmed,delayed:g.phase==='delayed'?p.delayed:undefined}));
  const required=g.phase==='main'?active(g).length:g.phase==='delayed'?active(g).filter(p=>p.delayed).length:0;
  const confirmed=g.phase==='main'?active(g).filter(p=>p.confirmed).length:g.phase==='delayed'?Object.keys(g.delayedSubmissions).length:0;
  const rps=g.rps.map(({choices,...d})=>({...d,submittedIds:Object.keys(choices)}));
  const priority=g.phase==='priorityRps'&&g.priority?{playerIds:g.priority.playerIds,submittedIds:Object.keys(g.priority.choices)}:undefined;
  const resourceEvents=g.resourceEvents?.map(({id,playerId,resource,delta,remaining,cause})=>({id,playerId,resource,delta,remaining,cause}));
  const phaseDurationMs=PHASE_SECONDS[g.phase]*1000;
  const phaseStartedAt=g.phaseStartedAt??(g.deadline!==null&&phaseDurationMs>0?g.deadline-phaseDurationMs:undefined);
  return {match:g.match,round:g.round,phase:g.phase,deadline:g.deadline,phaseStartedAt,phaseDurationMs,winnerIds:g.winnerIds,players,events:g.events,rps,priority,reveal:g.phase==='reveal'||g.phase==='finished'?g.reveal:undefined,actionHistory:publicActionHistory(g),resourceEvents,confirmed,required};
}
/** Called only with the authenticated room member, never a client-selected id. */
export function selfVoice(g:GameState,playerId?:string):VoiceCue|undefined{
  if(g.phase!=='reveal'||!playerId||!player(g,playerId))return;
  const id=g.roundVoices?.[playerId];return id?{key:`${g.match}:${g.round}:${playerId}`,id}:undefined;
}
