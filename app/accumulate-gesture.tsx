'use client';

import { useId, useState, type CSSProperties } from 'react';

/** The actor's right fist is above the left; screen-left is the actor's right. */
export function AccumulateGesture({ animated = false, elapsedMs = 0, paused = false, decorative = false, className = '' }: {
  animated?: boolean;
  elapsedMs?: number;
  paused?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  // Capture the server phase offset once. Updating this every poll would accelerate CSS animations.
  const [startOffset] = useState(() => Math.max(0, elapsedMs));
  const style = {
    '--gesture-offset': `${-startOffset}ms`,
    '--gesture-play-state': paused ? 'paused' : 'running',
  } as CSSProperties;
  const hand = <>
    <path className="accumulate-hand" fill={`url(#${id}-skin)`} d="M24 43 35 32 38 20Q40 9 51 9q7-9 19-3 11-5 22 3 12-2 18 10l7 25q4 15-7 27l-17 12-43-4-26-5Z"/>
    <path className="accumulate-crease" d="m52 13 2 25m16-27 2 27m16-22 3 24m14-16 4 20M36 48q10-8 22-6m-17 24 13 2"/>
    <path className="accumulate-thumb" fill={`url(#${id}-thumb)`} d="M55 45q3-8 12-6l34 8q12 3 9 13-2 8-12 9L64 59q-10-3-9-14Z"/>
    <path className="accumulate-highlight" d="m44 22 4-5m12-3 6-1m11 1 5 2m-20 32 32 8"/>
  </>;
  return <svg className={`accumulate-gesture ${animated ? 'is-animated' : ''} ${className}`} style={style} viewBox="0 0 400 300" fill="none" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : '积点：右拳在上、左拳在下，在胸前上下相碰'}>
    <defs>
      <linearGradient id={`${id}-skin`} x1="40" y1="6" x2="94" y2="84" gradientUnits="userSpaceOnUse"><stop stopColor="#ffddbb"/><stop offset=".54" stopColor="#eab286"/><stop offset="1" stopColor="#bd795a"/></linearGradient>
      <linearGradient id={`${id}-thumb`} x1="71" y1="40" x2="83" y2="69" gradientUnits="userSpaceOnUse"><stop stopColor="#fbd2aa"/><stop offset="1" stopColor="#d79470"/></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#8effec" stopOpacity=".75"/><stop offset="1" stopColor="#56ebdf" stopOpacity="0"/></radialGradient>
    </defs>
    <g className="accumulate-energy" aria-hidden="true">
      <ellipse className="accumulate-flash" cx="194" cy="153" rx="70" ry="26" fill={`url(#${id}-glow)`}/>
      <ellipse className="accumulate-ring accumulate-ring-one" cx="194" cy="153" rx="56" ry="15"/>
      <ellipse className="accumulate-ring accumulate-ring-two" cx="194" cy="153" rx="56" ry="15"/>
    </g>
    <g className="accumulate-left">
      <g transform="translate(266 150) scale(-1 1)">
        <path className="accumulate-sleeve" d="m-51 63 73-31 14 43-72 41Z"/>
        <path className="accumulate-cuff" d="m10 36 17-6 15 45-17 9Z"/>
        {hand}
      </g>
    </g>
    <g className="accumulate-right">
      <g transform="translate(115 55)">
        <path className="accumulate-sleeve" d="m-65 87 85-48 19 37-83 55Z"/>
        <path className="accumulate-cuff" d="m7 45 19-10 19 39-18 12Z"/>
        {hand}
      </g>
    </g>
    <path className="accumulate-impact" d="m128 152-14-3m18 13-10 6m138-17 14-4m-17 13 12 6"/>
  </svg>;
}
