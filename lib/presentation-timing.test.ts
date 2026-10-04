import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationOffset} from './presentation-timing.ts';
test('动画首帧offset不随100ms时钟变化，避免重建三维场景',()=>{
  for(let ms=480;ms<=5000;ms+=100)assert.equal(presentationOffset(480,ms,false,false),480);
});
test('迟到重连从当前进度起步，结束始终停在终帧',()=>{
  assert.equal(presentationOffset(2200,2300,false,false),2200);
  assert.equal(presentationOffset(2200,2300,true,false),5000);
  assert.equal(presentationOffset(0,0,true,true),5000);
});
test('定格可前后拖动，非法和越界时间不进入动画',()=>{
  for(const t of [0,600,3500,1800])assert.equal(presentationOffset(0,t,false,true),t);
  assert.equal(presentationOffset(-20,300,false,false),0);
  assert.equal(presentationOffset(NaN,300,false,false),0);
  assert.equal(presentationOffset(300,7000,false,true),5000);
});
