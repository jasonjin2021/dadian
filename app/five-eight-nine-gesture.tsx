'use client';

import { useState, type CSSProperties } from 'react';

type GestureProps = { animated?: boolean; elapsedMs?: number; paused?: boolean };
const descriptions = {
  eight: '5换8：左掌朝上固定不动，右手从画面右侧水平伸出，掌心朝下、五指朝左张开略弯，顺时针轻晃绕两圈',
  nine: '5换9：左掌朝上摊平，右手食指弯成钩状、其余手指收拢，短促落到左掌上方并停住',
  ten: '5换10：左掌朝上摊平，右手五指并拢、手掌侧立，用小指侧搭在左掌上形成交叉',
};

/** Eight is approved; nine and ten remain review-only until individually approved. */
function DraftExchangeGesture({ variant, animated = false, elapsedMs = 0, paused = false }: GestureProps & { variant: keyof typeof descriptions }) {
  const [startOffset] = useState(() => Math.max(0, elapsedMs));
  const style = {
    '--gesture-offset': `${-startOffset}ms`,
    '--gesture-play-state': paused ? 'paused' : 'running',
  } as CSSProperties;
  const classes = variant === 'eight' ? 'five-seven-gesture five-eight-gesture' : variant === 'ten' ? 'five-nine-gesture five-ten-gesture' : 'five-nine-gesture';
  return <div className={`five-six-gesture ${classes} ${animated ? 'is-animated' : ''}`} style={style} role="img" aria-label={descriptions[variant]}>
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

export function FiveEightGesture(props: GestureProps) { return <DraftExchangeGesture variant="eight" {...props}/>; }
export function FiveNineGesture(props: GestureProps) { return <DraftExchangeGesture variant="nine" {...props}/>; }
export function FiveTenGesture(props: GestureProps) { return <DraftExchangeGesture variant="ten" {...props}/>; }
