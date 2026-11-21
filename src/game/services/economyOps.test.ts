import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDefaultUpgrades, MAX_UPGRADE_LEVEL, VEHICLE_MAP } from '../data/vehicles';
import type { SaveData } from '../types';
import {
  applyPurchaseToSave,
  applyPurchaseOutcome,
  buyCar,
  equipCar,
  grantCoins,
  restoreEntitlements,
  setCarPaint,
  upgradeStat,
} from './economyOps';
import {
  UnavailableBillingProvider,
  SandboxAdProvider,
  UnavailableAdProvider,
} from './providers';
import { createDefaultSave, MAX_COINS, STARTING_CAR_ID } from './saveSystem';

const affordableCar = Object.values(VEHICLE_MAP)
  .filter((car) => !car.isPremiumExclusive && car.price > 0)
  .sort((a, b) => a.price - b.price)[0];

function saveWithCoins(coins: number): SaveData {
  return { ...createDefaultSave(), coins };
}

describe('garage economy operations', () => {
  it('rejects buying a car without enough coins', () => {
    const save = saveWithCoins(affordableCar.price - 1);
    const result = buyCar(save, affordableCar.id);
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'insufficient-coins');
    assert.equal(result.save.coins, save.coins);
  });

  it('deducts the trusted price and adds ownership/color/default upgrades', () => {
    const save = saveWithCoins(affordableCar.price + 25);
    const result = buyCar(save, affordableCar.id);
    assert.equal(result.applied, true);
    assert.equal(result.spent, affordableCar.price);
    assert.equal(result.save.coins, 25);
    assert.ok(result.save.ownedCars.includes(affordableCar.id));
    assert.equal(result.save.selectedCarId, affordableCar.id);
    assert.equal(result.save.carColors[affordableCar.id], affordableCar.defaultColor);
    assert.deepEqual(result.save.carUpgrades[affordableCar.id], getDefaultUpgrades());

    const duplicate = buyCar(result.save, affordableCar.id);
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.reason, 'already-owned');
  });

  it('does not equip an unowned car or paint an unowned car', () => {
    const save = createDefaultSave();
    assert.equal(equipCar(save, 'golden_phantom').applied, false);
    assert.equal(setCarPaint(save, 'golden_phantom', '#112233').applied, false);
  });

  it('validates paint hex values', () => {
    const save = createDefaultSave();
    assert.equal(setCarPaint(save, STARTING_CAR_ID, 'red').applied, false);
    const ok = setCarPaint(save, STARTING_CAR_ID, '#AABBCC');
    assert.equal(ok.applied, true);
    assert.equal(ok.save.carColors[STARTING_CAR_ID], '#aabbcc');
  });

  it('recomputes upgrade cost from the latest save and enforces the cap', () => {
    const save = saveWithCoins(1_000_000);
    let current = save;
    for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) {
      const step = upgradeStat(current, STARTING_CAR_ID, 'speed');
      assert.equal(step.applied, true);
      current = step.save;
    }
    assert.equal(current.carUpgrades[STARTING_CAR_ID].speed, MAX_UPGRADE_LEVEL);
    const capped = upgradeStat(current, STARTING_CAR_ID, 'speed');
    assert.equal(capped.applied, false);
    assert.equal(capped.reason, 'max-level');
  });

  it('refuses an upgrade when coins are insufficient', () => {
    const save = saveWithCoins(0);
    const result = upgradeStat(save, STARTING_CAR_ID, 'nitro');
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'insufficient-coins');
  });

  it('clamps granted coins to the global maximum', () => {
    const save = saveWithCoins(MAX_COINS - 10);
    const result = grantCoins(save, 100);
    assert.equal(result.applied, true);
    assert.equal(result.save.coins, MAX_COINS);
  });
});

describe('store entitlements', () => {
  it('credits a consumable purchase once per transaction id', () => {
    const save = saveWithCoins(0);
    const first = applyPurchaseToSave(save, 'coins_500', 'tx-coins-1');
    assert.equal(first.applied, true);
    assert.equal(first.save.coins, 500);

    const duplicate = applyPurchaseToSave(first.save, 'coins_500', 'tx-coins-1');
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.reason, 'duplicate-transaction');
    assert.equal(duplicate.save.coins, 500);
  });

  it('grants nothing for cancelled, failed or unavailable purchase outcomes', () => {
    const save = saveWithCoins(0);
    for (const status of ['cancelled', 'failed', 'unavailable'] as const) {
      const result = applyPurchaseOutcome(save, 'coins_500', {
        status,
        sku: 'coins_500',
        sandbox: status !== 'unavailable',
      });
      assert.equal(result.applied, false);
      assert.equal(result.status, status);
      assert.equal(result.save.coins, 0);
      assert.deepEqual(result.save.processedTransactions, []);
    }
  });

  it('treats a success outcome without a transaction id as a failure', () => {
    const save = saveWithCoins(0);
    const result = applyPurchaseOutcome(save, 'coins_500', {
      status: 'success',
      sku: 'coins_500',
      sandbox: true,
    });
    assert.equal(result.applied, false);
    assert.equal(result.save.coins, 0);
    assert.deepEqual(result.save.processedTransactions, []);
  });

  it('applies a verified success outcome exactly once', () => {
    const save = saveWithCoins(0);
    const outcome = {
      status: 'success' as const,
      sku: 'coins_500' as const,
      sandbox: true,
      transactionId: 'tx-outcome-1',
    };
    const first = applyPurchaseOutcome(save, 'coins_500', outcome);
    assert.equal(first.applied, true);
    assert.equal(first.save.coins, 500);
    const again = applyPurchaseOutcome(first.save, 'coins_500', outcome);
    assert.equal(again.applied, false);
    assert.equal(again.save.coins, 500);
  });

  it('consumes a replayed receipt for an already-owned permanent product without paying twice', () => {
    const save: SaveData = { ...createDefaultSave(), removeAdsOwned: true };
    const replay = applyPurchaseToSave(save, 'remove_ads', 'tx-remove-2');
    assert.equal(replay.applied, false);
    assert.equal(replay.reason, 'already-owned-entitlement');
    assert.ok(replay.save.processedTransactions.includes('tx-remove-2'));
    assert.equal(replay.save.coins, save.coins);
  });

  it('rejects malformed or empty transaction ids', () => {
    const save = createDefaultSave();
    assert.equal(applyPurchaseToSave(save, 'coins_500', '').applied, false);
    assert.equal(applyPurchaseToSave(save, 'coins_500', 'tx').reason, 'invalid-transaction');
  });

  it('restores entitlements idempotently from provider receipts', () => {
    const save = createDefaultSave();
    const entitlements = [
      { sku: 'starter_pack' as const, transactionId: 'tx-starter-1' },
      { sku: 'premium_car' as const, transactionId: 'tx-premium-1' },
    ];
    const first = restoreEntitlements(save, entitlements);
    assert.equal(first.applied, true);
    assert.ok(first.save.starterPackOwned);
    assert.ok(first.save.premiumCarOwned);
    assert.ok(first.save.ownedCars.includes('turbo_coupe'));
    assert.ok(first.save.ownedCars.includes('golden_phantom'));

    const second = restoreEntitlements(first.save, entitlements);
    assert.equal(second.save.coins, first.save.coins);
    assert.equal(second.save.processedTransactions.length, 2);
  });
});

describe('monetization provider contracts', () => {
  it('never grants a production purchase when no real provider is configured', async () => {
    const provider = new UnavailableBillingProvider();
    const outcome = await provider.purchase('remove_ads');
    assert.equal(outcome.status, 'unavailable');
    assert.equal(outcome.sandbox, false);
    assert.equal(outcome.transactionId, undefined);

    const restore = await provider.restore();
    assert.equal(restore.status, 'unavailable');
    assert.deepEqual(restore.entitlements, []);
  });

  it('settles a sandbox rewarded ad exactly once', () => {
    const provider = new SandboxAdProvider();
    assert.equal(provider.isRewardedAvailable('double_coins'), true);
    const session = provider.beginRewarded('double_coins');
    assert.ok(session);

    const first = session!.complete();
    assert.equal(first.status, 'completed');
    assert.ok(first.rewardToken);

    const second = session!.complete();
    assert.equal(second.status, 'failed');
  });

  it('reports unavailable when production ads are not configured', () => {
    const provider = new UnavailableAdProvider();
    assert.equal(provider.isRewardedAvailable('revive_crash'), false);
    assert.equal(provider.beginRewarded('revive_crash'), null);
  });
});
