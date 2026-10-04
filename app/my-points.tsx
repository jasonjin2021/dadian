import {visibleSelfPoints,type PersonalBalanceView} from '@/lib/self-points';
import './my-points.css';

export function MyPoints({view}:{view:PersonalBalanceView}){
  if(view.member?.role!=='player'||!view.game.players.some(player=>player.id===view.member?.id))return null;
  const points=visibleSelfPoints(view);
  return <section className="my-point-balance" aria-label="我的对局点数">
    <div><span>我的点数</span><strong>{points??'同步中'}{points!==undefined&&<small>点</small>}</strong></div>
    <p>仅自己可见，对手点数隐藏<br/><small>对局资源，不是排行榜积分</small></p>
  </section>;
}
