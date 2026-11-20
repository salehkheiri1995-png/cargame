# Turbo Road — جاده توربو

A bilingual (Persian/English, RTL/LTR) 3D arcade racing game built with React 19,
TypeScript, Vite and Three.js. It ships endless mode, 45 level missions, a 3D
garage with paint/upgrades, daily missions and rewards, touch and keyboard
controls, and an HDR post-processing pipeline.

Everything runs client-side. There is no game server and no API key is needed to
play.

## Requirements

- Node.js 20+ (developed on Node 22)
- npm 10+ (a `bun.lock` file exists in the repo, but the scripts below use npm
  and `package-lock.json`)
- A WebGL2-capable browser

## Commands

All commands work on Windows PowerShell, macOS and Linux:

```bash
npm install
npm run dev        # Vite dev server on 0.0.0.0:3000
npm run typecheck  # tsc --noEmit
npm run lint       # currently the same as typecheck
npm test           # node:test suites via tsx
npm run build      # production build into dist/
npm run preview    # serve the built output
npm run clean      # delete dist/
```

The project has no separate ESLint configuration; `lint` is intentionally
aliased to the TypeScript compiler so CI can call either name.

## Project layout

```
src/
  App.tsx                     app shell, race lifecycle, ads/purchases, settings sync
  components/
    MainMenuOverlay.tsx       menu, language, mute, daily badge
    ModeAndLevelsOverlay.tsx  endless / level selection
    GarageOverlay.tsx         3D garage UI, paint and upgrades
    RaceHudOverlay.tsx        in-race HUD, touch controls, countdown, tutorial
    EconomyModals.tsx         shop, daily missions, settings
  game/
    types.ts                  shared contracts (save, settings, HUD, debug stats)
    i18n.ts                   Persian/English strings and formatters
    data/                     vehicles, levels, environments, economy tables
    services/
      saveSystem.ts           validation, migration, persistence, settlement
      economyOps.ts           purchases, cars, paint, upgrades (pure functions)
      raceSession.ts          exactly-once race lifecycle
      providers.ts            billing/ad contracts + sandbox implementations
      monetization.ts         thin facade used by the UI
      audioEngine.ts          WebAudio engine/sfx
    three/
      gameEngine.ts           scene, rendering loop, Auto quality, disposal
      carBuilder.ts           procedural car meshes
      worldBuilder.ts         environments and props
      postProcessing.ts       bloom, vignette, grain, chromatic aberration
      textures.ts             canvas-generated textures
      humanBuilder.ts         crowd/rival figures
```

## Save data

- Primary key: `turbo_road_save_v3`
- Backup key: `turbo_road_save_v3_backup`
- Pending-race key: `turbo_road_pending_race_v1`

`validateAndNormalizeSave()` is the only entry point for untrusted data. It:

- migrates older versions, then writes the current version;
- clamps coins, stars, mission progress, streaks and ledger sizes;
- whitelists `ownedCars`, upgrades, paint colors, environments and settings;
- forces the starting car to stay owned and repairs `selectedCarId`;
- normalizes date keys and resets daily missions/streak on a new day;
- bounds `processedTransactions`, `settledRaceIds` and `doubleBonusRaceIds`.

Loading tries the primary slot, then the backup, then the legacy key. If the
primary is unreadable the UI shows a non-blocking notice
(`saveRecovered`). A write failure surfaces `saveErrorQuota` or
`saveErrorGeneric`; it is never swallowed silently.

Multi-tab policy is intentionally last-write-wins: there is no merge. The
checksum is a corruption/accidental-edit detector computed on the client, not an
anti-cheat or purchase-verification mechanism.

## Race settlement rules

A race is identified by a stable `raceId` created when the race starts.

- Restarting creates a new `raceId`; reviving keeps the same one.
- `recordRaceEnd` is idempotent: duplicate engine callbacks are ignored once a
  result exists.
- `settleSession` settles once per `raceId`; the save also keeps a bounded
  `settledRaceIds` ledger, so a reload or replay cannot pay twice.
- `totalRaces`, level stars, records and mission progress only advance inside a
  settlement, never in an event handler.
- The double-coins bonus requires a settled race that has not yet used
  `doubleBonusRaceIds`; a revive can never be combined with a second payout for
  the same crash.
- A crash that offers a revive persists a pending race so a reload can resume or
  settle it instead of losing rewards.

## Economy and providers

`src/game/services/providers.ts` defines the `BillingProvider` and `AdProvider`
contracts.

- **Sandbox (default):** deterministic fake store and one-shot rewarded ads
  used for development. A sandbox ad session yields `completed` at most once.
- **Production:** `VITE_MONETIZATION_MODE=production` selects
  `UnavailableBillingProvider` / `UnavailableAdProvider`, which never grant
  rewards. The placeholder classes must be replaced with real
  store/AdMob/Play Billing integrations before shipping monetization.

The client contains no API keys or secrets. Real receipt validation must happen
on a backend that can query the store; never trust a client-provided receipt.

`economyOps.ts` re-validates against the latest save on every call:

- `buyCar` checks existence, ownership and balance;
- `upgradeStat` checks ownership, stat key and `MAX_UPGRADE_LEVEL` (5) via
  `getUpgradeCost`;
- `setCarPaint` validates the color palette;
- `applyPurchaseToSave` deduplicates transaction IDs and caps the ledger;
- `applyPurchaseOutcome` is the single gate for billing results: cancelled,
  failed and unavailable outcomes grant nothing, and success without a
  transaction ID is treated as a failure.

## Graphics and performance

Settings (persisted in the save) include quality (`auto`/`low`/`medium`/`high`),
camera shake, reduce motion, chromatic aberration, film grain, speed lines,
bloom, steering dead zone, handedness, touch control size and opacity.

`Auto` starts conservatively, samples frame time, scales render resolution
within hysteresis bounds, and applies changes after a cooldown. It pauses
adaptation while the tab is hidden. In development builds a debug panel shows
FPS, frame time, draw calls, triangles, geometry/texture counts, pixel ratio and
the effective quality/scale.

The renderer disposes per-car geometry/materials/textures, pooled traffic and
pickups, the PMREM environment target, post-processing targets and passes,
listeners and the animation frame on unmount. `dispose()` is idempotent.

## Tests

`npm test` runs the `node:test` suites through `tsx`:

- `saveSystem.test.ts` — normalization/migration, corrupt values, backup
  fallback, duplicate settlement, mission and daily-reward rules.
- `economyOps.test.ts` — car purchase, upgrade caps, insufficient coins,
  duplicate transactions, cancelled/failed purchase outcomes.
- `raceSession.test.ts` — restart/revive IDs, duplicate end callbacks,
  double-coins guards.

WebGL behaviour (visuals, disposal, adaptive quality) cannot be verified in
Node. Use the checklist below manually.

## Manual WebGL checklist

1. Start endless mode: countdown appears, the goal is visible before control is
   handed over, and the HUD does not overlap the pause/camera buttons.
2. Crash and revive: the same race continues, the result screen appears once,
   and no extra coins are added after reload.
3. Finish a race, reload the page, and confirm coins, records, missions and
   level stars match the result screen exactly.
4. Buy a car, paint it, upgrade a stat to level 5 and confirm further upgrades
   are blocked.
5. Tap daily reward twice and confirm the second call is rejected; change the
   system date to check the next-day rollover.
6. Pause/resume, switch tabs mid-race, and background the app: touch controls
   must reset and the countdown must not skip.
7. Rotate to portrait: the landscape hint appears and the HUD stays usable.
8. Switch between Low/Medium/High/Auto and confirm resolution/bloom respond
   without stretching; watch the dev panel for scale changes.
9. Leave the garage repeatedly and check the dev panel's geometry/texture
   counts stay stable.
10. Break `localStorage` JSON manually and confirm the backup is restored with a
    notice instead of a crash.

## Known limitations

- Google Fonts are loaded from `fonts.googleapis.com` in `index.html`; self-host
  them if you need a fully offline or CSP-restricted build.
- Multi-tab play is not merged (last write wins).
- The production billing/ad providers are stubs by design.
- There is no server-side leaderboard or receipt validation yet.
