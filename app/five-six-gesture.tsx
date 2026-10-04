'use client';

import { useState, type CSSProperties } from 'react';

/** User-approved five-to-six gesture, shared by round-end display and review. */
export function FiveSixGesture({ animated = false, elapsedMs = 0, paused = false }: {
  animated?: boolean;
  elapsedMs?: number;
  paused?: boolean;
}) {
  const [startOffset] = useState(() => Math.max(0, elapsedMs));
  const style = {
    '--gesture-offset': `${-startOffset}ms`,
    '--gesture-play-state': paused ? 'paused' : 'running',
  } as CSSProperties;
  return <div className={`five-six-gesture ${animated ? 'is-animated' : ''}`} style={style} role="img" aria-label="5换6：左掌朝上摊平，右手伸出拇指和小指比六，横放在左掌上">
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
