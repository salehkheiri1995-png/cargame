import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Gift,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { DAILY_MISSIONS, DAILY_REWARDS, SHOP_PRODUCTS } from '../game/data/economy';
import { formatNumber, t } from '../game/i18n';
import { canClaimDailyRewardToday, getNextDailyRewardDay } from '../game/services/saveSystem';
import type {
  GameSettings,
  Language,
  SaveData,
  ShopProduct,
} from '../game/types';
import { GoldCoinIcon } from './TurboLogo';

/* ==================== SHOP & CAFE BAZAAR PURCHASE MODAL ==================== */
interface ShopModalProps {
  lang: Language;
  save: SaveData;
  onStartPurchase: (product: ShopProduct) => void;
  onWatchFreeCoinsAd: () => void;
  onRestorePurchases: () => void;
  onBack: () => void;
  statusMessage: string | null;
  purchasePending?: boolean;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  lang,
  save,
  onStartPurchase,
  onWatchFreeCoinsAd,
  onRestorePurchases,
  onBack,
  statusMessage,
  purchasePending = false,
}) => {
  const BackIcon = lang === 'fa' ? ArrowRight : ArrowLeft;
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);

  const isOwnedPermanent = (p: ShopProduct) => {
    if (p.sku === 'remove_ads') return save.removeAdsOwned;
    if (p.sku === 'starter_pack') return save.starterPackOwned;
    if (p.sku === 'premium_car') return save.premiumCarOwned;
    return false;
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-950/92 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/15">
        <button
          onClick={onBack}
          className="cartoon-hud-chip arcade-btn flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t(lang, 'back')}</span>
        </button>

        <h2 className="font-black text-xl sm:text-2xl text-white flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-amber-400" />
          <span>{t(lang, 'shop')}</span>
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={onRestorePurchases}
            className="cartoon-hud-chip arcade-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-sky-300 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t(lang, 'restorePurchases')}</span>
          </button>
          <div className="cartoon-hud-chip flex items-center gap-2 px-3.5 py-2 rounded-xl">
            <GoldCoinIcon className="w-5 h-5" />
            <span className="font-black text-yellow-300 tabular-nums">
              {formatNumber(save.coins, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* Transparent Cafe Bazaar Poolakey Sandbox Notice */}
      <div className="mt-3 px-4 py-2.5 rounded-xl bg-sky-950/70 border border-sky-400/35 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200">
        <span className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
          {t(lang, 'bazaarSandboxNote')}
        </span>
        {save.removeAdsOwned && (
          <span className="font-black text-emerald-400">{t(lang, 'adsRemovedBadge')}</span>
        )}
      </div>

      {statusMessage && (
        <div className="mt-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs sm:text-sm font-bold text-center">
          {statusMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto turbo-scroll mt-4 space-y-4 pb-6">
        {/* Free Rewarded Video Coins Banner */}
        <div className="cartoon-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
              <Video className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="font-black text-base text-white">{t(lang, 'freeCoinsAd')}</div>
              <div className="text-xs text-slate-300">
                {lang === 'fa'
                  ? 'کاملاً اختیاری — پاداش پس از تکمیل ویدئو اضافه می‌شود'
                  : '100% optional — reward granted after verified completion'}
              </div>
            </div>
          </div>
          <button
            onClick={onWatchFreeCoinsAd}
            disabled={purchasePending}
            className="arcade-btn px-5 py-2.5 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 border-2 border-yellow-200 text-slate-950 font-black text-sm cursor-pointer disabled:opacity-60"
          >
            +100 {t(lang, 'coins')}
          </button>
        </div>

        {/* 6 Cafe Bazaar SKU Product Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {SHOP_PRODUCTS.map((product) => {
            const owned = isOwnedPermanent(product);
            return (
              <div
                key={product.sku}
                className="cartoon-panel rounded-2xl p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>SKU: {product.sku}</span>
                    {product.featured && (
                      <span className="font-sans font-black text-amber-300">
                        {lang === 'fa' ? 'پیشنهاد ویژه' : 'FEATURED'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {lang === 'fa' ? product.titleFa : product.titleEn}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {lang === 'fa' ? product.descFa : product.descEn}
                  </p>
                </div>

                <button
                  disabled={owned || purchasePending}
                  onClick={() => setConfirmProduct(product)}
                  className={`arcade-btn w-full py-3 rounded-xl border-2 font-black text-sm flex items-center justify-center gap-2 cursor-pointer ${
                    owned
                      ? 'bg-slate-800 border-emerald-400/40 text-emerald-300 cursor-default'
                      : `bg-gradient-to-b ${product.accent} border-white/40 text-white`
                  }`}
                >
                  {owned ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t(lang, 'owned')}</span>
                    </>
                  ) : (
                    <span>{lang === 'fa' ? product.priceToman : product.priceUsd}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Purchase Confirmation Sheet (Poolakey Sandbox Flow) */}
      {confirmProduct && (
        <div className="fixed inset-0 z-40 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md cartoon-panel rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                {lang === 'fa' ? 'تأیید پرداخت آزمایشی کافه‌بازار' : 'Cafe Bazaar Sandbox Checkout'}
              </h3>
              <button
                onClick={() => setConfirmProduct(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-white/10 space-y-1">
              <div className="font-black text-amber-300">
                {lang === 'fa' ? confirmProduct.titleFa : confirmProduct.titleEn}
              </div>
              <div className="text-xs text-slate-300">
                {lang === 'fa' ? confirmProduct.descFa : confirmProduct.descEn}
              </div>
              <div className="text-xs font-mono text-sky-300 pt-1">
                Product ID: {confirmProduct.sku} ·{' '}
                {lang === 'fa' ? confirmProduct.priceToman : confirmProduct.priceUsd}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {lang === 'fa'
                ? 'این یک شبیه‌ساز آزمایشی وب بدون کسر وجه واقعی است. در نسخه اندروید کافه‌بازار، تراکنش با کتابخانه رسمی Poolakey و کلید RSA پنل توسعه‌دهندگان تأیید می‌شود.'
                : 'No real money is charged in this web preview. Production Android builds verify transactions via the official Cafe Bazaar Poolakey SDK and developer RSA key.'}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setConfirmProduct(null)}
                className="arcade-btn py-2.5 rounded-xl bg-slate-800 border border-white/15 text-slate-200 font-bold text-sm cursor-pointer"
              >
                {lang === 'fa' ? 'لغو خرید' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (purchasePending) return;
                  const chosen = confirmProduct;
                  setConfirmProduct(null);
                  onStartPurchase(chosen);
                }}
                disabled={purchasePending}
                className="arcade-btn py-2.5 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 border-2 border-emerald-200 text-slate-950 font-black text-sm cursor-pointer disabled:opacity-60"
              >
                {purchasePending
                  ? t(lang, 'loadingWorld')
                  : lang === 'fa'
                  ? 'تأیید تراکنش آزمایشی'
                  : 'Verify Sandbox Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ==================== DAILY MISSIONS MODAL ==================== */
interface MissionsModalProps {
  lang: Language;
  save: SaveData;
  onClaimMission: (missionId: string) => void;
  onBack: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  lang,
  save,
  onClaimMission,
  onBack,
}) => {
  const BackIcon = lang === 'fa' ? ArrowRight : ArrowLeft;
  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-950/92 p-4 sm:p-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/15">
        <button
          onClick={onBack}
          className="cartoon-hud-chip arcade-btn flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t(lang, 'back')}</span>
        </button>
        <h2 className="font-black text-xl sm:text-2xl text-white">{t(lang, 'missions')}</h2>
        <div className="cartoon-hud-chip flex items-center gap-2 px-3.5 py-2 rounded-xl">
          <GoldCoinIcon className="w-5 h-5" />
          <span className="font-black text-yellow-300 tabular-nums">
            {formatNumber(save.coins, lang)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto turbo-scroll mt-4 max-w-3xl w-full mx-auto space-y-3 pb-6">
        {DAILY_MISSIONS.map((m) => {
          const current = Math.min(m.target, save.dailyMissions.values[m.id] ?? 0);
          const done = current >= m.target;
          const claimed = Boolean(save.dailyMissions.claimed[m.id]);
          const pct = Math.round((current / m.target) * 100);

          return (
            <div
              key={m.id}
              className="cartoon-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-white">
                    {lang === 'fa' ? m.titleFa : m.titleEn}
                  </span>
                  <span className="text-xs font-black text-sky-300 tabular-nums">
                    {formatNumber(current, lang)} / {formatNumber(m.target, lang)}
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      done ? 'bg-emerald-400' : 'bg-gradient-to-r from-sky-400 to-violet-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <button
                disabled={!done || claimed}
                onClick={() => onClaimMission(m.id)}
                className={`arcade-btn px-4 py-2.5 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 min-w-[130px] cursor-pointer ${
                  claimed
                    ? 'bg-slate-800 border-emerald-400/35 text-emerald-300 cursor-default'
                    : done
                    ? 'bg-gradient-to-b from-amber-400 to-orange-500 border-yellow-200 text-slate-950'
                    : 'bg-slate-800 border-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                {claimed ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t(lang, 'claimed')}</span>
                  </>
                ) : (
                  <>
                    <GoldCoinIcon className="w-4 h-4" />
                    <span>+{formatNumber(m.rewardCoins, lang)}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ==================== 7-DAY DAILY REWARDS MODAL ==================== */
interface DailyRewardsModalProps {
  lang: Language;
  save: SaveData;
  onClaimDaily: (doubleViaAd: boolean) => void;
  onBack: () => void;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
  lang,
  save,
  onClaimDaily,
  onBack,
}) => {
  const BackIcon = lang === 'fa' ? ArrowRight : ArrowLeft;
  const canClaim = canClaimDailyRewardToday(save);
  const activeDay = getNextDailyRewardDay(save);
  const activeConfig = DAILY_REWARDS[activeDay - 1] ?? DAILY_REWARDS[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-950/92 p-4 sm:p-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/15">
        <button
          onClick={onBack}
          className="cartoon-hud-chip arcade-btn flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t(lang, 'back')}</span>
        </button>
        <h2 className="font-black text-xl sm:text-2xl text-white flex items-center gap-2">
          <Gift className="w-6 h-6 text-amber-400" />
          <span>{t(lang, 'dailyRewards')}</span>
        </h2>
        <div className="cartoon-hud-chip flex items-center gap-2 px-3.5 py-2 rounded-xl">
          <GoldCoinIcon className="w-5 h-5" />
          <span className="font-black text-yellow-300 tabular-nums">
            {formatNumber(save.coins, lang)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto turbo-scroll mt-5 max-w-4xl w-full mx-auto flex flex-col justify-between gap-5 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {DAILY_REWARDS.map((r) => {
            const isPast = r.day < activeDay || (!canClaim && r.day === activeDay);
            const isCurrent = canClaim && r.day === activeDay;
            return (
              <div
                key={r.day}
                className={`rounded-2xl p-3.5 border-2 flex flex-col items-center justify-between gap-2 text-center ${
                  isCurrent
                    ? 'bg-gradient-to-b from-amber-500/25 to-slate-900 border-yellow-300'
                    : isPast
                    ? 'bg-emerald-950/40 border-emerald-500/40'
                    : 'bg-slate-900/90 border-white/10'
                }`}
              >
                <span className="text-xs font-extrabold text-slate-300">
                  {t(lang, 'day')} {formatNumber(r.day, lang)}
                </span>
                <GoldCoinIcon className="w-10 h-10" />
                <span className="font-black text-base text-yellow-300 tabular-nums">
                  +{formatNumber(r.coins, lang)}
                </span>
                {isPast ? (
                  <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {t(lang, 'claimed')}
                  </span>
                ) : isCurrent ? (
                  <span className="text-[11px] font-black text-amber-300">{t(lang, 'today')}</span>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    {r.bonusLabelFa && lang === 'fa'
                      ? r.bonusLabelFa
                      : r.bonusLabelEn ?? '—'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="cartoon-panel rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          {canClaim ? (
            <>
              <div>
                <div className="font-black text-lg text-white">
                  {t(lang, 'day')} {formatNumber(activeDay, lang)}: +
                  {formatNumber(activeConfig.coins, lang)} {t(lang, 'coins')}
                </div>
                <div className="text-xs text-slate-300">
                  {lang === 'fa'
                    ? 'با تماشای تبلیغ اختیاری می‌توانید ۲ برابر جایزه بگیرید!'
                    : 'Optionally watch a short ad to double today’s reward!'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => onClaimDaily(false)}
                  className="arcade-btn px-5 py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 border-2 border-emerald-200 text-slate-950 font-black text-sm cursor-pointer"
                >
                  {t(lang, 'claim')}
                </button>
                <button
                  onClick={() => onClaimDaily(true)}
                  className="arcade-btn px-5 py-3 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 border-2 border-yellow-200 text-slate-950 font-black text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>{t(lang, 'claimDoubleAd')}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full text-center font-bold text-emerald-300 py-2">
              {t(lang, 'comeBackTomorrow')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==================== SETTINGS & UNITY/BAZAAR GUIDE MODAL ==================== */
interface SettingsModalProps {
  lang: Language;
  settings: GameSettings;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onResetSave: () => void;
  onBack: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  lang,
  settings,
  onUpdateSettings,
  onResetSave,
  onBack,
}) => {
  const BackIcon = lang === 'fa' ? ArrowRight : ArrowLeft;
  const [confirmReset, setConfirmReset] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-950/92 p-4 sm:p-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/15">
        <button
          onClick={onBack}
          className="cartoon-hud-chip arcade-btn flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t(lang, 'back')}</span>
        </button>
        <h2 className="font-black text-xl sm:text-2xl text-white">{t(lang, 'settings')}</h2>
        <div className="w-20" />
      </div>

      <div className="flex-1 overflow-y-auto turbo-scroll mt-4 max-w-2xl w-full mx-auto space-y-4 pb-8">
        {/* Language */}
        <div className="cartoon-panel rounded-2xl p-4 flex items-center justify-between gap-4">
          <span className="font-extrabold text-sm sm:text-base">{t(lang, 'languageLabel')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateSettings({ language: 'fa' })}
              className={`px-4 py-2 rounded-xl font-bold text-sm cursor-pointer ${
                settings.language === 'fa' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              فارسی
            </button>
            <button
              onClick={() => onUpdateSettings({ language: 'en' })}
              className={`px-4 py-2 rounded-xl font-bold text-sm cursor-pointer ${
                settings.language === 'en' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Audio Sliders */}
        <div className="cartoon-panel rounded-2xl p-4 space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold">
              <span>{t(lang, 'musicVolume')}</span>
              <span className="text-sky-300 tabular-nums">{Math.round(settings.musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => onUpdateSettings({ musicVolume: Number(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold">
              <span>{t(lang, 'sfxVolume')}</span>
              <span className="text-amber-300 tabular-nums">{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => onUpdateSettings({ sfxVolume: Number(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm font-bold">
              <span>{t(lang, 'steeringSensitivity')}</span>
              <span className="text-emerald-300 tabular-nums">
                {settings.steeringSensitivity.toFixed(1)}×
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={settings.steeringSensitivity}
              onChange={(e) => onUpdateSettings({ steeringSensitivity: Number(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Graphics Quality & Controls */}
        <div className="cartoon-panel rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <span className="font-extrabold text-sm">{t(lang, 'graphicsQuality')}</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'auto'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => onUpdateSettings({ graphicsQuality: q })}
                  className={`py-2 px-2 rounded-xl text-xs font-bold cursor-pointer ${
                    settings.graphicsQuality === q
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {q === 'low'
                    ? t(lang, 'qualityLow')
                    : q === 'medium'
                    ? t(lang, 'qualityMedium')
                    : q === 'high'
                    ? t(lang, 'qualityHigh')
                    : t(lang, 'qualityAuto')}
                </button>
              ))}
            </div>
            {settings.graphicsQuality === 'auto' && (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {lang === 'fa'
                  ? 'کیفیت خودکار از تنظیم محافظه‌کارانه شروع می‌کند و بر اساس زمان فریم، رزولوشن را کم یا زیاد می‌کند.'
                  : 'Auto starts conservatively and scales render resolution up or down based on frame time.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <span className="font-extrabold text-sm">{t(lang, 'controlScheme')}</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onUpdateSettings({ controlScheme: 'buttons' })}
                className={`py-2 px-2 rounded-xl text-xs font-bold cursor-pointer ${
                  settings.controlScheme === 'buttons'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {t(lang, 'controlButtons')}
              </button>
              <button
                onClick={() => onUpdateSettings({ controlScheme: 'wheel' })}
                className={`py-2 px-2 rounded-xl text-xs font-bold cursor-pointer ${
                  settings.controlScheme === 'wheel'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {t(lang, 'controlWheel')}
              </button>
              <button
                onClick={() => onUpdateSettings({ controlScheme: 'drag' })}
                className={`py-2 px-2 rounded-xl text-xs font-bold cursor-pointer ${
                  settings.controlScheme === 'drag'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {t(lang, 'controlDrag')}
              </button>
            </div>
          </div>

          <SliderRow
            label={t(lang, 'steeringDeadZone')}
            valueLabel={`${Math.round(settings.steeringDeadZone * 100)}%`}
            min={0}
            max={0.2}
            step={0.01}
            value={settings.steeringDeadZone}
            accent="accent-sky-400"
            onChange={(v) => onUpdateSettings({ steeringDeadZone: v })}
          />
          <SliderRow
            label={t(lang, 'controlScale')}
            valueLabel={`${Math.round(settings.controlScale * 100)}%`}
            min={0.8}
            max={1.25}
            step={0.05}
            value={settings.controlScale}
            accent="accent-amber-400"
            onChange={(v) => onUpdateSettings({ controlScale: v })}
          />
          <SliderRow
            label={t(lang, 'controlOpacity')}
            valueLabel={`${Math.round(settings.controlOpacity * 100)}%`}
            min={0.4}
            max={1}
            step={0.05}
            value={settings.controlOpacity}
            accent="accent-emerald-400"
            onChange={(v) => onUpdateSettings({ controlOpacity: v })}
          />
          <ToggleRow
            label={t(lang, 'leftHanded')}
            checked={settings.leftHanded}
            onChange={(v) => onUpdateSettings({ leftHanded: v })}
          />
        </div>

        {/* Effects & Accessibility */}
        <div className="cartoon-panel rounded-2xl p-4 space-y-3">
          <span className="font-extrabold text-sm">{t(lang, 'graphicsEffects')}</span>
          <SliderRow
            label={t(lang, 'shakeIntensity')}
            valueLabel={`${Math.round(settings.shakeIntensity * 100)}%`}
            min={0}
            max={1.5}
            step={0.1}
            value={settings.shakeIntensity}
            accent="accent-rose-400"
            onChange={(v) => onUpdateSettings({ shakeIntensity: v })}
          />
          <ToggleRow
            label={t(lang, 'reduceMotion')}
            checked={settings.reduceMotion}
            onChange={(v) =>
              onUpdateSettings({
                reduceMotion: v,
              })
            }
          />
          <ToggleRow
            label={t(lang, 'chromaticAberration')}
            checked={settings.chromaticAberration}
            onChange={(v) => onUpdateSettings({ chromaticAberration: v })}
          />
          <ToggleRow
            label={t(lang, 'filmGrain')}
            checked={settings.filmGrain}
            onChange={(v) => onUpdateSettings({ filmGrain: v })}
          />
          <ToggleRow
            label={t(lang, 'speedLines')}
            checked={settings.speedLines}
            onChange={(v) => onUpdateSettings({ speedLines: v })}
          />
          <ToggleRow
            label={t(lang, 'bloomEnabled')}
            checked={settings.bloomEnabled}
            onChange={(v) => onUpdateSettings({ bloomEnabled: v })}
          />
          <ToggleRow
            label={t(lang, 'hapticsLabel')}
            checked={settings.hapticsEnabled}
            onChange={(v) => onUpdateSettings({ hapticsEnabled: v })}
          />
          <ToggleRow
            label={t(lang, 'batterySaverLabel')}
            checked={settings.batterySaver}
            onChange={(v) => onUpdateSettings({ batterySaver: v })}
          />
        </div>

        {/* Unity 6.3 & Cafe Bazaar Publishing Checklist */}
        <div className="cartoon-panel rounded-2xl p-4 space-y-3">
          <button
            onClick={() => setShowGuide((g) => !g)}
            className="w-full flex items-center justify-between text-start cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Code2 className="w-5 h-5 text-sky-400" />
              <div>
                <div className="font-black text-sm text-white">{t(lang, 'unityExportTitle')}</div>
                <div className="text-xs text-slate-400">{t(lang, 'unityExportDesc')}</div>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-300">
              {showGuide ? t(lang, 'close') : '▼'}
            </span>
          </button>

          {showGuide && (
            <div className="pt-2 border-t border-white/10 text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>Cafe Bazaar Poolakey SKUs:</strong>{' '}
                <code className="text-amber-300">
                  coins_500, coins_1500, coins_5000, starter_pack, premium_car, remove_ads
                </code>
              </p>
              <p>
                <strong>Iran-Compatible Ad Mediation:</strong> Tapsell Plus Unity SDK (Rewarded,
                Interstitial, Banner) wired behind an abstract <code>IAdProvider</code> interface.
              </p>
              <p>
                <strong>Required Developer Credentials for Production Android Release:</strong>{' '}
                Cafe Bazaar Developer Panel RSA Public Key, Android Keystore (`.keystore` kept
                outside source control), Package Name (e.g. <code>com.turboroad.racing</code>),
                Target API 34+, and Tapsell App Key + Zone IDs.
              </p>
            </div>
          )}
        </div>

        {/* Reset Progress */}
        <div className="cartoon-panel rounded-2xl p-4 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-rose-300">{t(lang, 'resetSave')}</span>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold cursor-pointer"
              >
                {t(lang, 'close')}
              </button>
              <button
                onClick={() => {
                  setConfirmReset(false);
                  onResetSave();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black cursor-pointer"
              >
                {t(lang, 'confirmReset')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t(lang, 'resetSave')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==================== SMALL SETTINGS CONTROLS ==================== */
const SliderRow: React.FC<{
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  accent: string;
  onChange: (value: number) => void;
}> = ({ label, valueLabel, min, max, step, value, accent, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-sm font-bold">
      <span>{label}</span>
      <span className="text-sky-300 tabular-nums">{valueLabel}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full ${accent} cursor-pointer`}
    />
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className="w-full flex items-center justify-between gap-3 text-sm font-bold cursor-pointer"
    role="switch"
    aria-checked={checked}
  >
    <span>{label}</span>
    <span
      className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
        checked ? 'bg-emerald-400' : 'bg-slate-700'
      }`}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

/* ==================== AD PLAYER SIMULATOR OVERLAY ==================== */
interface AdOverlayProps {
  lang: Language;
  kind: 'rewarded' | 'interstitial';
  onComplete: () => void;
  onCancel: () => void;
}

export const AdPlayerOverlay: React.FC<AdOverlayProps> = ({
  lang,
  kind,
  onComplete,
  onCancel,
}) => {
  const duration = kind === 'rewarded' ? 3 : 2;
  const [secondsLeft, setSecondsLeft] = useState(duration);

  useEffect(() => {
    setSecondsLeft(duration);
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [duration]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4">
      <div className="w-full max-w-md cartoon-panel rounded-3xl p-6 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-500/20 border-2 border-sky-400 flex items-center justify-center">
          <Video className="w-8 h-8 text-sky-400" />
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-black text-white">
            {kind === 'rewarded' ? t(lang, 'adWatching') : t(lang, 'interstitialTitle')}
          </h3>
          <p className="text-xs text-slate-400">
            {lang === 'fa'
              ? 'پیش‌نمایش اسلات تبلیغاتی Tapsell Plus / IAdProvider'
              : 'Tapsell Plus / IAdProvider Ad Slot Preview'}
          </p>
        </div>

        <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-amber-400 transition-all duration-500"
            style={{ width: `${((duration - secondsLeft) / duration) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-3">
          {secondsLeft > 0 ? (
            <span className="text-sm font-black text-amber-300 tabular-nums">
              {t(lang, 'skipIn')} {formatNumber(secondsLeft, lang)}s...
            </span>
          ) : (
            <button
              onClick={onComplete}
              className="arcade-btn px-6 py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 border-2 border-emerald-200 text-slate-950 font-black text-sm cursor-pointer"
            >
              {kind === 'rewarded' ? t(lang, 'adComplete') : t(lang, 'skipAd')}
            </button>
          )}

          {kind === 'rewarded' && secondsLeft > 0 && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold cursor-pointer"
            >
              {t(lang, 'close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
