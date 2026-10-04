'use client';

import {useEffect,useState} from 'react';
import {DocumentEffect,documentStudies,type DocumentEffectId} from '../document-effects';
import {ResourcePresenceReview} from '../resource-presence';
import {isEnergyId,energyVariants,type EnergyScenario} from '@/lib/energy-effects';

export default function EffectsReview(){
  const [selected,setSelected]=useState<DocumentEffectId>('smallHeal');
  const [onlyNew,setOnlyNew]=useState(true),[scenario,setScenario]=useState<EnergyScenario>('cast');
  const [run,setRun]=useState(0),[pose,setPose]=useState<number|null>(1000),[elapsed,setElapsed]=useState(0),[size,setSize]=useState(2);
  const study=documentStudies.find(s=>s.id===selected)!;
  const variants=isEnergyId(selected)?energyVariants(selected):[];
  const timing={animated:true,elapsedMs:pose??0,paused:pose!==null};
  useEffect(()=>{if(pose!==null)return;let frame=0,last=0;const start=performance.now();const tick=()=>{const ms=Math.min(5000,performance.now()-start);if(ms-last>=50||ms===5000){setElapsed(ms);last=ms;}if(ms<5000)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[pose,run]);
  function replay(){setPose(null);setElapsed(0);setRun(r=>r+1);}
  function choose(id:DocumentEffectId){setSelected(id);setScenario('cast');setPose(isEnergyId(id)?1000:0);setElapsed(0);setRun(r=>r+1);}
  function chooseScenario(value:EnergyScenario){setScenario(value);setPose(null);setElapsed(0);setRun(r=>r+1);}
  const key=`${selected}:${scenario}:${run}:${pose}`;
  return <main className="effects-review">
    <header><a href="/gesture-review">← 已通过手势与前一批样稿</a><a href="/settlement-review">结算配音清单 →</a></header>
    <p className="effects-eyebrow">DADIAN / EFFECT LAB · LOCAL ONLY</p>
    <h1>动作有形，<br/><em>结果另说。</em></h1>
    <p className="effects-lead">本次新增四种雷劈、小治疗和大治疗。小治疗是绿色恢复光环，大治疗是白粉色护士护理风。可分别查看发动、成功、被打爆或失效，结果均为人工示例。已通过的动作不改；音效保留待你试听验收，全部未上传。</p>
    <div className="effects-filter"><span>选择批次，再选择动作</span><button type="button" aria-pressed={onlyNew} onClick={()=>{setOnlyNew(true);if(!isEnergyId(selected))choose('smallHeal');}}>本次新增6项</button><button type="button" aria-pressed={!onlyNew} onClick={()=>setOnlyNew(false)}>全部样稿</button></div>
    <nav className="effects-tabs" aria-label="文档动作样稿">{documentStudies.filter(s=>!onlyNew||isEnergyId(s.id)).map(s=><button key={s.id} data-batch={isEnergyId(s.id)?'new':undefined} type="button" aria-pressed={selected===s.id} onClick={()=>choose(s.id)}>{s.name}</button>)}</nav>
    <section className="effects-workbench" aria-labelledby="effect-title">
      <div className="effects-heading"><div><small>{study.approved?'已验收 · 保留原版':'待你验收 · 无声样稿'}</small><h2 id="effect-title">{study.name}</h2></div><span>{pose!==null?'定格查看':elapsed>=5000?'展示结束':`${Math.ceil((5000-elapsed)/1000)} 秒`}</span></div>
      <p>{study.note}</p>
      <div className="effects-stage effects-main-stage"><DocumentEffect key={key} id={selected} scenario={scenario} {...timing}/><span className="effects-stage-tag">{study.name} · {variants.length?'模拟示例':'动作样稿'}</span></div>
      {variants.length>0&&<div className="effects-scenarios"><small>人工选择结算情景 · 不代表真实对局</small><div>{variants.map(v=><button type="button" key={v.id} aria-pressed={scenario===v.id} onClick={()=>chooseScenario(v.id)}>{v.name}</button>)}</div><p>{variants.find(v=>v.id===scenario)?.note}</p></div>}
      <div className="effects-toolbar"><button type="button" className="effects-replay" onClick={replay}>↻ 重播5秒</button><span>动作样稿静音 · 结果语音可单独试听</span><label>定格进度<input aria-label="定格进度" type="range" min={0} max={5000} step={50} value={pose??elapsed} onChange={e=>setPose(Number(e.target.value))}/></label></div>
      <div className="effects-progress" role="progressbar" aria-label="五秒展示进度" aria-valuemin={0} aria-valuemax={5000} aria-valuenow={pose??Math.round(elapsed)}><span style={{width:`${(pose??elapsed)/50}%`}}/></div>
      <div className="effects-poses">{study.poses.map(([name,ms])=><button key={ms} type="button" aria-pressed={pose===ms} onClick={()=>setPose(ms)}>{name}</button>)}</div>
      {variants.length>0&&<p className="effects-approval-note">这6项尚未加入正式回合，等你逐项确认。这里将整回合末的恢复时机缩进5秒演示，不会改变游戏中“整回合含延判结束才回血”的规则。</p>}
    </section>
    <section className="effects-round"><div className="effects-heading"><div><small>回合展示尺寸检查</small><h2>自己和别人，都看得见。</h2></div><div>{[2,6].map(n=><button key={n} type="button" aria-pressed={size===n} onClick={()=>setSize(n)}>{n}人展示</button>)}</div></div><p>以下仅为尺寸示例，不是结算演算。每张卡片下方显示动作；只有实际爆点的动作才加爆点标签。新特效通过验收后再接入真实对局。</p>
      <div className={`effects-players effects-players-${size}`}>{Array.from({length:size},(_,i)=><article key={`${key}:${i}`}><header><span>0{i+1}</span><b>{i===0?'你（示例）':`玩家${i+1}`}</b>{i===0&&<small>本人</small>}</header><DocumentEffect id={selected} scenario={scenario} {...timing}/><footer><b>{study.name}{selected==='multiPunch'?' ×3':''}</b>{selected==='mass'&&i===1&&<em>爆点 2</em>}</footer></article>)}</div>
    </section>
    <ResourcePresenceReview/>
    <section className="effects-notes"><h2>这次规则与素材处理</h2><p><b>I · 治疗类已加入本地游戏：</b>小治疗耗3点恢复1血，大治疗耗5点恢复2血。整回合含延判结束才恢复，可超过10血；期间抵挡一次伤害、推、拉或铲子后爆掉，不回血。密集气功绕过它清点，不打爆治疗。</p><p><b>“自身扣血”：</b>爆点支付血量、空摩、空角刀等由自己动作产生的扣血，不是别人攻击造成的伤害。</p><p>冰块与盲盒已提取为透明主体，抠图有轻微重绘；圣块使用立体包覆冰壳。雷劈和治疗用实时光效绘制，护理包为原创图形，不使用王者原素材。音效分类移除“攻防”六项、保留新增“恢复血量”，不改游戏攻防规则。</p></section>
  </main>;
}
