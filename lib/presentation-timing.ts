/** A mounted effect owns its animation clock. Only seeking/end should replace it. */
export function presentationOffset(initialMs:number,currentMs:number,finished:boolean,paused:boolean){
  const candidate=finished?5000:paused?currentMs:initialMs;
  return Math.min(5000,Math.max(0,Number.isFinite(candidate)?candidate:0));
}
