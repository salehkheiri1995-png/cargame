# Turbo Road — جاده توربو

A bilingual (Persian/English, RTL/LTR) 3D arcade racing game built with React 19,
TypeScript, Vite and Three.js. It ships endless mode, 45 level missions, a 3D
garage with paint/upgrades, daily missions and rewards, touch and keyboard
controls, and an HDR post-processing pipeline. The same web codebase also ships
as an Android app via Capacitor (WebView).

Everything runs client-side. There is no game server and no API key is needed to
play.

## Requirements

- Node.js 20+ (developed on Node 22)
- npm 10+ (a `bun.lock` file exists in the repo, but the scripts below use npm
  and `package-lock.json` — this is the source of truth for builds)
- A WebGL2-capable browser
- For Android: JDK 21 (the Capacitor 7 Android target is Java 21), Android SDK
  (platform 35), and `local.properties` pointing `sdk.dir` at your SDK

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

Android (see the Android section below for prerequisites):

```bash
npm run build:android     # vite build + cap sync android
npm run android:assemble  # vite build + cap sync + gradle assembleDebug
npm run android:run       # run on a connected device/emulator
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

- **Sandbox (web/dev):** deterministic fake store and one-shot rewarded ads
  used for development. A sandbox ad session yields `completed` at most once.
  The UI visibly labels it "Sandbox".
- **Production:** the safe default for release builds. If
  `VITE_MONETIZATION_MODE` is unset, a production build resolves to
  `production` and uses `UnavailableBillingProvider` / `UnavailableAdProvider`
  (nothing is granted). When a native provider is present
  (`window.Capacitor.Plugins.TurboRoadNative`), `NativeBillingProvider` /
  `NativeAdProvider` are used and only grant on a genuinely completed
  ad/verified purchase.

The provider is chosen by a pure `resolveMonetizationMode(configured, isProd)`
function:

| Mode (env) | Web/dev | Release without native bridge | Release with native bridge |
|---|---|---|---|
| `sandbox` | Sandbox | Sandbox | Sandbox |
| `production` | Unavailable | Unavailable | Native |
| unset | Sandbox | Unavailable | Native |

The client contains no API keys, SDK keys, or keystore secrets. Real receipt
validation must happen on a backend that can query the store; never trust a
client-provided receipt.

`economyOps.ts` re-validates against the latest save on every call:

- `buyCar` checks existence, ownership and balance;
- `upgradeStat` checks ownership, stat key and `MAX_UPGRADE_LEVEL` (5) via
  `getUpgradeCost`;
- `setCarPaint` validates the color palette;
- `applyPurchaseToSave` deduplicates transaction IDs and caps the ledger;
- `applyPurchaseOutcome` is the single gate for billing results: cancelled,
  failed and unavailable outcomes grant nothing, and success without a
  transaction ID is treated as a failure.
- `claimFreeCoinsAdReward` enforces a daily cap (5) and a 60 s cooldown for the
  rewarded shop ad; counters migrate in place without resetting progress.

## Android (Capacitor)

The Android app is a Capacitor WebView around the same `dist/` build.

- Config: `capacitor.config.json` (`appId: ir.example.turboroad`, `webDir: dist`).
- The Vite build uses a relative `base: './'`, so assets resolve inside the
  WebView and on any static host.
- Fonts are bundled in `src/assets/fonts/` (woff2 subsets) and referenced from
  `src/index.css`; the app is fully offline-capable (no CDN dependency at
  runtime).
- `android/app/src/main/AndroidManifest.xml` forces landscape
  (`sensorLandscape`), enables hardware acceleration, and uses a dark theme.
- `MainActivity.java` enables immersive fullscreen (system bars hidden) and
  re-applies it when the window regains focus.
- **Save storage:** `localStorage` is mirrored to `@capacitor/preferences`
  (async) with a hydration step before React mounts
  (`src/game/services/nativeStorage.ts`). On Android the newer `lastSavedAt`
  wins, backups are mirrored too, and pending-race records survive an abrupt
  close.
- **Back button / lifecycle** (`src/game/services/platform.ts`): Back pauses the
  race, then shows the pause menu, then navigates to the menu; at the root it
  shows an exit confirmation. On backgrounding the race auto-pauses, audio is
  suspended and the render loop stops; on resume everything resumes without a
  dt spike.
- **Haptics** (`src/game/services/haptics.ts`): `@capacitor/haptics` on native,
  `navigator.vibrate` fallback on web, honouring the player setting.
- **Native monetization bridge:** `TurboRoadNativePlugin.java` registers the
  `TurboRoadNative` bridge. It currently returns `unavailable` for every
  operation (no fake grants). Wiring a real store SDK and a server receipt
  validator is the remaining integration step (see "Real integration needs").

Building the debug APK (Windows PowerShell):

```powershell
$env:JAVA_HOME = "C:\Android\jdk21\jdk-21.0.13+9"   # JDK 21
cd android
.\gradlew.bat assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

The release keystore is intentionally never committed (see `.gitignore`). See
"Release checklist" below.

## Graphics and performance

Settings (persisted in the save) include quality (`auto`/`low`/`medium`/`high`),
camera shake, reduce motion, chromatic aberration, film grain, speed lines,
bloom, steering dead zone, handedness, touch control size and opacity.

`Auto` starts conservatively, samples frame time, scales render resolution
within hysteresis bounds, and applies changes after a cooldown. It pauses
adaptation while the tab is hidden. A debug panel (FPS, frame time, draw calls,
triangles, geometry/texture counts, pixel ratio, effective quality/scale) is
wired only when running a dev build or when the URL contains `?debug=1`; it is
never active in a release build. A "Battery Saver" setting caps the render/update
loop at ~30 FPS (game speed is dt-based and unaffected).

The renderer disposes per-car geometry/materials/textures, pooled traffic and
pickups, the PMREM environment target, post-processing targets and passes,
listeners and the animation frame on unmount. `dispose()` is idempotent.

WebGL context loss is handled (`webglcontextlost` → `preventDefault`), the loop
stops while the app is hidden, and inputs reset on blur/visibility change.

## Tests

`npm test` runs the `node:test` suites through `tsx`:

- `saveSystem.test.ts` — normalization/migration, corrupt values, backup
  fallback, duplicate settlement, mission and daily-reward rules.
- `economyOps.test.ts` — car purchase, upgrade caps, insufficient coins,
  duplicate transactions, cancelled/failed purchase outcomes, provider mode
  resolution and native bridge safety (no grant without proofs).
- `raceSession.test.ts` — restart/revive IDs, duplicate end callbacks,
  double-coins guards.
- `androidFixes.test.ts` — usable-save detection (empty primary → backup),
  free-coins ad caps/cooldown, and launching a race while a revive is open.

WebGL behaviour (visuals, disposal, adaptive quality) cannot be verified in
Node. Use the checklist below manually.

## Release checklist

1. Create a keystore and keep it OUT of the repository:
   `keytool -genkey -v -keystore turbo-road-release.keystore -alias turbo-road -keyalg RSA -keysize 2048 -validity 10000`
2. Create `android/keystore.properties` locally (gitignored) with
   `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. Configure the
   `release` buildType to read it (currently the release buildType is present
   but not signing — add `signingConfig` when you are ready to publish).
3. Build a signed release:
   `cd android && .\gradlew.bat assembleRelease` (or `bundleRelease` for AAB).
4. Confirm `VITE_MONETIZATION_MODE` is NOT `sandbox` in release builds.
5. Only enable real monetization after wiring a store SDK + ad SDK + server
   receipt validator and updating `TurboRoadNativePlugin.java`.

## Real integration needs (not yet implemented)

These require real developer accounts/SDKs and are intentionally stubbed:

- **Store billing:** Cafe Bazaar (Poolakey), Myket, or Google Play Billing in
  `TurboRoadNativePlugin.purchase/restore`. Requires the marketplace's SDK and
  a registered app.
- **Ad network:** Tapsell or AdMob in `showRewarded/showInterstitial`. Requires
  an ad-unit/app key.
- **Server-side receipt validation:** an endpoint that verifies a store receipt
  (for `applyPurchaseOutcome`). Until this exists, purchases are not enabled.

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

- The production billing/ad providers are stubs by design until real SDKs and a
  receipt validator are wired (see "Real integration needs").
- Multi-tab play is not merged (last write wins).
- There is no server-side leaderboard or receipt validation yet.
- Android performance/UX was verified on the emulator where possible; the final
  target-device checklist is at the end of this project's report.
