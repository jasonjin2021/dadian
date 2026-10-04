import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { advanceGame, rematch, startGame, submitDelayed, submitMain, submitRps, type ActionInput } from '@/lib/game';
import { getRoomViewer, isRoomHost, joinRoom, leaveRoom, mutateCommand, prepareRoster, roomView, saveFinishedRanking } from '@/lib/room-store';
import {isSameOriginRequest} from '@/lib/account-security';
import {phaseIsPreparing} from '@/lib/phase-clock';

async function session(){const jar=await cookies();let id=jar.get('dadian_session')?.value;if(!id){id=crypto.randomUUID();jar.set('dadian_session',id,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*30,path:'/'})}return id}
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
const privateView=(view:Awaited<ReturnType<typeof roomView>>)=>NextResponse.json(view,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function GET(_:Request,{params}:{params:Promise<{code:string}>}){try{const {code}=await params;return privateView(await roomView(code.toUpperCase(),await session()))}catch(error){return fail(error instanceof Error?error.message:'房间读取失败',404)}}
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){
  if(!isSameOriginRequest(request))return fail('请求来源无效',403);
  try{
    const {code:raw}=await params,code=raw.toUpperCase(),sid=await session();
    const body=await request.json() as {command:string;name?:string;requestId?:string;version?:number;action?:ActionInput;actions?:ActionInput[];duelId?:string;choice?:'rock'|'paper'|'scissors'};
    if(body.command==='join'){await joinRoom(code,sid,body.name??'');return privateView(await roomView(code,sid))}
    if(body.command==='leave'){await leaveRoom(code,sid);return NextResponse.json({left:true},{headers:{'Cache-Control':'private, no-store'}})}
    const viewer=await getRoomViewer(code,sid),member=viewer.member;if(!member)return fail('请先加入房间',403);
    if(typeof body.requestId!=='string'||body.requestId.length>100||!body.requestId||!Number.isInteger(body.version))return fail('提交参数不完整');
    const committed=await mutateCommand(code,sid,body.requestId,body.version!,async room=>{
      const now=Date.now(),phase=room.game.phase,round=room.game.round,deadline=room.game.deadline;
      if(['action','delayed','rps'].includes(body.command)&&phaseIsPreparing(room.game,now))throw new Error('正在同步本阶段，请等待准备倒计时结束');
      advanceGame(room.game,now);
      if(['action','delayed','rps'].includes(body.command)&&(phase!==room.game.phase||round!==room.game.round||deadline!==room.game.deadline))throw new Error('本阶段已经结束，请重新选择');
      if(body.command==='start'){
        if(!isRoomHost(room,member))throw new Error('只有房主可以开始');if(room.game.phase!=='lobby')throw new Error('对局已经开始');await prepareRoster(room);startGame(room.game,Date.now());
      }else if(body.command==='action'){
        if(member.role!=='player'||!body.action)throw new Error('当前不能出手');submitMain(room.game,member.id,body.action);
      }else if(body.command==='delayed'){
        if(member.role!=='player')throw new Error('观战者不能延判');submitDelayed(room.game,member.id,body.actions??[]);
      }else if(body.command==='rps'){
        if(!body.duelId||!['rock','paper','scissors'].includes(body.choice??''))throw new Error('请选择石头剪刀布');submitRps(room.game,member.id,body.duelId,body.choice!);
      }else if(body.command==='rematch'){
        if(!isRoomHost(room,member))throw new Error('只有房主可以重开');if(room.game.phase!=='finished')throw new Error('本局尚未结束');await saveFinishedRanking(room);await prepareRoster(room);rematch(room.game,Date.now());
      }else throw new Error('未知操作');
      advanceGame(room.game,now);
    });
    return privateView(await roomView(code,sid,{viewer,room:committed}));
  }catch(error){const message=error instanceof Error?error.message:'操作失败';return fail(message,message.includes('房间状态已更新')?409:message==='请先登录账号'?401:400)}
}
