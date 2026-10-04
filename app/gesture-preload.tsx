'use client';

import {useEffect} from 'react';

// Only artwork used by current gestures. Retired drafts and reference sheets
// stay available in public/ but are not downloaded by this warm-up.
export const GESTURE_PRELOAD_URLS=[
  'accumulate-fists-v2',
  'five6-hands-v2','five6-hands-sleeved-v3',
  'five7-cupped-hand-sleeved-v2','five8-right-entry-hand-v3',
  'five9-hook-hand-v2','five10-side-hand-v1',
  'push-palm-v1','pull-inbetweens-v1','pull-grip-atlas-v1','pull-grip-atlas-v2',
  'gun-ak47-v1','mass-taichi-poses-v1',
  'punch-fist-v1','raise-fist-front-v2','snap-hand-together-v3','guard-backs-v2',
  'golden-angel-wings-v1','heat-flame-v1','convert-blind-box-cutout-v2','ice-cutout-v2',
  'super-palms-flat-v3','super-palms-mid-v3','super-palms-curved-v2',
  'friction-far-hand-v3','friction-near-hand-v3',
].map(name=>`/gestures/${name}.optimized.webp`);

type Connection=EventTarget&{saveData?:boolean};
const connection=()=>((navigator as Navigator&{connection?:Connection}).connection);
const consumers=new Set<symbol>(),attempted=new Set<string>();
let running:Promise<void>|undefined,controller:AbortController|undefined;
let propModule:Promise<unknown>|undefined;

function idle(signal:AbortSignal):Promise<boolean>{
  return new Promise(resolve=>{
    if(signal.aborted){resolve(false);return;}
    const usingIdle=typeof window.requestIdleCallback==='function';
    const finish=()=>{signal.removeEventListener('abort',abort);resolve(!signal.aborted);};
    const abort=()=>{if(usingIdle)window.cancelIdleCallback(handle);else window.clearTimeout(handle);finish();};
    signal.addEventListener('abort',abort,{once:true});
    const handle=usingIdle?window.requestIdleCallback(finish,{timeout:1500}):window.setTimeout(finish,250);
  });
}

async function warm(signal:AbortSignal){
  const allowed=()=>!signal.aborted&&consumers.size>0&&!connection()?.saveData;
  for(const url of GESTURE_PRELOAD_URLS){
    if(!allowed())return;
    if(attempted.has(url))continue;
    if(!await idle(signal)||!allowed())return;
    try{
      // A single low-priority download warms the browser HTTP cache. Do not
      // retain 26 decoded full-size images in mobile memory.
      const response=await fetch(url,{signal,cache:'force-cache',priority:'low'});
      if(response.ok)await response.arrayBuffer();
      attempted.add(url);
    }catch{
      // Cancellation may resume in a later lobby; ordinary failures are tried
      // only once per page so repeated rounds never produce a retry storm.
      if(!signal.aborted)attempted.add(url);
    }
  }
  if(allowed()&&await idle(signal)&&allowed()){
    // Importing the module does not create a WebGL context or render a scene.
    // Module loading cannot be aborted once started; launch it only once.
    propModule??=import('./prop-effects').catch(()=>undefined);
    await propModule;
  }
}

function start(){
  if(running||consumers.size===0||connection()?.saveData)return;
  const next=new AbortController();controller=next;
  running=warm(next.signal).catch(()=>undefined).finally(()=>{
    running=undefined;
    if(controller===next)controller=undefined;
    if(consumers.size>0&&next.signal.aborted)start();
  });
}

/** Enable while waiting in the lobby. Turning it off cancels pending downloads. */
export function useGesturePreload(enabled:boolean){
  useEffect(()=>{
    if(!enabled)return;
    const token=Symbol('gesture-preload'),network=connection();
    const sync=()=>{
      if(network?.saveData){consumers.delete(token);if(consumers.size===0)controller?.abort();}
      else{consumers.add(token);start();}
    };
    sync();network?.addEventListener('change',sync);
    return()=>{network?.removeEventListener('change',sync);consumers.delete(token);if(consumers.size===0)controller?.abort();};
  },[enabled]);
}
