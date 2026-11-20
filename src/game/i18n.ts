import type { Language, LevelMissionType, VehicleCategory, VehicleTier } from './types';

export const TRANSLATIONS = {
  fa: {
    gameTitle: 'جاده توربو',
    gameSubtitle: 'مسابقه سه‌بعدی واقع‌گرایانه',
    tapToStart: 'شروع بازی',
    loadingWorld: 'آماده‌سازی پیست مسابقه...',
    endlessMode: 'مسابقه بی‌پایان',
    levelMode: '۴۵ مرحله چالشی',
    garage: 'گاراژ ماشین‌ها',
    shop: 'فروشگاه',
    missions: 'مأموریت‌های روزانه',
    dailyRewards: 'پاداش روزانه',
    settings: 'تنظیمات',
    back: 'بازگشت',
    play: 'شروع مسابقه',
    selectMode: 'انتخاب حالت بازی',
    selectEnvironment: 'انتخاب محیط مسابقه',
    coins: 'سکه',
    bestScore: 'بهترین امتیاز',
    bestDistance: 'بیشترین مسافت',
    totalOvertakes: 'کل سبقت‌ها',
    speed: 'سرعت',
    accel: 'شتاب',
    nitro: 'قدرت نیترو',
    handling: 'فرمان‌پذیری',
    braking: 'قدرت ترمز',
    buy: 'خرید',
    select: 'انتخاب ماشین',
    selected: 'ماشین فعال',
    locked: 'قفل‌شده',
    upgrade: 'ارتقا',
    maxed: 'حداکثر',
    paintColor: 'رنگ بدنه',
    rotateHint: 'برای چرخاندن ماشین بکشید',
    notEnoughCoins: 'سکه کافی نیست!',
    premiumOnly: 'اختصاصی فروشگاه',
    freeCoinsAd: 'دریافت ۱۰۰ سکه رایگان (تبلیغ)',
    removeAds: 'حذف تبلیغات اجباری',
    adsRemovedBadge: 'تبلیغات اجباری حذف شده',
    restorePurchases: 'بازیابی خریدهای قبلی',
    bazaarSandboxNote: 'محیط آزمایشی وب: پرداخت واقعی در نسخه اندروید کافه‌بازار (Poolakey) فعال می‌شود.',
    level: 'مرحله',
    stars: 'ستاره',
    reward: 'جایزه',
    difficultyEasy: 'آسان',
    difficultyMedium: 'متوسط',
    difficultyHard: 'سخت',
    difficultyExpert: 'حرفه‌ای',
    paused: 'توقف بازی',
    resume: 'ادامه مسابقه',
    restart: 'شروع مجدد',
    mainMenu: 'منوی اصلی',
    gameOver: 'پایان مسابقه!',
    levelComplete: 'مرحله با موفقیت تمام شد!',
    levelFailed: 'مرحله ناتمام ماند!',
    newRecord: 'رکورد جدید!',
    scoreLabel: 'امتیاز نهایی',
    distanceLabel: 'مسافت طی‌شده',
    coinsEarnedLabel: 'سکه‌های جمع‌آوری‌شده',
    bonusRewardLabel: 'پاداش مأموریت',
    overtakesLabel: 'سبقت نزدیک',
    peakSpeedLabel: 'بیشترین سرعت',
    reviveAdBtn: 'احیا و ادامه (تماشای تبلیغ)',
    doubleCoinsAdBtn: 'دو برابر کردن سکه‌ها (تبلیغ)',
    coinsDoubled: 'سکه‌ها دو برابر شد!',
    nextLevel: 'مرحله بعدی',
    tryAgain: 'تلاش دوباره',
    claim: 'دریافت جایزه',
    claimed: 'دریافت شد',
    claimDoubleAd: 'دریافت ۲ برابر (تبلیغ)',
    day: 'روز',
    today: 'امروز',
    comeBackTomorrow: 'فردا برای جایزه بعدی برگردید!',
    allMissionsDone: 'همه مأموریت‌های امروز تکمیل شد!',
    languageLabel: 'زبان بازی',
    musicVolume: 'صدای موسیقی',
    sfxVolume: 'افکت‌های صوتی',
    steeringSensitivity: 'حساسیت فرمان',
    graphicsQuality: 'کیفیت گرافیک',
    qualityLow: 'پایین (گوشی‌های اقتصادی)',
    qualityMedium: 'متوسط (متعادل)',
    qualityHigh: 'بالا (۶۰ فریم کامل)',
    controlScheme: 'روش کنترل لمسی (اندروید)',
    controlButtons: 'دکمه‌های لمسی چپ و راست',
    controlWheel: 'فرمان لمسی واقعی',
    controlDrag: 'لغزنده / کشیدن انگشت',
    openDoors: 'باز کردن درها',
    closeDoors: 'بستن درها',
    cockpitCam: 'نمای داخل کابین (فرمان)',
    resetSave: 'پاک کردن پیشرفت',
    confirmReset: 'تأیید پاک کردن',
    unityExportTitle: 'معماری Unity 6.3 و کافه‌بازار',
    unityExportDesc: 'مشاهده شناسه محصولات بازار و چک‌لیست انتشار اندروید',
    close: 'بستن',
    adWatching: 'در حال پخش تبلیغ جایزه‌ای...',
    adComplete: 'پاداش تبلیغ با موفقیت ثبت شد!',
    interstitialTitle: 'تبلیغ بین مسابقه‌ای',
    skipIn: 'رد کردن در',
    skipAd: 'بستن تبلیغ',
    bannerLabel: 'فضای بنر تبلیغاتی (فقط در منوها — حذف با Remove Ads)',
    hudSpeedUnit: 'کیلومتر/ساعت',
    hudMeterUnit: 'متر',
    hudLeft: 'چپ',
    hudRight: 'راست',
    hudBrake: 'ترمز',
    hudNitro: 'نیترو',
    controlsHint: 'A/D یا جهت‌ها: فرمان · Space: نیترو · S: ترمز · C: تغییر دوربین · Esc: توقف',
    nearMissFeedback: 'سبقت نزدیک!',
    nitroFeedback: 'توربو نیترو!',
    checkpointFeedback: 'چک‌پوینت!',
    crashReason: 'برخورد شدید با ترافیک',
    timeoutReason: 'زمان مرحله به پایان رسید',
    hitReason: 'برخورد در چالش بدون تصادف',
    purchased: 'خریداری شده',
    purchaseSuccess: 'خرید با موفقیت انجام و ثبت شد!',
    restoreDone: 'خریدهای دائمی بررسی و بازیابی شدند.',
    owned: 'مالک هستید',
    cat_city: 'شهری',
    cat_sport: 'اسپرت',
    cat_racing: 'مسابقه‌ای',
    cat_offroad: 'آفرود',
    cat_muscle: 'عضلانی',
    cat_hyper: 'ابرخودرو',
    cat_special: 'کمیاب و ویژه',
    tier_common: 'استاندارد',
    tier_rare: 'کمیاب',
    tier_epic: 'حماسی',
    tier_legendary: 'افسانه‌ای',
    tier_mythic: 'اسطوره‌ای',
    mission_coins: 'جمع‌آوری سکه',
    mission_distance: 'رسیدن به خط پایان',
    mission_survive: 'رانندگی بدون تصادف',
    mission_overtakes: 'سبقت از ماشین‌ها',
    mission_checkpoints: 'عبور از چک‌پوینت‌ها',
    mission_topSpeed: 'رسیدن به سرعت هدف',
    mission_nitroDistance: 'مسافت با نیترو',
    mission_noHit: 'مسابقه کاملاً بدون برخورد',
    mission_rivals: 'شکست دادن رقبای مسابقه‌ای',
  },
  en: {
    gameTitle: 'TURBO ROAD',
    gameSubtitle: 'Realistic 3D Highway Racing',
    tapToStart: 'START RACING',
    loadingWorld: 'Preparing 3D Highway...',
    endlessMode: 'Endless Mode',
    levelMode: '45 Levels',
    garage: 'Garage',
    shop: 'Shop',
    missions: 'Daily Missions',
    dailyRewards: 'Daily Rewards',
    settings: 'Settings',
    back: 'Back',
    play: 'Race Now',
    selectMode: 'Select Game Mode',
    selectEnvironment: 'Choose Environment',
    coins: 'Coins',
    bestScore: 'Best Score',
    bestDistance: 'Best Distance',
    totalOvertakes: 'Overtakes',
    speed: 'Top Speed',
    accel: 'Acceleration',
    nitro: 'Nitro Power',
    handling: 'Handling',
    braking: 'Braking',
    buy: 'Buy',
    select: 'Equip Car',
    selected: 'Equipped',
    locked: 'Locked',
    upgrade: 'Upgrade',
    maxed: 'MAX',
    paintColor: 'Body Paint',
    rotateHint: 'Drag to spin vehicle 360°',
    notEnoughCoins: 'Not enough coins!',
    premiumOnly: 'Shop Exclusive',
    freeCoinsAd: 'Get 100 Free Coins (Ad)',
    removeAds: 'Remove Forced Ads',
    adsRemovedBadge: 'Forced Ads Removed',
    restorePurchases: 'Restore Purchases',
    bazaarSandboxNote: 'Web Sandbox Mode: Live billing connects via Cafe Bazaar Poolakey SDK on Android builds.',
    level: 'Level',
    stars: 'Stars',
    reward: 'Reward',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Medium',
    difficultyHard: 'Hard',
    difficultyExpert: 'Expert',
    paused: 'Paused',
    resume: 'Resume Race',
    restart: 'Restart',
    mainMenu: 'Main Menu',
    gameOver: 'Race Over!',
    levelComplete: 'Level Complete!',
    levelFailed: 'Level Failed!',
    newRecord: 'NEW RECORD!',
    scoreLabel: 'Final Score',
    distanceLabel: 'Distance',
    coinsEarnedLabel: 'Coins Collected',
    bonusRewardLabel: 'Mission Bonus',
    overtakesLabel: 'Near Overtakes',
    peakSpeedLabel: 'Peak Speed',
    reviveAdBtn: 'Revive & Continue (Watch Ad)',
    doubleCoinsAdBtn: 'Double Coins (Watch Ad)',
    coinsDoubled: 'Coins Doubled!',
    nextLevel: 'Next Level',
    tryAgain: 'Try Again',
    claim: 'Claim',
    claimed: 'Claimed',
    claimDoubleAd: 'Claim 2x (Watch Ad)',
    day: 'Day',
    today: 'Today',
    comeBackTomorrow: 'Come back tomorrow for the next streak reward!',
    allMissionsDone: 'All daily missions completed!',
    languageLabel: 'Language',
    musicVolume: 'Music Volume',
    sfxVolume: 'SFX Volume',
    steeringSensitivity: 'Steering Sensitivity',
    graphicsQuality: 'Graphics Quality',
    qualityLow: 'Low (Budget Mobile)',
    qualityMedium: 'Medium (Balanced)',
    qualityHigh: 'High (60 FPS)',
    controlScheme: 'Android Touch Controls',
    controlButtons: 'Left / Right Buttons',
    controlWheel: 'Touch Steering Wheel',
    controlDrag: 'Thumb Drag Slider',
    openDoors: 'Open Doors',
    closeDoors: 'Close Doors',
    cockpitCam: 'Cockpit Interior Cam',
    resetSave: 'Reset Progress',
    confirmReset: 'Confirm Reset',
    unityExportTitle: 'Unity 6.3 & Cafe Bazaar Guide',
    unityExportDesc: 'View Cafe Bazaar SKUs, Poolakey bridge & release checklist',
    close: 'Close',
    adWatching: 'Playing Rewarded Ad...',
    adComplete: 'Ad reward verified & granted!',
    interstitialTitle: 'Interstitial Ad Slot',
    skipIn: 'Skip in',
    skipAd: 'Close Ad',
    bannerLabel: 'Menu Banner Ad Slot (Hidden during gameplay · Removed by Remove Ads)',
    hudSpeedUnit: 'KM/H',
    hudMeterUnit: 'm',
    hudLeft: 'LEFT',
    hudRight: 'RIGHT',
    hudBrake: 'BRAKE',
    hudNitro: 'NITRO',
    controlsHint: 'A/D or Arrows: Steer · Space: Nitro · S: Brake · C: Camera · Esc: Pause',
    nearMissFeedback: 'NEAR MISS!',
    nitroFeedback: 'TURBO NITRO!',
    checkpointFeedback: 'CHECKPOINT!',
    crashReason: 'Heavy Traffic Collision',
    timeoutReason: 'Time Expired',
    hitReason: 'No-Hit Challenge Broken',
    purchased: 'Purchased',
    purchaseSuccess: 'Purchase verified & unlocked!',
    restoreDone: 'Permanent entitlements verified & restored.',
    owned: 'Owned',
    cat_city: 'City',
    cat_sport: 'Sport',
    cat_racing: 'Racing',
    cat_offroad: 'Off-Road',
    cat_muscle: 'Muscle',
    cat_hyper: 'Hypercar',
    cat_special: 'Rare Special',
    tier_common: 'Standard',
    tier_rare: 'Rare',
    tier_epic: 'Epic',
    tier_legendary: 'Legendary',
    tier_mythic: 'Mythic',
    mission_coins: 'Collect Coins',
    mission_distance: 'Reach Finish Line',
    mission_survive: 'Survive Without Crash',
    mission_overtakes: 'Overtake Cars',
    mission_checkpoints: 'Pass Checkpoints',
    mission_topSpeed: 'Hit Target Speed',
    mission_nitroDistance: 'Nitro Distance',
    mission_noHit: 'Flawless Clean Run',
    mission_rivals: 'Defeat Rival Racers',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function t(lang: Language, key: TranslationKey): string {
  return TRANSLATIONS[lang][key];
}

export function formatNumber(n: number, lang: Language): string {
  const rounded = Math.floor(n);
  if (lang === 'fa') {
    return rounded.toLocaleString('fa-IR');
  }
  return rounded.toLocaleString('en-US');
}

export function getCategoryLabel(lang: Language, category: VehicleCategory): string {
  return t(lang, `cat_${category}` as TranslationKey);
}

export function getTierLabel(lang: Language, tier: VehicleTier): string {
  return t(lang, `tier_${tier}` as TranslationKey);
}

export function getMissionTypeLabel(lang: Language, type: LevelMissionType): string {
  return t(lang, `mission_${type}` as TranslationKey);
}

export function formatMissionGoal(
  lang: Language,
  type: LevelMissionType,
  target: number
): string {
  const num = formatNumber(target, lang);
  if (lang === 'fa') {
    switch (type) {
      case 'coins':
        return `جمع‌آوری ${num} سکه`;
      case 'distance':
        return `طی کردن ${num} متر تا خط پایان`;
      case 'survive':
        return `${num} ثانیه رانندگی بدون تصادف`;
      case 'overtakes':
        return `سبقت از ${num} ماشین`;
      case 'checkpoints':
        return `عبور از ${num} چک‌پوینت`;
      case 'topSpeed':
        return `رسیدن به سرعت ${num} کیلومتر/ساعت`;
      case 'nitroDistance':
        return `${num} متر رانندگی با نیترو`;
      case 'noHit':
        return `${num} متر بدون کوچک‌ترین برخورد`;
      case 'rivals':
        return `شکست دادن ${num} رقیب مسابقه‌ای`;
    }
  } else {
    switch (type) {
      case 'coins':
        return `Collect ${num} Coins`;
      case 'distance':
        return `Reach ${num}m Finish Line`;
      case 'survive':
        return `Survive ${num}s Without Crashing`;
      case 'overtakes':
        return `Overtake ${num} Cars`;
      case 'checkpoints':
        return `Pass ${num} Checkpoints`;
      case 'topSpeed':
        return `Reach ${num} KM/H Top Speed`;
      case 'nitroDistance':
        return `Drive ${num}m Using Nitro`;
      case 'noHit':
        return `Drive ${num}m With Zero Hits`;
      case 'rivals':
        return `Defeat ${num} Rival Racers`;
    }
  }
}
