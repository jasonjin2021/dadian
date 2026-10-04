import test from 'node:test';
import assert from 'node:assert/strict';
import {outcomeCatalog,outcomeCoverage,voiceWorksheet,voiceAssignments} from './settlement-catalog.ts';
import {existsSync} from 'node:fs';
import {createGame,startGame,submitMain,advanceGame,publicGame} from './game.ts';

test('配音清单保留15个不重复结果，移除攻防并保留回血',()=>{
  assert.equal(outcomeCatalog.length,15);
  assert.equal(new Set(outcomeCatalog.map(item=>item.id)).size,15);
  assert.equal(new Set(outcomeCatalog.map(item=>item.name)).size,15);
  assert.ok(outcomeCatalog.every(item=>String(item.group)!=='攻防'));
  assert.ok(outcomeCatalog.some(item=>item.id==='R21'));
  for(const item of outcomeCatalog)assert.ok(voiceWorksheet().includes(`${item.id} ${item.name}：`));
});

test('15个结果与用户音轨一一对应，公开音频存在且映射不重复',()=>{
  assert.deepEqual(Object.keys(voiceAssignments).sort(),outcomeCatalog.map(x=>x.id).sort());
  assert.equal(new Set(Object.values(voiceAssignments)).size,15);
  for(const [id,filename] of Object.entries(voiceAssignments))assert.ok(existsSync(new URL(`../public/audio/results/${id}.${filename.split('.').pop()}`,import.meta.url)),`${id}: ${filename}`);
  assert.match(voiceAssignments.R21,/041_好运连连/);
});

test('结果原因覆盖A–I与通用分支，正常费用不叫失点',()=>{
  assert.deepEqual([...new Set(outcomeCoverage.map(item=>item.group[0]))],['A','B','C','D','E','F','G','H','I','通']);
  assert.equal(outcomeCoverage.length,35);
  assert.match(outcomeCatalog.find(item=>item.id==='R07')!.note,/正常耗点不算/);
  assert.match(outcomeCatalog.find(item=>item.id==='R20')!.note,/不能因为删了攻防分类/);
});

test('用户配音示例：9点五换7被两人拉，实际失点但公开状态不泄露余额',()=>{
  const game=startGame(createGame([{id:'a',name:'本人',seat:1},{id:'b',name:'先拉',seat:2},{id:'c',name:'后拉',seat:3}]),0);
  game.players[0].points=9;game.players[1].points=3;game.players[2].points=3;
  submitMain(game,'a',{id:'five7'});submitMain(game,'b',{id:'pull',targetId:'a'});submitMain(game,'c',{id:'pull',targetId:'a'});advanceGame(game,1);
  assert.deepEqual(game.players.map(player=>player.points),[0,2,9]);
  assert.deepEqual(game.players.map(player=>player.hp),[10,10,10]);
  assert.doesNotMatch(JSON.stringify(publicGame(game)),/"points"|"swap"|"added"/);
});
