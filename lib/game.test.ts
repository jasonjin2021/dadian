import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGame, createGame, PHASE_SECONDS, phaseRemainingMs, publicGame, startGame, submitDelayed, submitMain, submitRps } from './game.ts';

const make=(count=2)=>startGame(createGame(Array.from({length:count},(_,i)=>({id:String.fromCharCode(97+i),name:String.fromCharCode(30002+i),seat:i+1}))),0);
const act=(g:ReturnType<typeof make>,id:string,input:Parameters<typeof submitMain>[2])=>submitMain(g,id,input);

test('倒计时只使用服务器时间与单调计时，设备时钟快慢不改变15秒',()=>{
  const serverNow=100_000,deadline=115_000;
  assert.equal(phaseRemainingMs(deadline,serverNow,0),15_000);
  assert.equal(phaseRemainingMs(deadline,serverNow,6_000),9_000);
  assert.equal(phaseRemainingMs(deadline,serverNow,15_100),0);
  assert.equal(phaseRemainingMs(105_000,serverNow,0),5_000);
  assert.equal(phaseRemainingMs(null,serverNow,0),0);
});

test('0点开局可积点且每次增加2点，但公开状态不泄露点数',()=>{
  const g=make();act(g,'a',{id:'accumulate'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.players[0].points,2);assert.equal(JSON.stringify(publicGame(g)).includes('points'),false);
});

test('主阶段15秒，结算展示5秒不占下一回合时间，展示不泄露点余额',()=>{
  const g=make();assert.equal(g.deadline,15_000);
  act(g,'a',{id:'accumulate'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.phase,'reveal');assert.equal(g.deadline,5_001);
  const revealed=publicGame(g);
  assert.equal(revealed.reveal?.actions[0].main,'积点');
  assert.equal(revealed.reveal?.actions[0].mainId,'accumulate');
  assert.equal(JSON.stringify(revealed).includes('points'),false);
  advanceGame(g,5_000);assert.equal(g.phase,'reveal');
  advanceGame(g,5_001);assert.equal(g.phase,'main');assert.equal(g.round,2);assert.equal(g.deadline,20_001);
});

test('所有玩家的回合展示公布实际爆点，忽略声明值且不公开余额或支付账本',()=>{
  const g=make();act(g,'a',{id:'accumulate'});act(g,'b',{id:'push',targetId:'a',burst:99});
  assert.equal(publicGame(g).reveal,undefined);
  advanceGame(g,1);
  const view=publicGame(g),entries=view.reveal!.actions;
  assert.deepEqual(entries.map(entry=>entry.playerId),['a','b']);
  assert.equal(entries[0].entries![0].burstPoints,0);
  assert.equal(entries[1].entries![0].burstPoints,2);
  assert.equal(entries[1].entries![0].label,'推 → 甲');
  assert.equal(g.players[1].hp,8);
  assert.doesNotMatch(JSON.stringify(view),/"points"|roundActionResults|"burst":99/);
  advanceGame(g,5_001);
  assert.equal(publicGame(g).reveal,undefined);assert.deepEqual(g.roundActionResults,[]);
});

test('无需爆点与支付失败均公开为0爆点，不显示虚假的爆点量',()=>{
  const g=make();g.players[0].points=2;g.players[1].hp=1;
  act(g,'a',{id:'push',targetId:'b',burst:9});act(g,'b',{id:'push',targetId:'a',burst:9});advanceGame(g,1);
  const entries=publicGame(g).reveal!.actions;
  assert.equal(entries[0].entries![0].burstPoints,0);
  assert.equal(entries[1].entries![0].burstPoints,0);
  assert.equal(entries[1].entries![0].status,'failed');
  assert.equal(g.players[1].hp,1);
});

test('延判积点也进入同一回合手势展示，仅在整轮结算后公开',()=>{
  const g=make();g.players[0].points=3;
  act(g,'a',{id:'raiseFist'});act(g,'b',{id:'accumulate'});advanceGame(g,1);
  assert.equal(g.phase,'delayed');assert.equal(publicGame(g).reveal,undefined);
  submitDelayed(g,'a',[{id:'accumulate'}]);advanceGame(g,2);
  assert.equal(g.phase,'reveal');assert.equal(g.deadline,5_002);
  assert.deepEqual(publicGame(g).reveal!.actions[0].entries!.map(entry=>[entry.id,entry.stage,entry.burstPoints]),[['raiseFist','main',0],['accumulate','delayed',0]]);
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/"points"|roundActionResults/);
});

test('相向枪拳按数量一比一抵消',()=>{
  const g=make();g.players[0].points=5;g.players[1].fists=4;
  act(g,'a',{id:'gun',targetId:'b',count:5});act(g,'b',{id:'punch',targetId:'a',count:4});advanceGame(g,1);
  assert.equal(g.players[1].hp,9);assert.equal(g.players[0].hp,10);
});

test('主阶段超时直接跳过，不自动防御',()=>{
  const g=make();g.players[0].points=1;act(g,'a',{id:'gun',targetId:'b',count:1});advanceGame(g,15_001);
  assert.equal(g.players[1].hp,9);assert.match(g.events.join('\n'),/超时.*跳过/);
});

test('不可爆点动作点不足直接跳过',()=>{
  const g=make();act(g,'a',{id:'super',targetId:'b'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.players[1].hp,10);assert.equal(g.players[0].hp,10);
});

test('爆点只按真实缺口扣血，不因声明值额外惩罚',()=>{
  const g=make();act(g,'a',{id:'push',targetId:'b',burst:1});act(g,'b',{id:'accumulate'});advanceGame(g,1);
  assert.equal(g.players[0].hp,8);
});

test('点数足够时爆点声明不额外扣血',()=>{
  const g=make();g.players[0].points=2;act(g,'a',{id:'push',targetId:'b',burst:5});act(g,'b',{id:'accumulate'});advanceGame(g,1);
  assert.equal(g.players[0].hp,10);
});

test('互相雷劈双方失效且不受伤',()=>{
  const g=make();g.players.forEach(p=>p.points=4);act(g,'a',{id:'thunder'});act(g,'b',{id:'thunder'});advanceGame(g,1);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[1].hp,10);
});

test('点劈造成真伤但积点仍生效',()=>{
  const g=make();g.players[1].points=4;act(g,'a',{id:'accumulate'});act(g,'b',{id:'pointThunder'});advanceGame(g,1);
  assert.equal(g.players[0].hp,7);assert.equal(g.players[0].points,2);
});

test('拳劈取消举拳延判，但保留增加的拳',()=>{
  const g=make();g.players[0].points=3;g.players[1].points=3;act(g,'a',{id:'raiseFist'});act(g,'b',{id:'fistThunder'});advanceGame(g,1);
  assert.equal(g.players[0].hp,7);assert.equal(g.players[0].fists,4);assert.equal(g.players[0].delayed,undefined);assert.equal(g.phase,'reveal');
  advanceGame(g,5_001);assert.equal(g.round,2);
});

test('5换6遭任意推只损失新增1点',()=>{
  const g=make();g.players[0].points=10;g.players[1].points=2;act(g,'a',{id:'five6'});act(g,'b',{id:'push',targetId:'a'});advanceGame(g,1);
  assert.equal(g.players[0].points,10);
});

test('5换7首推仅打新增点，第二推再清原点',()=>{
  const g=make(3);g.players[0].points=5;g.players[1].points=2;g.players[2].points=2;
  act(g,'a',{id:'five7'});act(g,'b',{id:'push',targetId:'a'});act(g,'c',{id:'push',targetId:'a'});advanceGame(g,1);
  assert.equal(g.players[0].points,0);
});

test('5换7遇先拉后推时首拉只取新增点，后推清原点',()=>{
  const g=make(3);g.players[0].points=3;g.players[1].points=5;g.players[2].points=2;
  act(g,'a',{id:'pull',targetId:'b'});act(g,'b',{id:'five7'});act(g,'c',{id:'push',targetId:'b'});advanceGame(g,1);
  assert.equal(g.players[0].points,2);assert.equal(g.players[1].points,0);
});

test('5换9免疫拉，并化解首个非拉B/C来源',()=>{
  const g=make(3);g.players[0].points=5;g.players[1].points=3;g.players[2].points=1;
  act(g,'a',{id:'five9'});act(g,'b',{id:'pull',targetId:'a'});act(g,'c',{id:'gun',targetId:'a',count:1});advanceGame(g,1);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[0].points,0);assert.equal(g.players[1].points,0);
});

test('防会反弹super',()=>{
  const g=make();g.players[0].points=5;act(g,'a',{id:'super',targetId:'b'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.players[0].hp,5);assert.equal(g.players[1].hp,10);
});

test('破冰动作被吸收，后续来源继续命中',()=>{
  const g=make(3);g.players[0].points=6;g.players[1].points=1;g.players[2].points=2;
  act(g,'a',{id:'execute',targetId:'c'});act(g,'b',{id:'gun',targetId:'c',count:1});act(g,'c',{id:'ice'});advanceGame(g,1);
  assert.equal(g.players[2].hp,9);
});

test('密集气功无视冰块并清空点数',()=>{
  const g=make();g.players[0].points=4;g.players[1].points=7;act(g,'a',{id:'mass'});act(g,'b',{id:'ice'});advanceGame(g,1);
  assert.equal(g.players[1].points,0);
});

test('伤害被防减至0时不会爆盾',()=>{
  const g=make();g.players[0].points=3;g.players[1].shields=1;act(g,'a',{id:'gun',targetId:'b',count:3});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.players[1].hp,10);assert.equal(g.players[1].shields,1);
});

test('角刀只对实际攻击角刀使用者的人生效',()=>{
  const g=make(3);g.players[0].points=1;g.players[1].points=1;g.players[2].points=1;
  act(g,'a',{id:'knife1'});act(g,'b',{id:'gun',targetId:'a',count:1});act(g,'c',{id:'gun',targetId:'b',count:1});advanceGame(g,1);
  assert.equal(g.players[2].hp,10);assert.equal(g.players[1].hp,8);assert.equal(g.players[0].hp,10);
});

test('纺棉当回合可各挡一次推和一点普通伤害',()=>{
  const g=make(3);g.players[0].points=6;g.players[1].points=2;g.players[2].points=1;
  act(g,'a',{id:'cotton'});act(g,'b',{id:'push',targetId:'a'});act(g,'c',{id:'gun',targetId:'a',count:1});advanceGame(g,1);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[0].cotton,6);
});

test('圣水在下一回合开始时提供1个隐藏点',()=>{
  const g=make();g.players[0].points=6;act(g,'a',{id:'holyWater'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.phase,'reveal');assert.equal(g.round,1);assert.equal(g.players[0].points,0);
  advanceGame(g,5_001);assert.equal(g.round,2);assert.equal(g.players[0].points,1);
});

test('铲子猜拳仅公开是否已提交，不公开具体选择',()=>{
  const g=make();g.players[0].points=4;act(g,'a',{id:'iron',targetId:'b'});act(g,'b',{id:'guard'});advanceGame(g,1);
  const duel=g.rps[0];submitRps(g,'a',duel.id,'rock');const view=publicGame(g);
  assert.deepEqual(view.rps[0].submittedIds,['a']);assert.equal(JSON.stringify(view).includes('rock'),false);
});

test('铁铲和塑料铲遇主动攻击都完全抵消，不进入猜拳',()=>{
  for(const shovel of ['iron','plastic'] as const){
    const g=make();g.players[0].points=4;g.players[1].points=3;
    act(g,'a',{id:shovel,targetId:'b'});act(g,'b',{id:'gun',targetId:'a',count:3});advanceGame(g,1);
    assert.equal(g.players[0].hp,10);assert.equal(g.players[1].hp,10);assert.equal(g.rps.length,0);
    assert.match(g.events.join('\n'),/完全抵消/);
  }
});

test('点杀对摩擦造成7伤，不转化为点',()=>{
  const g=make();g.players[0].points=6;
  act(g,'a',{id:'execute',targetId:'b'});act(g,'b',{id:'friction'});advanceGame(g,1);
  assert.equal(g.players[1].hp,3);assert.equal(g.players[1].points,0);
});

test('点杀遇推获得双倍点，推转化的2枪不反伤点杀者',()=>{
  const g=make();g.players[0].points=6;g.players[1].points=2;
  act(g,'a',{id:'execute',targetId:'b'});act(g,'b',{id:'push',targetId:'a'});advanceGame(g,1);
  assert.equal(g.players[0].points,4);assert.equal(g.players[0].hp,10);assert.equal(g.players[1].hp,10);
  assert.match(g.events.join('\n'),/反击被点杀压制/);
});

test('点杀遇拉只获得双倍耗点，拉不掠夺也不反伤',()=>{
  const g=make();g.players[0].points=10;g.players[1].points=3;
  act(g,'a',{id:'execute',targetId:'b'});act(g,'b',{id:'pull',targetId:'a'});advanceGame(g,1);
  assert.equal(g.players[0].points,10);assert.equal(g.players[0].hp,10);
  assert.equal(g.players[1].points,0);assert.equal(g.players[1].hp,10);
});

test('点杀吸收目标的枪与拳，获得双倍资源且不受原动作反伤',()=>{
  const gun=make();gun.players[0].points=6;gun.players[1].points=3;
  act(gun,'a',{id:'execute',targetId:'b'});act(gun,'b',{id:'gun',targetId:'a',count:3});advanceGame(gun,1);
  assert.equal(gun.players[0].points,6);assert.equal(gun.players[0].hp,10);assert.equal(gun.players[1].hp,10);
  const punch=make();punch.players[0].points=6;
  act(punch,'a',{id:'execute',targetId:'b'});act(punch,'b',{id:'punch',targetId:'a',count:2});advanceGame(punch,1);
  assert.equal(punch.players[0].fists,7);assert.equal(punch.players[0].hp,10);
});

test('点杀遇单枪时目标额外扣1血，点杀者仍不受伤',()=>{
  const g=make();g.players[0].points=6;g.players[1].points=1;
  act(g,'a',{id:'execute',targetId:'b'});act(g,'b',{id:'gun',targetId:'a',count:1});advanceGame(g,1);
  assert.equal(g.players[0].points,2);assert.equal(g.players[0].hp,10);
  assert.equal(g.players[1].hp,9);
});

test('点杀吸收密集气功，但密集气功仍能反击其他攻击者',()=>{
  const g=make(3);g.players[0].points=6;g.players[1].points=4;g.players[2].points=1;
  act(g,'a',{id:'execute',targetId:'b'});act(g,'b',{id:'mass'});act(g,'c',{id:'gun',targetId:'b',count:1});advanceGame(g,1);
  assert.equal(g.players[0].points,8);assert.equal(g.players[0].hp,10);
  assert.equal(g.players[2].hp,7);assert.equal(g.players[1].hp,10);
});

test('变点类遇角刀转枪，与角刀的反击枪互抵',()=>{
  const g=make();g.players[0].points=2;g.players[1].points=1;
  act(g,'a',{id:'push',targetId:'b'});act(g,'b',{id:'knife1'});advanceGame(g,1);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[1].hp,10);
  assert.equal(g.players[1].points,0);
});

test('两人互出变点类时按各自耗点数转枪并对冲',()=>{
  const g=make();g.players[0].points=2;g.players[1].points=3;
  act(g,'a',{id:'push',targetId:'b'});act(g,'b',{id:'pull',targetId:'a'});advanceGame(g,1);
  assert.equal(g.players[0].hp,9);assert.equal(g.players[1].hp,10);
});

test('推被点杀和其他枪同时攻击时，只反击其他攻击者',()=>{
  const g=make(3);g.players[0].points=6;g.players[1].points=2;g.players[2].points=1;
  act(g,'a',{id:'execute',targetId:'b'});act(g,'b',{id:'push',targetId:'a'});act(g,'c',{id:'gun',targetId:'b',count:1});advanceGame(g,1);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[2].hp,9);
});

test('热气遇摩擦时摩擦扣3血且不算空摩',()=>{
  const g=make();g.players[0].points=3;
  act(g,'a',{id:'heat'});act(g,'b',{id:'friction'});advanceGame(g,1);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[1].hp,7);
  assert.doesNotMatch(g.events.join('\n'),/摩擦令.*失去 2 血/);
});

test('两份热气各使摩擦扣3血，失败的热气不触发特殊结算',()=>{
  const g=make(3);g.players[0].points=3;g.players[1].points=3;
  act(g,'a',{id:'heat'});act(g,'b',{id:'heat'});act(g,'c',{id:'friction'});advanceGame(g,1);
  assert.equal(g.players[2].hp,4);
  const failed=make();failed.players[0].hp=2;
  act(failed,'a',{id:'heat'});act(failed,'b',{id:'friction'});advanceGame(failed,1);
  assert.equal(failed.players[1].hp,8);
});

test('爆点密集气功遇7枪时按对冲后的3枪受伤',()=>{
  const g=make();g.players[1].points=7;
  act(g,'a',{id:'mass',burst:0});act(g,'b',{id:'gun',targetId:'a',count:7});advanceGame(g,1);
  assert.equal(g.players[0].hp,3);assert.equal(g.players[1].hp,10);
  assert.match(g.events.join('\n'),/爆点消耗了 4 血/);
});

test('截图对局：推缺2点爆2血，抵消8枪中的2枪后应剩2血',()=>{
  const g=make();
  const round=(a:Parameters<typeof submitMain>[2],b:Parameters<typeof submitMain>[2],now:number,final=false)=>{act(g,'a',a);act(g,'b',b);advanceGame(g,now);assert.equal(g.phase,'reveal');if(!final)advanceGame(g,now+PHASE_SECONDS.reveal*1_000)};
  round({id:'accumulate'},{id:'accumulate'},1);
  round({id:'skip'},{id:'accumulate'},5_002);
  round({id:'pull',targetId:'b'},{id:'accumulate'},10_003);
  round({id:'five7'},{id:'skip'},15_004);
  round({id:'skip'},{id:'punch',targetId:'a',count:1},20_005);
  assert.equal(g.players[1].hp,10);assert.equal(g.players[1].points,0);
  round({id:'gun',targetId:'b',count:8},{id:'push',targetId:'a'},25_006,true);
  assert.equal(g.players[1].hp,2);assert.equal(g.players[1].alive,true);
  assert.match(g.events.join('\n'),/爆点消耗了 2 血/);
  assert.match(g.events.join('\n'),/枪令.*失去 6 血/);
});

test('延判不得再次举拳或举盾，也不能一次用两把铲子',()=>{
  const g=make();g.players[0].points=12;
  act(g,'a',{id:'bigShield'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.phase,'delayed');
  assert.throws(()=>submitDelayed(g,'a',[{id:'raiseFist'}]),/不能再次使用延判类动作/);
  assert.throws(()=>submitDelayed(g,'a',[{id:'plastic',targetId:'b'},{id:'iron',targetId:'b'}]),/最多使用一把铲子/);
});

test('举双盾一次获得两面盾和6点延判额度',()=>{
  const g=make();g.players[0].points=14;
  act(g,'a',{id:'doubleShield'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.phase,'delayed');assert.equal(g.players[0].shields,2);
  assert.equal(g.players[0].delayed?.budget,6);
  assert.throws(()=>submitDelayed(g,'a',[{id:'five10'}]),/不能5换/);
  submitDelayed(g,'a',[{id:'gun',targetId:'b',count:3},{id:'gun',targetId:'b',count:3}]);advanceGame(g,2);
  assert.equal(g.players[1].hp,4);
});

test('一次可举三个拳，每个延判一个免费点，第四个不合法',()=>{
  const g=make();g.players[0].points=9;
  assert.throws(()=>act(g,'a',{id:'raiseFist',count:4}),/最多3个/);
  act(g,'a',{id:'raiseFist',count:3});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.players[0].fists,6);assert.equal(g.players[0].delayed?.budget,3);assert.equal(g.players[0].delayed?.max,3);
  submitDelayed(g,'a',Array.from({length:3},()=>({id:'gun',targetId:'b',count:1})));advanceGame(g,2);
  assert.equal(g.players[1].hp,7);
});

test('大小盾一次最多两个，大盾两个耗24并提供16点延判',()=>{
  const small=make();small.players[0].points=14;
  assert.throws(()=>act(small,'a',{id:'smallShield',count:3}),/最多举2个/);
  act(small,'a',{id:'smallShield',count:2});act(small,'b',{id:'guard'});advanceGame(small,1);
  assert.equal(small.players[0].shields,2);assert.equal(small.players[0].delayed?.budget,6);
  const big=make();big.players[0].points=34;
  assert.throws(()=>act(big,'a',{id:'bigShield',count:3}),/最多举2个/);
  act(big,'a',{id:'bigShield',count:2});act(big,'b',{id:'guard'});advanceGame(big,1);
  assert.equal(big.players[0].points,10);assert.equal(big.players[0].shields,2);
  assert.equal(big.players[0].delayed?.budget,16);assert.equal(big.players[0].delayed?.max,2);
  submitDelayed(big,'a',[{id:'five10'},{id:'five10'}]);advanceGame(big,2);
  assert.equal(big.players[0].points,20);
});

test('盾劈识别举双盾但不使盾或延判失效',()=>{
  const g=make();g.players[0].points=14;g.players[1].points=3;
  act(g,'a',{id:'doubleShield'});act(g,'b',{id:'shieldThunder'});advanceGame(g,1);
  assert.equal(g.players[0].hp,7);assert.equal(g.players[0].shields,2);
  assert.equal(g.phase,'delayed');
});

test('两人延判先隐藏猜拳，胜者先行动并可打断后手',()=>{
  const g=make();g.players[0].points=3;g.players[1].points=3;g.players[1].hp=1;
  act(g,'a',{id:'raiseFist'});act(g,'b',{id:'raiseFist'});advanceGame(g,1);
  assert.equal(g.phase,'priorityRps');
  submitRps(g,'a','priority','rock');
  assert.deepEqual(publicGame(g).priority?.submittedIds,['a']);
  assert.equal(JSON.stringify(publicGame(g)).includes('rock'),false);
  submitRps(g,'b','priority','scissors');advanceGame(g,2);
  assert.equal(g.phase,'delayed');
  submitDelayed(g,'a',[{id:'gun',targetId:'b',count:1}]);
  submitDelayed(g,'b',[{id:'gun',targetId:'a',count:1}]);advanceGame(g,3);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[1].hp,0);
  assert.equal(g.phase,'reveal');advanceGame(g,5_003);assert.equal(g.phase,'finished');
  assert.match(g.events.join('\n'),/行动前已阵亡/);
  assert.equal(publicGame(g).reveal!.actions[1].entries!.find(entry=>entry.stage==='delayed')!.status,'skipped');
});

test('延判猜拳平局重猜，铲子结算后继续后手动作',()=>{
  const g=make();g.players[0].points=12;g.players[1].points=3;
  act(g,'a',{id:'bigShield'});act(g,'b',{id:'raiseFist'});advanceGame(g,1);
  submitRps(g,'a','priority','rock');submitRps(g,'b','priority','rock');advanceGame(g,2);
  assert.equal(g.phase,'priorityRps');assert.deepEqual(publicGame(g).priority?.submittedIds,[]);
  submitRps(g,'a','priority','rock');submitRps(g,'b','priority','scissors');advanceGame(g,3);
  submitDelayed(g,'a',[{id:'iron',targetId:'b'}]);submitDelayed(g,'b',[{id:'guard'}]);advanceGame(g,4);
  assert.equal(g.phase,'rps');
  submitRps(g,'a',g.rps[0].id,'rock');submitRps(g,'b',g.rps[0].id,'scissors');advanceGame(g,5);
  assert.equal(g.players[1].hp,5);assert.equal(g.phase,'reveal');advanceGame(g,5_005);assert.equal(g.round,2);
});

test('最后存活者立即获胜并获得击杀',()=>{
  const g=make();g.players[0].points=6;g.players[1].hp=7;act(g,'a',{id:'execute',targetId:'b'});act(g,'b',{id:'guard'});advanceGame(g,1);
  assert.equal(g.phase,'reveal');assert.deepEqual(g.winnerIds,['a']);assert.equal(g.players[0].kills,1);
  assert.equal(g.deadline,5_001);advanceGame(g,5_000);assert.equal(g.phase,'reveal');
  advanceGame(g,5_001);assert.equal(g.phase,'finished');
});
