import type { ShopProductSku } from '../types';

export type MonetizationMode = 'sandbox' | 'production';
export type RewardedPlacement =
  | 'double_coins'
  | 'revive_crash'
  | 'free_coins_shop'
  | 'daily_reward_2x'
  | 'continue_level';

export type PurchaseStatus = 'success' | 'cancelled' | 'failed' | 'unavailable';

export interface PurchaseOutcome {
  status: PurchaseStatus;
  sku: ShopProductSku;
  transactionId?: string;
  error?: string;
  sandbox: boolean;
}

export interface RestoreEntitlement {
  sku: ShopProductSku;
  transactionId: string;
}

export interface RestoreOutcome {
  status: 'success' | 'failed' | 'unavailable';
  entitlements: RestoreEntitlement[];
  error?: string;
  sandbox: boolean;
}

export interface BillingProvider {
  readonly id: string;
  readonly mode: MonetizationMode;
  readonly isSandbox: boolean;
  purchase(sku: ShopProductSku): Promise<PurchaseOutcome>;
  restore(): Promise<RestoreOutcome>;
}

export type AdOutcomeStatus = 'completed' | 'cancelled' | 'failed' | 'unavailable';

export interface AdOutcome {
  status: AdOutcomeStatus;
  placement: RewardedPlacement;
  rewardToken?: string;
  error?: string;
  sandbox: boolean;
}

export interface AdSession {
  readonly placement: RewardedPlacement;
  /** Idempotent: only the first completed call yields a token. */
  complete(): AdOutcome;
  cancel(): AdOutcome;
  fail(reason?: string): AdOutcome;
}

export interface AdProvider {
  readonly id: string;
  readonly mode: MonetizationMode;
  readonly isSandbox: boolean;
  isRewardedAvailable(placement: RewardedPlacement): boolean;
  /** Returns null when no real provider is configured (production). */
  beginRewarded(placement: RewardedPlacement): AdSession | null;
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const SANDBOX_PURCHASE_KEY = 'turbo_road_sandbox_purchases_v1';
const SANDBOX_DELAY_MS = 450;

interface SandboxPurchaseRecord {
  sku: ShopProductSku;
  transactionId: string;
  purchasedAt: number;
}

function readSandboxPurchases(): SandboxPurchaseRecord[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(SANDBOX_PURCHASE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SandboxPurchaseRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.sku === 'string' &&
        typeof item.transactionId === 'string'
    );
  } catch {
    return [];
  }
}

function writeSandboxPurchases(records: SandboxPurchaseRecord[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(SANDBOX_PURCHASE_KEY, JSON.stringify(records.slice(-60)));
  } catch {
    // Sandbox-only convenience; entitlements already live in the main save.
  }
}

/**
 * Web-only simulator. It never charges money and every result is clearly
 * labelled as sandbox in the UI. It is the default in this repository.
 */
export class SandboxBillingProvider implements BillingProvider {
  readonly id = 'sandbox-billing';
  readonly mode: MonetizationMode = 'sandbox';
  readonly isSandbox = true;

  async purchase(sku: ShopProductSku): Promise<PurchaseOutcome> {
    await new Promise((resolve) => setTimeout(resolve, SANDBOX_DELAY_MS));
    const transactionId = createId(`sandbox:${sku}`);
    try {
      const records = readSandboxPurchases();
      records.push({ sku, transactionId, purchasedAt: Date.now() });
      writeSandboxPurchases(records);
    } catch {
      // Ignore registry failure; the in-memory save still receives the grant.
    }
    return { status: 'success', sku, transactionId, sandbox: true };
  }

  async restore(): Promise<RestoreOutcome> {
    const records = readSandboxPurchases();
    const latestBySku = new Map<ShopProductSku, string>();
    for (const record of records) latestBySku.set(record.sku, record.transactionId);
    return {
      status: 'success',
      entitlements: [...latestBySku.entries()].map(([sku, transactionId]) => ({
        sku,
        transactionId,
      })),
      sandbox: true,
    };
  }
}

/**
 * Production is intentionally disabled until a native Bazaar/Poolakey bridge
 * and a server-side receipt validator are wired. Returning entitlements here
 * would silently turn a failed purchase into free content.
 *
 * Integration point (documented, not implemented): expose a native bridge
 * `window.TurboRoadNative.purchase(sku)` that resolves with a server-verified
 * receipt, then map it to PurchaseOutcome in a real provider.
 */
export class UnavailableBillingProvider implements BillingProvider {
  readonly id = 'unavailable-billing';
  readonly mode: MonetizationMode = 'production';
  readonly isSandbox = false;

  async purchase(sku: ShopProductSku): Promise<PurchaseOutcome> {
    return {
      status: 'unavailable',
      sku,
      sandbox: false,
      error: 'پرداخت واقعی در این نسخه فعال نیست / Real billing provider is not configured',
    };
  }

  async restore(): Promise<RestoreOutcome> {
    return {
      status: 'unavailable',
      entitlements: [],
      sandbox: false,
      error: 'بازیابی خرید واقعی در این نسخه فعال نیست / Real restore is not configured',
    };
  }
}

/**
 * Sandbox ads are presented by the React overlay. This provider owns the
 * one-shot completion token, so a double "complete" click cannot double-pay.
 */
export class SandboxAdProvider implements AdProvider {
  readonly id = 'sandbox-ads';
  readonly mode: MonetizationMode = 'sandbox';
  readonly isSandbox = true;

  isRewardedAvailable(_placement: RewardedPlacement): boolean {
    return true;
  }

  beginRewarded(placement: RewardedPlacement): AdSession {
    let settled = false;
    return {
      placement,
      complete: (): AdOutcome => {
        if (settled) {
          return { status: 'failed', placement, sandbox: true, error: 'Ad already settled' };
        }
        settled = true;
        return {
          status: 'completed',
          placement,
          rewardToken: createId(`ad:${placement}`),
          sandbox: true,
        };
      },
      cancel: (): AdOutcome => {
        if (settled) {
          return { status: 'cancelled', placement, sandbox: true };
        }
        settled = true;
        return { status: 'cancelled', placement, sandbox: true };
      },
      fail: (reason?: string): AdOutcome => {
        if (settled) {
          return { status: 'failed', placement, sandbox: true, error: reason };
        }
        settled = true;
        return { status: 'failed', placement, sandbox: true, error: reason };
      },
    };
  }
}

export class UnavailableAdProvider implements AdProvider {
  readonly id = 'unavailable-ads';
  readonly mode: MonetizationMode = 'production';
  readonly isSandbox = false;

  isRewardedAvailable(_placement: RewardedPlacement): boolean {
    return false;
  }

  beginRewarded(_placement: RewardedPlacement): null {
    return null;
  }
}

function currentMode(): MonetizationMode {
  try {
    const configured = import.meta.env?.VITE_MONETIZATION_MODE;
    return configured === 'production' ? 'production' : 'sandbox';
  } catch {
    return 'sandbox';
  }
}

export const monetizationMode: MonetizationMode = currentMode();

export const billingProvider: BillingProvider =
  monetizationMode === 'production'
    ? new UnavailableBillingProvider()
    : new SandboxBillingProvider();

export const adProvider: AdProvider =
  monetizationMode === 'production' ? new UnavailableAdProvider() : new SandboxAdProvider();
