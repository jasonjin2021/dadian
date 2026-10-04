import { NextResponse } from 'next/server';
import { PHASE_SECONDS } from '@/lib/game';
import { PHASE_SYNC_MS } from '@/lib/phase-clock';

// Read-only release verification: contains no account, room, or hidden resources.
export function GET() {
  return NextResponse.json({
    clockProtocol: 'server-start-v2',
    buildMarker: '2026-10-04-phase-sync-v1',
    phaseSeconds: PHASE_SECONDS,
    preparationMs: PHASE_SYNC_MS,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
