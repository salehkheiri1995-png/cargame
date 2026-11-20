import { DAILY_MISSIONS } from '../data/economy';
import { getDefaultUpgrades, VEHICLE_MAP } from '../data/vehicles';
import type { DailyMissionProgress, RaceResult, SaveData } from '../types';

const STORAGE_KEY = 'turbo_road_save_v2';
const CURRENT_VERSION = 2;

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayKey(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeChecksum(data: Omit<SaveData, 'checksum'>): string {
  const payload = JSON.stringify({
    v: data.version,
    c: data.coins,
    oc: data.ownedCars,
    ra: data.removeAdsOwned,
    sp: data.starterPackOwned,
    pc: data.premiumCarOwned,
    ul: data.unlockedLevel,
    tx: data.processedTransactions.length,
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createFreshDailyMissions(dateKey: string): DailyMissionProgress {
  const values: Record<string, number> = {};
  const claimed: Record<string, boolean> = {};
  for (const m of DAILY_MISSIONS) {
    values[m.id] = 0;
    claimed[m.id] = false;
  }
  return { dateKey, values, claimed };
}

export function createDefaultSave(): SaveData {
  const today = getTodayKey();
  const base: Omit<SaveData, 'checksum'> = {
    version: CURRENT_VERSION,
    coins: 500,
    ownedCars: ['spark_hatch'],
    selectedCarId: 'spark_hatch',
    carColors: {
      spark_hatch: VEHICLE_MAP.spark_hatch.defaultColor,
    },
    carUpgrades: {
      spark_hatch: getDefaultUpgrades(),
    },
    endlessBestScore: 0,
    endlessBestDistance: 0,
    totalOvertakes: 0,
    totalRaces: 0,
    unlockedLevel: 1,
    levelStars: {},
    dailyMissions: createFreshDailyMissions(today),
    dailyRewardStreak: 0,
    lastDailyRewardDate: null,
    removeAdsOwned: false,
    starterPackOwned: false,
    premiumCarOwned: false,
    processedTransactions: [],
    settings: {
      language: 'fa',
      musicVolume: 0.45,
      sfxVolume: 0.8,
      steeringSensitivity: 1.0,
      graphicsQuality: 'high',
      controlScheme: 'buttons',
    },
  };
  return {
    ...base,
    checksum: computeChecksum(base),
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSave();

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const fresh = createDefaultSave();

    const merged: Omit<SaveData, 'checksum'> = {
      ...fresh,
      ...parsed,
      version: CURRENT_VERSION,
      ownedCars: Array.isArray(parsed.ownedCars) && parsed.ownedCars.length > 0
        ? Array.from(new Set(['spark_hatch', ...parsed.ownedCars.filter((id) => Boolean(VEHICLE_MAP[id]))]))
        : fresh.ownedCars,
      selectedCarId: parsed.selectedCarId && VEHICLE_MAP[parsed.selectedCarId]
        ? parsed.selectedCarId
        : 'spark_hatch',
      carColors: { ...fresh.carColors, ...(parsed.carColors ?? {}) },
      carUpgrades: { ...fresh.carUpgrades, ...(parsed.carUpgrades ?? {}) },
      levelStars: { ...(parsed.levelStars ?? {}) },
      processedTransactions: Array.isArray(parsed.processedTransactions)
        ? parsed.processedTransactions.slice(-100)
        : [],
      settings: { ...fresh.settings, ...(parsed.settings ?? {}) },
    };

    // Rollover daily missions on a new calendar day
    const today = getTodayKey();
    if (!parsed.dailyMissions || parsed.dailyMissions.dateKey !== today) {
      merged.dailyMissions = createFreshDailyMissions(today);
    } else {
      const dm = createFreshDailyMissions(today);
      for (const m of DAILY_MISSIONS) {
        dm.values[m.id] = Number(parsed.dailyMissions.values?.[m.id] ?? 0);
        dm.claimed[m.id] = Boolean(parsed.dailyMissions.claimed?.[m.id]);
      }
      merged.dailyMissions = dm;
    }

    // Check daily reward streak reset if more than 1 day skipped
    if (
      merged.lastDailyRewardDate &&
      merged.lastDailyRewardDate !== today &&
      merged.lastDailyRewardDate !== getYesterdayKey()
    ) {
      merged.dailyRewardStreak = 0;
    }

    // Verify integrity checksum for tamper detection (fallback safely without losing progress on minor migrations)
    const expected = computeChecksum(merged);
    if (parsed.checksum && parsed.checksum !== expected) {
      // Clamp anomalous coin tampering while preserving legitimate unlocked progression
      merged.coins = Math.min(Math.max(0, Number(merged.coins) || 0), 500000);
    }

    return { ...merged, checksum: computeChecksum(merged) };
  } catch {
    return createDefaultSave();
  }
}

export function persistSaveData(data: SaveData): SaveData {
  const { checksum: _ignore, ...rest } = data;
  const signed: SaveData = {
    ...rest,
    version: CURRENT_VERSION,
    checksum: computeChecksum(rest),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(signed));
  } catch {
    // Ignore storage quota errors cleanly
  }
  return signed;
}

export function canClaimDailyRewardToday(save: SaveData): boolean {
  return save.lastDailyRewardDate !== getTodayKey();
}

export function getNextDailyRewardDay(save: SaveData): number {
  if (!canClaimDailyRewardToday(save)) {
    return Math.max(1, save.dailyRewardStreak);
  }
  return (save.dailyRewardStreak % 7) + 1;
}

export function applyRaceResultToSave(save: SaveData, result: RaceResult): SaveData {
  const today = getTodayKey();
  const dm: DailyMissionProgress =
    save.dailyMissions.dateKey === today
      ? {
          dateKey: today,
          values: { ...save.dailyMissions.values },
          claimed: { ...save.dailyMissions.claimed },
        }
      : createFreshDailyMissions(today);

  for (const m of DAILY_MISSIONS) {
    switch (m.type) {
      case 'distance':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.floor(result.distanceM);
        break;
      case 'coins':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.floor(result.coinsCollected);
        break;
      case 'overtakes':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.floor(result.overtakes);
        break;
      case 'nitroUses':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.floor(result.nitroUses);
        break;
      case 'racesCompleted':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + 1;
        break;
      case 'levelsWon':
        if (result.mode === 'level' && result.won) {
          dm.values[m.id] = (dm.values[m.id] ?? 0) + 1;
        }
        break;
    }
  }

  const nextLevelStars = { ...save.levelStars };
  let nextUnlockedLevel = save.unlockedLevel;

  if (result.mode === 'level' && result.levelId && result.won) {
    const prevStars = nextLevelStars[result.levelId] ?? 0;
    nextLevelStars[result.levelId] = Math.max(prevStars, result.starsEarned);
    if (result.levelId >= nextUnlockedLevel && result.levelId < 45) {
      nextUnlockedLevel = result.levelId + 1;
    }
  }

  const nextCoins = save.coins + result.coinsCollected + result.missionBonusCoins;

  const updated: SaveData = {
    ...save,
    coins: nextCoins,
    endlessBestScore:
      result.mode === 'endless'
        ? Math.max(save.endlessBestScore, Math.floor(result.score))
        : save.endlessBestScore,
    endlessBestDistance:
      result.mode === 'endless'
        ? Math.max(save.endlessBestDistance, Math.floor(result.distanceM))
        : save.endlessBestDistance,
    totalOvertakes: save.totalOvertakes + result.overtakes,
    totalRaces: save.totalRaces + 1,
    unlockedLevel: nextUnlockedLevel,
    levelStars: nextLevelStars,
    dailyMissions: dm,
  };

  return persistSaveData(updated);
}

export function getUnclaimedMissionCount(save: SaveData): number {
  let count = 0;
  for (const m of DAILY_MISSIONS) {
    const val = save.dailyMissions.values[m.id] ?? 0;
    if (val >= m.target && !save.dailyMissions.claimed[m.id]) {
      count++;
    }
  }
  return count;
}
