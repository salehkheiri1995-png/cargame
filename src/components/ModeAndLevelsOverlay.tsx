import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Lock, Play, Trophy } from 'lucide-react';
import { ENVIRONMENTS } from '../game/data/environments';
import { isLevelUnlocked, LEVELS, TOTAL_LEVELS } from '../game/data/levels';
import { formatMissionGoal, formatNumber, t } from '../game/i18n';
import type { EnvironmentId, Language, LevelConfig, SaveData } from '../game/types';
import { GoldCoinIcon, StarIcon } from './TurboLogo';

interface ModeSelectOverlayProps {
  lang: Language;
  save: SaveData;
  selectedEnv: EnvironmentId;
  onSelectEnv: (env: EnvironmentId) => void;
  onStartEndless: (env: EnvironmentId) => void;
  onBack: () => void;
}

export const ModeSelectOverlay: React.FC<ModeSelectOverlayProps> = ({
  lang,
  save,
  selectedEnv,
  onSelectEnv,
  onStartEndless,
  onBack,
}) => {
  const BackIcon = lang === 'fa' ? ArrowRight : ArrowLeft;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <button
          onClick={onBack}
          className="cartoon-hud-chip arcade-btn flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t(lang, 'back')}</span>
        </button>

        <div className="cartoon-hud-chip px-4 py-2 rounded-xl font-black text-base sm:text-lg text-amber-300">
          {t(lang, 'endlessMode')}
        </div>

        <div className="cartoon-hud-chip flex items-center gap-2 px-3.5 py-2 rounded-xl">
          <GoldCoinIcon className="w-5 h-5" />
          <span className="font-black text-yellow-300 tabular-nums">
            {formatNumber(save.coins, lang)}
          </span>
        </div>
      </div>

      {/* Live 3D World Preview stays completely visible in the center! */}
      <div className="flex-1" />

      {/* Bottom Compact Environment & Launch Dock */}
      <div className="w-full max-w-4xl mx-auto cartoon-panel rounded-2xl p-4 flex flex-col gap-4 pointer-events-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="font-extrabold text-white">{t(lang, 'selectEnvironment')}</span>
          <div className="flex items-center gap-4 text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              {t(lang, 'bestScore')}:{' '}
              <strong className="text-white tabular-nums">
                {formatNumber(save.endlessBestScore, lang)}
              </strong>
            </span>
            <span>
              {t(lang, 'bestDistance')}:{' '}
              <strong className="text-sky-300 tabular-nums">
                {formatNumber(save.endlessBestDistance, lang)} {t(lang, 'hudMeterUnit')}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {ENVIRONMENTS.map((env) => {
            const active = selectedEnv === env.id;
            return (
              <button
                key={env.id}
                onClick={() => onSelectEnv(env.id)}
                className={`arcade-btn relative px-2.5 py-3 rounded-xl border-2 text-center font-extrabold text-xs cursor-pointer transition-colors ${
                  active
                    ? `bg-gradient-to-b ${env.badgeGradient} border-white text-white`
                    : 'bg-slate-800/90 border-white/15 text-slate-200 hover:border-white/40'
                }`}
              >
                {lang === 'fa' ? env.nameFa : env.nameEn}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onStartEndless(selectedEnv)}
          className="arcade-btn w-full py-3.5 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 border-2 border-yellow-200 text-slate-950 font-black text-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{t(lang, 'play')}</span>
        </button>
      </div>
    </div>
  );
};

interface LevelMapOverlayProps {
  lang: Language;
  save: SaveData;
  onStartLevel: (level: LevelConfig) => void;
  onPreviewEnv: (env: EnvironmentId) => void;
  onBack: () => void;
}

export const LevelMapOverlay: React.FC<LevelMapOverlayProps> = ({
  lang,
  save,
  onStartLevel,
  onPreviewEnv,
  onBack,
}) => {
  const BackIcon = lang === 'fa' ? ArrowRight : ArrowLeft;
  const initialLevel = LEVELS.find((l) => l.id === save.unlockedLevel) ?? LEVELS[0];
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig>(initialLevel);
  const [worldFilter, setWorldFilter] = useState<EnvironmentId | 'all'>('all');

  const totalStars = Object.values(save.levelStars).reduce((a, b) => a + b, 0);
  const filteredLevels =
    worldFilter === 'all' ? LEVELS : LEVELS.filter((l) => l.environment === worldFilter);

  const handleSelectCard = (lvl: LevelConfig) => {
    setSelectedLevel(lvl);
    onPreviewEnv(lvl.environment);
  };

  const diffLabel = (d: LevelConfig['difficulty']) => {
    if (d === 'easy') return t(lang, 'difficultyEasy');
    if (d === 'medium') return t(lang, 'difficultyMedium');
    if (d === 'hard') return t(lang, 'difficultyHard');
    return t(lang, 'difficultyExpert');
  };

  const isSelectedUnlocked = isLevelUnlocked(selectedLevel, save.unlockedLevel);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-950/88 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/15">
        <button
          onClick={onBack}
          className="cartoon-hud-chip arcade-btn flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
        >
          <BackIcon className="w-4 h-4" />
          <span>{t(lang, 'back')}</span>
        </button>

        <div className="flex items-center gap-3">
          <h2 className="font-black text-lg sm:text-2xl text-white">
            {t(lang, 'levelMode')}
          </h2>
          <span className="flex items-center gap-1 text-sm font-bold text-amber-300 tabular-nums">
            <StarIcon filled className="w-4 h-4" />
            {formatNumber(totalStars, lang)} / {formatNumber(TOTAL_LEVELS * 3, lang)}
          </span>
        </div>

        <div className="cartoon-hud-chip flex items-center gap-2 px-3.5 py-2 rounded-xl">
          <GoldCoinIcon className="w-5 h-5" />
          <span className="font-black text-yellow-300 tabular-nums">
            {formatNumber(save.coins, lang)}
          </span>
        </div>
      </div>

      {/* World Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto py-3 shrink-0">
        <button
          onClick={() => setWorldFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer ${
            worldFilter === 'all'
              ? 'bg-sky-500 text-slate-950'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {lang === 'fa' ? `همه ${formatNumber(TOTAL_LEVELS, lang)} مرحله` : `All ${TOTAL_LEVELS} Levels`}
        </button>
        {ENVIRONMENTS.map((env) => (
          <button
            key={env.id}
            onClick={() => {
              setWorldFilter(env.id);
              onPreviewEnv(env.id);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer ${
              worldFilter === env.id
                ? `bg-gradient-to-r ${env.badgeGradient} text-white`
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {lang === 'fa' ? env.nameFa : env.nameEn}
          </button>
        ))}
      </div>

      {/* Main Split: 30-Level Grid + Selected Level Mission Details */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
        {/* Level Grid */}
        <div className="lg:col-span-8 overflow-y-auto turbo-scroll pe-1">
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5 pb-4">
            {filteredLevels.map((lvl) => {
              const unlocked = isLevelUnlocked(lvl, save.unlockedLevel);
              const stars = save.levelStars[lvl.id] ?? 0;
              const active = selectedLevel.id === lvl.id;
              const env = ENVIRONMENTS.find((e) => e.id === lvl.environment)!;
              const isNewChapter = Boolean(lvl.chapterStarter && lvl.id > 1);

              return (
                <button
                  key={lvl.id}
                  onClick={() => handleSelectCard(lvl)}
                  className={`arcade-btn relative flex flex-col items-center justify-between p-3 rounded-2xl border-2 cursor-pointer ${
                    active
                      ? 'border-yellow-300 bg-slate-800'
                      : unlocked
                      ? 'border-white/15 bg-slate-900/90 hover:border-sky-400/60'
                      : 'border-white/5 bg-slate-900/45 opacity-65'
                  }`}
                >
                  <span
                    className={`w-full h-1.5 rounded-full mb-2 bg-gradient-to-r ${env.badgeGradient}`}
                  />
                  {isNewChapter && (
                    <span className="absolute -top-2 end-2 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 text-[9px] font-black tracking-wide">
                      {lang === 'fa' ? 'فصل جدید' : 'NEW'}
                    </span>
                  )}
                  {unlocked ? (
                    <span className="text-xl sm:text-2xl font-black text-white tabular-nums">
                      {formatNumber(lvl.id, lang)}
                    </span>
                  ) : (
                    <Lock className="w-6 h-6 text-slate-500 my-1" />
                  )}

                  <div className="flex items-center gap-0.5 mt-1.5">
                    {[1, 2, 3].map((s) => (
                      <StarIcon key={s} filled={stars >= s} className="w-4 h-4" />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Level Brief & Launch Card */}
        <div className="lg:col-span-4 cartoon-panel rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-sky-300">
              <span>
                {t(lang, 'level')} {formatNumber(selectedLevel.id, lang)} ·{' '}
                {diffLabel(selectedLevel.difficulty)}
              </span>
              <span>
                {lang === 'fa'
                  ? ENVIRONMENTS.find((e) => e.id === selectedLevel.environment)?.nameFa
                  : ENVIRONMENTS.find((e) => e.id === selectedLevel.environment)?.nameEn}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white">
              {lang === 'fa' ? selectedLevel.titleFa : selectedLevel.titleEn}
            </h3>

            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-white/10 space-y-2">
              <div className="text-xs font-bold text-slate-400">
                {lang === 'fa' ? 'هدف اصلی مرحله' : 'Primary Objective'}
              </div>
              <div className="text-base font-extrabold text-amber-300">
                {formatMissionGoal(lang, selectedLevel.missionType, selectedLevel.target)}
              </div>
              {selectedLevel.timeLimitSec && (
                <div className="text-xs text-slate-300 font-semibold tabular-nums">
                  {lang === 'fa'
                    ? `محدودیت زمان: ${formatNumber(selectedLevel.timeLimitSec, lang)} ثانیه`
                    : `Time Limit: ${selectedLevel.timeLimitSec}s`}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm font-bold pt-1">
              <span className="text-slate-300">{t(lang, 'reward')}</span>
              <span className="flex items-center gap-1.5 text-yellow-300 tabular-nums">
                <GoldCoinIcon className="w-5 h-5" />
                +{formatNumber(selectedLevel.rewardCoins, lang)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-slate-300">{t(lang, 'stars')}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((s) => (
                  <StarIcon
                    key={s}
                    filled={(save.levelStars[selectedLevel.id] ?? 0) >= s}
                    className="w-5 h-5"
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            disabled={!isSelectedUnlocked}
            onClick={() => onStartLevel(selectedLevel)}
            className={`arcade-btn w-full py-3.5 rounded-xl border-2 font-black text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer ${
              isSelectedUnlocked
                ? 'bg-gradient-to-b from-emerald-400 to-green-600 border-emerald-200 text-slate-950'
                : 'bg-slate-800 border-white/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSelectedUnlocked ? (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>{t(lang, 'play')}</span>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                <span>
                  {lang === 'fa'
                    ? `برای باز شدن، مرحله ${formatNumber(selectedLevel.id - 1, lang)} را تمام کنید`
                    : `Complete Level ${selectedLevel.id - 1} to Unlock`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
