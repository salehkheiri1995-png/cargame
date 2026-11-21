import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Flame,
  Home,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Video,
  Wind,
  Zap,
} from 'lucide-react';
import { TOTAL_LEVELS } from '../game/data/levels';
import { formatMissionGoal, formatNumber, getMissionTypeLabel, t } from '../game/i18n';
import { hapticImpact } from '../game/services/haptics';
import type {
  ActiveRaceConfig,
  ControlScheme,
  GameSettings,
  Language,
  RaceHudSnapshot,
  RaceResult,
} from '../game/types';
import { GoldCoinIcon, StarIcon } from './TurboLogo';

interface RaceHudOverlayProps {
  lang: Language;
  raceConfig: ActiveRaceConfig;
  hud: RaceHudSnapshot;
  settings: GameSettings;
  paused: boolean;
  result: RaceResult | null;
  coinsDoubled: boolean;
  onTogglePause: () => void;
  onCycleCamera: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onNextLevel: () => void;
  onReviveAd: () => void;
  onDoubleCoinsAd: () => void;
  onTouchControl: (ctrl: 'left' | 'right' | 'brake' | 'nitro', pressed: boolean) => void;
  onTouchSteerAxis: (axis: number) => void;
  onChangeControlScheme?: (scheme: ControlScheme) => void;
  onDismissTutorial?: () => void;
  showTutorial?: boolean;
}

const triggerHaptic = (ms = 10) => {
  // Strength is derived from the legacy duration so existing call sites keep
  // their feel; the shared service handles native vs. web and the user setting.
  void hapticImpact(ms >= 20 ? 'heavy' : ms >= 12 ? 'medium' : 'light');
};

export const RaceHudOverlay: React.FC<RaceHudOverlayProps> = ({
  lang,
  raceConfig,
  hud,
  settings,
  paused,
  result,
  coinsDoubled,
  onTogglePause,
  onCycleCamera,
  onRestart,
  onMainMenu,
  onNextLevel,
  onReviveAd,
  onDoubleCoinsAd,
  onTouchControl,
  onTouchSteerAxis,
  onChangeControlScheme,
  onDismissTutorial,
  showTutorial,
}) => {
  const dragOriginX = useRef<number | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const wheelOriginX = useRef<number | null>(null);
  const wheelPointerId = useRef<number | null>(null);
  const [steerUiAxis, setSteerUiAxis] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialVisible = Boolean(showTutorial) || tutorialOpen;
  const btnPointers = useRef<Record<'left' | 'right' | 'brake' | 'nitro', number | null>>({
    left: null,
    right: null,
    brake: null,
    nitro: null,
  });
  const [pressedBtns, setPressedBtns] = useState({
    left: false,
    right: false,
    brake: false,
    nitro: false,
  });
  const controlScheme = settings.controlScheme;
  const lvl = raceConfig.levelConfig;

  const resetControls = useCallback(() => {
    dragOriginX.current = null;
    dragPointerId.current = null;
    wheelOriginX.current = null;
    wheelPointerId.current = null;
    btnPointers.current = { left: null, right: null, brake: null, nitro: null };
    setSteerUiAxis(0);
    setPressedBtns((prev) =>
      prev.left || prev.right || prev.brake || prev.nitro
        ? { left: false, right: false, brake: false, nitro: false }
        : prev
    );
    onTouchControl('left', false);
    onTouchControl('right', false);
    onTouchControl('brake', false);
    onTouchControl('nitro', false);
    onTouchSteerAxis(0);
  }, [onTouchControl, onTouchSteerAxis]);

  // Release every touch when the overlay is paused/ended, the tab is hidden,
  // or the window loses focus. Prevents stuck steering after an ad or tab switch.
  useEffect(() => {
    if (paused || Boolean(result)) {
      resetControls();
    }
  }, [paused, result, resetControls]);

  useEffect(() => {
    const onHide = () => resetControls();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') resetControls();
    };
    window.addEventListener('blur', onHide);
    window.addEventListener('pointercancel', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onHide);
      window.removeEventListener('pointercancel', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resetControls]);

  const applyAxis = useCallback(
    (raw: number) => {
      const dead = Math.max(0, Math.min(0.2, settings.steeringDeadZone));
      const magnitude = Math.abs(raw);
      const shaped = magnitude <= dead ? 0 : (magnitude - dead) / (1 - dead);
      const axis = Math.sign(raw) * Math.max(0, Math.min(1, shaped));
      setSteerUiAxis(axis);
      onTouchSteerAxis(axis);
    },
    [settings.steeringDeadZone, onTouchSteerAxis]
  );

  const setBtnState = (ctrl: 'left' | 'right' | 'brake' | 'nitro', active: boolean) => {
    setPressedBtns((prev) => (prev[ctrl] === active ? prev : { ...prev, [ctrl]: active }));
    onTouchControl(ctrl, active);
  };

  const makeTouchBtnHandlers = (ctrl: 'left' | 'right' | 'brake' | 'nitro', hapticMs = 8) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (btnPointers.current[ctrl] !== null) return;
      btnPointers.current[ctrl] = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      triggerHaptic(hapticMs);
      setBtnState(ctrl, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (btnPointers.current[ctrl] !== e.pointerId) return;
      btnPointers.current[ctrl] = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setBtnState(ctrl, false);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (btnPointers.current[ctrl] !== e.pointerId) return;
      btnPointers.current[ctrl] = null;
      setBtnState(ctrl, false);
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (btnPointers.current[ctrl] !== e.pointerId) return;
      btnPointers.current[ctrl] = null;
      setBtnState(ctrl, false);
    },
  });

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragPointerId.current !== null) return;
    dragPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOriginX.current = e.clientX;
  };
  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== e.pointerId || dragOriginX.current === null) return;
    const dx = e.clientX - dragOriginX.current;
    applyAxis(Math.max(-1, Math.min(1, dx / 68)));
  };
  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerId.current !== e.pointerId) return;
    dragPointerId.current = null;
    dragOriginX.current = null;
    applyAxis(0);
  };

  const handleWheelStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (wheelPointerId.current !== null) return;
    wheelPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    wheelOriginX.current = e.clientX;
    triggerHaptic(8);
  };
  const handleWheelMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerId.current !== e.pointerId || wheelOriginX.current === null) return;
    const dx = e.clientX - wheelOriginX.current;
    applyAxis(Math.max(-1, Math.min(1, dx / 62)));
  };
  const handleWheelEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerId.current !== e.pointerId) return;
    wheelPointerId.current = null;
    wheelOriginX.current = null;
    applyAxis(0);
  };

  const nitroPercent = Math.max(0, Math.min(100, hud.nitro));
  const resultTotal = result
    ? result.coinsCollected +
      Math.max(0, result.missionBonusCoins) +
      (coinsDoubled ? result.coinsCollected : 0)
    : 0;
  const showHudControls = !paused && !result;
  const speedStreakOpacity =
    showHudControls &&
    !settings.reduceMotion &&
    settings.speedLines &&
    (hud.nitroActive || hud.speedKmh > 175)
      ? Math.min(0.65, hud.nitroActive ? 0.58 : (hud.speedKmh - 175) / 140)
      : 0;

  return (
    <>
      {/* Lightweight High-Speed Peripheral Motion Streaks (zero center occlusion, no backdrop-filter) */}
      {speedStreakOpacity > 0.02 && (
        <svg
          className="fixed inset-0 z-10 w-full h-full pointer-events-none"
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ opacity: speedStreakOpacity }}
        >
          <g
            stroke={hud.feverActive ? '#facc15' : '#7dd3fc'}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
          >
            <line x1="0" y1="60" x2="150" y2="165" />
            <line x1="0" y1="185" x2="135" y2="235" />
            <line x1="0" y1="360" x2="140" y2="330" />
            <line x1="0" y1="510" x2="165" y2="410" />
            <line x1="1000" y1="60" x2="850" y2="165" />
            <line x1="1000" y1="185" x2="865" y2="235" />
            <line x1="1000" y1="360" x2="860" y2="330" />
            <line x1="1000" y1="510" x2="835" y2="410" />
          </g>
        </svg>
      )}

      {/* Active Low-Occlusion HUD (pointer-events-none wrapper, Android safe-area ready!) */}
      <div className="fixed inset-0 z-20 flex flex-col justify-between safe-area-hud sm:p-4 pointer-events-none">
        {/* Top Perimeter Telemetry */}
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4 portrait:flex landscape:hidden">
          <div className="cartoon-hud-chip px-3 py-1 rounded-xl text-[11px] font-bold text-sky-200">
            📱 {t(lang, 'portraitHint')}
          </div>
        </div>
        <div className="flex items-start justify-between gap-2">
          {/* Score, Distance, Coins */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="cartoon-hud-chip px-3 py-1.5 rounded-xl flex items-center gap-2">
              <GoldCoinIcon className="w-5 h-5" />
              <span className="font-black text-base text-yellow-300 tabular-nums">
                {formatNumber(hud.coinsCollected, lang)}
              </span>
            </div>

            <div className="cartoon-hud-chip px-3 py-1.5 rounded-xl flex items-center gap-3 text-xs sm:text-sm font-black">
              <span className="text-white tabular-nums">
                {formatNumber(hud.score, lang)}
              </span>
              <span className="text-white/25">|</span>
              <span className="text-sky-300 tabular-nums">
                {formatNumber(hud.distanceM, lang)} {t(lang, 'hudMeterUnit')}
              </span>
              {hud.combo > 1 && (
                <>
                  <span className="text-white/25">|</span>
                  <span
                    className={`tabular-nums ${
                      hud.feverActive ? 'text-orange-400' : 'text-amber-300'
                    }`}
                  >
                    {hud.feverActive ? (lang === 'fa' ? 'فیور ' : 'FEVER ') : ''}×
                    {formatNumber(hud.combo, lang)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Center Level Mission Bar (Level Mode Only) */}
          {lvl && (
            <div className="hidden md:flex flex-col items-center cartoon-hud-chip px-4 py-1.5 rounded-xl min-w-[230px]">
              <div className="w-full flex items-center justify-between gap-3 text-[11px] font-bold">
                <span className="text-amber-300 truncate">
                  {getMissionTypeLabel(lang, lvl.missionType)} ·{' '}
                  {formatMissionGoal(lang, lvl.missionType, lvl.target)}
                </span>
                {hud.timeRemaining !== null && (
                  <span
                    className={`tabular-nums font-black ${
                      hud.timeRemaining <= 10 ? 'text-rose-400' : 'text-white'
                    }`}
                  >
                    {Math.ceil(hud.timeRemaining)}s
                  </span>
                )}
              </div>
              <div className="w-full flex items-center justify-between gap-2 mt-1">
                <span className="text-[10px] font-black text-white/80 tabular-nums">
                  {formatNumber(hud.missionCurrent, lang)} /{' '}
                  {formatNumber(hud.missionTarget, lang)}
                </span>
                <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-100"
                    style={{ width: `${Math.round(hud.missionProgress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Speedometer + Nitro + Pause */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="cartoon-hud-chip px-3 py-1.5 rounded-xl flex items-center gap-3">
              <div className="text-end">
                <div className="text-lg sm:text-2xl font-black leading-none text-white tabular-nums">
                  {formatNumber(hud.speedKmh, lang)}
                </div>
                <div className="text-[10px] font-bold text-sky-300">
                  {t(lang, 'hudSpeedUnit')}
                </div>
              </div>

              <div className="w-20 sm:w-28">
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span className="text-sky-300 flex items-center gap-0.5">
                    <Zap className="w-3 h-3" />
                    {t(lang, 'hudNitro')}
                  </span>
                  <span className="text-white tabular-nums">{nitroPercent}%</span>
                </div>
                <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/15">
                  <div
                    className={`h-full rounded-full ${
                      hud.nitroActive
                        ? 'bg-gradient-to-r from-amber-300 to-orange-500'
                        : 'bg-gradient-to-r from-sky-400 to-violet-500'
                    }`}
                    style={{ width: `${nitroPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic(10);
                onCycleCamera();
              }}
              aria-label={lang === 'fa' ? 'تغییر زاویه دوربین' : 'Switch Camera Angle'}
              title={
                hud.cameraMode === 'chase'
                  ? lang === 'fa'
                    ? 'دوربین تعقیب'
                    : 'Chase Cam'
                  : hud.cameraMode === 'low'
                  ? lang === 'fa'
                    ? 'دوربین سینمایی نزدیک'
                    : 'Low Action Cam'
                  : hud.cameraMode === 'hood'
                  ? lang === 'fa'
                    ? 'دوربین کاپوت'
                    : 'Hood Cam'
                  : t(lang, 'cockpitCam')
              }
              className="cartoon-hud-chip arcade-btn p-2.5 sm:p-3 rounded-xl text-sky-300 cursor-pointer"
            >
              <Camera className="w-5 h-5" />
            </button>

            <button
              onClick={onTogglePause}
              aria-label={t(lang, 'paused')}
              className="cartoon-hud-chip arcade-btn p-2.5 sm:p-3 rounded-xl text-white cursor-pointer"
            >
              <Pause className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Compact Level Mission Bar */}
        {lvl && (
          <div className="md:hidden self-center cartoon-hud-chip px-3 py-1 rounded-xl flex flex-col items-center gap-0.5 text-[11px] font-bold mt-1">
            <span className="text-amber-300">
              {getMissionTypeLabel(lang, lvl.missionType)} ·{' '}
              {formatNumber(hud.missionCurrent, lang)} / {formatNumber(hud.missionTarget, lang)}
            </span>
            {hud.timeRemaining !== null && (
              <span className="text-white tabular-nums">⏱ {Math.ceil(hud.timeRemaining)}s</span>
            )}
          </div>
        )}

        {/* Center Transient Callout Feedback + Live Rival / Drafting / Shield Badges */}
        <div className="flex-1 flex flex-col items-center justify-start pt-4 gap-2">
          {hud.feedbackText && (
            <div
              key={hud.feedbackId}
              className="px-4 py-1.5 rounded-xl bg-slate-950/90 border-2 font-black text-sm sm:text-lg tracking-wide"
              style={{ color: hud.feedbackColor, borderColor: hud.feedbackColor }}
            >
              {hud.feedbackText}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {hud.rivalAheadDist !== null && (
              <div className="px-3 py-1 rounded-lg bg-rose-600/90 border border-rose-300 text-white text-xs font-black flex items-center gap-1.5 tabular-nums">
                <Crosshair className="w-3.5 h-3.5" />
                <span>
                  {lang === 'fa'
                    ? `رقیب در ${formatNumber(hud.rivalAheadDist, lang)} متر جلوتر`
                    : `RIVAL ${hud.rivalAheadDist}m AHEAD`}
                </span>
              </div>
            )}

            {hud.drafting && (
              <div className="px-3 py-1 rounded-lg bg-sky-500/90 border border-sky-200 text-slate-950 text-xs font-black flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5" />
                <span>{lang === 'fa' ? 'مکش باد! شارژ سریع نیترو' : 'SLIPSTREAM! +NITRO'}</span>
              </div>
            )}

            {hud.shieldActive && (
              <div className="px-3 py-1 rounded-lg bg-emerald-400/90 text-slate-950 text-xs font-black flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                <span>{lang === 'fa' ? 'سپر محافظ فعال' : 'SHIELD ACTIVE'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Android-First Multi-Touch Steering & Ergonomic Pedals */}
        {showHudControls && (
          <div
            dir={settings.leftHanded ? 'rtl' : 'ltr'}
            className="flex items-end justify-between gap-3 pb-1 pointer-events-auto"
            style={{ opacity: settings.controlOpacity }}
          >
            {/* Left Thumb Zone: Multi-Touch Buttons, Real Touch Steering Wheel, or Proportional Slider */}
            <div
              style={{
                transform: `scale(${settings.controlScale})`,
                transformOrigin: settings.leftHanded ? 'bottom right' : 'bottom left',
              }}
            >
            {controlScheme === 'buttons' ? (
              <div className="flex items-center gap-3">
                <button
                  {...makeTouchBtnHandlers('left', 7)}
                  aria-label="Steer Left"
                  className={`android-touch-pad w-20 h-20 sm:w-22 sm:h-22 rounded-2xl border-2 flex items-center justify-center cursor-pointer transition-transform ${
                    pressedBtns.left
                      ? 'bg-sky-400 border-white text-slate-950 scale-95'
                      : 'bg-slate-950/80 border-white/25 text-white'
                  }`}
                >
                  <ChevronLeft className="w-11 h-11" />
                </button>
                <button
                  {...makeTouchBtnHandlers('right', 7)}
                  aria-label="Steer Right"
                  className={`android-touch-pad w-20 h-20 sm:w-22 sm:h-22 rounded-2xl border-2 flex items-center justify-center cursor-pointer transition-transform ${
                    pressedBtns.right
                      ? 'bg-sky-400 border-white text-slate-950 scale-95'
                      : 'bg-slate-950/80 border-white/25 text-white'
                  }`}
                >
                  <ChevronRight className="w-11 h-11" />
                </button>
              </div>
            ) : controlScheme === 'wheel' ? (
              <div
                onPointerDown={handleWheelStart}
                onPointerMove={handleWheelMove}
                onPointerUp={handleWheelEnd}
                onPointerCancel={handleWheelEnd}
                onLostPointerCapture={handleWheelEnd}
                aria-label="Touch Steering Wheel"
                className="android-touch-pad relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-slate-950/65 border-2 border-sky-400/40 flex items-center justify-center cursor-grab active:cursor-grabbing"
              >
                {/* Interactive Rotating Motorsport Steering Wheel SVG */}
                <svg
                  viewBox="0 0 120 120"
                  className="w-28 h-28 sm:w-32 sm:h-32 pointer-events-none"
                  style={{
                    transform: `rotate(${Math.round(steerUiAxis * 78)}deg)`,
                    transition: wheelOriginX.current === null ? 'transform 140ms ease-out' : 'none',
                  }}
                >
                  {/* Outer Leather Grip Rim */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="14"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="10"
                  />
                  {/* Red 12-o'clock Racing Center Stripe */}
                  <rect x="55" y="6" width="10" height="14" rx="3" fill="#ef4444" />
                  {/* Brushed Aluminum Spokes */}
                  <rect x="16" y="55" width="88" height="10" rx="4" fill="#94a3b8" />
                  <rect x="55" y="60" width="10" height="44" rx="4" fill="#94a3b8" />
                  {/* Central Carbon Hub */}
                  <circle cx="60" cy="60" r="16" fill="#090d16" stroke="#38bdf8" strokeWidth="3" />
                  <circle cx="60" cy="60" r="6" fill="#facc15" />
                </svg>
              </div>
            ) : (
              <div
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
                onLostPointerCapture={handleDragEnd}
                className="android-touch-pad relative w-48 h-20 rounded-2xl bg-slate-950/80 border-2 border-sky-400/50 flex items-center justify-center text-xs font-extrabold text-sky-200 cursor-ew-resize overflow-hidden"
              >
                <div className="absolute inset-x-4 h-1.5 rounded-full bg-slate-800" />
                <div
                  className="absolute w-12 h-12 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 border-2 border-white flex items-center justify-center text-slate-950 font-black pointer-events-none"
                  style={{
                    left: `calc(50% + ${steerUiAxis * 34}% - 24px)`,
                  }}
                >
                  ◄►
                </div>
              </div>
            )}
            </div>

            {/* Subtle Desktop Hint */}
            <div className="hidden lg:block px-3 py-1 rounded-lg bg-slate-950/75 border border-white/10 text-[11px] font-semibold text-slate-300">
              {t(lang, 'controlsHint')}
            </div>

            {/* Right Thumb Zone: Large Ergonomic Brake & Nitro Pedals */}
            <div
              className="flex items-center gap-3"
              style={{
                transform: `scale(${settings.controlScale})`,
                transformOrigin: settings.leftHanded ? 'bottom left' : 'bottom right',
              }}
            >
              <button
                {...makeTouchBtnHandlers('brake', 12)}
                className={`android-touch-pad w-18 h-20 sm:w-20 sm:h-22 rounded-2xl border-2 font-black text-xs sm:text-sm flex flex-col items-center justify-center cursor-pointer transition-transform ${
                  pressedBtns.brake
                    ? 'bg-rose-500 border-white text-white scale-95'
                    : 'bg-rose-700/85 border-rose-300/70 text-white'
                }`}
              >
                <span>{t(lang, 'hudBrake')}</span>
              </button>
              <button
                {...makeTouchBtnHandlers('nitro', 15)}
                className={`android-touch-pad w-20 h-22 sm:w-24 sm:h-24 rounded-2xl border-2 font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform ${
                  pressedBtns.nitro
                    ? 'bg-amber-400 border-white text-slate-950 scale-95'
                    : hud.nitro >= 14
                    ? 'bg-gradient-to-b from-sky-400 to-violet-600 border-sky-200 text-white'
                    : 'bg-slate-900/85 border-white/15 text-slate-400'
                }`}
              >
                <Flame className="w-7 h-7" />
                <span>{t(lang, 'hudNitro')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pre-race countdown with the stage goal visible before driving */}
      {hud.countdown > 0 && !paused && !result && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[88px] sm:text-[120px] font-black text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)] tabular-nums leading-none">
            {Math.ceil(hud.countdown)}
          </div>
          <div className="mt-2 px-4 py-2 rounded-2xl bg-slate-950/80 border-2 border-amber-300/70 text-center max-w-[90vw]">
            <div className="text-amber-300 font-black text-sm sm:text-base">
              {t(lang, 'getReady')}
            </div>
            {lvl && (
              <div className="text-white text-xs sm:text-sm font-bold mt-0.5">
                {t(lang, 'missionGoalLabel')}:{' '}
                {formatMissionGoal(lang, lvl.missionType, lvl.target)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tutorial: first race (paused) or replayed from the pause menu */}
      {tutorialVisible && (
        <div className="fixed inset-0 z-40 bg-slate-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md cartoon-panel rounded-3xl p-6 space-y-4 text-start">
            <h2 className="text-xl sm:text-2xl font-black text-white text-center">
              {t(lang, 'tutorialTitle')}
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed">{t(lang, 'tutorialBody')}</p>
            <p className="text-xs text-sky-300 leading-relaxed bg-sky-950/50 border border-sky-400/30 rounded-xl p-3">
              {t(lang, 'tutorialControls')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-300">
              <div className="rounded-lg bg-slate-800/80 p-2">
                {lang === 'fa' ? '⚡ نیترو: سرعت لحظه‌ای' : '⚡ Nitro: burst of speed'}
              </div>
              <div className="rounded-lg bg-slate-800/80 p-2">
                {lang === 'fa' ? '🛡️ احیا: یک‌بار با تبلیغ' : '🛡️ Revive: once per run'}
              </div>
              <div className="rounded-lg bg-slate-800/80 p-2">
                {lang === 'fa' ? '🪙 سکه: امتیاز حین مسیر' : '🪙 Coins: score on the road'}
              </div>
              <div className="rounded-lg bg-slate-800/80 p-2">
                {lang === 'fa' ? '⏱️ زمان: در مراحل محدود' : '⏱️ Timers: level mode only'}
              </div>
            </div>
            <button
              onClick={() => {
                setTutorialOpen(false);
                onDismissTutorial?.();
              }}
              className="arcade-btn w-full py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 border-2 border-emerald-200 text-slate-950 font-black text-base cursor-pointer"
            >
              {t(lang, 'gotIt')}
            </button>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {paused && !result && (
        <div className="fixed inset-0 z-30 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm cartoon-panel rounded-3xl p-6 flex flex-col gap-3 text-center">
            <h2 className="text-2xl font-black text-white mb-1">{t(lang, 'paused')}</h2>

            {onChangeControlScheme && (
              <div className="bg-slate-900/90 border border-white/10 rounded-xl p-2.5 text-start space-y-1.5">
                <div className="text-[11px] font-bold text-slate-300">
                  {t(lang, 'controlScheme')}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'buttons', label: t(lang, 'controlButtons') },
                      { id: 'wheel', label: t(lang, 'controlWheel') },
                      { id: 'drag', label: t(lang, 'controlDrag') },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onChangeControlScheme(item.id)}
                      className={`py-1.5 px-1.5 rounded-lg text-[10px] font-bold cursor-pointer leading-tight ${
                        controlScheme === item.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setTutorialOpen(true)}
              className="arcade-btn w-full py-2.5 rounded-xl bg-slate-800 border-2 border-sky-400/40 text-sky-200 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t(lang, 'tutorialTitle')}</span>
            </button>

            <button
              onClick={onTogglePause}
              className="arcade-btn w-full py-3.5 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 border-2 border-emerald-200 text-slate-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{t(lang, 'resume')}</span>
            </button>

            <button
              onClick={onRestart}
              className="arcade-btn w-full py-3 rounded-xl bg-sky-500 border-2 border-sky-300 text-slate-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span>{t(lang, 'restart')}</span>
            </button>

            <button
              onClick={onMainMenu}
              className="arcade-btn w-full py-3 rounded-xl bg-slate-800 border-2 border-white/15 text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-5 h-5" />
              <span>{t(lang, 'mainMenu')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Game Over / Level Complete / Level Failed Modal */}
      {result && (
        <div className="fixed inset-0 z-30 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md cartoon-panel rounded-3xl p-6 flex flex-col gap-4 text-center">
            <div>
              <h2
                className={`text-2xl sm:text-3xl font-black ${
                  result.mode === 'level'
                    ? result.won
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {result.mode === 'level'
                  ? result.won
                    ? t(lang, 'levelComplete')
                    : t(lang, 'levelFailed')
                  : t(lang, 'gameOver')}
              </h2>

              {result.failReason && (
                <p className="text-xs font-bold text-rose-300 mt-1">
                  {result.failReason === 'timeout'
                    ? t(lang, 'timeoutReason')
                    : result.failReason === 'hit'
                    ? t(lang, 'hitReason')
                    : t(lang, 'crashReason')}
                </p>
              )}

              {result.isNewBestScore && (
                <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-black">
                  {t(lang, 'newRecord')}
                </div>
              )}

              {result.mode === 'level' && result.won && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {[1, 2, 3].map((s) => (
                    <StarIcon key={s} filled={result.starsEarned >= s} className="w-10 h-10" />
                  ))}
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-start">
              <StatRow label={t(lang, 'scoreLabel')} value={formatNumber(result.score, lang)} accent="text-white" />
              <StatRow
                label={t(lang, 'distanceLabel')}
                value={`${formatNumber(result.distanceM, lang)} ${t(lang, 'hudMeterUnit')}`}
                accent="text-sky-300"
              />
              <StatRow
                label={t(lang, 'coinsEarnedLabel')}
                value={`+${formatNumber(result.coinsCollected, lang)}`}
                accent="text-yellow-300"
              />
              <StatRow
                label={t(lang, 'overtakesLabel')}
                value={formatNumber(result.overtakes, lang)}
                accent="text-emerald-300"
              />
              {result.missionBonusCoins > 0 && (
                <StatRow
                  label={t(lang, 'stageBonusLabel')}
                  value={`+${formatNumber(result.missionBonusCoins, lang)}`}
                  accent="text-amber-300"
                />
              )}
              {coinsDoubled && (
                <StatRow
                  label={t(lang, 'adBonusLabel')}
                  value={`+${formatNumber(result.coinsCollected, lang)}`}
                  accent="text-orange-300"
                />
              )}
              <StatRow
                label={t(lang, 'totalEarnedLabel')}
                value={`+${formatNumber(resultTotal, lang)}`}
                accent="text-yellow-200"
              />
              <StatRow
                label={t(lang, 'peakSpeedLabel')}
                value={`${formatNumber(result.peakSpeedKmh, lang)} ${t(lang, 'hudSpeedUnit')}`}
                accent="text-violet-300"
              />
            </div>

            {/* Rewarded Video Ad Options (Optional, clearly labeled!) */}
            <div className="flex flex-col gap-2">
              {result.canRevive && (
                <button
                  onClick={onReviveAd}
                  className="arcade-btn w-full py-3 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 border-2 border-sky-200 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>{t(lang, 'reviveAdBtn')}</span>
                </button>
              )}

              {result.coinsCollected > 0 && !coinsDoubled && (
                <button
                  onClick={onDoubleCoinsAd}
                  className="arcade-btn w-full py-3 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 border-2 border-yellow-200 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>
                    {t(lang, 'doubleCoinsAdBtn')} (+{formatNumber(result.coinsCollected, lang)})
                  </span>
                </button>
              )}
              {coinsDoubled && (
                <div className="text-xs font-extrabold text-emerald-400">
                  {t(lang, 'coinsDoubled')}
                </div>
              )}
            </div>

            {/* Primary Navigation CTAs */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {result.mode === 'level' && result.won && (result.levelId ?? TOTAL_LEVELS) < TOTAL_LEVELS ? (
                <button
                  onClick={onNextLevel}
                  className="col-span-2 arcade-btn py-3.5 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 border-2 border-emerald-200 text-slate-950 font-black text-base cursor-pointer"
                >
                  {t(lang, 'nextLevel')}
                </button>
              ) : null}

              <button
                onClick={onRestart}
                className="arcade-btn py-3 rounded-xl bg-slate-800 border-2 border-sky-400/50 text-white font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t(lang, 'tryAgain')}</span>
              </button>

              <button
                onClick={onMainMenu}
                className="arcade-btn py-3 rounded-xl bg-slate-800 border-2 border-white/15 text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>{t(lang, 'mainMenu')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const StatRow: React.FC<{ label: string; value: string; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div className="bg-slate-800/85 border border-white/10 rounded-xl p-2.5">
    <div className="text-[11px] font-bold text-slate-400">{label}</div>
    <div className={`text-base font-black tabular-nums mt-0.5 ${accent}`}>{value}</div>
  </div>
);
