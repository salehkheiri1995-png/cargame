import { DAILY_MISSIONS, DAILY_REWARDS } from '../data/economy';
import { ENVIRONMENT_MAP } from '../data/environments';
import { TOTAL_LEVELS } from '../data/levels';
import {
  getDefaultUpgrades,
  MAX_UPGRADE_LEVEL,
  VEHICLE_MAP,
} from '../data/vehicles';
import type {
  ControlScheme,
  DailyMissionProgress,
  EnvironmentId,
  GameMode,
  GameSettings,
  GraphicsQuality,
  Language,
  RaceResult,
  SaveData,
  VehicleUpgradeLevels,
} from '../types';

export const STORAGE_KEY = 'turbo_road_save_v3';
export const BACKUP_KEY = 'turbo_road_save_v3_backup';
export const PENDING_RACE_KEY = 'turbo_road_pending_race_v1';
/** Version 2 key kept only for one-way migration; it is never overwritten. */
const LEGACY_KEYS = ['turbo_road_save_v2'] as const;
export const CURRENT_VERSION = 3;

export const STARTING_CAR_ID = 'spark_hatch';
export const MAX_COINS = 10_000_000;
/** Anti-farm limits for the optional free-coins rewarded ad in the shop. */
export const FREE_COIN_AD_DAILY_CAP = 5;
export const FREE_COIN_AD_COOLDOWN_MS = 60_000;
const PROCESSED_TX_LIMIT = 100;
const RACE_LEDGER_LIMIT = 60;

const STAT_KEYS: (keyof VehicleUpgradeLevels)[] = [
  'speed',
  'accel',
  'nitro',
  'handling',
  'braking',
];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveSource = 'default' | 'primary' | 'backup' | 'legacy';

export interface LoadSaveResult {
  save: SaveData;
  source: SaveSource;
  /** True when the primary payload was unusable and another source was used. */
  recovered: boolean;
  checksumValid: boolean;
}

export interface PersistResult {
  save: SaveData;
  ok: boolean;
  error?: 'unavailable' | 'quota' | 'unknown';
}

/**
 * Optional durable mirror (Capacitor Preferences on Android). localStorage
 * stays the synchronous working copy that every existing caller expects, while
 * the mirror receives the exact same payloads asynchronously. A mirror failure
 * must never break the synchronous game loop.
 */
export type StorageMirror = (key: string, value: string | null) => void;
let storageMirror: StorageMirror | null = null;

export function setStorageMirror(mirror: StorageMirror | null): void {
  storageMirror = mirror;
}

function mirrorWrite(key: string, value: string | null): void {
  if (!storageMirror) return;
  try {
    storageMirror(key, value);
  } catch {
    // Mirrors are best-effort; the local result is still reported to the UI.
  }
}

export interface PendingRaceRecord {
  raceId: string;
  result: RaceResult;
  savedAt: number;
}

export interface RaceSettlementResult {
  save: SaveData;
  applied: boolean;
  coinsGranted: number;
}

/* ------------------------------------------------------------------ */
/* Generic validation helpers                                          */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  return Math.floor(num(value, fallback, min, max));
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function cleanIdList(value: unknown, limit: number, maxLength = 96): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id.length > maxLength || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d &&
    y >= 2000 &&
    y <= 2200
  );
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // Access can throw in privacy mode / sandboxed iframes.
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

function dateKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayKey(now = new Date()): string {
  return dateKeyOf(now);
}

function getYesterdayKey(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - 1);
  return dateKeyOf(d);
}

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

function defaultSettings(): GameSettings {
  return {
    language: 'fa',
    musicVolume: 0.45,
    sfxVolume: 0.8,
    steeringSensitivity: 1.0,
    steeringDeadZone: 0.06,
    graphicsQuality: 'auto',
    controlScheme: 'buttons',
    shakeIntensity: 1.0,
    chromaticAberration: true,
    filmGrain: true,
    speedLines: true,
    bloomEnabled: true,
    reduceMotion: false,
    leftHanded: false,
    controlScale: 1.0,
    controlOpacity: 0.85,
    tutorialSeen: false,
    hapticsEnabled: true,
    batterySaver: false,
  };
}

export function createFreshDailyMissions(dateKey: string): DailyMissionProgress {
  const values: Record<string, number> = {};
  const claimed: Record<string, boolean> = {};
  for (const m of DAILY_MISSIONS) {
    values[m.id] = 0;
    claimed[m.id] = false;
  }
  return { dateKey, values, claimed };
}

export function createDefaultSave(now = new Date()): SaveData {
  const base: Omit<SaveData, 'checksum'> = {
    version: CURRENT_VERSION,
    coins: 500,
    ownedCars: [STARTING_CAR_ID],
    selectedCarId: STARTING_CAR_ID,
    carColors: {
      [STARTING_CAR_ID]: VEHICLE_MAP[STARTING_CAR_ID].defaultColor,
    },
    carUpgrades: {
      [STARTING_CAR_ID]: getDefaultUpgrades(),
    },
    endlessBestScore: 0,
    endlessBestDistance: 0,
    totalOvertakes: 0,
    totalRaces: 0,
    unlockedLevel: 1,
    levelStars: {},
    dailyMissions: createFreshDailyMissions(getTodayKey(now)),
    dailyRewardStreak: 0,
    lastDailyRewardDate: null,
    removeAdsOwned: false,
    starterPackOwned: false,
    premiumCarOwned: false,
    processedTransactions: [],
    settledRaceIds: [],
    doubleBonusRaceIds: [],
    freeCoinAdDay: getTodayKey(now),
    freeCoinAdCount: 0,
    freeCoinAdLastAt: 0,
    lastSavedAt: 0,
    settings: defaultSettings(),
  };
  return { ...base, checksum: computeChecksum(base) };
}

/* ------------------------------------------------------------------ */
/* Checksum (tamper *indicator* only — never a purchase receipt)       */
/* ------------------------------------------------------------------ */

function computeChecksum(data: Omit<SaveData, 'checksum'>): string {
  const payload = JSON.stringify({
    v: data.version,
    c: data.coins,
    oc: [...data.ownedCars].sort(),
    ra: data.removeAdsOwned,
    sp: data.starterPackOwned,
    pc: data.premiumCarOwned,
    ul: data.unlockedLevel,
    tx: data.processedTransactions.length,
    sr: data.settledRaceIds.length,
    dr: data.doubleBonusRaceIds.length,
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------ */
/* Settings / core validation                                          */
/* ------------------------------------------------------------------ */

export function normalizeSettings(raw: unknown): GameSettings {
  const d = defaultSettings();
  if (!isRecord(raw)) return d;
  const quality = pickEnum<GraphicsQuality>(
    raw.graphicsQuality,
    ['low', 'medium', 'high', 'auto'],
    d.graphicsQuality
  );
  const scheme = pickEnum<ControlScheme>(
    raw.controlScheme,
    ['buttons', 'wheel', 'drag'],
    d.controlScheme
  );
  const language = pickEnum<Language>(raw.language, ['fa', 'en'], d.language);
  return {
    language,
    musicVolume: num(raw.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(raw.sfxVolume, d.sfxVolume, 0, 1),
    steeringSensitivity: num(raw.steeringSensitivity, d.steeringSensitivity, 0.5, 1.5),
    steeringDeadZone: num(raw.steeringDeadZone, d.steeringDeadZone, 0, 0.2),
    graphicsQuality: quality,
    controlScheme: scheme,
    shakeIntensity: num(raw.shakeIntensity, d.shakeIntensity, 0, 1.5),
    chromaticAberration: bool(raw.chromaticAberration, d.chromaticAberration),
    filmGrain: bool(raw.filmGrain, d.filmGrain),
    speedLines: bool(raw.speedLines, d.speedLines),
    bloomEnabled: bool(raw.bloomEnabled, d.bloomEnabled),
    reduceMotion: bool(raw.reduceMotion, d.reduceMotion),
    leftHanded: bool(raw.leftHanded, d.leftHanded),
    controlScale: num(raw.controlScale, d.controlScale, 0.8, 1.25),
    controlOpacity: num(raw.controlOpacity, d.controlOpacity, 0.4, 1),
    tutorialSeen: bool(raw.tutorialSeen, d.tutorialSeen),
    hapticsEnabled: bool(raw.hapticsEnabled, d.hapticsEnabled),
    batterySaver: bool(raw.batterySaver, d.batterySaver),
  };
}

function normalizeUpgrades(raw: unknown): VehicleUpgradeLevels {
  const out = getDefaultUpgrades();
  if (!isRecord(raw)) return out;
  for (const key of STAT_KEYS) {
    out[key] = int(raw[key], 0, 0, MAX_UPGRADE_LEVEL);
  }
  return out;
}

/**
 * Central untrusted-input gate for persisted game state.
 * Pure: never touches storage and never mutates `raw`.
 */
export function validateAndNormalizeSave(raw: unknown, now = new Date()): SaveData {
  const d = createDefaultSave(now);
  if (!isRecord(raw)) return d;

  const owned = cleanIdList(
    Array.isArray(raw.ownedCars) ? raw.ownedCars : [],
    Object.keys(VEHICLE_MAP).length + 1
  ).filter((id) => Boolean(VEHICLE_MAP[id]));
  if (!owned.includes(STARTING_CAR_ID)) owned.unshift(STARTING_CAR_ID);

  // Keep store-bought cars if their trusted entitlement flag survived.
  const starterPackOwned = bool(raw.starterPackOwned);
  const premiumCarOwned = bool(raw.premiumCarOwned);
  if (starterPackOwned && !owned.includes('turbo_coupe')) owned.push('turbo_coupe');
  if (premiumCarOwned && !owned.includes('golden_phantom')) owned.push('golden_phantom');

  const selected =
    typeof raw.selectedCarId === 'string' &&
    owned.includes(raw.selectedCarId) &&
    VEHICLE_MAP[raw.selectedCarId]
      ? raw.selectedCarId
      : STARTING_CAR_ID;

  const colors: Record<string, string> = {};
  const rawColors = isRecord(raw.carColors) ? raw.carColors : {};
  for (const carId of owned) {
    const value = rawColors[carId];
    colors[carId] = isValidHex(value) ? value : VEHICLE_MAP[carId].defaultColor;
  }

  const upgrades: Record<string, VehicleUpgradeLevels> = {};
  const rawUpgrades = isRecord(raw.carUpgrades) ? raw.carUpgrades : {};
  for (const carId of owned) {
    upgrades[carId] = normalizeUpgrades(rawUpgrades[carId]);
  }

  const stars: Record<number, number> = {};
  if (isRecord(raw.levelStars)) {
    for (const [key, value] of Object.entries(raw.levelStars)) {
      const levelId = Number(key);
      if (!Number.isInteger(levelId) || levelId < 1 || levelId > TOTAL_LEVELS) continue;
      const count = int(value, 0, 1, 3);
      if (count > 0) stars[levelId] = count;
    }
  }

  const today = getTodayKey(now);
  let missions = createFreshDailyMissions(today);
  const rawMissions = raw.dailyMissions;
  if (isRecord(rawMissions) && rawMissions.dateKey === today) {
    const values = isRecord(rawMissions.values) ? rawMissions.values : {};
    const claimed = isRecord(rawMissions.claimed) ? rawMissions.claimed : {};
    for (const m of DAILY_MISSIONS) {
      missions.values[m.id] = int(values[m.id], 0, 0, 1_000_000_000);
      missions.claimed[m.id] = bool(claimed[m.id], false);
    }
    missions = { dateKey: today, values: missions.values, claimed: missions.claimed };
  }

  let streak = int(raw.dailyRewardStreak, 0, 0, 7);
  let lastDailyRewardDate = isValidDateKey(raw.lastDailyRewardDate)
    ? raw.lastDailyRewardDate
    : null;
  if (lastDailyRewardDate && lastDailyRewardDate !== today && lastDailyRewardDate !== getYesterdayKey(now)) {
    // Missed at least one full day — the 7-day streak restarts.
    streak = 0;
  }

  // Schema v3 extension: old v3 payloads have no free-ad counters. A new day
  // (or a corrupt/missing day) starts at zero; a valid same-day payload keeps
  // its counter, so an upgrade never resets the anti-farm budget.
  const rawFreeDay = isValidDateKey(raw.freeCoinAdDay) ? raw.freeCoinAdDay : null;
  const sameFreeDay = rawFreeDay === today;
  const freeCoinAdCount = sameFreeDay
    ? int(raw.freeCoinAdCount, 0, 0, FREE_COIN_AD_DAILY_CAP)
    : 0;
  const rawFreeLastAt = sameFreeDay
    ? int(raw.freeCoinAdLastAt, 0, 0, Number.MAX_SAFE_INTEGER)
    : 0;
  const freeCoinAdLastAt = rawFreeLastAt > now.getTime() ? 0 : rawFreeLastAt;

  const base: Omit<SaveData, 'checksum'> = {
    version: CURRENT_VERSION,
    coins: int(raw.coins, d.coins, 0, MAX_COINS),
    ownedCars: owned,
    selectedCarId: selected,
    carColors: colors,
    carUpgrades: upgrades,
    endlessBestScore: int(raw.endlessBestScore, 0, 0, 1_000_000_000),
    endlessBestDistance: int(raw.endlessBestDistance, 0, 0, 1_000_000_000),
    totalOvertakes: int(raw.totalOvertakes, 0, 0, 10_000_000),
    totalRaces: int(raw.totalRaces, 0, 0, 10_000_000),
    unlockedLevel: int(raw.unlockedLevel, 1, 1, TOTAL_LEVELS),
    levelStars: stars,
    dailyMissions: missions,
    dailyRewardStreak: streak,
    lastDailyRewardDate,
    removeAdsOwned: bool(raw.removeAdsOwned),
    starterPackOwned,
    premiumCarOwned,
    processedTransactions: cleanIdList(raw.processedTransactions, PROCESSED_TX_LIMIT, 160),
    settledRaceIds: cleanIdList(raw.settledRaceIds, RACE_LEDGER_LIMIT),
    doubleBonusRaceIds: cleanIdList(raw.doubleBonusRaceIds, RACE_LEDGER_LIMIT),
    freeCoinAdDay: today,
    freeCoinAdCount,
    freeCoinAdLastAt,
    lastSavedAt: int(raw.lastSavedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    settings: normalizeSettings(raw.settings),
  };

  return { ...base, checksum: computeChecksum(base) };
}

/* ------------------------------------------------------------------ */
/* Load / persist                                                      */
/* ------------------------------------------------------------------ */

function parseRaw(raw: string | null): { value: unknown; checksum?: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return { value: parsed, checksum: typeof parsed.checksum === 'string' ? parsed.checksum : undefined };
  } catch {
    return null;
  }
}

/**
 * A JSON object that merely parses is not necessarily a save. Without this
 * gate an empty object `{}` would be accepted as the primary and silently
 * replace a perfectly good backup with a fresh 500-coin profile.
 *
 * A usable payload must look like a save from v2 or newer: it needs a numeric
 * version and at least one core economy field (coins or ownedCars). Missing
 * optional fields are still repaired by `validateAndNormalizeSave`.
 */
export function isUsableSavePayload(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const versionOk = typeof value.version === 'number' && Number.isFinite(value.version) && value.version >= 2;
  if (!versionOk) return false;
  const hasCoins = typeof value.coins === 'number' && Number.isFinite(value.coins);
  const hasCars = Array.isArray(value.ownedCars) && value.ownedCars.length > 0;
  return hasCoins || hasCars;
}

export function loadSaveDataWithStatus(
  storage: StorageLike | null = getDefaultStorage(),
  now = new Date()
): LoadSaveResult {
  if (!storage) {
    return { save: createDefaultSave(now), source: 'default', recovered: false, checksumValid: false };
  }

  const candidates: { raw: string | null; source: SaveSource }[] = [
    { raw: safeGet(storage, STORAGE_KEY), source: 'primary' },
    { raw: safeGet(storage, BACKUP_KEY), source: 'backup' },
    ...LEGACY_KEYS.map((key) => ({ raw: safeGet(storage, key), source: 'legacy' as const })),
  ];

  for (const candidate of candidates) {
    const parsed = parseRaw(candidate.raw);
    if (!parsed) continue;
    if (!isUsableSavePayload(parsed.value)) continue;
    const save = validateAndNormalizeSave(parsed.value, now);
    // Mismatch is surfaced for diagnostics only; normalization is the real gate.
    const { checksum: _checksum, ...withoutChecksum } = save;
    const checksumValid = parsed.checksum === computeChecksum(withoutChecksum);
    return {
      save,
      source: candidate.source,
      recovered: candidate.source !== 'primary',
      checksumValid,
    };
  }

  return { save: createDefaultSave(now), source: 'default', recovered: false, checksumValid: false };
}

export function loadSaveData(storage: StorageLike | null = getDefaultStorage()): SaveData {
  return loadSaveDataWithStatus(storage).save;
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Persists the save atomically enough for a browser game:
 * - previous primary payload is copied to the backup slot first;
 * - quota/access failures are reported, never swallowed;
 * - identical payloads are not written twice.
 *
 * Multi-tab policy: this is deliberately last-write-wins. There is no live
 * cross-tab merge; two tabs racing at once can overwrite each other's progress
 * (and their bounded race ledgers), so the game asks the player to use one tab.
 * The checksum is only a corruption/accidental-edit indicator: it is computed
 * on the client and can be forged, so it must never authorize purchases.
 */
export function persistSaveData(
  data: SaveData,
  storage: StorageLike | null = getDefaultStorage()
): PersistResult {
  const { checksum: _ignored, ...rest } = data;
  const lastSavedAt = Math.max(Date.now(), (rest.lastSavedAt || 0) + 1);
  const signedBase: Omit<SaveData, 'checksum'> = {
    ...rest,
    version: CURRENT_VERSION,
    lastSavedAt,
  };
  const signed: SaveData = { ...signedBase, checksum: computeChecksum(signedBase) };
  const serialized = JSON.stringify(signed);
  if (!storage) {
    mirrorWrite(STORAGE_KEY, serialized);
    return { save: signed, ok: false, error: 'unavailable' };
  }

  try {
    const previous = safeGet(storage, STORAGE_KEY);
    if (previous === serialized) return { save: signed, ok: true };

    if (previous) {
      try {
        // Backup is intentionally the *previous* valid snapshot.
        const previousParsed = parseRaw(previous);
        if (previousParsed) {
          storage.setItem(BACKUP_KEY, previous);
          mirrorWrite(BACKUP_KEY, previous);
        }
      } catch {
        // Backup failure must not prevent the primary write.
      }
    }

    storage.setItem(STORAGE_KEY, serialized);
    mirrorWrite(STORAGE_KEY, serialized);
    return { save: signed, ok: true };
  } catch (error) {
    // Even when localStorage is full/unavailable, try the durable mirror.
    mirrorWrite(STORAGE_KEY, serialized);
    const name = isRecord(error) && typeof error.name === 'string' ? error.name : '';
    const quota = /quota|exceeded/i.test(name) || /quota|exceeded/i.test(String(error));
    return { save: signed, ok: false, error: quota ? 'quota' : 'unknown' };
  }
}

/* ------------------------------------------------------------------ */
/* Pending race (reload recovery)                                      */
/* ------------------------------------------------------------------ */

export function normalizeRaceResult(raw: unknown): RaceResult | null {
  if (!isRecord(raw)) return null;
  const mode = pickEnum<GameMode>(raw.mode, ['endless', 'level'], 'endless');
  const environment = pickEnum<EnvironmentId>(
    raw.environment,
    Object.keys(ENVIRONMENT_MAP) as EnvironmentId[],
    'city'
  );
  const won = bool(raw.won);
  const canRevive = bool(raw.canRevive) && !won;
  const levelId =
    typeof raw.levelId === 'number' && Number.isInteger(raw.levelId) && raw.levelId > 0
      ? Math.min(TOTAL_LEVELS, raw.levelId)
      : undefined;
  const failReason = pickEnum<'crash' | 'timeout' | 'hit' | 'none'>(
    raw.failReason,
    ['crash', 'timeout', 'hit', 'none'],
    'none'
  );
  return {
    mode,
    environment,
    levelId,
    won,
    starsEarned: int(raw.starsEarned, 0, 0, 3),
    score: int(raw.score, 0, 0, 1_000_000_000),
    distanceM: int(raw.distanceM, 0, 0, 1_000_000_000),
    coinsCollected: int(raw.coinsCollected, 0, 0, 1_000_000),
    missionBonusCoins: int(raw.missionBonusCoins, 0, 0, 1_000_000),
    overtakes: int(raw.overtakes, 0, 0, 1_000_000),
    rivalsDefeated: int(raw.rivalsDefeated, 0, 0, 1_000_000),
    nitroUses: int(raw.nitroUses, 0, 0, 1_000_000),
    peakSpeedKmh: int(raw.peakSpeedKmh, 0, 0, 1000),
    timeElapsed: num(raw.timeElapsed, 0, 0, 100_000),
    isNewBestScore: bool(raw.isNewBestScore),
    isNewBestDistance: bool(raw.isNewBestDistance),
    canRevive,
    failReason: failReason === 'none' ? undefined : failReason,
  };
}

export function loadPendingRace(
  storage: StorageLike | null = getDefaultStorage()
): PendingRaceRecord | null {
  if (!storage) return null;
  const parsed = parseRaw(safeGet(storage, PENDING_RACE_KEY));
  if (!parsed || !isRecord(parsed.value)) return null;
  const { raceId, result, savedAt } = parsed.value;
  if (typeof raceId !== 'string' || !raceId.trim() || raceId.length > 96) return null;
  const normalized = normalizeRaceResult(result);
  if (!normalized) return null;
  return {
    raceId,
    result: normalized,
    savedAt: int(savedAt, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function persistPendingRace(
  record: PendingRaceRecord,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  const serialized = JSON.stringify(record);
  mirrorWrite(PENDING_RACE_KEY, serialized);
  if (!storage) return false;
  try {
    storage.setItem(PENDING_RACE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearPendingRace(storage: StorageLike | null = getDefaultStorage()): void {
  mirrorWrite(PENDING_RACE_KEY, null);
  if (!storage) return;
  try {
    storage.removeItem(PENDING_RACE_KEY);
  } catch {
    // Nothing else to do; a stale record is ignored once its race is settled.
  }
}

/* ------------------------------------------------------------------ */
/* Daily missions                                                      */
/* ------------------------------------------------------------------ */

export interface MissionClaimResult {
  save: SaveData;
  applied: boolean;
  coins: number;
}

/**
 * Claims by ID only. Target/reward are re-read from trusted mission data;
 * completion, day and duplicate claims are re-checked atomically here.
 */
export function claimMissionReward(
  save: SaveData,
  missionId: string,
  now = new Date()
): MissionClaimResult {
  const mission = DAILY_MISSIONS.find((m) => m.id === missionId);
  if (!mission) return { save, applied: false, coins: 0 };
  const today = getTodayKey(now);
  if (save.dailyMissions.dateKey !== today) return { save, applied: false, coins: 0 };
  if (save.dailyMissions.claimed[missionId]) return { save, applied: false, coins: 0 };
  const progress = save.dailyMissions.values[missionId] ?? 0;
  if (!Number.isFinite(progress) || progress < mission.target) {
    return { save, applied: false, coins: 0 };
  }
  const next: SaveData = {
    ...save,
    coins: Math.min(MAX_COINS, save.coins + mission.rewardCoins),
    dailyMissions: {
      ...save.dailyMissions,
      claimed: { ...save.dailyMissions.claimed, [missionId]: true },
    },
  };
  return { save: next, applied: true, coins: mission.rewardCoins };
}

/* ------------------------------------------------------------------ */
/* Daily login reward                                                  */
/* ------------------------------------------------------------------ */

export function canClaimDailyRewardToday(save: SaveData, now = new Date()): boolean {
  const today = getTodayKey(now);
  if (save.lastDailyRewardDate === today) return false;
  // Clock moved backwards: treat the future date as claimed instead of
  // allowing an unlimited claim loop.
  if (save.lastDailyRewardDate && save.lastDailyRewardDate > today) return false;
  return true;
}

export function getNextDailyRewardDay(save: SaveData, now = new Date()): number {
  if (!canClaimDailyRewardToday(save, now)) {
    return Math.max(1, Math.min(7, save.dailyRewardStreak));
  }
  const last = save.lastDailyRewardDate;
  if (last && last === getYesterdayKey(now) && save.dailyRewardStreak >= 1 && save.dailyRewardStreak < 7) {
    return save.dailyRewardStreak + 1;
  }
  return 1;
}

export interface DailyClaimResult {
  save: SaveData;
  applied: boolean;
  coins: number;
  day: number;
  reason?: 'already-claimed' | 'clock-skew';
}

/**
 * The day and coin amount are derived from trusted tables, never from the UI.
 * Safe to call from a duplicated ad callback: the second call is a no-op.
 */
export function claimDailyReward(
  save: SaveData,
  options: { double?: boolean } = {},
  now = new Date()
): DailyClaimResult {
  const today = getTodayKey(now);
  const day = getNextDailyRewardDay(save, now);
  if (save.lastDailyRewardDate === today) {
    return { save, applied: false, coins: 0, day, reason: 'already-claimed' };
  }
  if (save.lastDailyRewardDate && save.lastDailyRewardDate > today) {
    return { save, applied: false, coins: 0, day, reason: 'clock-skew' };
  }
  const config = DAILY_REWARDS.find((r) => r.day === day) ?? DAILY_REWARDS[0];
  const coins = config.coins * (options.double ? 2 : 1);
  const next: SaveData = {
    ...save,
    coins: Math.min(MAX_COINS, save.coins + coins),
    dailyRewardStreak: day,
    lastDailyRewardDate: today,
  };
  return { save: next, applied: true, coins, day };
}

/* ------------------------------------------------------------------ */
/* Race settlement                                                     */
/* ------------------------------------------------------------------ */

/** Pure application of a race result. Ledger/idempotency lives in settleRaceResult. */
export function applyRaceResultToSave(save: SaveData, result: RaceResult, now = new Date()): SaveData {
  const today = getTodayKey(now);
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
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.max(0, Math.floor(result.distanceM));
        break;
      case 'coins':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.max(0, Math.floor(result.coinsCollected));
        break;
      case 'overtakes':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.max(0, Math.floor(result.overtakes));
        break;
      case 'nitroUses':
        dm.values[m.id] = (dm.values[m.id] ?? 0) + Math.max(0, Math.floor(result.nitroUses));
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
    const levelId = Math.min(TOTAL_LEVELS, Math.max(1, Math.floor(result.levelId)));
    nextLevelStars[levelId] = Math.max(nextLevelStars[levelId] ?? 0, result.starsEarned);
    if (levelId >= nextUnlockedLevel && levelId < TOTAL_LEVELS) {
      nextUnlockedLevel = levelId + 1;
    }
  }

  const safeCoins = Math.max(0, Math.floor(result.coinsCollected));
  const safeBonus = Math.max(0, Math.floor(result.missionBonusCoins));

  return {
    ...save,
    coins: Math.min(MAX_COINS, save.coins + safeCoins + safeBonus),
    endlessBestScore:
      result.mode === 'endless'
        ? Math.max(save.endlessBestScore, Math.max(0, Math.floor(result.score)))
        : save.endlessBestScore,
    endlessBestDistance:
      result.mode === 'endless'
        ? Math.max(save.endlessBestDistance, Math.max(0, Math.floor(result.distanceM)))
        : save.endlessBestDistance,
    totalOvertakes: save.totalOvertakes + Math.max(0, Math.floor(result.overtakes)),
    totalRaces: save.totalRaces + 1,
    unlockedLevel: nextUnlockedLevel,
    levelStars: nextLevelStars,
    dailyMissions: dm,
  };
}

/**
 * Exactly-once base settlement per raceId. The ledger is bounded and persisted
 * with the save so reloads and duplicated callbacks cannot re-bank a race.
 */
export function settleRaceResult(
  save: SaveData,
  raceId: string,
  result: RaceResult,
  now = new Date()
): RaceSettlementResult {
  if (!raceId || save.settledRaceIds.includes(raceId)) {
    return { save, applied: false, coinsGranted: 0 };
  }
  const normalized = normalizeRaceResult(result);
  if (!normalized) return { save, applied: false, coinsGranted: 0 };
  const applied = applyRaceResultToSave(save, normalized, now);
  const settledRaceIds = [...save.settledRaceIds, raceId].slice(-RACE_LEDGER_LIMIT);
  return {
    save: { ...applied, settledRaceIds },
    applied: true,
    coinsGranted:
      Math.max(0, Math.floor(normalized.coinsCollected)) +
      Math.max(0, Math.floor(normalized.missionBonusCoins)),
  };
}

/**
 * Grants the one-time "double coins" ad bonus. The race must already be
 * finalized so a crash that is later revived can never be doubled.
 */
export function grantDoubleCoinsBonus(
  save: SaveData,
  raceId: string,
  result: RaceResult
): RaceSettlementResult {
  if (!raceId) return { save, applied: false, coinsGranted: 0 };
  if (!save.settledRaceIds.includes(raceId)) return { save, applied: false, coinsGranted: 0 };
  if (save.doubleBonusRaceIds.includes(raceId)) return { save, applied: false, coinsGranted: 0 };
  const amount = Math.max(0, Math.floor(result.coinsCollected));
  if (amount <= 0) return { save, applied: false, coinsGranted: 0 };
  return {
    save: {
      ...save,
      coins: Math.min(MAX_COINS, save.coins + amount),
      doubleBonusRaceIds: [...save.doubleBonusRaceIds, raceId].slice(-RACE_LEDGER_LIMIT),
    },
    applied: true,
    coinsGranted: amount,
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function getUnclaimedMissionCount(save: SaveData, now = new Date()): number {
  if (save.dailyMissions.dateKey !== getTodayKey(now)) return 0;
  let count = 0;
  for (const m of DAILY_MISSIONS) {
    const val = save.dailyMissions.values[m.id] ?? 0;
    if (val >= m.target && !save.dailyMissions.claimed[m.id]) count++;
  }
  return count;
}
