import type { RaceResult, SaveData } from '../types';
import { settleRaceResult, type RaceSettlementResult } from './saveSystem';

/**
 * Client-side race lifecycle. The engine may emit `onRaceEnd` more than once
 * (crash freeze, duplicate callbacks, React interval races), so this module
 * de-duplicates terminals and guarantees exactly one banked result per raceId.
 *
 *   running ──crash(canRevive)──▶ awaiting-revive ──revive──▶ running (same id)
 *      │                                  │
 *      └──────────finish──────────────────┴──decline──▶ finished ──settle──▶ settled
 */
export type RacePhase = 'running' | 'awaiting-revive' | 'finished' | 'settled';

export interface RaceSession {
  raceId: string;
  phase: RacePhase;
  result: RaceResult | null;
  doubleGranted: boolean;
}

export function createRaceSession(raceId: string): RaceSession {
  return { raceId, phase: 'running', result: null, doubleGranted: false };
}

export function createRaceId(now = Date.now()): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `race_${now}_${random}`;
}

/** A new run always gets a new ID so its rewards cannot be merged with the previous run. */
export function startNewRace(previous: RaceSession | null, now = Date.now()): RaceSession {
  void previous;
  return createRaceSession(createRaceId(now));
}

/**
 * Records the terminal payload. Repeated engine callbacks for the same race are
 * ignored; a crash that still offers a revive parks the session instead of banking it.
 */
export function recordRaceEnd(session: RaceSession, result: RaceResult): RaceSession {
  if (session.phase === 'settled' || session.phase === 'finished') return session;
  if (session.result) return session;
  const canRevive = result.canRevive && !result.won;
  return {
    ...session,
    result,
    phase: canRevive ? 'awaiting-revive' : 'finished',
  };
}

/** Revive keeps the same raceId and drops the failed payload so it cannot be banked. */
export function reviveSession(session: RaceSession): RaceSession {
  if (session.phase !== 'awaiting-revive') return session;
  return { ...session, phase: 'running', result: null };
}

/** Player declined the revive (or left the result screen): the crash now counts. */
export function declineRevive(session: RaceSession): RaceSession {
  if (session.phase !== 'awaiting-revive') return session;
  return { ...session, phase: 'finished' };
}

export interface SessionSettlement {
  session: RaceSession;
  save: SaveData;
  applied: boolean;
  coinsGranted: number;
}

/**
 * Banks the result exactly once. Settlement is refused while a revive is still
 * being offered, so a revive can never be combined with a settled crash.
 */
export function settleSession(
  session: RaceSession,
  save: SaveData,
  now = new Date()
): SessionSettlement {
  if (session.phase !== 'finished' || !session.result) {
    return { session, save, applied: false, coinsGranted: 0 };
  }
  const result: RaceSettlementResult = settleRaceResult(save, session.raceId, session.result, now);
  return {
    session: {
      ...session,
      phase: 'settled',
      doubleGranted: session.doubleGranted,
    },
    save: result.save,
    applied: result.applied,
    coinsGranted: result.coinsGranted,
  };
}

export function markDoubleGranted(session: RaceSession): RaceSession {
  if (session.phase !== 'settled' || session.doubleGranted) return session;
  return { ...session, doubleGranted: true };
}

export function canOfferDouble(session: RaceSession): boolean {
  return (
    session.phase === 'settled' &&
    !session.doubleGranted &&
    Boolean(session.result && session.result.coinsCollected > 0)
  );
}
