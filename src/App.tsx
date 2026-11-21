import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdPlayerOverlay,
  DailyRewardsModal,
  MissionsModal,
  SettingsModal,
  ShopModal,
} from './components/EconomyModals';
import { GarageOverlay } from './components/GarageOverlay';
import { MainMenuOverlay } from './components/MainMenuOverlay';
import { LevelMapOverlay, ModeSelectOverlay } from './components/ModeAndLevelsOverlay';
import { RaceHudOverlay } from './components/RaceHudOverlay';
import { getLevelById } from './game/data/levels';
import { computeEffectiveStats, VEHICLE_MAP } from './game/data/vehicles';
import { t } from './game/i18n';
import { audioEngine } from './game/services/audioEngine';
import {
  applyPurchaseOutcome,
  buyCar,
  equipCar,
  grantCoins,
  restoreEntitlements,
  setCarPaint,
  upgradeStat,
} from './game/services/economyOps';
import { monetizationService, type RewardedPlacement } from './game/services/monetization';
import type { AdSession } from './game/services/providers';
import {
  canOfferDouble,
  createRaceSession,
  declineRevive,
  markDoubleGranted,
  recordRaceEnd,
  reviveSession,
  settleSession,
  startNewRace,
  type RaceSession,
} from './game/services/raceSession';
import {
  claimDailyReward,
  claimMissionReward,
  clearPendingRace,
  createDefaultSave,
  grantDoubleCoinsBonus,
  loadPendingRace,
  loadSaveDataWithStatus,
  normalizeSettings,
  persistPendingRace,
  persistSaveData,
} from './game/services/saveSystem';
import { TurboRoadEngine } from './game/three/gameEngine';
import type {
  ActiveRaceConfig,
  EnvironmentId,
  GameSettings,
  LevelConfig,
  RaceHudSnapshot,
  RaceResult,
  SaveData,
  ScreenId,
  ShopProduct,
  VehicleConfig,
  VehicleUpgradeLevels,
} from './game/types';

const INITIAL_HUD: RaceHudSnapshot = {
  speedKmh: 0,
  maxSpeedKmh: 200,
  distanceM: 0,
  coinsCollected: 0,
  score: 0,
  overtakes: 0,
  combo: 1,
  nitro: 55,
  nitroActive: false,
  timeElapsed: 0,
  timeRemaining: null,
  checkpointsPassed: 0,
  nitroDistanceM: 0,
  peakSpeedKmh: 0,
  hitsTaken: 0,
  missionProgress: 0,
  missionCurrent: 0,
  missionTarget: 0,
  feedbackText: null,
  feedbackColor: '#facc15',
  feedbackId: 0,
  shieldActive: false,
  drafting: false,
  feverActive: false,
  rivalAheadDist: null,
  rivalsDefeated: 0,
  cameraMode: 'chase',
  countdown: 0,
};

const FREE_COINS_REWARD = 100;

interface PendingAd {
  kind: 'rewarded' | 'interstitial';
  session: AdSession | null;
  onReward: () => void;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TurboRoadEngine | null>(null);
  const initialLoadRef = useRef<ReturnType<typeof loadSaveDataWithStatus> | null>(null);
  const pendingAdRef = useRef<PendingAd | null>(null);
  const adBusyRef = useRef(false);
  const purchaseBusyRef = useRef(false);
  const sessionRef = useRef<RaceSession | null>(null);

  const [save, setSave] = useState<SaveData>(() => {
    const loaded = loadSaveDataWithStatus();
    initialLoadRef.current = loaded;
    return loaded.save;
  });
  const saveRef = useRef<SaveData>(save);
  saveRef.current = save;

  const [screen, setScreen] = useState<ScreenId>('splash');
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentId>('city');
  const [viewingCarId, setViewingCarId] = useState<string>(() => save.selectedCarId);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [activeRace, setActiveRace] = useState<ActiveRaceConfig | null>(null);
  const [hud, setHud] = useState<RaceHudSnapshot>(INITIAL_HUD);
  const [paused, setPaused] = useState(false);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [coinsDoubled, setCoinsDoubled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [shopStatus, setShopStatus] = useState<string | null>(null);
  const [purchasePending, setPurchasePending] = useState(false);
  const [tutorialPending, setTutorialPending] = useState(false);
  const [pendingAd, setPendingAd] = useState<PendingAd | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const lang = save.settings.language;

  /** Single source of truth for the latest save; every economy op reads this. */
  const commitSave = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
  }, []);

  // Sync HTML lang & dir (RTL Persian / LTR English)
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    engineRef.current?.setLanguage(lang);
  }, [lang]);

  // Sync audio volumes
  useEffect(() => {
    if (muted) {
      audioEngine.setVolumes(0, 0);
    } else {
      audioEngine.setVolumes(save.settings.musicVolume, save.settings.sfxVolume);
    }
  }, [muted, save.settings.musicVolume, save.settings.sfxVolume]);

  // Sync background music mode
  useEffect(() => {
    if (screen === 'playing' && !paused && !raceResult && !pendingAd) {
      audioEngine.setMusicMode('race');
    } else if (screen === 'splash' || pendingAd) {
      audioEngine.setMusicMode('none');
    } else {
      audioEngine.setMusicMode('menu');
    }
  }, [screen, paused, raceResult, pendingAd]);

  // Persist after every committed save, but never as a side effect inside a
  // React state updater. Storage failures are surfaced instead of swallowed.
  useEffect(() => {
    const result = persistSaveData(save);
    setStorageError(
      result.ok
        ? null
        : t(
            save.settings.language,
            result.error === 'quota' ? 'saveErrorQuota' : 'saveErrorGeneric'
          )
    );
  }, [save]);

  useEffect(() => {
    if (initialLoadRef.current?.recovered) {
      setSaveNotice(t(saveRef.current.settings.language, 'saveRecovered'));
    }
  }, []);

  // Recover a crash that happened right before a reload. The raceId ledger in
  // the save still guarantees the result cannot be banked twice.
  useEffect(() => {
    const pending = loadPendingRace();
    if (!pending) return;
    let session = createRaceSession(pending.raceId);
    session = recordRaceEnd(session, pending.result);
    session = declineRevive(session);
    const settlement = settleSession(session, saveRef.current);
    if (settlement.applied) commitSave(settlement.save);
    clearPendingRace();
  }, [commitSave]);

  // Stable race end handler referenced by WebGL engine
  const handleRaceEndRef = useRef<(result: RaceResult) => void>(() => {});
  handleRaceEndRef.current = (rawResult: RaceResult) => {
    const session = sessionRef.current;
    if (!session || session.phase === 'settled' || session.phase === 'finished') return;

    const currentSave = saveRef.current;
    const enriched: RaceResult = {
      ...rawResult,
      isNewBestScore:
        rawResult.mode === 'endless' && rawResult.score > currentSave.endlessBestScore,
      isNewBestDistance:
        rawResult.mode === 'endless' && rawResult.distanceM > currentSave.endlessBestDistance,
    };

    const recorded = recordRaceEnd(session, enriched);
    sessionRef.current = recorded;
    setCoinsDoubled(recorded.doubleGranted);

    if (recorded.phase === 'awaiting-revive') {
      // Do not bank yet: the player may still revive the same race.
      setRaceResult(enriched);
      persistPendingRace({
        raceId: recorded.raceId,
        result: enriched,
        savedAt: Date.now(),
      });
      return;
    }

    if (recorded.phase !== 'finished') return;

    const settlement = settleSession(recorded, currentSave);
    sessionRef.current = settlement.session;
    if (settlement.applied) commitSave(settlement.save);
    clearPendingRace();
    setRaceResult(enriched);
  };

  // Mount Three.js Game Engine ONCE in isolated canvas container
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new TurboRoadEngine(container, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onRaceEnd: (res) => handleRaceEndRef.current(res),
    });

    const initialSave = saveRef.current;
    engine.setLanguage(initialSave.settings.language);
    engine.setGraphicsQuality(initialSave.settings.graphicsQuality);
    engine.applyGameSettings(initialSave.settings);
    const carCfg = VEHICLE_MAP[initialSave.selectedCarId] ?? VEHICLE_MAP.spark_hatch;
    engine.setShowcaseCar(carCfg.id, initialSave.carColors[carCfg.id] ?? carCfg.defaultColor);

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync 3D Showcase / Garage mode & active car preview when not racing
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (screen === 'playing') return;

    engine.setViewMode(screen === 'garage' ? 'garage' : 'showcase');
    const displayCarId = screen === 'garage' ? viewingCarId : save.selectedCarId;
    const carCfg = VEHICLE_MAP[displayCarId] ?? VEHICLE_MAP.spark_hatch;
    engine.setShowcaseCar(carCfg.id, save.carColors[carCfg.id] ?? carCfg.defaultColor);
    engine.setEnvironment(selectedEnv);
  }, [screen, viewingCarId, save.selectedCarId, save.carColors, selectedEnv]);

  // Global keyboard shortcuts (Enter/Space on Splash, Esc/P for Pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen === 'splash' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        audioEngine.unlock();
        audioEngine.playButtonClick();
        setScreen('menu');
      } else if (screen === 'playing' && !raceResult && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault();
        setPaused((prev) => {
          const next = !prev;
          engineRef.current?.setPaused(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, raceResult]);

  /** Banks a crash result only when the revive offer is finally declined. */
  const commitPendingCrashIfNeeded = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.phase !== 'awaiting-revive') return;
    const declined = declineRevive(session);
    const settlement = settleSession(declined, saveRef.current);
    sessionRef.current = settlement.session;
    if (settlement.applied) commitSave(settlement.save);
    clearPendingRace();
  }, [commitSave]);

  const finishPendingAd = useCallback((completed: boolean) => {
    const ad = pendingAdRef.current;
    if (!ad) return;
    pendingAdRef.current = null;
    adBusyRef.current = false;
    setPendingAd(null);

    if (!completed) {
      ad.session?.cancel();
      return;
    }
    if (ad.kind === 'rewarded') {
      if (!ad.session) return;
      const outcome = ad.session.complete();
      if (outcome.status !== 'completed') return;
    }
    audioEngine.playRewardFanfare();
    ad.onReward();
  }, []);

  const requestRewardedAd = useCallback(
    (placement: RewardedPlacement, grantCallback: () => void) => {
      if (adBusyRef.current) return;
      const session = monetizationService.beginRewarded(placement);
      if (!session) {
        setShopStatus(t(saveRef.current.settings.language, 'adsUnavailable'));
        return;
      }
      adBusyRef.current = true;
      const ad: PendingAd = { kind: 'rewarded', session, onReward: grantCallback };
      pendingAdRef.current = ad;
      setPendingAd(ad);
    },
    []
  );

  const maybeShowInterstitialThen = useCallback((nextAction: () => void) => {
    if (adBusyRef.current) {
      nextAction();
      return;
    }
    if (monetizationService.shouldShowInterstitial(saveRef.current.removeAdsOwned)) {
      adBusyRef.current = true;
      const ad: PendingAd = { kind: 'interstitial', session: null, onReward: nextAction };
      pendingAdRef.current = ad;
      setPendingAd(ad);
    } else {
      nextAction();
    }
  }, []);

  const launchRace = useCallback(
    (mode: 'endless' | 'level', env: EnvironmentId, levelConfig?: LevelConfig) => {
      audioEngine.unlock();
      audioEngine.playButtonClick();
      // A fresh race always gets a fresh ID; the previous one stays in the ledger.
      sessionRef.current = startNewRace(sessionRef.current);
      clearPendingRace();

      const s = saveRef.current;
      const needsTutorial = !s.settings.tutorialSeen;
      const car = VEHICLE_MAP[s.selectedCarId] ?? VEHICLE_MAP.spark_hatch;
      const stats = computeEffectiveStats(car, s.carUpgrades[car.id]);
      const cfg: ActiveRaceConfig = {
        mode,
        environment: env,
        levelConfig,
        carId: car.id,
        carColor: s.carColors[car.id] ?? car.defaultColor,
        stats,
        steeringSensitivity: s.settings.steeringSensitivity,
        graphicsQuality: s.settings.graphicsQuality,
      };
      setSelectedEnv(env);
      setActiveRace(cfg);
      setRaceResult(null);
      setCoinsDoubled(false);
      setPaused(needsTutorial);
      setTutorialPending(needsTutorial);
      setDoorsOpen(false);
      setScreen('playing');
      engineRef.current?.startRace(cfg);
      // The first-run guide pauses the countdown until it is dismissed.
      if (needsTutorial) engineRef.current?.setPaused(true);
    },
    []
  );

  const handleNavigate = (target: ScreenId) => {
    audioEngine.unlock();
    audioEngine.playButtonClick();
    if (target === 'garage') {
      setViewingCarId(save.selectedCarId);
      setDoorsOpen(false);
      engineRef.current?.setDoorsOpen(false);
    } else {
      setDoorsOpen(false);
      engineRef.current?.setDoorsOpen(false);
    }
    if (target === 'shop') {
      setShopStatus(null);
    }
    setScreen(target);
  };

  const handleBuyCar = (car: VehicleConfig) => {
    const result = buyCar(saveRef.current, car.id);
    if (!result.applied) return;
    audioEngine.playCarUnlock();
    commitSave(result.save);
  };

  const handleEquipCar = (carId: string) => {
    const result = equipCar(saveRef.current, carId);
    if (!result.applied) return;
    audioEngine.playButtonClick();
    commitSave(result.save);
  };

  const handleChangePaint = (carId: string, hex: string) => {
    const result = setCarPaint(saveRef.current, carId, hex);
    if (!result.applied) return;
    audioEngine.playButtonClick();
    commitSave(result.save);
  };

  const handleUpgradeStat = (car: VehicleConfig, stat: keyof VehicleUpgradeLevels) => {
    const result = upgradeStat(saveRef.current, car.id, stat);
    if (!result.applied) return;
    audioEngine.playRewardFanfare();
    commitSave(result.save);
  };

  const handleStartPurchase = async (product: ShopProduct) => {
    if (purchaseBusyRef.current) return;
    purchaseBusyRef.current = true;
    setPurchasePending(true);
    setShopStatus(null);
    try {
      const outcome = await monetizationService.purchase(product.sku);
      const currentLang = saveRef.current.settings.language;
      const result = applyPurchaseOutcome(saveRef.current, product.sku, outcome);
      if (result.status === 'success') {
        if (result.applied) {
          audioEngine.playCarUnlock();
          commitSave(result.save);
          setShopStatus(t(currentLang, 'purchaseSuccess'));
        } else {
          setShopStatus(t(currentLang, 'purchaseAlreadyApplied'));
        }
      } else if (result.status === 'cancelled') {
        setShopStatus(t(currentLang, 'purchaseCancelled'));
      } else {
        setShopStatus(outcome.error ?? t(currentLang, 'purchaseFailed'));
      }
    } finally {
      purchaseBusyRef.current = false;
      setPurchasePending(false);
    }
  };

  const handleRestorePurchases = async () => {
    audioEngine.playButtonClick();
    const outcome = await monetizationService.restore();
    const currentLang = saveRef.current.settings.language;
    if (outcome.status === 'success') {
      const result = restoreEntitlements(saveRef.current, outcome.entitlements);
      commitSave(result.save);
      setShopStatus(t(currentLang, 'restoreDone'));
    } else {
      setShopStatus(outcome.error ?? t(currentLang, 'restoreFailed'));
    }
  };

  const handleClaimMission = (missionId: string) => {
    const result = claimMissionReward(saveRef.current, missionId);
    if (!result.applied) return;
    audioEngine.playRewardFanfare();
    commitSave(result.save);
  };

  const handleClaimDailyReward = (doubleViaAd: boolean) => {
    const attempt = (double: boolean) => {
      const result = claimDailyReward(saveRef.current, { double });
      if (!result.applied) return;
      audioEngine.playRewardFanfare();
      commitSave(result.save);
    };
    if (doubleViaAd) {
      requestRewardedAd('daily_reward_2x', () => attempt(true));
    } else {
      attempt(false);
    }
  };

  const handleUpdateSettings = (patch: Partial<GameSettings>) => {
    audioEngine.playButtonClick();
    const nextSettings = normalizeSettings({ ...saveRef.current.settings, ...patch });
    commitSave({ ...saveRef.current, settings: nextSettings });
    engineRef.current?.applyGameSettings(nextSettings);
    if (patch.graphicsQuality) {
      engineRef.current?.setGraphicsQuality(patch.graphicsQuality);
    }
  };

  const handleResetSave = () => {
    const fresh = createDefaultSave();
    commitSave(fresh);
    sessionRef.current = null;
    clearPendingRace();
    setViewingCarId(fresh.selectedCarId);
    setRaceResult(null);
    setCoinsDoubled(false);
    audioEngine.playButtonClick();
    engineRef.current?.applyGameSettings(fresh.settings);
    engineRef.current?.setGraphicsQuality(fresh.settings.graphicsQuality);
  };

  const showBanner = monetizationService.shouldShowBanner(
    save.removeAdsOwned,
    screen === 'playing'
  );
  const notice = saveNotice ?? storageError;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Isolated Full-Viewport 3D WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* Unobtrusive save/storage notice (never blocks the game) */}
      {notice && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] max-w-[92vw] px-4 py-2 rounded-xl bg-amber-500/95 text-slate-950 text-xs font-bold shadow-lg flex items-center gap-3">
          <span className="leading-snug">{notice}</span>
          <button
            onClick={() => {
              setSaveNotice(null);
              setStorageError(null);
            }}
            className="shrink-0 px-2 py-0.5 rounded-md bg-slate-950/20 hover:bg-slate-950/30 cursor-pointer"
            aria-label={t(lang, 'close')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Splash & Main Menu */}
      {(screen === 'splash' || screen === 'menu') && (
        <MainMenuOverlay
          screen={screen}
          save={save}
          lang={lang}
          muted={muted}
          showBanner={showBanner}
          onEnterMenu={() => {
            audioEngine.unlock();
            audioEngine.playButtonClick();
            setScreen('menu');
          }}
          onNavigate={handleNavigate}
          onToggleLang={() =>
            handleUpdateSettings({ language: lang === 'fa' ? 'en' : 'fa' })
          }
          onToggleMute={() => {
            audioEngine.unlock();
            setMuted((m) => !m);
          }}
          onQuickEndless={() => launchRace('endless', selectedEnv)}
        />
      )}

      {/* Endless Mode Environment Picker */}
      {screen === 'modeSelect' && (
        <ModeSelectOverlay
          lang={lang}
          save={save}
          selectedEnv={selectedEnv}
          onSelectEnv={(env) => {
            audioEngine.playButtonClick();
            setSelectedEnv(env);
          }}
          onStartEndless={(env) => launchRace('endless', env)}
          onBack={() => handleNavigate('menu')}
        />
      )}

      {/* 45-Level Map */}
      {screen === 'levels' && (
        <LevelMapOverlay
          lang={lang}
          save={save}
          onStartLevel={(lvl) => launchRace('level', lvl.environment, lvl)}
          onPreviewEnv={(env) => setSelectedEnv(env)}
          onBack={() => handleNavigate('menu')}
        />
      )}

      {/* 360° Interactive Garage */}
      {screen === 'garage' && (
        <GarageOverlay
          lang={lang}
          save={save}
          viewingCarId={viewingCarId}
          onSelectViewingCar={(id) => {
            audioEngine.playButtonClick();
            setViewingCarId(id);
          }}
          onBuyCar={handleBuyCar}
          onEquipCar={handleEquipCar}
          onChangePaint={handleChangePaint}
          onUpgradeStat={handleUpgradeStat}
          doorsOpen={doorsOpen}
          onToggleDoors={() => {
            setDoorsOpen((prev) => {
              const next = !prev;
              engineRef.current?.setDoorsOpen(next);
              return next;
            });
          }}
          onDockCollapsedChange={(collapsed) =>
            engineRef.current?.setGarageDockOpen(!collapsed)
          }
          onOpenShop={() => handleNavigate('shop')}
          onBack={() => handleNavigate('menu')}
        />
      )}

      {/* Active Racing HUD + Pause + Game Over / Victory Modals */}
      {screen === 'playing' && activeRace && (
        <RaceHudOverlay
          lang={lang}
          raceConfig={activeRace}
          hud={hud}
          settings={save.settings}
          paused={paused}
          result={raceResult}
          coinsDoubled={coinsDoubled}
          showTutorial={tutorialPending}
          onDismissTutorial={() => {
            setTutorialPending(false);
            setPaused(false);
            engineRef.current?.setPaused(false);
            if (!saveRef.current.settings.tutorialSeen) {
              handleUpdateSettings({ tutorialSeen: true });
            }
          }}
          onTogglePause={() => {
            audioEngine.playButtonClick();
            setPaused((p) => {
              const next = !p;
              engineRef.current?.setPaused(next);
              return next;
            });
          }}
          onCycleCamera={() => {
            audioEngine.playButtonClick();
            engineRef.current?.cycleCameraMode();
          }}
          onRestart={() => {
            commitPendingCrashIfNeeded();
            const restartAction = () =>
              launchRace(activeRace.mode, activeRace.environment, activeRace.levelConfig);
            if (raceResult) {
              maybeShowInterstitialThen(restartAction);
            } else {
              restartAction();
            }
          }}
          onMainMenu={() => {
            commitPendingCrashIfNeeded();
            const exitAction = () => {
              setRaceResult(null);
              setPaused(false);
              setScreen('menu');
            };
            if (raceResult) {
              maybeShowInterstitialThen(exitAction);
            } else {
              exitAction();
            }
          }}
          onNextLevel={() => {
            const nextLvl = getLevelById((activeRace.levelConfig?.id ?? 1) + 1);
            if (!nextLvl) {
              setScreen('levels');
              return;
            }
            maybeShowInterstitialThen(() => launchRace('level', nextLvl.environment, nextLvl));
          }}
          onReviveAd={() => {
            const session = sessionRef.current;
            if (!session || session.phase !== 'awaiting-revive') return;
            requestRewardedAd('revive_crash', () => {
              const current = sessionRef.current;
              if (!current || current.phase !== 'awaiting-revive') return;
              sessionRef.current = reviveSession(current);
              clearPendingRace();
              setRaceResult(null);
              setCoinsDoubled(false);
              engineRef.current?.reviveFromCrash();
            });
          }}
          onDoubleCoinsAd={() => {
            const session = sessionRef.current;
            if (!session || !canOfferDouble(session)) return;
            requestRewardedAd('double_coins', () => {
              const current = sessionRef.current;
              if (!current || !canOfferDouble(current) || !current.result) return;
              const result = grantDoubleCoinsBonus(
                saveRef.current,
                current.raceId,
                current.result
              );
              if (!result.applied) return;
              commitSave(result.save);
              sessionRef.current = markDoubleGranted(current);
              setCoinsDoubled(true);
            });
          }}
          onTouchControl={(ctrl, pressed) => engineRef.current?.setTouchControl(ctrl, pressed)}
          onTouchSteerAxis={(axis) => engineRef.current?.setTouchSteerAxis(axis)}
          onChangeControlScheme={(scheme) => handleUpdateSettings({ controlScheme: scheme })}
        />
      )}

      {/* Shop & Cafe Bazaar IAP */}
      {screen === 'shop' && (
        <ShopModal
          lang={lang}
          save={save}
          statusMessage={shopStatus}
          purchasePending={purchasePending}
          onStartPurchase={handleStartPurchase}
          onWatchFreeCoinsAd={() =>
            requestRewardedAd('free_coins_shop', () => {
              const result = grantCoins(saveRef.current, FREE_COINS_REWARD);
              if (result.applied) commitSave(result.save);
              setShopStatus(t(saveRef.current.settings.language, 'adComplete'));
            })
          }
          onRestorePurchases={handleRestorePurchases}
          onBack={() => handleNavigate('menu')}
        />
      )}

      {/* Daily Missions */}
      {screen === 'missions' && (
        <MissionsModal
          lang={lang}
          save={save}
          onClaimMission={handleClaimMission}
          onBack={() => handleNavigate('menu')}
        />
      )}

      {/* 7-Day Daily Rewards */}
      {screen === 'dailyRewards' && (
        <DailyRewardsModal
          lang={lang}
          save={save}
          onClaimDaily={handleClaimDailyReward}
          onBack={() => handleNavigate('menu')}
        />
      )}

      {/* Settings & Unity / Cafe Bazaar Guide */}
      {screen === 'settings' && (
        <SettingsModal
          lang={lang}
          settings={save.settings}
          onUpdateSettings={handleUpdateSettings}
          onResetSave={handleResetSave}
          onBack={() => handleNavigate('menu')}
        />
      )}

      {/* Ad Player Modal (Rewarded Video / Interstitial — never triggers during active driving) */}
      {pendingAd && (
        <AdPlayerOverlay
          lang={lang}
          kind={pendingAd.kind}
          onComplete={() => finishPendingAd(true)}
          onCancel={() => finishPendingAd(false)}
        />
      )}
    </div>
  );
}
