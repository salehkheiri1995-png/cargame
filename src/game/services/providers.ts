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

/** Store front configured at build time. No secrets belong here. */
export type StoreId = 'bazaar' | 'myket' | 'play' | 'none';
/** Ad network configured at build time. No secrets belong here. */
export type AdNetworkId = 'tapsell' | 'admob' | 'none';
export type ProviderKind = 'sandbox' | 'native' | 'unavailable';

export interface NativePurchaseResult {
  status: 'success' | 'cancelled' | 'failed' | 'unavailable';
  sku?: ShopProductSku;
  transactionId?: string;
  /** Server-verified receipt token, never a client-only flag. */
  receiptToken?: string;
  /** 'server' only when a backend verified the receipt. */
  verification?: 'server' | 'none';
  errorCode?: string;
}

export interface NativeRestoreResult {
  status: 'success' | 'failed' | 'unavailable';
  entitlements: RestoreEntitlement[];
  errorCode?: string;
}

export interface NativeAdResult {
  status: AdOutcomeStatus;
  rewardToken?: string;
  errorCode?: string;
}

/**
 * Contract implemented by the local Capacitor plugin `TurboRoadNative`.
 * Every call returns a Promise and the TS layer adds a timeout. The plugin
 * must never invent a completed ad or a verified purchase.
 */
export interface NativeBridge {
  purchase(sku: ShopProductSku): Promise<NativePurchaseResult>;
  restore(): Promise<NativeRestoreResult>;
  showRewarded(placement: RewardedPlacement): Promise<NativeAdResult>;
  showInterstitial?(): Promise<NativeAdResult>;
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
  /**
   * Native SDKs are asynchronous and own their own fullscreen UI. When this is
   * present the React sandbox overlay must NOT be shown. A completed status is
   * the only outcome that may grant a reward.
   */
  showRewarded?(placement: RewardedPlacement): Promise<AdOutcome>;
  showInterstitial?(): Promise<AdOutcome>;
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
      error: 'billing-unavailable',
    };
  }

  async restore(): Promise<RestoreOutcome> {
    return {
      status: 'unavailable',
      entitlements: [],
      sandbox: false,
      error: 'billing-unavailable',
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

/**
 * Production is the safe default. An unset variable used to fall back to the
 * sandbox simulator, which would hand out fake purchases and fake ad rewards in
 * a real release. Only an explicit `sandbox` (or a dev build) opts in now.
 */
export function resolveMonetizationMode(
  configured: string | undefined,
  isProductionBuild: boolean
): MonetizationMode {
  if (configured === 'production') return 'production';
  if (configured === 'sandbox') return 'sandbox';
  // Unset: dev builds may simulate, real builds never do.
  return isProductionBuild ? 'production' : 'sandbox';
}

function currentMode(): MonetizationMode {
  try {
    return resolveMonetizationMode(
      import.meta.env?.VITE_MONETIZATION_MODE,
      Boolean(import.meta.env?.PROD)
    );
  } catch {
    return 'production';
  }
}

export const monetizationMode: MonetizationMode = currentMode();

/** Bridge installed by the local Capacitor plugin, if the app runs natively. */
export function getNativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null;
  // Any of: window.TurboRoadNative (custom), window.Capacitor.Plugins.TurboRoadNative.
  const direct = (window as unknown as { TurboRoadNative?: Partial<NativeBridge> }).TurboRoadNative;
  if (direct && typeof direct.purchase === 'function') {
    return direct as NativeBridge;
  }
  const capacitorPlugin = (
    window as unknown as { Capacitor?: { Plugins?: Record<string, Partial<NativeBridge>> } }
  ).Capacitor?.Plugins?.TurboRoadNative;
  if (!capacitorPlugin || typeof capacitorPlugin.purchase !== 'function') return null;
  // Capacitor plugin methods take an options object and return a Promise with a
  // JSObject; adapt the positional NativeBridge contract.
  const call = <T>(method: string, args?: unknown): Promise<T> => {
    const fn = (capacitorPlugin as unknown as Record<string, (a?: unknown) => Promise<T>>)[method];
    if (typeof fn !== 'function') {
      return Promise.resolve({ status: 'unavailable' } as T);
    }
    return fn.apply(capacitorPlugin, args === undefined ? [] : [args]);
  };
  const bridge: NativeBridge = {
    purchase: (sku) => call('purchase', { sku }),
    restore: () => call('restore'),
    showRewarded: (placement) => call('showRewarded', { placement }),
    showInterstitial: () =>
      typeof capacitorPlugin.showInterstitial === 'function'
        ? call('showInterstitial')
        : Promise.resolve({ status: 'unavailable' }),
  };
  return bridge;
}

const NATIVE_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, NATIVE_TIMEOUT_MS);
    promise.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

/**
 * Billing through the native bridge. A grant is only returned for a `success`
 * that carries a transaction id; the bridge itself is responsible for server
 * receipt verification before it reports success.
 */
export class NativeBillingProvider implements BillingProvider {
  readonly id = 'native-billing';
  readonly mode: MonetizationMode = 'production';
  readonly isSandbox = false;
  constructor(private readonly bridge: NativeBridge) {}

  async purchase(sku: ShopProductSku): Promise<PurchaseOutcome> {
    const result = await withTimeout<NativePurchaseResult>(
      this.bridge.purchase(sku),
      { status: 'failed', errorCode: 'timeout' }
    );
    if (result.status === 'success' && result.transactionId) {
      return {
        status: 'success',
        sku: result.sku ?? sku,
        transactionId: result.transactionId,
        sandbox: false,
      };
    }
    if (result.status === 'success') {
      // A success without proof is a failure, never a free grant.
      return { status: 'failed', sku, sandbox: false, error: 'missing-transaction-id' };
    }
    return {
      status: result.status,
      sku,
      sandbox: false,
      error: result.errorCode,
    };
  }

  async restore(): Promise<RestoreOutcome> {
    const result = await withTimeout<NativeRestoreResult>(
      this.bridge.restore(),
      { status: 'failed', entitlements: [], errorCode: 'timeout' }
    );
    return {
      status: result.status,
      entitlements: Array.isArray(result.entitlements)
        ? result.entitlements.filter(
            (item) => typeof item?.sku === 'string' && typeof item?.transactionId === 'string'
          )
        : [],
      sandbox: false,
      error: result.errorCode,
    };
  }
}

/**
 * Ads through the native bridge. The native SDK owns its fullscreen UI, so
 * `beginRewarded` is unavailable and the React countdown overlay is skipped.
 */
export class NativeAdProvider implements AdProvider {
  readonly id = 'native-ads';
  readonly mode: MonetizationMode = 'production';
  readonly isSandbox = false;
  constructor(private readonly bridge: NativeBridge) {}

  isRewardedAvailable(_placement: RewardedPlacement): boolean {
    return true;
  }

  beginRewarded(_placement: RewardedPlacement): null {
    return null;
  }

  async showRewarded(placement: RewardedPlacement): Promise<AdOutcome> {
    const result = await withTimeout<NativeAdResult>(
      this.bridge.showRewarded(placement),
      { status: 'failed', errorCode: 'timeout' }
    );
    if (result.status === 'completed' && result.rewardToken) {
      return {
        status: 'completed',
        placement,
        rewardToken: result.rewardToken,
        sandbox: false,
      };
    }
    if (result.status === 'completed') {
      // No reward token means no reward.
      return { status: 'failed', placement, sandbox: false, error: 'missing-reward-token' };
    }
    return { status: result.status, placement, sandbox: false, error: result.errorCode };
  }

  async showInterstitial(): Promise<AdOutcome> {
    if (typeof this.bridge.showInterstitial !== 'function') {
      return { status: 'unavailable', placement: 'continue_level', sandbox: false };
    }
    const result = await withTimeout<NativeAdResult>(
      this.bridge.showInterstitial(),
      { status: 'failed', errorCode: 'timeout' }
    );
    return {
      status: result.status,
      placement: 'continue_level',
      sandbox: false,
      error: result.errorCode,
    };
  }
}

function resolveProviders(): { billing: BillingProvider; ads: AdProvider } {
  if (monetizationMode === 'sandbox') {
    return { billing: new SandboxBillingProvider(), ads: new SandboxAdProvider() };
  }
  const bridge = getNativeBridge();
  if (bridge) {
    return { billing: new NativeBillingProvider(bridge), ads: new NativeAdProvider(bridge) };
  }
  return { billing: new UnavailableBillingProvider(), ads: new UnavailableAdProvider() };
}

const resolved = resolveProviders();

export const billingProvider: BillingProvider = resolved.billing;
export const adProvider: AdProvider = resolved.ads;

/** Lets the UI label real sandbox vs. real-store vs. disabled honestly. */
export const providerKind: ProviderKind =
  monetizationMode === 'sandbox' ? 'sandbox' : getNativeBridge() ? 'native' : 'unavailable';
