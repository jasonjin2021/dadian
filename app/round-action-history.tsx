import type {PublicGame,PublicHistoryAction} from '@/lib/game';
import './round-action-history.css';

function HistoryAction({action}:{action:PublicHistoryAction}){
  const status=action.waitingForRps?'等待猜拳':action.status==='failed'?'资源不足，未执行':action.status==='skipped'?(action.id==='skip'?'跳过':'未执行'):action.status==='unknown'?'旧记录，结果请看回合记录':'已出招';
  return <li data-status={action.status}>
    <span className="history-stage">{action.stage==='main'?'主动作':'延判'}</span>
    <div><b>{action.label}</b><small>{status}{(action.burstPoints??0)>0&&<> · 爆点 {action.burstPoints}</>}</small></div>
  </li>;
}

/** Only consume the server's public execution history, never pending inputs. */
export function RoundActionHistory({game,meId}:{game:PublicGame;meId?:string}){
  if(!['priorityRps','delayed','rps'].includes(game.phase)||!game.actionHistory)return null;
  const history=game.actionHistory;
  return <section className="round-action-history" aria-labelledby="round-history-title">
    <header><h2 id="round-history-title">本回合已公开出招</h2><p>主动作已经揭晓，可据此选择延判。尚未公开的延判选择、猜拳答案和对手点数不会显示。</p></header>
    <div className="round-history-players">{history.players.map(player=>{
      const current=game.players.find(p=>p.id===player.playerId);
      const choosing=game.phase==='delayed'&&Boolean(current?.delayed)&&current?.alive&&!player.actions.some(a=>a.stage==='delayed');
      return <article key={player.playerId} data-self={player.playerId===meId}>
        <h3><span>{player.seat}号</span>{player.name}{player.playerId===meId&&<em>你</em>}</h3>
        {player.actions.length?<ul>{player.actions.map((action,index)=><HistoryAction key={`${action.stage}:${index}`} action={action}/>)}</ul>:<p className="history-pending">暂无已公开动作</p>}
        {choosing&&<p className="history-pending">{current?.confirmed?'延判已确认，内容暂不公开':'正在选择延判'}</p>}
      </article>;
    })}</div>
    <footer>“已出招”不代表命中；抵消、失效和最终伤害以服务器结算及回合记录为准。</footer>
  </section>;
}
