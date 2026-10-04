'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {VoiceCue} from '@/lib/round-feedback';
import {OutcomeCueGate,OutcomePlayer} from '@/lib/outcome-audio';
export {OutcomePlayer,voiceFile} from '@/lib/outcome-audio';

export function useOutcomeAudio({roomCode,memberId,cue,active,remainingMs}:{roomCode:string;memberId?:string;cue?:VoiceCue;active:boolean;remainingMs:number}){
  const player=useRef<OutcomePlayer|null>(null),gate=useRef(new OutcomeCueGate()),remaining=useRef(remainingMs);
  const enabledRef=useRef(true),mounted=useRef(false);
  remaining.current=remainingMs;
  const [enabled,setEnabled]=useState(true),[status,setStatus]=useState('声音默认开启 · 点击页面后，结算时播放你的结果');
  const unlock=useCallback(async()=>{
    if(!enabledRef.current||document.hidden)return;
    const sound=player.current??=new OutcomePlayer();
    try{
      await sound.unlock();
      if(mounted.current&&enabledRef.current&&player.current===sound)setStatus('低音量 · 结算时仅播放你的结果');
    }catch(error){if(mounted.current&&enabledRef.current&&player.current===sound)setStatus(error instanceof Error?error.message:'请点击页面开启声音');}
  },[]);
  const toggle=useCallback(async()=>{
    const next=!enabledRef.current;enabledRef.current=next;setEnabled(next);
    if(!next){player.current?.stop();setStatus('本次已静音 · 再次点击语音按钮可开启');return;}
    await unlock();
  },[unlock]);
  useEffect(()=>{
    mounted.current=true;
    const interaction=(event:Event)=>{
      if(event instanceof KeyboardEvent&&(event.ctrlKey||event.metaKey||event.altKey||['Shift','Control','Alt','Meta','Escape'].includes(event.key)))return;
      void unlock();
    };
    const hide=()=>{if(document.hidden)player.current?.stop();};
    const leave=()=>player.current?.stop();
    document.addEventListener('click',interaction);document.addEventListener('keydown',interaction);
    document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',leave);
    return()=>{
      mounted.current=false;
      document.removeEventListener('click',interaction);document.removeEventListener('keydown',interaction);
      document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',leave);
      player.current?.dispose();player.current=null;
    };
  },[unlock]);
  useEffect(()=>{
    if(!active)player.current?.stop();
    if(!memberId)return;
    const fresh=gate.current.observe(`${roomCode}:${memberId}`,cue?.key);
    if(!cue)return;
    const key=`dadian:voice:${roomCode}:${memberId}:${cue.key}`;
    let already=false;
    try{already=sessionStorage.getItem(key)==='1';sessionStorage.setItem(key,'1');}catch{/* In-memory dedup still applies. */}
    // Also consume history, muted/hidden cues: enabling never queues old reactions.
    if(!fresh||already||!active||!enabledRef.current||document.hidden)return;
    void player.current?.play(cue.id,remaining.current).catch(()=>{if(mounted.current)setStatus('本条语音未能播放，下回合继续尝试');});
    return()=>player.current?.stop();
  },[cue?.key,cue?.id,active,enabled,roomCode,memberId]);
  return{enabled,status,toggle};
}
