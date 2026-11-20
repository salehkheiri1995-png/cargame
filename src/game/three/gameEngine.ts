import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ENVIRONMENT_MAP } from '../data/environments';
import { VEHICLE_MAP } from '../data/vehicles';
import { audioEngine } from '../services/audioEngine';
import type {
  ActiveRaceConfig,
  EnvironmentId,
  GraphicsQuality,
  Language,
  RaceHudSnapshot,
  RaceResult,
} from '../types';
import {
  buildCartoonCar,
  buildTrafficVehicle,
  type BuiltCarRig,
  type TrafficKind,
  type TrafficRig,
} from './carBuilder';
import { CinematicPostProcessor } from './postProcessing';
import {
  createBoostPadTexture,
  createCarbonTexture,
  createContactShadowTexture,
  createTireTreadTexture,
} from './textures';
import {
  applyWorldCurvature,
  buildWorldEnvironment,
  getCurveOffsetX,
  getHillOffsetY,
  LANE_CENTERS,
  ROAD_LENGTH,
  ROAD_WIDTH,
  type WorldRig,
} from './worldBuilder';

type EngineViewMode = 'showcase' | 'garage' | 'racing';
export type CameraViewMode = 'chase' | 'low' | 'hood' | 'cockpit';

interface PooledTraffic {
  rig: TrafficRig;
  active: boolean;
  isRival: boolean;
  lane: number;
  targetLane: number;
  baseSpeed: number;
  speed: number;
  localX: number;
  localZ: number;
  passedByPlayer: boolean;
  laneChangeTimer: number;
  changingLane: boolean;
  braking: boolean;
  aiCooldown: number;
}

interface PooledCoin {
  mesh: THREE.Mesh;
  active: boolean;
  laneX: number;
  z: number;
  phase: number;
}

interface PooledNitroItem {
  group: THREE.Group;
  active: boolean;
  x: number;
  z: number;
}

interface PooledBoostPad {
  mesh: THREE.Mesh;
  active: boolean;
  x: number;
  z: number;
  triggered: boolean;
}

interface PooledObstacle {
  group: THREE.Group;
  active: boolean;
  x: number;
  z: number;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface GameEngineCallbacks {
  onHudUpdate: (snapshot: RaceHudSnapshot) => void;
  onRaceEnd: (result: RaceResult) => void;
}

// Module-scope reusable helpers (zero GC inside animation loop)
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _colorTmp = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class TurboRoadEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private postProcessor: CinematicPostProcessor;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private garageSoftboxes: THREE.RectAreaLight[] = [];
  private shadowTexture: THREE.CanvasTexture;
  private tireTreadTexture: THREE.CanvasTexture;
  private carbonTexture: THREE.CanvasTexture;
  private boostPadTexture: THREE.CanvasTexture;
  private maxAnisotropy: number;
  private isSoftwareGl: boolean;
  private graphicsQuality: GraphicsQuality = 'high';

  private worldRig: WorldRig | null = null;
  private currentEnvId: EnvironmentId = 'city';
  private playerCar: BuiltCarRig | null = null;
  private currentCarId = '';
  private currentCarColor = '#0f4c81';
  private garageTurntable: THREE.Group;

  // Object pools
  private trafficPool: PooledTraffic[] = [];
  private coinPool: PooledCoin[] = [];
  private nitroPool: PooledNitroItem[] = [];
  private boostPadPool: PooledBoostPad[] = [];
  private obstaclePool: PooledObstacle[] = [];
  private particlePool: PooledParticle[] = [];

  // Mode & loop state
  private viewMode: EngineViewMode = 'showcase';
  private cameraMode: CameraViewMode = 'chase';
  private raceConfig: ActiveRaceConfig | null = null;
  private lang: Language = 'fa';
  private paused = false;
  private raceFinished = false;
  private destroyed = false;
  private frameId = 0;
  private lastTimestamp = 0;
  private elapsedTotal = 0;

  // Showcase / Garage turntable rotation & adaptive full-car framing
  private showcaseAngle = 0.62;
  private targetShowcaseAngle = 0.62;
  private isDraggingTurntable = false;
  private lastPointerX = 0;
  private garageDockOpen = true;
  private garageViewOffsetNorm = 0;
  private showcaseCarRadius = 2.55;
  private showcaseCarCenterY = 0.84;
  private showcaseCarHeight = 1.55;
  private doorsOpen = false;
  private doorOpenProgress = 0;

  // Dynamic curving & undulating road state
  private curveStrength = 0;
  private targetCurveStrength = 0;
  private hillStrength = 0;
  private targetHillStrength = 0;
  private curveTimer = 4.5;

  // Live Race Simulation State
  private playerX = 0;
  private playerLateralVel = 0;
  private playerSpeed = 0;
  private baseMaxSpeed = 48;
  private nitroMaxSpeed = 68;
  private accelRate = 18;
  private handlingRate = 12;
  private brakingRate = 34;
  private nitroDrainRate = 24;
  private nitroChargeRate = 6.5;

  private distanceM = 0;
  private nitroDistanceM = 0;
  private coinsCollected = 0;
  private score = 0;
  private overtakes = 0;
  private rivalsDefeated = 0;
  private combo = 1;
  private comboTimer = 0;
  private nitro = 60;
  private nitroActive = false;
  private wasNitroActive = false;
  private nitroUses = 0;
  private padBoostTimer = 0;
  private drafting = false;
  private rivalAheadDist: number | null = null;
  private nextRivalDist = 240;
  private raceTime = 0;
  private peakSpeedKmh = 0;
  private checkpointsPassed = 0;
  private nextCheckpointDist = 200;
  private checkpointArchZ = -180;
  private checkpointArchActive = false;
  private hitsTaken = 0;
  private reviveUsed = false;
  private shieldTimer = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private impactPostPulse = 0;
  private crashFreezeTimer = 0;
  private pendingCrashResult: RaceResult | null = null;

  // Spawners
  private trafficSpawnTimer = 0;
  private coinSpawnTimer = 0;
  private nitroSpawnTimer = 4.5;
  private boostPadSpawnTimer = 5.5;
  private obstacleSpawnTimer = 3.0;
  private hudEmitTimer = 0;

  // Feedback banner
  private feedbackText: string | null = null;
  private feedbackColor = '#facc15';
  private feedbackTimer = 0;
  private feedbackId = 0;

  // Input State
  private input = {
    left: false,
    right: false,
    brake: false,
    nitro: false,
    touchSteerAxis: 0,
  };

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const initW = container.clientWidth || window.innerWidth;
    const initH = Math.max(1, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(initW, initH);

    container.appendChild(this.renderer.domElement);
    this.maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();

    // Studio environment reflection via RoomEnvironment (all devices!)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(60, initW / initH, 0.2, 360);

    // 3-point realistic photographic lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.92);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5dc, 2.1);
    this.sunLight.position.set(24, 42, 20);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 24;
    this.sunLight.shadow.camera.bottom = -24;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    this.rimLight.position.set(-20, 14, -24);
    this.scene.add(this.rimLight);

    // Showroom studio softboxes (GPU only; skipped cleanly on software GL!)
    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const topStrip = new THREE.RectAreaLight(0xffffff, 3.6, 8, 2.2);
      topStrip.position.set(0, 5.2, 0);
      topStrip.lookAt(0, 0, 0);
      topStrip.visible = false;
      this.scene.add(topStrip);

      const sideStrip = new THREE.RectAreaLight(0x7dd3fc, 2.4, 6, 1.8);
      sideStrip.position.set(4.5, 2.2, 2.5);
      sideStrip.lookAt(0, 0.8, 0);
      sideStrip.visible = false;
      this.scene.add(sideStrip);
      this.garageSoftboxes.push(topStrip, sideStrip);
    }

    // Full HDR Post-Processing Stack: ACES Filmic Tonemapping + Linear UnrealBloom + Cinematic Color Grading
    this.postProcessor = new CinematicPostProcessor(
      this.renderer,
      this.scene,
      this.camera,
      initW,
      initH,
      this.isSoftwareGl
    );

    this.shadowTexture = createContactShadowTexture();
    this.tireTreadTexture = createTireTreadTexture(this.maxAnisotropy);
    this.carbonTexture = createCarbonTexture(this.maxAnisotropy);
    this.boostPadTexture = createBoostPadTexture(this.maxAnisotropy);

    // Garage luxury turntable podium
    this.garageTurntable = this.createGarageTurntable();
    this.garageTurntable.visible = false;
    this.scene.add(this.garageTurntable);

    // Build initial world & pools
    this.setEnvironment('city');
    this.initObjectPools();
    this.setShowcaseCar('spark_hatch', VEHICLE_MAP.spark_hatch.defaultColor);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.lastTimestamp = performance.now();
    this.tick(this.lastTimestamp);
  }

  private createGarageTurntable(): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 4.1, 0.36, 44),
      new THREE.MeshPhysicalMaterial({
        color: 0x0b101b,
        roughness: 0.1,
        metalness: 0.78,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      })
    );
    base.position.y = -0.18;
    base.receiveShadow = true;
    g.add(base);

    const innerDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(3.15, 3.15, 0.04, 40),
      new THREE.MeshStandardMaterial({ color: 0x161d2b, roughness: 0.18, metalness: 0.85 })
    );
    innerDisk.position.y = 0.005;
    innerDisk.receiveShadow = true;
    g.add(innerDisk);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.55, 0.08, 12, 52),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 2.2,
        roughness: 0.12,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.65, 0.035, 10, 44),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.5,
      })
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.025;
    g.add(innerRing);

    // Overhead floating luxury showroom light halo
    const overheadHalo = new THREE.Mesh(
      new THREE.TorusGeometry(3.85, 0.055, 10, 56),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xe0f2fe,
        emissiveIntensity: 2.1,
        roughness: 0.1,
      })
    );
    overheadHalo.rotation.x = Math.PI / 2;
    overheadHalo.position.y = 3.85;
    g.add(overheadHalo);

    // Four low-profile carbon floor spotlights around the podium rim
    const bollardMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.25,
    });
    const bollardGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.0,
    });
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const bx = Math.cos(ang) * 4.02;
      const bz = Math.sin(ang) * 4.02;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.42, 10), bollardMat);
      post.position.set(bx, 0.06, bz);
      g.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10), bollardGlowMat);
      cap.position.set(bx, 0.28, bz);
      g.add(cap);
    }

    return g;
  }

  private initObjectPools(): void {
    // 1. Traffic Pool (14 smart vehicles + 2 Rival GT Racers)
    const kinds: TrafficKind[] = ['sedan', 'sedan', 'van', 'sedan', 'truck', 'sedan', 'bus'];
    for (let i = 0; i < 16; i++) {
      const isRival = i >= 14;
      const kind: TrafficKind = isRival ? 'rival' : kinds[i % kinds.length];
      const rig = buildTrafficVehicle(kind, i, this.shadowTexture);
      rig.root.visible = false;
      this.scene.add(rig.root);
      this.trafficPool.push({
        rig,
        active: false,
        isRival,
        lane: 0,
        targetLane: 0,
        baseSpeed: 20,
        speed: 20,
        localX: 0,
        localZ: -200,
        passedByPlayer: false,
        laneChangeTimer: 0,
        changingLane: false,
        braking: false,
        aiCooldown: 0,
      });
    }

    // 2. Spinning Gold Coins Pool
    const coinGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.16, 20);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      metalness: 0.88,
      roughness: 0.14,
      clearcoat: 1.0,
    });
    for (let i = 0; i < 36; i++) {
      const mesh = new THREE.Mesh(coinGeo, coinMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.coinPool.push({ mesh, active: false, laneX: 0, z: 0, phase: i * 0.4 });
    }

    // 3. Nitro Boost Canisters Pool
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      metalness: 0.45,
      roughness: 0.12,
      clearcoat: 1,
    });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.2 });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.05, 16), bottleMat);
      body.position.y = 0.85;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.28, 12), capMat);
      cap.position.y = 1.5;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.06, 10, 24),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      g.add(body, cap, ring);
      g.visible = false;
      this.scene.add(g);
      this.nitroPool.push({ group: g, active: false, x: 0, z: 0 });
    }

    // 4. Highway Turbo Boost Pads Pool
    const padGeo = new THREE.PlaneGeometry(2.75, 9.2);
    padGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshBasicMaterial({
      map: this.boostPadTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(padGeo, padMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.boostPadPool.push({ mesh, active: false, x: 0, z: -200, triggered: false });
    }

    // 5. Roadwork Obstacles Pool
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.42 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.68 });
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 0.35), barrierMat);
      bar.position.y = 0.82;
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.57, 0.38), stripeMat);
      mid.position.y = 0.82;
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.45), legMat);
      legL.position.set(-0.9, 0.45, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.45), legMat);
      legR.position.set(0.9, 0.45, 0);
      g.add(bar, mid, legL, legR);
      g.visible = false;
      this.scene.add(g);
      this.obstaclePool.push({ group: g, active: false, x: 0, z: 0 });
    }

    // 6. Pooled Particles (sparks, tire smoke, slipstream wind)
    const pGeo = new THREE.SphereGeometry(0.14, 8, 6);
    for (let i = 0; i < 72; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        gravity: 16,
      });
    }
  }

  public setLanguage(lang: Language): void {
    this.lang = lang;
  }

  public cycleCameraMode(): void {
    const order: CameraViewMode[] = ['chase', 'low', 'hood', 'cockpit'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    const labels: Record<CameraViewMode, { fa: string; en: string }> = {
      chase: { fa: 'دوربین استاندارد', en: 'CHASE CAM' },
      low: { fa: 'دوربین اکشن نزدیک', en: 'ACTION LOW CAM' },
      hood: { fa: 'دوربین کاپوت', en: 'HOOD CAM' },
      cockpit: { fa: 'دوربین داخل کابین (فرمان)', en: 'COCKPIT INTERIOR CAM' },
    };
    this.triggerFeedback(labels[this.cameraMode][this.lang], '#38bdf8');
    this.emitHud();
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphicsQuality = quality;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      return;
    }
    if (quality === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
    }
    this.postProcessor.setQuality(quality);
  }

  private syncCarHeadlightBeams(): void {
    if (!this.playerCar) return;
    const env = ENVIRONMENT_MAP[this.currentEnvId];
    const showBeams = Boolean(env.isNight || env.id === 'sunsetCanyon');
    this.playerCar.headlightBeams.forEach((b) => {
      b.visible = showBeams && this.viewMode !== 'garage';
    });
  }

  public setEnvironment(envId: EnvironmentId): void {
    if (this.worldRig && this.currentEnvId === envId) return;
    this.currentEnvId = envId;
    const env = ENVIRONMENT_MAP[envId];

    if (this.worldRig) {
      this.scene.remove(this.worldRig.group);
      this.worldRig.disposables.forEach((d) => d.dispose());
      this.worldRig = null;
    }

    this.scene.background = new THREE.Color(env.skyBottom);
    this.scene.fog = new THREE.Fog(env.fogColor, env.fogNear, env.fogFar);
    this.sunLight.color.set(env.sunColor);
    this.sunLight.intensity = env.sunIntensity;
    this.hemiLight.color.set(env.hemiSky);
    this.hemiLight.groundColor.set(env.hemiGround);
    this.hemiLight.intensity = env.isNight ? 0.58 : 0.92;
    this.rimLight.color.set(env.isNight ? 0xec4899 : env.id === 'sunsetCanyon' ? 0xfb923c : 0x38bdf8);
    this.rimLight.intensity = env.isNight ? 1.1 : 0.65;

    // Sync cinematic exposure, bloom & color grading profile for the selected world
    this.postProcessor.setEnvironment(envId, !this.worldRig);

    this.worldRig = buildWorldEnvironment(env, this.maxAnisotropy);
    this.scene.add(this.worldRig.group);
    this.syncCarHeadlightBeams();
  }

  public setShowcaseCar(carId: string, paintHex: string): void {
    const cfg = VEHICLE_MAP[carId] ?? VEHICLE_MAP.spark_hatch;
    if (this.playerCar && this.currentCarId === cfg.id) {
      this.currentCarColor = paintHex;
      this.playerCar.paintMaterials.forEach((m) => m.color.set(paintHex));
      return;
    }

    if (this.playerCar) {
      this.scene.remove(this.playerCar.root);
      this.playerCar = null;
    }

    this.currentCarId = cfg.id;
    this.currentCarColor = paintHex;
    this.playerCar = buildCartoonCar(
      cfg.archetype,
      paintHex,
      cfg.accentColor,
      this.shadowTexture,
      !this.isSoftwareGl,
      this.tireTreadTexture,
      this.carbonTexture,
      cfg.visual
    );
    this.playerCar.root.position.set(0, 0, 0);
    this.playerCar.root.rotation.y = this.viewMode === 'garage' ? this.showcaseAngle : 0;
    this.playerCar.shieldMesh.visible = false;
    this.playerCar.nitroFlames.forEach((f) => (f.visible = false));
    this.scene.add(this.playerCar.root);
    this.syncCarHeadlightBeams();

    // Measure true visible bounds of the vehicle (excluding beams, shield, flames) for guaranteed full-car framing
    this.playerCar.root.updateMatrixWorld(true);
    const carBox = new THREE.Box3();
    const excludeSet = new Set<THREE.Object3D>([
      this.playerCar.shieldMesh,
      ...this.playerCar.headlightBeams,
      ...this.playerCar.nitroFlames,
    ]);
    this.playerCar.bodyGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.visible && !excludeSet.has(obj)) {
        carBox.expandByObject(obj);
      }
    });
    for (const w of this.playerCar.wheels) {
      carBox.expandByObject(w);
    }
    if (!carBox.isEmpty()) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      carBox.getSize(size);
      carBox.getCenter(center);
      this.showcaseCarRadius = THREE.MathUtils.clamp(
        Math.hypot(size.x, size.z) * 0.52,
        2.15,
        3.45
      );
      this.showcaseCarHeight = THREE.MathUtils.clamp(size.y, 1.15, 2.75);
      this.showcaseCarCenterY = THREE.MathUtils.clamp(center.y, 0.62, 1.45);
    }
  }

  public setGarageDockOpen(open: boolean): void {
    this.garageDockOpen = open;
  }

  public setDoorsOpen(open: boolean): void {
    if (this.doorsOpen === open) return;
    this.doorsOpen = open;
    audioEngine.playDoorToggle(open);
  }

  public getDoorsOpen(): boolean {
    return this.doorsOpen;
  }

  public setViewMode(mode: EngineViewMode): void {
    const prevMode = this.viewMode;
    this.viewMode = mode;
    this.garageSoftboxes.forEach((l) => (l.visible = mode === 'garage'));
    if (mode !== 'garage') {
      this.doorsOpen = false;
    }
    if (mode === 'garage' && prevMode !== 'garage') {
      this.showcaseAngle = 0.62;
      this.targetShowcaseAngle = 0.62;
    }
    if (mode === 'racing') {
      this.garageViewOffsetNorm = 0;
      this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
    }
    if (mode !== 'racing') {
      this.paused = false;
      this.raceFinished = true;
      this.curveStrength = 0;
      this.targetCurveStrength = 0;
      this.hillStrength = 0;
      this.targetHillStrength = 0;
      this.clearAllPools();
      audioEngine.stopEngineLoop();
      if (this.playerCar) {
        this.playerCar.root.position.set(0, 0, 0);
        this.playerCar.root.rotation.set(0, 0, 0);
        this.playerCar.bodyGroup.rotation.set(0, 0, 0);
        this.playerCar.shieldMesh.visible = false;
        this.playerCar.nitroFlames.forEach((f) => (f.visible = false));
      }
      this.garageTurntable.visible = mode === 'garage';
      if (this.worldRig) {
        this.worldRig.checkpointArch.visible = false;
        applyWorldCurvature(this.worldRig, 0, 0);
        for (let i = 0; i < this.worldRig.roadSideFurniture.length; i++) {
          this.worldRig.roadSideFurniture[i].position.x = this.worldRig.furnitureBaseX[i];
          this.worldRig.roadSideFurniture[i].position.y = 0;
        }
        for (let i = 0; i < this.worldRig.props.length; i++) {
          this.worldRig.props[i].position.x = this.worldRig.propBaseX[i];
          this.worldRig.props[i].position.y = 0;
        }
        for (const g of this.worldRig.gantries) {
          g.position.x = 0;
          g.position.y = 0;
        }
        for (const spec of this.worldRig.spectators) {
          spec.group.position.x = spec.baseX;
          spec.group.position.y = 0;
        }
      }
    } else {
      this.garageTurntable.visible = false;
    }
    this.syncCarHeadlightBeams();
  }

  public startRace(config: ActiveRaceConfig): void {
    this.raceConfig = config;
    this.setGraphicsQuality(config.graphicsQuality);
    this.setEnvironment(config.environment);
    this.setShowcaseCar(config.carId, config.carColor);
    this.clearAllPools();

    this.viewMode = 'racing';
    this.doorsOpen = false;
    this.doorOpenProgress = 0;
    this.garageTurntable.visible = false;
    this.garageSoftboxes.forEach((l) => (l.visible = false));
    this.garageViewOffsetNorm = 0;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.syncCarHeadlightBeams();
    this.paused = false;
    this.raceFinished = false;
    this.pendingCrashResult = null;
    this.crashFreezeTimer = 0;

    this.curveStrength = 0;
    this.targetCurveStrength = 0;
    this.hillStrength = 0;
    this.targetHillStrength = 0;
    this.curveTimer = 4.0;
    if (this.worldRig) {
      applyWorldCurvature(this.worldRig, 0, 0);
    }

    const s = config.stats;
    this.baseMaxSpeed = 37 + (s.speed / 100) * 33;
    this.nitroMaxSpeed = this.baseMaxSpeed + 15 + (s.nitro / 100) * 18;
    this.accelRate = 12.5 + (s.accel / 100) * 16.5;
    this.handlingRate = (8.8 + (s.handling / 100) * 7.5) * config.steeringSensitivity;
    this.brakingRate = 24 + (s.braking / 100) * 24;
    this.nitroDrainRate = 28 - (s.nitro / 100) * 10;

    this.playerX = LANE_CENTERS[1];
    this.playerLateralVel = 0;
    this.playerSpeed = 20;
    this.distanceM = 0;
    this.nitroDistanceM = 0;
    this.coinsCollected = 0;
    this.score = 0;
    this.overtakes = 0;
    this.rivalsDefeated = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.nitro = 55;
    this.nitroActive = false;
    this.wasNitroActive = false;
    this.nitroUses = 0;
    this.padBoostTimer = 0;
    this.drafting = false;
    this.rivalAheadDist = null;
    // In Rival Duel levels, bring the first Rival into sight almost immediately!
    const isRivalLevel = config.levelConfig?.missionType === 'rivals';
    this.nextRivalDist = isRivalLevel ? 60 : 230;
    this.raceTime = 0;
    this.peakSpeedKmh = 0;
    this.checkpointsPassed = 0;
    this.nextCheckpointDist = 180;
    this.checkpointArchActive = false;
    this.hitsTaken = 0;
    this.reviveUsed = false;
    this.shieldTimer = 1.5;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.trafficSpawnTimer = 0.6;
    this.coinSpawnTimer = 0.4;
    this.nitroSpawnTimer = 4.0;
    this.boostPadSpawnTimer = 5.0;
    this.obstacleSpawnTimer = 2.6;
    this.feedbackText = null;
    this.feedbackTimer = 0;

    this.resetInputs();

    if (this.playerCar) {
      this.playerCar.root.position.set(this.playerX, 0, 0);
      this.playerCar.root.rotation.set(0, 0, 0);
    }

    this.spawnCoinLine(-45, 5);
    this.spawnTrafficVehicle(-92);
    this.spawnTrafficVehicle(-148);
    this.spawnBoostPad(-118);

    audioEngine.playIgnition();
    audioEngine.startEngineLoop();
    this.emitHud();
  }

  public setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      this.resetInputs();
      audioEngine.updateEngine(0, false, false);
    }
  }

  public reviveFromCrash(): void {
    if (!this.raceConfig || this.reviveUsed) return;
    this.reviveUsed = true;
    this.raceFinished = false;
    this.pendingCrashResult = null;
    this.crashFreezeTimer = 0;
    this.paused = false;
    this.shieldTimer = 3.2;
    this.playerSpeed = Math.max(24, this.baseMaxSpeed * 0.62);
    this.nitro = Math.max(this.nitro, 50);

    for (const t of this.trafficPool) {
      if (t.active && t.localZ > -48 && t.localZ < 18) {
        t.active = false;
        t.rig.root.visible = false;
      }
    }
    for (const o of this.obstaclePool) {
      if (o.active && o.z > -48 && o.z < 18) {
        o.active = false;
        o.group.visible = false;
      }
    }

    audioEngine.startEngineLoop();
    audioEngine.playNitroBurst();
    this.triggerFeedback(this.lang === 'fa' ? 'احیا شدی! برو جلو!' : 'REVIVED! GO!', '#38bdf8');
  }

  public setTouchControl(control: 'left' | 'right' | 'brake' | 'nitro', pressed: boolean): void {
    this.input[control] = pressed;
  }

  public setTouchSteerAxis(axis: number): void {
    this.input.touchSteerAxis = THREE.MathUtils.clamp(axis, -1, 1);
  }

  private resetInputs(): void {
    this.input.left = false;
    this.input.right = false;
    this.input.brake = false;
    this.input.nitro = false;
    this.input.touchSteerAxis = 0;
  }

  private clearAllPools(): void {
    for (const t of this.trafficPool) {
      t.active = false;
      t.rig.root.visible = false;
    }
    for (const c of this.coinPool) {
      c.active = false;
      c.mesh.visible = false;
    }
    for (const n of this.nitroPool) {
      n.active = false;
      n.group.visible = false;
    }
    for (const b of this.boostPadPool) {
      b.active = false;
      b.mesh.visible = false;
    }
    for (const o of this.obstaclePool) {
      o.active = false;
      o.group.visible = false;
    }
    for (const p of this.particlePool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count: number,
    spread = 6,
    gravity = 16,
    scaleMul = 1
  ): void {
    let spawned = 0;
    for (const p of this.particlePool) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x, y, z);
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(colorHex);
        mat.opacity = 0.88;
        p.vx = (Math.random() - 0.5) * spread;
        p.vy = gravity > 0 ? 2.2 + Math.random() * spread * 0.65 : 0.4 + Math.random() * 1.1;
        p.vz = (Math.random() - 0.5) * spread + 5;
        p.maxLife = 0.32 + Math.random() * 0.34;
        p.life = p.maxLife;
        p.gravity = gravity;
        p.mesh.scale.setScalar((0.75 + Math.random() * 0.7) * scaleMul);
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private triggerFeedback(text: string, color: string): void {
    this.feedbackText = text;
    this.feedbackColor = color;
    this.feedbackTimer = 1.35;
    this.feedbackId++;
  }

  private isLaneSafeForVehicle(
    lane: number,
    z: number,
    minGap: number,
    ignoreVehicle?: PooledTraffic
  ): boolean {
    for (const other of this.trafficPool) {
      if (!other.active || other === ignoreVehicle) continue;
      if (other.lane === lane || other.targetLane === lane) {
        if (Math.abs(other.localZ - z) < minGap) return false;
      }
    }
    return true;
  }

  private spawnTrafficVehicle(spawnZ = -195): void {
    const slot = this.trafficPool.find((t) => !t.active && !t.isRival);
    if (!slot) return;

    const candidateLanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    let chosenLane = -1;
    for (const lane of candidateLanes) {
      if (this.isLaneSafeForVehicle(lane, spawnZ, 30)) {
        chosenLane = lane;
        break;
      }
    }
    if (chosenLane === -1) return;

    const sameBandCount = this.trafficPool.filter(
      (other) => other.active && Math.abs(other.localZ - spawnZ) < 26
    ).length;
    if (sameBandCount >= 3) return;

    const lvlFactor = this.raceConfig?.levelConfig?.trafficSpeedFactor ?? 1.0;
    const kindSpeedBias =
      slot.rig.kind === 'truck' || slot.rig.kind === 'bus'
        ? 14 + Math.random() * 6
        : 20 + Math.random() * 14;
    const baseSpeed = kindSpeedBias * lvlFactor;

    slot.active = true;
    slot.lane = chosenLane;
    slot.targetLane = chosenLane;
    slot.baseSpeed = baseSpeed;
    slot.speed = baseSpeed;
    slot.localX = LANE_CENTERS[chosenLane];
    slot.localZ = spawnZ;
    slot.passedByPlayer = false;
    slot.changingLane = false;
    slot.braking = false;
    slot.aiCooldown = 0.6 + Math.random() * 1.4;
    slot.laneChangeTimer = 2.0 + Math.random() * 3.5;
    slot.rig.leftBlinker.visible = false;
    slot.rig.rightBlinker.visible = false;
    slot.rig.brakeLightMats.forEach((m) => (m.emissiveIntensity = 1.2));
    slot.rig.root.position.set(
      slot.localX + getCurveOffsetX(spawnZ, this.curveStrength),
      getHillOffsetY(spawnZ, this.hillStrength),
      spawnZ
    );
    slot.rig.root.rotation.y = 0;
    slot.rig.root.visible = true;
  }

  private spawnRivalRacer(currentMaxSpeed: number): void {
    const slot = this.trafficPool.find((t) => !t.active && t.isRival);
    if (!slot) return;

    const spawnZ = -148;
    const candidateLanes = [1, 2, 0, 3].sort(() => Math.random() - 0.5);
    let chosenLane = -1;
    for (const lane of candidateLanes) {
      if (this.isLaneSafeForVehicle(lane, spawnZ, 24)) {
        chosenLane = lane;
        break;
      }
    }
    if (chosenLane === -1) return;

    slot.active = true;
    slot.lane = chosenLane;
    slot.targetLane = chosenLane;
    slot.baseSpeed = currentMaxSpeed * 0.85;
    slot.speed = slot.baseSpeed;
    slot.localX = LANE_CENTERS[chosenLane];
    slot.localZ = spawnZ;
    slot.passedByPlayer = false;
    slot.changingLane = false;
    slot.braking = false;
    slot.aiCooldown = 0.25;
    slot.laneChangeTimer = 1.4;
    slot.rig.leftBlinker.visible = false;
    slot.rig.rightBlinker.visible = false;
    slot.rig.root.position.set(
      slot.localX + getCurveOffsetX(spawnZ, this.curveStrength),
      getHillOffsetY(spawnZ, this.hillStrength),
      spawnZ
    );
    slot.rig.root.visible = true;

    this.triggerFeedback(
      this.lang === 'fa' ? 'رقیب حرفه‌ای پیش رو! سبقت بگیر!' : 'RIVAL RACER AHEAD! OVERTAKE!',
      '#fb7185'
    );
  }

  private spawnCoinLine(startZ = -175, count = 5): void {
    const lane = Math.floor(Math.random() * 4);
    const laneX = LANE_CENTERS[lane];
    let spawned = 0;
    for (const c of this.coinPool) {
      if (!c.active) {
        c.active = true;
        c.laneX = laneX;
        c.z = startZ - spawned * 4.4;
        c.mesh.position.set(
          laneX + getCurveOffsetX(c.z, this.curveStrength),
          0.85 + getHillOffsetY(c.z, this.hillStrength),
          c.z
        );
        c.mesh.visible = true;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private spawnNitroCanister(): void {
    const slot = this.nitroPool.find((n) => !n.active);
    if (!slot) return;
    const lane = Math.floor(Math.random() * 4);
    slot.active = true;
    slot.x = LANE_CENTERS[lane];
    slot.z = -185;
    slot.group.position.set(
      slot.x + getCurveOffsetX(slot.z, this.curveStrength),
      getHillOffsetY(slot.z, this.hillStrength),
      slot.z
    );
    slot.group.visible = true;
  }

  private spawnBoostPad(spawnZ = -190): void {
    const slot = this.boostPadPool.find((b) => !b.active);
    if (!slot) return;
    const lane = Math.floor(Math.random() * 4);
    slot.active = true;
    slot.triggered = false;
    slot.x = LANE_CENTERS[lane];
    slot.z = spawnZ;
    slot.mesh.position.set(
      slot.x + getCurveOffsetX(spawnZ, this.curveStrength),
      0.045 + getHillOffsetY(spawnZ, this.hillStrength),
      spawnZ
    );
    slot.mesh.visible = true;
  }

  private spawnObstacle(): void {
    const slot = this.obstaclePool.find((o) => !o.active);
    if (!slot) return;
    const lane = Math.floor(Math.random() * 4);
    if (!this.isLaneSafeForVehicle(lane, -185, 24)) return;
    slot.active = true;
    slot.x = LANE_CENTERS[lane];
    slot.z = -185;
    slot.group.position.set(
      slot.x + getCurveOffsetX(slot.z, this.curveStrength),
      getHillOffsetY(slot.z, this.hillStrength),
      slot.z
    );
    slot.group.visible = true;
  }

  private updateSpectators(dt: number, scrollSpeed: number, isRacing: boolean): void {
    if (!this.worldRig) return;
    for (const spec of this.worldRig.spectators) {
      spec.baseZ += scrollSpeed * dt;
      if (spec.baseZ > 28) {
        spec.baseZ -= 235;
      }
      const curveX = isRacing ? getCurveOffsetX(spec.baseZ, this.curveStrength) : 0;
      const hillY = isRacing ? getHillOffsetY(spec.baseZ, this.hillStrength) : 0;

      const nearPlayer = isRacing && Math.abs(spec.baseZ) < 28;
      const isChild = spec.archetype === 'child';
      const cheerRate = nearPlayer ? (isChild ? 14 : 10.5) : 3.4;
      const wave = Math.sin(this.elapsedTotal * cheerRate + spec.phase);

      // Realistic articulated arm waving (shoulders raise up + elbows bend naturally!)
      if (spec.archetype === 'marshal') {
        spec.leftArm.rotation.x = -0.35;
        spec.leftArm.rotation.z = -0.18;
        spec.leftForearm.rotation.x = -0.8;
        spec.rightArm.rotation.x = -2.35 + wave * (nearPlayer ? 0.45 : 0.25);
        spec.rightArm.rotation.z = 0.28 + wave * 0.22;
        spec.rightForearm.rotation.x = -0.45;
      } else if (isChild) {
        // Kids excitedly raise both arms high & jump when race cars zoom past!
        spec.leftArm.rotation.x = -2.45 + wave * 0.35;
        spec.leftArm.rotation.z = -0.35 - wave * 0.2;
        spec.leftForearm.rotation.x = -0.4;
        spec.rightArm.rotation.x = -2.45 - wave * 0.35;
        spec.rightArm.rotation.z = 0.35 + wave * 0.2;
        spec.rightForearm.rotation.x = -0.4;
      } else {
        spec.leftArm.rotation.x = nearPlayer ? -2.2 + wave * 0.35 : -0.35 + wave * 0.12;
        spec.leftArm.rotation.z = nearPlayer ? -0.25 : -0.1;
        spec.leftForearm.rotation.x = nearPlayer ? -0.55 : -0.65;
        spec.rightArm.rotation.x = -2.1 - wave * (nearPlayer ? 0.42 : 0.18);
        spec.rightArm.rotation.z = 0.24 + wave * 0.18;
        spec.rightForearm.rotation.x = -0.62;
      }

      // Spectators smoothly turn their heads to track the player's car zooming down the road!
      const sideSign = spec.baseX < 0 ? 1 : -1;
      const trackYaw = THREE.MathUtils.clamp(
        Math.atan2(-spec.baseZ, Math.abs(spec.baseX)) * sideSign * 0.55,
        -0.65,
        0.65
      );
      spec.headPivot.rotation.y = isRacing ? trackYaw : Math.sin(this.elapsedTotal * 1.6 + spec.phase) * 0.2;

      const hop = nearPlayer
        ? Math.abs(Math.sin(this.elapsedTotal * (isChild ? 12 : 8.5) + spec.phase)) *
          (isChild ? 0.24 : 0.1)
        : 0;

      spec.group.position.set(spec.baseX + curveX, hillY + hop, spec.baseZ);
    }
  }

  private updateWeather(dt: number, speed: number): void {
    if (!this.worldRig) return;
    if (this.worldRig.snowPoints) {
      const posAttr = this.worldRig.snowPoints.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - dt * 5.2;
        let z = posAttr.getZ(i) + speed * dt * 0.55;
        if (y < 0.2) y = 24;
        if (z > 20) z = -125;
        posAttr.setY(i, y);
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;
    }

    if (this.worldRig.rainPoints) {
      const posAttr = this.worldRig.rainPoints.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - dt * 28;
        let z = posAttr.getZ(i) + (speed * 0.8 + 12) * dt;
        if (y < 0.1) y = 22;
        if (z > 16) z = -100;
        posAttr.setY(i, y);
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;
    }
  }

  private updateRacing(dt: number): void {
    if (!this.raceConfig || !this.playerCar || !this.worldRig) return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateShakeCamera(dt);
      return;
    }

    if (this.crashFreezeTimer > 0) {
      this.crashFreezeTimer -= dt;
      this.updateParticles(dt);
      this.updateShakeCamera(dt);
      if (this.crashFreezeTimer <= 0 && this.pendingCrashResult) {
        const res = this.pendingCrashResult;
        this.pendingCrashResult = null;
        this.callbacks.onRaceEnd(res);
      }
      return;
    }

    if (this.paused || this.raceFinished) return;

    this.raceTime += dt;
    if (this.shieldTimer > 0) this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    if (this.padBoostTimer > 0) this.padBoostTimer = Math.max(0, this.padBoostTimer - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedbackText = null;
    }

    // Dynamic sweeping curves & gentle highway hills
    this.curveTimer -= dt;
    if (this.curveTimer <= 0) {
      this.curveTimer = 5.0 + Math.random() * 4.5;
      const roll = Math.random();
      if (roll < 0.25) {
        this.targetCurveStrength = 0;
      } else if (roll < 0.62) {
        this.targetCurveStrength = 0.75 + Math.random() * 0.85;
      } else {
        this.targetCurveStrength = -(0.75 + Math.random() * 0.85);
      }
      this.targetHillStrength = (Math.random() - 0.45) * 3.2;
    }
    this.curveStrength = THREE.MathUtils.damp(this.curveStrength, this.targetCurveStrength, 0.85, dt);
    this.hillStrength = THREE.MathUtils.damp(this.hillStrength, this.targetHillStrength, 0.75, dt);
    applyWorldCurvature(this.worldRig, this.curveStrength, this.hillStrength);

    const endlessRamp =
      this.raceConfig.mode === 'endless' ? Math.min(24, this.distanceM * 0.0045) : 0;
    const currentMaxSpeed = this.baseMaxSpeed + endlessRamp;

    // Nitro logic
    const wantsNitro = this.input.nitro && !this.input.brake;
    if (wantsNitro && (this.nitroActive ? this.nitro > 0.5 : this.nitro >= 14)) {
      this.nitroActive = true;
      if (!this.wasNitroActive) {
        this.nitroUses++;
        audioEngine.playNitroBurst();
        this.triggerFeedback(this.lang === 'fa' ? 'توربو نیترو!' : 'TURBO NITRO!', '#38bdf8');
      }
      this.nitro = Math.max(0, this.nitro - this.nitroDrainRate * dt);
      if (this.nitro <= 0.5) this.nitroActive = false;
    } else {
      this.nitroActive = false;
      const charge = this.nitroChargeRate + (this.drafting ? 22 : 0);
      this.nitro = Math.min(100, this.nitro + charge * dt);
    }
    this.wasNitroActive = this.nitroActive;

    const isSuperBoosted = this.nitroActive || this.padBoostTimer > 0;
    const padExtra = this.padBoostTimer > 0 ? 15 : 0;
    const draftExtra = this.drafting ? 5.5 : 0;

    const targetSpeed = this.input.brake
      ? Math.max(14, currentMaxSpeed * 0.36)
      : this.nitroActive
      ? this.nitroMaxSpeed + endlessRamp * 0.6 + padExtra
      : currentMaxSpeed + padExtra + draftExtra;

    if (this.playerSpeed < targetSpeed) {
      const rate = isSuperBoosted ? this.accelRate * 2.25 : this.accelRate;
      this.playerSpeed = Math.min(targetSpeed, this.playerSpeed + rate * dt);
    } else {
      const decel = this.input.brake ? this.brakingRate : 14;
      this.playerSpeed = Math.max(targetSpeed, this.playerSpeed - decel * dt);
    }

    const speedKmh = this.playerSpeed * 3.6;
    if (speedKmh > this.peakSpeedKmh) this.peakSpeedKmh = speedKmh;

    const feverActive = this.combo >= 4;
    const stepDist = this.playerSpeed * dt;
    this.distanceM += stepDist;
    if (this.nitroActive) this.nitroDistanceM += stepDist;
    this.score +=
      stepDist *
      (isSuperBoosted ? 2.4 : 1.2) *
      (1 + (this.combo - 1) * 0.2) *
      (feverActive ? 1.35 : 1.0);

    // Steering + curve centrifugal pull
    let steerDir = 0;
    if (this.input.left) steerDir -= 1;
    if (this.input.right) steerDir += 1;
    if (Math.abs(this.input.touchSteerAxis) > 0.05) {
      steerDir = this.input.touchSteerAxis;
    }

    const curveDrift = -this.curveStrength * (this.playerSpeed / 48) * 1.15;
    const targetLatVel = steerDir * this.handlingRate + curveDrift;
    this.playerLateralVel = THREE.MathUtils.damp(this.playerLateralVel, targetLatVel, 14, dt);
    this.playerX += this.playerLateralVel * dt;
    const maxRoadX = ROAD_WIDTH / 2 - 1.28;
    if (this.playerX < -maxRoadX) {
      this.playerX = -maxRoadX;
      this.playerLateralVel = 0;
    } else if (this.playerX > maxRoadX) {
      this.playerX = maxRoadX;
      this.playerLateralVel = 0;
    }

    // Player Car kinematics
    this.playerCar.root.position.x = this.playerX;
    this.playerCar.root.position.y = Math.sin(this.elapsedTotal * 26) * 0.014;
    const rollAngle = THREE.MathUtils.clamp(-this.playerLateralVel * 0.016, -0.18, 0.18);
    const yawAngle = THREE.MathUtils.clamp(-this.playerLateralVel * 0.012, -0.14, 0.14);
    const pitchAngle = isSuperBoosted ? -0.048 : this.input.brake ? 0.048 : 0;

    this.playerCar.bodyGroup.rotation.z = THREE.MathUtils.damp(
      this.playerCar.bodyGroup.rotation.z,
      rollAngle,
      12,
      dt
    );
    this.playerCar.bodyGroup.rotation.x = THREE.MathUtils.damp(
      this.playerCar.bodyGroup.rotation.x,
      pitchAngle,
      10,
      dt
    );
    this.playerCar.root.rotation.y = THREE.MathUtils.damp(
      this.playerCar.root.rotation.y,
      yawAngle,
      12,
      dt
    );

    const wheelSpin = this.playerSpeed * dt * 2.1;
    for (const w of this.playerCar.wheels) w.rotation.x -= wheelSpin;
    const frontSteerAngle = THREE.MathUtils.clamp(-steerDir * 0.32, -0.35, 0.35);
    for (const pivot of this.playerCar.frontWheelPivots) {
      pivot.rotation.y = THREE.MathUtils.damp(pivot.rotation.y, frontSteerAngle, 14, dt);
    }

    // Live Interior Kinematics: Steering wheel spins & driver turns head into corners!
    this.playerCar.steeringWheel.rotation.z = THREE.MathUtils.damp(
      this.playerCar.steeringWheel.rotation.z,
      -steerDir * 1.15,
      14,
      dt
    );
    this.playerCar.driverHead.rotation.y = THREE.MathUtils.damp(
      this.playerCar.driverHead.rotation.y,
      -steerDir * 0.28,
      10,
      dt
    );
    // Keep doors tightly latched during racing
    if (this.playerCar.leftDoorPivot && this.playerCar.rightDoorPivot) {
      this.playerCar.leftDoorPivot.rotation.set(0, 0, 0);
      this.playerCar.rightDoorPivot.rotation.set(0, 0, 0);
    }
    if (this.playerCar.cabinLight) {
      this.playerCar.cabinLight.intensity = this.cameraMode === 'cockpit' ? 0.65 : 0;
    }

    // OLED Brake light flare + tire smoke
    for (const bl of this.playerCar.brakeLights) {
      (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = this.input.brake ? 4.2 : 1.4;
    }
    if (
      (this.input.brake && this.playerSpeed > 18) ||
      (Math.abs(this.playerLateralVel) > 6.8 && this.playerSpeed > 32)
    ) {
      if (Math.random() < 0.45) {
        const side = Math.random() < 0.5 ? -0.82 : 0.82;
        this.spawnParticles(this.playerX + side, 0.22, 1.45, 0xe2e8f0, 1, 1.4, -2, 1.4);
      }
    }

    // Nitro flames
    for (const flame of this.playerCar.nitroFlames) {
      flame.visible = isSuperBoosted;
      if (isSuperBoosted) flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }
    if (isSuperBoosted && Math.random() < 0.5) {
      this.spawnParticles(
        this.playerX + (Math.random() - 0.5) * 0.8,
        0.45,
        2.5,
        this.padBoostTimer > 0 ? 0xfacc15 : 0x38bdf8,
        1,
        2.6
      );
    }
    if (feverActive && Math.random() < 0.28) {
      this.spawnParticles(this.playerX + (Math.random() - 0.5) * 1.4, 0.4, 1.8, 0xfacc15, 1, 2.2, 4, 0.8);
    }

    if (this.shieldTimer > 0) {
      this.playerCar.shieldMesh.visible = true;
      this.playerCar.shieldMesh.rotation.y += dt * 3;
      (this.playerCar.shieldMesh.material as THREE.MeshBasicMaterial).opacity =
        0.16 + Math.sin(this.elapsedTotal * 18) * 0.1;
    } else {
      this.playerCar.shieldMesh.visible = false;
    }

    // Scroll PBR road, terrain, lamps, overhead highway gantries, props, spectators & weather
    const texScrollRate = (this.playerSpeed * dt * 14) / ROAD_LENGTH;
    this.worldRig.roadTextures.map.offset.y =
      (this.worldRig.roadTextures.map.offset.y + texScrollRate) % 1;
    this.worldRig.roadTextures.roughnessMap.offset.y = this.worldRig.roadTextures.map.offset.y;
    this.worldRig.roadTextures.bumpMap.offset.y = this.worldRig.roadTextures.map.offset.y;
    this.worldRig.terrainTexture.offset.y =
      (this.worldRig.terrainTexture.offset.y +
        (this.playerSpeed * dt * 22) / (ROAD_LENGTH + 180)) %
      1;

    for (let i = 0; i < this.worldRig.roadSideFurniture.length; i++) {
      const lamp = this.worldRig.roadSideFurniture[i];
      lamp.position.z += this.playerSpeed * dt;
      if (lamp.position.z > 28) lamp.position.z -= 240;
      lamp.position.x =
        this.worldRig.furnitureBaseX[i] + getCurveOffsetX(lamp.position.z, this.curveStrength);
      lamp.position.y = getHillOffsetY(lamp.position.z, this.hillStrength);
    }

    for (const gantry of this.worldRig.gantries) {
      gantry.position.z += this.playerSpeed * dt;
      if (gantry.position.z > 26) gantry.position.z -= 246;
      gantry.position.x = getCurveOffsetX(gantry.position.z, this.curveStrength);
      gantry.position.y = getHillOffsetY(gantry.position.z, this.hillStrength);
    }

    for (let i = 0; i < this.worldRig.props.length; i++) {
      const prop = this.worldRig.props[i];
      prop.position.z += this.playerSpeed * dt;
      if (prop.position.z > 32) prop.position.z -= 245;
      prop.position.x =
        this.worldRig.propBaseX[i] + getCurveOffsetX(prop.position.z, this.curveStrength);
      prop.position.y = getHillOffsetY(prop.position.z, this.hillStrength);
    }

    this.updateSpectators(dt, this.playerSpeed, true);
    this.updateWeather(dt, this.playerSpeed);

    for (const cloud of this.worldRig.clouds) {
      cloud.position.z += this.playerSpeed * dt * 0.18;
      if (cloud.position.z > 40) cloud.position.z -= 240;
    }

    // Checkpoint Arch logic
    const lvl = this.raceConfig.levelConfig;
    const useCheckpoints =
      lvl &&
      (lvl.missionType === 'checkpoints' ||
        lvl.missionType === 'distance' ||
        lvl.missionType === 'noHit');
    if (useCheckpoints) {
      if (!this.checkpointArchActive && this.distanceM >= this.nextCheckpointDist - 150) {
        this.checkpointArchActive = true;
        this.checkpointArchZ = -150;
        this.worldRig.checkpointArch.visible = true;
      }
      if (this.checkpointArchActive) {
        this.checkpointArchZ += this.playerSpeed * dt;
        this.worldRig.checkpointArch.position.set(
          getCurveOffsetX(this.checkpointArchZ, this.curveStrength),
          getHillOffsetY(this.checkpointArchZ, this.hillStrength),
          this.checkpointArchZ
        );
        if (this.checkpointArchZ >= 0) {
          this.checkpointArchActive = false;
          this.worldRig.checkpointArch.visible = false;
          this.checkpointsPassed++;
          this.nextCheckpointDist += 210;
          this.nitro = Math.min(100, this.nitro + 18);
          this.score += 180;
          audioEngine.playCheckpoint();
          this.spawnParticles(this.playerX, 2.2, -1, 0x22c55e, 10, 8);
          this.triggerFeedback(
            this.lang === 'fa' ? 'چک‌پوینت +۱۸۰!' : 'CHECKPOINT +180!',
            '#22c55e'
          );
        }
      }
    }

    // Spawners
    const density = lvl ? lvl.trafficDensity : Math.min(1.85, 0.85 + this.distanceM * 0.00025);
    this.trafficSpawnTimer -= dt * density;
    if (this.trafficSpawnTimer <= 0) {
      this.spawnTrafficVehicle(-195);
      this.trafficSpawnTimer = 0.72 + Math.random() * 0.65;
    }

    // Spawn Rival GT Racers (faster cadence in dedicated Rival Duel levels!)
    if (this.distanceM >= this.nextRivalDist) {
      const isRivalLevel = lvl?.missionType === 'rivals';
      this.nextRivalDist =
        this.distanceM + (isRivalLevel ? 115 + Math.random() * 45 : 260 + Math.random() * 110);
      this.spawnRivalRacer(currentMaxSpeed);
    }

    this.coinSpawnTimer -= dt;
    if (this.coinSpawnTimer <= 0) {
      this.spawnCoinLine(-185, 4 + Math.floor(Math.random() * 4));
      this.coinSpawnTimer = 1.6 + Math.random() * 1.1;
    }

    this.nitroSpawnTimer -= dt;
    if (this.nitroSpawnTimer <= 0) {
      this.spawnNitroCanister();
      this.nitroSpawnTimer = 6.5 + Math.random() * 4.5;
    }

    this.boostPadSpawnTimer -= dt;
    if (this.boostPadSpawnTimer <= 0) {
      this.spawnBoostPad(-192);
      this.boostPadSpawnTimer = 6.2 + Math.random() * 4.0;
    }

    if (lvl?.hasObstacles || (this.raceConfig.mode === 'endless' && this.distanceM > 500)) {
      this.obstacleSpawnTimer -= dt;
      if (this.obstacleSpawnTimer <= 0) {
        this.spawnObstacle();
        this.obstacleSpawnTimer = 3.2 + Math.random() * 2.4;
      }
    }

    // Smart Traffic AI + Rival Racers + Slipstream Drafting + Collisions
    const playerHalfW = 0.92;
    const playerHalfL = 1.92;
    let isDraftingNow = false;
    let closestRivalDist: number | null = null;

    for (const t of this.trafficPool) {
      if (!t.active) continue;
      if (t.aiCooldown > 0) t.aiCooldown -= dt;

      let closestAhead: PooledTraffic | null = null;
      let closestGap = 999;
      for (const other of this.trafficPool) {
        if (!other.active || other === t) continue;
        const sameLane =
          other.lane === t.lane || other.targetLane === t.lane || other.lane === t.targetLane;
        if (!sameLane) continue;
        if (other.localZ < t.localZ) {
          const bumperGap = t.localZ - other.localZ - (t.rig.halfLength + other.rig.halfLength);
          if (bumperGap < closestGap) {
            closestGap = bumperGap;
            closestAhead = other;
          }
        }
      }

      const lookaheadDist = t.isRival ? 40 : 25;
      t.braking = false;

      if (closestAhead && closestGap < lookaheadDist && closestAhead.speed < t.baseSpeed + 2) {
        let overtook = false;
        if (!t.changingLane && t.aiCooldown <= 0 && t.localZ < -22) {
          const candidates = [t.lane - 1, t.lane + 1]
            .filter((l) => l >= 0 && l <= 3)
            .sort(() => Math.random() - 0.5);
          for (const nextLane of candidates) {
            const safeFromTraffic = this.isLaneSafeForVehicle(nextLane, t.localZ, 20, t);
            const blocksPlayerNose =
              t.localZ > -26 && Math.abs(LANE_CENTERS[nextLane] - this.playerX) < 2.2;
            if (safeFromTraffic && !blocksPlayerNose) {
              t.targetLane = nextLane;
              t.changingLane = true;
              t.aiCooldown = t.isRival ? 0.55 : 1.8;
              overtook = true;
              break;
            }
          }
        }

        if (!overtook) {
          t.braking = true;
          const desiredSpeed = Math.max(8, closestAhead.speed - (closestGap < 6 ? 4 : 0.8));
          t.speed = THREE.MathUtils.damp(t.speed, desiredSpeed, 6.5, dt);
          if (closestGap < 2.6) {
            t.localZ =
              closestAhead.localZ + t.rig.halfLength + closestAhead.rig.halfLength + 2.6;
            t.speed = Math.min(t.speed, closestAhead.speed);
          }
        }
      } else {
        t.speed = THREE.MathUtils.damp(t.speed, t.baseSpeed, 2.6, dt);

        if (
          !t.isRival &&
          !t.changingLane &&
          t.aiCooldown <= 0 &&
          t.rig.kind !== 'truck' &&
          t.rig.kind !== 'bus' &&
          t.localZ > -28 &&
          t.localZ < -12 &&
          Math.abs(this.playerX - t.localX) < 1.85 &&
          this.playerSpeed - t.speed > 15
        ) {
          const escapeLane = this.playerX > t.localX ? t.lane - 1 : t.lane + 1;
          if (
            escapeLane >= 0 &&
            escapeLane <= 3 &&
            this.isLaneSafeForVehicle(escapeLane, t.localZ, 22, t)
          ) {
            t.targetLane = escapeLane;
            t.changingLane = true;
            t.aiCooldown = 3.0;
          }
        }
      }

      const brakeGlow = t.braking ? 4.4 : 1.3;
      for (const mat of t.rig.brakeLightMats) mat.emissiveIntensity = brakeGlow;

      const relZ = (this.playerSpeed - t.speed) * dt;
      t.localZ += relZ;

      for (const w of t.rig.wheels) w.rotation.x -= t.speed * dt * 2.0;

      if (!t.changingLane && t.aiCooldown <= 0 && t.localZ < -48 && t.localZ > -140) {
        t.laneChangeTimer -= dt;
        if (t.laneChangeTimer <= 0) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const nextLane = t.lane + dir;
          if (nextLane >= 0 && nextLane <= 3 && this.isLaneSafeForVehicle(nextLane, t.localZ, 24, t)) {
            t.targetLane = nextLane;
            t.changingLane = true;
          }
          t.laneChangeTimer = 3.5 + Math.random() * 4.0;
        }
      }

      let laneYaw = 0;
      if (t.changingLane) {
        const targetX = LANE_CENTERS[t.targetLane];
        const dx = targetX - t.localX;
        const blinkOn = Math.floor(this.elapsedTotal * 10) % 2 === 0;
        t.rig.leftBlinker.visible = dx < -0.1 && blinkOn;
        t.rig.rightBlinker.visible = dx > 0.1 && blinkOn;
        const steerDamp = t.isRival ? 5.6 : 3.4;
        const prevX = t.localX;
        t.localX = THREE.MathUtils.damp(t.localX, targetX, steerDamp, dt);
        laneYaw = THREE.MathUtils.clamp(-(t.localX - prevX) * 2.4, -0.22, 0.22);
        if (Math.abs(dx) < 0.08) {
          t.lane = t.targetLane;
          t.changingLane = false;
          t.rig.leftBlinker.visible = false;
          t.rig.rightBlinker.visible = false;
        }
      }

      if (t.isRival) {
        if (t.rig.rivalBeacon) {
          t.rig.rivalBeacon.rotation.y += dt * 4.2;
          t.rig.rivalBeacon.position.y = 2.55 + Math.sin(this.elapsedTotal * 6) * 0.18;
        }
        if (t.rig.rivalFlame) {
          t.rig.rivalFlame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
        }
        if (t.localZ < -2 && t.localZ > -185) {
          const dist = Math.round(-t.localZ);
          if (closestRivalDist === null || dist < closestRivalDist) {
            closestRivalDist = dist;
          }
        }
      }

      const curveX = getCurveOffsetX(t.localZ, this.curveStrength);
      const hillY = getHillOffsetY(t.localZ, this.hillStrength);
      const curveYaw = t.localZ < 0 ? Math.atan(this.curveStrength * t.localZ * 0.00116) : 0;
      t.rig.root.position.set(t.localX + curveX, hillY, t.localZ);
      t.rig.root.rotation.y = laneYaw - curveYaw;

      const tz = t.localZ;
      const tx = t.localX;

      if (this.playerSpeed > 26 && tz < -4.4 && tz > -25 && Math.abs(this.playerX - tx) < 1.48) {
        isDraftingNow = true;
      }

      const overlapX = Math.abs(this.playerX - tx) < playerHalfW + t.rig.halfWidth - 0.18;
      const overlapZ = Math.abs(tz) < playerHalfL + t.rig.halfLength - 0.22;

      if (overlapX && overlapZ) {
        if (this.shieldTimer > 0) {
          t.active = false;
          t.rig.root.visible = false;
          this.spawnParticles(tx, 1.2, tz, 0x38bdf8, 12, 9);
        } else {
          this.handlePlayerCrash(tx, tz);
          return;
        }
      }

      if (!t.passedByPlayer && tz > 2.0) {
        t.passedByPlayer = true;
        if (t.isRival) {
          this.overtakes++;
          this.rivalsDefeated++;
          this.combo = Math.min(8, this.combo + 2);
          this.comboTimer = 5.0;
          this.score += 500;
          this.coinsCollected += 15;
          this.nitro = Math.min(100, this.nitro + 45);
          audioEngine.playCheckpoint();
          this.spawnParticles(this.playerX, 1.4, -0.5, 0xfacc15, 16, 9);
          this.triggerFeedback(
            this.lang === 'fa'
              ? 'رقیب شکست خورد! +۵۰۰ امتیاز | +۱۵ سکه'
              : 'RIVAL DEFEATED! +500 | +15 COINS',
            '#fbbf24'
          );
        } else {
          const sideGap = Math.abs(this.playerX - tx) - (playerHalfW + t.rig.halfWidth);
          if (sideGap < 2.0 && this.playerSpeed > 24) {
            this.overtakes++;
            this.combo = Math.min(8, this.combo + 1);
            this.comboTimer = 4.5;
            const bonus = 100 * this.combo;
            this.score += bonus;
            this.nitro = Math.min(100, this.nitro + 14);
            audioEngine.playNearMiss();
            this.spawnParticles(this.playerX, 0.9, -0.5, 0x38bdf8, 6, 5);
            if (this.combo === 4) {
              this.triggerFeedback(
                this.lang === 'fa' ? 'حالت فیور فعال شد! ×۴' : 'FEVER MODE ACTIVE! ×4',
                '#f59e0b'
              );
            } else {
              this.triggerFeedback(
                this.lang === 'fa'
                  ? `سبقت نزدیک ×${this.combo} (+${bonus})`
                  : `NEAR MISS ×${this.combo} (+${bonus})`,
                '#facc15'
              );
            }
          }
        }
      }

      if (tz > 28 || tz < -230) {
        t.active = false;
        t.rig.root.visible = false;
      }
    }

    this.drafting = isDraftingNow;
    this.rivalAheadDist = closestRivalDist;
    if (this.drafting && Math.random() < 0.42) {
      this.spawnParticles(
        this.playerX + (Math.random() - 0.5) * 1.9,
        0.7 + Math.random() * 0.6,
        -2.4,
        0x7dd3fc,
        1,
        1.5,
        0,
        0.65
      );
    }

    // Update Boost Pads
    for (const b of this.boostPadPool) {
      if (!b.active) continue;
      b.z += this.playerSpeed * dt;
      b.mesh.position.set(
        b.x + getCurveOffsetX(b.z, this.curveStrength),
        0.045 + getHillOffsetY(b.z, this.hillStrength),
        b.z
      );

      if (!b.triggered && Math.abs(this.playerX - b.x) < 1.85 && Math.abs(b.z) < 4.8) {
        b.triggered = true;
        this.padBoostTimer = 1.85;
        this.nitro = Math.min(100, this.nitro + 26);
        this.score += 150;
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.22);
        audioEngine.playNitroBurst();
        this.spawnParticles(this.playerX, 0.6, -1.0, 0x38bdf8, 12, 7);
        this.triggerFeedback(
          this.lang === 'fa' ? 'پد سرعت توربو! +۱۵۰' : 'TURBO BOOST PAD! +150',
          '#38bdf8'
        );
      }

      if (b.z > 24) {
        b.active = false;
        b.mesh.visible = false;
      }
    }

    // Update Obstacles
    for (const o of this.obstaclePool) {
      if (!o.active) continue;
      o.z += this.playerSpeed * dt;
      o.group.position.set(
        o.x + getCurveOffsetX(o.z, this.curveStrength),
        getHillOffsetY(o.z, this.hillStrength),
        o.z
      );

      const hitX = Math.abs(this.playerX - o.x) < playerHalfW + 0.98;
      const hitZ = Math.abs(o.z) < playerHalfL + 0.35;
      if (hitX && hitZ) {
        if (this.shieldTimer > 0) {
          o.active = false;
          o.group.visible = false;
          this.spawnParticles(o.x, 0.8, o.z, 0xf97316, 10, 8);
        } else {
          this.handlePlayerCrash(o.x, o.z);
          return;
        }
      }
      if (o.z > 22) {
        o.active = false;
        o.group.visible = false;
      }
    }

    // Update Coins
    const magnetRangeX = feverActive ? 5.2 : 2.9;
    const magnetRangeZ = feverActive ? 8.5 : 4.8;
    for (const c of this.coinPool) {
      if (!c.active) continue;
      c.z += this.playerSpeed * dt;

      const dx = this.playerX - c.laneX;
      const dz = -c.z;
      if (Math.abs(dz) < magnetRangeZ && Math.abs(dx) < magnetRangeX) {
        c.laneX = THREE.MathUtils.damp(c.laneX, this.playerX, feverActive ? 14 : 11, dt);
      }

      c.mesh.position.set(
        c.laneX + getCurveOffsetX(c.z, this.curveStrength),
        0.85 + Math.sin(this.elapsedTotal * 5 + c.phase) * 0.14 + getHillOffsetY(c.z, this.hillStrength),
        c.z
      );
      c.mesh.rotation.y += dt * 4.2;

      if (Math.abs(this.playerX - c.laneX) < 1.55 && Math.abs(c.z) < 2.2) {
        c.active = false;
        c.mesh.visible = false;
        this.coinsCollected++;
        this.score += feverActive ? 40 : 25;
        audioEngine.playCoin();
        this.spawnParticles(this.playerX, 1.0, -0.8, 0xfacc15, 5, 4.5);
      } else if (c.z > 18) {
        c.active = false;
        c.mesh.visible = false;
      }
    }

    // Update Nitro Canisters
    for (const n of this.nitroPool) {
      if (!n.active) continue;
      n.z += this.playerSpeed * dt;
      n.group.position.set(
        n.x + getCurveOffsetX(n.z, this.curveStrength),
        getHillOffsetY(n.z, this.hillStrength),
        n.z
      );
      n.group.rotation.y += dt * 3.0;
      if (Math.abs(this.playerX - n.x) < 1.65 && Math.abs(n.z) < 2.2) {
        n.active = false;
        n.group.visible = false;
        this.nitro = Math.min(100, this.nitro + 38);
        audioEngine.playNitroBurst();
        this.spawnParticles(this.playerX, 1.0, -0.5, 0x0ea5e9, 10, 6);
        this.triggerFeedback(this.lang === 'fa' ? 'شارژ نیترو +۳۸٪!' : 'NITRO +38%!', '#38bdf8');
      } else if (n.z > 18) {
        n.active = false;
        n.group.visible = false;
      }
    }

    this.updateParticles(dt);

    // Dynamic Multi-Angle Camera (Chase / Action Low / Hood / Cockpit Interior!)
    const baseFov =
      this.cameraMode === 'cockpit'
        ? 66
        : this.cameraMode === 'hood'
        ? 68
        : this.cameraMode === 'low'
        ? 64
        : 60;
    const targetFov =
      baseFov +
      Math.min(10, Math.max(0, this.playerSpeed - 20) * 0.22) +
      (isSuperBoosted ? 9.5 : 0) +
      (this.drafting ? 3.5 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    if (this.cameraMode === 'cockpit') {
      const co = this.playerCar.cockpitCameraOffset;
      _camTargetPos.set(this.playerX + co.x, co.y + 0.04, co.z + 0.28);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 22, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 22, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 22, dt);
      this.updateShakeCamera(dt);
      const lookCurveX = getCurveOffsetX(-34, this.curveStrength) * 0.75;
      const lookHillY = getHillOffsetY(-34, this.hillStrength) * 0.55;
      _camLookAt.set(this.playerX + co.x + lookCurveX, co.y - 0.14 + lookHillY, -34);
      this.camera.lookAt(_camLookAt);
    } else if (this.cameraMode === 'hood') {
      _camTargetPos.set(this.playerX, 1.48, -0.55);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 18, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 18, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 18, dt);
      this.updateShakeCamera(dt);
      const lookCurveX = getCurveOffsetX(-32, this.curveStrength) * 0.72;
      const lookHillY = getHillOffsetY(-32, this.hillStrength) * 0.55;
      _camLookAt.set(this.playerX + lookCurveX, 1.25 + lookHillY, -32);
      this.camera.lookAt(_camLookAt);
    } else if (this.cameraMode === 'low') {
      _camTargetPos.set(
        this.playerX * 0.78 - this.curveStrength * 0.35,
        2.55,
        6.35 + (isSuperBoosted ? 0.55 : 0)
      );
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 10, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 10, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 10, dt);
      this.updateShakeCamera(dt);
      const lookCurveX = getCurveOffsetX(-24, this.curveStrength) * 0.65;
      const lookHillY = getHillOffsetY(-24, this.hillStrength) * 0.5;
      _camLookAt.set(this.playerX * 0.9 + lookCurveX, 1.15 + lookHillY, -22);
      this.camera.lookAt(_camLookAt);
    } else {
      _camTargetPos.set(
        this.playerX * 0.68 - this.curveStrength * 0.45,
        4.15,
        8.25 + (isSuperBoosted ? 0.7 : 0)
      );
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 8, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 8, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 8, dt);
      this.updateShakeCamera(dt);
      const lookCurveX = getCurveOffsetX(-22, this.curveStrength) * 0.65;
      const lookHillY = getHillOffsetY(-22, this.hillStrength) * 0.5;
      _camLookAt.set(this.playerX * 0.84 + lookCurveX, 1.35 + lookHillY, -19);
      this.camera.lookAt(_camLookAt);
    }

    const speedRatio = this.playerSpeed / Math.max(1, this.baseMaxSpeed);
    audioEngine.updateEngine(speedRatio, isSuperBoosted, this.input.brake);

    if (this.raceConfig.mode === 'level' && lvl) {
      this.evaluateLevelMission(lvl);
    }

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.05) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private evaluateLevelMission(lvl: NonNullable<ActiveRaceConfig['levelConfig']>): void {
    const current = this.getMissionCurrentValue(lvl.missionType);
    if (current >= lvl.target) {
      this.raceFinished = true;
      audioEngine.stopEngineLoop();
      audioEngine.playRewardFanfare();
      this.spawnParticles(this.playerX, 1.8, -1, 0xfacc15, 22, 10);

      let stars = 1;
      if (
        lvl.missionType === 'distance' ||
        lvl.missionType === 'checkpoints' ||
        lvl.missionType === 'noHit' ||
        lvl.missionType === 'rivals'
      ) {
        if (this.raceTime <= lvl.star3Target) stars = 3;
        else if (this.raceTime <= lvl.star2Target) stars = 2;
      } else {
        if (current >= lvl.star3Target || this.coinsCollected >= 30 || this.overtakes >= 6) {
          stars = 3;
        } else if (
          current >= lvl.star2Target ||
          this.raceTime < (lvl.timeLimitSec ?? 99) * 0.72
        ) {
          stars = 2;
        }
      }

      const starMultiplier = stars === 3 ? 1.5 : stars === 2 ? 1.2 : 1.0;
      const bonus = Math.round((lvl.rewardCoins * starMultiplier) / 10) * 10;

      this.emitHud();
      this.callbacks.onRaceEnd({
        mode: 'level',
        environment: this.raceConfig!.environment,
        levelId: lvl.id,
        won: true,
        starsEarned: stars,
        score: Math.floor(this.score),
        distanceM: Math.floor(this.distanceM),
        coinsCollected: this.coinsCollected,
        missionBonusCoins: bonus,
        overtakes: this.overtakes,
        rivalsDefeated: this.rivalsDefeated,
        nitroUses: this.nitroUses,
        peakSpeedKmh: Math.round(this.peakSpeedKmh),
        timeElapsed: this.raceTime,
        isNewBestScore: false,
        isNewBestDistance: false,
        canRevive: false,
      });
      return;
    }

    if (lvl.timeLimitSec && this.raceTime >= lvl.timeLimitSec) {
      this.raceFinished = true;
      audioEngine.stopEngineLoop();
      audioEngine.playCrash();
      this.emitHud();
      this.callbacks.onRaceEnd({
        mode: 'level',
        environment: this.raceConfig!.environment,
        levelId: lvl.id,
        won: false,
        starsEarned: 0,
        score: Math.floor(this.score),
        distanceM: Math.floor(this.distanceM),
        coinsCollected: this.coinsCollected,
        missionBonusCoins: 0,
        overtakes: this.overtakes,
        rivalsDefeated: this.rivalsDefeated,
        nitroUses: this.nitroUses,
        peakSpeedKmh: Math.round(this.peakSpeedKmh),
        timeElapsed: this.raceTime,
        isNewBestScore: false,
        isNewBestDistance: false,
        canRevive: false,
        failReason: 'timeout',
      });
    }
  }

  private getMissionCurrentValue(
    type: NonNullable<ActiveRaceConfig['levelConfig']>['missionType']
  ): number {
    switch (type) {
      case 'coins':
        return this.coinsCollected;
      case 'distance':
      case 'noHit':
        return Math.floor(this.distanceM);
      case 'survive':
        return Math.floor(this.raceTime);
      case 'overtakes':
        return this.overtakes;
      case 'checkpoints':
        return this.checkpointsPassed;
      case 'topSpeed':
        return Math.round(this.peakSpeedKmh);
      case 'nitroDistance':
        return Math.floor(this.nitroDistanceM);
      case 'rivals':
        return this.rivalsDefeated;
    }
  }

  private handlePlayerCrash(impactX: number, impactZ: number): void {
    this.hitsTaken++;
    this.raceFinished = true;
    this.hitstopTimer = 0.055;
    this.shakeIntensity = 0.85;
    this.impactPostPulse = 1.0;
    this.crashFreezeTimer = 0.65;
    audioEngine.stopEngineLoop();
    audioEngine.playCrash();

    this.spawnParticles((this.playerX + impactX) * 0.5, 1.0, impactZ * 0.5, 0xf97316, 18, 12);
    this.spawnParticles((this.playerX + impactX) * 0.5, 1.2, impactZ * 0.5, 0xfacc15, 12, 10);

    if (this.playerCar) {
      this.playerCar.bodyGroup.rotation.z = (this.playerX < impactX ? 1 : -1) * 0.25;
      this.playerCar.bodyGroup.rotation.x = 0.14;
      this.playerCar.nitroFlames.forEach((f) => (f.visible = false));
    }

    const lvl = this.raceConfig?.levelConfig;
    const isNoHit = lvl?.missionType === 'noHit';

    this.pendingCrashResult = {
      mode: this.raceConfig!.mode,
      environment: this.raceConfig!.environment,
      levelId: lvl?.id,
      won: false,
      starsEarned: 0,
      score: Math.floor(this.score),
      distanceM: Math.floor(this.distanceM),
      coinsCollected: this.coinsCollected,
      missionBonusCoins: 0,
      overtakes: this.overtakes,
      rivalsDefeated: this.rivalsDefeated,
      nitroUses: this.nitroUses,
      peakSpeedKmh: Math.round(this.peakSpeedKmh),
      timeElapsed: this.raceTime,
      isNewBestScore: false,
      isNewBestDistance: false,
      canRevive: !this.reviveUsed && !isNoHit,
      failReason: isNoHit ? 'hit' : 'crash',
    };
    this.emitHud();
  }

  private updateParticles(dt: number): void {
    for (const p of this.particlePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.1, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      const ratio = p.life / p.maxLife;
      p.mesh.scale.setScalar(ratio * 1.15);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.85;
    }
  }

  private updateShakeCamera(dt: number): void {
    if (this.shakeIntensity > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.8;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 8, dt);
    }
  }

  private updateShowcase(dt: number): void {
    if (!this.playerCar || !this.worldRig) return;

    if (this.viewMode === 'garage') {
      if (!this.isDraggingTurntable) {
        this.targetShowcaseAngle += dt * 0.42;
      }
      this.showcaseAngle = THREE.MathUtils.damp(
        this.showcaseAngle,
        this.targetShowcaseAngle,
        9,
        dt
      );
      this.playerCar.root.rotation.y = this.showcaseAngle;
      this.garageTurntable.rotation.y = this.showcaseAngle;

      // Smoothly animate car doors (swing or hypercar scissor!) + warm cabin interior dome light!
      const targetDoorP = this.doorsOpen && this.playerCar.doorStyle !== 'none' ? 1 : 0;
      this.doorOpenProgress = THREE.MathUtils.damp(this.doorOpenProgress, targetDoorP, 6.5, dt);
      const p = this.doorOpenProgress;
      if (this.playerCar.leftDoorPivot && this.playerCar.rightDoorPivot) {
        if (this.playerCar.doorStyle === 'scissor') {
          this.playerCar.leftDoorPivot.rotation.set(-0.96 * p, -0.22 * p, 0);
          this.playerCar.rightDoorPivot.rotation.set(-0.96 * p, 0.22 * p, 0);
        } else {
          this.playerCar.leftDoorPivot.rotation.set(0, -1.08 * p, 0);
          this.playerCar.rightDoorPivot.rotation.set(0, 1.08 * p, 0);
        }
      }
      if (this.playerCar.cabinLight) {
        this.playerCar.cabinLight.intensity = 0.65 + p * 2.4;
      }
      // Gentle showroom life: steering wheel & driver head subtly glance around
      this.playerCar.steeringWheel.rotation.z = Math.sin(this.elapsedTotal * 0.9) * 0.25;
      this.playerCar.driverHead.rotation.y = Math.sin(this.elapsedTotal * 0.75) * 0.22;

      // Optical vertical framing: lift the car cleanly into the open showroom stage above the dealership dock
      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      const aspect = w / h;
      const targetOffsetNorm = this.garageDockOpen ? (h < 580 ? 0.17 : 0.145) : 0;
      this.garageViewOffsetNorm = THREE.MathUtils.damp(
        this.garageViewOffsetNorm,
        targetOffsetNorm,
        8,
        dt
      );

      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 40, 7, dt);
      if (Math.abs(this.garageViewOffsetNorm) > 0.001) {
        this.camera.setViewOffset(w, h, 0, Math.round(h * this.garageViewOffsetNorm), w, h);
      } else {
        this.camera.clearViewOffset();
      }
      this.camera.updateProjectionMatrix();

      // Compute exact camera distance so the entire rotating vehicle fits horizontally & vertically with margin
      const tanHalfV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
      const tanHalfH = Math.max(0.18, tanHalfV * aspect);
      const halfSpanH = this.showcaseCarRadius + 0.55;
      const halfSpanV = this.showcaseCarHeight * 0.55 + 0.45;
      const horizFill = aspect < 1 ? 0.82 : 0.66;
      const vertFill = this.garageDockOpen ? 0.42 : 0.64;
      const distH = halfSpanH / (tanHalfH * horizFill);
      const distV = halfSpanV / (tanHalfV * vertFill);
      const camDist = THREE.MathUtils.clamp(
        Math.max(distH, distV, this.garageDockOpen ? 8.3 : 6.9),
        6.8,
        18.5
      );
      const camY = this.showcaseCarCenterY + camDist * 0.22;

      _camTargetPos.set(0, camY, camDist);
      this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-7 * dt));
      _camLookAt.set(0, this.showcaseCarCenterY, 0);
      this.camera.lookAt(_camLookAt);
    } else {
      if (Math.abs(this.garageViewOffsetNorm) > 0.001) {
        this.garageViewOffsetNorm = THREE.MathUtils.damp(this.garageViewOffsetNorm, 0, 8, dt);
        const w = Math.max(1, this.container.clientWidth || window.innerWidth);
        const h = Math.max(1, this.container.clientHeight || window.innerHeight);
        if (Math.abs(this.garageViewOffsetNorm) > 0.001) {
          this.camera.setViewOffset(w, h, 0, Math.round(h * this.garageViewOffsetNorm), w, h);
        } else {
          this.garageViewOffsetNorm = 0;
          this.camera.clearViewOffset();
        }
      }

      const idleSpeed = 18;
      const texScroll = (idleSpeed * dt * 14) / ROAD_LENGTH;
      this.worldRig.roadTextures.map.offset.y =
        (this.worldRig.roadTextures.map.offset.y + texScroll) % 1;
      this.worldRig.roadTextures.roughnessMap.offset.y = this.worldRig.roadTextures.map.offset.y;
      this.worldRig.roadTextures.bumpMap.offset.y = this.worldRig.roadTextures.map.offset.y;
      this.worldRig.terrainTexture.offset.y =
        (this.worldRig.terrainTexture.offset.y +
          (idleSpeed * dt * 22) / (ROAD_LENGTH + 180)) %
        1;
      for (const lamp of this.worldRig.roadSideFurniture) {
        lamp.position.z += idleSpeed * dt;
        if (lamp.position.z > 28) lamp.position.z -= 240;
      }
      for (const gantry of this.worldRig.gantries) {
        gantry.position.z += idleSpeed * dt;
        if (gantry.position.z > 26) gantry.position.z -= 246;
      }
      for (const prop of this.worldRig.props) {
        prop.position.z += idleSpeed * dt;
        if (prop.position.z > 32) prop.position.z -= 245;
      }
      this.updateSpectators(dt, idleSpeed, false);
      this.updateWeather(dt, idleSpeed);
      for (const w of this.playerCar.wheels) w.rotation.x -= idleSpeed * dt * 2.0;

      const orbit = Math.sin(this.elapsedTotal * 0.35) * 0.45 + 0.55;
      const camX = Math.sin(orbit) * 6.2;
      const camZ = Math.cos(orbit) * 6.5;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 50, 6, dt);
      this.camera.updateProjectionMatrix();
      _camTargetPos.set(camX, 2.55 + Math.sin(this.elapsedTotal * 0.7) * 0.16, camZ);
      this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-4 * dt));
      _camLookAt.set(0, 0.96, -0.5);
      this.camera.lookAt(_camLookAt);
      this.playerCar.root.rotation.y = 0;
    }

    for (const cloud of this.worldRig.clouds) {
      cloud.position.z += dt * 3.5;
      if (cloud.position.z > 40) cloud.position.z -= 240;
    }
  }

  private emitHud(): void {
    const lvl = this.raceConfig?.levelConfig;
    const missionCurrent = lvl
      ? this.getMissionCurrentValue(lvl.missionType)
      : Math.floor(this.distanceM);
    const missionTarget = lvl ? lvl.target : 0;
    const missionProgress = lvl ? Math.min(1, missionCurrent / Math.max(1, missionTarget)) : 0;

    this.callbacks.onHudUpdate({
      speedKmh: Math.round(this.playerSpeed * 3.6),
      maxSpeedKmh: Math.round(this.nitroMaxSpeed * 3.6),
      distanceM: Math.floor(this.distanceM),
      coinsCollected: this.coinsCollected,
      score: Math.floor(this.score),
      overtakes: this.overtakes,
      combo: this.combo,
      nitro: Math.round(this.nitro),
      nitroActive: this.nitroActive || this.padBoostTimer > 0,
      timeElapsed: this.raceTime,
      timeRemaining: lvl?.timeLimitSec ? Math.max(0, lvl.timeLimitSec - this.raceTime) : null,
      checkpointsPassed: this.checkpointsPassed,
      nitroDistanceM: Math.floor(this.nitroDistanceM),
      peakSpeedKmh: Math.round(this.peakSpeedKmh),
      hitsTaken: this.hitsTaken,
      missionProgress,
      missionCurrent,
      missionTarget,
      feedbackText: this.feedbackText,
      feedbackColor: this.feedbackColor,
      feedbackId: this.feedbackId,
      shieldActive: this.shieldTimer > 0,
      drafting: this.drafting,
      feverActive: this.combo >= 4,
      rivalAheadDist: this.rivalAheadDist,
      rivalsDefeated: this.rivalsDefeated,
      cameraMode: this.cameraMode,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.destroyed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (now = performance.now()): void => {
    if (this.destroyed) return;
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.elapsedTotal += dt;

    if (this.viewMode === 'racing') {
      this.updateRacing(dt);
    } else {
      this.updateShowcase(dt);
    }

    if (this.impactPostPulse > 0.001) {
      this.impactPostPulse = THREE.MathUtils.damp(this.impactPostPulse, 0, 5.5, dt);
    }

    const isRacingActive = this.viewMode === 'racing' && !this.paused && !this.raceFinished;
    const isBoosted = isRacingActive && (this.nitroActive || this.padBoostTimer > 0);
    const speedNorm = isRacingActive
      ? THREE.MathUtils.clamp((this.playerSpeed - 18) / Math.max(1, this.nitroMaxSpeed - 18), 0, 1)
      : 0;

    this.postProcessor.update(dt, {
      nitroFactor: isBoosted ? 1 : 0,
      speedFactor: speedNorm,
      feverFactor: isRacingActive && this.combo >= 4 ? 1 : 0,
      impactPulse: this.impactPostPulse,
      isGarage: this.viewMode === 'garage',
      time: this.elapsedTotal,
    });

    this.postProcessor.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick(performance.now()));
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handleResize = (): void => {
    if (this.destroyed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postProcessor.resize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.viewMode !== 'racing') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') this.input.brake = true;
    if (
      e.code === 'Space' ||
      e.code === 'ShiftLeft' ||
      e.code === 'ShiftRight' ||
      e.code === 'ArrowUp' ||
      e.code === 'KeyW'
    ) {
      this.input.nitro = true;
    }
    if (e.code === 'KeyC' && !e.repeat) {
      this.cycleCameraMode();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') this.input.brake = false;
    if (
      e.code === 'Space' ||
      e.code === 'ShiftLeft' ||
      e.code === 'ShiftRight' ||
      e.code === 'ArrowUp' ||
      e.code === 'KeyW'
    ) {
      this.input.nitro = false;
    }
  };

  private handleWindowBlur = (): void => {
    this.resetInputs();
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.viewMode === 'garage') {
      this.isDraggingTurntable = true;
      this.lastPointerX = e.clientX;
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.viewMode === 'garage' && this.isDraggingTurntable) {
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.targetShowcaseAngle += dx * 0.012;
    }
  };

  private handlePointerUp = (): void => {
    this.isDraggingTurntable = false;
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
  }

  public dispose(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    audioEngine.stopEngineLoop();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.worldRig?.disposables.forEach((d) => d.dispose());
    this.shadowTexture.dispose();
    this.tireTreadTexture.dispose();
    this.carbonTexture.dispose();
    this.boostPadTexture.dispose();
    this.postProcessor.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    _colorTmp.setHex(0xffffff);
  }
}
