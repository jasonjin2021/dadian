import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cleanupOldRooms, createRoom, roomView } from '@/lib/room-store';
import {isSameOriginRequest} from '@/lib/account-security';

async function session(){const jar=await cookies();let id=jar.get('dadian_session')?.value;if(!id){id=crypto.randomUUID();jar.set('dadian_session',id,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*30,path:'/'})}return id}
export async function POST(request:Request){
  if(!isSameOriginRequest(request))return NextResponse.json({error:'请求来源无效'},{status:403});
  try{const body=await request.json() as {name?:string};const sid=await session();await cleanupOldRooms().catch(()=>undefined);const room=await createRoom(sid,body.name??'');return NextResponse.json(await roomView(room.code,sid),{status:201,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'创建房间失败'},{status:400})}
}
