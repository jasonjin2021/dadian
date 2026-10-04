'use client';
import {useCallback,useEffect,useState} from 'react';
import type {PublicAccount} from '@/lib/account-store';

export function useAccount(){
  const [account,setAccount]=useState<PublicAccount|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const refresh=useCallback(async()=>{
    setLoading(true);try{const r=await fetch('/api/account',{cache:'no-store',signal:AbortSignal.timeout(10000)}),d=await r.json() as {account:PublicAccount|null;error?:string};if(!r.ok)throw new Error(d.error??'账号暂时无法读取');setAccount(d.account);setError('');}
    catch(e){setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'连接较慢，请重试');}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  return{account,setAccount,loading,error,refresh};
}
export function AccountPanel({state}:{state:ReturnType<typeof useAccount>}){
  const [mode,setMode]=useState<'login'|'register'>('login'),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(command:'login'|'register'|'logout'){
    if(busy)return;if(command==='register'&&password!==confirm){setError('两次密码不一致');return;}
    setBusy(true);setError('');try{
      const r=await fetch('/api/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command,username,password}),signal:AbortSignal.timeout(12000)}),d=await r.json() as {account:PublicAccount|null;error?:string};
      if(!r.ok)throw new Error(d.error??'操作失败');state.setAccount(d.account);setPassword('');setConfirm('');
    }catch(e){setError(e instanceof Error&&!['TimeoutError','AbortError'].includes(e.name)?e.message:'连接超时，请重试；注册过的账号可直接登录');}finally{setBusy(false);}
  }
  if(state.loading)return <section className="account-panel"><p role="status">正在读取账号…</p></section>;
  if(state.error)return <section className="account-panel"><p role="alert">{state.error}</p><button onClick={()=>void state.refresh()}>重试连接</button></section>;
  if(state.account)return <section className="account-panel"><div className="panel-kicker">我的账号</div><h2>{state.account.username}</h2><div className="account-stats"><b>{state.account.points}<small>积分</small></b><span>{state.account.wins} 胜 / {state.account.draws} 平 / {state.account.losses} 负</span><span>{state.account.kills} 击杀</span></div><button className="ghost" onClick={()=>void submit('logout')} disabled={busy}>{busy?'正在退出…':'退出账号'}</button>{error&&<p role="alert" className="form-error">{error}</p>}</section>;
  return <section className="account-panel"><div className="panel-kicker">自己的账号，自己的战绩</div><h2>{mode==='register'?'注册账号':'登录账号'}</h2><form onSubmit={event=>{event.preventDefault();void submit(mode);}}><label>用户名<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={20} required placeholder="3–20位汉字、字母、数字或下划线"/></label><label>密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='register'?'new-password':'current-password'} minLength={8} maxLength={128} required placeholder="至少8位，建议使用独立密码"/></label>{mode==='register'&&<label>再次输入密码<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required/></label>}<button type="submit" className="primary" disabled={busy}>{busy?'正在处理…':mode==='register'?'注册并登录':'登录'}</button></form><button className="account-mode ghost" disabled={busy} onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setPassword('');setConfirm('');}}>{mode==='login'?'没有账号？注册一个':'已有账号？返回登录'}</button>{mode==='register'&&<p className="account-warning">暂无密码找回，请保存好用户名和密码。用户名、积分和战绩会显示在公开排行榜中。</p>}{error&&<p role="alert" className="form-error">{error}</p>}</section>;
}

export function Leaderboard({currentId}:{currentId?:string}){
  const [players,setPlayers]=useState<PublicAccount[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/leaderboard',{cache:'no-store',signal:AbortSignal.timeout(10000)}),d=await r.json() as {players:PublicAccount[];error?:string};if(!r.ok)throw new Error(d.error??'排行榜加载失败');setPlayers(d.players);setError('');}catch{setError('排行榜暂时无法读取，请重试');}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load,currentId]);
  return <section className="leaderboard" id="ranking" aria-label="积分排行榜"><header><div><h2>积分榜</h2><p>胜 +3 · 平 +1 · 负 +0 / 新账号从零开始</p></div><button className="ghost" disabled={loading} onClick={()=>void load()}>{loading?'读取中…':'刷新榜单'}</button></header>{error?<p role="alert">{error}</p>:players.length?<div className="ranking-scroll"><table><thead><tr><th>排名</th><th>玩家</th><th>积分</th><th>胜 / 平 / 负</th><th>总场次</th><th>击杀</th></tr></thead><tbody>{players.map((p,i)=><tr key={p.id} data-self={p.id===currentId}><td>{i+1}</td><th scope="row">{p.username}{p.id===currentId?'（你）':''}</th><td><b>{p.points}</b></td><td>{p.wins} / {p.draws} / {p.losses}</td><td>{p.games}</td><td>{p.kills}</td></tr>)}</tbody></table></div>:<p>{loading?'正在读取…':'还没有玩家上榜，注册账号开启第一局吧。'}</p>}<small>按积分、胜场、净胜率排序，展示前50名。旧匿名对局不追溯计分。</small></section>;
}
