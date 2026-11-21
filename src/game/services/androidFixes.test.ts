import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RaceResult, SaveData } from '../types';
import {
  FREE_COIN_AD_COOLDOWN_MS,
  FREE_COIN_AD_DAILY_CAP,
  STORAGE_KEY,
  BACKUP_KEY,
  createDefaultSave,
  getTodayKey,
  isUsableSavePayload,
  loadSaveDataWithStatus,
  type StorageLike,
} from './saveSystem';
import { claimFreeCoinsAdReward } from './economyOps';
import {
  createRaceSession,
  declineRevive,
  recordRaceEnd,
  settleBeforeNewRace,
} from './raceSession';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

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

function signed(save: SaveData): string {
  return JSON.stringify(save);
}

describe('usable save detection (stage-4 recovery)', () => {
  it('rejects empty or version-less JSON so a backup can win', () => {
    assert.equal(isUsableSavePayload({}), false);
    assert.equal(isUsableSavePayload({ version: 3 }), false);
    assert.equal(isUsableSavePayload({ version: 1, coins: 900 }), false);
    assert.equal(isUsableSavePayload({ version: 3, coins: 900 }), true);
    assert.equal(isUsableSavePayload({ version: 3, ownedCars: ['spark_hatch'] }), true);
  });

  it('falls through an empty primary payload to the valid backup', () => {
    const storage = new MemoryStorage();
    const backup = { ...createDefaultSave(), coins: 4321 };
    storage.setItem(STORAGE_KEY, '{}');
    storage.setItem(BACKUP_KEY, signed(backup));

    const loaded = loadSaveDataWithStatus(storage);
    assert.equal(loaded.recovered, true);
    assert.equal(loaded.source, 'backup');
    assert.equal(loaded.save.coins, 4321);
  });
});

describe('free-coins rewarded ad limits', () => {
  const now = new Date('2026-05-10T12:00:00');

  it('grants once, then blocks the immediate duplicate via cooldown', () => {
    const first = claimFreeCoinsAdReward(createDefaultSave(now), 100, now);
    assert.equal(first.applied, true);
    assert.equal(first.save.coins, 600);
    assert.equal(first.save.freeCoinAdCount, 1);
    assert.equal(first.save.freeCoinAdDay, getTodayKey(now));

    const duplicate = claimFreeCoinsAdReward(first.save, 100, now);
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.reason, 'free-coins-cooldown');
    assert.equal(duplicate.save.coins, 600);
  });

  it('allows the next ad after the cooldown and enforces the daily cap', () => {
    let save = createDefaultSave(now);
    let t = now.getTime();
    for (let i = 0; i < FREE_COIN_AD_DAILY_CAP; i++) {
      const grant = claimFreeCoinsAdReward(save, 100, new Date(t));
      assert.equal(grant.applied, true);
      save = grant.save;
      t += FREE_COIN_AD_COOLDOWN_MS;
    }
    assert.equal(save.freeCoinAdCount, FREE_COIN_AD_DAILY_CAP);

    const overCap = claimFreeCoinsAdReward(save, 100, new Date(t));
    assert.equal(overCap.applied, false);
    assert.equal(overCap.reason, 'free-coins-daily-cap');
  });

  it('resets the counter on a new local day without touching progress', () => {
    const first = claimFreeCoinsAdReward(createDefaultSave(now), 100, now);
    const nextDay = new Date('2026-05-11T09:00:00');
    const second = claimFreeCoinsAdReward(first.save, 100, nextDay);
    assert.equal(second.applied, true);
    assert.equal(second.save.freeCoinAdCount, 1);
    assert.equal(second.save.freeCoinAdDay, getTodayKey(nextDay));
    assert.equal(second.save.coins, 700);
  });
});

describe('launching a race while a revive offer is open', () => {
  it('settles the parked crash before starting the next race', () => {
    const now = new Date('2026-05-10T12:00:00');
    const base = createDefaultSave(now);
    const crashed = recordRaceEnd(createRaceSession('race-old'), result({ canRevive: true }));
    assert.equal(crashed.phase, 'awaiting-revive');

    const next = settleBeforeNewRace(crashed, base, now);
    assert.equal(next.applied, true);
    assert.notEqual(next.session.raceId, 'race-old');
    assert.equal(next.session.phase, 'running');
    assert.ok(next.save.settledRaceIds.includes('race-old'));
    assert.ok(next.save.coins >= base.coins);
  });

  it('does not double-bank an already settled crash', () => {
    const now = new Date('2026-05-10T12:00:00');
    const base = createDefaultSave(now);
    const parked = recordRaceEnd(createRaceSession('race-old'), result({ canRevive: true }));
    const settled = declineRevive(parked);

    const next = settleBeforeNewRace(settled, base, now);
    assert.equal(next.applied, false);
    assert.equal(next.save.coins, base.coins);
  });
});
