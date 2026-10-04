'use client';

import {useEffect,useRef,useState,type ComponentType,type CSSProperties} from 'react';
import {GunEffect,MassTaichiEffect} from './combat-effects';
import {HeatParticles} from './heat-particles';
import {EnergyEffect} from './energy-effects';
import {isEnergyId,type EnergyId,type EnergyScenario} from '@/lib/energy-effects';
import type {PropKind,EffectTiming} from './prop-effects';

// Keep WebGL and its browser-only dependency outside the server render path.
function ClientPropEffect(props:EffectTiming&{kind:PropKind;count?:number}){
  const [Model,setModel]=useState<ComponentType<EffectTiming&{kind:PropKind;count?:number}>|null>(null);
  const [failed,setFailed]=useState(false);
  const loadDelay=useRef(0);
  useEffect(()=>{let active=true;const start=performance.now();import('./prop-effects').then(module=>{if(active){loadDelay.current=performance.now()-start;setModel(()=>module.PropEffect);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[]);
  const offset=(props.elapsedMs??0)+(props.animated&&!props.paused?loadDelay.current:0);
  return Model?<Model {...props} elapsedMs={Math.min(5000,offset)}/>:<div className="prop-effect"><p role="status">{failed?'模型未能加载，请刷新重试。':'正在载入三维材质…'}</p></div>;
}

export type DocumentEffectId=EnergyId|PropKind|'mass'|'gun'|'punch'|'multiPunch'|'executePierce'|'executeSlash'|'super'|'snap'|'guard'|'fly'|'friction'|'heat'|'ice'|'raiseFist'|'convert';
export const documentStudies:Array<{id:DocumentEffectId;name:string;note:string;poses:Array<[string,number]>;approved?:boolean}>=[
  {id:'mass',name:'密集气功',note:'九人3×3太极、阴阳八卦背景。四个主要姿势衔接，群体气浪不代表必然清点。',poses:[['抱球',0],['云手',1100],['推掌',3100],['收势',4200]]},
  {id:'gun',name:'枪',note:'AK-47斜向右上；1秒内拉动机柄上膛并转向，枪口火焰约0.3秒。',poses:[['斜持',0],['机柄后拉',320],['开火',1080],['停留',1500]]},
  {id:'punch',name:'单拳',note:'带深蓝袖口的人手从胸前直接前冲；拳峰朝前，接触波只表达动作力度。',poses:[['蓄势',0],['前冲',420],['收拳',1100]]},
  {id:'multiPunch',name:'多拳',note:'参考你指定的连拳节奏：先晃拳，再交替前冲的快速拳影。拳数由下方标签说明，不用拳影数量暗示伤害。',poses:[['晃拳',180],['连打',880],['最后一拳',1390],['收势',1900]]},
  {id:'executePierce',name:'点杀 · 能量刺',note:'你已选择方案1：锁定目标轮廓，细长能量刺瞬间贯穿。已接入回合展示；动画不代表目标必死。',approved:true,poses:[['锁定',400],['贯穿',1000],['余迹',1400]]},
  {id:'super',name:'Super',note:'两手从低位平指开始，抬升途中逐渐弯指，最后停在托举姿势。三个对齐手型短过渡，袖口和掌根保持稳定。',poses:[['低位平指',0],['抬起微弯',700],['弯指托举',1300],['停留',1700]]},
  {id:'plastic',name:'塑料铲',note:'原创三维塑料铲。青蓝色塑料、模压加强筋；斜持后向前上方铲起。',poses:[['斜持',0],['铲起',700],['材质停留',2200]]},
  {id:'iron',name:'铁铲',note:'与塑料铲共用形状语言，换成冷灰金属刃、包边高光和深色握把。',poses:[['斜持',0],['铲起',700],['金属反光',2200]]},
  {id:'snap',name:'响指',note:'食指与中指并拢弯曲，不单独抬起食指。保留短促弹动、袖口和指间光点。',poses:[['双指并拢',0],['弹指瞬间',660],['收稳',1100]]},
  {id:'knife1',name:'小角刀',note:'小型交叉角刀，短刃、紧凑交叉。三种刀共用原创建模，仅尺寸与展开幅度递增。',poses:[['小刀交叉',0],['展开',700],['停留',1800]]},
  {id:'knife2',name:'大角刀',note:'中型交叉角刀，比小角刀明显更宽、更长。',poses:[['交叉',0],['展开',700],['停留',1800]]},
  {id:'knife3',name:'大大刀',note:'最大型交叉角刀，展开覆盖范围最大，仍保持同一组外观。',poses:[['交叉',0],['展开',700],['停留',1800]]},
  {id:'guard',name:'防',note:'修订：双手交叉挡在身前，向观看者展示手背和指甲，掌心朝向自己。保留袖口与交叠阴影。',poses:[['举掌',0],['手背朝外交叉',650],['停留',1500]]},
  {id:'fly',name:'飞',note:'展开金色天使翅膀，随后向右上方飞离并渐隐。没有被子弹命中的预设结果。',poses:[['双翼展开',450],['开始飞走',1500],['右上飞离',2350],['消失',3100]]},
  {id:'friction',name:'摩擦',note:'修订：两只手分别成层，贴合后沿同一方向相反往返搓动，两只手都动。每0.2秒一次，共六次，1.2秒后停稳。',poses:[['双掌贴合',0],['相反滑动',100],['第3次',500],['第6次',1100],['停止',1500]]},
  {id:'heat',name:'热气',note:'修订：蓄热微光→黄白火芯喷发→火星沿喷射方向散开→余烬上浮淡出。火焰分层轻摆，粒子有独立轨迹和拖尾，不是整张图片平移。',poses:[['蓄热',250],['喷发',850],['火舌与粒子',1500],['余烬',2650]]},
  {id:'ice',name:'冰块',note:'从文档冰块图提取主体为透明素材，保留四块冰的写真质感和柔和寒光，去掉矩形底图。抠图处理有轻微重绘。',poses:[['凝结',200],['冰块显现',700],['冷光停留',1600]]},
  {id:'raiseFist',name:'举拳',note:'修订：正面平视，拳与前臂竖直。从画面底部抬入，沿竖直方向举到肩旁后停稳；不再斜冲镜头。',poses:[['下方起势',200],['向上抬拳',520],['肩旁停留',1250]]},
  {id:'smallShield',name:'举盾／小盾',note:'不是中世纪盾。原创现代防护盾：矩形削角、透明青蓝面板、深色框架和背面握把，从下方举起。',poses:[['举起',0],['到位',750],['材质展示',2200]]},
  {id:'bigShield',name:'举大盾',note:'同系列更大的现代防护盾，不另造一个未经你指定的手势。',poses:[['举起',0],['到位',750],['材质展示',2200]]},
  {id:'holyWater',name:'圣水',note:'参考圣水采集器的“储液与采集”概念，原创紫色储液罐、金属支架和侧管，液面轻动、气泡上浮。',poses:[['采集器',0],['液体流动',1000],['气泡上浮',2300]]},
  {id:'holyBlock',name:'圣块',note:'修订：撤下照片贴片。带厚度的半透明冰壳从底部凝结，包覆圣水装置；倒角反光、霜纹、冰晶与上浮冷光粒子共同表现保护层。内部仍能看见紫色圣水。',poses:[['开始凝结',200],['冰壳生长',620],['包覆完成',1500],['材质停留',2200]]},
  {id:'cotton',name:'纺棉',note:'已验收，保留原版。不用手势；棉絮围绕卷轴转动成团，连着细棉线，停止后保留棉团。',approved:true,poses:[['卷轴',0],['卷绕',900],['棉团',3000]]},
  {id:'cottonShovel',name:'棉花铲',note:'修订：铲头保留白棉，整根铲杆与顶部握把也改成棉质；有细小棉簇、缠绕纤维与柔软哑光，不再露出硬质深色把手。',poses:[['持铲',0],['铲起',700],['棉质把手',2200]]},
  {id:'convert',name:'n枪换n−1拳',note:'保留文档黄色问号盲盒的形状，去掉橙色方形背景，只让盒子轻弹、晃动和落影。透明抠图有轻微重绘，不预演资源数量。',poses:[['盲盒入场',0],['弹起',500],['停稳',1700]]},
  {id:'fistThunder',name:'拳劈',note:'琥珀色雷纹环绕拳印，电弧落下后衰减。匹配举拳时造成3真伤并取消延判，但不撤回已获得的拳。以下结果均为手动示例。',poses:[['聚雷',450],['落雷',1080],['命中／熄灭',1450],['余辉',2600]]},
  {id:'shieldThunder',name:'盾劈',note:'冰蓝色雷纹与现代盾印。只表达对举盾者的雷击，不把盾画碎：盾劈不销毁盾，也不取消举盾延判。',poses:[['盾印聚雷',450],['落雷',1080],['余电',1450],['消散',2600]]},
  {id:'pointThunder',name:'点劈',note:'浅紫色雷纹与三颗点印，识别积点类但不展示点数。命中也不会取消积点或触发5换9／10特殊效果。',poses:[['点印聚雷',450],['落雷',1080],['余电',1450],['消散',2600]]},
  {id:'thunder',name:'雷劈',note:'紫色雷电徽记与分叉电弧。动作失效示例只画雷纹断裂熄灭，不显示命中；互出雷劈时双方失效、双方无伤。',poses:[['电弧汇聚',450],['落雷／断纹',1080],['余电',1450],['消散',2600]]},
  {id:'smallHeal',name:'小治疗',note:'按你指定的王者治疗感觉：绿色光环向外扩散，细光束和恢复粒子向上升起。仅借鉴视觉方向，仍执行打点规则：3点回1血，不增加群疗或移速。',poses:[['凝聚',400],['绿色光环',1000],['等待／爆裂',1800],['回合末结果',3500]]},
  {id:'bigHeal',name:'大治疗',note:'白粉色护士护理风：立体感护理包、白色护士帽、绷带细节和柔光。5点回2血；整回合结束前仍可被打爆，不提前预报恢复。',poses:[['护理包出现',400],['护理准备',1000],['等待／爆裂',1800],['回合末结果',3500]]},
];
const propKinds=new Set<string>(['plastic','iron','cottonShovel','knife1','knife2','knife3','smallShield','bigShield','holyWater','holyBlock','cotton']);
const spriteFiles:Partial<Record<DocumentEffectId,string>>={punch:'punch-fist-v1',multiPunch:'punch-fist-v1',raiseFist:'raise-fist-front-v2',snap:'snap-hand-together-v3',guard:'guard-backs-v2',fly:'golden-angel-wings-v1',heat:'heat-flame-v1',convert:'convert-blind-box-cutout-v2'};
export function IcePhoto(){return <img className="ice-photo" src="/gestures/ice-cutout-v2.optimized.webp" alt="四块透明背景的冰块" draggable={false}/>;}
export function DocumentEffect({id,animated=true,elapsedMs=0,paused=false,scenario='cast',count=1,presentation='review'}:EffectTiming&{id:DocumentEffectId;scenario?:EnergyScenario;count?:number;presentation?:'review'|'game'}){
  const [offset]=useState(elapsedMs);const style={'--doc-delay':`${-(paused?elapsedMs:offset)}ms`,'--doc-play':paused?'paused':'running'} as CSSProperties;
  if(id==='mass')return <MassTaichiEffect animated={animated} elapsedMs={elapsedMs} paused={paused}/>;
  if(id==='gun')return <GunEffect animated={animated} elapsedMs={elapsedMs} paused={paused}/>;
  if(isEnergyId(id))return <EnergyEffect id={id} scenario={scenario} presentation={presentation} animated={animated} elapsedMs={elapsedMs} paused={paused}/>;
  if(propKinds.has(id))return <div className={`document-effect doc-${id}`} style={style}><ClientPropEffect kind={id as PropKind} count={count} animated={animated} elapsedMs={elapsedMs} paused={paused}/></div>;
  const file=spriteFiles[id];
  return <div className={`document-effect doc-${id} ${animated?'doc-animated':''}`} style={style} role="img" aria-label={documentStudies.find(s=>s.id===id)?.name}>
    <i className="doc-floor" aria-hidden="true"/>
    {file&&<div className="doc-motion"><img className="doc-sprite" src={`/gestures/${file}.optimized.webp`} alt="" draggable={false}/></div>}
    {id==='super'&&<div className="doc-motion super-finger-frames">{['super-palms-flat-v3','super-palms-mid-v3','super-palms-curved-v2'].map((frame,i)=><img key={frame} className={`doc-sprite super-frame super-frame-${i}`} src={`/gestures/${frame}.optimized.webp`} alt="" draggable={false}/>)}</div>}
    {id==='multiPunch'&&Array.from({length:6},(_,i)=><div className={`punch-echo punch-echo-${i}`} key={i} style={{'--echo-index':i} as CSSProperties}><img src="/gestures/punch-fist-v1.optimized.webp" alt=""/></div>)}
    {id==='friction'&&<div className="rub-pair"><div className="rub-far"><img src="/gestures/friction-far-hand-v3.optimized.webp" alt="" draggable={false}/></div><div className="rub-near"><img src="/gestures/friction-near-hand-v3.optimized.webp" alt="" draggable={false}/></div></div>}
    {(id==='punch'||id==='multiPunch'||id==='snap'||id==='guard'||id==='super')&&<i className="doc-contact" aria-hidden="true"/>}
    {id==='super'&&<div className="super-column" aria-hidden="true"/>}
    {id==='ice'&&<div className="ice-arrival"><IcePhoto/><i className="ice-sheen"/></div>}
    {(id==='executePierce'||id==='executeSlash')&&<><div className="execute-target" aria-hidden="true"><i/><span/></div><div className="execute-lock" aria-hidden="true"/><i className="execute-trail"/><i className="execute-impact"/></>}
    {id==='fly'&&<div className="wing-trail" aria-hidden="true"/>}
    {id==='heat'&&<><div className="heat-undertow" aria-hidden="true"><img src="/gestures/heat-flame-v1.optimized.webp" alt=""/></div><HeatParticles animated={animated} elapsedMs={elapsedMs} paused={paused}/></>}
  </div>;
}
