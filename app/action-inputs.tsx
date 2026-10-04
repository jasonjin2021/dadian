'use client';
import {useId} from 'react';
import {parseActionCount} from '@/lib/action-input';

type Target={id:string;name:string;seat:number;hp:number};
export function TargetButtons({label,targets,selected,onSelect,disabled=false}:{label:string;targets:ReadonlyArray<Target>;selected:string;onSelect:(id:string)=>void;disabled?:boolean}){
  return <fieldset className="action-targets" disabled={disabled}>
    <legend>{label}<small>点选一名玩家</small></legend>
    <div className="action-target-list">
      {targets.map(target=>{
        const chosen=target.id===selected;
        return <button type="button" className="action-target" key={target.id} aria-pressed={chosen} onClick={()=>onSelect(target.id)} aria-label={`${target.seat}号 ${target.name}，${target.hp}血${chosen?'，已选中':''}`}>
          <span className="action-target-seat">{target.seat}号</span>
          <span className="action-target-player"><b>{target.name}</b><small>血量 {target.hp}</small></span>
          <span className="action-target-check" aria-hidden="true">{chosen?'✓ 已选':'选择'}</span>
        </button>;
      })}
    </div>
    {!targets.length&&<p className="action-target-empty">当前没有可选择的其他存活玩家</p>}
  </fieldset>;
}

export function QuantityInput({label,value,limit,onChange,disabled=false}:{label:string;value:string;limit:number;onChange:(value:string)=>void;disabled?:boolean}){
  const id=useId(),result=parseActionCount(value,limit);
  return <label className="action-quantity" htmlFor={id}>
    <span>{label}（最多 {limit}）</span>
    <input id={id} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={value} placeholder="输入数量" disabled={disabled} aria-invalid={!result.valid} aria-describedby={`${id}-hint`} onChange={event=>onChange(event.target.value)}/>
    <small id={`${id}-hint`} className={result.valid?'quantity-hint':'quantity-error'} role="status">{result.valid?'可清空后重新输入':result.message}</small>
  </label>;
}
