'use client';

import {useEffect,useRef} from 'react';
import type {EffectTiming} from './prop-effects';

// Seeded trajectories make replay, freeze-frame and reduced motion agree.
const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const motes=Array.from({length:86},(_,i)=>({
  start:300+noise(i+1)*1500,life:660+noise(i+31)*1150,
  spread:(noise(i+53)-.5)*.53,size:1.1+noise(i+77)*2.9,
  reach:.6+noise(i+109)*.32,wave:noise(i+143)*Math.PI*2,
}));

/** Small canvas overlay: individual sparks, fading trails and rising embers. */
export function HeatParticles({animated=true,paused=false,elapsedMs=0}:EffectTiming){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start=performance.now();let frame=0,width=1,height=1;
    const draw=()=>{
      const ms=reduced?1350:Math.min(5000,elapsedMs+(animated&&!paused?performance.now()-start:0));
      ctx.clearRect(0,0,width,height);
      ctx.globalCompositeOperation='lighter';
      // Local orange light grows from the nozzle; no full-screen flash.
      const glow=Math.max(0,Math.min((ms-200)/400,1,(2900-ms)/850));
      if(glow>0){
        const g=ctx.createRadialGradient(width*.22,height*.52,0,width*.22,height*.52,width*.22);
        g.addColorStop(0,`rgba(255,154,64,${glow*.2})`);g.addColorStop(1,'rgba(255,102,25,0)');
        ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
      }
      motes.forEach((p,i)=>{
        const u=(ms-p.start)/p.life;if(u<=0||u>=1)return;
        const position=(v:number)=>({x:width*(.12+p.reach*v),y:height*(.53+p.spread*v*v-Math.max(0,v-.6)**2*.32+Math.sin(v*9+p.wave)*.009*v)});
        const a=position(u),b=position(Math.max(0,u-.04));
        const alpha=Math.min(u*8,1)*(1-u)**.65;
        ctx.globalAlpha=alpha*.8;ctx.lineCap='round';ctx.lineWidth=Math.max(.7,p.size*width/850);
        ctx.strokeStyle=i%4===0?'#fff1b5':i%3===0?'#ff9a4b':'#ffd078';
        ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(a.x,a.y);ctx.stroke();
        ctx.globalAlpha=alpha*.8;ctx.fillStyle=i%4===0?'#fff7d7':'#ffcb74';
        ctx.beginPath();ctx.arc(a.x,a.y,Math.max(.6,p.size*width/1200),0,Math.PI*2);ctx.fill();
      });
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      if(animated&&!paused&&!reduced&&ms<3600)frame=requestAnimationFrame(draw);
    };
    const resize=()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
    const observer=new ResizeObserver(()=>{resize();if(!frame||paused||!animated||reduced)draw();});
    observer.observe(canvas);resize();draw();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[animated,paused,elapsedMs]);
  return <canvas ref={ref} className="heat-particle-canvas" aria-hidden="true"/>;
}
