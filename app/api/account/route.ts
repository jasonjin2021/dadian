import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AccountError, accountForSession, authenticateAccount, revokeAccountSession } from '@/lib/account-store';
import { isSameOriginRequest, SESSION_MAX_AGE_SECONDS } from '@/lib/account-security';

const noStore = { 'Cache-Control': 'no-store, private' };
async function readAccountBody(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length')) > 2048) throw new AccountError('请求内容过长', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError('请求格式无效');
  const decoder = new TextDecoder();
  let length = 0, text = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > 2048) { await reader.cancel(); throw new AccountError('请求内容过长', 413) }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}
export async function GET() {
  try {
    const jar = await cookies();
    return NextResponse.json({ account: await accountForSession(jar.get('dadian_session')?.value) }, { headers: noStore });
  } catch { return NextResponse.json({ error: '账号服务暂不可用，请稍后重试' }, { status: 503, headers: noStore }) }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: '请求来源无效，请刷新页面重试' }, { status: 403, headers: noStore });
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return NextResponse.json({ error: '请通过 HTTPS 安全连接登录', }, { status: 400, headers: noStore });
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: '请求格式无效' }, { status: 415, headers: noStore });
  try {
    const text = await readAccountBody(request);
    let body: { command?: unknown; username?: unknown; password?: unknown };
    try { body = JSON.parse(text) } catch { throw new AccountError('请求格式无效') }
    if (!body || !['register', 'login', 'logout'].includes(String(body.command))) throw new AccountError('未知账号操作');
    const jar = await cookies(), oldSid = jar.get('dadian_session')?.value;
    const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: new URL(request.url).protocol === 'https:', path: '/' };
    if (body.command === 'logout') {
      await revokeAccountSession(oldSid);
      jar.set('dadian_session', '', { ...cookieOptions, maxAge: 0 });
      return NextResponse.json({ account: null }, { headers: noStore });
    }
    const { account, token } = await authenticateAccount(body.command as 'register' | 'login', body.username, body.password, request.headers.get('cf-connecting-ip') || 'unknown', oldSid);
    jar.set('dadian_session', token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS });
    return NextResponse.json({ account }, { status: body.command === 'register' ? 201 : 200, headers: noStore });
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 503;
    return NextResponse.json({ error: error instanceof AccountError ? error.message : '账号服务暂不可用，请稍后重试' }, { status, headers: { ...noStore, ...(status === 429 ? { 'Retry-After': '900' } : {}) } });
  }
}
