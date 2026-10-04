'use client';
import {useEffect,useRef,useState} from 'react';
import {outcomeCatalog,outcomeCoverage,phaseCues,voicePriority,voiceWorksheet,voiceAssignments} from '@/lib/settlement-catalog';
import {OutcomePlayer} from '../outcome-audio';
import type {VoiceId} from '@/lib/round-feedback';

export default function SettlementReview(){
  const [query,setQuery]=useState(''),[copyState,setCopyState]=useState(''),[worksheet,setWorksheet]=useState(false);
  const sound=useRef<OutcomePlayer|null>(null);const [audioStatus,setAudioStatus]=useState('');
  useEffect(()=>()=>sound.current?.dispose(),[]);
  async function listen(id:VoiceId){try{sound.current??=new OutcomePlayer();await sound.current.unlock();if(await sound.current.play(id))setAudioStatus(`正在试听 ${id} · 低音量`);}catch{setAudioStatus('播放失败，请重试');}}
  const matches=(value:string)=>value.toLowerCase().includes(query.trim().toLowerCase());
  const results=outcomeCatalog.filter(item=>matches(`${item.id} ${item.name} ${item.group} ${item.detail} ${item.note}`));
  const coverage=outcomeCoverage.filter(item=>matches(`${item.group} ${item.action} ${item.branches}`));
  async function copy(){try{await navigator.clipboard.writeText(voiceWorksheet());setCopyState('已复制15种结果与音轨映射');}catch{setWorksheet(true);setCopyState('自动复制不可用，请从下方文本框复制');}}
  return <main className="settlement-review">
    <header><a href="/effects-review">← 返回特效样稿</a><span>本地结果语音 · 待你验收</span></header>
    <p className="settlement-kicker">OUTCOME VOICE PLANNER</p><h1>看结果，<br/>再决定说什么。</h1>
    <p className="settlement-intro">{outcomeCatalog.length}种基础结果，覆盖A–I所有动作。多人、伤害数字、先后来源不重复造音轨；复杂回合是这些结果的组合，并不是再录一套新声音。</p>
    <div className="settlement-policy"><b>已接入真实结果，每轮只播放本人一条主语音。</b><p>移除“攻防”六项配音、保留“恢复血量”，不删游戏攻防规则。不恢复“18码”等按动作名播放的旧接线。房间内声音默认开启，首次点击或按键解锁后，结算时低音量播放；观战者不收到私有结果。可临时静音，不补播错过的语音。</p><button onClick={()=>{sound.current?.stop();setAudioStatus('已停止试听');}}>停止试听</button>{audioStatus&&<p role="status">{audioStatus}</p>}</div>
    <section className="settlement-example"><small>你的例子 · 已用规则引擎验证</small><h2>9点 → 5换7 → 被两人拉</h2><p>本轮新增2点，第一拉取走新增2，第二拉取走原有9。本人最后0点、血量不变。</p><div><b>本人：R07 失去点</b><span>014 · 不要啊</span></div><div><b>两位拉者：R08 获得点</b><span>035 · 嘿嘿笑</span></div><p className="settlement-muted">上述数字仅解释你给出的例子。实际配音接口不发送点数余额、得失数量或“已经清零”提示。</p></section>
    <section aria-labelledby="outcomes"><div className="settlement-heading"><h2 id="outcomes">不重复的结果清单</h2><button onClick={()=>void copy()} type="button">复制配音映射表</button></div>
      <label className="settlement-search">搜索结果或动作<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="例如：拉、抵挡、点杀、R07" type="search"/></label>
      {copyState&&<p role="status">{copyState}</p>}{worksheet&&<textarea aria-label="配音映射表" readOnly value={voiceWorksheet()} rows={12}/>}
      <div className="settlement-cards">{results.map(item=><article key={item.id}><small>{item.id} · {item.group}</small><h3>{item.name}</h3><p><b>音轨：{voiceAssignments[item.id]}</b></p><button type="button" onClick={()=>void listen(item.id)}>试听 {item.id}</button><p>{item.detail}</p><p className="settlement-muted">{item.note}</p></article>)}</div>
      {!results.length&&<p>没有匹配的结果标签；可查看下方动作来源。</p>}
    </section>
    <section><h2>同轮有多个结果，播哪一条？</h2><p>以下只是默认优先级建议，可由你修改。相同结果出现多次只播一次；画面仍能同时呈现受伤、失点、破盾等信息。</p><ol className="settlement-priority">{voicePriority.map(item=><li key={item}>{item}</li>)}</ol><p className="settlement-muted">正常动作耗点、出拳、使用棉花、主动爆盾水，不叫“被夺走”。有效抵挡、反弹或抵消没有独立语音，也不能因删了攻防类别而误报为“没有实际作用”。</p></section>
    <section><h2>过程提示，单独一组</h2><p>这些不是最终结算结果，建议先保持简短或静音，避免猜拳播一次、受伤又播一次。</p><div className="settlement-cues">{phaseCues.map(item=><article key={item.name}><h3>{item.name}</h3><p>{item.branches}</p></article>)}</div><p className="settlement-muted">注意：防守方猜拳赢，塑料铲仍有1基础伤害、铁铲仍有3基础伤害，再经过防护。因此“猜拳赢”不等于“完全没受伤”。</p></section>
    <section><h2>A–I 分支核对表</h2><p>这里列出结果的原因，不增加重复音轨。同一动作可以产生多个结果，最终按上面的主语音规则选一条。</p><div className="settlement-coverage">{coverage.map(item=><details key={item.action} open={query.trim()?true:undefined}><summary><small>{item.group}</small><b>{item.action}</b></summary><p>{item.branches}</p></details>)}</div>{!coverage.length&&<p>没有匹配的动作。</p>}</section>
    <section className="settlement-policy"><h2>实现边界</h2><p>服务器记录真实结果，只向本人发送一个选定标签；不从日志猜结果，不把隐藏余额发到浏览器计算。音频默认低音量、禁止叠播，切换阶段或关闭声音会停止，刷新不重播旧结算。原音频未改动。</p><p>语音仍然会透露“这次确实得点或失点”的定性信息，这是你要的反馈；不细分剩余多少、是否清零。旁观者不收到玩家私有资源结果。</p><p className="settlement-muted">核对中另外发现了“付费失败的冰／热气仍参与防御”和“付费失败的点杀仍参与互消”两个规则缺陷类别，已单独记录，未把这些错误行为纳入本清单，也未顺手修改规则。</p></section>
  </main>;
}
