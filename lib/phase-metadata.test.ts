import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASE_SECONDS,advanceGame,createGame,publicGame,startGame,submitDelayed,submitMain,submitRps,type GameState,type Phase} from './game.ts';

const make=()=>startGame(createGame([{id:'a',name:'甲',seat:1},{id:'b',name:'乙',seat:2}]),0);
function assertTiming(game:GameState,phase:Phase,start:number){
  assert.equal(game.phase,phase);assert.equal(game.phaseStartedAt,start);
  assert.equal(game.deadline,start+PHASE_SECONDS[phase]*1000);
  const view=publicGame(game);assert.equal(view.phaseStartedAt,start);assert.equal(view.phaseDurationMs,PHASE_SECONDS[phase]*1000);
}

test('每轮主阶段都有独立15秒起点，五秒揭晓不占下轮时间',()=>{
  const g=make();assertTiming(g,'main',0);
  submitMain(g,'a',{id:'accumulate'});submitMain(g,'b',{id:'accumulate'});advanceGame(g,200);assertTiming(g,'reveal',200);
  advanceGame(g,5_200);assertTiming(g,'main',5_200);assert.equal(g.round,2);
  advanceGame(g,20_199);assertTiming(g,'main',5_200);
  advanceGame(g,20_200);assertTiming(g,'reveal',20_200);
  advanceGame(g,25_200);assertTiming(g,'main',25_200);assert.equal(g.round,3);
});

test('单人延判15秒、铲子猜拳8秒、结束揭晓5秒各自记录新起点',()=>{
  const g=make();g.players[0].points=12;
  submitMain(g,'a',{id:'bigShield'});submitMain(g,'b',{id:'accumulate'});advanceGame(g,20);assertTiming(g,'delayed',20);
  submitDelayed(g,'a',[{id:'iron',targetId:'b'}]);advanceGame(g,50);assertTiming(g,'rps',50);
  submitRps(g,'a',g.rps[0].id,'rock');submitRps(g,'b',g.rps[0].id,'scissors');advanceGame(g,90);assertTiming(g,'reveal',90);
});

test('延判先后猜拳及重猜都是新8秒，胜负确定再给15秒选动作',()=>{
  const g=make();g.players.forEach(p=>{p.points=3;submitMain(g,p.id,{id:'raiseFist'});});advanceGame(g,20);assertTiming(g,'priorityRps',20);
  submitRps(g,'a','priority','rock');submitRps(g,'b','priority','rock');advanceGame(g,50);assertTiming(g,'priorityRps',50);
  submitRps(g,'a','priority','rock');submitRps(g,'b','priority','scissors');advanceGame(g,90);assertTiming(g,'delayed',90);
});

test('主阶段铲子及棉花铲重猜记录各自的新8秒起点',()=>{
  const g=make();g.players[0].cotton=1;
  submitMain(g,'a',{id:'cottonShovel',targetId:'b'});submitMain(g,'b',{id:'accumulate'});advanceGame(g,20);assertTiming(g,'rps',20);
  submitRps(g,'a',g.rps[0].id,'rock');submitRps(g,'b',g.rps[0].id,'rock');advanceGame(g,50);assertTiming(g,'rps',50);
});

test('未来的主阶段起点前，即使纯引擎已收齐动作也不能提前结算',()=>{
  const g=make();g.phaseStartedAt=2_000;g.deadline=17_000;
  submitMain(g,'a',{id:'accumulate'});submitMain(g,'b',{id:'accumulate'});
  const ready=JSON.stringify(g);advanceGame(g,1_999);assert.equal(JSON.stringify(g),ready);assertTiming(g,'main',2_000);
  advanceGame(g,2_000);assertTiming(g,'reveal',2_000);assert.deepEqual(g.players.map(p=>p.points),[2,2]);
});

test('同步准备保护延判、先后猜拳与铲子猜拳，不依赖设备真实时钟',()=>{
  const setups:Array<{phase:Phase;game:GameState}>=[];
  const delayed=make();delayed.players[0].points=3;
  submitMain(delayed,'a',{id:'raiseFist'});submitMain(delayed,'b',{id:'accumulate'});advanceGame(delayed,10);submitDelayed(delayed,'a',[]);setups.push({phase:'delayed',game:delayed});
  const priority=make();priority.players.forEach(p=>{p.points=3;submitMain(priority,p.id,{id:'raiseFist'});});advanceGame(priority,10);
  submitRps(priority,'a','priority','rock');submitRps(priority,'b','priority','scissors');setups.push({phase:'priorityRps',game:priority});
  const rps=make();rps.players[0].points=4;
  submitMain(rps,'a',{id:'iron',targetId:'b'});submitMain(rps,'b',{id:'accumulate'});advanceGame(rps,10);
  submitRps(rps,'a',rps.rps[0].id,'rock');submitRps(rps,'b',rps.rps[0].id,'scissors');setups.push({phase:'rps',game:rps});
  for(const {phase,game} of setups){
    game.phaseStartedAt=2_000;game.deadline=2_000+PHASE_SECONDS[phase]*1000;
    const ready=JSON.stringify(game);advanceGame(game,1_999);assert.equal(JSON.stringify(game),ready,phase);
    advanceGame(game,2_000);assert.equal(game.phase,phase==='priorityRps'?'delayed':'reveal');assert.equal(game.phaseStartedAt,2_000);
  }
});

test('旧存档缺少起点时仅在公开快照推导，不修改保存的截止时间',()=>{
  for(const phase of ['main','delayed','rps','priorityRps','reveal'] as const){
    const g=make();g.phase=phase;delete g.phaseStartedAt;g.deadline=30_000;
    const saved=JSON.stringify(g),view=publicGame(g);
    assert.equal(view.phaseStartedAt,30_000-PHASE_SECONDS[phase]*1000);assert.equal(view.phaseDurationMs,PHASE_SECONDS[phase]*1000);
    assert.equal(view.deadline,30_000);assert.equal(JSON.stringify(g),saved);
  }
});

test('结束清除阶段起点，大厅和结束阶段公开时长为0',()=>{
  const lobby=createGame([{id:'a',name:'甲',seat:1}]);assert.equal(publicGame(lobby).phaseStartedAt,undefined);assert.equal(publicGame(lobby).phaseDurationMs,0);
  const g=make();g.players[0].points=6;g.players[1].hp=7;
  submitMain(g,'a',{id:'execute',targetId:'b'});submitMain(g,'b',{id:'guard'});advanceGame(g,20);assertTiming(g,'reveal',20);
  advanceGame(g,5_020);assert.equal(g.phase,'finished');assert.equal(g.phaseStartedAt,undefined);assert.equal(g.deadline,null);
  assert.equal(publicGame(g).phaseStartedAt,undefined);assert.equal(publicGame(g).phaseDurationMs,0);
});

test('双盾与延判枪在揭晓时公开规范化数量，非数量动作没有count字段或点余额',()=>{
  const g=make();g.players[0].points=14;
  submitMain(g,'a',{id:'smallShield',count:2});submitMain(g,'b',{id:'accumulate',count:77});advanceGame(g,20);
  assert.equal(publicGame(g).reveal,undefined);
  submitDelayed(g,'a',[{id:'gun',targetId:'b',count:2.9},{id:'guard',count:99}]);advanceGame(g,40);
  const view=publicGame(g),a=view.reveal!.actions.find(action=>action.playerId==='a')!.entries!,b=view.reveal!.actions.find(action=>action.playerId==='b')!.entries!;
  assert.deepEqual(a.map(entry=>[entry.id,entry.count]),[['smallShield',2],['gun',2],['guard',undefined]]);
  assert.equal(Object.hasOwn(a[2],'count'),false);assert.equal(Object.hasOwn(b[0],'count'),false);
  assert.doesNotMatch(JSON.stringify(view),/"points"|roundActionResults|delayedSubmissions|"burst":/);
});

test('旧延判存档缺少动作结果时，主动作回退条目也公开规范化数量',()=>{
  const g=make();g.players[0].points=14;
  submitMain(g,'a',{id:'smallShield',count:2});submitMain(g,'b',{id:'guard'});advanceGame(g,20);
  delete g.roundActionResults;submitDelayed(g,'a',[]);advanceGame(g,40);
  const actions=publicGame(g).reveal!.actions;
  assert.equal(actions[0].entries![0].count,2);assert.equal(Object.hasOwn(actions[1].entries![0],'count'),false);
});
