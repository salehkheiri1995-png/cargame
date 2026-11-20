import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  DoorClosed,
  DoorOpen,
  Gauge,
  Lock,
  Palette,
  RotateCw,
  ShoppingBag,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  computeEffectiveStats,
  computePowerIndex,
  getDefaultUpgrades,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  PAINT_PALETTE,
  TOTAL_VEHICLES,
  VEHICLES,
} from '../game/data/vehicles';
import { formatNumber, getCategoryLabel, getTierLabel, t } from '../game/i18n';
import type {
  Language,
  SaveData,
  VehicleCategory,
  VehicleConfig,
  VehicleTier,
  VehicleUpgradeLevels,
} from '../game/types';
import { GoldCoinIcon } from './TurboLogo';

interface GarageOverlayProps {
  lang: Language;
  save: SaveData;
  viewingCarId: string;
  onSelectViewingCar: (carId: string) => void;
  onBuyCar: (car: VehicleConfig) => void;
  onEquipCar: (carId: string) => void;
  onChangePaint: (carId: string, hex: string) => void;
  onUpgradeStat: (car: VehicleConfig, stat: keyof VehicleUpgradeLevels) => void;
  doorsOpen: boolean;
  onToggleDoors: () => void;
  onDockCollapsedChange?: (collapsed: boolean) => void;
  onOpenShop: () => void;
  onBack: () => void;
}

const STAT_KEYS: (keyof VehicleUpgradeLevels)[] = [
  'speed',
  'accel',
  'nitro',
  'handling',
  'braking',
];

const CATEGORIES: ('all' | VehicleCategory)[] = [
  'all',
  'city',
  'sport',
  'muscle',
  'offroad',
  'racing',
  'hyper',
  'special',
];

const TIER_TEXT_COLOR: Record<VehicleTier, string> = {
  common: 'text-slate-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  legendary: 'text-amber-300',
  mythic: 'text-rose-300',
};

const TIER_ACCENT_BORDER: Record<VehicleTier, string> = {
  common: 'border-slate-500/40',
  rare: 'border-sky-400/55',
  epic: 'border-violet-400/60',
  legendary: 'border-amber-400/70',
  mythic: 'border-rose-400/80',
};

function describeFinish(lang: Language, finish: VehicleConfig['visual']['finish']): string {
  const map: Record<VehicleConfig['visual']['finish'], { fa: string; en: string }> = {
    gloss: { fa: 'متالیک براق نمایشگاهی', en: 'Showroom Metallic Gloss' },
    matte: { fa: 'مات مسابقه‌ای (Stealth)', en: 'Stealth Matte Finish' },
    chrome: { fa: 'کروم آینه‌ای لوکس', en: 'Mirror Chrome Finish' },
    iridescent: { fa: 'هفت‌رنگ پرل متالیک', en: 'Iridescent Pearl Coat' },
  };
  return map[finish][lang];
}

function describeSpoiler(lang: Language, spoiler: VehicleConfig['visual']['spoiler']): string {
  const map: Record<VehicleConfig['visual']['spoiler'], { fa: string; en: string }> = {
    none: { fa: 'آیرودینامیک پاک بدون بال', en: 'Clean Aero Profile' },
    lip: { fa: 'لیپ کربنی ظریف', en: 'Carbon Lip Spoiler' },
    ducktail: { fa: 'بال دم‌اردکی کلاسیک', en: 'Classic Ducktail Wing' },
    rally: { fa: 'بال دوبل رالی WRC', en: 'WRC Box Rally Wing' },
    gt: { fa: 'بال کربنی GT پیست', en: 'GT Track Carbon Wing' },
    swanNeck: { fa: 'بال گردن‌قو مسابقه‌ای', en: 'Swan-Neck Aero Wing' },
    twinFin: { fa: 'بال دوقلوی ابرخودرو', en: 'Twin-Fin Hyper Aero' },
    formula: { fa: 'بال چندطبقه فرمول یک', en: 'Formula Multi-Plane Wing' },
    crown: { fa: 'بال تاج‌دار افسانه‌ای', en: 'Mythic Crown Wing' },
  };
  return map[spoiler][lang];
}

function describeRims(lang: Language, rim: VehicleConfig['visual']['rimStyle']): string {
  const map: Record<VehicleConfig['visual']['rimStyle'], { fa: string; en: string }> = {
    twin5: { fa: 'رینگ اسپرت پنج‌پر دوقلو', en: 'Twin 5-Spoke Forged' },
    mesh: { fa: 'رینگ شبکه‌ای لوکس', en: 'Multi-Mesh Alloy' },
    deepDish: { fa: 'رینگ لبه‌عمیق دریفت', en: 'Deep-Dish JDM Alloy' },
    turbofan: { fa: 'رینگ توربوفن مسابقه‌ای', en: 'Aero Turbofan Discs' },
    blade: { fa: 'رینگ تیغه‌ای هایپرکار', en: 'Aero Blade Forged' },
    offroad: { fa: 'رینگ بیدلاک آفرود', en: 'Beadlock Off-Road' },
  };
  return map[rim][lang];
}

export const GarageOverlay: React.FC<GarageOverlayProps> = ({
  lang,
  save,
  viewingCarId,
  onSelectViewingCar,
  onBuyCar,
  onEquipCar,
  onChangePaint,
  onUpgradeStat,
  doorsOpen,
  onToggleDoors,
  onDockCollapsedChange,
  onOpenShop,
  onBack,
}) => {
  const [tab, setTab] = useState<'catalog' | 'specs' | 'paint' | 'upgrades'>('catalog');
  const [categoryFilter, setCategoryFilter] = useState<'all' | VehicleCategory>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'locked'>('all');
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const activeCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    onDockCollapsedChange?.(dockCollapsed);
  }, [dockCollapsed, onDockCollapsedChange]);

  const BackIcon = lang === 'fa' ? ArrowRight : ArrowLeft;
  const globalIndex = Math.max(0, VEHICLES.findIndex((v) => v.id === viewingCarId));
  const car = VEHICLES[globalIndex] ?? VEHICLES[0];

  const filteredVehicles = useMemo(() => {
    return VEHICLES.filter((v) => {
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      const owned = save.ownedCars.includes(v.id);
      if (ownershipFilter === 'owned' && !owned) return false;
      if (ownershipFilter === 'locked' && owned) return false;
      return true;
    });
  }, [categoryFilter, ownershipFilter, save.ownedCars]);

  useEffect(() => {
    if (tab === 'catalog' && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [viewingCarId, tab, categoryFilter, ownershipFilter]);

  const isOwned = save.ownedCars.includes(car.id);
  const isEquipped = save.selectedCarId === car.id;
  const upgrades = save.carUpgrades[car.id] ?? getDefaultUpgrades();
  const effectiveStats = computeEffectiveStats(car, upgrades);
  const powerIndex = computePowerIndex(effectiveStats);
  const activeColor = save.carColors[car.id] ?? car.defaultColor;
  const activeSwatch =
    PAINT_PALETTE.find((p) => p.hex.toLowerCase() === activeColor.toLowerCase()) ?? null;

  const unlockProgress =
    car.price > 0 ? Math.min(100, Math.round((save.coins / car.price) * 100)) : 100;
  const coinsMissing = Math.max(0, car.price - save.coins);

  const stepCar = (delta: number) => {
    const list = filteredVehicles.length > 0 ? filteredVehicles : VEHICLES;
    const idxInList = list.findIndex((v) => v.id === car.id);
    if (idxInList === -1) {
      onSelectViewingCar(list[0].id);
      return;
    }
    const nextIdx = (idxInList + delta + list.length) % list.length;
    onSelectViewingCar(list[nextIdx].id);
  };

  const handleCategoryChange = (cat: 'all' | VehicleCategory) => {
    setCategoryFilter(cat);
    const matching = VEHICLES.filter((v) => {
      if (cat !== 'all' && v.category !== cat) return false;
      const owned = save.ownedCars.includes(v.id);
      if (ownershipFilter === 'owned' && !owned) return false;
      if (ownershipFilter === 'locked' && owned) return false;
      return true;
    });
    if (matching.length > 0 && !matching.some((v) => v.id === viewingCarId)) {
      onSelectViewingCar(matching[0].id);
    }
  };

  const handleOwnershipChange = (mode: 'all' | 'owned' | 'locked') => {
    setOwnershipFilter(mode);
    const matching = VEHICLES.filter((v) => {
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      const owned = save.ownedCars.includes(v.id);
      if (mode === 'owned' && !owned) return false;
      if (mode === 'locked' && owned) return false;
      return true;
    });
    if (matching.length > 0 && !matching.some((v) => v.id === viewingCarId)) {
      onSelectViewingCar(matching[0].id);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4 pointer-events-none">
      {/* Top Perimeter Bar */}
      <div className="flex items-center justify-between gap-2 pointer-events-auto">
        <button
          onClick={onBack}
          className="cartoon-hud-chip arcade-btn flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm cursor-pointer whitespace-nowrap shrink-0"
        >
          <BackIcon className="w-4 h-4 shrink-0" />
          <span>{t(lang, 'back')}</span>
        </button>

        {/* Vehicle Nameplate — compact & crisp */}
        <div className="cartoon-hud-chip px-3.5 py-1 sm:px-5 sm:py-1.5 rounded-xl text-center min-w-0">
          <div className="text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1.5 text-slate-300 truncate">
            <span className="text-sky-300">{getCategoryLabel(lang, car.category)}</span>
            <span className="text-white/25">·</span>
            <span className={TIER_TEXT_COLOR[car.tier]}>{getTierLabel(lang, car.tier)}</span>
            <span className="text-white/25">·</span>
            <span className="font-telemetry text-amber-300 tabular-nums">
              PI {formatNumber(powerIndex, lang)}
            </span>
            <span className="hidden sm:inline text-white/25">·</span>
            <span className="hidden sm:inline font-telemetry text-slate-400 tabular-nums">
              {formatNumber(globalIndex + 1, lang)} / {formatNumber(TOTAL_VEHICLES, lang)}
            </span>
          </div>
          <div className="font-racing-title text-base sm:text-xl text-white leading-tight truncate">
            {lang === 'fa' ? car.nameFa : car.nameEn}
          </div>
        </div>

        {/* Owned Progress + Coin Balance */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 cartoon-hud-chip px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-slate-200 whitespace-nowrap">
            <Car className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-telemetry tabular-nums">
              {formatNumber(save.ownedCars.length, lang)}/{formatNumber(TOTAL_VEHICLES, lang)}
            </span>
          </div>

          <button
            onClick={onOpenShop}
            className="cartoon-hud-chip arcade-btn flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
          >
            <GoldCoinIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="font-telemetry font-black text-sm sm:text-base text-yellow-300 tabular-nums">
              {formatNumber(save.coins, lang)}
            </span>
          </button>
        </div>
      </div>

      {/* Wide-Open Unobstructed 3D Turntable Stage + Side Cycle Arrows */}
      <div className="flex-1 flex items-center justify-between px-0.5 sm:px-2 min-h-0">
        <button
          onClick={() => stepCar(lang === 'fa' ? 1 : -1)}
          aria-label="Previous Car"
          className="pointer-events-auto cartoon-hud-chip arcade-btn p-2.5 sm:p-3 rounded-2xl text-white cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <button
          onClick={() => stepCar(lang === 'fa' ? -1 : 1)}
          aria-label="Next Car"
          className="pointer-events-auto cartoon-hud-chip arcade-btn p-2.5 sm:p-3 rounded-2xl text-white cursor-pointer"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Sleek Low-Profile Showroom Dealership Dock */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center pointer-events-auto">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {car.archetype !== 'formula' && (
            <button
              onClick={onToggleDoors}
              className={`px-3.5 py-0.5 rounded-t-xl border-t border-x text-[11px] font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                doorsOpen
                  ? 'bg-amber-400 border-yellow-200 text-slate-950'
                  : 'bg-slate-900/95 border-amber-400/45 text-amber-300 hover:bg-slate-800'
              }`}
            >
              {doorsOpen ? (
                <DoorClosed className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <DoorOpen className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{doorsOpen ? t(lang, 'closeDoors') : t(lang, 'openDoors')}</span>
            </button>
          )}

          <button
            onClick={() => setDockCollapsed((c) => !c)}
            className="px-3.5 py-0.5 rounded-t-xl bg-slate-900/95 border-t border-x border-white/20 text-[11px] font-bold text-sky-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>
              {dockCollapsed
                ? lang === 'fa'
                  ? `نمایش نمایشگاه (${formatNumber(TOTAL_VEHICLES, lang)} خودرو)`
                  : `Open Dealership (${TOTAL_VEHICLES} Cars)`
                : lang === 'fa'
                ? 'بستن پنل (نمای تمام‌صفحه)'
                : 'Zen 3D View'}
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-t-xl bg-slate-950/85 border-t border-x border-white/10 text-[10px] font-bold text-slate-300">
            <RotateCw className="w-3 h-3 text-sky-400 shrink-0" />
            <span>{t(lang, 'rotateHint')}</span>
          </div>
        </div>

        {!dockCollapsed && (
          <div className="w-full cartoon-panel rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2">
            {/* Top Row: 4 Showroom Tabs + Inline Unlock Goal + Primary Action CTA */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-xl border border-white/10 overflow-x-auto turbo-scroll">
                <button
                  onClick={() => setTab('catalog')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    tab === 'catalog'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Car className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'fa'
                      ? `نمایشگاه (${formatNumber(TOTAL_VEHICLES, lang)})`
                      : `Showroom (${TOTAL_VEHICLES})`}
                  </span>
                </button>
                <button
                  onClick={() => setTab('specs')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    tab === 'specs'
                      ? 'bg-indigo-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Gauge className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'fa' ? 'مشخصات' : 'Specs'}</span>
                </button>
                <button
                  onClick={() => setTab('paint')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    tab === 'paint'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 shrink-0" />
                  <span>{t(lang, 'paintColor')}</span>
                </button>
                <button
                  onClick={() => setTab('upgrades')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                    tab === 'upgrades'
                      ? 'bg-emerald-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                  <span>{t(lang, 'upgrade')}</span>
                </button>
              </div>

              {/* Inline Unlock Progress + Action CTA */}
              <div className="flex items-center gap-2 shrink-0">
                {!isOwned && (
                  <div className="hidden lg:flex flex-col w-40 gap-0.5">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-slate-300 truncate">
                        {coinsMissing === 0
                          ? lang === 'fa'
                            ? 'آماده خرید!'
                            : 'Ready!'
                          : lang === 'fa'
                          ? `${formatNumber(coinsMissing, lang)} سکه مانده`
                          : `${formatNumber(coinsMissing, lang)} left`}
                      </span>
                      <span className="font-telemetry text-amber-300 tabular-nums">
                        {formatNumber(unlockProgress, lang)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          coinsMissing === 0
                            ? 'bg-gradient-to-r from-emerald-400 to-lime-300'
                            : 'bg-gradient-to-r from-sky-400 via-amber-400 to-orange-500'
                        }`}
                        style={{ width: `${unlockProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {isOwned ? (
                  <button
                    disabled={isEquipped}
                    onClick={() => onEquipCar(car.id)}
                    className={`arcade-btn px-4 py-1.5 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                      isEquipped
                        ? 'bg-slate-800 border-emerald-400/50 text-emerald-300 cursor-default'
                        : 'bg-gradient-to-b from-emerald-400 to-green-600 border-emerald-200 text-slate-950'
                    }`}
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{isEquipped ? t(lang, 'selected') : t(lang, 'select')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onBuyCar(car)}
                      disabled={save.coins < car.price}
                      className={`arcade-btn px-3.5 py-1.5 rounded-xl border-2 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                        save.coins >= car.price
                          ? 'bg-gradient-to-b from-amber-400 to-orange-500 border-yellow-200 text-slate-950'
                          : 'bg-slate-800 border-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <GoldCoinIcon className="w-4 h-4 shrink-0" />
                      <span className="font-telemetry tabular-nums">
                        {t(lang, 'buy')} ({formatNumber(car.price, lang)})
                      </span>
                    </button>
                    {save.coins < car.price && (
                      <button
                        onClick={onOpenShop}
                        className="arcade-btn px-2.5 py-1.5 rounded-xl bg-violet-600 border-2 border-violet-300 text-white font-bold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{lang === 'fa' ? 'سکه' : 'Coins'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* TAB 1: COMPACT 67-CAR DEALERSHIP CATALOG */}
            {tab === 'catalog' && (
              <div className="flex flex-col gap-1.5">
                {/* Category & Ownership Filters */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto turbo-scroll">
                    {CATEGORIES.map((cat) => {
                      const active = categoryFilter === cat;
                      const label =
                        cat === 'all'
                          ? lang === 'fa'
                            ? 'همه'
                            : 'All'
                          : getCategoryLabel(lang, cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => handleCategoryChange(cat)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-amber-400 border-yellow-200 text-slate-950'
                              : 'bg-slate-900/90 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {(
                      [
                        { id: 'all', fa: 'همه', en: 'All' },
                        { id: 'owned', fa: 'دارم', en: 'Owned' },
                        { id: 'locked', fa: 'قفل', en: 'Locked' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleOwnershipChange(f.id)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold cursor-pointer whitespace-nowrap ${
                          ownershipFilter === f.id
                            ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50'
                            : 'text-slate-400 hover:text-white border border-transparent'
                        }`}
                      >
                        {f[lang]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horizontal Dealership Car Carousel */}
                {filteredVehicles.length === 0 ? (
                  <div className="py-3 text-center text-xs font-bold text-slate-400">
                    {lang === 'fa'
                      ? 'خودرویی با این فیلتر پیدا نشد.'
                      : 'No vehicles match this filter.'}
                  </div>
                ) : (
                  <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1 turbo-scroll">
                    {filteredVehicles.map((v) => {
                      const owned = save.ownedCars.includes(v.id);
                      const equipped = save.selectedCarId === v.id;
                      const active = v.id === car.id;
                      const vColor = save.carColors[v.id] ?? v.defaultColor;
                      const vStats = computeEffectiveStats(
                        v,
                        save.carUpgrades[v.id] ?? getDefaultUpgrades()
                      );
                      const vPi = computePowerIndex(vStats);

                      return (
                        <button
                          key={v.id}
                          ref={active ? activeCardRef : null}
                          onClick={() => onSelectViewingCar(v.id)}
                          className={`shrink-0 w-32 sm:w-36 rounded-xl p-1.5 text-start border-2 transition-colors flex flex-col justify-between gap-1 cursor-pointer ${
                            active
                              ? 'bg-slate-800 border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]'
                              : `bg-slate-900/90 ${TIER_ACCENT_BORDER[v.tier]} hover:bg-slate-800/80`
                          }`}
                        >
                          {/* Metallic Paint + Accent Strip */}
                          <div className="w-full h-2 rounded-sm overflow-hidden flex border border-white/15">
                            <div className="flex-1" style={{ backgroundColor: vColor }} />
                            <div className="w-6" style={{ backgroundColor: v.accentColor }} />
                          </div>

                          {/* Car Name & Tier */}
                          <div className="min-w-0">
                            <div className="text-[11px] sm:text-xs font-black text-white truncate">
                              {lang === 'fa' ? v.nameFa : v.nameEn}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className={TIER_TEXT_COLOR[v.tier]}>
                                {getTierLabel(lang, v.tier)}
                              </span>
                              <span className="font-telemetry text-slate-400 tabular-nums">
                                PI {formatNumber(vPi, lang)}
                              </span>
                            </div>
                          </div>

                          {/* Price / Ownership Footer */}
                          <div className="flex items-center justify-between pt-0.5 border-t border-white/10 text-[10px] sm:text-[11px] font-black">
                            {equipped ? (
                              <span className="text-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 shrink-0" />
                                <span>{t(lang, 'selected')}</span>
                              </span>
                            ) : owned ? (
                              <span className="text-sky-300">
                                {lang === 'fa' ? 'در گاراژ' : 'Owned'}
                              </span>
                            ) : (
                              <span
                                className={`flex items-center gap-1 font-telemetry tabular-nums ${
                                  save.coins >= v.price ? 'text-amber-300' : 'text-slate-400'
                                }`}
                              >
                                <Lock className="w-2.5 h-2.5 shrink-0" />
                                <span>{formatNumber(v.price, lang)}</span>
                              </span>
                            )}
                            {v.visual.underglowHex && (
                              <Sparkles className="w-3 h-3 text-cyan-300 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TECHNICAL SPECS & FACTORY KIT */}
            {tab === 'specs' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                <div className="md:col-span-5 space-y-1.5">
                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                    {lang === 'fa' ? car.descriptionFa : car.descriptionEn}
                  </p>
                  <div className="text-[11px] text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-white/10 pt-1.5">
                    <span>
                      <span className="text-slate-400">{lang === 'fa' ? 'پوشش: ' : 'Finish: '}</span>
                      <strong className="text-white">{describeFinish(lang, car.visual.finish)}</strong>
                    </span>
                    <span>
                      <span className="text-slate-400">{lang === 'fa' ? 'بال: ' : 'Aero: '}</span>
                      <strong className="text-sky-300">{describeSpoiler(lang, car.visual.spoiler)}</strong>
                    </span>
                    <span>
                      <span className="text-slate-400">{lang === 'fa' ? 'رینگ: ' : 'Rims: '}</span>
                      <strong className="text-amber-300">{describeRims(lang, car.visual.rimStyle)}</strong>
                    </span>
                  </div>
                </div>

                <div className="md:col-span-7 grid grid-cols-5 gap-1.5">
                  {STAT_KEYS.map((stat) => (
                    <div key={stat} className="bg-slate-900/90 rounded-xl p-2 border border-white/10">
                      <div className="text-[10px] font-bold text-slate-300 truncate">
                        {t(lang, stat)}
                      </div>
                      <div className="font-telemetry text-sm font-black text-white tabular-nums mt-0.5">
                        {formatNumber(effectiveStats[stat], lang)}
                      </div>
                      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-amber-400 rounded-full"
                          style={{ width: `${effectiveStats[stat]}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: CUSTOM PAINT STUDIO (12 AUTOMOTIVE FINISHES) */}
            {tab === 'paint' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {PAINT_PALETTE.map((swatch) => {
                    const selected = activeColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        onClick={() => onChangePaint(car.id, swatch.hex)}
                        title={lang === 'fa' ? swatch.nameFa : swatch.nameEn}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 cursor-pointer transition-transform ${
                          selected ? 'border-white scale-110' : 'border-white/25 hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    );
                  })}
                </div>
                <div className="text-xs font-bold text-slate-300">
                  {activeSwatch ? (
                    <span>
                      {lang === 'fa' ? 'رنگ انتخابی: ' : 'Selected Paint: '}
                      <strong className="text-white">
                        {lang === 'fa' ? activeSwatch.nameFa : activeSwatch.nameEn}
                      </strong>
                    </span>
                  ) : (
                    <span>
                      {lang === 'fa'
                        ? 'رنگ اختصاصی کارخانه (تغییر رایگان و آنی)'
                        : 'Factory Signature Paint (Free Instant Swap)'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: PERFORMANCE UPGRADES */}
            {tab === 'upgrades' && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {STAT_KEYS.map((stat) => {
                  const lvl = upgrades[stat];
                  const isMax = lvl >= MAX_UPGRADE_LEVEL;
                  const cost = getUpgradeCost(car, lvl);
                  const canAfford = isOwned && !isMax && save.coins >= cost;
                  return (
                    <div
                      key={stat}
                      className="bg-slate-900/90 rounded-xl p-2 border border-white/10 flex flex-col justify-between gap-1.5"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-slate-200 truncate">{t(lang, stat)}</span>
                          <span className="font-telemetry text-sky-300 tabular-nums">
                            {formatNumber(effectiveStats[stat], lang)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: MAX_UPGRADE_LEVEL }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`h-1.5 flex-1 rounded-full ${
                                idx < lvl ? 'bg-amber-400' : 'bg-slate-950'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        disabled={!canAfford}
                        onClick={() => onUpgradeStat(car, stat)}
                        className={`w-full py-1 px-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 cursor-pointer ${
                          isMax
                            ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                            : !isOwned
                            ? 'bg-slate-950 text-slate-500 cursor-not-allowed'
                            : canAfford
                            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                            : 'bg-slate-950 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isMax ? (
                          <span>{t(lang, 'maxed')}</span>
                        ) : !isOwned ? (
                          <span>{t(lang, 'locked')}</span>
                        ) : (
                          <>
                            <GoldCoinIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-telemetry tabular-nums">
                              {formatNumber(cost, lang)}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
