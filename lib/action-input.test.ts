import test from 'node:test';
import assert from 'node:assert/strict';
import {actionCountLimit,availableTargets,parseActionCount,selectedTargetId} from './action-input.ts';

test('数量可从1删除为空后再输入，空值不能提交也不会强制变成1',()=>{
  let editing='1';assert.deepEqual(parseActionCount(editing,99),{valid:true,value:1});
  editing='';assert.deepEqual(parseActionCount(editing,99),{valid:false,message:'请填写数量'});assert.equal(editing,'');
  editing='8';assert.deepEqual(parseActionCount(editing,99),{valid:true,value:8});assert.equal(editing,'8');
});

test('主动作与第二动作共用严格整数校验，不接受小数、符号、科学计数和超限',()=>{
  for(const raw of ['',' ','0','-1','+1','1.5','1.0','1e2','abc','100','Infinity','9007199254740993'])assert.equal(parseActionCount(raw,99).valid,false,raw);
  for(const raw of ['1','9','99',' 12 ','02']){
    const result=parseActionCount(raw,99);assert.equal(result.valid,true,raw);if(result.valid)assert.equal(result.value,Number(raw));
  }
});

test('枪拳与兑换最多99，举拳最多3，大小盾最多2',()=>{
  for(const id of ['gun','punch','convert'] as const){assert.equal(actionCountLimit(id),99);assert.equal(parseActionCount('99',actionCountLimit(id)).valid,true);assert.equal(parseActionCount('100',actionCountLimit(id)).valid,false);}
  assert.equal(actionCountLimit('raiseFist'),3);assert.equal(parseActionCount('3',actionCountLimit('raiseFist')).valid,true);assert.equal(parseActionCount('4',actionCountLimit('raiseFist')).valid,false);
  for(const id of ['smallShield','bigShield'] as const){assert.equal(actionCountLimit(id),2);assert.equal(parseActionCount('2',actionCountLimit(id)).valid,true);assert.equal(parseActionCount('3',actionCountLimit(id)).valid,false);}
});

test('可点击目标只包含其他存活者，不包含自己或已淘汰玩家',()=>{
  const players=[{id:'a',alive:true},{id:'b',alive:true},{id:'c',alive:false},{id:'d',alive:true}];
  assert.deepEqual(availableTargets(players,'a'),[{id:'b',alive:true},{id:'d',alive:true}]);assert.equal(players.length,4);
});

test('目标优先保留已选择者；目标不再有效时仅回退到有效者，没有目标返回空',()=>{
  const targets=[{id:'b'},{id:'d'}];assert.equal(selectedTargetId(targets,'d'),'d');assert.equal(selectedTargetId(targets,'a'),'b');assert.equal(selectedTargetId(targets,''),'b');assert.equal(selectedTargetId([],'d'),'');
});
