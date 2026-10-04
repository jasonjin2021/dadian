'use client';

import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';

export type PropKind='plastic'|'iron'|'cottonShovel'|'knife1'|'knife2'|'knife3'|'smallShield'|'bigShield'|'holyWater'|'holyBlock'|'cotton';
export interface EffectTiming {animated?:boolean;elapsedMs?:number;paused?:boolean}
const material=(color:number,metalness=0,roughness=.6)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const navy=()=>material(0x182b42,.45,.4),steel=()=>material(0xabbcc9,.78,.24);
function mesh(parent:THREE.Object3D,geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);parent.add(m);return m;}
function profile(points:number[][],depth=.1){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.045,bevelSize:.035,bevelSegments:2,steps:1});}
function tube(parent:THREE.Object3D,points:number[][],radius:number,mat:THREE.Material){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,radius,8,false),mat);}

// Volumetric, bevelled ice that surrounds the collector, not a photo overlay.
function frozenShell(parent:THREE.Group){
  const shell=new THREE.Group();parent.add(shell);
  const surface=new THREE.MeshPhysicalMaterial({color:0x8dcfe6,metalness:.08,roughness:.16,transparent:true,opacity:.19,clearcoat:1,clearcoatRoughness:.08,side:THREE.DoubleSide,depthWrite:false});
  const shape=[[-.88,-1.12],[-1.03,-.86],[-1.02,.95],[-.73,1.31],[.72,1.28],[1.03,.9],[1.02,-.89],[.84,-1.12]];
  const geometry=profile(shape,1.65);geometry.translate(0,0,-.83);
  mesh(shell,geometry,surface).renderOrder=4;
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,24),new THREE.LineBasicMaterial({color:0xbaecfa,transparent:true,opacity:.64}));shell.add(edges);
  const frost=new THREE.MeshBasicMaterial({color:0xbdeafa,transparent:true,opacity:.33,depthWrite:false});
  // Uneven fracture planes and branching veins make the shell read as ice.
  const facets=[[[ -.88,-1.1],[-1.01,-.86],[-1.01,.4],[-.76,-.23]],[[.71,1.27],[1.01,.91],[1.01,-.1],[.82,.49]],[[-.73,1.3],[.25,1.28],[-.43,1.1],[-.97,.65]]];
  facets.forEach(p=>mesh(shell,profile(p,.008),frost,0,0,.84).renderOrder=5);
  const vein=new THREE.MeshBasicMaterial({color:0xd9f6ff,transparent:true,opacity:.47});
  const paths=[[[-.69,1.15,.86],[-.54,.72,.88],[-.68,.43,.86],[-.48,.1,.86]],[[-.54,.72,.88],[-.28,.57,.86],[-.14,.61,.86]],[[.96,-.69,.86],[.69,-.47,.88],[.74,-.2,.86],[.58,-.03,.86]],[[.69,-.47,.88],[.31,-.64,.86],[.21,-.85,.86]]];
  paths.forEach(p=>tube(shell,p,.007,vein));
  const crystals=new THREE.Group();shell.add(crystals);
  const crystalMat=new THREE.MeshPhysicalMaterial({color:0x7cd2ee,metalness:.18,roughness:.16,transparent:true,opacity:.62,clearcoat:1});
  for(let i=0;i<12;i++){const angle=i*2.4,r=.87;const c=mesh(crystals,new THREE.OctahedronGeometry(.12+(i%3)*.04,0),crystalMat,Math.cos(angle)*r,-1.03,Math.sin(angle)*.77);c.scale.set(.75,1.4+(i%4)*.2,.72);c.rotation.z=Math.sin(i)*.5;}
  const motes=new THREE.Group();parent.add(motes);
  for(let i=0;i<20;i++){
    const c=mesh(motes,new THREE.OctahedronGeometry(.018+(i%3)*.006),new THREE.MeshBasicMaterial({color:0xd7f6ff,transparent:true,opacity:0}));
    c.userData.index=i;
  }
  return {shell,motes};
}

/** Original procedural props; no downloaded commercial game models. */
function buildProp(kind:PropKind){
  const group=new THREE.Group();const moving:THREE.Object3D[]=[];let frozen:ReturnType<typeof frozenShell>|undefined;
  if(['plastic','iron','cottonShovel'].includes(kind)){
    const plastic=kind==='plastic',cotton=kind==='cottonShovel';
    const blade=material(plastic?0x45d8e5:0xb8cbd8,plastic?0:.82,plastic?.32:.2);
    const cottonCloth=material(0xf4eee2,0,.98),cottonShade=material(0xd9d5c9,0,1);
    const handle=cotton?cottonCloth:plastic?blade:navy();
    mesh(group,new THREE.CylinderGeometry(cotton?.09:.062,cotton?.105:.075,1.45,16),handle,0,.08,0);
    const grip=[[-.24,.83,0],[-.25,1.1,0],[0,1.2,0],[.25,1.1,0],[.24,.83,0]];
    tube(group,grip,cotton?.1:.07,handle);
    mesh(group,new THREE.BoxGeometry(.52,cotton?.18:.14,cotton?.18:.14),handle,0,.83,0);
    mesh(group,new THREE.CylinderGeometry(.085,.085,.32,16),cotton?cottonCloth:steel(),0,-.52,0);
    const scoop=mesh(group,profile([[-.08,-.52],[-.41,-.61],[-.44,-1],[-.3,-1.2],[.3,-1.2],[.44,-1],[.41,-.61],[.08,-.52]],.08),blade);scoop.rotation.x=-.16;
    if(plastic)for(const x of [-.22,0,.22])mesh(group,new THREE.BoxGeometry(.025,.43,.04),material(0x157f93),x,-.87,.32);
    else if(!cotton)tube(group,[[-.4,-.65,.15],[-.42,-1,.15],[-.3,-1.18,.15],[.3,-1.18,.15],[.42,-1,.15],[.4,-.65,.15]],.025,steel());
    if(cotton){
      for(let i=0;i<13;i++){const x=((i%4)-1.5)*.17,y=-.67-Math.floor(i/4)*.16;mesh(group,new THREE.IcosahedronGeometry(.15,2),cottonCloth,x,y,.27);}
      // Soft tufts and a spiralling fibre seam cover the whole handle and grip.
      for(let i=0;i<45;i++){const a=i*2.4;const puff=mesh(group,new THREE.IcosahedronGeometry(.052+(i%3)*.005,1),i%5===0?cottonShade:cottonCloth,Math.cos(a)*.075,-.6+i*.03,Math.sin(a)*.075);puff.scale.y=1.45;}
      const curve=new THREE.CatmullRomCurve3(grip.map(p=>new THREE.Vector3(...p)));
      for(let i=0;i<24;i++){const p=curve.getPoint(i/23);mesh(group,new THREE.IcosahedronGeometry(.06,1),cottonCloth,p.x,p.y,.04+Math.sin(i*2)*.05);}
      tube(group,Array.from({length:70},(_,i)=>[Math.cos(i*.75)*.104,-.57+i*.019,Math.sin(i*.75)*.104]),.008,cottonShade);
    }
    group.rotation.set(.15,-.42,-.35);
  }else if(kind.startsWith('knife')){
    const scale=kind==='knife1'?.58:kind==='knife2'?.82:1.03;
    for(const sign of [-1,1]){const knife=new THREE.Group();group.add(knife);mesh(knife,new THREE.CylinderGeometry(.072,.08,.62,12),navy(),0,-.58,0);mesh(knife,new THREE.BoxGeometry(.55,.11,.19),material(0x928067,.6),0,-.24,0);mesh(knife,profile([[-.12,-.2],[-.14,.65],[.28,1.22],[.1,.44],[.09,-.2]],.08),steel());tube(knife,[[-.13,.1,.13],[-.14,.64,.13],[.26,1.2,.13]],.013,material(0xe3f6ff,.5,.1));knife.rotation.z=sign*.62;knife.position.z=sign*.12;}
    group.scale.setScalar(scale);group.rotation.y=-.25;
  }else if(kind==='smallShield'||kind==='bigShield'){
    const shape=[[-.64,-1],[-.8,-.76],[-.8,.76],[-.58,1],[.58,1],[.8,.76],[.8,-.76],[.64,-1]];
    mesh(group,profile(shape,.13),navy());
    const pane=mesh(group,profile(shape.map(([x,y])=>[x*.84,y*.83]),.06),new THREE.MeshPhysicalMaterial({color:0x2bbfda,metalness:.35,roughness:.15,transparent:true,opacity:.65}),0,0,.17);
    pane.renderOrder=1;
    for(const x of [-.64,.64])mesh(group,new THREE.BoxGeometry(.04,1.4,.05),new THREE.MeshBasicMaterial({color:0x73eaff}),x,0,.3);
    mesh(group,new THREE.BoxGeometry(.48,.12,.05),material(0xc5e9ee,.65),0,.42,.32);
    for(const y of [-.7,.72])for(const x of [-.58,.58])mesh(group,new THREE.CylinderGeometry(.04,.04,.05,10).rotateX(Math.PI/2),steel(),x,y,.25);
    tube(group,[[-.25,-.3,-.12],[-.25,-.3,-.4],[.25,-.3,-.4],[.25,-.3,-.12]],.06,navy());
    group.scale.setScalar(kind==='bigShield'?1.08:.72);group.rotation.y=-.4;
  }else if(kind==='holyWater'||kind==='holyBlock'){
    mesh(group,new THREE.CylinderGeometry(.9,1,.28,8),navy(),0,-.91,0);
    const liquid=mesh(group,new THREE.CylinderGeometry(.49,.49,1.05,32),new THREE.MeshStandardMaterial({color:0xb241dd,emissive:0x64115f,emissiveIntensity:.5,roughness:.24}),0,-.17,0);moving.push(liquid);
    mesh(group,new THREE.CylinderGeometry(.55,.55,1.5,32,1,true),new THREE.MeshPhysicalMaterial({color:0x92ddf3,transparent:true,opacity:.23,roughness:.08,side:THREE.DoubleSide}),0,.05,0);
    for(const y of [-.74,.82])mesh(group,new THREE.TorusGeometry(.55,.07,10,32).rotateX(Math.PI/2),steel(),0,y,0);
    for(const x of [-.52,.52])for(const z of [-.4,.4])mesh(group,new THREE.CylinderGeometry(.04,.04,1.55,10),navy(),x,.04,z);
    mesh(group,new THREE.ConeGeometry(.62,.35,8),material(0x536981,.6,.35),0,1,0);
    tube(group,[[.5,.55,0],[.85,.6,0],[.85,-.62,0],[.52,-.68,0]],.08,steel());
    for(let i=0;i<6;i++)moving.push(mesh(group,new THREE.SphereGeometry(.04+i*.006,12,8),new THREE.MeshBasicMaterial({color:0xf5a6ff}),Math.sin(i*2)*.29,-.45+i*.17,.42));
    if(kind==='holyBlock')frozen=frozenShell(group);
    group.scale.setScalar(kind==='holyBlock'?.79:.86);group.rotation.y=-.5;
  }else{
    mesh(group,new THREE.CylinderGeometry(.64,.78,.22,20),navy(),0,-.94,0);
    mesh(group,new THREE.CylinderGeometry(.07,.07,1.8,12),steel(),0,0,0);
    for(const y of [-.68,.76])mesh(group,new THREE.CylinderGeometry(.52,.52,.09,24),material(0xb39362,.2),0,y,0);
    const spool=new THREE.Group();group.add(spool);moving.push(spool);
    for(let i=0;i<44;i++){const t=i*.9,y=-.64+(i/43)*1.3;mesh(spool,new THREE.IcosahedronGeometry(.18,1),material(i%3===0?0xe5e8ef:0xfffdf4,0,1),Math.cos(t)*.3,y,Math.sin(t)*.3);}
    tube(group,[[.34,.3,.12],[.9,.15,.25],[1,-.2,.1],[.8,-.4,0]],.026,material(0xfaf6e9));
    group.rotation.y=-.35;
  }
  return{group,moving,frozen};
}

export function PropEffect({kind,count=1,animated=true,elapsedMs=0,paused=false}:EffectTiming&{kind:PropKind;count?:number}){
  const host=useRef<HTMLDivElement>(null);const [unavailable,setUnavailable]=useState(false);
  const copies=(kind==='smallShield'||kind==='bigShield')&&count>=2?2:1;
  useEffect(()=>{
    const target=host.current;if(!target)return;
    const started=performance.now(),motion=matchMedia('(prefers-reduced-motion: reduce)');
    let renderer:THREE.WebGLRenderer|undefined,scene:THREE.Scene|undefined,camera:THREE.PerspectiveCamera|undefined;
    let model:ReturnType<typeof buildProp>|undefined,baseY=0,baseZ=0,frame=0,lastDraw=-Infinity;
    let visible=false,disposed=false,failed=false;
    const stop=()=>{cancelAnimationFrame(frame);frame=0;};
    const currentMs=(now:number)=>motion.matches?1800:Math.min(5000,elapsedMs+(animated&&!paused?now-started:0));
    const canAnimate=(now:number)=>animated&&!paused&&!motion.matches&&currentMs(now)<5000;
    const render=(now:number)=>{
      if(!renderer||!scene||!camera||!model)return;
      const {group,moving,frozen}=model,ms=currentMs(now),t=ms/1000;
      group.rotation.y=baseY+Math.sin(Math.min(t,2.2)*1.3)*.3;
      if(['plastic','iron','cottonShovel'].includes(kind)){const u=Math.max(0,Math.min(1,(t-.25)/.85));group.rotation.z=baseZ+Math.sin(u*Math.PI)*.55;group.position.y=-.17+u*.27;}
      else if(kind.startsWith('knife'))group.rotation.z=baseZ+Math.sin(Math.min(t,1)*Math.PI)*.16;
      else if(kind.includes('Shield'))group.position.y=-1.5*(1-Math.min(1,t/.75))**3;
      else if(kind==='cotton'&&moving[0])moving[0].rotation.y=Math.min(t,3)*5;
      else if(kind==='holyWater'||kind==='holyBlock'){moving[0].scale.y=1+Math.sin(t*4)*.025;moving.slice(1).forEach((b,i)=>b.position.y=-.55+((t*.4+i*.18)%1.2));}
      if(frozen){
        const u=Math.min(1,Math.max(0,(t-.15)/.95)),v=1-(1-u)**3;
        frozen.shell.visible=u>0;frozen.shell.scale.y=.06+.94*v;frozen.shell.position.y=-1.08*(1-v);
        frozen.motes.children.forEach((o,i)=>{const life=(t-.2-i*.028)/1.8,alpha=life>0&&life<1?Math.sin(life*Math.PI)*.7:0;const particle=o as THREE.Mesh<THREE.OctahedronGeometry,THREE.MeshBasicMaterial>;particle.material.opacity=alpha;particle.position.set(Math.sin(i*2.4)*(.8+life*.3),-1.1+life*2.8,Math.cos(i*2.4)*.8);particle.rotation.y=t+i;});
      }
      renderer.domElement.dataset.frameMs=String(Math.round(ms));
      renderer.render(scene,camera);lastDraw=now;
    };
    const tick=(now:number)=>{
      frame=0;
      if(disposed||!visible||document.hidden)return;
      // Keep the RAF aligned with the browser, but draw at no more than 30fps.
      if(now-lastDraw>=1000/30)render(now);
      if(canAnimate(now))frame=requestAnimationFrame(tick);
      else if(lastDraw!==now)render(now);
    };
    const sizeRenderer=()=>{
      if(!renderer||!camera)return false;
      const {width,height}=target.getBoundingClientRect();if(!width||!height)return false;
      const mobile=matchMedia('(max-width: 700px), (pointer: coarse)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.25:1.5));
      renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();return true;
    };
    const create=()=>{
      if(renderer||failed)return;
      try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{failed=true;setUnavailable(true);return;}
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
      target.appendChild(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.set(0,.15,5.5);camera.lookAt(0,0,0);
      scene.add(new THREE.HemisphereLight(0xe2faff,0x3c3038,2));const key=new THREE.DirectionalLight(0xffe6bc,3);key.position.set(-3,4,5);scene.add(key);const rim=new THREE.DirectionalLight(0x44dfff,2);rim.position.set(3,1,-2);scene.add(rim);
      model=buildProp(kind);
      if(copies===2){
        // Both shields share one scene/canvas, including the large-shield pair.
        const pair=new THREE.Group(),shield=model.group,other=buildProp(kind).group;
        [shield,other].forEach((item,index)=>{item.scale.multiplyScalar(.78);item.position.x=(index===0?-1:1)*(kind==='bigShield'?.72:.5);item.rotation.y=index===0?-.3:.3;pair.add(item);});
        model.group=pair;
      }
      scene.add(model.group);baseY=model.group.rotation.y;baseZ=model.group.rotation.z;
      renderer.domElement.dataset.effect=kind;renderer.domElement.dataset.effectCount=String(copies);renderer.domElement.dataset.effectInstance=String(started);
    };
    const activate=()=>{
      stop();if(disposed||!visible||document.hidden)return;
      create();if(!sizeRenderer())return;
      const now=performance.now();render(now);if(canAnimate(now))frame=requestAnimationFrame(tick);
    };
    const resize=new ResizeObserver(()=>{if(visible&&!document.hidden)activate();});resize.observe(target);
    const intersection=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
      visible=entries.some(entry=>entry.isIntersecting);if(visible)activate();else stop();
    });
    if(intersection)intersection.observe(target);else{visible=true;activate();}
    document.addEventListener('visibilitychange',activate);motion.addEventListener('change',activate);
    return()=>{
      disposed=true;stop();resize.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',activate);motion.removeEventListener('change',activate);
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene?.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
      renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();
    };
  },[kind,copies,animated,elapsedMs,paused]);
  return <div className={`prop-effect prop-${kind}`} ref={host} role="img" aria-label={`${kind}${copies===2?' ×2':''}动作`}>{unavailable&&<p role="status">此设备暂时无法显示三维特效，请启用浏览器硬件加速后重试。</p>}</div>;
}
