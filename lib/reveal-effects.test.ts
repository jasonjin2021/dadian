import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIONS,type ActionId,type RevealedAction} from './game.ts';
import {revealEffect,revealedActionCount,revealedEntries} from './reveal-effects.ts';

const entry=(id:ActionId,extra:Partial<RevealedAction>&{count?:number}={}):RevealedAction&{count?:number}=>({id,label:ACTIONS.find(a=>a.id===id)!.name,stage:'main',burstPoints:0,status:'played',...extra});

test('每个正式动作都接到现有特效，跳过除外',()=>{
  for(const action of ACTIONS)assert.equal(revealEffect(entry(action.id)).kind==='mark',action.id==='skip',action.id);
  assert.deepEqual(revealEffect(entry('gun')),{kind:'gun'});
  assert.deepEqual(revealEffect(entry('execute')),{kind:'document',id:'executePierce',count:1,scenario:'cast'});
  for(const id of ['mass','fly','guard','snap','super','holyBlock'] as const)assert.equal((revealEffect(entry(id)) as {id:string}).id,id);
  for(const id of ['popShield','popWater'] as const)assert.equal((revealEffect(entry(id)) as {id:string}).id,'iron');
});

test('失败和未执行动作不挂动画或画布，包括延判',()=>{
  for(const action of ACTIONS)for(const status of ['failed','skipped'] as const)for(const stage of ['main','delayed'] as const){
    assert.deepEqual(revealEffect(entry(action.id,{status,stage})),{kind:'mark'});
  }
});

test('公开数量驱动单拳/多拳及小双大盾，不从库存推断',()=>{
  assert.equal((revealEffect(entry('punch',{count:1})) as {id:string}).id,'punch');
  assert.equal((revealEffect(entry('punch',{count:3})) as {id:string}).id,'multiPunch');
  assert.deepEqual(revealEffect(entry('smallShield',{count:1})),{kind:'document',id:'smallShield',count:1,scenario:'cast'});
  assert.deepEqual(revealEffect(entry('doubleShield')),{kind:'document',id:'smallShield',count:2,scenario:'cast'});
  assert.deepEqual(revealEffect(entry('smallShield',{count:2})),{kind:'document',id:'smallShield',count:2,scenario:'cast'});
  assert.deepEqual(revealEffect(entry('bigShield',{count:2})),{kind:'document',id:'bigShield',count:2,scenario:'cast'});
});

test('旧存档数量仅解析动作名后的公开倍数，不读取目标名或任意文字',()=>{
  assert.equal(revealedActionCount(entry('punch',{label:'拳 ×3 → 对手'})),3);
  assert.equal(revealedActionCount(entry('punch',{label:'拳 → 对手 ×9'})),1);
  assert.equal(revealedActionCount(entry('punch',{label:'拳 ×9 → 对手',count:2})),2);
  for(const label of ['拳 ×0','拳 ×999','某人拳 ×3','拳 ×2x'])assert.equal(revealedActionCount(entry('punch',{label})),1);
});

test('雷与治疗只发动，不借汇总血量或随机场景预演命中回血',()=>{
  for(const id of ['fistThunder','shieldThunder','pointThunder','thunder','smallHeal','bigHeal'] as const){
    assert.deepEqual(revealEffect(entry(id)),{kind:'document',id,count:1,scenario:'cast'});
  }
});

test('保留主动作及多条延判，失败条目仍保留标签但不播特效',()=>{
  const entries=[entry('doubleShield'),entry('gun',{stage:'delayed',targetId:'target'}),entry('punch',{stage:'delayed',status:'failed'})];
  const action={playerId:'p',name:'玩家',main:'举双盾',delayed:['枪','拳'],entries};
  assert.equal(revealedEntries(action),entries);
  assert.deepEqual(revealedEntries(action).map(e=>revealEffect(e).kind),['document','gun','mark']);
  const legacy=revealedEntries({...action,mainId:'doubleShield',entries:undefined});
  assert.deepEqual(legacy.map(e=>e.id),['doubleShield','skip','skip']);
});
