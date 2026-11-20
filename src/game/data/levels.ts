import type { EnvironmentId, LevelConfig, LevelMissionType } from '../types';

interface LevelBlueprint {
  environment: EnvironmentId;
  missionType: LevelMissionType;
  target: number;
  star2Target: number;
  star3Target: number;
  timeLimitSec?: number;
  hasObstacles: boolean;
  titleFa: string;
  titleEn: string;
  chapterStarter?: boolean;
}

const BLUEPRINTS: LevelBlueprint[] = [
  // Chapter 1 (1 - 6): Metro Expressway
  { environment: 'city', missionType: 'distance', target: 900, star2Target: 32, star3Target: 24, timeLimitSec: 45, hasObstacles: false, titleFa: 'شروع در بزرگراه مدرن', titleEn: 'Expressway Warmup', chapterStarter: true },
  { environment: 'city', missionType: 'coins', target: 35, star2Target: 48, star3Target: 62, timeLimitSec: 55, hasObstacles: false, titleFa: 'شکار سکه‌های طلایی', titleEn: 'Golden Coin Dash' },
  { environment: 'city', missionType: 'overtakes', target: 8, star2Target: 12, star3Target: 16, timeLimitSec: 60, hasObstacles: false, titleFa: 'سبقت‌های نمایشی', titleEn: 'Close Call Overtakes' },
  { environment: 'city', missionType: 'checkpoints', target: 5, star2Target: 35, star3Target: 27, timeLimitSec: 50, hasObstacles: false, titleFa: 'دروازه‌های سرعت', titleEn: 'Speed Gate Run' },
  { environment: 'city', missionType: 'rivals', target: 2, star2Target: 42, star3Target: 32, timeLimitSec: 65, hasObstacles: false, titleFa: 'دوئل با رقیب شهری', titleEn: 'Metro Rival Duel' },
  { environment: 'city', missionType: 'survive', target: 45, star2Target: 55, star3Target: 70, hasObstacles: true, titleFa: 'رانندگی بی‌خطر شهری', titleEn: 'City Survivor' },

  // Chapter 2 (7 - 12): Pacific Coast
  { environment: 'coastal', missionType: 'distance', target: 1400, star2Target: 42, star3Target: 33, timeLimitSec: 55, hasObstacles: false, titleFa: 'نسیم بزرگراه ساحلی', titleEn: 'Coastal Breeze' },
  { environment: 'coastal', missionType: 'coins', target: 60, star2Target: 78, star3Target: 95, timeLimitSec: 65, hasObstacles: false, titleFa: 'گنج ساحل اقیانوس', titleEn: 'Pacific Bounty' },
  { environment: 'coastal', missionType: 'topSpeed', target: 185, star2Target: 205, star3Target: 225, timeLimitSec: 45, hasObstacles: false, titleFa: 'شکستن رکورد سرعت', titleEn: 'Top Speed Sprint' },
  { environment: 'coastal', missionType: 'overtakes', target: 14, star2Target: 19, star3Target: 25, timeLimitSec: 65, hasObstacles: true, titleFa: 'مارپیچ ترافیک ساحلی', titleEn: 'Traffic Slalom' },
  { environment: 'coastal', missionType: 'noHit', target: 1200, star2Target: 40, star3Target: 31, timeLimitSec: 60, hasObstacles: true, titleFa: 'رانندگی بی‌نقص', titleEn: 'Flawless Coastline' },
  { environment: 'coastal', missionType: 'rivals', target: 3, star2Target: 55, star3Target: 42, timeLimitSec: 75, hasObstacles: true, titleFa: 'مسابقه قهرمانان ساحل', titleEn: 'Coastline Rival Cup' },

  // Chapter 3 (13 - 18): Mojave Desert
  { environment: 'desert', missionType: 'distance', target: 1900, star2Target: 52, star3Target: 42, timeLimitSec: 68, hasObstacles: true, titleFa: 'عبور از اتوبان کویر', titleEn: 'Mojave Crossing' },
  { environment: 'desert', missionType: 'coins', target: 85, star2Target: 105, star3Target: 130, timeLimitSec: 75, hasObstacles: true, titleFa: 'طلای بیابان', titleEn: 'Desert Gold Rush' },
  { environment: 'desert', missionType: 'nitroDistance', target: 650, star2Target: 850, star3Target: 1050, timeLimitSec: 70, hasObstacles: false, titleFa: 'طوفان شن و نیترو', titleEn: 'Sandstorm Turbo' },
  { environment: 'desert', missionType: 'overtakes', target: 18, star2Target: 24, star3Target: 30, timeLimitSec: 75, hasObstacles: true, titleFa: 'شکارچی سبقت کویری', titleEn: 'Dune Overtaker' },
  { environment: 'desert', missionType: 'survive', target: 65, star2Target: 80, star3Target: 95, hasObstacles: true, titleFa: 'بقای داغ بیابان', titleEn: 'Heat Endurance' },
  { environment: 'desert', missionType: 'topSpeed', target: 215, star2Target: 235, star3Target: 255, timeLimitSec: 50, hasObstacles: true, titleFa: 'موشک صحرا', titleEn: 'Canyon Rocket' },

  // Chapter 4 (19 - 24): Redwood Forest
  { environment: 'forest', missionType: 'checkpoints', target: 10, star2Target: 58, star3Target: 46, timeLimitSec: 75, hasObstacles: true, titleFa: 'ده دروازه جنگل', titleEn: 'Ten Redwood Gates' },
  { environment: 'forest', missionType: 'coins', target: 100, star2Target: 125, star3Target: 150, timeLimitSec: 80, hasObstacles: true, titleFa: 'صد سکه میان درختان', titleEn: 'Century Forest Hunt' },
  { environment: 'forest', missionType: 'noHit', target: 1800, star2Target: 52, star3Target: 42, timeLimitSec: 75, hasObstacles: true, titleFa: 'سایه بی‌خطا', titleEn: 'Clean Canopy Run' },
  { environment: 'forest', missionType: 'rivals', target: 3, star2Target: 58, star3Target: 46, timeLimitSec: 80, hasObstacles: true, titleFa: 'تعقیب در دره سرسبز', titleEn: 'Timberline Pursuit' },
  { environment: 'forest', missionType: 'nitroDistance', target: 900, star2Target: 1150, star3Target: 1400, timeLimitSec: 80, hasObstacles: true, titleFa: 'آتش در جنگل', titleEn: 'Emerald Afterburner' },
  { environment: 'forest', missionType: 'survive', target: 85, star2Target: 100, star3Target: 120, hasObstacles: true, titleFa: 'استقامت جنگلی', titleEn: 'Forest Marathon' },

  // Chapter 5 (25 - 30): Alpine Summit
  { environment: 'snow', missionType: 'distance', target: 2400, star2Target: 62, star3Target: 50, timeLimitSec: 82, hasObstacles: true, titleFa: 'گردنه برفی آلپ', titleEn: 'Alpine Pass' },
  { environment: 'snow', missionType: 'topSpeed', target: 240, star2Target: 260, star3Target: 280, timeLimitSec: 55, hasObstacles: true, titleFa: 'بهمن سرعت', titleEn: 'Avalanche Velocity' },
  { environment: 'snow', missionType: 'coins', target: 115, star2Target: 140, star3Target: 170, timeLimitSec: 85, hasObstacles: true, titleFa: 'گنج یخی', titleEn: 'Glacier Jackpot' },
  { environment: 'snow', missionType: 'overtakes', target: 24, star2Target: 31, star3Target: 38, timeLimitSec: 85, hasObstacles: true, titleFa: 'استاد سبقت یخی', titleEn: 'Blizzard Master' },
  { environment: 'snow', missionType: 'noHit', target: 2200, star2Target: 60, star3Target: 48, timeLimitSec: 82, hasObstacles: true, titleFa: 'چالش الماس بدون برخورد', titleEn: 'Zero-Scratch Summit' },
  { environment: 'snow', missionType: 'checkpoints', target: 12, star2Target: 66, star3Target: 54, timeLimitSec: 88, hasObstacles: true, titleFa: 'قهرمان قله برفی', titleEn: 'Alpine Cup Finale' },

  // Chapter 6 (31 - 38): NEW! Neon Night City (Wet Rainy Midnight Highway!)
  { environment: 'nightCity', missionType: 'distance', target: 1800, star2Target: 48, star3Target: 38, timeLimitSec: 65, hasObstacles: false, titleFa: '★ شب‌های نئونی زیر باران', titleEn: '★ Neon Rain Debut', chapterStarter: true },
  { environment: 'nightCity', missionType: 'rivals', target: 3, star2Target: 52, star3Target: 40, timeLimitSec: 75, hasObstacles: false, titleFa: '★ شکار رقبای نیمه‌شب', titleEn: '★ Midnight Street Duel' },
  { environment: 'nightCity', missionType: 'overtakes', target: 20, star2Target: 26, star3Target: 34, timeLimitSec: 72, hasObstacles: true, titleFa: '★ لایی‌کشی در بزرگراه بارانی', titleEn: '★ Wet Asphalt Slalom' },
  { environment: 'nightCity', missionType: 'topSpeed', target: 255, star2Target: 275, star3Target: 295, timeLimitSec: 52, hasObstacles: true, titleFa: '★ رعدوبرق ۲۹۵ کیلومتر', titleEn: '★ Neon Mach Sprint' },
  { environment: 'nightCity', missionType: 'nitroDistance', target: 1050, star2Target: 1300, star3Target: 1550, timeLimitSec: 78, hasObstacles: true, titleFa: '★ شعله آبی در تاریکی', titleEn: '★ Afterglow Nitro Run' },
  { environment: 'nightCity', missionType: 'noHit', target: 2300, star2Target: 58, star3Target: 46, timeLimitSec: 78, hasObstacles: true, titleFa: '★ شبح بی‌خطا در شب', titleEn: '★ Midnight Ghost' },
  { environment: 'nightCity', missionType: 'checkpoints', target: 12, star2Target: 62, star3Target: 50, timeLimitSec: 82, hasObstacles: true, titleFa: '★ دروازه‌های نئون توکیو', titleEn: '★ Cyber Gate Rush' },
  { environment: 'nightCity', missionType: 'rivals', target: 4, star2Target: 68, star3Target: 54, timeLimitSec: 88, hasObstacles: true, titleFa: '★ پادشاه مسابقات شبانه', titleEn: '★ King of Midnight' },

  // Chapter 7 (39 - 45): NEW! Sunset Canyon & Ultimate Legend Boss Cup!
  { environment: 'sunsetCanyon', missionType: 'distance', target: 2100, star2Target: 52, star3Target: 42, timeLimitSec: 68, hasObstacles: false, titleFa: '★ طلوع افسانه‌ها در تنگه غروب', titleEn: '★ Golden Canyon Run', chapterStarter: true },
  { environment: 'sunsetCanyon', missionType: 'rivals', target: 3, star2Target: 54, star3Target: 42, timeLimitSec: 75, hasObstacles: true, titleFa: '★ دوئل آتشین دره غروب', titleEn: '★ Sunset Rival Showdown' },
  { environment: 'sunsetCanyon', missionType: 'coins', target: 135, star2Target: 165, star3Target: 195, timeLimitSec: 85, hasObstacles: true, titleFa: '★ خزانه طلایی دره', titleEn: '★ Canyon Gold Vault' },
  { environment: 'sunsetCanyon', missionType: 'overtakes', target: 28, star2Target: 35, star3Target: 44, timeLimitSec: 85, hasObstacles: true, titleFa: '★ طوفان سبقت غروب', titleEn: '★ Red Rock Weaver' },
  { environment: 'sunsetCanyon', missionType: 'topSpeed', target: 280, star2Target: 300, star3Target: 320, timeLimitSec: 55, hasObstacles: true, titleFa: '★ شکستن دیوار ۳۰۰ کیلومتر', titleEn: '★ 300 KM/H Barrier' },
  { environment: 'sunsetCanyon', missionType: 'noHit', target: 2800, star2Target: 68, star3Target: 55, timeLimitSec: 88, hasObstacles: true, titleFa: '★ مسیر الماس بدون خطا', titleEn: '★ Untouchable Legend' },
  { environment: 'sunsetCanyon', missionType: 'rivals', target: 5, star2Target: 80, star3Target: 64, timeLimitSec: 98, hasObstacles: true, titleFa: '★ فینال بزرگ قهرمانان توربو', titleEn: '★ Turbo Road World Finals' },
];

export const TOTAL_LEVELS = BLUEPRINTS.length;

export const LEVELS: LevelConfig[] = BLUEPRINTS.map((bp, idx) => {
  const id = idx + 1;
  const difficulty: LevelConfig['difficulty'] =
    id <= 7 ? 'easy' : id <= 18 ? 'medium' : id <= 33 ? 'hard' : 'expert';
  const progress = idx / Math.max(1, BLUEPRINTS.length - 1);

  return {
    id,
    environment: bp.environment,
    difficulty,
    missionType: bp.missionType,
    target: bp.target,
    star2Target: bp.star2Target,
    star3Target: bp.star3Target,
    timeLimitSec: bp.timeLimitSec,
    trafficDensity: Number((0.78 + progress * 1.05).toFixed(2)),
    trafficSpeedFactor: Number((0.94 + progress * 0.48).toFixed(2)),
    hasObstacles: bp.hasObstacles,
    rewardCoins: Math.round((160 + id * 52) / 10) * 10,
    titleFa: bp.titleFa,
    titleEn: bp.titleEn,
    chapterStarter: bp.chapterStarter,
  };
});

export function getLevelById(id: number): LevelConfig | undefined {
  return LEVELS.find((lvl) => lvl.id === id);
}

export function isLevelUnlocked(level: LevelConfig, unlockedLevel: number): boolean {
  return Boolean(level.chapterStarter) || level.id <= unlockedLevel;
}
