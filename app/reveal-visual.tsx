import type { ActionId, PublicGame, RevealedAction, RoundReveal } from '@/lib/game';
import {memo,useState,type ComponentType} from 'react';
import { AccumulateGesture } from './accumulate-gesture';
import { RenderedAccumulateGesture } from './accumulate-rendered-gesture';
import { FiveSixGesture } from './five-six-gesture';
import { FiveSevenGesture } from './five-seven-gesture';
import { FiveEightGesture, FiveNineGesture, FiveTenGesture } from './five-eight-nine-gesture';
import { PushGesture, PullGesture } from './push-pull-gesture';
import { TargetedGunEffect } from './combat-effects';
import { DocumentEffect } from './document-effects';
import { ResourcePresence } from './resource-presence';
import type { ResourceEvent } from '@/lib/round-feedback';
import {presentationOffset} from '@/lib/presentation-timing';
import {revealEffect,revealedActionCount,revealedEntries,type BasicGestureId} from '@/lib/reveal-effects';
import './reveal-effects.css';

export {revealedEntries};

type GestureKind = 'accumulate'|'clap'|'palm'|'point'|'fist'|'blade'|'shield'|'wing'|'flame'|'bolt'|'cotton'|'spark'|'rest'|'heal';

const gestureKinds:Partial<Record<ActionId,GestureKind>>={
  accumulate:'accumulate',five6:'clap',five7:'clap',five8:'clap',five9:'clap',five10:'clap',
  push:'palm',pull:'palm',mass:'palm',gun:'point',punch:'fist',execute:'point',super:'spark',
  plastic:'blade',iron:'blade',snap:'spark',knife1:'blade',knife2:'blade',knife3:'blade',
  guard:'shield',fly:'wing',friction:'palm',heat:'flame',ice:'shield',
  raiseFist:'fist',smallShield:'shield',doubleShield:'shield',bigShield:'shield',holyWater:'spark',holyBlock:'shield',
  fistThunder:'bolt',shieldThunder:'bolt',pointThunder:'bolt',thunder:'bolt',
  convert:'clap',cotton:'cotton',cottonShovel:'blade',popShield:'blade',popWater:'blade',skip:'rest',
  smallHeal:'heal',bigHeal:'heal',
};

export function gestureKind(id?:ActionId):GestureKind{return id?gestureKinds[id]??'rest':'rest'}

export function GestureMark({id,className=''}:{id?:ActionId;className?:string}){
  if(id==='accumulate')return <AccumulateGesture decorative className={`gesture-mark ${className}`}/>;
  const kind=gestureKind(id);
  return <svg className={`gesture-mark gesture-${kind} ${className}`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==='clap'&&<><path d="M43 71 29 80 13 57c-3-5 3-9 7-5l-9-19c-3-6 4-9 7-3l11 20-8-25c-2-6 5-8 8-2l10 25-4-23c-1-6 6-7 8-1l5 25"/><path d="m57 71 14 9 16-23c3-5-3-9-7-5l9-19c3-6-4-9-7-3L71 50l8-25c2-6-5-8-8-2L61 48l4-23c1-6-6-7-8-1l-5 25"/><path d="M50 15v-8M37 18l-5-8M63 18l5-8M47 82l3 8 3-8"/></>}
    {kind==='palm'&&<><path d="M31 78c-7-9-12-23-15-35-2-8 6-10 9-3l7 15V22c0-7 9-7 9 0v25-29c0-7 9-7 9 0v27-23c0-7 9-7 9 0v25-17c0-7 9-7 9 0v25l6-10c4-6 12-2 8 5L70 78c-10 10-29 11-39 0Z"/><path d="M18 84h64M7 34l7-6M82 28l8 6"/></>}
    {kind==='point'&&<><path d="M20 65c-5-1-8-6-6-11 2-4 8-5 12-2l8 6V43c0-5 7-6 8-1v8l34-3c10-1 12 10 2 12l-28 5 6 8c3 5-2 11-7 8l-13-8-16-7Z"/><path d="M34 43V30c0-7 8-9 11-3l6 13M72 47l8-9"/></>}
    {kind==='fist'&&<><path d="M28 47V30c0-7 10-7 10 0v12-16c0-7 10-7 10 0v16-15c0-7 10-7 10 0v16-10c0-7 10-7 10 0v27c0 14-8 22-22 22H32c-10 0-18-8-18-18V51c0-8 10-10 14-4Z"/><path d="M28 47h40M31 61h34M35 82v8"/></>}
    {kind==='blade'&&<><path d="m18 17 49 49M27 13l-14 14M72 72l15 15M82 17 33 66M73 13l14 14M28 72 13 87"/><path d="M39 67h22M50 56v22"/></>}
    {kind==='shield'&&<><path d="M50 8 80 20v27c0 21-13 35-30 44-17-9-30-23-30-44V20L50 8Z"/><path d="M50 22v51M30 45h40"/></>}
    {kind==='wing'&&<><path d="M49 75C31 73 15 63 8 45c12 4 18 2 26-9-3 15 4 21 15 22V75ZM51 75c18-2 34-12 41-30-12 4-18 2-26-9 3 15-4 21-15 22V75Z" fill="currentColor" fillOpacity=".18"/><path d="M49 70C28 68 16 57 8 45M51 70c21-2 33-13 41-25M50 25v53M44 31l6-9 6 9"/></>}
    {kind==='flame'&&<><path d="M51 9c5 19-9 25-4 38 7-3 11-11 12-18 20 15 23 38 9 52-11 11-27 12-39 3C12 70 19 49 34 38c-2 10 1 18 8 20-3-17 9-29 9-49Z"/><path d="M49 56c9 10 9 22 1 29-10-6-11-17-1-29Z"/></>}
    {kind==='bolt'&&<><path d="m55 7-31 44h24L39 93l38-51H53L55 7Z" fill="currentColor" fillOpacity=".22"/><path d="M15 24 8 19M83 78l9 5M85 17l8-8"/></>}
    {kind==='cotton'&&<><path d="M25 68c-10 0-16-7-16-16 0-10 8-17 18-16 3-15 19-23 32-15 6-7 19-5 22 4 10 2 16 9 16 18 0 11-8 18-19 18-10 11-34 15-53 7Z"/><path d="M28 81h47M39 88h26"/></>}
    {kind==='spark'&&<><circle cx="50" cy="50" r="15"/><path d="M50 6v22M50 72v22M6 50h22M72 50h22M19 19l16 16M65 65l16 16M81 19 65 35M35 65 19 81"/></>}
    {kind==='rest'&&<><path d="M23 60h54M32 72h36"/><circle cx="50" cy="40" r="14"/></>}
    {kind==='heal'&&<><circle cx="50" cy="50" r="35"/><path d="M50 29v42M29 50h42" strokeWidth="12"/></>}
  </svg>
}

export function WingAura({bullets}:{bullets:boolean}){
  return <div className={`wing-aura ${bullets?'wing-aura-bullets':''}`} aria-hidden="true">
    <svg viewBox="0 0 240 140" fill="none"><path d="M118 107C75 100 29 80 8 27c26 16 44 14 57 1-1 21 15 34 53 48M122 107c43-7 89-27 110-80-26 16-44 14-57 1 1 21-15 34-53 48" fill="#ffd873" fillOpacity=".2" stroke="#ffd873" strokeWidth="3"/><path d="M103 96C69 81 44 63 33 42m104 54c34-15 59-33 70-54" stroke="#fff1b7" strokeWidth="2"/><circle cx="120" cy="83" r="24" fill="#ffd873" fillOpacity=".12" stroke="#ffe8a3" strokeWidth="2"/></svg>
    {bullets&&<i/>}
  </div>
}

export function ActionCaption({entry}:{entry:RevealedAction}){
  return <figcaption className="reveal-action-caption">
    {entry.stage==='delayed'&&<small className="reveal-stage-tag">延判</small>}
    <b>{entry.label}</b>
    {entry.burstPoints>0&&<span className="reveal-burst">爆点 {entry.burstPoints}</span>}
    {entry.status==='failed'&&<small className="reveal-failed">资源不足 · 跳过</small>}
    {entry.status==='skipped'&&entry.id!=='skip'&&<small className="reveal-failed">未执行</small>}
  </figcaption>;
}

const gestureVisuals:Record<BasicGestureId,ComponentType<{animated?:boolean;elapsedMs?:number;paused?:boolean}>>={
  accumulate:RenderedAccumulateGesture,five6:FiveSixGesture,five7:FiveSevenGesture,five8:FiveEightGesture,
  five9:FiveNineGesture,five10:FiveTenGesture,push:PushGesture,pull:PullGesture,
};

// Primitive props and a stable timeline keep the table's 10Hz clock from
// rerendering each effect or creating additional mobile canvases.
const RevealedGesture=memo(function RevealedGesture({id,status,targetId,count,elapsedMs,finished,paused}:{
  id:ActionId;status:RevealedAction['status'];targetId?:string;count:number;elapsedMs:number;finished:boolean;paused:boolean;
}){
  const effect=revealEffect({id,status,label:'',count});
  if(effect.kind==='mark')return <GestureMark id={id}/>;
  const timing={animated:!finished,elapsedMs,paused};
  if(effect.kind==='gun')return <TargetedGunEffect targetId={targetId} {...timing}/>;
  if(effect.kind==='document')return <DocumentEffect id={effect.id} count={effect.count} scenario={effect.scenario} presentation="game" {...timing}/>;
  const Visual=gestureVisuals[effect.id];
  return <Visual {...timing}/>;
});

export function RevealStage({reveal,players,elapsedMs,finished,meId,paused=false,resourceBursts=[]}:{reveal:RoundReveal;players:PublicGame['players'];elapsedMs:number;finished:boolean;meId?:string;paused?:boolean;previewCombatEffects?:boolean;resourceBursts?:ResourceEvent[]}){
  const [startOffset]=useState(elapsedMs);
  // The clock may render at 10Hz; mounted effects run on their own timeline.
  // A new match/round remounts this stage. Paused previews still support seeking.
  const effectElapsed=presentationOffset(startOffset,elapsedMs,finished,paused);
  const result=finished||elapsedMs>=2700;
  return <div className={`reveal-stage ${result?'reveal-stage-result':'reveal-stage-actions'}`}>
    <span className="table-kicker">第 {reveal.round} 回合 · {result?'结算结果':'手势揭晓'}</span>
    <div className="reveal-lineup" data-count={reveal.actions.length} aria-label="所有玩家的回合动作">{reveal.actions.map(a=>{
      const p=players.find(p=>p.id===a.playerId),entries=revealedEntries(a);
      return <article data-player-id={a.playerId} className={`reveal-player ${a.playerId===meId?'reveal-player-self':''}`} key={`${reveal.round}:${a.playerId}`} aria-label={`${a.name} 的回合动作`}>
        <header><strong>{a.name}</strong>{a.playerId===meId&&<i>你</i>}{p&&<span>♥ {p.hp}</span>}</header>
        {p&&<p className="reveal-player-resources">拳 {p.fists} · 盾 {p.shields} · 水 {p.waters} · 棉 {p.cotton}</p>}
        {p&&<ResourcePresence playerId={p.id} shields={p.shields} waters={p.waters} bursts={resourceBursts}/>}
        <div className="reveal-player-actions" data-multiple={entries.length>1}>{entries.map((entry,index)=><figure key={index} className={`reveal-action-figure ${entry.status!=='played'?'reveal-action-muted':''}`}>
          <div className="reveal-action-visual"><RevealedGesture id={entry.id} status={entry.status} targetId={entry.targetId} count={revealedActionCount(entry)} elapsedMs={effectElapsed} finished={finished} paused={paused}/></div>
          <ActionCaption entry={entry}/>
        </figure>)}</div>
      </article>;
    })}</div>
    {result&&<div className="reveal-result" aria-live="polite"><strong>{reveal.hpChanges.length?reveal.hpChanges.map(c=>`${c.name} ${c.before}→${c.after}血`).join(' · '):'本回合无人扣血'}</strong><small>{reveal.highlights[0]?.replace(/^第\d+回合 · /,'')??'所有动作已结算'}</small>{reveal.finish&&<b>决胜回合</b>}</div>}
  </div>;
}
