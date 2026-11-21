import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BACKUP_KEY,
  MAX_COINS,
  STORAGE_KEY,
  STARTING_CAR_ID,
  claimDailyReward,
  claimMissionReward,
  createDefaultSave,
  getNextDailyRewardDay,
  getTodayKey,
  grantDoubleCoinsBonus,
  loadSaveDataWithStatus,
  persistSaveData,
  settleRaceResult,
  validateAndNormalizeSave,
  type StorageLike,
} from './saveSystem';
import type { RaceResult, SaveData } from '../types';

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

function withCoins(save: SaveData, coins: number): SaveData {
  return { ...save, coins };
}

function raceResult(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    mode: 'endless',
    environment: 'city',
    won: false,
    starsEarned: 0,
    score: 1200,
    distanceM: 800,
    coinsCollected: 40,
    missionBonusCoins: 0,
    overtakes: 3,
    nitroUses: 2,
    peakSpeedKmh: 190,
    timeElapsed: 30,
    isNewBestScore: false,
    isNewBestDistance: false,
    canRevive: false,
    ...overrides,
  };
}

describe('validateAndNormalizeSave', () => {
  it('clamps corrupt numeric values and fills missing fields', () => {
    const save = validateAndNormalizeSave({
      coins: -500,
      ownedCars: ['not_a_car', 42, STARTING_CAR_ID],
      selectedCarId: 'not_a_car',
      carUpgrades: { [STARTING_CAR_ID]: { speed: 99, accel: -4, nitro: 2.7 } },
      carColors: { [STARTING_CAR_ID]: 'javascript:alert(1)' },
      totalRaces: -8,
      unlockedLevel: 9999,
      processedTransactions: [1, 'tx_ok', 'tx_ok'],
      settings: {
        language: 'xx',
        musicVolume: 7,
        sfxVolume: Number.NaN,
        graphicsQuality: 'ultra',
        controlScheme: 'keyboard',
        controlScale: 99,
      },
    });

    assert.equal(save.coins, 0);
    assert.equal(save.totalRaces, 0);
    assert.equal(save.unlockedLevel, 45);
    assert.deepEqual(save.ownedCars, [STARTING_CAR_ID]);
    assert.equal(save.selectedCarId, STARTING_CAR_ID);
    assert.equal(save.carUpgrades[STARTING_CAR_ID].speed, 5);
    assert.equal(save.carUpgrades[STARTING_CAR_ID].accel, 0);
    assert.equal(save.carUpgrades[STARTING_CAR_ID].nitro, 2);
    assert.match(save.carColors[STARTING_CAR_ID], /^#[0-9a-f]{6}$/i);
    assert.deepEqual(save.processedTransactions, ['tx_ok']);
    assert.equal(save.settings.language, 'fa');
    assert.equal(save.settings.musicVolume, 1);
    assert.equal(save.settings.graphicsQuality, 'auto');
    assert.equal(save.settings.controlScheme, 'buttons');
    assert.equal(save.settings.controlScale, 1.25);
    assert.deepEqual(save.settledRaceIds, []);
    assert.deepEqual(save.doubleBonusRaceIds, []);
  });

  it('caps huge coin values and drops unowned selected cars', () => {
    const save = validateAndNormalizeSave({
      coins: Number.MAX_SAFE_INTEGER,
      ownedCars: [STARTING_CAR_ID],
      selectedCarId: 'golden_phantom',
    });
    assert.equal(save.coins, MAX_COINS);
    assert.equal(save.selectedCarId, STARTING_CAR_ID);
  });

  it('resets an out-of-date daily mission board and expired streak', () => {
    const now = new Date(2026, 4, 10, 12);
    const save = validateAndNormalizeSave(
      {
        dailyMissions: {
          dateKey: '2026-05-01',
          values: { dm_distance_5000: 99999 },
          claimed: { dm_distance_5000: true },
        },
        dailyRewardStreak: 6,
        lastDailyRewardDate: '2026-05-01',
      },
      now
    );
    assert.equal(save.dailyMissions.dateKey, getTodayKey(now));
    assert.equal(save.dailyMissions.values.dm_distance_5000, 0);
    assert.equal(save.dailyMissions.claimed.dm_distance_5000, false);
    assert.equal(save.dailyRewardStreak, 0);
  });

  it('migrates a legacy payload through the normalizer', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'turbo_road_save_v2',
      JSON.stringify({ version: 2, coins: 321, ownedCars: [STARTING_CAR_ID] })
    );
    const loaded = loadSaveDataWithStatus(storage);
    assert.equal(loaded.source, 'legacy');
    assert.equal(loaded.save.coins, 321);
    assert.equal(loaded.save.version, 3);
    assert.equal(loaded.recovered, true);
  });

  it('falls back to the backup when the primary payload is corrupt', () => {
    const storage = new MemoryStorage();
    persistSaveData(withCoins(createDefaultSave(), 100), storage);
    persistSaveData(withCoins(createDefaultSave(), 900), storage);
    assert.ok(storage.getItem(BACKUP_KEY));

    storage.setItem(STORAGE_KEY, '{broken json');
    const loaded = loadSaveDataWithStatus(storage);
    assert.equal(loaded.source, 'backup');
    assert.equal(loaded.recovered, true);
    assert.equal(loaded.save.coins, 100);
  });

  it('reports a quota failure instead of claiming success', () => {
    const throwing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      },
      removeItem: () => {},
    };
    const result = persistSaveData(createDefaultSave(), throwing);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'quota');
  });
});

describe('missions and daily rewards', () => {
  it('refuses a mission that is incomplete or already claimed', () => {
    const now = new Date(2026, 4, 10, 9);
    const save = createDefaultSave(now);
    const incomplete = claimMissionReward(save, 'dm_distance_5000', now);
    assert.equal(incomplete.applied, false);

    const complete: SaveData = {
      ...save,
      coins: 0,
      dailyMissions: {
        ...save.dailyMissions,
        values: { ...save.dailyMissions.values, dm_distance_5000: 5001 },
      },
    };
    const first = claimMissionReward(complete, 'dm_distance_5000', now);
    assert.equal(first.applied, true);
    assert.equal(first.coins, 250);
    const second = claimMissionReward(first.save, 'dm_distance_5000', now);
    assert.equal(second.applied, false);
    assert.equal(second.save.coins, first.save.coins);
  });

  it('accepts only a trusted mission id', () => {
    const save = createDefaultSave(new Date(2026, 4, 10, 9));
    const result = claimMissionReward(save, 'made_up_mission', new Date(2026, 4, 10, 9));
    assert.equal(result.applied, false);
  });

  it('claims the daily reward once per day, then advances the streak', () => {
    const day1 = new Date(2026, 4, 10, 9);
    const day2 = new Date(2026, 4, 11, 9);
    const save = createDefaultSave(day1);

    const first = claimDailyReward(save, {}, day1);
    assert.equal(first.applied, true);
    assert.equal(first.day, 1);
    assert.equal(first.coins, 150);

    const duplicate = claimDailyReward(first.save, { double: true }, day1);
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.save.coins, first.save.coins);

    const next = claimDailyReward(first.save, {}, day2);
    assert.equal(next.applied, true);
    assert.equal(next.day, 2);
    assert.equal(next.coins, 250);
  });

  it('restarts the streak after a missed day and doubles only via the ad option', () => {
    const now = new Date(2026, 4, 10, 9);
    const save: SaveData = {
      ...createDefaultSave(now),
      lastDailyRewardDate: '2026-05-08',
      dailyRewardStreak: 4,
    };
    assert.equal(getNextDailyRewardDay(save, now), 1);
    const claim = claimDailyReward(save, { double: true }, now);
    assert.equal(claim.day, 1);
    assert.equal(claim.coins, 300);
  });

  it('treats a future date (clock rollback) as already claimed', () => {
    const now = new Date(2026, 4, 10, 9);
    const save: SaveData = {
      ...createDefaultSave(now),
      lastDailyRewardDate: '2026-05-12',
      dailyRewardStreak: 3,
    };
    const claim = claimDailyReward(save, {}, now);
    assert.equal(claim.applied, false);
    assert.equal(claim.reason, 'clock-skew');
  });
});

describe('race settlement and ad bonuses', () => {
  it('banks each race exactly once', () => {
    const save = { ...createDefaultSave(), coins: 0 };
    const first = settleRaceResult(save, 'race_a', raceResult());
    assert.equal(first.applied, true);
    assert.equal(first.coinsGranted, 40);
    assert.equal(first.save.coins, 40);
    assert.equal(first.save.totalRaces, 1);

    const second = settleRaceResult(first.save, 'race_a', raceResult());
    assert.equal(second.applied, false);
    assert.equal(second.save.coins, 40);
    assert.equal(second.save.totalRaces, 1);
  });

  it('does not tick daily counters twice for a duplicate race id', () => {
    const save = { ...createDefaultSave(), coins: 0 };
    const first = settleRaceResult(save, 'race_b', raceResult({ distanceM: 500 }));
    const second = settleRaceResult(first.save, 'race_b', raceResult({ distanceM: 500 }));
    assert.equal(
      second.save.dailyMissions.values.dm_distance_5000,
      first.save.dailyMissions.values.dm_distance_5000
    );
    assert.equal(
      second.save.dailyMissions.values.dm_races_2,
      first.save.dailyMissions.values.dm_races_2
    );
  });

  it('grants the double-coins bonus once, and only after settlement', () => {
    const save = { ...createDefaultSave(), coins: 0 };
    const result = raceResult({ coinsCollected: 30 });
    const beforeSettle = grantDoubleCoinsBonus(save, 'race_c', result);
    assert.equal(beforeSettle.applied, false);

    const settled = settleRaceResult(save, 'race_c', result);
    const bonus = grantDoubleCoinsBonus(settled.save, 'race_c', result);
    assert.equal(bonus.applied, true);
    assert.equal(bonus.coinsGranted, 30);
    assert.equal(bonus.save.coins, 60);

    const again = grantDoubleCoinsBonus(bonus.save, 'race_c', result);
    assert.equal(again.applied, false);
    assert.equal(again.save.coins, 60);
  });

  it('counts a level win once and advances the unlocked level', () => {
    const save = createDefaultSave();
    const result = raceResult({
      mode: 'level',
      levelId: 3,
      won: true,
      starsEarned: 3,
      missionBonusCoins: 100,
    });
    const settled = settleRaceResult(save, 'race_level', result);
    assert.equal(settled.save.levelStars[3], 3);
    assert.equal(settled.save.unlockedLevel, 4);
    assert.equal(settled.save.totalRaces, 1);
  });
});
