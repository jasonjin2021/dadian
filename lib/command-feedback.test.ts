import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,publicGame,startGame} from './game.ts';
import {phaseKey,submissionProgress,type SubmissionContext} from './command-feedback.ts';

const view=()=>({code:'ABC234',game:publicGame(startGame(createGame([{id:'a',name:'甲',seat:1},{id:'b',name:'乙',seat:2}]),0))});
const context=(latest:ReturnType<typeof view>,command='action',duelId?:string):SubmissionContext=>({code:latest.code,command,phase:phaseKey(latest.game),playerId:'a',duelId});

test('晚到超时先看最新服务端确认：主动作已确认则不再显示失败',()=>{
  const latest=view(),request=context(latest);
  assert.equal(submissionProgress(request,latest),'pending');
  latest.game.players[0].confirmed=true;
  assert.equal(submissionProgress(request,latest),'confirmed');
});

test('同阶段真正未确认的失败必须保留，其他玩家的确认不能掩盖它',()=>{
  const latest=view(),request=context(latest);latest.game.players[1].confirmed=true;
  assert.equal(submissionProgress(request,latest),'pending');
  latest.game.confirmed=1;latest.game.required=2;
  assert.equal(submissionProgress(request,latest),'pending');
});

test('延判错误只在延判提交被服务端确认后清除',()=>{
  const latest=view();latest.game.phase='delayed';latest.game.deadline=20_000;
  const request=context(latest,'delayed');
  assert.equal(submissionProgress(request,latest),'pending');
  latest.game.players[0].confirmed=true;
  assert.equal(submissionProgress(request,latest),'confirmed');
});

test('先后猜拳只看自己的submittedIds，不用主阶段confirmed冒充猜拳已提交',()=>{
  const latest=view();latest.game.phase='priorityRps';latest.game.deadline=8_001;latest.game.players[0].confirmed=true;
  latest.game.priority={playerIds:['a','b'],submittedIds:['b']};const request=context(latest,'rps','priority');
  assert.equal(submissionProgress(request,latest),'pending');
  latest.game.priority.submittedIds.push('a');assert.equal(submissionProgress(request,latest),'confirmed');
});

test('多个铲子猜拳必须匹配原duelId，不被其他对局已提交误清错误',()=>{
  const latest=view();latest.game.phase='rps';latest.game.deadline=8_001;
  latest.game.rps=[{id:'duel-1',attackerId:'a',targetId:'b',kind:'iron',submittedIds:['a']},{id:'duel-2',attackerId:'a',targetId:'b',kind:'iron',submittedIds:['b']}];
  const request=context(latest,'rps','duel-2');assert.equal(submissionProgress(request,latest),'pending');
  latest.game.rps[1].submittedIds.push('a');assert.equal(submissionProgress(request,latest),'confirmed');
});

test('已换阶段、换回合、重开或同阶段重猜时，旧提交错误均过期',()=>{
  for(const change of ['phase','round','match','deadline'] as const){
    const latest=view(),request=context(latest);
    if(change==='phase')latest.game.phase='reveal';else latest.game[change]=(latest.game[change]??0)+1;
    assert.equal(submissionProgress(request,latest),'expired',change);
  }
});

test('没有新状态时不能假定成功；非回合操作的错误不按阶段清掉',()=>{
  const latest=view(),request=context(latest);assert.equal(submissionProgress(request,null),'pending');
  const start=context(latest,'start');latest.game.phase='reveal';assert.equal(submissionProgress(start,latest),'pending');
});

test('换到别的房间后，前一房间的提交错误过期',()=>{
  const latest=view(),request=context(latest);latest.code='XYZ567';assert.equal(submissionProgress(request,latest),'expired');
});
