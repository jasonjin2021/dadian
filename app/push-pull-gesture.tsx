'use client';

import { useState, type CSSProperties } from 'react';

type GestureProps = { animated?: boolean; elapsedMs?: number; paused?: boolean };

const pullFrameUrls = ['/gestures/push-palm-v1.optimized.webp', '/gestures/pull-inbetweens-v1.optimized.webp', '/gestures/pull-grip-atlas-v1.optimized.webp', '/gestures/pull-grip-atlas-v2.optimized.webp'];
let pullFrames: Promise<HTMLImageElement[]> | undefined;

/** Decode before replay so a first-time image load cannot interrupt the fast pose changes. */
export function preloadPullFrames(): Promise<unknown> {
  pullFrames ??= Promise.all(pullFrameUrls.map(async src => {
    const frame = new Image(); frame.src = src;
    await frame.decode();
    return frame;
  })).catch(error => { pullFrames = undefined; throw error; });
  return pullFrames;
}

/** Review-only pose layers: open immediately, close through five poses, then pull back. */
function PushPullGesture({ kind, animated = false, elapsedMs = 0, paused = false }: GestureProps & { kind: 'push' | 'pull' }) {
  const [offset] = useState(() => Math.max(0, elapsedMs));
  const style = { '--gesture-offset': `${-offset}ms`, '--gesture-play-state': paused ? 'paused' : 'running' } as CSSProperties;
  return <div className={`push-pull-gesture gesture-${kind}-draft ${animated ? 'is-animated' : ''}`} style={style} role="img" aria-label={kind === 'push' ? '推：右手张开、掌心朝前，向前推出并停住' : '拉：从张手直接开始，手指连续收拢成拳，再快速拉回，没有伸手准备'}>
    <div className="push-pull-canvas" aria-hidden="true">
      <i className="push-pull-ambient"/>
      <i className="push-pull-contact"/>
      <span className="push-pull-hand">
        <i className="push-pull-pose push-pull-open"><b className="push-pull-light"/></i>
        {kind === 'pull' && <>
          <i className="push-pull-pose push-pull-quarter"><b className="push-pull-light"/></i>
          <i className="push-pull-pose push-pull-grasp"><b className="push-pull-light"/></i>
          <i className="push-pull-pose push-pull-three-quarter"><b className="push-pull-light"/></i>
          <i className="push-pull-pose push-pull-fist"><b className="push-pull-light"/></i>
        </>}
      </span>
    </div>
  </div>;
}

export function PushGesture(props: GestureProps) { return <PushPullGesture kind="push" {...props}/>; }
export function PullGesture(props: GestureProps) { return <PushPullGesture kind="pull" {...props}/>; }
