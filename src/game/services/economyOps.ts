import { SHOP_PRODUCTS } from '../data/economy';
import {
  getDefaultUpgrades,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  VEHICLE_MAP,
} from '../data/vehicles';
import type {
  SaveData,
  ShopProductSku,
  VehicleUpgradeLevels,
} from '../types';
import type { PurchaseOutcome, PurchaseStatus } from './providers';
import {
  FREE_COIN_AD_COOLDOWN_MS,
  FREE_COIN_AD_DAILY_CAP,
  getTodayKey,
  MAX_COINS,
} from './saveSystem';

export type EconomyRejectReason =
  | 'unknown-car'
  | 'not-owned'
  | 'already-owned'
  | 'insufficient-coins'
  | 'max-level'
  | 'invalid-color'
  | 'invalid-stat'
  | 'unknown-sku'
  | 'duplicate-transaction'
  | 'already-owned-entitlement'
  | 'invalid-transaction'
  | 'free-coins-daily-cap'
  | 'free-coins-cooldown';

export interface EconomyResult {
  save: SaveData;
  applied: boolean;
  reason?: EconomyRejectReason;
  /** Coins removed by the operation (never negative). */
  spent?: number;
}

const STAT_KEYS: (keyof VehicleUpgradeLevels)[] = [
  'speed',
  'accel',
  'nitro',
  'handling',
  'braking',
];

const PROCESSED_TX_LIMIT = 100;

function clampCoins(value: number): number {
  return Math.max(0, Math.min(MAX_COINS, Math.floor(value)));
}

function addTransaction(save: SaveData, transactionId: string): string[] {
  return [...save.processedTransactions, transactionId].slice(-PROCESSED_TX_LIMIT);
}

/* ------------------------------------------------------------------ */
/* Garage operations                                                   */
/* ------------------------------------------------------------------ */

/**
 * Buys a car using the trusted price in VEHICLE_MAP. Balance, ownership and
 * premium exclusivity are re-read from `save`, never from the caller.
 */
export function buyCar(save: SaveData, carId: string): EconomyResult {
  const car = VEHICLE_MAP[carId];
  if (!car) return { save, applied: false, reason: 'unknown-car' };
  if (save.ownedCars.includes(carId)) return { save, applied: false, reason: 'already-owned' };
  if (car.isPremiumExclusive && !save.premiumCarOwned) {
    return { save, applied: false, reason: 'already-owned-entitlement' };
  }
  if (save.coins < car.price) return { save, applied: false, reason: 'insufficient-coins' };

  return {
    save: {
      ...save,
      coins: clampCoins(save.coins - car.price),
      ownedCars: [...save.ownedCars, carId],
      selectedCarId: carId,
      carColors: {
        ...save.carColors,
        [carId]: save.carColors[carId] ?? car.defaultColor,
      },
      carUpgrades: {
        ...save.carUpgrades,
        [carId]: save.carUpgrades[carId] ?? getDefaultUpgrades(),
      },
    },
    applied: true,
    spent: car.price,
  };
}

export function equipCar(save: SaveData, carId: string): EconomyResult {
  if (!VEHICLE_MAP[carId]) return { save, applied: false, reason: 'unknown-car' };
  if (!save.ownedCars.includes(carId)) return { save, applied: false, reason: 'not-owned' };
  if (save.selectedCarId === carId) return { save, applied: false };
  return { save: { ...save, selectedCarId: carId }, applied: true };
}

export function setCarPaint(save: SaveData, carId: string, hex: string): EconomyResult {
  if (!VEHICLE_MAP[carId]) return { save, applied: false, reason: 'unknown-car' };
  if (!save.ownedCars.includes(carId)) return { save, applied: false, reason: 'not-owned' };
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return { save, applied: false, reason: 'invalid-color' };
  return {
    save: { ...save, carColors: { ...save.carColors, [carId]: hex.toLowerCase() } },
    applied: true,
  };
}

/**
 * Upgrades one stat. Cost and the current level are recomputed from the save
 * passed in, so a stale UI or a repeated state updater cannot over-spend.
 */
export function upgradeStat(
  save: SaveData,
  carId: string,
  stat: keyof VehicleUpgradeLevels
): EconomyResult {
  const car = VEHICLE_MAP[carId];
  if (!car) return { save, applied: false, reason: 'unknown-car' };
  if (!STAT_KEYS.includes(stat)) return { save, applied: false, reason: 'invalid-stat' };
  if (!save.ownedCars.includes(carId)) return { save, applied: false, reason: 'not-owned' };

  const current = save.carUpgrades[carId] ?? getDefaultUpgrades();
  const level = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(current[stat])));
  if (level >= MAX_UPGRADE_LEVEL) return { save, applied: false, reason: 'max-level' };

  const cost = getUpgradeCost(car, level);
  if (save.coins < cost) return { save, applied: false, reason: 'insufficient-coins' };

  return {
    save: {
      ...save,
      coins: clampCoins(save.coins - cost),
      carUpgrades: {
        ...save.carUpgrades,
        [carId]: { ...current, [stat]: level + 1 },
      },
    },
    applied: true,
    spent: cost,
  };
}

/* ------------------------------------------------------------------ */
/* Coins                                                               */
/* ------------------------------------------------------------------ */

export function grantCoins(save: SaveData, amount: number): EconomyResult {
  const safe = Math.floor(amount);
  if (!Number.isFinite(safe) || safe <= 0) return { save, applied: false };
  return { save: { ...save, coins: clampCoins(save.coins + safe) }, applied: true };
}

/**
 * Rewarded "free coins" in the shop is repeatable, so it needs its own
 * anti-farm budget. The counter lives in the v3 save and is migrated in place
 * (no reset of any other progress). A duplicated ad callback is also blocked by
 * the cooldown, and the cap resets naturally on a new local day.
 */
export function claimFreeCoinsAdReward(
  save: SaveData,
  amount: number,
  now = new Date()
): EconomyResult {
  const safe = Math.floor(amount);
  if (!Number.isFinite(safe) || safe <= 0) return { save, applied: false };
  const today = getTodayKey(now);
  const sameDay = save.freeCoinAdDay === today;
  const count = sameDay ? Math.max(0, Math.floor(save.freeCoinAdCount)) : 0;
  if (count >= FREE_COIN_AD_DAILY_CAP) {
    return { save, applied: false, reason: 'free-coins-daily-cap' };
  }
  const lastAt = sameDay ? Math.max(0, Math.floor(save.freeCoinAdLastAt)) : 0;
  const nowMs = now.getTime();
  if (lastAt > 0 && nowMs >= lastAt && nowMs - lastAt < FREE_COIN_AD_COOLDOWN_MS) {
    return { save, applied: false, reason: 'free-coins-cooldown' };
  }
  return {
    save: {
      ...save,
      coins: clampCoins(save.coins + safe),
      freeCoinAdDay: today,
      freeCoinAdCount: count + 1,
      freeCoinAdLastAt: nowMs,
    },
    applied: true,
  };
}

/* ------------------------------------------------------------------ */
/* Store entitlements                                                  */
/* ------------------------------------------------------------------ */

export function applyPurchaseToSave(
  save: SaveData,
  sku: ShopProductSku,
  transactionId: string
): EconomyResult {
  if (!transactionId || transactionId.length < 4 || transactionId.length > 160) {
    return { save, applied: false, reason: 'invalid-transaction' };
  }
  if (save.processedTransactions.includes(transactionId)) {
    return { save, applied: false, reason: 'duplicate-transaction' };
  }
  const product = SHOP_PRODUCTS.find((p) => p.sku === sku);
  if (!product) return { save, applied: false, reason: 'unknown-sku' };

  if (!product.consumable) {
    const alreadyOwned =
      (sku === 'remove_ads' && save.removeAdsOwned) ||
      (sku === 'starter_pack' && save.starterPackOwned) ||
      (sku === 'premium_car' && save.premiumCarOwned);
    // A replayed receipt for an owned non-consumable is consumed, not granted twice.
    if (alreadyOwned) {
      return {
        save: { ...save, processedTransactions: addTransaction(save, transactionId) },
        applied: false,
        reason: 'already-owned-entitlement',
      };
    }
  }

  const ownedCars = [...save.ownedCars];
  if (product.carGrantId && !ownedCars.includes(product.carGrantId)) {
    ownedCars.push(product.carGrantId);
  }

  const carColors = { ...save.carColors };
  if (product.carGrantId && VEHICLE_MAP[product.carGrantId]) {
    carColors[product.carGrantId] =
      carColors[product.carGrantId] ?? VEHICLE_MAP[product.carGrantId].defaultColor;
  }

  return {
    save: {
      ...save,
      coins: clampCoins(save.coins + (product.coinsGrant ?? 0)),
      ownedCars,
      carColors,
      removeAdsOwned: save.removeAdsOwned || Boolean(product.removesAds),
      starterPackOwned: save.starterPackOwned || sku === 'starter_pack',
      premiumCarOwned: save.premiumCarOwned || sku === 'premium_car',
      processedTransactions: addTransaction(save, transactionId),
    },
    applied: true,
  };
}

/**
 * Restores entitlements reported by the billing provider. Each entitlement is
 * re-applied through the same validated path as a purchase, so the list is
 * deduplicated by transaction ID and cannot mint content without receipts.
 */
export function restoreEntitlements(
  save: SaveData,
  entitlements: { sku: ShopProductSku; transactionId: string }[]
): EconomyResult {
  let next = save;
  let applied = false;
  for (const ent of entitlements.slice(0, 40)) {
    const result = applyPurchaseToSave(next, ent.sku, ent.transactionId);
    if (result.applied) {
      next = result.save;
      applied = true;
    } else if (
      result.reason === 'already-owned-entitlement' ||
      result.reason === 'duplicate-transaction'
    ) {
      // Ledger maintenance (consuming a replayed receipt) still counts as progress.
      next = result.save;
    }
  }
  return { save: next, applied };
}

export interface PurchaseApplication extends EconomyResult {
  status: PurchaseStatus;
  transactionId?: string;
}

/**
 * Single gate between a billing outcome and the save. Cancelled, failed and
 * unavailable outcomes never reach `applyPurchaseToSave`, and a success without
 * a verifiable transaction id is treated as failed instead of free content.
 */
export function applyPurchaseOutcome(
  save: SaveData,
  sku: ShopProductSku,
  outcome: PurchaseOutcome
): PurchaseApplication {
  if (outcome.status !== 'success' || !outcome.transactionId) {
    return { save, applied: false, status: outcome.status };
  }
  const result = applyPurchaseToSave(save, sku, outcome.transactionId);
  return {
    ...result,
    status: 'success',
    transactionId: outcome.transactionId,
  };
}
