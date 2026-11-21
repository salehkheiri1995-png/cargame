export type Language = 'fa' | 'en';

export type ScreenId =
  | 'splash'
  | 'menu'
  | 'modeSelect'
  | 'garage'
  | 'levels'
  | 'playing'
  | 'shop'
  | 'missions'
  | 'dailyRewards'
  | 'settings';

export type GameMode = 'endless' | 'level';

export type EnvironmentId =
  | 'city'
  | 'coastal'
  | 'desert'
  | 'forest'
  | 'snow'
  | 'nightCity'
  | 'sunsetCanyon';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'auto';

export type ControlScheme = 'buttons' | 'wheel' | 'drag';

export type VehicleCategory =
  | 'city'
  | 'sport'
  | 'racing'
  | 'offroad'
  | 'muscle'
  | 'hyper'
  | 'special';

export type VehicleTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type CarArchetype =
  | 'hatch'
  | 'sedan'
  | 'coupe'
  | 'jdm'
  | 'roadster'
  | 'muscle'
  | 'modernMuscle'
  | 'suv'
  | 'offroad'
  | 'pickup'
  | 'monster'
  | 'rally'
  | 'buggy'
  | 'gt'
  | 'formula'
  | 'prototype'
  | 'hyper'
  | 'crown';

export type CarLiveryStyle =
  | 'clean'
  | 'singleStripe'
  | 'twinStripe'
  | 'sideFlash'
  | 'twoToneRoof'
  | 'checker'
  | 'cyberGlow'
  | 'police';

export type CarSpoilerStyle =
  | 'none'
  | 'lip'
  | 'ducktail'
  | 'rally'
  | 'gt'
  | 'swanNeck'
  | 'twinFin'
  | 'formula'
  | 'crown';

export type CarRimStyle = 'twin5' | 'mesh' | 'deepDish' | 'turbofan' | 'blade' | 'offroad';
export type CarRimColor = 'silver' | 'black' | 'gold' | 'bronze' | 'chrome' | 'neon';
export type CarPaintFinish = 'gloss' | 'matte' | 'chrome' | 'iridescent';
export type CarRoofAccessory = 'none' | 'scoop' | 'lightbar' | 'siren' | 'rack' | 'dorsalFin';
export type CarHeadlightTint = 'white' | 'iceBlue' | 'amber' | 'laserViolet' | 'gold';

export interface CarVisualStyle {
  livery: CarLiveryStyle;
  spoiler: CarSpoilerStyle;
  rimStyle: CarRimStyle;
  rimColor: CarRimColor;
  finish: CarPaintFinish;
  underglowHex?: string;
  roofAccessory?: CarRoofAccessory;
  hoodVent?: boolean;
  canards?: boolean;
  headlightTint?: CarHeadlightTint;
}

export interface VehicleStats {
  speed: number;    // 1 - 100
  accel: number;    // 1 - 100
  nitro: number;    // 1 - 100
  handling: number; // 1 - 100
  braking: number;  // 1 - 100
}

export interface VehicleUpgradeLevels {
  speed: number;    // 0 - 5
  accel: number;    // 0 - 5
  nitro: number;    // 0 - 5
  handling: number; // 0 - 5
  braking: number;  // 0 - 5
}

export interface VehicleConfig {
  id: string;
  nameFa: string;
  nameEn: string;
  category: VehicleCategory;
  tier: VehicleTier;
  archetype: CarArchetype;
  price: number;
  isPremiumExclusive?: boolean;
  defaultColor: string;
  accentColor: string;
  visual: CarVisualStyle;
  baseStats: VehicleStats;
  descriptionFa: string;
  descriptionEn: string;
}

export interface EnvironmentConfig {
  id: EnvironmentId;
  nameFa: string;
  nameEn: string;
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  roadColor: string;
  curbPrimary: string;
  curbSecondary: string;
  shoulderColor: string;
  terrainColor: string;
  accentColor: string;
  badgeGradient: string;
  isNight?: boolean;
  isWet?: boolean;
  rainEnabled?: boolean;
  isNew?: boolean;
}

export type LevelMissionType =
  | 'coins'
  | 'distance'
  | 'survive'
  | 'overtakes'
  | 'checkpoints'
  | 'topSpeed'
  | 'nitroDistance'
  | 'noHit'
  | 'rivals';

export interface LevelConfig {
  id: number;
  environment: EnvironmentId;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  missionType: LevelMissionType;
  target: number;          // Primary 1-star target
  star2Target: number;     // 2-star threshold
  star3Target: number;     // 3-star threshold
  timeLimitSec?: number;   // Optional time limit
  trafficDensity: number;  // 0.6 - 1.95
  trafficSpeedFactor: number;
  hasObstacles: boolean;
  rewardCoins: number;
  titleFa: string;
  titleEn: string;
  chapterStarter?: boolean; // Allows players to jump right into new expansion chapters!
}

export interface DailyMissionConfig {
  id: string;
  type: 'distance' | 'coins' | 'overtakes' | 'nitroUses' | 'racesCompleted' | 'levelsWon';
  target: number;
  rewardCoins: number;
  titleFa: string;
  titleEn: string;
}

export interface DailyRewardConfig {
  day: number;
  coins: number;
  bonusLabelFa?: string;
  bonusLabelEn?: string;
}

export type ShopProductSku =
  | 'coins_500'
  | 'coins_1500'
  | 'coins_5000'
  | 'starter_pack'
  | 'premium_car'
  | 'remove_ads';

export interface ShopProduct {
  sku: ShopProductSku;
  titleFa: string;
  titleEn: string;
  descFa: string;
  descEn: string;
  priceToman: string;
  priceUsd: string;
  consumable: boolean;
  coinsGrant?: number;
  carGrantId?: string;
  removesAds?: boolean;
  accent: string;
  featured?: boolean;
}

export interface GameSettings {
  language: Language;
  musicVolume: number;         // 0 - 1
  sfxVolume: number;           // 0 - 1
  steeringSensitivity: number; // 0.5 - 1.5
  steeringDeadZone: number;    // 0 - 0.2
  graphicsQuality: GraphicsQuality;
  controlScheme: ControlScheme;
  shakeIntensity: number;      // 0 - 1.5
  chromaticAberration: boolean;
  filmGrain: boolean;
  speedLines: boolean;
  bloomEnabled: boolean;
  reduceMotion: boolean;
  leftHanded: boolean;
  controlScale: number;        // 0.8 - 1.25
  controlOpacity: number;      // 0.4 - 1
  tutorialSeen: boolean;
}

export interface DebugStats {
  fps: number;
  frameTimeMs: number;
  frameTimeJitterMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  pixelRatio: number;
  qualitySetting: GraphicsQuality;
  effectiveQuality: 'low' | 'medium' | 'high';
  autoRenderScale: number;
  activeTraffic: number;
  activeCoins: number;
  activeParticles: number;
}

export interface DailyMissionProgress {
  dateKey: string;
  values: Record<string, number>;
  claimed: Record<string, boolean>;
}

export interface SaveData {
  version: number;
  coins: number;
  ownedCars: string[];
  selectedCarId: string;
  carColors: Record<string, string>;
  carUpgrades: Record<string, VehicleUpgradeLevels>;
  endlessBestScore: number;
  endlessBestDistance: number;
  totalOvertakes: number;
  totalRaces: number;
  unlockedLevel: number;
  levelStars: Record<number, number>; // levelId -> 1 | 2 | 3
  dailyMissions: DailyMissionProgress;
  dailyRewardStreak: number;          // 0 - 7
  lastDailyRewardDate: string | null; // YYYY-MM-DD
  removeAdsOwned: boolean;
  starterPackOwned: boolean;
  premiumCarOwned: boolean;
  processedTransactions: string[];
  /** Bounded ledger of race IDs whose base result has already been banked. */
  settledRaceIds: string[];
  /** Bounded ledger of race IDs whose one-time "double coins" bonus was granted. */
  doubleBonusRaceIds: string[];
  lastSavedAt: number;
  settings: GameSettings;
  checksum: string;
}

export interface ActiveRaceConfig {
  mode: GameMode;
  environment: EnvironmentId;
  levelConfig?: LevelConfig;
  carId: string;
  carColor: string;
  stats: VehicleStats;
  steeringSensitivity: number;
  graphicsQuality: GraphicsQuality;
}

export interface RaceHudSnapshot {
  speedKmh: number;
  maxSpeedKmh: number;
  distanceM: number;
  coinsCollected: number;
  score: number;
  overtakes: number;
  combo: number;
  nitro: number; // 0 - 100
  nitroActive: boolean;
  timeElapsed: number;
  timeRemaining: number | null;
  checkpointsPassed: number;
  nitroDistanceM: number;
  peakSpeedKmh: number;
  hitsTaken: number;
  missionProgress: number; // 0 - 1
  missionCurrent: number;
  missionTarget: number;
  feedbackText: string | null;
  feedbackColor: string;
  feedbackId: number;
  shieldActive: boolean;
  drafting: boolean;
  feverActive: boolean;
  rivalAheadDist: number | null;
  rivalsDefeated: number;
  cameraMode: 'chase' | 'low' | 'hood' | 'cockpit';
  /** Seconds remaining on the pre-race countdown; 0 means racing is active. */
  countdown: number;
}

export interface RaceResult {
  mode: GameMode;
  environment: EnvironmentId;
  levelId?: number;
  won: boolean;
  starsEarned: number;
  score: number;
  distanceM: number;
  coinsCollected: number;
  missionBonusCoins: number;
  overtakes: number;
  rivalsDefeated?: number;
  nitroUses: number;
  peakSpeedKmh: number;
  timeElapsed: number;
  isNewBestScore: boolean;
  isNewBestDistance: boolean;
  canRevive: boolean;
  failReason?: 'crash' | 'timeout' | 'hit';
}
