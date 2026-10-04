'use client';
import {useEffect,useRef} from 'react';
import {energyFrame,isHealingEffect,type EnergyId,type EnergyScenario} from '@/lib/energy-effects';
import type {EffectTiming} from './prop-effects';

const colors:Record<EnergyId,string>={fistThunder:'#ffd282',shieldThunder:'#82ddff',pointThunder:'#b4b4ff',thunder:'#e4a6ff',smallHeal:'#8df29d',bigHeal:'#f3b9d4'};
const names:Record<EnergyId,string>={fistThunder:'拳劈',shieldThunder:'盾劈',pointThunder:'点劈',thunder:'雷劈',smallHeal:'小治疗',bigHeal:'大治疗'};
const random=(n:number)=>{const f=Math.sin(n*17.37+48.1)*43916.732;return f-Math.floor(f);};
const particles=Array.from({length:42},(_,i)=>({angle:random(i)*Math.PI*2,radius:95+random(i+71)*115,speed:.6+random(i+14)*.7,size:1+random(i+32)*2.1,life:random(i+42)}));
function stroke(ctx:CanvasRenderingContext2D,points:number[][],color:string,width:number,alpha=1){ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();}
function ring(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,alpha:number,width=2,start=0,end=Math.PI*2){ctx.save();ctx.globalAlpha*=alpha;ctx.lineWidth=width;ctx.strokeStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,start,end);ctx.stroke();ctx.restore();}
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha:number){ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
function symbol(ctx:CanvasRenderingContext2D,id:EnergyId,x:number,y:number,scale=1){
  ctx.save();const alpha=ctx.globalAlpha;ctx.translate(x,y);ctx.scale(scale,scale);ctx.strokeStyle=colors[id];ctx.fillStyle=colors[id];ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
  if(id==='fistThunder'){
    const path=new Path2D('M-32 14V-20Q-32-33-23-33Q-14-33-14-20V-5V-31Q-14-42-5-42Q4-42 4-31V-5V-30Q4-40 13-40Q22-40 22-30V-4V-19Q22-30 31-30Q40-30 40-19V22Q40 42 15 42H-10Q-37 42-42 17L-49 0Q-52-13-40-12L-25 5');ctx.stroke(path);stroke(ctx,[[-25,12],[15,12],[15,28]],colors[id],3);stroke(ctx,[[-17,43],[-17,56],[29,56],[29,40]],colors[id],4);
  }else if(id==='shieldThunder'){
    const p=new Path2D('M-32-45H32L43-33V25L28 48H-28L-43 25V-33Z');ctx.globalAlpha=alpha*.16;ctx.fill(p);ctx.globalAlpha=alpha;ctx.stroke(p);ctx.lineWidth=2;ctx.stroke(new Path2D('M-24-34H24L31-25V21L20 35H-20L-31 21V-25Z'));stroke(ctx,[[-19,0],[19,0]],colors[id],3);
  }else if(id==='pointThunder'){
    for(const [dx,dy] of [[-29,15],[0,-23],[29,15]]){ctx.beginPath();ctx.arc(dx,dy,12,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=alpha*.12;ctx.fill();ctx.globalAlpha=alpha;}
    ring(ctx,0,0,53,53,colors[id],.4,1.5);
  }else if(id==='thunder'){
    const p=new Path2D('M13-51L-30 6H-4L-17 51L31-8H6Z');ctx.globalAlpha=alpha*.22;ctx.fill(p);ctx.globalAlpha=alpha;ctx.stroke(p);stroke(ctx,[[-46,-18],[-37,-7],[-49,6]],colors[id],2);stroke(ctx,[[45,22],[37,9],[48,-2]],colors[id],2);
  }else{
    // Mint restorative sigil, not a medical/red-cross insignia.
    ctx.lineWidth=7;stroke(ctx,[[-26,0],[26,0]],colors[id],7);stroke(ctx,[[0,-26],[0,26]],colors[id],7);
    for(const sign of [-1,1]){ctx.save();ctx.scale(sign,1);const leaf=new Path2D('M17 40Q56 40 57 3Q21 6 17 40Z');ctx.globalAlpha=alpha*.25;ctx.fill(leaf);ctx.globalAlpha=alpha*.8;ctx.lineWidth=2;ctx.stroke(leaf);stroke(ctx,[[20,37],[45,16]],colors[id],1.4);ctx.restore();}
  }
  ctx.restore();
}
function drawThunder(ctx:CanvasRenderingContext2D,id:EnergyId,scenario:EnergyScenario,ms:number,reduced:boolean){
  const f=energyFrame(id,scenario,ms,reduced),color=colors[id],t=f.time/1000;
  const cancelled=f.mode==='cancelled',miss=f.mode==='miss',fade=cancelled?1-f.fracture:miss?1-Math.max(0,Math.min(1,(f.time-1100)/850)):Math.max(.16,1-Math.max(0,(f.time-1700)/1600));
  glow(ctx,500,432,270,color,.14*f.charge*fade);
  ring(ctx,500,540,200,49,color,.3*fade);ring(ctx,500,540,170,37,color,.16*fade,1);
  const radius=116+f.charge*18;
  ctx.save();ctx.translate(500,394);ctx.rotate(t*.28);ring(ctx,0,0,radius,radius,color,.55*fade,1.6,.14,Math.PI*1.47);ring(ctx,0,0,radius+11,radius+11,color,.2*fade,1,.6,Math.PI*1.9);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;stroke(ctx,[[Math.cos(a)*(radius-5),Math.sin(a)*(radius-5)],[Math.cos(a)*(radius+4),Math.sin(a)*(radius+4)]],color,1.5,.45*fade);}ctx.restore();
  ctx.save();ctx.globalAlpha=fade*.9;symbol(ctx,id,500,394,.88);ctx.restore();
  // One continuous strike, then a soft decay: no repeated bright strobe.
  if(f.strike>0){
    const bolt=[[489,48],[462,125],[507,150],[467,224],[515,244],[479,306],[501,387]];
    const opacity=f.time<1150?1:Math.max(0,1-(f.time-1150)/740);
    ctx.save();ctx.beginPath();ctx.rect(0,0,1000,48+f.strike*365);ctx.clip();
    stroke(ctx,bolt,color,21,.07*opacity);stroke(ctx,bolt,color,10,.22*opacity);stroke(ctx,bolt,color,4,opacity);stroke(ctx,bolt,'#f8f3ff',1.5,.92*opacity);
    stroke(ctx,[[476,218],[435,238],[445,288],[403,315]],color,2,.55*opacity);stroke(ctx,[[506,148],[551,161],[547,203],[574,224]],color,2,.45*opacity);ctx.restore();
  }
  if(f.impact>0){glow(ctx,500,394,120,color,f.impact*.3);ring(ctx,500,394,25+(1-f.impact)*130,18+(1-f.impact)*110,color,f.impact*.7,2);}
  particles.forEach((p,i)=>{
    const u=(t*p.speed+p.life)%1,x=500+Math.cos(p.angle+t*.18)*p.radius,y=400+Math.sin(p.angle+t*.18)*p.radius*.7-u*23;
    const a=Math.sin(u*Math.PI)*fade*.65;glow(ctx,x,y,p.size*3,color,a*.25);ctx.globalAlpha=a;ctx.fillStyle=color;ctx.fillRect(x,y,p.size,p.size);ctx.globalAlpha=1;
    if(cancelled&&f.fracture>0&&f.fracture<1){const r=140+f.fracture*100;stroke(ctx,[[500+Math.cos(p.angle)*r,394+Math.sin(p.angle)*r],[500+Math.cos(p.angle)*(r+6),394+Math.sin(p.angle)*(r+6)]],color,2,(1-f.fracture)*.6);}
  });
  if(cancelled&&f.fracture>0)stroke(ctx,[[408,299],[591,488]],'#a49dc1',2,.6*(1-f.fracture));
  return f;
}
function heart(ctx:CanvasRenderingContext2D,x:number,y:number,scale:number,color:string){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle=color;
  ctx.fill(new Path2D('M0 17C-5 11-25-2-25-15C-25-30-6-34 0-22C6-34 25-30 25-15C25-2 5 11 0 17Z'));ctx.restore();
}
function nurseKit(ctx:CanvasRenderingContext2D,t:number,scale=1){
  ctx.save();ctx.translate(500,381+Math.sin(t*1.5)*3);ctx.scale(scale,scale);
  // A softly shaded original nursing kit, rather than a flat pasted photo.
  ctx.save();ctx.scale(1,.22);glow(ctx,0,400,130,'#080716',.62);ctx.restore();
  const edge=ctx.createLinearGradient(-115,-35,135,110);edge.addColorStop(0,'#db9cbe');edge.addColorStop(.5,'#d288ae');edge.addColorStop(1,'#965a85');
  ctx.fillStyle=edge;ctx.beginPath();ctx.roundRect(-116,-40,249,151,30);ctx.fill();
  const body=ctx.createLinearGradient(-100,-47,88,97);body.addColorStop(0,'#fffcff');body.addColorStop(.38,'#f6e8f0');body.addColorStop(1,'#d9bfd4');
  ctx.fillStyle=body;ctx.beginPath();ctx.roundRect(-121,-51,240,143,26);ctx.fill();
  ctx.save();ctx.beginPath();ctx.roundRect(-121,-51,240,143,26);ctx.clip();
  const bloom=ctx.createRadialGradient(-72,-28,0,-72,-28,148);bloom.addColorStop(0,'#ffffffb0');bloom.addColorStop(1,'#ffffff00');ctx.fillStyle=bloom;ctx.fillRect(-125,-55,248,150);
  ctx.fillStyle='#d49cbc';ctx.fillRect(-122,-23,244,5);ctx.restore();
  ctx.strokeStyle='#ffffff90';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-115,-46,228,132,22);ctx.stroke();
  stroke(ctx,[[-37,-51],[-37,-68],[-28,-79],[29,-79],[39,-68],[39,-51]],'#c68fae',12);
  stroke(ctx,[[-37,-55],[-37,-68],[-28,-76],[29,-76],[39,-68]],'#ffe9f6',3);
  // Small clasp and stitched front pocket.
  ctx.fillStyle='#d2a2bd';ctx.beginPath();ctx.roundRect(-11,-31,22,25,6);ctx.fill();
  ctx.fillStyle='#fff6fc';ctx.beginPath();ctx.roundRect(-8,-28,16,16,4);ctx.fill();
  ctx.save();ctx.setLineDash([3,5]);ctx.strokeStyle='#b99bab';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(-59,-3,118,78,15);ctx.stroke();ctx.restore();
  heart(ctx,0,39,.66,'#c97099');
  // The white cap is tilted only slightly; its pink band and folds read as nursing.
  ctx.save();ctx.translate(0,-112-Math.sin(t*1.5)*2);
  const hat=new Path2D('M-87 6L-104-39Q-53-69 0-73Q53-69 104-39L87 6L58 24H-58Z');
  const satin=ctx.createLinearGradient(-85,-62,82,20);satin.addColorStop(0,'#ffffff');satin.addColorStop(.45,'#f7f5fd');satin.addColorStop(1,'#d0c2df');ctx.fillStyle=satin;ctx.fill(hat);
  ctx.strokeStyle='#fcefff';ctx.lineWidth=2;ctx.stroke(hat);
  ctx.fillStyle='#d786af';ctx.fill(new Path2D('M-91-21Q0-37 91-21L86-5Q0-21-86-5Z'));
  stroke(ctx,[[-99,-38],[-64,-22],[-58,21]],'#c1aec9',1.4,.72);stroke(ctx,[[99,-38],[64,-22],[58,21]],'#c1aec9',1.4,.72);
  heart(ctx,0,-47,.38,'#cc709e');ctx.restore();
  // A gauze roll gives the case a tactile treatment-kit detail.
  ctx.save();ctx.translate(115,64);ctx.rotate(.25);ctx.fillStyle='#e8deed';ctx.beginPath();ctx.roundRect(-21,-28,42,58,10);ctx.fill();
  for(let i=0;i<5;i++)stroke(ctx,[[-19,-18+i*10],[19,-18+i*10]],'#bbaac4',1,.55);
  ctx.fillStyle='#f9f5ff';ctx.beginPath();ctx.ellipse(0,-25,21,8,0,0,Math.PI*2);ctx.fill();ring(ctx,0,-25,8,3,'#ae99b8',.7,2);ctx.restore();
  ctx.restore();
}
function drawHealing(ctx:CanvasRenderingContext2D,id:EnergyId,scenario:EnergyScenario,ms:number,reduced:boolean){
  const f=energyFrame(id,scenario,ms,reduced),large=id==='bigHeal',color=colors[id],t=f.time/1000;
  const radius=large?136:113,cy=367;
  glow(ctx,500,430,large?290:255,color,.16*f.shell);ring(ctx,500,553,large?197:170,43,color,.3*Math.max(f.shell,f.recovery ? .6 : 0));
  if(f.shell>0){
    ctx.save();ctx.globalAlpha=f.shell;
    const glass=ctx.createRadialGradient(466,cy-55,3,500,cy,radius);glass.addColorStop(0,large?'#ffe9f21c':'#d8fff316');glass.addColorStop(.7,large?'#bc478f05':'#47bcaa04');glass.addColorStop(1,large?'#ef83c71a':'#83efd21a');
    ctx.fillStyle=glass;ctx.beginPath();ctx.arc(500,cy,radius*(.88+.12*f.charge),0,Math.PI*2);ctx.fill();
    if(large){
      ring(ctx,500,cy,radius+43,radius+43,color,.16,1);
      ctx.save();ctx.translate(500,cy+34);ctx.rotate(-.15);ring(ctx,0,0,206,55,color,.28,1.7,t*.4,t*.4+Math.PI*1.65);ctx.restore();
      if(!f.recovery)nurseKit(ctx,t,.88+.12*f.charge);
    }else{
      // Green restorative pulse expands across the floor and travels upward.
      const beam=ctx.createLinearGradient(0,208,0,546);beam.addColorStop(0,'#9af58d00');beam.addColorStop(.7,'#94f98912');beam.addColorStop(1,'#b5ffa542');ctx.fillStyle=beam;
      ctx.beginPath();ctx.moveTo(389,215);ctx.lineTo(611,215);ctx.lineTo(591,540);ctx.quadraticCurveTo(500,567,409,540);ctx.closePath();ctx.fill();
      for(let i=0;i<3;i++){const p=((t*.5+i/3)%1),r=65+p*151;ring(ctx,500,510,r,r*.27,color,(1-p)*.6,2.5);}
      for(let i=0;i<9;i++){const x=412+i*22,y=499-((t*66+i*39)%225);stroke(ctx,[[x,y],[x,y-25-i%3*14]],color,1.3,.13+i%3*.08);}
      symbol(ctx,id,500,cy,1.14);
      ring(ctx,500,cy,95,95,color,.2,1.5,Math.PI*.12,Math.PI*.83);ring(ctx,500,cy,95,95,color,.2,1.5,Math.PI*1.12,Math.PI*1.83);
    }
    ctx.restore();
  }
  if(f.mode==='blocked'&&f.fracture>0&&f.fracture<1){
    // Incoming streak stops at the shell; no hit flash on a player's body.
    const strikeAlpha=Math.max(0,1-f.fracture*2.6);stroke(ctx,[[90,cy-42],[500-radius,cy]],'#ecc4a0',3,strikeAlpha*.8);
    for(let i=0;i<14;i++){
      const a=i*Math.PI/7,r=radius+f.fracture*165,x=500+Math.cos(a)*r,y=cy+Math.sin(a)*r+f.fracture**2*100;
      ctx.save();ctx.translate(x,y);ctx.rotate(a+f.fracture*(i%2?1:-1));ctx.globalAlpha=(1-f.fracture)*.75;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-6,-10);ctx.lineTo(10,-2);ctx.lineTo(2,18);ctx.closePath();ctx.fill();ctx.restore();
    }
  }
  particles.forEach((p,i)=>{
    const burst=f.recovery>0,visible=burst?Math.max(0,1-(f.time-3000)/1800):f.shell;
    const u=(t*p.speed*.3+p.life)%1;
    const angle=p.angle+t*.2,x=500+Math.cos(angle)*(burst?130+u*80:p.radius*.72),y=cy+110-u*(burst?360:255);
    ctx.save();ctx.globalAlpha=Math.sin(u*Math.PI)*visible*.72;ctx.strokeStyle=i%6===0&&large?'#f7eafb':color;ctx.lineWidth=1.6;
    if(large&&i%7===0){heart(ctx,x,y,.18,color);}else if(i%5===0){stroke(ctx,[[x-4,y],[x+4,y]],ctx.strokeStyle,1.6);stroke(ctx,[[x,y-4],[x,y+4]],ctx.strokeStyle,1.6);}else{ctx.beginPath();ctx.arc(x,y,p.size,0,Math.PI*2);ctx.stroke();}ctx.restore();
  });
  if(f.recovery>0){glow(ctx,500,cy,190,color,.17);if(large){nurseKit(ctx,t,.82+.18*f.shell);}else{symbol(ctx,id,500,cy,.9);}ring(ctx,500,cy,74+(f.time-3000)*.06,74+(f.time-3000)*.04,color,Math.max(0,.5-(f.time-3000)/4000),1.5);}
  return f;
}

export function EnergyEffect({id,scenario='cast',animated=true,paused=false,elapsedMs=0,presentation='review'}:EffectTiming&{id:EnergyId;scenario?:EnergyScenario;presentation?:'review'|'game'}){
  const canvasRef=useRef<HTMLCanvasElement>(null),labelRef=useRef<HTMLSpanElement>(null);
  const context=presentation==='game'?'发动动作，结果见回合结算':scenario==='cast'?'发动动作样稿':'人工选择的结算示例，非真实对局';
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    const media=matchMedia('(prefers-reduced-motion: reduce)');const started=performance.now();let frame=0,width=1,height=1,disposed=false;
    const draw=()=>{
      if(disposed)return;cancelAnimationFrame(frame);frame=0;
      const ms=Math.min(5000,elapsedMs+(animated&&!paused?performance.now()-started:0));
      ctx.clearRect(0,0,width,height);ctx.save();ctx.scale(width/1000,height/750);
      const f=isHealingEffect(id)?drawHealing(ctx,id,scenario,ms,media.matches):drawThunder(ctx,id,scenario,ms,media.matches);
      ctx.restore();
      const label=presentation==='game'&&scenario==='cast'?'':f.label;
      if(labelRef.current){labelRef.current.textContent=label;labelRef.current.dataset.outcome=f.recovery?'heal':f.damage?'damage':f.fracture?'broken':'neutral';}
      canvas.parentElement?.setAttribute('aria-label',`${names[id]} · ${context}${label?` · ${label}`:''}`);
      canvas.dataset.frameMs=String(Math.round(f.time));canvas.dataset.result=String(f.recovery||f.damage||0);
      if(animated&&!paused&&!media.matches&&ms<5000)frame=requestAnimationFrame(draw);
    };
    const resize=()=>{const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();};
    const observer=new ResizeObserver(resize);observer.observe(canvas);media.addEventListener('change',draw);resize();
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();media.removeEventListener('change',draw);};
  },[id,scenario,animated,paused,elapsedMs,presentation,context]);
  return <div className={`energy-effect energy-${id}`} role="img" aria-label={`${names[id]} · ${context}`}>
    <canvas ref={canvasRef} aria-hidden="true"/>
    <div className="energy-effect-caption"><small>{isHealingEffect(id)?'I / RESTORATION':'G / THUNDER'}</small><strong>{names[id]}</strong><span ref={labelRef}/></div>
  </div>;
}
