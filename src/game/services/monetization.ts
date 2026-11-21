import { SHOP_PRODUCTS } from '../data/economy';
import type { ShopProduct, ShopProductSku } from '../types';
import {
  adProvider,
  billingProvider,
  monetizationMode,
  providerKind,
  type AdOutcome,
  type AdProvider,
  type AdSession,
  type BillingProvider,
  type ProviderKind,
  type PurchaseOutcome,
  type RestoreOutcome,
  type RewardedPlacement,
} from './providers';

export type { RewardedPlacement } from './providers';
export {
  adProvider,
  billingProvider,
  monetizationMode,
  providerKind,
} from './providers';

/**
 * Small orchestration layer over the provider contracts:
 * - banner/interstitial frequency policy (pure UI concerns)
 * - product lookup for the shop UI
 * - provider access so UI code never fabricates transactions
 *
 * Reward grants are NOT implemented here. Callers go through validated
 * economy operations keyed by the race/mission ID, so duplicate ad callbacks
 * and duplicate purchases are safe.
 */
class MonetizationService {
  private racesSinceLastInterstitial = 0;
  private readonly INTERSTITIAL_FREQUENCY = 2; // Show interstitial every 2 races max

  public get mode() {
    return monetizationMode;
  }

  public get isSandbox(): boolean {
    return billingProvider.isSandbox || adProvider.isSandbox;
  }

  /** 'sandbox' | 'native' | 'unavailable' — for honest UI labels. */
  public get providerKind(): ProviderKind {
    return providerKind;
  }

  /**
   * Native ad SDKs own the fullscreen UI. When this is true callers must await
   * `showRewardedAsync` and skip the React countdown overlay entirely.
   */
  public get hasNativeAds(): boolean {
    return typeof adProvider.showRewarded === 'function';
  }

  public async showRewardedAsync(placement: RewardedPlacement): Promise<AdOutcome> {
    if (!adProvider.showRewarded) {
      return { status: 'unavailable', placement, sandbox: false };
    }
    try {
      return await adProvider.showRewarded(placement);
    } catch {
      return { status: 'failed', placement, sandbox: false, error: 'ad-exception' };
    }
  }

  public async showInterstitialAsync(): Promise<AdOutcome> {
    if (!adProvider.showInterstitial) {
      return { status: 'unavailable', placement: 'continue_level', sandbox: false };
    }
    try {
      return await adProvider.showInterstitial();
    } catch {
      return { status: 'failed', placement: 'continue_level', sandbox: false, error: 'ad-exception' };
    }
  }

  public get billing(): BillingProvider {
    return billingProvider;
  }

  public get ads(): AdProvider {
    return adProvider;
  }

  public shouldShowBanner(removeAdsOwned: boolean, isGameplay: boolean): boolean {
    if (isGameplay) return false; // Never show banners during driving
    if (removeAdsOwned) return false;
    return adProvider.isRewardedAvailable('free_coins_shop') || billingProvider.isSandbox;
  }

  public shouldShowInterstitial(removeAdsOwned: boolean): boolean {
    if (removeAdsOwned) return false;
    // Production ads are not configured yet: never simulate an interstitial there.
    if (!adProvider.isSandbox && !adProvider.isRewardedAvailable('double_coins')) return false;
    this.racesSinceLastInterstitial++;
    if (this.racesSinceLastInterstitial >= this.INTERSTITIAL_FREQUENCY) {
      this.racesSinceLastInterstitial = 0;
      return true;
    }
    return false;
  }

  public getProductBySku(sku: ShopProductSku): ShopProduct | undefined {
    return SHOP_PRODUCTS.find((p) => p.sku === sku);
  }

  public isRewardedAvailable(placement: RewardedPlacement): boolean {
    return adProvider.isRewardedAvailable(placement);
  }

  public beginRewarded(placement: RewardedPlacement): AdSession | null {
    return adProvider.beginRewarded(placement);
  }

  public completeAd(session: AdSession): AdOutcome {
    return session.complete();
  }

  public purchase(sku: ShopProductSku): Promise<PurchaseOutcome> {
    return billingProvider.purchase(sku);
  }

  public restore(): Promise<RestoreOutcome> {
    return billingProvider.restore();
  }
}

export const monetizationService = new MonetizationService();
