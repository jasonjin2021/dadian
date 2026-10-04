'use client';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import type {ResourceEvent} from '@/lib/round-feedback';

export function useResourceBursts(events:ResourceEvent[]=[]){
  const seen=useRef<Set<string>|null>(null),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  const [bursts,setBursts]=useState<ResourceEvent[]>([]);
  const signature=events.map(e=>e.id).join('|');
  useEffect(()=>{
    // A reconnect displays current inventory, never replays historical breakage.
    if(!seen.current){seen.current=new Set(events.map(e=>e.id));return;}
    const fresh=events.filter(e=>!seen.current!.has(e.id));
    for(const event of fresh)seen.current.add(event.id);
    if(!fresh.length)return;
    setBursts(old=>[...old,...fresh]);
    const keys=new Set(fresh.map(e=>e.id));
    const timer=setTimeout(()=>{setBursts(old=>old.filter(e=>!keys.has(e.id)));timers.current=timers.current.filter(item=>item!==timer);},1800);
    timers.current.push(timer);
    if(seen.current.size>240)seen.current=new Set(events.map(e=>e.id));
  // Event ids are immutable within a match/round; polling must not restart animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  return bursts;
}

function ResourceGlyph({kind}:{kind:ResourceEvent['resource']}){
  const id=useId().replace(/:/g,'');
  return <svg viewBox="0 0 80 96" className="resource-glyph" aria-hidden="true">
    <defs><linearGradient id={`${id}metal`} x2=".8" y2="1"><stop stopColor="#729cab"/><stop offset=".3" stopColor="#152d3a"/><stop offset=".65" stopColor="#3e6471"/><stop offset="1" stopColor="#0e202d"/></linearGradient><linearGradient id={`${id}glass`} x2=".85" y2="1"><stop stopColor={kind==='shield'?'#b3fbff':'#f6b4ff'} stopOpacity=".75"/><stop offset=".4" stopColor={kind==='shield'?'#36c3dd':'#a55bed'} stopOpacity=".34"/><stop offset="1" stopColor={kind==='shield'?'#186878':'#6533a0'} stopOpacity=".7"/></linearGradient></defs>
    <ellipse cx="40" cy="87" rx="27" ry="5" fill="#000" opacity=".26"/>
    {kind==='shield'?<g className="resource-idle-shield">
      <path d="m15 7 50 0 8 9v48L59 82H21L7 64V16Z" fill={`url(#${id}metal)`} stroke="#426675" strokeWidth="2"/>
      <path d="m19 13 42 0 6 7v41L55 76H25L13 61V20Z" fill={`url(#${id}glass)`} stroke="#9aecf0" strokeOpacity=".65"/>
      <path d="M22 24h36M22 60h36M40 20v48" stroke="#85f4ef" opacity=".22"/>
      <path className="resource-glint" d="m20 19 31 0-30 45Z" fill="#d2fffb" opacity=".17"/>
      <path d="M8 35h7v20H8M65 35h7v20h-7" fill="#102533" stroke="#557f87"/>
      <path d="M26 79h28" stroke="#7be8ee" strokeWidth="2"/>
    </g>:<g className="resource-idle-water">
      <path d="M14 26h9v49h34V26h9v54H14Z" fill={`url(#${id}metal)`} stroke="#68738c"/>
      <rect x="24" y="17" width="32" height="59" rx="13" fill="#211938" stroke="#bf97ec"/>
      <path d="M27 44Q40 39 53 44v18q0 12-13 12T27 62Z" fill={`url(#${id}glass)`}/>
      <ellipse className="resource-liquid" cx="40" cy="44" rx="13" ry="3.2" fill="#d99aff"/>
      <path d="M29 28v30" stroke="#ffe2ff" opacity=".48" strokeWidth="3" strokeLinecap="round"/>
      <g className="resource-bubbles" fill="#f4d7ff"><circle cx="43" cy="61" r="2"/><circle cx="35" cy="55" r="1.5"/><circle cx="46" cy="69" r="1"/></g>
      <path d="M24 17h32v7H24M21 72h38v7H21M32 10h16v8H32" fill={`url(#${id}metal)`} stroke="#8790a1"/>
      <path d="M57 38h10v22h-7" fill="none" stroke="#976ab2" strokeWidth="4"/>
      <path d="M10 80h60v5H10" fill="#263345" stroke="#596679"/>
    </g>}
  </svg>;
}
const eventLabel=(e:ResourceEvent)=>`${e.resource==='shield'?'盾':'圣水'}${e.cause==='gain'?'获得':e.cause==='blocked'?'挡伤破裂':e.cause==='destroyed'?'被摧毁':'主动消耗'}${Math.abs(e.delta)>1?` ×${Math.abs(e.delta)}`:''}`;
export function ResourcePresence({playerId,shields,waters,bursts=[]}:{playerId:string;shields:number;waters:number;bursts?:ResourceEvent[]}){
  const own=bursts.filter(e=>e.playerId===playerId);
  return <div className="resource-presence" aria-label={`场内资源：盾 ${shields}，圣水 ${waters}`}>
    {(['shield','water'] as const).map(kind=>{
      const count=kind==='shield'?shields:waters,changes=own.filter(e=>e.resource===kind);
      if(!count&&!changes.length)return null;
      return <div key={kind} className={`resource-slot resource-${kind}`}>
        {count>0&&<div className="resource-standing"><ResourceGlyph kind={kind}/><span>{kind==='shield'?'盾':'水'} <b>×{count}</b></span></div>}
        {changes.map((e,index)=><div key={e.id} className={`resource-event resource-event-${e.cause}`} title={eventLabel(e)}>
          <div className="resource-ghost"><ResourceGlyph kind={kind}/></div>
          {(e.cause==='blocked'||e.cause==='destroyed')&&<><i className="resource-crack"/>{Array.from({length:8},(_,i)=><i key={i} className="resource-shard" style={{'--sx':`${Math.cos(i*Math.PI/4)*(25+i*2)}px`,'--sy':`${Math.sin(i*Math.PI/4)*28+15}px`,'--sr':`${i*61-130}deg`,'--sd':`${i%3*35}ms`} as CSSProperties}/>)}</>}
          {index===changes.length-1&&<small>{eventLabel(e)}</small>}
        </div>)}
      </div>;
    })}
    {!shields&&!waters&&!own.length&&<span className="resource-empty">无盾水</span>}
  </div>;
}

export function ResourcePresenceReview(){
  const [inventory,setInventory]=useState([{id:'me',shields:2,waters:1},{id:'other',shields:1,waters:2}]);
  const [events,setEvents]=useState<ResourceEvent[]>([]),[who,setWho]=useState('me');const seq=useRef(0);
  const bursts=useResourceBursts(events);
  function change(resource:ResourceEvent['resource'],cause:ResourceEvent['cause']){
    const p=inventory.find(p=>p.id===who)!,key=resource==='shield'?'shields':'waters';
    const delta=cause==='gain'?1:cause==='destroyed'?-p[key]:-Math.min(p[key],1);if(!delta)return;
    setInventory(old=>old.map(p=>p.id===who?{...p,[key]:p[key]+delta}:p));
    setEvents(old=>[...old,{id:`demo:${seq.current++}`,playerId:who,resource,delta,remaining:p[key]+delta,cause}]);
  }
  return <section className="resource-review"><h2>场内盾与圣水 · 持续存在</h2><p>自己和对手都能看到。下方仅为效果演示；正式对局按服务器的真实消耗触发，不会每次刷新重复碎裂。</p>
    <div className="resource-demo-players">{inventory.map(p=><article key={p.id}><strong>{p.id==='me'?'你（示例）':'对手（示例）'}</strong><ResourcePresence playerId={p.id} shields={p.shields} waters={p.waters} bursts={bursts}/></article>)}</div>
    <div className="resource-demo-controls"><label>演示对象 <select value={who} onChange={e=>setWho(e.target.value)}><option value="me">自己</option><option value="other">对手</option></select></label>{(['shield','water'] as const).map(kind=><div key={kind}><button onClick={()=>change(kind,'gain')}>增加{kind==='shield'?'盾':'圣水'}</button><button onClick={()=>change(kind,'blocked')}>打破{kind==='shield'?'盾':'圣水'}</button><button onClick={()=>change(kind,'destroyed')}>摧毁全部{kind==='shield'?'盾':'圣水'}</button><button onClick={()=>change(kind,'spent')}>主动消耗{kind==='shield'?'盾':'圣水'}</button></div>)}</div>
  </section>;
}
