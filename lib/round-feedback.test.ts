import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {advanceGame,createGame,startGame,rematch,submitMain,submitDelayed,submitRps,publicGame,selfVoice,PHASE_SECONDS,type ActionInput} from './game.ts';
import {selectRoundVoice,VOICE_ORDER} from './round-feedback.ts';
import {voiceAssignments} from './settlement-catalog.ts';
const make=(count=2)=>startGame(createGame(Array.from({length:count},(_,i)=>({id:String(i),name:`玩家${i}`,seat:i+1}))),0);
const round=(g:ReturnType<typeof make>,actions:ActionInput[])=>{actions.forEach((a,i)=>submitMain(g,String(i),a));advanceGame(g,1);};

test('15个语音标签保持原音轨映射，公开音频与已核验原件的SHA-256一致',()=>{
  // Fixed after byte-for-byte verification against the selected originals.
  const expected=[
    ['R01','009_不不不不不我无疑是兴奋的.mp3','b7337e4c3de4c5b345736029ea8256904cc27826eb1010d3afe61e31bbf66598'],
    ['R02','021_嗯？.mp3','5d5d45e9e083dcd23f1eafe0c60312f64a894b65df6ea50a546c45184dd618b9'],
    ['R03','046_男主角死亡音效.mp3','ba07c191142f29dba81f913a5c7dd07150b0f722e409df984b5ff2e1f1572dbf'],
    ['R04','071_biubiu击毙你.mp3','a6cae6ecee50648fbd8f54cf1879871fe7ac968a51a0de284cdc71302486fad6'],
    ['R05','048_哎呦我的妈.mp3','3ddbeb7f55e74a05cbe5bdc0d8cbb12746e6e754520ee5a1d24f00dcf9ea0b60'],
    ['R06','018_诶呦我去.mp3','cacea8e7df51b83373436ed501546007e0cd9d1e72afac27881f8d99469ea062'],
    ['R07','014_不要啊.wav','4d39b1f53271f174f392e7257c9e53cd47b26574b5323b00582dec38e0d1291c'],
    ['R08','035_嘿嘿笑.mp3','c67dc5c838512ac073af9d77955d75df9055622eb4bdb8d7981c0bdd729b5f82'],
    ['R09','016_真的很帅.wav','52e91428c48baac7dbedf2d74e1aef7bfffc790aeba51c676c8560ab09d2c48a'],
    ['R10','104_不不不不我是愤怒的.mp3','816f022c70dbd65ead0753a81cf72d360a6ef8f668bf969f14e2578d4864cfbf'],
    ['R17','053_我真得控制你了.mp3','8679973a73edc903d41604a89e24d31c4b4224d3cc1395a2b95bf17f9e8cd7f4'],
    ['R18','011_叹气声.mp3','64ce3bf592b6119a3ca482b7277684d5f14fc11eebf9d72582c57a7165229ab5'],
    ['R19','054_老是聊天聊着聊着消失.mp3','3f5852365101b027252a9e46591b78ecafe1717cfa90f49e1788c50786ba5db8'],
    ['R20','030_呵呵笑.mp3','093fa039569e9aa2a5174b23cd460ef697622278c9303651af16342197dc9d2b'],
    ['R21','041_好运连连.mp3','ed4bfe6c3f2d2a8afffd70f65112c560f414b0dead8721c1b4f9655326dbe2f0'],
  ] as const;
  const ids=expected.map(([id])=>id).sort();
  assert.equal(ids.length,15);
  assert.deepEqual([...VOICE_ORDER].sort(),ids);
  assert.deepEqual(Object.keys(voiceAssignments).sort(),ids);
  for(const [id,file,sha256] of expected){
    assert.equal(voiceAssignments[id],file,`${id} source mapping`);
    const audio=readFileSync(new URL(`../public/audio/results/${id}.${file.split('.').pop()}`,import.meta.url));
    assert.equal(createHash('sha256').update(audio).digest('hex'),sha256,`${id} audio content`);
  }
});
test('优先失点而非积点喜悦；终局、受伤、治疗与资源按明确优先级',()=>{
  for(const [results,expected] of [[['R08','R07'],'R07'],[['R05','R21'],'R05'],[['R03','R01'],'R01'],[['R03','R02'],'R02'],[['R09','R17'],'R17']] as const)
    assert.equal(selectRoundVoice({results:[...results],acted:true,suppressEmpty:false}),expected);
  assert.equal(selectRoundVoice({results:[],acted:true,suppressEmpty:true}),undefined);
  assert.equal(selectRoundVoice({results:[],acted:true,suppressEmpty:false}),'R20');
});
test('五换7两次拉只给本人失点标签，不返回隐藏账本或对手私有语音',()=>{
  const g=make(3);g.players.forEach((p,i)=>p.points=i?3:9);
  round(g,[{id:'five7'},{id:'pull',targetId:'0'},{id:'pull',targetId:'0'}]);
  assert.deepEqual(g.players.map(p=>p.points),[0,2,9]);
  assert.equal(selfVoice(g,'0')?.id,'R07');assert.equal(selfVoice(g,'1')?.id,'R08');
  assert.deepEqual(Object.keys(selfVoice(g,'0')!).sort(),['id','key']);
  assert.equal(selfVoice(g,'spectator'),undefined);assert.equal(selfVoice(g),undefined);
  assert.doesNotMatch(JSON.stringify(publicGame(g)),/points|roundVoice|publicGains|suppressEmpty|"R0[178]"/);
});
test('正常耗点不产生失点语音，零点被推也不产生失点',()=>{
  const g=make();g.players[0].points=1;
  round(g,[{id:'gun',targetId:'1'},{id:'guard'}]);
  assert.equal(g.roundVoiceFacts?.['0'].results.includes('R07'),false);
  assert.equal(selfVoice(g,'1'),undefined);
  const h=make();h.players[0].points=2;round(h,[{id:'push',targetId:'1'},{id:'skip'}]);
  assert.equal(selfVoice(h,'0')?.id,'R20');assert.equal(selfVoice(h,'1'),undefined);
});
test('爆点与敌方伤害同轮只选受伤，扣血数值不改变',()=>{
  const g=make();g.players[1].points=8;
  round(g,[{id:'push',targetId:'1'},{id:'gun',count:8,targetId:'0'}]);
  assert.equal(g.players[0].hp,2);assert.equal(selfVoice(g,'0')?.id,'R05');
  assert.ok(g.roundVoiceFacts?.['0'].results.includes('R06'));
});
test('治疗真实恢复R21；治疗打爆既不回血也不误报空操作',()=>{
  const g=make();g.players[0].points=3;round(g,[{id:'smallHeal'},{id:'skip'}]);
  assert.equal(g.players[0].hp,11);assert.equal(selfVoice(g,'0')?.id,'R21');
  const h=make();h.players[0].points=3;h.players[1].points=1;round(h,[{id:'smallHeal'},{id:'gun',targetId:'0'}]);
  assert.equal(h.players[0].hp,10);assert.equal(selfVoice(h,'0'),undefined);
});
test('延判与JSON持久化后，整轮只生成一条最终语音',()=>{
  let g=make();g.players[0].points=3;round(g,[{id:'raiseFist'},{id:'skip'}]);
  assert.equal(g.phase,'delayed');assert.equal(selfVoice(g,'0'),undefined);
  g=JSON.parse(JSON.stringify(g));submitDelayed(g,'0',[{id:'accumulate'}]);advanceGame(g,2);
  assert.equal(selfVoice(g,'0')?.id,'R08');
  const before=JSON.stringify(g);advanceGame(g,3);assert.equal(JSON.stringify(g),before);
});
test('资源不足、超时、主动跳过分别处理',()=>{
  const g=make();submitMain(g,'0',{id:'super',targetId:'1'});advanceGame(g,PHASE_SECONDS.main*1000);
  assert.equal(selfVoice(g,'0')?.id,'R18');assert.equal(selfVoice(g,'1')?.id,'R19');
  const h=make();round(h,[{id:'skip'},{id:'skip'}]);assert.equal(selfVoice(h,'0'),undefined);
});
test('互出雷劈保持无伤，但如实归为动作取消',()=>{
  const g=make();g.players.forEach(p=>p.points=4);round(g,[{id:'thunder'},{id:'thunder'}]);
  assert.deepEqual(g.players.map(p=>p.hp),[10,10]);assert.equal(selfVoice(g,'0')?.id,'R17');assert.equal(selfVoice(g,'1')?.id,'R17');
});
test('终局胜利与淘汰覆盖伤害，揭晓之后不再发送语音',()=>{
  const g=make();g.players[0].points=12;round(g,[{id:'gun',targetId:'1',count:12},{id:'skip'}]);
  assert.equal(selfVoice(g,'0')?.id,'R01');assert.equal(selfVoice(g,'1')?.id,'R03');
  advanceGame(g,5001);assert.equal(g.phase,'finished');assert.equal(selfVoice(g,'0'),undefined);
});
test('盾水事件记录获得与同轮破裂，而非只记录净数量',()=>{
  const g=make();g.players[0].points=7;g.players[1].points=1;
  round(g,[{id:'smallShield'},{id:'gun',targetId:'0'}]);
  assert.deepEqual(g.resourceEvents?.map(e=>[e.resource,e.delta,e.remaining,e.cause]),[['shield',1,1,'gain'],['shield',-1,0,'blocked']]);
  assert.equal(g.players[0].hp,10);assert.equal(g.players[0].shields,0);
  submitDelayed(g,'0',[]);advanceGame(g,2);assert.equal(selfVoice(g,'0'),undefined);
});
test('盾优先水其次，减到零的伤害与点杀不爆资源',()=>{
  const g=make(3);g.players[0].shields=1;g.players[0].waters=1;g.players[1].points=1;g.players[2].points=1;
  round(g,[{id:'skip'},{id:'gun',targetId:'0'},{id:'gun',targetId:'0'}]);
  assert.deepEqual(g.resourceEvents?.map(e=>e.resource),['shield','water']);assert.equal(g.players[0].hp,10);
  for(const attack of ['gun','execute'] as const){const h=make();h.players[0].shields=1;h.players[0].waters=1;h.players[1].points=6;
    round(h,[{id:'guard'},{id:attack,targetId:'0'}]);assert.deepEqual(h.resourceEvents,[]);assert.equal(h.players[0].shields,1);}
});
test('super摧毁所有盾水、无盾水时不伪造破碎',()=>{
  const g=make();g.players[0].shields=2;g.players[0].waters=3;g.players[1].points=5;
  round(g,[{id:'skip'},{id:'super',targetId:'0'}]);
  assert.deepEqual(g.resourceEvents?.map(e=>[e.delta,e.remaining,e.cause]),[[-2,0,'destroyed'],[-3,0,'destroyed']]);
  assert.equal(g.players[0].hp,10);assert.equal(selfVoice(g,'0')?.id,'R10');
  const h=make();h.players[1].points=5;round(h,[{id:'skip'},{id:'super',targetId:'0'}]);assert.deepEqual(h.resourceEvents,[]);
});
test('主动爆盾是spent不是强制destroyed，不误报愤怒音轨',()=>{
  const g=make();g.players[0].shields=1;round(g,[{id:'popShield',targetId:'1'},{id:'smallHeal'}]);
  assert.equal(g.resourceEvents?.[0].cause,'spent');assert.equal(g.roundVoiceFacts?.['0'].results.includes('R10'),false);
});
test('铲子猜拳后的实际爆水也有事件',()=>{
  const g=make();g.players[0].points=4;g.players[1].waters=1;
  round(g,[{id:'iron',targetId:'1'},{id:'skip'}]);
  assert.equal(g.phase,'rps');assert.equal(g.resourceEvents?.length,0);
  submitRps(g,'0',g.rps[0].id,'rock');submitRps(g,'1',g.rps[0].id,'scissors');advanceGame(g,2);
  assert.equal(g.resourceEvents?.[0].resource,'water');assert.equal(g.resourceEvents?.[0].cause,'blocked');
  // Exercise the durable duel path with a resource acquired before duel settlement.
  const h=make();h.players[0].points=4;round(h,[{id:'iron',targetId:'1'},{id:'skip'}]);assert.equal(h.phase,'rps');h.players[1].waters=1;
  submitRps(h,'0',h.rps[0].id,'rock');submitRps(h,'1',h.rps[0].id,'scissors');advanceGame(h,2);
  assert.equal(h.resourceEvents?.[0].resource,'water');assert.equal(h.players[1].hp,10);
});
test('新回合清空事件和语音；旧房间与重开兼容且事件键不复用',()=>{
  const g=make();g.players[0].points=6;round(g,[{id:'holyWater'},{id:'skip'}]);
  const oldId=g.resourceEvents![0].id;assert.equal(selfVoice(g,'0')?.id,'R09');
  advanceGame(g,5001);assert.deepEqual(g.resourceEvents,[]);assert.equal(selfVoice(g,'0'),undefined);assert.equal(g.players[0].waters,1);
  delete g.roundVoiceFacts;delete g.roundVoices;delete g.resourceEvents;assert.doesNotThrow(()=>publicGame(g));
  rematch(g,6000);assert.equal(g.phaseStartedAt,6000);g.players[0].points=6;
  // The round() helper uses t=1 for a fresh game; this rematch starts at t=6000.
  submitMain(g,'0',{id:'holyWater'});submitMain(g,'1',{id:'skip'});advanceGame(g,6001);
  assert.equal(g.phase,'reveal');const events=publicGame(g).resourceEvents;
  assert.ok(events);assert.equal(events.length,1);assert.notEqual(events[0].id,oldId);
});
