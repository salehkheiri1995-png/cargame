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
import {
  computeEffectiveStats,
  getDefaultUpgrades,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  VEHICLE_MAP,
} from './game/data/vehicles';
import { t } from './game/i18n';
import { audioEngine } from './game/services/audioEngine';
import { monetizationService, type RewardedPlacement } from './game/services/monetization';
import {
  applyRaceResultToSave,
  createDefaultSave,
  getTodayKey,
  loadSaveData,
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
};

interface PendingAd {
  kind: 'rewarded' | 'interstitial';
  nonce?: string;
  onReward: () => void;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TurboRoadEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
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
  const [pendingAd, setPendingAd] = useState<PendingAd | null>(null);

  const lang = save.settings.language;

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

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = persistSaveData(updater(prev));
      saveRef.current = next;
      return next;
    });
  }, []);

  // Stable race end handler referenced by WebGL engine
  const handleRaceEndRef = useRef<(result: RaceResult) => void>(() => {});
  handleRaceEndRef.current = (rawResult: RaceResult) => {
    const currentSave = saveRef.current;
    const isNewBestScore =
      rawResult.mode === 'endless' && rawResult.score > currentSave.endlessBestScore;
    const isNewBestDistance =
      rawResult.mode === 'endless' && rawResult.distanceM > currentSave.endlessBestDistance;

    const enriched: RaceResult = {
      ...rawResult,
      isNewBestScore,
      isNewBestDistance,
    };

    // Persist rewards & daily mission progress immediately (revive can continue same run cleanly)
    if (!enriched.canRevive || enriched.won) {
      updateSave((prev) => applyRaceResultToSave(prev, enriched));
    }
    setCoinsDoubled(false);
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
    const carCfg = VEHICLE_MAP[initialSave.selectedCarId] ?? VEHICLE_MAP.spark_hatch;
    engine.setShowcaseCar(
      carCfg.id,
      initialSave.carColors[carCfg.id] ?? carCfg.defaultColor
    );

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

  // Helper to commit un-saved result when player declines revive and exits/restarts
  const commitPendingCrashIfNeeded = useCallback(() => {
    if (raceResult && raceResult.canRevive && !raceResult.won) {
      updateSave((prev) => applyRaceResultToSave(prev, raceResult));
    }
  }, [raceResult, updateSave]);

  const maybeShowInterstitialThen = useCallback(
    (nextAction: () => void) => {
      if (monetizationService.shouldShowInterstitial(saveRef.current.removeAdsOwned)) {
        setPendingAd({
          kind: 'interstitial',
          onReward: nextAction,
        });
      } else {
        nextAction();
      }
    },
    []
  );

  const launchRace = useCallback(
    (mode: 'endless' | 'level', env: EnvironmentId, levelConfig?: LevelConfig) => {
      audioEngine.unlock();
      audioEngine.playButtonClick();
      const s = saveRef.current;
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
      setPaused(false);
      setDoorsOpen(false);
      setScreen('playing');
      engineRef.current?.startRace(cfg);
    },
    []
  );

  const requestRewardedAd = useCallback(
    (placement: RewardedPlacement, grantCallback: () => void) => {
      const nonce = monetizationService.createRewardNonce(placement);
      setPendingAd({
        kind: 'rewarded',
        nonce,
        onReward: () => {
          if (monetizationService.consumeRewardNonce(nonce)) {
            audioEngine.playRewardFanfare();
            grantCallback();
          }
        },
      });
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
    if (save.coins < car.price || save.ownedCars.includes(car.id)) return;
    audioEngine.playCarUnlock();
    updateSave((prev) => ({
      ...prev,
      coins: prev.coins - car.price,
      ownedCars: [...prev.ownedCars, car.id],
      selectedCarId: car.id,
      carColors: { ...prev.carColors, [car.id]: prev.carColors[car.id] ?? car.defaultColor },
      carUpgrades: { ...prev.carUpgrades, [car.id]: prev.carUpgrades[car.id] ?? getDefaultUpgrades() },
    }));
  };

  const handleEquipCar = (carId: string) => {
    if (!save.ownedCars.includes(carId)) return;
    audioEngine.playButtonClick();
    updateSave((prev) => ({ ...prev, selectedCarId: carId }));
  };

  const handleChangePaint = (carId: string, hex: string) => {
    audioEngine.playButtonClick();
    updateSave((prev) => ({
      ...prev,
      carColors: { ...prev.carColors, [carId]: hex },
    }));
  };

  const handleUpgradeStat = (car: VehicleConfig, stat: keyof VehicleUpgradeLevels) => {
    if (!save.ownedCars.includes(car.id)) return;
    const currentUpgrades = save.carUpgrades[car.id] ?? getDefaultUpgrades();
    const curLevel = currentUpgrades[stat];
    if (curLevel >= MAX_UPGRADE_LEVEL) return;
    const cost = getUpgradeCost(car, curLevel);
    if (save.coins < cost) return;

    audioEngine.playRewardFanfare();
    updateSave((prev) => {
      const prevU = prev.carUpgrades[car.id] ?? getDefaultUpgrades();
      return {
        ...prev,
        coins: prev.coins - cost,
        carUpgrades: {
          ...prev.carUpgrades,
          [car.id]: { ...prevU, [stat]: curLevel + 1 },
        },
      };
    });
  };

  const handleStartPurchase = (product: ShopProduct) => {
    const txId = `bazaar_sandbox_${product.sku}_${Date.now()}`;
    const { nextSave, applied } = monetizationService.applyVerifiedPurchase(
      saveRef.current,
      product.sku,
      txId
    );
    if (applied) {
      audioEngine.playCarUnlock();
      setSave(persistSaveData(nextSave));
      saveRef.current = nextSave;
      setShopStatus(t(lang, 'purchaseSuccess'));
    }
  };

  const handleRestorePurchases = () => {
    audioEngine.playButtonClick();
    updateSave((prev) => monetizationService.restorePermanentPurchases(prev));
    setShopStatus(t(lang, 'restoreDone'));
  };

  const handleClaimMission = (missionId: string, rewardCoins: number) => {
    if (save.dailyMissions.claimed[missionId]) return;
    audioEngine.playRewardFanfare();
    updateSave((prev) => ({
      ...prev,
      coins: prev.coins + rewardCoins,
      dailyMissions: {
        ...prev.dailyMissions,
        claimed: { ...prev.dailyMissions.claimed, [missionId]: true },
      },
    }));
  };

  const handleClaimDailyReward = (coins: number, doubleViaAd: boolean) => {
    const grant = (amount: number) => {
      updateSave((prev) => ({
        ...prev,
        coins: prev.coins + amount,
        dailyRewardStreak: (prev.dailyRewardStreak % 7) + 1,
        lastDailyRewardDate: getTodayKey(),
      }));
    };

    if (doubleViaAd) {
      requestRewardedAd('daily_reward_2x', () => grant(coins * 2));
    } else {
      audioEngine.playRewardFanfare();
      grant(coins);
    }
  };

  const handleUpdateSettings = (patch: Partial<GameSettings>) => {
    audioEngine.playButtonClick();
    updateSave((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
    if (patch.graphicsQuality) {
      engineRef.current?.setGraphicsQuality(patch.graphicsQuality);
    }
  };

  const handleResetSave = () => {
    const fresh = persistSaveData(createDefaultSave());
    setSave(fresh);
    saveRef.current = fresh;
    setViewingCarId(fresh.selectedCarId);
    audioEngine.playButtonClick();
  };

  const showBanner = monetizationService.shouldShowBanner(
    save.removeAdsOwned,
    screen === 'playing'
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Isolated Full-Viewport 3D WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

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

      {/* 30-Level Map */}
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
          controlScheme={save.settings.controlScheme}
          onChangeControlScheme={(scheme) =>
            handleUpdateSettings({ controlScheme: scheme })
          }
          paused={paused}
          result={raceResult}
          coinsDoubled={coinsDoubled}
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
            requestRewardedAd('revive_crash', () => {
              setRaceResult(null);
              engineRef.current?.reviveFromCrash();
            });
          }}
          onDoubleCoinsAd={() => {
            if (!raceResult || coinsDoubled) return;
            const bonusCoins = raceResult.coinsCollected;
            requestRewardedAd('double_coins', () => {
              setCoinsDoubled(true);
              updateSave((prev) => ({ ...prev, coins: prev.coins + bonusCoins }));
            });
          }}
          onTouchControl={(ctrl, pressed) => engineRef.current?.setTouchControl(ctrl, pressed)}
          onTouchSteerAxis={(axis) => engineRef.current?.setTouchSteerAxis(axis)}
        />
      )}

      {/* Shop & Cafe Bazaar IAP */}
      {screen === 'shop' && (
        <ShopModal
          lang={lang}
          save={save}
          statusMessage={shopStatus}
          onStartPurchase={handleStartPurchase}
          onWatchFreeCoinsAd={() =>
            requestRewardedAd('free_coins_shop', () => {
              updateSave((prev) => ({ ...prev, coins: prev.coins + 100 }));
              setShopStatus(t(lang, 'adComplete'));
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
          onComplete={() => {
            const cb = pendingAd.onReward;
            setPendingAd(null);
            cb();
          }}
          onCancel={() => setPendingAd(null)}
        />
      )}
    </div>
  );
}
