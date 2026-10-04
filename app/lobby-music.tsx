'use client';
import {useEffect,useRef,useState} from 'react';
import {LOBBY_MUSIC_FILE,LobbyMusicPlayer,type MusicStatus} from '@/lib/lobby-music';

export function LobbyMusic(){
  const player=useRef<LobbyMusicPlayer|null>(null),enabledRef=useRef(true);
  const [enabled,setEnabled]=useState(true),[status,setStatus]=useState<MusicStatus>('ready');
  useEffect(()=>{
    // Default on on every visit; the old persisted off switch must not mute a new visit.
    const music=new LobbyMusicPlayer({
      context:()=>{
        const Ctor=window.AudioContext??(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(!Ctor)throw new Error('当前浏览器不支持音乐播放');
        return new Ctor();
      },
      load:async(context,signal)=>{
        const response=await fetch(LOBBY_MUSIC_FILE,{signal});
        if(!response.ok)throw new Error('音乐加载失败');
        return context.decodeAudioData(await response.arrayBuffer());
      },
      status:setStatus,
    });
    player.current=music;
    music.setEnabled(enabledRef.current);
    music.setVisible(!document.hidden);
    const unlock=(event:Event)=>{
      if(event.target instanceof Element&&event.target.closest('[data-lobby-music-control]'))return;
      if(event instanceof KeyboardEvent&&(event.ctrlKey||event.metaKey||event.altKey||['Shift','Control','Alt','Meta','Escape'].includes(event.key)))return;
      if(enabledRef.current)void music.play();
    };
    const visibility=()=>music.setVisible(!document.hidden);
    const leave=()=>music.setVisible(false),back=()=>music.setVisible(!document.hidden);
    document.addEventListener('click',unlock);
    document.addEventListener('keydown',unlock);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',leave);
    window.addEventListener('pageshow',back);
    return()=>{
      document.removeEventListener('click',unlock);
      document.removeEventListener('keydown',unlock);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('pagehide',leave);
      window.removeEventListener('pageshow',back);
      music.dispose();
      player.current=null;
    };
  },[]);
  function toggle(){
    const next=!(enabledRef.current&&(status==='playing'||status==='loading'));
    enabledRef.current=next;setEnabled(next);
    player.current?.setEnabled(next);
    if(next)void player.current?.play();
  }
  const message=!enabled?'本次已静音':status==='playing'?'低音量循环 · 入局停止':status==='loading'?'正在准备音乐…':status==='error'?'加载失败，点击重试':status==='paused'?'切回大厅继续播放':'默认开启 · 点一下页面自动播放';
  const label=!enabled?'音乐：关':status==='playing'?'音乐：开':status==='loading'?'音乐：加载中':status==='error'?'重试音乐':'播放音乐';
  return <section className="lobby-music" aria-label="大厅背景音乐" data-music-status={status}>
    <div><span aria-hidden="true">♫</span><span>老牧师的小曲<small>{message}</small></span></div>
    <button type="button" className="ghost" data-lobby-music-control aria-label={enabled&&(status==='playing'||status==='loading')?'关闭大厅音乐':'播放大厅音乐'} aria-pressed={status==='playing'} onClick={toggle}>{label}</button>
  </section>;
}
