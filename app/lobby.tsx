'use client';
import { useState } from 'react';
import { PHASE_SECONDS } from '@/lib/game';
import {IdleTable,useIdleMotion} from './idle-table';
import {LobbyMusic} from './lobby-music';
import {AccountPanel,Leaderboard,useAccount} from './player-account';
import {Rules} from './rules-panel';

export {Rules};

export default function Lobby(){
  const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[rules,setRules]=useState(false);
  const motion=useIdleMotion();
  const accountState=useAccount();
  async function create(){if(!accountState.account)return setError('请先登录账号');setBusy(true);setError('');try{const r=await fetch('/api/rooms',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)}),data=await r.json() as {code?:string;error?:string};if(!r.ok||!data.code)throw new Error(data.error??'创建失败');window.location.assign(`/room/${data.code}`)}catch(e){setError(e instanceof Error?e.message:'创建失败');setBusy(false)}}
  async function join(){if(!accountState.account||code.trim().length<6)return setError('请登录并输入6位房间码');setBusy(true);setError('');const c=code.trim().toUpperCase();try{const r=await fetch(`/api/rooms/${c}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:'join',requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(10000)}),data=await r.json() as {error?:string};if(!r.ok)throw new Error(data.error??'加入失败');window.location.assign(`/room/${c}`)}catch(e){setError(e instanceof Error?e.message:'加入失败');setBusy(false)}}
  return <main className="landing" data-idle={motion.running?'on':'off'}>
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">打</span><span>打点</span><small>朋友局</small></a><nav><button className="ghost motion-switch" aria-pressed={motion.enabled} onClick={motion.toggle}>待机动画：{motion.enabled?'开':'关'}</button><button className="ghost" onClick={()=>setRules(true)}>玩法与规则</button></nav></header>
    <LobbyMusic/>
    <section className="landing-hero" id="top">
      <div className="hero-copy-block"><p className="home-overline">2—6 人 · 在线手势游戏</p><h1>打点<span>老游戏，新一局。</span></h1><p>喊上朋友，坐到一张桌前。<br/>自己的点看得见，对手的招猜一猜。</p><IdleTable/></div>
      <aside className="join-panel" aria-label="创建或加入房间"><AccountPanel state={accountState}/>{accountState.account&&<><div className="divider"><span>开始一局</span></div><button className="primary" disabled={busy} onClick={create}>{busy?'正在进入…':'创建房间'} <b>↗</b></button><div className="divider"><span>朋友已经开好房间？</span></div><div className="code-row"><input aria-label="房间码" maxLength={6} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} onKeyDown={e=>{if(e.key==='Enter'&&!busy)void join();}} placeholder="输入6位房间号" autoCapitalize="characters" spellCheck={false}/><button disabled={busy} onClick={join}>加入</button></div></>}{error&&<p className="form-error" role="alert">{error}</p>}<small>账号保存战绩。开局后访客进入观战席。</small></aside>
    </section>
    <section className="home-basics" aria-label="一局怎么玩"><div><span>01</span><p><strong>记点</strong>从积点开始，一次获得2点。</p></div><div><span>02</span><p><strong>出手</strong>{PHASE_SECONDS.main}秒选招，全员确认立即结算。</p></div><div><span>03</span><p><strong>留到最后</strong>初始10血，最后存活者获胜。</p></div></section>
    <Leaderboard currentId={accountState.account?.id}/>
    <footer className="home-footer"><span>一张桌，几个朋友。</span><button onClick={()=>setRules(true)}>查看 A–I 完整动作表 ↗</button></footer>
    {rules&&<Rules onClose={()=>setRules(false)}/>} 
  </main>
}
