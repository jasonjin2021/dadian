import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_MAP, PHASE_SECONDS, advanceGame, createGame, publicGame, startGame, submitDelayed, submitMain, submitRps, type ActionId } from './game.ts';

const make=(count=2)=>startGame(createGame(Array.from({length:count},(_,i)=>({id:String.fromCharCode(97+i),name:`玩家${i+1}`,seat:i+1}))),0);

test('所有服务端阶段统一时长：主阶段/延判15秒、两种猜拳8秒、揭晓5秒',()=>{
  assert.deepEqual(PHASE_SECONDS,{lobby:0,main:15,priorityRps:8,rps:8,delayed:15,reveal:5,finished:0});
  const g=make();submitMain(g,'a',{id:'accumulate'});
  advanceGame(g,12_001);assert.equal(g.phase,'main');
  advanceGame(g,14_999);assert.equal(g.phase,'main');
  advanceGame(g,15_000);assert.equal(g.phase,'reveal');assert.equal(g.deadline,20_000);
  assert.equal(g.players[0].points,2);assert.equal(g.players[1].points,0);
});

for(const count of [2,3,4,5,6]){
  test(`${count}人主阶段最后一人确认即结算，未全部确认不提前`,()=>{
    const g=make(count);
    for(let i=0;i<count;i++){
      submitMain(g,g.players[i].id,{id:'accumulate'});advanceGame(g,i+1);
      if(i<count-1){assert.equal(g.phase,'main');assert.equal(g.deadline,15_000);assert.ok(g.players.every(p=>p.points===0));}
    }
    assert.equal(g.phase,'reveal');assert.equal(g.deadline,count+5_000);
    assert.ok(g.players.every(p=>p.points===2));
    const settled=JSON.stringify(g);advanceGame(g,count+1);assert.equal(JSON.stringify(g),settled);
  });

  test(`${count}人先后猜拳和延判都只等待未确认者，全齐立即推进`,()=>{
    const g=make(count);g.players.forEach(p=>{p.points=3;submitMain(g,p.id,{id:'raiseFist'});});advanceGame(g,1);
    assert.equal(g.phase,'priorityRps');assert.equal(g.deadline,8_001);
    for(let i=0;i<count;i++){
      submitRps(g,g.players[i].id,'priority',i===0?'rock':'scissors');advanceGame(g,2+i);
      if(i<count-1){assert.equal(g.phase,'priorityRps');assert.equal(g.deadline,8_001);}
    }
    assert.equal(g.phase,'delayed');assert.equal(g.deadline,15_001+count);
    for(let i=0;i<count;i++){
      submitDelayed(g,g.players[i].id,[{id:'accumulate'}]);advanceGame(g,10+i);
      if(i<count-1){assert.equal(g.phase,'delayed');assert.ok(g.players.every(p=>p.points===0));}
    }
    assert.equal(g.phase,'reveal');assert.ok(g.players.every(p=>p.points===2));
    assert.equal(g.deadline,5_009+count);
  });
}

test('普通铲子猜拳满8秒才超时，双方提前选完则立即结算',()=>{
  const g=make();g.players[0].points=4;
  submitMain(g,'a',{id:'iron',targetId:'b'});submitMain(g,'b',{id:'accumulate'});advanceGame(g,1);
  assert.equal(g.phase,'rps');assert.equal(g.deadline,8_001);
  submitRps(g,'a',g.rps[0].id,'rock');advanceGame(g,5_001);assert.equal(g.phase,'rps');
  submitRps(g,'b',g.rps[0].id,'scissors');advanceGame(g,5_002);
  assert.equal(g.phase,'reveal');assert.equal(g.players[1].hp,5);
  const timeout=make();timeout.players[0].points=4;
  submitMain(timeout,'a',{id:'iron',targetId:'b'});submitMain(timeout,'b',{id:'accumulate'});advanceGame(timeout,1);
  submitRps(timeout,'a',timeout.rps[0].id,'rock');advanceGame(timeout,8_000);assert.equal(timeout.phase,'rps');
  advanceGame(timeout,8_001);assert.equal(timeout.phase,'reveal');assert.equal(timeout.players[1].hp,5);
});

test('棉花铲和延判先后猜拳每次平局都给完整8秒',()=>{
  const cotton=make();cotton.players[0].cotton=1;
  submitMain(cotton,'a',{id:'cottonShovel',targetId:'b'});submitMain(cotton,'b',{id:'accumulate'});advanceGame(cotton,1);
  submitRps(cotton,'a',cotton.rps[0].id,'rock');submitRps(cotton,'b',cotton.rps[0].id,'rock');advanceGame(cotton,2);
  assert.equal(cotton.phase,'rps');assert.equal(cotton.deadline,8_002);assert.deepEqual(cotton.rps[0].choices,{});
  const priority=make();priority.players.forEach(p=>{p.points=3;submitMain(priority,p.id,{id:'raiseFist'});});advanceGame(priority,1);
  submitRps(priority,'a','priority','rock');submitRps(priority,'b','priority','rock');advanceGame(priority,2);
  assert.equal(priority.phase,'priorityRps');assert.equal(priority.deadline,8_002);assert.deepEqual(priority.priority?.choices,{});
});

test('延判中的铲子也给8秒，单人延判仍有15秒',()=>{
  const g=make();g.players[0].points=12;submitMain(g,'a',{id:'bigShield'});submitMain(g,'b',{id:'accumulate'});advanceGame(g,1);
  assert.equal(g.phase,'delayed');assert.equal(g.deadline,15_001);
  submitDelayed(g,'a',[{id:'iron',targetId:'b'}]);advanceGame(g,2);
  assert.equal(g.phase,'rps');assert.equal(g.deadline,8_002);
});

test('延判公开确认状态不沿用主阶段锁定，提交后才变成已确认且不泄露动作',()=>{
  const g=make(3);g.players[0].points=3;g.players[1].points=3;
  submitMain(g,'a',{id:'raiseFist'});submitMain(g,'b',{id:'raiseFist'});submitMain(g,'c',{id:'accumulate'});advanceGame(g,1);
  submitRps(g,'a','priority','rock');submitRps(g,'b','priority','scissors');advanceGame(g,2);
  assert.equal(g.phase,'delayed');assert.ok(g.players.every(p=>p.confirmed));
  const before=publicGame(g);assert.equal(before.required,2);assert.equal(before.confirmed,0);
  assert.deepEqual(before.players.map(p=>p.confirmed),[false,false,false]);
  submitDelayed(g,'a',[]);
  const after=publicGame(g);assert.equal(after.required,2);assert.equal(after.confirmed,1);
  assert.deepEqual(after.players.map(p=>p.confirmed),[true,false,false]);
  assert.equal('delayedSubmissions' in after,false);assert.equal(after.reveal,undefined);
  assert.throws(()=>submitDelayed(g,'a',[{id:'accumulate'}]),/延判已经确认/);
  submitDelayed(g,'b',[{id:'accumulate'}]);assert.equal(publicGame(g).confirmed,2);
  advanceGame(g,3);assert.equal(g.phase,'reveal');
});

const thunders:Array<{id:ActionId;target:ActionId;targetCost:number}>=[
  {id:'fistThunder',target:'raiseFist',targetCost:3},
  {id:'shieldThunder',target:'smallShield',targetCost:7},
  {id:'pointThunder',target:'accumulate',targetCost:0},
  {id:'thunder',target:'fistThunder',targetCost:3},
];
for(const {id,target,targetCost} of thunders){
  test(`${ACTION_MAP[id].name}可按实际缺口爆点，声明不改变扣血；血不足时不扣血不生效`,()=>{
    const cost=ACTION_MAP[id].cost;assert.equal(ACTION_MAP[id].burst,true);
    for(const declaration of [0,1,99]){
      const g=make();g.players[0].points=1;g.players[1].points=targetCost;
      submitMain(g,'a',{id,burst:declaration});submitMain(g,'b',{id:target});advanceGame(g,1);
      assert.equal(g.players[0].hp,10-(cost-1));assert.equal(g.players[0].points,0);assert.equal(g.players[1].hp,7);
      assert.equal(g.roundActionResults?.find(result=>result.playerId==='a')?.burstPoints,cost-1);
    }
    const failed=make();failed.players[0].hp=cost-1;failed.players[1].points=targetCost;
    submitMain(failed,'a',{id,burst:99});submitMain(failed,'b',{id:target});advanceGame(failed,1);
    assert.equal(failed.players[0].hp,cost-1);assert.equal(failed.players[1].hp,10);
    assert.equal(failed.roundActionResults?.find(result=>result.playerId==='a')?.status,'failed');
  });

  test(`${ACTION_MAP[id].name}点数足够无需扣血，刚好用血支付至0仍完成合法动作`,()=>{
    const cost=ACTION_MAP[id].cost;
    for(const fullPoints of [true,false]){
      const g=make();g.players[0].points=fullPoints?cost+2:0;g.players[0].hp=fullPoints?10:cost;g.players[1].points=targetCost;
      submitMain(g,'a',{id,burst:99});submitMain(g,'b',{id:target});advanceGame(g,1);
      assert.equal(g.players[0].hp,fullPoints?10:0);assert.equal(g.players[0].alive,fullPoints);
      assert.equal(g.players[0].points,fullPoints?2:0);assert.equal(g.players[1].hp,7);
    }
  });
}

test('爆点雷劈被失效仍支付，互相雷劈只失效动作不退爆点血',()=>{
  const g=make(3);g.players[1].points=4;
  submitMain(g,'a',{id:'pointThunder'});submitMain(g,'b',{id:'thunder'});submitMain(g,'c',{id:'accumulate'});advanceGame(g,1);
  assert.equal(g.players[0].hp,3);assert.equal(g.players[2].hp,10);assert.equal(g.players[2].points,2);
  const mutual=make();submitMain(mutual,'a',{id:'thunder'});submitMain(mutual,'b',{id:'thunder'});advanceGame(mutual,1);
  assert.deepEqual(mutual.players.map(p=>p.hp),[6,6]);
});

