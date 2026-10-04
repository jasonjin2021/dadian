import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {LobbyMusicPlayer,LOBBY_MUSIC_FILE,LOBBY_MUSIC_VOLUME,type MusicStatus} from './lobby-music.ts';

function setup(load?:()=>Promise<AudioBuffer>){
  const statuses:MusicStatus[]=[],sources:{loop:boolean;stopped:boolean;disconnected:boolean;offset:number;buffer:AudioBuffer|null}[]=[],ramps:number[]=[];
  let created=0,loads=0;
  const buffer={duration:20} as AudioBuffer;
  const context={
    currentTime:0,state:'suspended',destination:{},
    async resume(){this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';},
    createBufferSource(){const source={loop:false,stopped:false,disconnected:false,offset:0,buffer:null as AudioBuffer|null,connect(){},disconnect(){this.disconnected=true;},stop(){this.stopped=true;},start(_at:number,offset:number){this.offset=offset;}};sources.push(source);return source;},
    createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(value:number){ramps.push(value);}},connect(){},disconnect(){}};},
  };
  const player=new LobbyMusicPlayer({context:()=>{created++;return context as unknown as AudioContext;},load:async()=>{loads++;return load?load():buffer;},status:s=>statuses.push(s)});
  return{player,context,sources,statuses,ramps,buffer,created:()=>created,loads:()=>loads};
}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('大厅音乐在首次交互前不创建音频；单源低增益循环且不重复加载',async()=>{
  const t=setup();assert.equal(t.created(),0);
  await Promise.all([t.player.play(),t.player.play()]);
  assert.equal(t.sources.length,1);assert.equal(t.sources[0].loop,true);assert.deepEqual(t.ramps,[LOBBY_MUSIC_VOLUME]);assert.equal(t.statuses.at(-1),'playing');
  await t.player.play();assert.equal(t.sources.length,1);assert.equal(t.loads(),1);t.player.dispose();
});
test('关闭时尚未完成的解码不能补播；重新开启仅播放一次',async()=>{
  let resolve!:(buffer:AudioBuffer)=>void;const ready=new Promise<AudioBuffer>(r=>{resolve=r;});const t=setup(()=>ready);
  const pending=t.player.play();t.player.setEnabled(false);resolve(t.buffer);await pending;
  assert.equal(t.sources.length,0);assert.equal(t.statuses.at(-1),'paused');
  t.player.setEnabled(true);await t.player.play();assert.equal(t.sources.length,1);assert.equal(t.loads(),1);t.player.dispose();
});
test('切后台停止并从原进度恢复；关闭设置不会被切回页面覆盖',async()=>{
  const t=setup();await t.player.play();t.context.currentTime=6;t.player.setVisible(false);
  assert.equal(t.sources[0].stopped,true);assert.equal(t.context.state,'suspended');
  t.player.setVisible(true);await tick();assert.equal(t.sources.length,2);assert.equal(t.sources[1].offset,6);
  t.player.setEnabled(false);t.player.setVisible(false);t.player.setVisible(true);await tick();assert.equal(t.sources.length,2);t.player.dispose();
});
test('离开大厅销毁播放器，异步返回不再创建声音或更新界面',async()=>{
  let resolve!:(buffer:AudioBuffer)=>void;const t=setup(()=>new Promise<AudioBuffer>(r=>{resolve=r;}));
  const pending=t.player.play();t.player.dispose();const count=t.statuses.length;resolve(t.buffer);await pending;
  assert.equal(t.sources.length,0);assert.equal(t.context.state,'closed');assert.equal(t.statuses.length,count);
  await t.player.play();assert.equal(t.sources.length,0);
});
test('加载失败可以重试，浏览器拒绝播放时显示待点击状态',async()=>{
  let fail=true;const t=setup(async()=>{if(fail)throw new Error('network');return {duration:20} as AudioBuffer;});
  await t.player.play();assert.equal(t.statuses.at(-1),'error');fail=false;await t.player.play();assert.equal(t.statuses.at(-1),'playing');t.player.dispose();
  const blocked=setup();blocked.context.resume=async()=>{throw Object.assign(new Error('blocked'),{name:'NotAllowedError'});};await blocked.player.play();assert.equal(blocked.statuses.at(-1),'ready');assert.equal(blocked.sources.length,0);blocked.player.dispose();
});
test('大厅配乐路径固定，公开音频与已核验原件的SHA-256一致',()=>{
  assert.equal(LOBBY_MUSIC_FILE,'/audio/lobby/laomushi-gondboy.mp3');
  const audio=readFileSync(new URL(`../public${LOBBY_MUSIC_FILE}`,import.meta.url));
  // Fixed after byte-for-byte verification against the selected original.
  assert.equal(createHash('sha256').update(audio).digest('hex'),'1f2568c8e1566c8ccf0ed961e7f703b5dca6f2ffe751c4f59ecaa9eb29e17095');
});

test('首次解码过程中隐藏，返回大厅仍能自动继续已解锁的播放',async()=>{
  let resolve!:(buffer:AudioBuffer)=>void;const t=setup(()=>new Promise<AudioBuffer>(r=>{resolve=r;}));
  const pending=t.player.play();await tick();t.player.setVisible(false);resolve(t.buffer);await pending;
  assert.equal(t.sources.length,0);t.player.setVisible(true);await tick();assert.equal(t.sources.length,1);t.player.dispose();
});
test('隐藏时加载失败不会缓存失败Promise，返回后一次重试即可播放',async()=>{
  let reject!:(reason:Error)=>void,first=true;
  const t=setup(()=>{if(first){first=false;return new Promise<AudioBuffer>((_resolve,r)=>{reject=r;});}return Promise.resolve({duration:20} as AudioBuffer);});
  const pending=t.player.play();await tick();t.player.setVisible(false);reject(new Error('network'));await pending;
  t.player.setVisible(true);await tick();assert.equal(t.sources.length,1);assert.equal(t.loads(),2);t.player.dispose();
});
