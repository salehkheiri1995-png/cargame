import React from 'react';
import {
  Car,
  Flag,
  Gift,
  Globe,
  Infinity as InfinityIcon,
  Settings,
  ShoppingBag,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { TOTAL_LEVELS } from '../game/data/levels';
import { TOTAL_VEHICLES } from '../game/data/vehicles';
import { formatNumber, t } from '../game/i18n';
import { canClaimDailyRewardToday, getUnclaimedMissionCount } from '../game/services/saveSystem';
import type { Language, SaveData, ScreenId } from '../game/types';
import { GoldCoinIcon, TurboLogo } from './TurboLogo';

interface MainMenuOverlayProps {
  screen: 'splash' | 'menu';
  save: SaveData;
  lang: Language;
  muted: boolean;
  showBanner: boolean;
  onEnterMenu: () => void;
  onNavigate: (target: ScreenId) => void;
  onToggleLang: () => void;
  onToggleMute: () => void;
  onQuickEndless: () => void;
}

export const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
  screen,
  save,
  lang,
  muted,
  showBanner,
  onEnterMenu,
  onNavigate,
  onToggleLang,
  onToggleMute,
  onQuickEndless,
}) => {
  const unclaimedMissions = getUnclaimedMissionCount(save);
  const dailyAvailable = canClaimDailyRewardToday(save);

  if (screen === 'splash') {
    return (
      <div className="fixed inset-0 z-20 flex flex-col items-center justify-between p-6 sm:p-10 pointer-events-none">
        <div className="pt-4 sm:pt-8">
          <TurboLogo lang={lang} />
        </div>

        {/* Center stays open so the live 3D cartoon car driving down the highway shines */}
        <div className="flex-1" />

        <div className="flex flex-col items-center gap-4 pb-4 pointer-events-auto">
          <button
            onClick={onEnterMenu}
            className="arcade-btn font-racing-title px-10 py-4 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 border-2 border-yellow-200 text-slate-950 text-2xl sm:text-3xl tracking-wide cursor-pointer whitespace-nowrap"
          >
            {t(lang, 'tapToStart')}
          </button>
          <p className="text-xs sm:text-sm font-semibold text-white/90 bg-slate-950/75 px-4 py-1.5 rounded-xl border border-white/15">
            {t(lang, 'controlsHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
      {/* Top Perimeter Bar */}
      <div className="flex items-center justify-between gap-2 pointer-events-auto">
        {/* Coin Balance + Personal Record */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onNavigate('shop')}
            className="cartoon-hud-chip arcade-btn flex items-center gap-2 px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <GoldCoinIcon className="w-6 h-6 shrink-0" />
            <span className="font-black text-base sm:text-lg text-yellow-300 tabular-nums">
              {formatNumber(save.coins, lang)}
            </span>
            <span className="text-xs font-extrabold bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-md">
              +
            </span>
          </button>

          <div className="hidden md:flex items-center gap-3 cartoon-hud-chip px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200">
            <span>
              {t(lang, 'bestScore')}:{' '}
              <strong className="font-telemetry text-sky-300 tabular-nums">
                {formatNumber(save.endlessBestScore, lang)}
              </strong>
            </span>
            <span className="text-white/25">|</span>
            <span>
              {t(lang, 'level')}:{' '}
              <strong className="font-telemetry text-amber-300 tabular-nums">
                {formatNumber(save.unlockedLevel, lang)}/{formatNumber(TOTAL_LEVELS, lang)}
              </strong>
            </span>
            <span className="text-white/25">|</span>
            <span>
              {t(lang, 'garage')}:{' '}
              <strong className="font-telemetry text-emerald-300 tabular-nums">
                {formatNumber(save.ownedCars.length, lang)}/{formatNumber(TOTAL_VEHICLES, lang)}
              </strong>
            </span>
          </div>
        </div>

        {/* Utility Controls: Daily Reward, Language, Mute, Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('dailyRewards')}
            className="relative cartoon-hud-chip arcade-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-amber-300 cursor-pointer whitespace-nowrap"
          >
            <Gift className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t(lang, 'dailyRewards')}</span>
            {dailyAvailable && (
              <span className="px-1.5 py-0.2 rounded-md bg-rose-500 text-white text-[10px] font-black">
                !
              </span>
            )}
          </button>

          <button
            onClick={onToggleLang}
            aria-label={t(lang, 'languageLabel')}
            className="cartoon-hud-chip arcade-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-sky-300 cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>{lang === 'fa' ? 'EN' : 'فا'}</span>
          </button>

          <button
            onClick={onToggleMute}
            aria-label="Audio Mute"
            className="cartoon-hud-chip arcade-btn p-2.5 rounded-xl text-white cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => onNavigate('settings')}
            aria-label={t(lang, 'settings')}
            className="cartoon-hud-chip arcade-btn p-2.5 rounded-xl text-white cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upper-Center Title Lockup leaving center 3D car completely visible */}
      <div className="flex flex-col items-center -mt-2 sm:-mt-4">
        <TurboLogo lang={lang} compact />
      </div>

      {/* Clear 3D Hero Viewport Middle Space */}
      <div className="flex-1" />

      {/* Unified Bottom Arcade Dock */}
      <div className="flex flex-col items-center gap-2.5 pointer-events-auto">
        <div className="w-full max-w-4xl cartoon-panel rounded-2xl p-2.5 sm:p-3 flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-2.5">
          {/* Primary Play CTAs */}
          <button
            onClick={() => onNavigate('modeSelect')}
            onDoubleClick={onQuickEndless}
            className="arcade-btn flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 border-2 border-yellow-200 text-slate-950 font-black text-sm sm:text-base cursor-pointer whitespace-nowrap"
          >
            <InfinityIcon className="w-5 h-5 shrink-0" />
            <span>{t(lang, 'endlessMode')}</span>
          </button>

          <button
            onClick={() => onNavigate('levels')}
            className="arcade-btn flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 border-2 border-sky-200 text-white font-black text-sm sm:text-base cursor-pointer whitespace-nowrap"
          >
            <Flag className="w-5 h-5 shrink-0" />
            <span>{t(lang, 'levelMode')}</span>
          </button>

          <button
            onClick={() => onNavigate('garage')}
            className="arcade-btn flex-1 min-w-[115px] flex items-center justify-center gap-2 px-3.5 py-3 sm:py-3.5 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 border-2 border-emerald-200 text-slate-950 font-black text-sm sm:text-base cursor-pointer whitespace-nowrap"
          >
            <Car className="w-5 h-5 shrink-0" />
            <span>{t(lang, 'garage')}</span>
          </button>

          <button
            onClick={() => onNavigate('missions')}
            className="relative arcade-btn flex items-center justify-center gap-1.5 px-3.5 py-3 sm:py-3.5 rounded-xl bg-gradient-to-b from-violet-500 to-purple-700 border-2 border-violet-300 text-white font-bold text-sm cursor-pointer whitespace-nowrap"
          >
            <Target className="w-5 h-5 shrink-0" />
            <span className="hidden md:inline">{t(lang, 'missions')}</span>
            {unclaimedMissions > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 text-xs font-black tabular-nums">
                {formatNumber(unclaimedMissions, lang)}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('shop')}
            className="arcade-btn flex items-center justify-center gap-1.5 px-3.5 py-3 sm:py-3.5 rounded-xl bg-gradient-to-b from-rose-500 to-red-600 border-2 border-rose-300 text-white font-bold text-sm cursor-pointer whitespace-nowrap"
          >
            <ShoppingBag className="w-5 h-5 shrink-0" />
            <span className="hidden md:inline">{t(lang, 'shop')}</span>
          </button>
        </div>

        {/* Non-intrusive Menu Banner Ad Slot (Strictly menus only; hidden if Remove Ads owned) */}
        {showBanner && (
          <div className="w-full max-w-2xl px-3 py-1.5 rounded-xl bg-slate-950/90 border border-white/15 flex items-center justify-between gap-3 text-[11px] text-slate-300">
            <span className="truncate">{t(lang, 'bannerLabel')}</span>
            <button
              onClick={() => onNavigate('shop')}
              className="text-amber-300 font-bold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t(lang, 'removeAds')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
