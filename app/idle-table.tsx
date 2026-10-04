'use client';
import {useEffect,useState} from 'react';
import {RenderedAccumulateGesture} from './accumulate-rendered-gesture';

/** Decorative idle motion never submits or reveals a player's action. */
export function useIdleMotion(){
  const [enabled,setEnabled]=useState(true),[visible,setVisible]=useState(true);
  useEffect(()=>{
    try{setEnabled(localStorage.getItem('dadian:idle-motion')!=='off');}catch{/* Optional preference only. */}
    const update=()=>setVisible(!document.hidden);update();document.addEventListener('visibilitychange',update);
    return()=>document.removeEventListener('visibilitychange',update);
  },[]);
  function toggle(){setEnabled(old=>{const next=!old;try{localStorage.setItem('dadian:idle-motion',next?'on':'off');}catch{/* Keep the session setting. */}return next;});}
  return{enabled,running:enabled&&visible,toggle};
}

export function IdleTable(){return <div className="idle-table" role="img" aria-label="桌面演示：两只拳头在墨绿色桌布上轻轻浮动，不代表正在出招">
  <div className="idle-table-rim"><div className="idle-table-cloth"><span className="idle-table-stitch"/><div className="idle-hands ambient-loop"><RenderedAccumulateGesture/></div><span className="idle-table-word">打 点</span></div></div>
  <div className="idle-seat idle-seat-far"><i className="ambient-loop"/><span>朋友</span></div><div className="idle-seat idle-seat-near"><i className="ambient-loop"/><span>你</span></div>
  <span className="idle-table-caption">桌面演示</span>
</div>}
