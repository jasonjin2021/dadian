'use client';

import { useState, type CSSProperties } from 'react';

/** Approval-only catching hand circles twice above a stationary support palm. */
export function FiveSevenGesture({ animated = false, elapsedMs = 0, paused = false }: {
  animated?: boolean;
  elapsedMs?: number;
  paused?: boolean;
}) {
  const [startOffset] = useState(() => Math.max(0, elapsedMs));
  const style = {
    '--gesture-offset': `${-startOffset}ms`,
    '--gesture-play-state': paused ? 'paused' : 'running',
  } as CSSProperties;
  return <div className={`five-six-gesture five-seven-gesture ${animated ? 'is-animated' : ''}`} style={style} role="img" aria-label="5换7：左掌朝上固定不动，右手五指张开略微弯曲，保持托举姿势在水平面顺时针轻晃绕两圈">
    <div className="five-six-canvas" aria-hidden="true">
      <span className="five-six-ambient"/>
      <span className="five-six-palm">
        <i className="five-six-sprite five-six-sprite-palm"/>
        <i className="five-six-palm-far-shadow five-six-mask-palm"/>
        <i className="five-six-palm-shade five-six-mask-palm"/>
        <i className="five-six-palm-rim five-six-mask-palm"/>
      </span>
      <span className="five-six-contact"/>
      <span className="five-six-hand">
        <i className="five-six-sprite five-six-sprite-hand"/>
        <i className="five-six-hand-light five-six-mask-hand"/>
      </span>
    </div>
  </div>;
}
