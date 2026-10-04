import test from 'node:test';
import assert from 'node:assert/strict';
import {OutcomeCueGate,OutcomePlayer,voiceFile} from './outcome-audio.ts';

function setup(load?:(signal:AbortSignal)=>Promise<AudioBuffer>){
  const sources:{starts:number;stops:number[];disconnected:boolean;buffer:AudioBuffer|null}[]=[],volumes:number[]=[];
  let created=0,loads=0,clock=0,resumes=0;
  const buffer={duration:4} as AudioBuffer;
  const context={
    state:'suspended',currentTime:0,destination:{},
    async resume(){resumes++;this.state='running';},async close(){this.state='closed';},
    createBufferSource(){
      const source={starts:0,stops:[] as number[],disconnected:false,buffer:null as AudioBuffer|null,onended:null as (()=>void)|null,
        connect(){},disconnect(){this.disconnected=true;},start(){this.starts++;},stop(at=0){this.stops.push(at);}};
      sources.push(source);return source;
    },
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(value:number){volumes.push(value);}},connect(){},disconnect(){}};},
  };
  const player=new OutcomePlayer({
    context:()=>{created++;return context as unknown as AudioContext;},
    load:async(_id,_context,signal)=>{loads++;return load?load(signal):buffer;},
    now:()=>clock,
  });
  return{player,context,sources,volumes,buffer,advance:(ms:number)=>{clock+=ms;},created:()=>created,loads:()=>loads,resumes:()=>resumes};
}

test('默认准备播放但首次手势前不创建音频上下文或发声',async()=>{
  const t=setup();assert.equal(t.created(),0);
  assert.equal(await t.player.play('R01'),false);assert.equal(t.created(),0);assert.equal(t.loads(),0);
  await Promise.all([t.player.unlock(),t.player.unlock()]);
  assert.equal(t.created(),1);assert.equal(t.resumes(),1);
  assert.equal(await t.player.play('R01'),true);assert.equal(t.sources.length,1);
  assert.deepEqual(t.volumes,[.16,0]);t.player.dispose();
});

test('同一个人的结果使用单一声道，下一条先立即停止上一条',async()=>{
  const t=setup();await t.player.unlock();await t.player.play('R01');await t.player.play('R02');
  assert.equal(t.sources.length,2);assert.deepEqual(t.sources[0].stops,[4,0]);
  assert.equal(t.sources[0].disconnected,true);t.player.dispose();
});

test('播放完成的音频可缓存，但静音会取消尚未完成的异步播放',async()=>{
  let finish!:(buffer:AudioBuffer)=>void,cancelled=false;
  const t=setup(signal=>new Promise<AudioBuffer>(resolve=>{finish=resolve;signal.addEventListener('abort',()=>{cancelled=true;});}));
  await t.player.unlock();const playing=t.player.play('R05');t.player.stop();finish(t.buffer);
  assert.equal(await playing,false);assert.equal(cancelled,true);assert.equal(t.sources.length,0);t.player.dispose();
  const cached=setup();await cached.player.unlock();await cached.player.play('R01');await cached.player.play('R01');
  assert.equal(cached.loads(),1);cached.player.dispose();
});

test('卸载过程中解码完成也不能补播或重新创建音频',async()=>{
  let finish!:(buffer:AudioBuffer)=>void;
  const t=setup(()=>new Promise<AudioBuffer>(resolve=>{finish=resolve;}));
  await t.player.unlock();const playing=t.player.play('R07');t.player.dispose();finish(t.buffer);
  assert.equal(await playing,false);assert.equal(t.sources.length,0);assert.equal(t.context.state,'closed');
  await t.player.unlock();assert.equal(t.created(),1);assert.equal(await t.player.play('R01'),false);
});

test('加载耗时超过本回合剩余时间时不会延迟到下回合发声',async()=>{
  let finish!:(buffer:AudioBuffer)=>void;
  const t=setup(()=>new Promise<AudioBuffer>(resolve=>{finish=resolve;}));
  await t.player.unlock();const playing=t.player.play('R05',1000);t.advance(1100);finish(t.buffer);
  assert.equal(await playing,false);assert.equal(t.sources.length,0);t.player.dispose();
});

test('自动播放被浏览器阻止不绕过限制，下一次明确交互可解锁',async()=>{
  const t=setup();const original=t.context.resume.bind(t.context);
  t.context.resume=async()=>{throw Object.assign(new Error('blocked'),{name:'NotAllowedError'});};
  await assert.rejects(t.player.unlock(),{name:'NotAllowedError'});assert.equal(await t.player.play('R01'),false);
  t.context.resume=original;await t.player.unlock();assert.equal(await t.player.play('R01'),true);t.player.dispose();
});

test('仅消费首次进入之后的新结果，刷新、重复轮询及切换房间不补播旧回合',()=>{
  const gate=new OutcomeCueGate();
  assert.equal(gate.observe('ROOM:a','1:7'),false);
  assert.equal(gate.observe('ROOM:a','1:7'),false);
  assert.equal(gate.observe('ROOM:a','1:8'),true);
  assert.equal(gate.observe('ROOM:a','1:8'),false);
  assert.equal(gate.observe('OTHER:a','2:1'),false);
  assert.equal(gate.observe('OTHER:b','2:1'),false);
  assert.equal(gate.observe('OTHER:b','2:2'),true);
});

test('首次进入等待室后，本人的第一个回合可播放；音频路径沿用既有文件',()=>{
  const gate=new OutcomeCueGate();assert.equal(gate.observe('ROOM:a'),false);
  assert.equal(gate.observe('ROOM:a','1:1'),true);
  assert.equal(voiceFile('R07'),'/audio/results/R07.wav');assert.equal(voiceFile('R09'),'/audio/results/R09.wav');
  assert.equal(voiceFile('R01'),'/audio/results/R01.mp3');
});
