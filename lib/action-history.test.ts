import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_MAP, advanceGame, createGame, publicGame, rematch, startGame,
  submitDelayed, submitMain, submitRps, type ActionInput, type GameState,
} from './game.ts';

const make=(count=2)=>startGame(createGame(Array.from({length:count},(_,i)=>({id:String.fromCharCode(97+i),name:`玩家${i+1}`,seat:i+1}))),0);
const history=(g:GameState)=>publicGame(g).actionHistory!;
const actions=(g:GameState,id:string)=>history(g).players.find(p=>p.playerId===id)!.actions;
function prepareTwoDelayed(){
  const g=make(3);g.players[0].points=12;g.players[1].points=12;
  submitMain(g,'a',{id:'bigShield'});submitMain(g,'b',{id:'bigShield'});submitMain(g,'c',{id:'guard'});advanceGame(g,1);
  submitRps(g,'a','priority','rock');submitRps(g,'b','priority','scissors');advanceGame(g,2);
  assert.equal(g.phase,'delayed');return g;
}

test('等待室与主阶段始终隐藏出招，包括全员已确认但尚未结算',()=>{
  const lobby=createGame([{id:'a',name:'甲',seat:1},{id:'b',name:'乙',seat:2}]);
  assert.equal(publicGame(lobby).actionHistory,undefined);
  const g=make();submitMain(g,'a',{id:'accumulate'});
  assert.equal(publicGame(g).actionHistory,undefined);
  submitMain(g,'b',{id:'guard'});
  assert.equal(publicGame(g).actionHistory,undefined);
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/submissions|"id":"accumulate"/);
  advanceGame(g,1);assert.equal(history(g).round,1);
});

test('主阶段结算后延判面板可见所有主动作、目标、公开数量及支付失败',()=>{
  const g=make(3);g.players[0].points=9;
  submitMain(g,'a',{id:'raiseFist',count:3});submitMain(g,'b',{id:'gun',targetId:'c',count:6});submitMain(g,'c',{id:'guard'});advanceGame(g,1);
  assert.equal(g.phase,'delayed');assert.equal(publicGame(g).reveal,undefined);
  assert.deepEqual(actions(g,'a'),[{id:'raiseFist',label:'举拳 ×3',count:3,stage:'main',burstPoints:0,status:'played'}]);
  assert.deepEqual(actions(g,'b'),[{id:'gun',label:'枪 ×6 → 玩家3',targetId:'c',count:6,stage:'main',burstPoints:0,status:'failed'}]);
  assert.deepEqual(actions(g,'c'),[{id:'guard',label:'防',stage:'main',burstPoints:0,status:'played'}]);
});

test('延判先后猜拳期间主招已公开，猜拳选择与未决顺序不公开',()=>{
  const g=make();g.players.forEach(p=>{p.points=3});
  submitMain(g,'a',{id:'raiseFist'});submitMain(g,'b',{id:'raiseFist'});advanceGame(g,1);
  assert.equal(g.phase,'priorityRps');submitRps(g,'a','priority','rock');
  assert.deepEqual(history(g).players.map(p=>p.actions.map(a=>a.id)),[['raiseFist'],['raiseFist']]);
  assert.deepEqual(publicGame(g).priority,{playerIds:['a','b'],submittedIds:['a']});
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/rock|"choices"|"order"/);
});

test('延判确认前与全部确认尚未执行时都不泄漏后招',()=>{
  const g=prepareTwoDelayed();
  submitDelayed(g,'a',[{id:'plastic',targetId:'c'},{id:'gun',targetId:'c',count:6}]);
  assert.equal(history(g).players.flatMap(p=>p.actions).length,3);
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/plastic|"id":"gun"|delayedQueue|delayedSubmissions/);
  submitDelayed(g,'b',[{id:'gun',targetId:'a',count:7}]);
  assert.equal(history(g).players.flatMap(p=>p.actions).length,3);
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/plastic|"id":"gun"/);
});

test('延判铲子暂停只公开已执行前缀，当前铲标为猜拳中，未执行队列不公开',()=>{
  const g=prepareTwoDelayed();
  submitDelayed(g,'a',[{id:'plastic',targetId:'c'},{id:'gun',targetId:'c',count:6}]);
  submitDelayed(g,'b',[{id:'gun',targetId:'a',count:7}]);advanceGame(g,3);
  assert.equal(g.phase,'rps');assert.equal(g.delayedQueue!.length,3);assert.equal(g.delayedIndex,1);
  assert.deepEqual(actions(g,'a').map(a=>[a.id,a.stage,a.waitingForRps]),[['bigShield','main',undefined],['plastic','delayed',true]]);
  assert.deepEqual(actions(g,'b').map(a=>a.id),['bigShield']);
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/"id":"gun"|delayedQueue|delayedIndex|delayedSubmissions/);
  const duel=g.rps[0];submitRps(g,'a',duel.id,'paper');
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/paper|"choices"/);
  submitRps(g,'c',duel.id,'rock');advanceGame(g,4);
  assert.equal(g.phase,'reveal');
  assert.deepEqual(actions(g,'a').map(a=>a.id),['bigShield','plastic','gun']);
  assert.deepEqual(actions(g,'b').map(a=>a.id),['bigShield','gun']);
  assert.equal(history(g).players.flatMap(p=>p.actions).some(a=>a.waitingForRps),false);
});

test('主阶段铲子猜拳已有主招；棉花平局重猜不重复记录、不提前完成',()=>{
  const g=make();g.players[0].cotton=1;
  submitMain(g,'a',{id:'cottonShovel',targetId:'b'});submitMain(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.phase,'rps');assert.equal(actions(g,'a')[0].waitingForRps,true);
  const duel=g.rps[0];submitRps(g,'a',duel.id,'rock');submitRps(g,'b',duel.id,'rock');advanceGame(g,2);
  assert.equal(g.phase,'rps');assert.equal(actions(g,'a').length,1);assert.equal(actions(g,'a')[0].waitingForRps,true);
  assert.deepEqual(publicGame(g).rps[0].submittedIds,[]);
  submitRps(g,'a',duel.id,'paper');submitRps(g,'b',duel.id,'rock');advanceGame(g,3);
  assert.equal(g.phase,'reveal');assert.equal(actions(g,'a')[0].waitingForRps,undefined);
});

test('同一目标的旧主阶段铲子不能误标为当前延判猜拳中',()=>{
  const g=make();g.phase='rps';g.delayedQueue=[];
  g.roundActionResults=[
    {playerId:'a',input:{id:'plastic',targetId:'b'},stage:'main',burstPoints:0,status:'played'},
    {playerId:'a',input:{id:'plastic',targetId:'b'},stage:'delayed',burstPoints:0,status:'played'},
  ];
  g.rps=[{id:'pending',attackerId:'a',targetId:'b',kind:'plastic',choices:{}}];
  assert.deepEqual(actions(g,'a').map(a=>a.waitingForRps),[undefined,true]);
});

test('雷劈失效与互相抵消仍只称已出招，不误报动作成功',()=>{
  const g=make(3);g.players[0].points=4;g.players[1].points=4;g.players[2].points=3;
  submitMain(g,'a',{id:'thunder'});submitMain(g,'b',{id:'thunder'});submitMain(g,'c',{id:'raiseFist'});advanceGame(g,1);
  assert.equal(g.phase,'delayed');
  assert.deepEqual(history(g).players.map(p=>p.actions[0].status),['played','played','played']);
  assert.doesNotMatch(JSON.stringify(history(g)),/成功/);
  const canceled=make();canceled.players[0].points=3;canceled.players[1].points=3;
  submitMain(canceled,'a',{id:'raiseFist'});submitMain(canceled,'b',{id:'fistThunder'});advanceGame(canceled,1);
  assert.equal(canceled.players[0].delayed,undefined);
  assert.equal(actions(canceled,'a')[0].id,'raiseFist');assert.equal(actions(canceled,'a')[0].status,'played');
});

test('主阶段阵亡者的合法出招仍公开，延判前阵亡后招明确跳过',()=>{
  const deadMain=make();deadMain.players[0].points=10;deadMain.players[1].points=3;
  submitMain(deadMain,'a',{id:'gun',targetId:'b',count:10});submitMain(deadMain,'b',{id:'raiseFist'});advanceGame(deadMain,1);
  assert.equal(deadMain.players[1].alive,false);assert.equal(actions(deadMain,'b')[0].status,'played');
  const g=make();g.players.forEach(p=>{p.points=3});g.players[1].hp=1;
  submitMain(g,'a',{id:'raiseFist'});submitMain(g,'b',{id:'raiseFist'});advanceGame(g,1);
  submitRps(g,'a','priority','rock');submitRps(g,'b','priority','scissors');advanceGame(g,2);
  submitDelayed(g,'a',[{id:'gun',targetId:'b'}]);submitDelayed(g,'b',[{id:'gun',targetId:'a'}]);advanceGame(g,3);
  assert.equal(actions(g,'b')[1].status,'skipped');
  advanceGame(g,5003);assert.equal(g.phase,'finished');assert.equal(actions(g,'b')[1].status,'skipped');
});

test('主动跳过和主阶段超时跳过均显示跳过，不伪装未执行的攻击',()=>{
  const g=make();submitMain(g,'a',{id:'skip'});advanceGame(g,15000);
  for(const p of history(g).players)assert.deepEqual(p.actions,[{id:'skip',label:'跳过',stage:'main',burstPoints:0,status:'skipped'}]);
  assert.doesNotMatch(JSON.stringify(history(g)),/未执行/);
});

test('旧存档只恢复已公开主动作且标结果未知，不猜爆点或恢复未执行延判',()=>{
  const g=make();g.phase='delayed';delete g.roundActionResults;
  g.submissions={a:{id:'push',targetId:'b',burst:99},b:{id:'skip'}};
  g.delayedSubmissions={a:[{id:'gun',targetId:'b',count:88}]};
  g.delayedQueue=[{playerId:'a',input:{id:'gun',targetId:'b',count:77}}];
  g.priority={playerIds:['a','b'],choices:{a:'rock'},attempts:0,order:['b','a']};
  assert.deepEqual(actions(g,'a'),[{id:'push',label:'推 → 玩家2',targetId:'b',stage:'main',status:'unknown'}]);
  assert.deepEqual(actions(g,'b'),[{id:'skip',label:'跳过',stage:'main',status:'skipped'}]);
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/burstPoints|"burst"|"id":"gun"|"order"|"choices"|delayedQueue/);
});

test('新回合和重开都清空上回合历史，且读公开状态不会触发回血或阶段推进',()=>{
  const g=make();g.players[0].points=3;
  submitMain(g,'a',{id:'smallHeal'});submitMain(g,'b',{id:'skip'});advanceGame(g,1);
  const before=JSON.stringify(g);assert.ok(history(g));publicGame(g);publicGame(g);assert.equal(JSON.stringify(g),before);
  advanceGame(g,5001);assert.equal(g.phase,'main');assert.equal(publicGame(g).actionHistory,undefined);assert.deepEqual(g.roundActionResults,[]);
  submitMain(g,'a',{id:'accumulate'});submitMain(g,'b',{id:'skip'});advanceGame(g,5002);
  rematch(g,6000);assert.equal(publicGame(g).actionHistory,undefined);assert.deepEqual(g.roundActionResults,[]);
  const pending=make();pending.phase='delayed';pending.pendingHeals=[{playerId:'a',action:'smallHeal',amount:1}];
  const pendingBefore=JSON.stringify(pending);publicGame(pending);assert.equal(JSON.stringify(pending),pendingBefore);
});

test('六人和观战获得相同已出招信息，公开映射不携带隐藏点数、点账本或原始提交',()=>{
  const g=make(6);g.players[0].points=9;g.players[1].points=3;g.players[5].points=7;
  const inputs:ActionInput[]=[{id:'raiseFist',count:3},{id:'gun',targetId:'c',count:3},{id:'guard'},{id:'mass',burst:99},{id:'skip'},{id:'five7'}];
  inputs.forEach((input,index)=>submitMain(g,g.players[index].id,input));advanceGame(g,1);
  assert.equal(g.phase,'delayed');
  Object.assign(g.roundActionResults![0],{points:92731,ledger:{points:1881}});
  Object.assign(g.roundActionResults![0].input,{points:92731,privateMemo:'PRIVATE_LEDGER'});
  const before=JSON.stringify(g),playerView=publicGame(g),spectatorView=publicGame(g);
  assert.deepEqual(playerView,spectatorView);assert.equal(JSON.stringify(g),before);
  assert.equal(playerView.actionHistory!.players.length,6);
  assert.deepEqual(playerView.actionHistory!.players.map(p=>p.seat),[1,2,3,4,5,6]);
  assert.equal(actions(g,'d')[0].burstPoints,4);
  assert.doesNotMatch(JSON.stringify(playerView),/"points"|"swap"|ledger|PRIVATE_LEDGER|"burst"|roundActionResults|submissions|delayedQueue|"choices"/);
});

test('白名单不发布无关目标/数量及未知动作，只发布记录中的实际爆点',()=>{
  const g=make();g.phase='delayed';
  g.roundActionResults=[
    {playerId:'a',input:{id:'accumulate',targetId:'b',count:42,burst:99},stage:'main',burstPoints:0,status:'played'},
    {playerId:'b',input:{id:'push',targetId:'a',count:42,burst:99},stage:'main',burstPoints:2,status:'played'},
    {playerId:'a',input:{id:'__proto__' as ActionInput['id']},stage:'delayed',burstPoints:0,status:'played'},
  ];
  assert.deepEqual(actions(g,'a'),[{id:'accumulate',label:'积点',stage:'main',burstPoints:0,status:'played'}]);
  assert.deepEqual(actions(g,'b'),[{id:'push',label:'推 → 玩家1',targetId:'a',stage:'main',burstPoints:2,status:'played'}]);
});

test('三种角刀卡片清楚说明逐名反击枪数与空刀血量代价',()=>{
  assert.equal(ACTION_MAP.knife1.summary,'向每名攻击者反击2枪；无人攻击自扣1血');
  assert.equal(ACTION_MAP.knife2.summary,'向每名攻击者反击4枪；无人攻击自扣1血');
  assert.equal(ACTION_MAP.knife3.summary,'向每名攻击者反击7枪；无人攻击自扣2血');
});
