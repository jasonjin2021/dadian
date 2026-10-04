'use client';
import {useEffect,useState} from 'react';
import {RoomScreen,type View,type ClockAnchor} from '../room-client';
import {PHASE_SECONDS,type ActionId,type PublicGame} from '@/lib/game';

type PreviewPhase='lobby'|'main'|'delayed'|'reveal';
type PreviewGroup='approved'|'combat';
const names=['你','小林','阿泽','十一','橘子','大白'];
function sampleView(phase:PreviewPhase,count:number,round:number,group:PreviewGroup):View{
  const players:PublicGame['players']=names.slice(0,count).map((name,i)=>({id:`sample-${i}`,name,seat:i+1,hp:i===1?8:10,fists:3,shields:group==='combat'&&(i===2||i===3)?2:i===0?1:0,waters:i===1?1:0,cotton:0,kills:0,alive:true,confirmed:phase==='main'&&i>0&&i%2===1}));
  const choices:Array<{id:ActionId;label:string;targetId?:string;count?:number}>=group==='combat'?[
    {id:'gun',label:'枪 → 小林',targetId:'sample-1',count:1},
    {id:'fly',label:'飞'},
    {id:'smallShield',label:'举盾 ×2',count:2},
    {id:'bigShield',label:'举大盾 ×2',count:2},
    {id:'super',label:'Super → 小林',targetId:'sample-1'},
    {id:'smallHeal',label:'小治疗'},
  ]:[{id:'accumulate',label:'积点'},{id:'five6',label:'5换6'},{id:'pull',label:'拉'},{id:'push',label:'推'},{id:'five8',label:'5换8'},{id:'cotton',label:'纺棉'}];
  const game:PublicGame={match:1,round:phase==='lobby'?0:round,phase,deadline:null,players,confirmed:players.filter(p=>p.confirmed).length,required:count,winnerIds:[],rps:[],resourceEvents:[],events:phase==='lobby'?[]:['界面演示 · 此处显示公开结算记录','界面演示 · 不展示点数余额或账本']};
  if(phase==='delayed'){
    players[0].delayed={kind:'small',budget:3,max:2};
    if(players[1])players[1].delayed={kind:'fist',budget:1,max:1};
    const mainMoves:Array<{id:ActionId;label:string;targetId?:string;count?:number}>=[{id:'smallShield',label:'举盾'},{id:'raiseFist',label:'举拳'},{id:'gun',label:'枪 ×3 → 你',targetId:'sample-0',count:3},{id:'five7',label:'5换7'},{id:'pull',label:'拉 → 小林',targetId:'sample-1'},{id:'smallHeal',label:'小治疗'}];
    game.required=2;game.confirmed=0;
    game.actionHistory={round,players:players.map((p,i)=>({playerId:p.id,name:p.name,seat:p.seat,actions:[{...mainMoves[i],stage:'main',status:'played',burstPoints:i===4?2:undefined}]}))};
    game.events.unshift('界面演示 · 主动作已公开，尚未执行的延判动作继续保密');
  }
  if(phase==='reveal')game.reveal={round,actions:players.map((p,i)=>({playerId:p.id,name:p.name,mainId:choices[i].id,main:choices[i].label,targetId:choices[i].targetId,delayed:[],entries:[{...choices[i],stage:'main',burstPoints:group==='approved'&&i===3?2:0,status:'played'}]})),hpChanges:[],highlights:[group==='combat'?'界面演示 · 仅验证发动视觉，不模拟伤害、回血或胜负':'界面演示 · 这里只展示已通过的动作，不进行结算'],finish:false};
  return{code:'DEMO26',version:round,serverNow:0,host:true,member:{id:'sample-0',name:'你',seat:1,role:'player'},selfPoints:{playerId:'sample-0',points:phase==='lobby'?0:6},game,canStart:count>=2,canRematch:false};
}

export default function InterfaceReview(){
  const [phase,setPhase]=useState<PreviewPhase>('main'),[group,setGroup]=useState<PreviewGroup>('approved'),[count,setCount]=useState(6),[round,setRound]=useState(1),[snapshot,setSnapshot]=useState<{view:View;anchor:ClockAnchor}|null>(null),[note,setNote]=useState('');
  useEffect(()=>{
    const now=Date.now(),view=sampleView(phase,count,round,group);view.serverNow=now;view.game.deadline=phase==='lobby'?null:now+PHASE_SECONDS[phase]*1000;
    setSnapshot({view,anchor:{serverNow:now,receivedAt:performance.now(),version:round}});
    // This is an explicit UI demonstration, not a local replacement rules engine.
    const timer=phase==='main'?setTimeout(()=>{setPhase('reveal');setRound(n=>n+1);},PHASE_SECONDS.main*1000):undefined;
    return()=>clearTimeout(timer);
  },[phase,count,round,group]);
  if(!snapshot)return <main className="loading-screen"><p>准备界面预览…</p></main>;
  function choose(next:PreviewPhase){setPhase(next);setRound(n=>n+1);setNote('');}
  function chooseGroup(next:PreviewGroup){setGroup(next);choose('reveal');}
  async function command(c:string){if(c==='start'){choose('main');return true;}setNote('演示中已确认。真实房间会隐藏动作并等待所有人出手。');setSnapshot(old=>old?{...old,view:{...old.view,game:{...old.view.game,confirmed:old.view.game.confirmed+1,players:old.view.game.players.map(p=>p.id==='sample-0'?{...p,confirmed:true}:p)}}}:old);return true;}
  const tools=<div className="interface-review-tools"><span>界面预览 · 虚构玩家，不是真实对局</span><a href="/">返回大厅</a>{([{id:'approved',name:'已通过手势'},{id:'combat',name:'枪·盾·飞验收'}] as const).map(g=><button key={g.id} type="button" aria-pressed={group===g.id} onClick={()=>chooseGroup(g.id)}>{g.name}</button>)}{([{id:'lobby',name:'等待室'},{id:'main',name:'选择动作'},{id:'delayed',name:'延判出招'},{id:'reveal',name:'回合展示'}] as const).map(p=><button key={p.id} type="button" aria-pressed={phase===p.id} onClick={()=>choose(p.id)}>{p.name}</button>)}<button type="button" onClick={()=>choose('reveal')}>回放</button>{[2,3,4,5,6].map(n=><button key={n} type="button" aria-pressed={count===n} onClick={()=>{setCount(n);setRound(r=>r+1);}}>{n}人</button>)}<small>{phase==='delayed'?'延判预览展示已结算的主动作，不公开待执行的延判选择。':group==='combat'?'枪指向飞的玩家；小盾和大盾各两面。治疗只展示发动，不演示回血或胜负。':'选择动作演示'+PHASE_SECONDS.main+'秒后展示手势。'}展示结束停留，可用回放按钮重播；支持2至6人。音效在此预览中关闭。{note}</small></div>;
  return <RoomScreen key={`${group}:${phase}:${count}:${round}`} code="DEMO26" view={snapshot.view} anchor={snapshot.anchor} busy={false} error="" command={command} audio={{enabled:false,status:'',toggle:async()=>setNote('界面预览不播放声音，请在结算配音清单试听。')}} previewTools={tools}/>;
}
