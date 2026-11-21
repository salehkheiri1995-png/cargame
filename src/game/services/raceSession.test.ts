import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RaceResult } from '../types';
import {
  canOfferDouble,
  createRaceSession,
  declineRevive,
  markDoubleGranted,
  recordRaceEnd,
  reviveSession,
  settleSession,
  startNewRace,
} from './raceSession';
import { createDefaultSave, grantDoubleCoinsBonus } from './saveSystem';

function result(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    mode: 'endless',
    environment: 'city',
    won: false,
    starsEarned: 0,
    score: 500,
    distanceM: 300,
    coinsCollected: 20,
    missionBonusCoins: 0,
    overtakes: 1,
    nitroUses: 1,
    peakSpeedKmh: 150,
    timeElapsed: 15,
    isNewBestScore: false,
    isNewBestDistance: false,
    canRevive: false,
    ...overrides,
  };
}

describe('race session lifecycle', () => {
  it('parks a crash that offers revive instead of banking it', () => {
    const session = createRaceSession('race_1');
    const crashed = recordRaceEnd(session, result({ canRevive: true }));
    assert.equal(crashed.phase, 'awaiting-revive');

    const settlement = settleSession(crashed, createDefaultSave());
    assert.equal(settlement.applied, false);
    assert.equal(settlement.save.totalRaces, 0);
  });

  it('keeps the same race id when revived and ignores a stale failed payload', () => {
    const session = createRaceSession('race_keep');
    const crashed = recordRaceEnd(session, result({ canRevive: true }));
    const revived = reviveSession(crashed);
    assert.equal(revived.phase, 'running');
    assert.equal(revived.raceId, 'race_keep');
    assert.equal(revived.result, null);

    const settled = settleSession(revived, createDefaultSave());
    assert.equal(settled.applied, false);

    const finalCrash = recordRaceEnd(revived, result({ coinsCollected: 33 }));
    const banked = settleSession(finalCrash, createDefaultSave());
    assert.equal(banked.applied, true);
    assert.equal(banked.coinsGranted, 33);
    assert.equal(banked.save.totalRaces, 1);
  });

  it('banks a crash once after the player declines revive', () => {
    const crashed = recordRaceEnd(
      createRaceSession('race_decline'),
      result({ canRevive: true, coinsCollected: 12 })
    );
    const declined = declineRevive(crashed);
    assert.equal(declined.phase, 'finished');

    const first = settleSession(declined, createDefaultSave());
    assert.equal(first.applied, true);
    assert.equal(first.session.phase, 'settled');

    const second = settleSession(first.session, first.save);
    assert.equal(second.applied, false);
    assert.equal(second.save.totalRaces, 1);
  });

  it('ignores duplicate engine callbacks for the same race id', () => {
    const first = recordRaceEnd(createRaceSession('race_dup'), result({ won: true }));
    const duplicate = recordRaceEnd(first, result({ won: true, coinsCollected: 999 }));
    assert.equal(duplicate, first);
    assert.equal(duplicate.result?.coinsCollected, 20);
  });

  it('creates a new id for a restart so rewards cannot merge', () => {
    const first = startNewRace(null, 1000);
    const second = startNewRace(first, 1000);
    assert.notEqual(first.raceId, second.raceId);
    assert.equal(second.phase, 'running');
  });

  it('offers the double bonus only for a settled race with coins', () => {
    const crashed = recordRaceEnd(createRaceSession('race_double'), result({ canRevive: true }));
    assert.equal(canOfferDouble(crashed), false);

    const declined = declineRevive(crashed);
    const settled = settleSession(declined, createDefaultSave());
    assert.equal(canOfferDouble(settled.session), true);

    const marked = markDoubleGranted(settled.session);
    assert.equal(canOfferDouble(marked), false);

    const bonus = grantDoubleCoinsBonus(settled.save, 'race_double', settled.session.result!);
    assert.equal(bonus.applied, true);
    assert.equal(bonus.coinsGranted, 20);
  });

  it('cannot double a revived run twice', () => {
    const save = createDefaultSave();
    const crashed = recordRaceEnd(createRaceSession('race_revive_double'), result({ canRevive: true }));
    const revived = reviveSession(crashed);
    const declined = declineRevive(crashed);
    // Reviving discards the crash payload; declining it can still bank that crash.
    assert.equal(revived.result, null);
    const settled = settleSession(declined, save);
    assert.equal(settled.applied, true);

    const first = grantDoubleCoinsBonus(settled.save, 'race_revive_double', settled.session.result!);
    const second = grantDoubleCoinsBonus(first.save, 'race_revive_double', settled.session.result!);
    assert.equal(first.applied, true);
    assert.equal(second.applied, false);
    // 20 settled + 20 one-time ad bonus, and the duplicate grant adds nothing.
    assert.equal(first.save.coins - save.coins, 40);
  });
});
