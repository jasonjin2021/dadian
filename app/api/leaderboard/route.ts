import { NextResponse } from 'next/server';
import { accountLeaderboard } from '@/lib/account-store';

export async function GET() {
  try { return NextResponse.json({ players: await accountLeaderboard() }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return NextResponse.json({ error: '积分榜暂不可用，请稍后重试' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
