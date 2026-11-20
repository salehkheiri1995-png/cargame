import { SHOP_PRODUCTS } from '../data/economy';
import type { SaveData, ShopProduct, ShopProductSku } from '../types';

export type RewardedPlacement =
  | 'double_coins'
  | 'revive_crash'
  | 'free_coins_shop'
  | 'daily_reward_2x'
  | 'continue_level';

export interface AdRequestResult {
  completed: boolean;
  grantNonce: string;
}

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  transactionId?: string;
  sku: ShopProductSku;
}

/**
 * Decoupled Ad & IAP Architecture matching Unity C# interfaces:
 * - IAdProvider (Tapsell Plus / AdMob adapter on Android; Sandbox simulator on Web)
 * - IBillingProvider (Cafe Bazaar Poolakey SDK on Android; Sandbox test verifier on Web)
 */
class MonetizationService {
  private racesSinceLastInterstitial = 0;
  private consumedRewardNonces = new Set<string>();
  private readonly INTERSTITIAL_FREQUENCY = 2; // Show interstitial every 2 races max

  public shouldShowBanner(removeAdsOwned: boolean, isGameplay: boolean): boolean {
    if (isGameplay) return false; // Never show banners during driving
    if (removeAdsOwned) return false;
    return true;
  }

  public shouldShowInterstitial(removeAdsOwned: boolean): boolean {
    if (removeAdsOwned) return false;
    this.racesSinceLastInterstitial++;
    if (this.racesSinceLastInterstitial >= this.INTERSTITIAL_FREQUENCY) {
      this.racesSinceLastInterstitial = 0;
      return true;
    }
    return false;
  }

  public createRewardNonce(placement: RewardedPlacement): string {
    return `rw_${placement}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  public consumeRewardNonce(nonce: string): boolean {
    if (!nonce || this.consumedRewardNonces.has(nonce)) {
      return false; // Prevents duplicate reward grants
    }
    this.consumedRewardNonces.add(nonce);
    return true;
  }

  public getProductBySku(sku: ShopProductSku): ShopProduct | undefined {
    return SHOP_PRODUCTS.find((p) => p.sku === sku);
  }

  /**
   * Applies verified purchase entitlements to SaveData safely with duplicate-transaction guard.
   */
  public applyVerifiedPurchase(
    save: SaveData,
    sku: ShopProductSku,
    transactionId: string
  ): { nextSave: SaveData; applied: boolean } {
    if (save.processedTransactions.includes(transactionId)) {
      return { nextSave: save, applied: false };
    }
    const product = this.getProductBySku(sku);
    if (!product) {
      return { nextSave: save, applied: false };
    }

    // Prevent re-purchasing non-consumables
    if (!product.consumable) {
      if (sku === 'remove_ads' && save.removeAdsOwned) return { nextSave: save, applied: false };
      if (sku === 'starter_pack' && save.starterPackOwned) return { nextSave: save, applied: false };
      if (sku === 'premium_car' && save.premiumCarOwned) return { nextSave: save, applied: false };
    }

    const ownedCars = [...save.ownedCars];
    if (product.carGrantId && !ownedCars.includes(product.carGrantId)) {
      ownedCars.push(product.carGrantId);
    }

    const nextSave: SaveData = {
      ...save,
      coins: save.coins + (product.coinsGrant ?? 0),
      ownedCars,
      removeAdsOwned: save.removeAdsOwned || Boolean(product.removesAds),
      starterPackOwned: save.starterPackOwned || sku === 'starter_pack',
      premiumCarOwned: save.premiumCarOwned || sku === 'premium_car',
      processedTransactions: [...save.processedTransactions, transactionId],
    };

    return { nextSave, applied: true };
  }

  public restorePermanentPurchases(save: SaveData): SaveData {
    // On Android, this queries Cafe Bazaar Poolakey `getPurchasedProducts()`
    // and reconciles non-consumables (`remove_ads`, `starter_pack`, `premium_car`).
    const ownedCars = [...save.ownedCars];
    if (save.starterPackOwned && !ownedCars.includes('turbo_coupe')) {
      ownedCars.push('turbo_coupe');
    }
    if (save.premiumCarOwned && !ownedCars.includes('golden_phantom')) {
      ownedCars.push('golden_phantom');
    }
    return {
      ...save,
      ownedCars,
      removeAdsOwned: save.removeAdsOwned || save.starterPackOwned,
    };
  }
}

export const monetizationService = new MonetizationService();
