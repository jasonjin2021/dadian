'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ACTIONS, ACTION_MAP, PHASE_SECONDS, phaseRemainingMs, type ActionId, type ActionInput, type Category, type PublicGame } from '@/lib/game';
import { Rules } from './lobby';
import { GestureMark, RevealStage, WingAura, gestureKind } from './reveal-visual';
import { ResourcePresence, useResourceBursts } from './resource-presence';
import { useOutcomeAudio } from './outcome-audio';
import type { VoiceCue } from '@/lib/round-feedback';
import {useIdleMotion} from './idle-table';
import {AccountPanel,useAccount} from './player-account';
import type {PublicAccount} from '@/lib/account-store';
import {phaseKey,submissionProgress,type SubmissionContext} from '@/lib/command-feedback';
import {actionCountLimit,availableTargets,parseActionCount,selectedTargetId} from '@/lib/action-input';
import {QuantityInput,TargetButtons} from './action-inputs';
import {clientPhaseClock} from '@/lib/client-phase-clock';
import {useGesturePreload} from './gesture-preload';
import {RoundActionHistory} from './round-action-history';
import {MyPoints} from './my-points';

interface Member{id:string;name:string;seat:number|null;role:'player'|'spectator'}
export interface View{code:string;version:number;serverNow:number;host:boolean;member:Member|null;game:PublicGame;selfPoints?:{playerId:string;points:number};selfVoice?:VoiceCue;canStart:boolean;canRematch:boolean;account?:PublicAccount|null;ranked?:boolean}
type Command=(c:string,e?:Record<string,unknown>)=>Promise<boolean>;
export interface ClockAnchor{serverNow:number;receivedAt:number;version:number}
const categories:ReadonlyArray<{id:Category;name:string}>=[
  {id:'A',name:'积点类'},
  {id:'B',name:'变点类'},
  {id:'C',name:'主动攻击'},
  {id:'D',name:'被动攻击'},
  {id:'E',name:'防御类'},
  {id:'F',name:'延判类'},
  {id:'G',name:'雷劈类'},
  {id:'H',name:'特殊类'},
  {id:'I',name:'治疗类'},
];
export default function RoomClient({code}:{code:string}){
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[networkError,setNetworkError]=useState(''),[busy,setBusy]=useState(false);
  const busyRef=useRef(false),pendingRequest=useRef<{signature:string;id:string}|null>(null);
  const latestViewRef=useRef<View|null>(null),commandErrorRef=useRef<SubmissionContext|null>(null);
  const clockAnchorRef=useRef<ClockAnchor|null>(null);
  const acceptView=useCallback((next:View)=>{
    const previous=clockAnchorRef.current;
    if(previous&&(next.version<previous.version||(next.version===previous.version&&next.serverNow<previous.serverNow)))return;
    clockAnchorRef.current={serverNow:next.serverNow,receivedAt:performance.now(),version:next.version};
    latestViewRef.current=next;
    if(commandErrorRef.current&&submissionProgress(commandErrorRef.current,next)!=='pending'){commandErrorRef.current=null;setError('');}
    setView(next);
  },[]);
  useEffect(()=>{
    clockAnchorRef.current=null;latestViewRef.current=null;commandErrorRef.current=null;setError('');setView(null);
    let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
    const load=async()=>{
      const requestAnchor=clockAnchorRef.current;
      controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),10000);
      try{const r=await fetch(`/api/rooms/${code}`,{cache:'no-store',signal:controller.signal}),d=await r.json() as View&{error?:string};if(!r.ok)throw new Error(d.error??'连接失败');if(!stopped){acceptView(d);setNetworkError('');}}
      catch(e){if(!stopped&&clockAnchorRef.current===requestAnchor)setNetworkError(e instanceof Error&&e.name!=='AbortError'?e.message:'连接较慢，正在重试…');}
      finally{clearTimeout(timeout);if(!stopped)timer=setTimeout(load,750);}
    };
    void load();return()=>{stopped=true;clearTimeout(timer);controller?.abort();};
  },[code,acceptView]);
  const anchor=clockAnchorRef.current;
  const phase=view?.game.phase;
  const phaseSeconds=phase?PHASE_SECONDS[phase]:0;
  const remainingMs=Math.min(phaseSeconds*1000,phaseRemainingMs(view?.game.deadline??null,anchor?.serverNow??0,anchor?performance.now()-anchor.receivedAt:0));
  const audio=useOutcomeAudio({roomCode:code,memberId:view?.member?.id,cue:view?.selfVoice,active:phase==='reveal'&&remainingMs>0,remainingMs});
  async function command(command:string,extra:Record<string,unknown>={}){
    if(busyRef.current)return false;busyRef.current=true;setBusy(true);commandErrorRef.current=null;setError('');
    const originalPhase=view?phaseKey(view.game):'',signature=JSON.stringify({code,command,extra,phase:originalPhase});
    const context:SubmissionContext={code,command,phase:originalPhase,playerId:view?.member?.id,duelId:typeof extra.duelId==='string'?extra.duelId:undefined};
    if(pendingRequest.current?.signature!==signature)pendingRequest.current={signature,id:crypto.randomUUID()};
    const requestId=pendingRequest.current.id;
    let version=view?.version;
    try{
      for(let attempt=0;attempt<3;attempt++){
        const r=await fetch(`/api/rooms/${code}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command,requestId,version,...extra}),signal:AbortSignal.timeout(3500)});
        const d=await r.json() as View&{error?:string};
        if(r.status===409){
          const freshResponse=await fetch(`/api/rooms/${code}`,{cache:'no-store',signal:AbortSignal.timeout(2500)});
          const fresh=await freshResponse.json() as View&{error?:string};
          if(!freshResponse.ok)throw new Error(fresh.error??'房间刷新失败');
          acceptView(fresh);
          if(attempt<2&&phaseKey(fresh.game)===originalPhase){version=fresh.version;continue}
          throw new Error(d.error??'本阶段已经结束');
        }
        if(!r.ok)throw new Error(d.error??'操作失败');
        pendingRequest.current=null;
        if(command==='leave'){window.location.assign('/');return true;}
        acceptView(d);setError('');return true;
      }
    }catch(e){
      const progress=submissionProgress(context,latestViewRef.current);
      if(progress!=='pending'){pendingRequest.current=null;commandErrorRef.current=null;setError('');return progress==='confirmed';}
      commandErrorRef.current=context;
      setError(e instanceof Error&&!['TimeoutError','AbortError'].includes(e.name)?e.message:'提交暂未确认，请查看是否已锁定；若尚未锁定，可再次点击重试。');return false;
    }
    finally{setBusy(false);busyRef.current=false;}
    return false;
  }
  if(!view)return <main className="loading-screen"><span className="brand-mark">打</span><p>{error||networkError||'正在连接房间…'}</p></main>;
  if(!view.member)return <JoinRoom code={code} busy={busy} command={command} error={error||networkError}/>;
  return <RoomScreen code={code} view={view} busy={busy} command={command} error={error||networkError} anchor={anchor!} audio={audio}/>;
}

function JoinRoom({code,busy,command,error}:{code:string;busy:boolean;command:Command;error:string}){const account=useAccount();return <main className="join-room"><a className="brand" href="/"><span className="brand-mark">打</span><span>返回大厅</span></a><section><p>房间号 {code}</p><h1>加入这场对局</h1><AccountPanel state={account}/>{account.account&&<button className="primary" disabled={busy} onClick={()=>void command('join')}>{busy?'正在进入…':'进入房间 →'}</button>}{error&&<p role="alert" className="form-error">{error}</p>}</section></main>}

export function RoomScreen({code,view,busy,command,error,anchor,audio,previewTools}:{code:string;view:View;busy:boolean;command:Command;error:string;anchor:ClockAnchor;audio:{enabled:boolean;status:string;toggle:()=>Promise<void>};previewTools?:ReactNode}){
  const [rules,setRules]=useState(false),[showLog,setShowLog]=useState(false),[copyStatus,setCopyStatus]=useState('');
  const motion=useIdleMotion(),phase=view.game.phase,me=view.game.players.find(p=>p.id===view.member?.id);
  const preparing=usePhasePreparing(view.game,anchor);
  useGesturePreload(phase==='lobby');
  async function copyInvite(){if(previewTools){setCopyStatus('这是界面演示；请返回大厅创建真实房间后邀请朋友。');return;}try{await navigator.clipboard.writeText(`${location.origin}/room/${code}`);setCopyStatus('邀请链接已复制');}catch{setCopyStatus(`复制未成功，请把房间号 ${code} 发给朋友`);}}
  return <main className="room-shell" data-idle={motion.running?'on':'off'}>
    <header className="room-top"><a className="brand" href="/"><span className="brand-mark">打</span><span>打点</span></a><div className="room-meta"><span className="room-id">房间号 <b>{code}</b></span><button onClick={copyInvite}>邀请朋友</button><button onClick={()=>void audio.toggle()} aria-pressed={audio.enabled}>语音：{audio.enabled?'开':'关'}</button><button className="motion-switch" onClick={motion.toggle} aria-pressed={motion.enabled}>待机：{motion.enabled?'开':'关'}</button><button onClick={()=>setRules(true)}>规则</button><button onClick={()=>setShowLog(v=>!v)} aria-expanded={showLog} aria-controls="round-records">{showLog?'收起记录':'回合记录'}</button></div></header>
    {previewTools}
    {copyStatus&&<p className="copy-status" role="status">{copyStatus}</p>}
    {audio.status&&<p className="voice-status" role="status">{audio.status}</p>}
    <div className="room-layout" data-log={showLog}><section className="battlefield"><div className="round-line"><div>第 {view.game.match} 局 <span>/</span> {view.game.round?`第 ${view.game.round} 回合`:'等待入座'}</div><p>{phase==='main'||phase==='delayed'?`${view.game.confirmed} / ${view.game.required} 已确认`:phase==='priorityRps'?`${view.game.priority?.submittedIds.length??0} / ${view.game.priority?.playerIds.length??0} 已猜拳`:phase==='rps'?'等待相关玩家猜拳':phase==='reveal'?'回合揭晓 · 不占下回合时间':phase==='lobby'?`${view.game.players.length} / 6 人`:'本局结束'}</p></div>
      <RoundDisplay key={code} game={view.game} meId={me?.id} anchor={anchor}/>
      <MyPoints view={view}/>
      <RoundActionHistory game={view.game} meId={me?.id}/>
      {phase==='lobby'&&<LobbyRoom view={view} busy={busy} command={command}/>} 
      {(phase==='main'||phase==='delayed')&&view.member?.role==='player'&&me?.alive&&(phase==='main'||Boolean(me.delayed))&&<ActionPicker key={phase} view={view} me={me} delayed={phase==='delayed'} busy={busy} preparing={preparing} command={command}/>}
      {(phase==='rps'||phase==='priorityRps')&&<RpsPanel key={phaseKey(view.game)} view={view} meId={me?.id} command={command} busy={busy} preparing={preparing} error={error}/>}
      {phase==='finished'&&<Finish view={view} busy={busy} command={command}/>} 
      {view.member?.role==='spectator'&&phase!=='lobby'&&<div className="spectator-note">你正在观战 · 下一局可由房主重新排座</div>}
      {(phase==='lobby'||phase==='finished'||view.member?.role==='spectator')&&<div className="finish-buttons"><button className="ghost leave-room" disabled={busy} onClick={()=>{if(previewTools)window.location.assign('/');else void command('leave');}}>{busy?'正在处理…':phase==='finished'?'结束游戏 · 返回大厅':'退出房间 · 返回大厅'}</button></div>}
      {error&&<div className="toast" role="alert">{error}</div>}
    </section>{showLog&&<aside className="event-panel" id="round-records"><header><span>回合记录</span><button onClick={()=>setShowLog(false)} aria-label="关闭回合记录">×</button></header><small className="event-privacy">不显示任何玩家的点数余额</small><div>{view.game.events.length?view.game.events.map((e,i)=><p key={`${e}-${i}`}><i/>{e}</p>):<p className="empty">开局后，结算记录会出现在这里。</p>}</div></aside>}</div>
    {rules&&<Rules onClose={()=>setRules(false)}/>} 
  </main>
}

function usePhasePreparing(game:PublicGame,anchor:ClockAnchor){
  const [,wake]=useState(0);
  const startsAt=game.phaseStartedAt??0;
  useEffect(()=>{
    const wait=startsAt-anchor.serverNow-Math.max(0,performance.now()-anchor.receivedAt);
    if(wait<=0)return;
    const timer=setTimeout(()=>wake(n=>n+1),wait+10);
    return()=>clearTimeout(timer);
  },[startsAt,anchor]);
  return game.deadline!==null&&startsAt>anchor.serverNow+Math.max(0,performance.now()-anchor.receivedAt);
}

function RoundDisplay({game,meId,anchor}:{game:PublicGame;meId?:string;anchor:ClockAnchor}){
  // Only the clock/reveal subtree ticks; selecting an action does not render at 10Hz.
  const [now,setNow]=useState(()=>performance.now());
  useEffect(()=>{
    let timer:ReturnType<typeof setInterval>|undefined;
    const resume=()=>{clearInterval(timer);setNow(performance.now());if(!document.hidden&&game.deadline!==null)timer=setInterval(()=>setNow(performance.now()),100);};
    resume();document.addEventListener('visibilitychange',resume);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);};
  },[game.deadline]);
  const {remainingMs,seconds,progress,preparingMs,durationMs}=clientPhaseClock(game,anchor.serverNow,Math.max(now,anchor.receivedAt)-anchor.receivedAt);
  return <><GameTable game={game} meId={meId} seconds={seconds} remainingMs={remainingMs}/>{game.phase!=='lobby'&&game.phase!=='finished'&&<PhaseTimer game={game} remainingMs={remainingMs} seconds={seconds} progress={progress} preparingMs={preparingMs} durationMs={durationMs}/>}</>;
}

function GameTable({game,meId,seconds,remainingMs}:{game:PublicGame;meId?:string;seconds:number;remainingMs:number}){
  const resourceBursts=useResourceBursts(game.resourceEvents);
  const reveal=game.phase==='reveal'||game.phase==='finished'?game.reveal:undefined;
  const bySeat=[...game.players].sort((a,b)=>a.seat-b.seat),selfIndex=bySeat.findIndex(p=>p.id===meId);
  const ordered=selfIndex>=0?[...bySeat.slice(selfIndex),...bySeat.slice(0,selfIndex)]:bySeat;
  const seatCount=game.phase==='lobby'?6:ordered.length;
  const seatStyle=(index:number):CSSProperties=>{const angle=Math.PI/2+2*Math.PI*index/seatCount,x=Math.cos(angle);return{left:`calc(${50+45*x}% ${x>=0?'-':'+'} ${Math.abs(x)*65}px)`,top:`${50+30*Math.sin(angle)}%`,'--idle-delay':`${index*-.6}s`} as CSSProperties;};
  const elapsedMs=game.phase==='reveal'?Math.max(0,PHASE_SECONDS.reveal*1000-remainingMs):PHASE_SECONDS.reveal*1000;
  return <section className={`game-table ${reveal?'revealing':''}`} data-count={seatCount} data-phase={game.phase} aria-label="对局牌桌">
    <div className="table-felt" aria-hidden="true"/>
    <div className={`table-center ${reveal?'table-center-reveal':''}`} aria-live="off">
      {reveal?<><RevealStage key={`${game.match}:${reveal.round}`} reveal={reveal} players={ordered} meId={meId} elapsedMs={elapsedMs} finished={game.phase==='finished'} resourceBursts={resourceBursts}/>{game.phase==='reveal'&&<em>{seconds>0?`${seconds} 秒后进入下一回合`:'正在进入下一回合…'}</em>}</>:<><span className="table-kicker">打 点</span><strong>{game.phase==='lobby'?'等朋友入座':game.phase==='finished'?'对局结束':`第 ${game.round} 回合`}</strong><small>{game.phase==='main'?'各自选招，一起揭晓':game.phase==='delayed'?'延判出手':game.phase==='priorityRps'||game.phase==='rps'?'石头 · 剪刀 · 布':'至少2人即可开始'}</small>{game.phase==='lobby'&&<div className="table-waiting-dots" aria-hidden="true"><i className="ambient-loop"/><i className="ambient-loop"/><i className="ambient-loop"/></div>}</>}
    </div>
    {ordered.map((p,index)=>{
      const action=reveal?.actions.find(a=>a.playerId===p.id);
      const publicMain=game.actionHistory?.players.find(x=>x.playerId===p.id)?.actions.find(x=>x.stage==='main');
      const change=reveal?.hpChanges.find(c=>c.playerId===p.id);
      const bullets=Boolean(action?.mainId==='fly'&&reveal?.actions.some(a=>a.playerId!==p.id&&(a.mainId==='snap'||a.mainId==='gun'&&a.targetId===p.id)));
      return <article key={p.id} className={`table-seat ${p.id===meId?'self':''} ${!p.alive?'dead':''} ${change?(change.after<change.before?'took-hit':'took-heal'):''} ${action?`seat-gesture-${gestureKind(action.mainId)}`:''}`} style={seatStyle(index)}>
        {action?.mainId==='fly'&&<WingAura bullets={bullets}/>}
        <div className="table-seat-head"><span className={`seat-avatar ${p.alive&&!action?'ambient-loop':''}`} aria-hidden="true">{p.name.slice(0,1)}</span><strong title={p.name}>{p.name}</strong>{p.id===meId&&<i>你</i>}<span className="table-seat-no">{String(p.seat).padStart(2,'0')}</span></div>
        <div className="table-seat-hp"><span style={{width:`${Math.max(0,Math.min(100,p.hp*10))}%`}}/></div>
        <div className="table-seat-stats"><b>♥ {p.hp}</b><span>拳 {p.fists}</span><span>盾 {p.shields}</span><span>水 {p.waters}</span><span>棉 {p.cotton}</span></div>
        <ResourcePresence playerId={p.id} shields={p.shields} waters={p.waters} bursts={resourceBursts}/>
        {action?<div className="table-seat-action"><GestureMark id={action.mainId}/><b>{action.main}</b>{action.delayed.length>0&&<small>延判：{action.delayed.join('、')}</small>}{change&&<em>{change.after>change.before?'+':''}{change.after-change.before} 血</em>}</div>:publicMain?<div className="table-seat-status public-main-move" title={publicMain.label}>主招：{publicMain.label}{publicMain.status==='failed'?'（未执行）':''}</div>:<div className="table-seat-status" data-confirmed={p.confirmed}>{!p.alive?'已淘汰':game.phase==='lobby'?'已入座':p.confirmed?'✓ 已确认':'选择中'}</div>}
      </article>;
    })}
    {game.phase==='lobby'&&Array.from({length:6-ordered.length},(_,i)=><div key={`empty-${i}`} className="table-seat table-seat-empty" style={seatStyle(ordered.length+i)}><span>＋</span><small>空座</small></div>)}
  </section>
}

function PhaseTimer({game,remainingMs,seconds,progress,preparingMs,durationMs}:{game:PublicGame;remainingMs:number;seconds:number;progress:number;preparingMs:number;durationMs:number}){
  const timed=game.deadline!==null;
  const ending=timed&&remainingMs<=0;
  const title=game.phase==='main'?'本回合出手':game.phase==='delayed'?'延判出手':game.phase==='priorityRps'?'延判先后猜拳':game.phase==='rps'?'铲子猜拳':game.phase==='reveal'?'出手揭晓':game.phase==='finished'?'对局结束':'等待开局';
  const description=preparingMs>0?`同步准备 · ${Math.ceil(preparingMs/1000)} 秒后开始 ${durationMs/1000} 秒计时，可先选招`:ending?'服务器正在结算或切换阶段…':game.phase==='main'||game.phase==='delayed'?`${game.confirmed} / ${game.required} 已确认 · ${durationMs/1000} 秒完整计时`:game.phase==='reveal'?'本阶段结束后，下一回合才开始计时':game.phase==='priorityRps'||game.phase==='rps'?'相关玩家隐藏选择石头剪刀布':'等待房主操作';
  return <section className={`phase-timer phase-timer-${game.phase}`} aria-label="本阶段倒计时">
    <div className="phase-timer-main"><div className="phase-timer-copy"><span>第 {game.round||'—'} 回合</span><strong>{title}</strong><small>{description}</small></div><div className="phase-timer-counter" data-urgent={seconds<=3&&game.phase!=='reveal'} role="timer" aria-label={ending?'等待服务器切换阶段':timed?`剩余 ${seconds} 秒`:title}><b>{timed?(ending?'··':String(seconds).padStart(2,'0')):'--'}</b><span>秒</span></div></div>
    <div className="phase-timer-track" role="progressbar" aria-label="阶段剩余时间" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{transform:`scaleX(${progress/100})`}}/></div>
  </section>
}

function LobbyRoom({view,busy,command}:{view:View;busy:boolean;command:Command}){return <section className="lobby-room"><div className="lobby-copy"><p>等待房主开始</p><h2>{view.game.players.length} 名玩家已入座</h2><span>至少2人，最多6人。开局后新访客自动进入观战席。</span></div><div className="room-code-card"><span>房间号</span><strong>{view.code}</strong><button type="button" onClick={()=>navigator.clipboard?.writeText(view.code)}>复制房间号</button></div>{view.host?<button className="primary" disabled={busy||!view.canStart} onClick={()=>void command('start')}>{view.canStart?'开始对局 →':'等待更多玩家'}</button>:<span className="waiting">房主准备中…</span>}</section>}

function ActionPicker({view,me,delayed,busy,preparing,command}:{view:View;me:PublicGame['players'][number];delayed:boolean;busy:boolean;preparing:boolean;command:Command}){
  const [cat,setCat]=useState<Category>('A'),[selected,setSelected]=useState<ActionId>('accumulate'),[target,setTarget]=useState(''),[count,setCount]=useState('1'),[second,setSecond]=useState<ActionId|''>(''),[secondTarget,setSecondTarget]=useState(''),[secondCount,setSecondCount]=useState('1');
  const locked=me.confirmed;
  const isShovel=(id:ActionId)=>['plastic','iron','cottonShovel','popShield','popWater'].includes(id);
  const allowed=(id:ActionId)=>id!=='skip'&&(!delayed||ACTION_MAP[id].category!=='F');
  const available=ACTIONS.filter(a=>a.category===cat&&allowed(a.id));
  const action=ACTION_MAP[selected];const secondAction=second?ACTION_MAP[second]:null;
  const targets=availableTargets(view.game.players,me.id);
  const effectiveTarget=selectedTargetId(targets,target),effectiveSecondTarget=selectedTargetId(targets,secondTarget);
  const parsedCount=parseActionCount(count,actionCountLimit(action.id));
  const parsedSecondCount=parseActionCount(secondCount,secondAction?actionCountLimit(secondAction.id):99);
  const canSubmit=!busy&&!preparing&&(!action.target||Boolean(effectiveTarget))&&(!secondAction?.target||Boolean(effectiveSecondTarget))&&(!action.count||parsedCount.valid)&&(!secondAction?.count||parsedSecondCount.valid);
  const payload:ActionInput={id:selected,targetId:action.target?effectiveTarget:undefined,count:action.count&&parsedCount.valid?parsedCount.value:undefined};
  function chooseCategory(next:Category){const first=ACTIONS.find(a=>a.category===next&&allowed(a.id));setCat(next);if(first)setSelected(first.id);setCount('1');setSecond('');setSecondCount('1')}
  function chooseAction(id:ActionId){setSelected(id);setCount('1');setSecond('');setSecondCount('1')}
  async function confirm(){
    if(!canSubmit)return;
    if(delayed){
      const list=[payload];
      if(secondAction)list.push({id:secondAction.id,targetId:secondAction.target?effectiveSecondTarget:undefined,count:secondAction.count&&parsedSecondCount.valid?parsedSecondCount.value:undefined});
      await command('delayed',{actions:list});
    }else await command('action',{action:payload});
  }
  if(locked)return <div className="locked-action"><span>✓</span><div><b>动作已锁定</b><p>其他玩家只能看到你已确认，无法看到具体动作。</p></div></div>;
  return <section className="action-console">
    <header><div><p>{delayed?'选择延判动作':'选择本回合动作'}</p><span>{delayed?`${me.delayed?.kind==='big'?'大盾':me.delayed?.kind==='double'?'双盾':'延判'}额度 ${me.delayed?.budget??0} 点 · 与本人余额分开`:'自己的点数见上方 · 对手点数隐藏'}</span></div>
      <div className="category-tabs" aria-label="动作分类">{categories.map(c=><button type="button" className={cat===c.id?'active':''} aria-pressed={cat===c.id} disabled={busy||delayed&&c.id==='F'} key={c.id} onClick={()=>chooseCategory(c.id)}><b>{c.id}</b><span>{c.name}</span></button>)}</div>
    </header>
    <div className="action-cards">{available.map(a=><button type="button" className={selected===a.id?'selected':''} aria-pressed={selected===a.id} disabled={busy} key={a.id} onClick={()=>chooseAction(a.id)}><b>{a.name}</b><span>{a.summary}</span><em>{a.count?`每个耗 ${a.cost} · 最多 ${actionCountLimit(a.id)}`:a.cost?`耗 ${a.cost}`:'耗 0'}{a.burst?' · 不足自动爆点':''}</em></button>)}</div>
    <div className="action-options">
      {action.target&&<TargetButtons label="目标" targets={targets} selected={effectiveTarget} onSelect={setTarget} disabled={busy}/>}
      {action.count&&<QuantityInput label="数量" value={count} limit={actionCountLimit(action.id)} onChange={setCount} disabled={busy}/>}
      {delayed&&(me.delayed?.max??1)>1&&<label>第二动作<select value={second} disabled={busy} onChange={e=>{setSecond(e.target.value as ActionId|'');setSecondCount('1');}}><option value="">不使用</option>{ACTIONS.filter(a=>allowed(a.id)&&!(isShovel(selected)&&isShovel(a.id))&&!(selected==='execute'&&a.id==='execute')).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      {secondAction?.target&&<TargetButtons label="第二动作目标" targets={targets} selected={effectiveSecondTarget} onSelect={setSecondTarget} disabled={busy}/>}
      {secondAction?.count&&<QuantityInput label="第二动作数量" value={secondCount} limit={actionCountLimit(secondAction.id)} onChange={setSecondCount} disabled={busy}/>}
      <div className="selected-summary"><span>已选择</span><b>{action.category} · {action.name}</b><small>{action.summary}</small></div>
      <button type="button" className="confirm" disabled={!canSubmit} onClick={()=>void confirm()}>{busy?'提交中…':preparing?'同步准备中…':'确定出手 →'}</button>
    </div>
    {action.burst&&!delayed&&<p className="burst-note">点数不够时，自动按实际缺口扣除同等血量；血量不足则跳过动作。</p>}
  </section>;
}

function RpsPanel({view,meId,command,busy,preparing,error}:{view:View;meId?:string;command:Command;busy:boolean;preparing:boolean;error:string}){
  const [selection,setSelection]=useState<{duelId:string;choice:string}|null>(null),[sending,setSending]=useState(false);
  const priority=view.game.phase==='priorityRps'?view.game.priority:undefined;
  const mine=view.game.rps.filter(d=>d.attackerId===meId||d.targetId===meId),duel=mine.find(d=>!d.submittedIds.includes(meId??''));
  const participating=priority?Boolean(meId&&priority.playerIds.includes(meId)):mine.length>0;
  const locked=priority?priority.submittedIds.includes(meId??''):!duel;
  const duelId=priority?'priority':duel?.id??'';
  async function choose(choice:string){if(sending||busy||preparing)return;setSelection({duelId,choice});setSending(true);const ok=await command('rps',{duelId,choice});setSending(false);if(!ok)setSelection(null);}
  if(!participating)return <div className="waiting-panel">等待相关玩家猜拳，你无需操作。</div>;
  if(locked)return <div className="waiting-panel" role="status">✓ 已出{selection?({rock:'石头',paper:'布',scissors:'剪刀'}[selection.choice]):''}，等待其他玩家…</div>;
  return <section className="rps-panel" aria-busy={sending}><p>{priority?'延判先后':'铲子命中'} · {(view.game.phaseDurationMs??PHASE_SECONDS[view.game.phase]*1000)/1000}秒隐藏猜拳</p><h2>石头剪刀布</h2><div>{([{id:'rock',glyph:'石',label:'石头'},{id:'scissors',glyph:'剪',label:'剪刀'},{id:'paper',glyph:'布',label:'布'}] as const).map(c=><button type="button" key={c.id} disabled={busy||sending||preparing} data-selected={selection?.duelId===duelId&&selection.choice===c.id} onClick={()=>void choose(c.id)}><b>{c.glyph}</b><span>{sending&&selection?.choice===c.id?'提交中…':c.label}</span></button>)}</div><p className="rps-submit-status" role="status">{sending?'正在提交，请稍候…':preparing?'同步准备中，计时开始后即可出拳。':'点一下立即出拳，确认后不能更换。'}</p>{error&&<p className="rps-submit-error" role="alert">{error}</p>}</section>;
}
function Finish({view,busy,command}:{view:View;busy:boolean;command:Command}){const names=view.game.winnerIds.map(id=>view.game.players.find(p=>p.id===id)?.name).filter(Boolean);return <section className="finish-panel"><p>本局结束</p><h2>{names.length?`${names.join('、')} 获胜`:'本局平局'}</h2><span>{view.ranked?'战绩已计入账号：胜+3 / 平+1 / 负+0。':'本局为旧匿名或演示对局，不计入账号积分。'}</span>{view.host&&<button className="primary" disabled={busy||!view.canRematch} onClick={()=>void command('rematch')}>{view.canRematch?'再来一局 →':'等待至少2人入座后重开'}</button>}</section>}
