'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RenderedAccumulateGesture } from '../accumulate-rendered-gesture';
import { FiveSixGesture } from '../five-six-gesture';
import { FiveSevenGesture } from '../five-seven-gesture';
import { FiveEightGesture, FiveNineGesture, FiveTenGesture } from '../five-eight-nine-gesture';
import { PushGesture, PullGesture, preloadPullFrames } from '../push-pull-gesture';
import { GunEffect, MassTaichiEffect, preloadCombatArt } from '../combat-effects';
import { RevealStage } from '../reveal-visual';
import type { PublicGame, RoundReveal } from '@/lib/game';

type StudyId = 'accumulate' | 'five6' | 'five7' | 'five8' | 'five9' | 'five10' | 'push' | 'pull' | 'mass' | 'gun';
const studies = {
  accumulate: {
    number: '01', name: '积点', status: '光影升级 · 待你验收', title: '积点，双拳上下相碰。',
    intro: '右拳在上、左拳在下：碰拳一次，分开，再碰一次，最后收势停留。保留两次接触光波、阴影与柔和侧光。',
    poses: [{ name: '准备姿势', ms: 0 }, { name: '第一次碰拳', ms: 650 }, { name: '分开蓄势', ms: 1050 }, { name: '第二次碰拳', ms: 1350 }, { name: '回弹收势', ms: 2000 }],
  },
  five6: {
    number: '02', name: '5换6', status: '已通过 · 本地回合已接入', title: '5换6，右手比六，左掌托住。',
    intro: '左手掌心朝上摊平。右手伸出拇指和小指，其余三指收拢，比“六”横放到左掌上。',
    poses: [{ name: '准备姿势', ms: 0 }, { name: '放到掌上', ms: 700 }, { name: '保持手势', ms: 2300 }],
  },
  five7: {
    number: '03', name: '5换7', status: '顺时针修正 · 待你验收', title: '5换7，右手顺时针绕两圈。',
    intro: '右手五指自然张开、略微弯曲，像接住一个东西。左掌固定承托，右手保持托举手型，在水平面顺时针轻轻绕两圈，再停住。',
    poses: [{ name: '开始姿势', ms: 0 }, { name: '向左晃', ms: 325 }, { name: '绕到后方', ms: 650 }, { name: '向右晃', ms: 975 }, { name: '一圈完成', ms: 1300 }, { name: '两圈完成', ms: 2600 }],
  },
  five8: {
    number: '04', name: '5换8', status: '已通过 · 本地回合已接入', title: '5换8，右手从右侧水平伸出。',
    intro: '左掌朝上固定承托。右手从画面右侧伸出，袖口和手腕在右、手指朝左，掌心朝下，五指张开略弯；水平悬在左掌上方，顺时针轻晃两圈。',
    poses: [{ name: '掌心朝下', ms: 0 }, { name: '向左晃', ms: 325 }, { name: '绕到后方', ms: 650 }, { name: '向右晃', ms: 975 }, { name: '一圈完成', ms: 1300 }, { name: '两圈完成', ms: 2600 }],
  },
  five9: {
    number: '05', name: '5换9', status: '钩指版 · 待你验收', title: '5换9，食指弯钩，短促落掌。',
    intro: '左手掌心朝上摊平。右手食指弯成钩状，其余手指收拢，短促落到左掌上方，随后保持手势；不绕圈。',
    poses: [{ name: '钩指准备', ms: 0 }, { name: '落掌接触', ms: 700 }, { name: '轻微回弹', ms: 885 }, { name: '保持手势', ms: 1150 }],
  },
  five10: {
    number: '06', name: '5换10', status: '侧掌交叉 · 待你验收', title: '5换10，侧掌落在左掌上。',
    intro: '左掌朝上摊平。右手五指并拢、手掌侧立，小指侧搭在左掌上形成交叉，短促落掌后停住。不绕圈。',
    poses: [{ name: '侧掌准备', ms: 0 }, { name: '搭上左掌', ms: 700 }, { name: '接触回弹', ms: 885 }, { name: '交叉定格', ms: 1150 }],
  },
  push: {
    number: '07', name: '推', status: '向前出掌 · 待你验收', title: '推，掌心朝前推出。',
    intro: '右手张开，掌心正对前方，从身前向外推出，随后保持出掌姿势。手腕连接短袖，保留柔和光影和一圈轻微推力波纹。',
    poses: [{ name: '出掌准备', ms: 0 }, { name: '向前推出', ms: 700 }, { name: '收稳手掌', ms: 1000 }, { name: '保持出掌', ms: 1600 }],
  },
  pull: {
    number: '08', name: '拉', status: '五帧快速收指 · 待你验收', title: '拉，直接抓住，利落拉回。',
    intro: '去掉伸手准备，直接从张手开始。补上轻弯手指和即将握紧两帧，连续收指后快速拉回；动作由2.2秒缩短至1.1秒，之后停留至5秒展示结束。暂不配音。',
    poses: [{ name: '张手开始', ms: 0 }, { name: '轻弯手指', ms: 150 }, { name: '收拢一半', ms: 290 }, { name: '即将握紧', ms: 430 }, { name: '握紧拳头', ms: 570 }, { name: '拉回收势', ms: 1100 }],
  },
  mass: {
    number: '09', name: '密集气功', status: '九人太极 · 待你验收', title: '密集气功，九人同起一阵太极。',
    intro: '九个人排成3×3，抱球、云手、移重心、推掌、收势；身后展开阴阳八卦，最后一圈气浪向外扩散。不是单独手部，也不把发动动作误画成已经清掉对方的点。新音效等你统一决定。',
    poses: [{ name: '九人抱球', ms: 0 }, { name: '云手过中', ms: 1100 }, { name: '移重心', ms: 2200 }, { name: '推掌出气', ms: 3100 }, { name: '收势停留', ms: 4200 }],
  },
  gun: {
    number: '10', name: '枪', status: 'AK-47 · 待你验收', title: '枪，上膛、转向、开火。',
    intro: 'AK-47先斜向右上方，约1秒内上膛并转向指定玩家。随后枪口闪焰约0.3秒，轻微后坐，再保持瞄准；不以开火动画暗示一定命中。新音效暂不添加。',
    poses: [{ name: '右上斜持', ms: 0 }, { name: '上膛转向', ms: 650 }, { name: '枪口火焰', ms: 1060 }, { name: '火焰消退', ms: 1220 }, { name: '瞄准停留', ms: 1400 }],
  },
};
const studyComponents = { accumulate: RenderedAccumulateGesture, five6: FiveSixGesture, five7: FiveSevenGesture, five8: FiveEightGesture, five9: FiveNineGesture, five10: FiveTenGesture, push: PushGesture, pull: PullGesture, mass: MassTaichiEffect, gun: GunEffect };
const reviewCopy: Record<StudyId, { title: string; note: string }> = {
  accumulate: { title: '积点光影升级，请看两次碰拳', note: '右拳在上、左拳在下，连续碰拳两次。请检查接触处、两次之间的分开动作与光波是否自然。新版积点先在这里验收，原版对局动作保留。' },
  five6: { title: '5换6 已通过', note: '已接入本地回合动画，主动作和延判均支持。这里可重播回看，当前没有上传。' },
  five7: { title: '5换7，请检查两圈晃动的感觉', note: '左掌全程不动，右手从上往下看顺时针绕两圈，约2.6秒收势，停留至5秒展示结束。不是上下敲掌，也不是手掌自身翻转。下方可检查六人同时展示的效果；此动作仅在样稿页启用，等待你的审批。' },
  five8: { title: '5换8 已通过', note: '右侧袖腕、朝左的手指，掌心向下，左掌固定。已按你的批准接入本地回合展示，保留顺时针两圈、自然袖腕和掌上阴影。尚未上传。' },
  five9: { title: '5换9，请检查食指钩形与落掌位置', note: '重点看食指弯钩是否准确，右手是否落在左掌上方。约0.7秒接触，1.15秒收势，停留至5秒结束。保留接触阴影、轻微回弹与柔光；等待你的审批，未替换实际对局。' },
  five10: { title: '5换10，请检查侧掌交叉', note: '重点看五指是否并拢、手掌是否侧立，以及小指侧有没有搭在左掌上。它是瞬时动作，不套用5换7/8的旋转。仅样稿，等你批准。' },
  push: { title: '推，请检查出掌方向和力度', note: '掌心朝前，从稍远处向前推出，再收稳停住。下方可检查每位玩家的动作和爆点标签。只演示手势，不额外暗示扣血或点数变化；仅样稿。' },
  pull: { title: '拉，请检查五帧衔接和加快的节奏', note: '张手 → 轻弯 → 半握 → 近握 → 握拳，再拉回。没有伸手准备，先握紧再后拉；1.1秒完成。可逐帧定格，也可重播检查连贯性。仅样稿，未替换真实回合。' },
  mass: { title: '密集气功，请看九人动作与八卦背景', note: '这是第一版四姿势动画样稿：重点检查九人队形、太极节奏、背景占比和气浪。下方可看六位玩家同时展示的尺寸。等你批准后再接入实际回合。' },
  gun: { title: '枪，请看转向速度和0.3秒闪焰', note: '可切换左侧、右侧和右下方目标。下方回合示例按实际玩家卡片位置瞄准，不固定朝一个方向。当前先演示一次开火，枪数仍以动作标签为准；等待你的审批。' },
};
const samplePlayers:PublicGame['players']=[
  {id:'you',name:'你（示例）',seat:1,hp:10,fists:3,shields:0,waters:0,cotton:0,kills:0,alive:true,confirmed:true},
  {id:'other',name:'另一位玩家',seat:2,hp:8,fists:3,shields:0,waters:0,cotton:0,kills:0,alive:true,confirmed:true},
  ...Array.from({length:4},(_,i)=>({id:`extra-${i}`,name:`玩家 ${i+3}`,seat:i+3,hp:10,fists:3,shields:0,waters:0,cotton:0,kills:0,alive:true,confirmed:true})),
];
const sampleReveal:RoundReveal={round:1,finish:false,actions:[
  {playerId:'you',name:'你（示例）',main:'积点',mainId:'accumulate',delayed:[],entries:[{id:'accumulate',label:'积点',stage:'main',burstPoints:0,status:'played'}]},
  {playerId:'other',name:'另一位玩家',main:'推 → 你',mainId:'push',targetId:'you',delayed:[],entries:[{id:'push',label:'推 → 你',targetId:'you',stage:'main',burstPoints:2,status:'played'}]},
  ...samplePlayers.slice(2).map(p=>({playerId:p.id,name:p.name,main:'积点',mainId:'accumulate' as const,delayed:[],entries:[{id:'accumulate' as const,label:'积点',stage:'main' as const,burstPoints:0,status:'played' as const}]})),
],hpChanges:[{playerId:'other',name:'另一位玩家',before:10,after:8}],highlights:['第1回合 · 另一位玩家爆点消耗了 2 血']};

export default function GestureReview() {
  const [selected, setSelected] = useState<StudyId>('mass');
  const [run, setRun] = useState(0), [elapsed, setElapsed] = useState(0), [pose, setPose] = useState<number | null>(0);
  const [error, setError] = useState('');
  const [sampleSize,setSampleSize]=useState(2);
  const [aim,setAim]=useState({angle:-15,name:'右侧玩家'});
  const replayIntent = useRef(0);
  const isChangeAction = selected === 'push' || selected === 'pull';
  const isTargetAction = isChangeAction || selected === 'gun';
  const isNewEffect = selected === 'mass' || selected === 'gun';
  useEffect(() => { if (selected === 'pull') void preloadPullFrames().catch(() => {}); else if(selected==='mass'||selected==='gun')void preloadCombatArt(selected).catch(()=>{}); }, [selected]);
  useEffect(() => {
    if (pose !== null) return;
    const start = performance.now();
    let frame = 0, lastPaint = 0;
    // The hand animation runs on CSS, not React. Limit timer/card rerenders to 20Hz.
    const tick = () => { const next = Math.min(5000, performance.now() - start); if (next === 5000 || next - lastPaint >= 50) { setElapsed(next); lastPaint = next; } if (next < 5000) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run, pose]);
  useEffect(() => () => { replayIntent.current++; }, []);
  async function replay() {
    const intent = ++replayIntent.current;
    
    if (selected === 'pull' || selected === 'mass' || selected === 'gun') {
      try { if(selected==='pull')await preloadPullFrames();else await preloadCombatArt(selected); }
      catch { if (intent === replayIntent.current) setError('手势图片未能加载，请点击重播重试。'); return; }
      if (intent !== replayIntent.current) return;
    }
    setError('');
    setElapsed(0); setPose(null); setRun(value => value + 1);
  }
  function inspect(ms: number) { replayIntent.current++; setPose(ms); }
  function selectStudy(id: StudyId) {
    replayIntent.current++; setSelected(id); setElapsed(0); setPose(0); setError(''); setRun(value => value + 1);
  }
  const study = studies[selected];
  const StudyGesture = studyComponents[selected];
  const { title: reviewTitle, note: reviewNote } = isNewEffect ? reviewCopy[selected] : {title:`${study.name} 已通过`,note:'已按你“以上全部验收通过”的确认接入本地回合展示。每个人都能看到自己和别人的动作，动作下方仅在爆点时显示爆点数。未上传。'};
  const result = pose === null && elapsed >= (selected === 'pull' ? 1100 : selected==='mass'?4200:selected==='gun'?1400:2700);
  const roundPreview: RoundReveal = {
    ...sampleReveal,
    actions: sampleReveal.actions.slice(0, sampleSize).map(action => action.mainId === 'accumulate' ? {
      ...action, main: `${study.name}${isTargetAction ? ' → 另一位玩家' : ''}`, mainId: selected, targetId: isTargetAction ? 'other' : undefined,
      entries: [{ id: selected, label: `${study.name}${isTargetAction ? ' → 另一位玩家' : ''}`, targetId: isTargetAction ? 'other' : undefined, stage: 'main', burstPoints: 0, status: 'played' }],
    } : action),
  };
  return <main className="gesture-review">
    <header className="gesture-review-header"><Link href="/" prefetch={false}>打点 / 手势样稿</Link><small>{study.number} · {study.name} · {isNewEffect?study.status:'已通过 · 本地回合已接入'}</small></header>
    <div className="gesture-review-links"><a href="/effects-review">查看文档新特效与两版点杀 →</a><a href="/settlement-review">查看全部结算结果与配音清单 →</a></div>
    <nav className="gesture-review-tabs" aria-label="选择手势样稿">{(Object.keys(studies) as StudyId[]).map(id => <button type="button" key={id} aria-pressed={selected === id} onClick={() => selectStudy(id)}><b>{studies[id].name}</b><small>{id==='mass'||id==='gun'?'新特效 · 待验收':'已通过'}</small></button>)}</nav>
    <div className="gesture-review-kicker">GESTURE STUDY · {study.number}</div>
    <h1>{study.title}</h1>
    <p className="gesture-review-intro">{study.intro}</p>
    <section className="gesture-review-stage" aria-label={`${study.name}动画预览`}>
      <span className="gesture-review-stage-label">{selected==='gun'?'C':isChangeAction||selected==='mass' ? 'B' : 'A'} · {study.name}</span><span className="gesture-review-stage-status">{pose !== null ? '定格查看' : result ? '动作停留 · 展示结果' : '手势揭晓'}</span>
      {selected==='gun'?<GunEffect key={`${selected}:${run}:${pose}`} animated elapsedMs={pose??0} paused={pose!==null} aimAngle={aim.angle} targetName={aim.name}/>:<StudyGesture key={`${selected}:${run}:${pose}`} animated elapsedMs={pose ?? 0} paused={pose !== null}/>}
    </section>
    {selected==='gun'&&<div className="effect-aim-controls" aria-label="枪械瞄准目标">{[{angle:-165,name:'左侧玩家'},{angle:-15,name:'右侧玩家'},{angle:60,name:'右下玩家'}].map(target=><button type="button" key={target.name} aria-pressed={aim.name===target.name} onClick={()=>{setAim(target);inspect(0);setRun(value=>value+1);}}>{target.name}</button>)}</div>}
    <div className="gesture-review-controls"><button type="button" onClick={() => void replay()}>↻ 重播 5 秒</button><span>音效已卸载 · 原音频保留</span><span className="gesture-review-timer" role="timer">{pose !== null ? '定格' : `${Math.ceil((5000 - elapsed) / 1000)} 秒`}</span></div>
    <div className="gesture-review-track" aria-hidden="true"><span style={{ width: `${pose !== null ? pose / 50 : elapsed / 50}%` }}/></div>
    <div className="gesture-review-poses" aria-label="逐姿势查看">{study.poses.map(item => <button type="button" key={item.ms} aria-pressed={pose === item.ms} onClick={() => inspect(item.ms)}>{item.name}</button>)}</div>
    <p className="gesture-review-note">点击“重播”查看完整的 5 秒展示，也可逐步定格。当前不播放任何声音，等待统一配音方案。点数余额及普通点数增减不会显示。</p>
    <section className="gesture-review-checklist" aria-label={`${study.name}验收状态`}><h2>{reviewTitle}</h2><p>{reviewNote}</p></section>
    <section className="gesture-review-round" aria-label="所有玩家的回合展示示例"><h2>每轮结束，大家的动作一起展示</h2><p>展示示例（非结算演算）：你出{study.name}，另一位玩家出推并爆 2 点。没有爆点的动作只显示名称。其他手势仍待逐个制作。</p><div className="gesture-review-poses" aria-label="展示人数"><button type="button" aria-pressed={sampleSize===2} onClick={()=>setSampleSize(2)}>2 人展示</button><button type="button" aria-pressed={sampleSize===6} onClick={()=>setSampleSize(6)}>6 人展示</button></div><RevealStage key={`round:${selected}:${run}:${pose}`} reveal={roundPreview} players={samplePlayers.slice(0,sampleSize)} meId="you" elapsedMs={pose??elapsed} finished={false} paused={pose!==null} previewCombatEffects/></section>
    {error && <p className="gesture-review-error" role="alert">{error}</p>}
  </main>;
}
