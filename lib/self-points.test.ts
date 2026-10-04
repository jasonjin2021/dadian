import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleSelfPoints,type PersonalBalanceView} from './self-points.ts';
const view=(points=0):PersonalBalanceView=>({member:{id:'self',role:'player'},game:{players:[{id:'self'},{id:'other'}]},selfPoints:{playerId:'self',points}});
test('本人余额显示服务端0和非零值，不计算或填充其他玩家余额',()=>{
  assert.equal(visibleSelfPoints(view()),0);assert.equal(visibleSelfPoints(view(11)),11);
  const state=view(8),before=JSON.stringify(state);assert.equal(visibleSelfPoints(state),8);assert.equal(JSON.stringify(state),before);
});
test('观战、未入房、错身份、旧快照和旧服务器无余额字段时不能显示余额',()=>{
  const state=view(9);state.member={id:'self',role:'spectator'};assert.equal(visibleSelfPoints(state),undefined);
  state.member=null;assert.equal(visibleSelfPoints(state),undefined);
  state.member={id:'other',role:'player'};assert.equal(visibleSelfPoints(state),undefined);
  state.member={id:'self',role:'player'};state.game.players=[];assert.equal(visibleSelfPoints(state),undefined);
  const missing=view();delete missing.selfPoints;assert.equal(visibleSelfPoints(missing),undefined);
});
test('无效数字不会显示为余额',()=>{
  for(const points of [-1,NaN,Infinity,0.1,Number.MAX_SAFE_INTEGER+1])assert.equal(visibleSelfPoints(view(points)),undefined);
});
