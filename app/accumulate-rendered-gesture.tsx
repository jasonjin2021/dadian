'use client';

import { useState, type CSSProperties } from 'react';

/** Refinement preview: two vertical fist taps, with contact-aligned layered lighting. */
export function RenderedAccumulateGesture({ animated = false, elapsedMs = 0, paused = false }: {
  animated?: boolean;
  elapsedMs?: number;
  paused?: boolean;
}) {
  const [startOffset] = useState(() => Math.max(0, elapsedMs));
  const style = {
    '--gesture-offset': `${-startOffset}ms`,
    '--gesture-play-state': paused ? 'paused' : 'running',
  } as CSSProperties;
  return <div className={`accumulate-rendered ${animated ? 'is-animated' : ''}`} style={style} role="img" aria-label="积点：右拳在上，左拳在下，上下碰拳两次；每次接触时出现青色光波">
    <div className="accumulate-rendered-canvas" aria-hidden="true">
      <span className="accumulate-rendered-ambient"/>
      <span className="accumulate-rendered-lower">
        <i className="accumulate-rendered-sprite accumulate-rendered-sprite-lower"/>
        <i className="accumulate-rendered-far-shadow accumulate-rendered-mask-lower"/>
        <i className="accumulate-rendered-shadow accumulate-rendered-mask-lower"/>
        <i className="accumulate-rendered-lower-light accumulate-rendered-mask-lower"/>
      </span>
      <span className="accumulate-rendered-upper">
        <i className="accumulate-rendered-sprite accumulate-rendered-sprite-upper"/>
        <i className="accumulate-rendered-upper-light accumulate-rendered-mask-upper"/>
      </span>
      {[650, 1350].map(time => <span className="accumulate-rendered-impact" key={time} style={{ '--impact-delay': `${time}ms` } as CSSProperties}>
        <i className="accumulate-rendered-contact"/>
        <i className="accumulate-rendered-ring accumulate-rendered-ring-one"/>
        <i className="accumulate-rendered-ring accumulate-rendered-ring-two"/>
      </span>)}
    </div>
  </div>;
}
