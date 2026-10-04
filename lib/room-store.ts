import 'server-only';
import {env} from 'cloudflare:workers';
import {advanceGame,createGame,publicGame,selfVoice,type GameState,type PublicGame} from './game';
import {accountForSession,recordMatchResults,type PublicAccount} from './account-store';
import {phaseClockKey,synchronizeNewPhase} from './phase-clock';
import type {VoiceCue} from './round-feedback';

export interface Member{id:string;roomCode:string;sessionId:string;accountId:string|null;name:string;seat:number|null;role:'player'|'spectator';joinedAt:number;lastSeenAt:number;leftAt:number|null}
type StoredGame=GameState&{accountIds?:Record<string,string>;rankingKey?:string;ranked?:boolean;membershipNonce?:string};
export interface RoomRecord{code:string;status:string;hostSessionId:string;version:number;game:StoredGame;createdAt:number;updatedAt:number}
export interface RoomView{code:string;version:number;serverNow:number;host:boolean;member:Pick<Member,'id'|'name'|'seat'|'role'>|null;account:PublicAccount|null;game:PublicGame;selfPoints?:{playerId:string;points:number};selfVoice?:VoiceCue;canStart:boolean;canRematch:boolean;ranked:boolean}
let schemaReady:Promise<void>|null=null;
function db(){if(!env.DB)throw new Error('D1 数据库暂不可用');return env.DB}
export function ensureSchema(){
  schemaReady??=(async()=>{
    const d=db();await d.batch([
      d.prepare(`CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY,status TEXT NOT NULL DEFAULT 'lobby',host_session_id TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,state_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at)'),
      d.prepare(`CREATE TABLE IF NOT EXISTS room_members (id TEXT PRIMARY KEY,room_code TEXT NOT NULL,session_id TEXT NOT NULL,name TEXT NOT NULL,seat INTEGER,role TEXT NOT NULL,joined_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,account_id TEXT,left_at INTEGER)`),
      d.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uq_room_members_room_session ON room_members(room_code,session_id)'),
      d.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uq_room_members_room_seat ON room_members(room_code,seat)'),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_code)'),
      d.prepare('CREATE TABLE IF NOT EXISTS room_events (id INTEGER PRIMARY KEY AUTOINCREMENT,room_code TEXT NOT NULL,match_number INTEGER NOT NULL,round_number INTEGER NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL)'),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_room_events_room_created ON room_events(room_code,created_at)'),
      d.prepare('CREATE TABLE IF NOT EXISTS idempotency_keys (key TEXT PRIMARY KEY,room_code TEXT NOT NULL,session_id TEXT NOT NULL,created_at INTEGER NOT NULL)'),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at)'),
    ]);
    for(const [column,type] of [['account_id','TEXT'],['left_at','INTEGER']]){
      const columns=await d.prepare('PRAGMA table_info(room_members)').all<{name:string}>();
      if(!columns.results.some(c=>c.name===column))try{await d.prepare(`ALTER TABLE room_members ADD COLUMN ${column} ${type}`).run();}catch(error){
        const fresh=await d.prepare('PRAGMA table_info(room_members)').all<{name:string}>();if(!fresh.results.some(c=>c.name===column))throw error;
      }
    }
    await d.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uq_room_account ON room_members(room_code,account_id) WHERE account_id IS NOT NULL').run();
  })().catch(error=>{schemaReady=null;throw error;});return schemaReady;
}
const codeChars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){return Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>codeChars[x%codeChars.length]).join('')}
function parseRoom(r:Record<string,unknown>):RoomRecord{return{code:String(r.code),status:String(r.status),hostSessionId:String(r.host_session_id),version:Number(r.version),game:JSON.parse(String(r.state_json)) as StoredGame,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at)}}
function parseMember(r:Record<string,unknown>):Member{return{id:String(r.id),roomCode:String(r.room_code),sessionId:String(r.session_id),accountId:r.account_id?String(r.account_id):null,name:String(r.name),seat:r.seat===null?null:Number(r.seat),role:r.role as Member['role'],joinedAt:Number(r.joined_at),lastSeenAt:Number(r.last_seen_at),leftAt:r.left_at==null?null:Number(r.left_at)}}
export async function getRoom(code:string){await ensureSchema();const r=await db().prepare('SELECT * FROM rooms WHERE code=?').bind(code.toUpperCase()).first<Record<string,unknown>>();return r?parseRoom(r):null}
export async function getMembers(code:string){await ensureSchema();const r=await db().prepare('SELECT * FROM room_members WHERE room_code=? AND left_at IS NULL ORDER BY CASE WHEN seat IS NULL THEN 99 ELSE seat END,joined_at,id').bind(code.toUpperCase()).all<Record<string,unknown>>();return r.results.map(parseMember)}
async function findMemberByIdentity(code:string,sid:string,accountId:string|null,includeLeft=false){
  const r=await db().prepare(`SELECT * FROM room_members WHERE room_code=? AND ${accountId?'account_id=?':'session_id=? AND account_id IS NULL'} ${includeLeft?'':'AND left_at IS NULL'}`).bind(code.toUpperCase(),accountId??sid).first<Record<string,unknown>>();return r?parseMember(r):null;
}
async function findMember(code:string,sid:string,includeLeft=false){
  await ensureSchema();const account=await accountForSession(sid);
  return findMemberByIdentity(code,sid,account?.id??null,includeLeft);
}
export async function getMember(code:string,sid:string){return findMember(code,sid)}
export function isRoomHost(room:RoomRecord,member:Member|null){return Boolean(member&&member.sessionId===room.hostSessionId)}
export async function saveFinishedRanking(room:RoomRecord){
  const g=room.game;if(!g.ranked||!g.rankingKey||!(g.phase==='finished'||g.reveal?.finish))return;
  await recordMatchResults(`${room.code}:${g.rankingKey}`,g.match,g.players.flatMap(p=>{
    const accountId=g.accountIds?.[p.id];return accountId?[{accountId,outcome:g.winnerIds.includes(p.id)?'win' as const:g.winnerIds.length===0?'draw' as const:'loss' as const,kills:p.kills,forfeit:false}]:[];
  }));
}
function updateStatement(room:RoomRecord,now:number){return db().prepare('UPDATE rooms SET status=?,host_session_id=?,state_json=?,version=version+1,updated_at=? WHERE code=? AND version=?').bind(room.game.phase==='lobby'?'lobby':room.game.phase==='finished'?'finished':'playing',room.hostSessionId,JSON.stringify(room.game),now,room.code,room.version)}
function markCommitted(room:RoomRecord,now:number){room.version+=1;room.updatedAt=now;room.status=room.game.phase==='lobby'?'lobby':room.game.phase==='finished'?'finished':'playing';return room;}
export async function mutateRoom<T>(code:string,fn:(room:RoomRecord)=>Promise<T>|T):Promise<T>{
  for(let attempt=0;attempt<8;attempt++){const room=await getRoom(code);if(!room)throw new Error('房间不存在');const previousPhase=phaseClockKey(room.game),result=await fn(room),now=Date.now();synchronizeNewPhase(previousPhase,room.game,now);const saved=await updateStatement(room,now).run();if(Number(saved.meta.changes)>0){markCommitted(room,now);await saveFinishedRanking(room);return result;}}
  throw new Error('房间状态已更新，请重新确认');
}
// The state and request key commit atomically; failed actions never consume a key.
export async function mutateCommand(code:string,sid:string,requestId:string,version:number,fn:(room:RoomRecord)=>Promise<void>|void){
  await ensureSchema();const key=`${code}:${sid}:${requestId}`;
  if(await db().prepare('SELECT key FROM idempotency_keys WHERE key=?').bind(key).first())return;
  const room=await getRoom(code);if(!room)throw new Error('房间不存在');if(room.version!==version)throw new Error('房间状态已更新，请重新确认');
  const previousPhase=phaseClockKey(room.game);await fn(room);const nonce=crypto.randomUUID(),now=Date.now();synchronizeNewPhase(previousPhase,room.game,now);room.game.membershipNonce=nonce;
  const [saved]=await db().batch([updateStatement(room,now),db().prepare(`INSERT OR IGNORE INTO idempotency_keys (key,room_code,session_id,created_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE code=? AND json_extract(state_json,'$.membershipNonce')=?)`).bind(key,code,sid,now,code,nonce)]);
  if(!Number(saved.meta.changes)){if(await db().prepare('SELECT key FROM idempotency_keys WHERE key=?').bind(key).first())return;throw new Error('房间状态已更新，请重新确认');}
  markCommitted(room,now);await saveFinishedRanking(room);return room;
}
function memberPlayer(m:Member){return{id:m.id,name:m.name,seat:m.seat!,hp:10,points:0,fists:3,shields:0,waters:0,cotton:0,kills:0,alive:true,confirmed:false}}
export async function createRoom(sid:string,_name:string){
  await ensureSchema();const account=await accountForSession(sid);if(!account)throw new Error('请先登录账号');
  for(let attempt=0;attempt<8;attempt++){
    const code=newCode(),now=Date.now(),id=crypto.randomUUID(),game=createGame([{id,name:account.username,seat:1}]);
    try{await db().batch([
      db().prepare('INSERT INTO rooms (code,status,host_session_id,version,state_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(code,'lobby',sid,1,JSON.stringify(game),now,now),
      db().prepare('INSERT INTO room_members (id,room_code,session_id,name,seat,role,joined_at,last_seen_at,account_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,code,sid,account.username,1,'player',now,now,account.id),
    ]);return{code};}catch(error){if(attempt===7)throw error;}
  }throw new Error('暂时无法生成房间码');
}
export async function joinRoom(code:string,sid:string,_name:string){
  code=code.toUpperCase();await ensureSchema();const account=await accountForSession(sid);if(!account)throw new Error('请先登录账号');
  for(let attempt=0;attempt<8;attempt++){
    const old=await findMemberByIdentity(code,sid,account.id,true);if(old&&old.leftAt===null)return old;
    const room=await getRoom(code);if(!room)throw new Error('房间不存在');const members=await getMembers(code),taken=new Set(members.map(m=>m.seat));let seat:number|null=null;
    if(room.game.phase==='lobby'||room.game.phase==='finished')for(let n=1;n<=6;n++)if(!taken.has(n)){seat=n;break;}
    const now=Date.now(),m:Member={id:old?.id??crypto.randomUUID(),roomCode:code,sessionId:old?.sessionId??sid,accountId:account.id,name:account.username,seat,role:seat?'player':'spectator',joinedAt:old?.joinedAt??now,lastSeenAt:now,leftAt:null};
    if(room.game.phase==='lobby'&&seat&&!room.game.players.some(p=>p.id===m.id))room.game.players.push(memberPlayer(m));
    if(!members.length||!room.hostSessionId)room.hostSessionId=m.sessionId;
    const nonce=crypto.randomUUID();room.game.membershipNonce=nonce;
    try{
      const [saved]=await db().batch([updateStatement(room,now),db().prepare(`INSERT INTO room_members (id,room_code,session_id,name,seat,role,joined_at,last_seen_at,account_id,left_at) SELECT ?,?,?,?,?,?,?,?,?,NULL WHERE EXISTS(SELECT 1 FROM rooms WHERE code=? AND json_extract(state_json,'$.membershipNonce')=?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,seat=excluded.seat,role=excluded.role,last_seen_at=excluded.last_seen_at,left_at=NULL`).bind(m.id,code,m.sessionId,m.name,m.seat,m.role,m.joinedAt,now,m.accountId,code,nonce)]);
      if(Number(saved.meta.changes))return m;
    }catch(error){if(attempt===7)throw error;}
  }throw new Error('加入房间失败，请重试');
}
export async function leaveRoom(code:string,sid:string){
  for(let attempt=0;attempt<8;attempt++){
    const member=await getMember(code,sid);if(!member)return;
    const room=await getRoom(code);if(!room)return;const previousPhase=phaseClockKey(room.game);advanceGame(room.game,Date.now());
    if(member.role==='player'&&room.game.phase!=='lobby'&&room.game.phase!=='finished')throw new Error('请在整局结束后退出房间');
    if(room.game.phase==='lobby')room.game.players=room.game.players.filter(p=>p.id!==member.id);
    const others=(await getMembers(code)).filter(m=>m.id!==member.id);
    if(isRoomHost(room,member))room.hostSessionId=others.find(m=>m.role==='player')?.sessionId??others[0]?.sessionId??'';
    const nonce=crypto.randomUUID(),now=Date.now();synchronizeNewPhase(previousPhase,room.game,now);room.game.membershipNonce=nonce;
    const [saved]=await db().batch([updateStatement(room,now),db().prepare(`UPDATE room_members SET left_at=?,seat=NULL WHERE id=? AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND json_extract(state_json,'$.membershipNonce')=?)`).bind(now,member.id,code,nonce)]);
    if(Number(saved.meta.changes)){await saveFinishedRanking(room);return;}
  }throw new Error('房间状态已更新，请重新确认');
}
export async function prepareRoster(room:RoomRecord){
  const members=(await getMembers(room.code)).filter(m=>m.role==='player');if(members.length<2)throw new Error('至少需要2名玩家');
  room.game.players=members.map(memberPlayer);
  room.game.accountIds=Object.fromEntries(members.filter(m=>m.accountId).map(m=>[m.id,m.accountId!]));
  room.game.rankingKey=crypto.randomUUID();room.game.ranked=members.every(m=>Boolean(m.accountId));
}
export async function tickRoom(code:string){
  for(let attempt=0;attempt<8;attempt++){
    const room=await getRoom(code);if(!room)throw new Error('房间不存在');const before=JSON.stringify(room.game),previousPhase=phaseClockKey(room.game);advanceGame(room.game,Date.now());
    if(before===JSON.stringify(room.game)){await saveFinishedRanking(room);return room;}
    const now=Date.now();synchronizeNewPhase(previousPhase,room.game,now);
    const saved=await updateStatement(room,now).run();
    if(Number(saved.meta.changes)){markCommitted(room,now);await saveFinishedRanking(room);return room;}
  }
  throw new Error('房间状态已更新，请重新确认');
}
export interface RoomViewer{account:PublicAccount|null;member:Member|null;members:Member[]}
// A prepared viewer is request-local authentication, not a cache shared across users or rooms.
// Only the original server-created object can be reused, and only once for its authenticated scope.
const viewerScopes=new WeakMap<RoomViewer,{code:string;sid:string}>();
export async function getRoomViewer(code:string,sid:string):Promise<RoomViewer>{
  code=code.toUpperCase();
  await ensureSchema();const account=await accountForSession(sid);
  const [member,members]=await Promise.all([
    findMemberByIdentity(code,sid,account?.id??null).then(async member=>{if(member)await db().prepare('UPDATE room_members SET last_seen_at=? WHERE id=?').bind(Date.now(),member.id).run();return member;}),
    getMembers(code),
  ]);
  const viewer={account,member,members};viewerScopes.set(viewer,{code,sid});return viewer;
}
export async function roomView(code:string,sid:string,prepared?:{viewer?:RoomViewer;room?:RoomRecord}):Promise<RoomView>{
  // Authentication, seat lookup, and heartbeat run before a possible phase start.
  // A just-committed POST may reuse both snapshots without another database trip.
  code=code.toUpperCase();const scope=prepared?.viewer?viewerScopes.get(prepared.viewer):undefined;
  const viewer=prepared?.viewer&&scope?.code===code&&scope.sid===sid?prepared.viewer:await getRoomViewer(code,sid);
  viewerScopes.delete(viewer);
  const {account,members}=viewer,candidate=viewer.member;
  const member=candidate&&candidate.roomCode===code&&candidate.leftAt===null&&(candidate.accountId?candidate.accountId===account?.id:!account&&Boolean(sid)&&candidate.sessionId===sid)?candidate:null;
  const room=prepared?.room?.code===code?prepared.room:await tickRoom(code);
  // A host has no extra visibility. Dead players retain their own identity and balance;
  // spectators, departed members, and replacement seats absent from this match get none.
  const ownPlayer=member?.role==='player'&&member.seat!==null?room.game.players.find(p=>p.id===member.id&&p.seat===member.seat):undefined;
  const selfPoints=ownPlayer&&Number.isFinite(ownPlayer.points)?{playerId:ownPlayer.id,points:ownPlayer.points}:undefined;
  return{code:room.code,version:room.version,serverNow:Date.now(),host:isRoomHost(room,member),member:member?{id:member.id,name:member.name,seat:member.seat,role:member.role}:null,account,game:publicGame(room.game),selfPoints,selfVoice:member?.role==='player'?selfVoice(room.game,member.id):undefined,canStart:room.game.phase==='lobby'&&members.filter(m=>m.role==='player').length>=2,canRematch:room.game.phase==='finished'&&members.filter(m=>m.role==='player').length>=2,ranked:Boolean(room.game.ranked)};
}
export async function cleanupOldRooms(){await ensureSchema();const stale=await db().prepare('SELECT code FROM rooms WHERE updated_at<?').bind(Date.now()-86400000).all<{code:string}>();for(const r of stale.results)await db().batch([db().prepare('DELETE FROM room_events WHERE room_code=?').bind(r.code),db().prepare('DELETE FROM room_members WHERE room_code=?').bind(r.code),db().prepare('DELETE FROM idempotency_keys WHERE room_code=?').bind(r.code),db().prepare('DELETE FROM rooms WHERE code=?').bind(r.code)]);}
