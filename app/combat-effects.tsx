'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

type Props = { animated?: boolean; elapsedMs?: number; paused?: boolean };
function useTimeline(elapsedMs: number, paused: boolean): CSSProperties {
  const [offset] = useState(() => Math.max(0, elapsedMs));
  return { '--effect-offset': `${-offset}ms`, '--effect-play-state': paused ? 'paused' : 'running' } as CSSProperties;
}

const artFiles = { mass: '/gestures/mass-taichi-poses-v1.optimized.webp', gun: '/gestures/gun-ak47-v1.optimized.webp' };
const artCache = new Map<string, Promise<HTMLImageElement>>();
export function preloadCombatArt(kind: keyof typeof artFiles) {
  const file = artFiles[kind];
  if (!artCache.has(file)) artCache.set(file, (async () => { const image = new Image(); image.src = file; await image.decode(); return image; })().catch(error => { artCache.delete(file); throw error; }));
  return artCache.get(file)!;
}

/** Geometric yin-yang and eight distinct trigrams, behind the nine illustrated performers. */
function Bagua() {
  return <svg className="mass-bagua" viewBox="0 0 400 400" aria-hidden="true">
    <circle cx="200" cy="200" r="176" fill="none" stroke="currentColor" strokeWidth="1"/>
    <circle cx="200" cy="200" r="130" fill="none" stroke="currentColor" strokeWidth="2"/>
    <g className="mass-yinyang"><circle cx="200" cy="200" r="104" fill="#c0d6bf"/>
      <path d="M200 96a104 104 0 0 1 0 208a52 52 0 0 1 0-104a52 52 0 0 0 0-104" fill="#142f39"/>
      <circle cx="200" cy="148" r="13" fill="#142f39"/><circle cx="200" cy="252" r="13" fill="#c0d6bf"/>
    </g>
    {[7,3,5,1,6,2,4,0].map((bits,index)=><g key={bits} transform={`rotate(${index*45} 200 200)`}>{[0,1,2].map(row=>(bits&(1<<row))?<rect key={row} x="181" y={35+row*9} width="38" height="5" rx="1"/>:<g key={row}><rect x="181" y={35+row*9} width="15" height="5" rx="1"/><rect x="204" y={35+row*9} width="15" height="5" rx="1"/></g>)}</g>)}
  </svg>;
}

export function MassTaichiEffect({ animated = false, elapsedMs = 0, paused = false }: Props) {
  const style = useTimeline(elapsedMs, paused);
  return <div className={`combat-effect mass-effect ${animated?'is-animated':''}`} style={style} role="img" aria-label="密集气功：九人排成三行三列，打太极，身后是阴阳八卦">
    <Bagua/><i className="mass-energy-ring" aria-hidden="true"/>
    <div className="mass-formation" aria-hidden="true">{Array.from({length:9},(_,index)=><span className="mass-person" key={index}>
      {[0,1,2,3].map(frame=><i className={`mass-pose mass-pose-${frame}`} key={frame}/>)}
    </span>)}</div>
    <span className="effect-caption">九人太极 · 群体作用</span>
  </div>;
}

export function GunEffect({ animated = false, elapsedMs = 0, paused = false, aimAngle = -15, targetName = '目标玩家' }: Props & { aimAngle?: number; targetName?: string }) {
  const timeline = useTimeline(elapsedMs, paused);
  const style = { ...timeline, '--gun-angle': `${aimAngle}deg`, '--gun-flip': Math.abs(aimAngle)>90?-1:1 } as CSSProperties;
  return <div className={`combat-effect gun-effect ${animated?'is-animated':''}`} style={style} role="img" aria-label={`枪：AK-47从右上斜持姿态抬起，转向${targetName}，枪口火焰约0.3秒`}>
    <i className="gun-ambient" aria-hidden="true"/>
    <div className="gun-lift" aria-hidden="true"><div className="gun-turn"><div className="gun-facing"><div className="gun-kick">
      <i className="gun-sprite"/><i className="gun-bolt"/><i className="gun-muzzle-glow"/><i className="gun-muzzle-flame"/>
    </div></div></div></div>
    <span className="effect-caption">瞄准 → {targetName}</span>
  </div>;
}

/** Aim from the actual source card toward its selected target, including responsive layouts. */
export function TargetedGunEffect({targetId, ...props}:Props & {targetId?:string}) {
  const root = useRef<HTMLDivElement>(null);
  const [aim,setAim] = useState({angle:-15,name:'目标玩家'});
  useLayoutEffect(()=>{
    const card=root.current?.closest<HTMLElement>('[data-player-id]');
    const lineup=card?.closest('.reveal-lineup');
    const target=Array.from(lineup?.querySelectorAll<HTMLElement>('[data-player-id]')??[]).find(item=>item.dataset.playerId===targetId);
    if(!card||!lineup||!target)return;
    const update=()=>{const a=card.getBoundingClientRect(),b=target.getBoundingClientRect();setAim({angle:Math.atan2(b.top+b.height/2-a.top-a.height/2,b.left+b.width/2-a.left-a.width/2)*180/Math.PI,name:target.querySelector('header strong')?.textContent??'目标玩家'});};
    update();const observer=new ResizeObserver(update);observer.observe(lineup);return()=>observer.disconnect();
  },[targetId]);
  return <div ref={root} className="targeted-gun"><GunEffect {...props} aimAngle={aim.angle} targetName={aim.name}/></div>;
}
