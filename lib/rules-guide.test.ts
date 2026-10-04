import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIONS,ACTION_MAP,PHASE_SECONDS,advanceGame,createGame,publicGame,startGame,submitDelayed,submitMain,type ActionId,type ActionInput} from './game.ts';
import {PHASE_SYNC_MS} from './phase-clock.ts';
import {RULE_BASICS,RULE_CATEGORIES,RULES_GUIDE} from './rules-guide.ts';

const make=(count=2)=>startGame(createGame(Array.from({length:count},(_,i)=>({id:String(i),name:`玩家${i+1}`,seat:i+1}))),0);
const settle=(game:ReturnType<typeof make>,actions:ActionInput[],now=1)=>{actions.forEach((action,index)=>submitMain(game,String(index),action));advanceGame(game,now);};

test('A–I全部分类与所有动作（包括跳过）都有完整白话规则与例子',()=>{
  assert.deepEqual(RULE_CATEGORIES.map(category=>category.id),['A','B','C','D','E','F','G','H','I']);
  assert.deepEqual(Object.keys(RULES_GUIDE).sort(),ACTIONS.map(action=>action.id).sort());
  for(const category of RULE_CATEGORIES){assert.ok(category.name.length>1);assert.ok(category.description.length>8);}
  for(const action of ACTIONS){
    const guide=RULES_GUIDE[action.id];
    for(const field of ['cost','target','effect'] as const)assert.ok(guide[field].trim().length>(field==='cost'?1:field==='target'?3:5),`${action.id}.${field}`);
    assert.ok(guide.interactions.length>0,action.id);assert.ok(guide.interactions.every(line=>line.length>5),action.id);
    assert.ok(guide.example&&guide.example.length>10,`${action.id}.example`);
  }
});

test('不再使用看不懂的三段数字简写，三种角刀明确费用/反击/空放代价',()=>{
  const text=JSON.stringify({RULE_BASICS,RULE_CATEGORIES,RULES_GUIDE});
  assert.doesNotMatch(text,/(?:1[.．/]2[.．/]1|3[.．/]4[.．/]1|5[.．/]7[.．/]2|1\/2\/3|3\/4\/5)/);
  for(const [id,cost,shots,selfDamage] of [['knife1',1,2,1],['knife2',3,4,1],['knife3',5,7,2]] as const){
    const guide=RULES_GUIDE[id];assert.ok(guide.cost.includes(`${cost}点`));assert.ok(guide.effect.includes(`${shots}枪`));assert.ok(guide.effect.includes(`自己失去${selfDamage}血`));
    assert.match(guide.target,/只反击/);assert.match(guide.target,/实际/);
  }
});

test('基础规则时长与服务器常量一致，并说明准备期/全确认/隐藏点数',()=>{
  const timer=RULE_BASICS.find(rule=>rule.title==='每个阶段有多久')!.body;
  assert.ok(timer.includes(`${PHASE_SYNC_MS/1000}秒同步准备`));assert.ok(timer.includes(`各${PHASE_SECONDS.main}秒`));
  assert.ok(timer.includes(`各${PHASE_SECONDS.rps}秒`));assert.ok(timer.includes(`展示${PHASE_SECONDS.reveal}秒`));
  assert.match(timer,/不占正式操作时间/);
  const basics=RULE_BASICS.map(rule=>`${rule.title} ${rule.body}`).join('\n');
  assert.match(basics,/所有应参与的玩家都确认，就立即结算/);assert.match(basics,/你可以看到自己的点数余额/);assert.match(basics,/看不到其他玩家的点数/);assert.match(basics,/观战者看不到任何人的点数/);
  assert.match(basics,/只补实际缺口/);assert.match(basics,/血刚好支付到0仍会完成/);
});

test('动作费用与引擎爆点资格一致，治疗和普通主动攻击不虚称可爆点',()=>{
  for(const action of ACTIONS){
    const cost=RULES_GUIDE[action.id].cost;
    if(action.burst)assert.match(cost,/可自动爆点/,action.id);
    else if(action.cost>0)assert.match(cost,/不可爆点/,action.id);
  }
  assert.match(RULES_GUIDE.punch.cost,/消耗1个直拳，不消耗点/);
  assert.match(RULES_GUIDE.cottonShovel.cost,/消耗1个棉花/);
  assert.match(RULES_GUIDE.popShield.cost,/消耗1面已有盾/);
  assert.match(RULES_GUIDE.popWater.cost,/消耗1份已有圣水/);
});

for(const [id,cost,shots,selfDamage] of [['knife1',1,2,1],['knife2',3,4,1],['knife3',5,7,2]] as const){
  test(`${ACTION_MAP[id].name}例子真实执行：反击先抵消，无人攻击才自损`,()=>{
    const hit=make();hit.players[0].points=cost;hit.players[1].points=shots-1;
    settle(hit,[{id},{id:'gun',targetId:'0',count:shots-1}]);
    assert.equal(hit.players[0].points,0);assert.equal(hit.players[0].hp,10);assert.equal(hit.players[1].hp,9);
    const empty=make();empty.players[0].points=cost;settle(empty,[{id},{id:'accumulate'}]);
    assert.equal(empty.players[0].points,0);assert.equal(empty.players[0].hp,10-selfDamage);
    const unrelated=make(3);unrelated.players[0].points=cost;unrelated.players[1].points=1;
    settle(unrelated,[{id},{id:'gun',targetId:'2',count:1},{id:'skip'}]);
    assert.equal(unrelated.players[0].hp,10-selfDamage);assert.equal(unrelated.players[1].hp,10);
  });
}

test('指南爆点示例：推对8枪剩2血，密对7枪剩3血',()=>{
  for(const [id,gunCount,expectedHp] of [['push',8,2],['mass',7,3]] as const){
    const g=make();g.players[1].points=gunCount;
    settle(g,[{id,...(id==='push'?{targetId:'1'}:{})},{id:'gun',targetId:'0',count:gunCount}]);
    assert.equal(g.players[0].hp,expectedHp);assert.equal(g.players[1].hp,10);
    assert.ok(RULES_GUIDE[id].example!.includes(`剩${expectedHp}血`));
  }
});

test('指南五换7双拉示例：原9点加2点，先拉2再拉9，自己归零',()=>{
  const g=make(3);g.players[0].points=9;g.players[1].points=3;g.players[2].points=3;
  settle(g,[{id:'five7'},{id:'pull',targetId:'0'},{id:'pull',targetId:'0'}]);
  assert.deepEqual(g.players.map(player=>player.points),[0,2,9]);
  assert.match(RULES_GUIDE.five7.example!,/原来9点.*11点.*新增2点.*原来的9点.*剩0点/);
});

test('指南点杀示例：对推不反伤、对摩擦7伤、单枪才有1血例外',()=>{
  const push=make();push.players[0].points=6;push.players[1].points=2;
  settle(push,[{id:'execute',targetId:'1'},{id:'push',targetId:'0'}]);
  assert.equal(push.players[0].points,4);assert.deepEqual(push.players.map(player=>player.hp),[10,10]);
  const friction=make();friction.players[0].points=6;settle(friction,[{id:'execute',targetId:'1'},{id:'friction'}]);assert.equal(friction.players[1].hp,3);
  const knife=make();knife.players[0].points=6;knife.players[1].points=1;
  settle(knife,[{id:'execute',targetId:'1'},{id:'knife1'}]);assert.equal(knife.players[1].hp,10);assert.equal(knife.players[0].points,2);
  assert.match(RULES_GUIDE.execute.interactions.join(' '),/小角刀不属于这个单枪例外/);
});

test('指南热气摩擦特殊例子只掉3血，不另扣空摩擦血',()=>{
  const g=make();g.players[0].points=3;settle(g,[{id:'heat'},{id:'friction'}]);assert.equal(g.players[1].hp,7);
  assert.match(RULES_GUIDE.friction.example!,/掉3血，不是5血/);
});

test('盾延判额度和数量写清楚：单盾不能两件各3点，双盾总6点，大双盾总16点',()=>{
  const one=make();one.players[0].points=7;settle(one,[{id:'smallShield'},{id:'skip'}]);
  assert.throws(()=>submitDelayed(one,'0',[{id:'gun',targetId:'1',count:3},{id:'gun',targetId:'1',count:3}]));
  const double=make();double.players[0].points=14;settle(double,[{id:'doubleShield'},{id:'skip'}]);
  submitDelayed(double,'0',[{id:'gun',targetId:'1',count:3},{id:'gun',targetId:'1',count:3}]);advanceGame(double,2);assert.equal(double.players[1].hp,4);
  const big=make();big.players[0].points=24;settle(big,[{id:'bigShield',count:2},{id:'skip'}]);
  assert.equal(big.players[0].delayed?.budget,16);assert.equal(big.players[0].delayed?.max,2);assert.equal(big.players[0].shields,2);
  assert.match(RULES_GUIDE.doubleShield.effect,/6点.*最多.*2件/);assert.match(RULES_GUIDE.bigShield.effect,/24点.*16点/);
});

test('指南治疗示例：可超过10血，密只清点不爆治疗，被推则抵挡且不回血',()=>{
  const small=make();small.players[0].points=3;settle(small,[{id:'smallHeal'},{id:'skip'}]);assert.equal(small.players[0].hp,11);
  const big=make();big.players[0].points=8;big.players[0].hp=8;big.players[1].points=4;
  settle(big,[{id:'bigHeal'},{id:'mass'}]);assert.equal(big.players[0].hp,10);assert.equal(big.players[0].points,0);
  const pop=make();pop.players[0].points=7;pop.players[1].points=2;
  settle(pop,[{id:'smallHeal'},{id:'push',targetId:'0'}]);assert.equal(pop.players[0].hp,10);assert.equal(pop.players[0].points,4);
  assert.match(RULES_GUIDE.smallHeal.interactions.join(' '),/整轮结束/);assert.match(RULES_GUIDE.smallHeal.interactions.join(' '),/已阵亡不能.*复活/);
});

test('所有雷劈说明真伤与延判区别，点劈不触发五换爆炸，互雷仍支付实际爆点',()=>{
  for(const id of ['fistThunder','shieldThunder','pointThunder','thunder'] as const){
    assert.match(RULES_GUIDE[id].interactions.join(' '),/延判.*只造成真伤/);assert.match(RULES_GUIDE[id].interactions.join(' '),/治疗.*挡住一次/);
  }
  assert.match(RULES_GUIDE.pointThunder.interactions.join(' '),/不触发5换9/);assert.match(RULES_GUIDE.pointThunder.interactions.join(' '),/不触发5换10/);
  const g=make();settle(g,[{id:'thunder'},{id:'thunder'}]);assert.deepEqual(g.players.map(player=>player.hp),[6,6]);
});

test('规则示例不会改变公开状态的隐藏点数边界',()=>{
  const g=make();g.players[0].points=5;settle(g,[{id:'five8'},{id:'accumulate'}]);
  const publicState=JSON.stringify(publicGame(g));assert.doesNotMatch(publicState,/"points"|pendingHeals|roundVoiceFacts|roundActionResults/);
  assert.equal(Object.keys(RULES_GUIDE).includes('skip' satisfies ActionId),true);
});
