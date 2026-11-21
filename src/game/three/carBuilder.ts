import * as THREE from 'three';
import type { CarArchetype, CarRimColor, CarRimStyle, CarSpoilerStyle, CarVisualStyle } from '../types';
import { DriverSkeletalController, type DriverSkeletonRig } from './driverAnimator';
import { buildSeatedDriver } from './humanBuilder';
import {
  createDashboardTexture,
  createHoneycombGrilleTexture,
  createLicensePlateTexture,
} from './textures';

export interface BuiltCarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Object3D[];
  frontWheelPivots: THREE.Object3D[];
  nitroFlames: THREE.Mesh[];
  brakeLights: THREE.Mesh[];
  headlightBeams: THREE.Mesh[];
  paintMaterials: THREE.MeshPhysicalMaterial[];
  shieldMesh: THREE.Mesh;
  steeringWheel: THREE.Object3D;
  leftGripTarget: THREE.Object3D;
  rightGripTarget: THREE.Object3D;
  driverHead: THREE.Object3D;
  driverAnchor: THREE.Group;
  driverScale: number;
  driverRig: DriverSkeletonRig;
  driverAnimator: DriverSkeletalController;
  leftDoorPivot: THREE.Object3D | null;
  rightDoorPivot: THREE.Object3D | null;
  doorStyle: 'swing' | 'scissor' | 'none';
  cabinLight: THREE.PointLight | null;
  cockpitCameraOffset: THREE.Vector3;
}

interface SculptedCarSpec {
  width: number;
  length: number;
  rideHeight: number;
  bodyProfile: [number, number][];
  cabinProfile: [number, number][];
  cabinWidthFactor: number;
  wheelRadius: number;
  wheelWidth: number;
  frontWheelZ: number;
  rearWheelZ: number;
  openWheel?: boolean;
  spoiler: CarSpoilerStyle;
  racingStripe?: boolean;
  blower?: boolean;
  roofRack?: boolean;
  bullbar?: boolean;
  fogLights?: boolean;
  rollCage?: boolean;
  sideIntakes?: boolean;
  quadExhaust?: boolean;
  pickupBed?: boolean;
  haloCockpit?: boolean;
  openTop?: boolean;
  liftedSuspension?: boolean;
  rearLouvers?: boolean;
}

const CAR_SPECS: Record<CarArchetype, SculptedCarSpec> = {
  hatch: {
    width: 1.96,
    length: 3.92,
    rideHeight: 0.25,
    bodyProfile: [
      [-1.92, 0.04], [1.88, 0.04], [1.96, 0.25], [1.9, 0.72], [1.58, 0.84],
      [-0.78, 0.79], [-1.56, 0.62], [-1.92, 0.38], [-1.96, 0.14],
    ],
    cabinProfile: [
      [-0.92, 0.72], [1.56, 0.74], [1.34, 1.38], [0.92, 1.46], [-0.32, 1.44], [-0.76, 1.12],
    ],
    cabinWidthFactor: 0.78,
    wheelRadius: 0.41,
    wheelWidth: 0.32,
    frontWheelZ: -1.18,
    rearWheelZ: 1.2,
    spoiler: 'lip',
  },
  sedan: {
    width: 2.02,
    length: 4.44,
    rideHeight: 0.23,
    bodyProfile: [
      [-2.16, 0.03], [2.14, 0.03], [2.22, 0.24], [2.18, 0.72], [1.4, 0.8],
      [-0.98, 0.76], [-1.84, 0.62], [-2.18, 0.38], [-2.22, 0.13],
    ],
    cabinProfile: [
      [-1.02, 0.68], [1.38, 0.7], [0.96, 1.32], [0.64, 1.38], [-0.4, 1.37], [-0.88, 1.04],
    ],
    cabinWidthFactor: 0.77,
    wheelRadius: 0.42,
    wheelWidth: 0.34,
    frontWheelZ: -1.35,
    rearWheelZ: 1.35,
    spoiler: 'lip',
    racingStripe: true,
  },
  coupe: {
    width: 2.12,
    length: 4.48,
    rideHeight: 0.2,
    bodyProfile: [
      [-2.18, 0.02], [2.14, 0.02], [2.24, 0.24], [2.18, 0.7], [1.48, 0.78],
      [-1.0, 0.7], [-1.88, 0.54], [-2.22, 0.32], [-2.24, 0.1],
    ],
    cabinProfile: [
      [-0.96, 0.62], [1.62, 0.66], [0.96, 1.22], [0.46, 1.28], [-0.38, 1.26], [-0.88, 0.9],
    ],
    cabinWidthFactor: 0.75,
    wheelRadius: 0.43,
    wheelWidth: 0.36,
    frontWheelZ: -1.36,
    rearWheelZ: 1.36,
    spoiler: 'lip',
    racingStripe: true,
    sideIntakes: true,
  },
  muscle: {
    width: 2.2,
    length: 4.72,
    rideHeight: 0.22,
    bodyProfile: [
      [-2.3, 0.02], [2.26, 0.02], [2.34, 0.24], [2.32, 0.76], [1.58, 0.82],
      [-0.8, 0.8], [-2.2, 0.72], [-2.34, 0.46], [-2.34, 0.14],
    ],
    cabinProfile: [
      [-0.76, 0.74], [1.76, 0.74], [1.08, 1.28], [0.58, 1.34], [-0.22, 1.33], [-0.66, 1.0],
    ],
    cabinWidthFactor: 0.76,
    wheelRadius: 0.45,
    wheelWidth: 0.42,
    frontWheelZ: -1.44,
    rearWheelZ: 1.44,
    spoiler: 'lip',
    blower: true,
    racingStripe: true,
    quadExhaust: true,
  },
  offroad: {
    width: 2.18,
    length: 4.5,
    rideHeight: 0.44,
    bodyProfile: [
      [-2.14, 0.08], [2.1, 0.08], [2.2, 0.34], [2.16, 0.92], [1.96, 0.96],
      [-0.88, 0.94], [-2.06, 0.88], [-2.2, 0.62], [-2.2, 0.24],
    ],
    cabinProfile: [
      [-0.92, 0.86], [1.98, 0.88], [1.88, 1.68], [-0.52, 1.68], [-0.84, 1.24],
    ],
    cabinWidthFactor: 0.82,
    wheelRadius: 0.56,
    wheelWidth: 0.44,
    frontWheelZ: -1.36,
    rearWheelZ: 1.36,
    spoiler: 'none',
    roofRack: true,
    bullbar: true,
  },
  pickup: {
    width: 2.22,
    length: 4.92,
    rideHeight: 0.4,
    bodyProfile: [
      [-2.38, 0.08], [2.36, 0.08], [2.44, 0.32], [2.42, 0.9], [0.7, 0.88],
      [-1.12, 0.88], [-2.26, 0.82], [-2.42, 0.54], [-2.42, 0.22],
    ],
    cabinProfile: [
      [-1.14, 0.82], [0.58, 0.82], [0.5, 1.6], [-0.66, 1.6], [-1.02, 1.18],
    ],
    cabinWidthFactor: 0.8,
    wheelRadius: 0.54,
    wheelWidth: 0.44,
    frontWheelZ: -1.5,
    rearWheelZ: 1.48,
    spoiler: 'none',
    bullbar: true,
    pickupBed: true,
  },
  rally: {
    width: 2.14,
    length: 4.38,
    rideHeight: 0.24,
    bodyProfile: [
      [-2.12, 0.04], [2.08, 0.04], [2.16, 0.26], [2.12, 0.74], [1.46, 0.82],
      [-0.96, 0.78], [-1.78, 0.64], [-2.12, 0.42], [-2.16, 0.16],
    ],
    cabinProfile: [
      [-0.96, 0.72], [1.4, 0.74], [1.1, 1.36], [0.7, 1.42], [-0.36, 1.4], [-0.84, 1.06],
    ],
    cabinWidthFactor: 0.78,
    wheelRadius: 0.44,
    wheelWidth: 0.37,
    frontWheelZ: -1.32,
    rearWheelZ: 1.32,
    spoiler: 'rally',
    fogLights: true,
    racingStripe: true,
  },
  buggy: {
    width: 2.18,
    length: 4.18,
    rideHeight: 0.38,
    bodyProfile: [
      [-2.04, 0.1], [1.96, 0.1], [2.06, 0.42], [1.74, 0.84], [0.68, 0.78],
      [-0.78, 0.66], [-1.7, 0.48], [-2.06, 0.28],
    ],
    cabinProfile: [
      [-0.72, 0.62], [1.24, 0.74], [0.92, 1.34], [-0.14, 1.32], [-0.62, 0.92],
    ],
    cabinWidthFactor: 0.68,
    wheelRadius: 0.52,
    wheelWidth: 0.42,
    frontWheelZ: -1.36,
    rearWheelZ: 1.34,
    openWheel: true,
    spoiler: 'rally',
    rollCage: true,
  },
  gt: {
    width: 2.26,
    length: 4.74,
    rideHeight: 0.17,
    bodyProfile: [
      [-2.32, 0.02], [2.26, 0.02], [2.36, 0.22], [2.3, 0.7], [1.56, 0.78],
      [-1.08, 0.68], [-2.02, 0.5], [-2.34, 0.28], [-2.36, 0.08],
    ],
    cabinProfile: [
      [-1.04, 0.62], [1.62, 0.66], [0.88, 1.18], [0.34, 1.24], [-0.4, 1.22], [-0.94, 0.86],
    ],
    cabinWidthFactor: 0.74,
    wheelRadius: 0.45,
    wheelWidth: 0.42,
    frontWheelZ: -1.44,
    rearWheelZ: 1.44,
    spoiler: 'gt',
    racingStripe: true,
    sideIntakes: true,
    quadExhaust: true,
  },
  formula: {
    width: 2.3,
    length: 4.88,
    rideHeight: 0.14,
    bodyProfile: [
      [-2.42, 0.02], [2.26, 0.02], [2.36, 0.28], [2.16, 0.62], [1.14, 0.68],
      [-0.64, 0.56], [-1.96, 0.36], [-2.44, 0.16],
    ],
    cabinProfile: [
      [-0.56, 0.5], [1.34, 0.64], [0.96, 1.0], [0.22, 0.94], [-0.46, 0.68],
    ],
    cabinWidthFactor: 0.44,
    wheelRadius: 0.44,
    wheelWidth: 0.46,
    frontWheelZ: -1.52,
    rearWheelZ: 1.42,
    openWheel: true,
    spoiler: 'formula',
    haloCockpit: true,
  },
  hyper: {
    width: 2.34,
    length: 4.88,
    rideHeight: 0.15,
    bodyProfile: [
      [-2.4, 0.01], [2.32, 0.01], [2.42, 0.22], [2.36, 0.66], [1.46, 0.76],
      [-1.18, 0.6], [-2.12, 0.42], [-2.42, 0.2], [-2.44, 0.05],
    ],
    cabinProfile: [
      [-1.14, 0.56], [1.56, 0.64], [0.76, 1.12], [0.2, 1.16], [-0.52, 1.14], [-1.06, 0.78],
    ],
    cabinWidthFactor: 0.7,
    wheelRadius: 0.45,
    wheelWidth: 0.44,
    frontWheelZ: -1.48,
    rearWheelZ: 1.46,
    spoiler: 'gt',
    sideIntakes: true,
    quadExhaust: true,
  },
  jdm: {
    width: 2.22,
    length: 4.54,
    rideHeight: 0.17,
    bodyProfile: [
      [-2.24, 0.02], [2.18, 0.02], [2.28, 0.23], [2.22, 0.7], [1.46, 0.78],
      [-0.98, 0.7], [-1.92, 0.56], [-2.24, 0.34], [-2.28, 0.1],
    ],
    cabinProfile: [
      [-0.96, 0.64], [1.48, 0.68], [0.96, 1.24], [0.46, 1.3], [-0.36, 1.28], [-0.88, 0.92],
    ],
    cabinWidthFactor: 0.74,
    wheelRadius: 0.43,
    wheelWidth: 0.4,
    frontWheelZ: -1.38,
    rearWheelZ: 1.38,
    spoiler: 'gt',
    sideIntakes: true,
    quadExhaust: true,
  },
  roadster: {
    width: 2.18,
    length: 4.46,
    rideHeight: 0.18,
    bodyProfile: [
      [-2.2, 0.02], [2.14, 0.02], [2.24, 0.24], [2.18, 0.68], [1.44, 0.76],
      [-0.96, 0.68], [-1.86, 0.52], [-2.2, 0.3], [-2.24, 0.09],
    ],
    cabinProfile: [
      [-0.94, 0.64], [-0.26, 0.66], [-0.52, 1.1], [-0.82, 0.94],
    ],
    cabinWidthFactor: 0.72,
    wheelRadius: 0.43,
    wheelWidth: 0.38,
    frontWheelZ: -1.36,
    rearWheelZ: 1.36,
    spoiler: 'ducktail',
    openTop: true,
    sideIntakes: true,
  },
  modernMuscle: {
    width: 2.26,
    length: 4.76,
    rideHeight: 0.2,
    bodyProfile: [
      [-2.34, 0.02], [2.3, 0.02], [2.38, 0.25], [2.34, 0.78], [1.56, 0.84],
      [-0.86, 0.8], [-2.14, 0.68], [-2.36, 0.42], [-2.38, 0.12],
    ],
    cabinProfile: [
      [-0.84, 0.72], [1.74, 0.74], [1.06, 1.28], [0.54, 1.34], [-0.28, 1.32], [-0.74, 0.98],
    ],
    cabinWidthFactor: 0.75,
    wheelRadius: 0.45,
    wheelWidth: 0.43,
    frontWheelZ: -1.46,
    rearWheelZ: 1.44,
    spoiler: 'ducktail',
    quadExhaust: true,
    rearLouvers: true,
  },
  suv: {
    width: 2.26,
    length: 4.78,
    rideHeight: 0.34,
    bodyProfile: [
      [-2.32, 0.05], [2.28, 0.05], [2.38, 0.3], [2.34, 0.9], [1.76, 0.96],
      [-0.98, 0.92], [-2.06, 0.76], [-2.34, 0.48], [-2.38, 0.18],
    ],
    cabinProfile: [
      [-1.0, 0.84], [1.86, 0.86], [1.34, 1.54], [0.68, 1.62], [-0.46, 1.58], [-0.88, 1.18],
    ],
    cabinWidthFactor: 0.8,
    wheelRadius: 0.52,
    wheelWidth: 0.42,
    frontWheelZ: -1.44,
    rearWheelZ: 1.44,
    spoiler: 'lip',
    quadExhaust: true,
  },
  monster: {
    width: 2.52,
    length: 4.96,
    rideHeight: 0.76,
    bodyProfile: [
      [-2.38, 0.08], [2.36, 0.08], [2.46, 0.34], [2.42, 0.94], [0.74, 0.92],
      [-1.14, 0.92], [-2.28, 0.84], [-2.44, 0.56], [-2.44, 0.24],
    ],
    cabinProfile: [
      [-1.16, 0.86], [0.62, 0.86], [0.54, 1.66], [-0.66, 1.66], [-1.04, 1.22],
    ],
    cabinWidthFactor: 0.74,
    wheelRadius: 0.72,
    wheelWidth: 0.58,
    frontWheelZ: -1.52,
    rearWheelZ: 1.5,
    spoiler: 'none',
    bullbar: true,
    pickupBed: true,
    liftedSuspension: true,
  },
  prototype: {
    width: 2.38,
    length: 5.0,
    rideHeight: 0.14,
    bodyProfile: [
      [-2.46, 0.01], [2.38, 0.01], [2.48, 0.2], [2.42, 0.6], [1.44, 0.7],
      [-1.24, 0.56], [-2.18, 0.4], [-2.48, 0.18], [-2.5, 0.05],
    ],
    cabinProfile: [
      [-1.18, 0.5], [1.48, 0.6], [0.7, 1.1], [0.16, 1.14], [-0.56, 1.1], [-1.1, 0.74],
    ],
    cabinWidthFactor: 0.52,
    wheelRadius: 0.45,
    wheelWidth: 0.46,
    frontWheelZ: -1.54,
    rearWheelZ: 1.5,
    spoiler: 'gt',
    sideIntakes: true,
    quadExhaust: true,
  },
  crown: {
    width: 2.36,
    length: 4.92,
    rideHeight: 0.16,
    bodyProfile: [
      [-2.42, 0.01], [2.34, 0.01], [2.44, 0.24], [2.38, 0.68], [1.48, 0.78],
      [-1.18, 0.62], [-2.12, 0.44], [-2.44, 0.22], [-2.46, 0.06],
    ],
    cabinProfile: [
      [-1.14, 0.58], [1.62, 0.66], [0.8, 1.16], [0.22, 1.2], [-0.5, 1.18], [-1.06, 0.8],
    ],
    cabinWidthFactor: 0.72,
    wheelRadius: 0.46,
    wheelWidth: 0.45,
    frontWheelZ: -1.5,
    rearWheelZ: 1.48,
    spoiler: 'crown',
    racingStripe: true,
    sideIntakes: true,
    quadExhaust: true,
  },
};

// ============================================================================
// PARAMETRIC 3D AUTOMOTIVE SURFACING ENGINE
// True compound-curved bodywork, carved circular wheel arches, flared haunches,
// open-sided curved glass greenhouses, connected A/B/C pillars & Lathe tires.
// ============================================================================

interface ProfileSampler {
  minZ: number;
  maxZ: number;
  sample: (z: number) => { topY: number; botY: number };
}

function createProfileSampler(profile: [number, number][]): ProfileSampler {
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [z] of profile) {
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const rawSample = (z: number): { topY: number; botY: number } => {
    const cz = THREE.MathUtils.clamp(z, minZ + 0.0005, maxZ - 0.0005);
    let topY = -Infinity;
    let botY = Infinity;
    const n = profile.length;
    for (let i = 0; i < n; i++) {
      const [z1, y1] = profile[i];
      const [z2, y2] = profile[(i + 1) % n];
      const lo = Math.min(z1, z2);
      const hi = Math.max(z1, z2);
      if (cz >= lo - 1e-5 && cz <= hi + 1e-5) {
        const dz = z2 - z1;
        const y = Math.abs(dz) < 1e-5 ? (y1 + y2) * 0.5 : y1 + ((cz - z1) / dz) * (y2 - y1);
        if (y > topY) topY = y;
        if (y < botY) botY = y;
      }
    }
    if (!Number.isFinite(topY) || !Number.isFinite(botY)) {
      return { topY: 0.5, botY: 0.04 };
    }
    return { topY, botY };
  };

  // Gentle 5-tap smoothing kernel turns polygon vertices into organic automotive bodywork
  const sample = (z: number): { topY: number; botY: number } => {
    const span = maxZ - minZ;
    const edgeDist = Math.min(z - minZ, maxZ - z);
    const radius = Math.min(0.095, edgeDist * 0.45, span * 0.025);
    if (radius < 0.004) return rawSample(z);

    const offsets = [-radius, -radius * 0.5, 0, radius * 0.5, radius];
    const weights = [0.12, 0.22, 0.32, 0.22, 0.12];
    let tSum = 0;
    let bSum = 0;
    for (let i = 0; i < 5; i++) {
      const s = rawSample(z + offsets[i]);
      tSum += s.topY * weights[i];
      bSum += s.botY * weights[i];
    }
    return { topY: tSum, botY: bSum };
  };

  return { minZ, maxZ, sample };
}

interface BodyContourParams {
  bodyWidth: number;
  minZ: number;
  maxZ: number;
  frontWheelZ: number;
  rearWheelZ: number;
  wheelRadius: number;
  wheelWidth: number;
  rideHeight: number;
  openWheel: boolean;
  isFormula: boolean;
  isSporty: boolean;
  isBoxy: boolean;
  lifted: boolean;
}

function getPlanHalfWidthAt(z: number, p: BodyContourParams): number {
  const baseHalfW = p.bodyWidth * 0.5;
  const span = Math.max(0.1, p.maxZ - p.minZ);
  const u = THREE.MathUtils.clamp((z - p.minZ) / span, 0, 1);

  if (p.isFormula) {
    // True Formula 1 silhouette: narrow pointed nosecone -> wide sculpted sidepods -> tight coke-bottle rear
    if (u < 0.36) {
      const t = u / 0.36;
      return baseHalfW * THREE.MathUtils.lerp(0.19, 0.54, Math.pow(t, 0.85));
    }
    if (u < 0.54) {
      const t = (u - 0.36) / 0.18;
      const ease = t * t * (3 - 2 * t);
      return baseHalfW * THREE.MathUtils.lerp(0.54, 1.04, ease);
    }
    if (u < 0.78) {
      return baseHalfW * THREE.MathUtils.lerp(1.04, 0.92, (u - 0.54) / 0.24);
    }
    const t = (u - 0.78) / 0.22;
    return baseHalfW * THREE.MathUtils.lerp(0.92, 0.36, t * t);
  }

  let scale = 1.0;

  // Curved front bumper nose wrap
  const frontZone = p.isBoxy ? 0.08 : 0.15;
  if (u < frontZone) {
    const t = u / frontZone;
    const minTip = p.isBoxy ? 0.82 : p.isSporty ? 0.66 : 0.74;
    scale *= THREE.MathUtils.lerp(minTip, 1.0, Math.pow(Math.sin((t * Math.PI) * 0.5), 0.65));
  }

  // Curved rear bumper wrap
  const rearZone = p.isBoxy ? 0.06 : 0.12;
  if (u > 1 - rearZone) {
    const t = (1 - u) / rearZone;
    const minTail = p.isBoxy ? 0.88 : 0.78;
    scale *= THREE.MathUtils.lerp(minTail, 1.0, Math.pow(Math.sin((t * Math.PI) * 0.5), 0.6));
  }

  if (!p.openWheel) {
    // Muscular front & rear fender haunches + subtle coke-bottle waist tuck along the doors
    const archSpan = Math.max(0.42, p.wheelRadius * 1.32);
    const frontFlare = (p.isSporty ? 0.055 : p.isBoxy ? 0.025 : 0.032) *
      Math.exp(-Math.pow((z - p.frontWheelZ) / archSpan, 2));
    const rearFlare = (p.isSporty ? 0.082 : p.isBoxy ? 0.028 : 0.042) *
      Math.exp(-Math.pow((z - p.rearWheelZ) / (archSpan * 1.12), 2));
    const midZ = (p.frontWheelZ + p.rearWheelZ) * 0.5;
    const wb = Math.max(1.2, p.rearWheelZ - p.frontWheelZ);
    const waistTuck = (p.isSporty ? 0.052 : p.isBoxy ? 0.01 : 0.024) *
      Math.exp(-Math.pow((z - midZ) / (wb * 0.3), 2));
    scale *= 1.0 + frontFlare + rearFlare - waistTuck;
  }

  return baseHalfW * scale;
}

function buildSortedZStations(p: BodyContourParams, dense = true): number[] {
  const raw: number[] = [];
  const { minZ, maxZ, frontWheelZ, rearWheelZ, wheelRadius, openWheel, lifted } = p;
  const span = maxZ - minZ;

  // Nose curvature stations
  raw.push(minZ, minZ + span * 0.012, minZ + span * 0.035, minZ + span * 0.075, minZ + span * 0.12);
  // Tail curvature stations
  raw.push(maxZ - span * 0.11, maxZ - span * 0.065, maxZ - span * 0.03, maxZ - span * 0.01, maxZ);

  // Uniform backbone stations
  const baseSteps = dense ? 18 : 12;
  for (let i = 1; i < baseSteps; i++) {
    raw.push(minZ + (span * i) / baseSteps);
  }

  // Dense semicircular arch stations around both wheel wells for crisp circular cutouts
  if (!openWheel) {
    const archR = wheelRadius + (lifted ? 0.14 : 0.082);
    const archPts = dense ? 10 : 7;
    for (const wz of [frontWheelZ, rearWheelZ]) {
      raw.push(wz - archR * 1.18, wz - archR - 0.02, wz + archR + 0.02, wz + archR * 1.18);
      for (let k = 0; k <= archPts; k++) {
        const ang = (k / archPts) * Math.PI;
        const z = wz - Math.cos(ang) * archR;
        if (z > minZ + 0.02 && z < maxZ - 0.02) {
          raw.push(z);
        }
      }
    }
  }

  raw.sort((a, b) => a - b);
  const filtered: number[] = [];
  for (const z of raw) {
    const cz = THREE.MathUtils.clamp(z, minZ, maxZ);
    if (filtered.length === 0 || cz - filtered[filtered.length - 1] > 0.018) {
      filtered.push(cz);
    }
  }
  if (filtered[filtered.length - 1] < maxZ - 0.005) {
    filtered.push(maxZ);
  } else {
    filtered[filtered.length - 1] = maxZ;
  }
  return filtered;
}

/**
 * Generates a true 3D multi-section sculpted automotive body mesh with:
 * - Curved plan-view nose/tail taper, flared wheel-arch haunches & door waist tuck
 * - Sculpted tumblehome, crisp side shoulder character crease & hood crown
 * - Real circular wheel-arch cutouts carved cleanly out of the lower flanks
 * - Raised pontoon fenders over front/rear wheels on low-slung sports & hypercars
 */
function createSculptedCarBodyGeometry(
  profile: [number, number][],
  p: BodyContourParams,
  dense = true
): THREE.BufferGeometry {
  const sampler = createProfileSampler(profile);
  const zStations = buildSortedZStations(p, dense);
  const hubY = p.wheelRadius - p.rideHeight;
  const archR = p.wheelRadius + (p.lifted ? 0.14 : 0.082);

  // 16 cross-section ring points (clockwise when viewed from +Z: Top -> Right -> Bottom -> Left)
  const RING_SIZE = 16;
  const numRings = zStations.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const spanZ = Math.max(0.1, p.maxZ - p.minZ);

  const pushVert = (x: number, y: number, z: number, u: number, v: number) => {
    positions.push(x, y, z);
    uvs.push(u, v);
  };

  for (let i = 0; i < numRings; i++) {
    const z = zStations[i];
    const uNorm = (z - p.minZ) / spanZ;
    const { topY, botY } = sampler.sample(z);
    const hw = getPlanHalfWidthAt(z, p);

    // Evaluate circular wheel-arch cutout + smooth fender brow lift
    let archCutY = botY;
    let archFlare = 0;
    let fenderLiftY = topY;

    if (!p.openWheel) {
      for (const wz of [p.frontWheelZ, p.rearWheelZ]) {
        const dz = Math.abs(z - wz);
        if (dz < archR) {
          const sinTheta = Math.sqrt(Math.max(0, 1 - (dz / archR) * (dz / archR)));
          const arcY = hubY + archR * sinTheta;
          if (arcY > archCutY) archCutY = arcY;
          archFlare = Math.max(archFlare, (p.isSporty ? 0.036 : 0.022) * sinTheta);
        }
        // Smooth raised pontoon fender over wheels when the wheel arch exceeds low supercar hood height
        const browSpan = archR * 1.38;
        if (dz < browSpan) {
          const t = 1 - dz / browSpan;
          const smooth = t * t * (3 - 2 * t);
          const minBrowY = hubY + archR + 0.075;
          if (minBrowY > topY) {
            fenderLiftY = Math.max(fenderLiftY, THREE.MathUtils.lerp(topY, minBrowY, smooth));
          }
        }
      }
    }

    // Gentle transverse hood/trunk crown + sculpted power-dome on front hood
    const isHoodZone = z < p.frontWheelZ + p.wheelRadius * 1.1 && z > p.minZ + 0.14;
    const hoodDomeBoost = isHoodZone && !p.isBoxy && !p.isFormula
      ? 0.032 * Math.sin(THREE.MathUtils.clamp((z - p.minZ) / Math.max(0.3, p.frontWheelZ - p.minZ + 0.55), 0, 1) * Math.PI)
      : 0;
    const centerCrown = (p.isBoxy ? 0.018 : 0.038) + hoodDomeBoost;
    const midCrown = (p.isBoxy ? 0.015 : 0.026) + hoodDomeBoost * 0.45;
    const fenderTopY = Math.max(topY + 0.008, fenderLiftY);

    const sideBotY = Math.min(fenderTopY - 0.055, Math.max(botY, archCutY));
    const hEff = Math.max(0.06, fenderTopY - botY);
    const yRocker = Math.max(sideBotY, botY + hEff * 0.14);
    const yBelly = Math.max(sideBotY + 0.018, botY + hEff * 0.45);
    const yCrease = Math.max(sideBotY + 0.038, botY + hEff * 0.74);
    const yShoulder = Math.max(sideBotY + 0.052, fenderTopY - Math.min(0.075, hEff * 0.12));

    // Inner underbody floor rail tucked inboard of the tires so wheel arches have real depth
    const innerFloorX = p.openWheel
      ? hw * 0.65
      : Math.max(0.24, hw - p.wheelWidth * 0.88 - 0.09);

    const ringPts: [number, number][] = [
      [0, topY + centerCrown],                               // 0: centerline top
      [hw * 0.42, topY + midCrown],                          // 1: right hood crease
      [hw * 0.76, fenderTopY],                               // 2: right fender ridge
      [hw * 0.93 + archFlare * 0.35, yShoulder],             // 3: right upper shoulder bevel
      [hw * 1.00 + archFlare, yCrease],                      // 4: right sharp character crease
      [hw * 1.015 + archFlare * 0.65, yBelly],               // 5: right mid-door belly
      [hw * 0.93 + archFlare * 0.2, yRocker],                // 6: right rocker / wheel-arch lip
      [innerFloorX, botY],                                   // 7: right inner floor pan
      [0, botY],                                             // 8: bottom centerline
      [-innerFloorX, botY],                                  // 9: left inner floor pan
      [-(hw * 0.93 + archFlare * 0.2), yRocker],             // 10: left rocker / wheel-arch lip
      [-(hw * 1.015 + archFlare * 0.65), yBelly],            // 11: left mid-door belly
      [-(hw * 1.00 + archFlare), yCrease],                   // 12: left sharp character crease
      [-(hw * 0.93 + archFlare * 0.35), yShoulder],          // 13: left upper shoulder bevel
      [-hw * 0.76, fenderTopY],                              // 14: left fender ridge
      [-hw * 0.42, topY + midCrown],                         // 15: left hood crease
    ];

    for (let j = 0; j < RING_SIZE; j++) {
      pushVert(ringPts[j][0], ringPts[j][1], z, j / RING_SIZE, uNorm);
    }
  }

  // Connect adjacent longitudinal rings with outward-facing triangles
  for (let i = 0; i < numRings - 1; i++) {
    const r0 = i * RING_SIZE;
    const r1 = (i + 1) * RING_SIZE;
    for (let j = 0; j < RING_SIZE; j++) {
      const jNext = (j + 1) % RING_SIZE;
      const a = r0 + j;
      const b = r0 + jNext;
      const c = r1 + j;
      const d = r1 + jNext;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Watertight rounded front nose cap (-Z outward normal)
  const frontSample = sampler.sample(zStations[0]);
  const frontCenterIdx = positions.length / 3;
  pushVert(0, (frontSample.topY + frontSample.botY) * 0.5, zStations[0] - 0.035, 0.5, 0);
  for (let j = 0; j < RING_SIZE; j++) {
    const jNext = (j + 1) % RING_SIZE;
    indices.push(frontCenterIdx, j, jNext);
  }

  // Watertight rounded rear tail cap (+Z outward normal)
  const lastRingStart = (numRings - 1) * RING_SIZE;
  const rearSample = sampler.sample(zStations[numRings - 1]);
  const rearCenterIdx = positions.length / 3;
  pushVert(0, (rearSample.topY + rearSample.botY) * 0.5, zStations[numRings - 1] + 0.03, 0.5, 1);
  for (let j = 0; j < RING_SIZE; j++) {
    const jNext = (j + 1) % RING_SIZE;
    indices.push(rearCenterIdx, lastRingStart + jNext, lastRingStart + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a smooth subdivided curved automotive glass sheet (windshield / rear backlite / side window)
 * with realistic horizontal wraparound bow and subtle vertical crown curvature.
 */
function createCurvedSheetGeometry(
  bl: THREE.Vector3,
  br: THREE.Vector3,
  tr: THREE.Vector3,
  tl: THREE.Vector3,
  bowZ: number,
  archY = 0.03,
  segU = 10,
  segV = 5
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const pBot = new THREE.Vector3();
  const pTop = new THREE.Vector3();
  const pt = new THREE.Vector3();

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      pBot.lerpVectors(bl, br, u);
      pTop.lerpVectors(tl, tr, u);
      pt.lerpVectors(pBot, pTop, v);

      const hBulge = Math.sin(u * Math.PI);
      const vWeight = 0.45 + 0.55 * Math.sin(v * Math.PI);
      pt.z += bowZ * hBulge * vWeight;
      pt.y += archY * hBulge * Math.sin(v * Math.PI * 0.85);

      positions.push(pt.x, pt.y, pt.z);
      uvs.push(u, v);
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = (iv + 1) * stride + iu;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a sculpted 3D automotive roof panel with transverse crown, longitudinal dome,
 * subtle thickness, and optional double-bubble sports roof recess.
 */
function createCurvedRoofGeometry(
  fl: THREE.Vector3,
  fr: THREE.Vector3,
  rr: THREE.Vector3,
  rl: THREE.Vector3,
  crownY: number,
  doubleBubble: boolean,
  thickness = 0.048
): THREE.BufferGeometry {
  const segU = 10;
  const segV = 6;
  const topPts: THREE.Vector3[] = [];
  const botPts: THREE.Vector3[] = [];
  const pF = new THREE.Vector3();
  const pR = new THREE.Vector3();

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const longArch = Math.sin(v * Math.PI);
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      pF.lerpVectors(fl, fr, u);
      pR.lerpVectors(rl, rr, u);
      const pt = new THREE.Vector3().lerpVectors(pF, pR, v);
      const sideArch = Math.sin(u * Math.PI);
      const bubbleDip = doubleBubble ? -0.018 * Math.exp(-Math.pow((u - 0.5) / 0.16, 2)) * longArch : 0;
      pt.y += crownY * sideArch * (0.45 + 0.55 * longArch) + bubbleDip;
      topPts.push(pt);
      botPts.push(new THREE.Vector3(pt.x, pt.y - thickness, pt.z));
    }
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stride = segU + 1;
  const gridCount = stride * (segV + 1);

  for (let i = 0; i < gridCount; i++) {
    positions.push(topPts[i].x, topPts[i].y, topPts[i].z);
    uvs.push((i % stride) / segU, Math.floor(i / stride) / segV);
  }
  for (let i = 0; i < gridCount; i++) {
    positions.push(botPts[i].x, botPts[i].y, botPts[i].z);
    uvs.push((i % stride) / segU, Math.floor(i / stride) / segV);
  }

  // Top roof skin (+Y normal)
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = (iv + 1) * stride + iu;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  // Underside headliner (-Y normal)
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = gridCount + iv * stride + iu;
      const b = a + 1;
      const c = gridCount + (iv + 1) * stride + iu;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Perimeter rim skirts sealing front, rear, left, right edges
  const stitchEdge = (edgeA: number[], edgeB: number[]) => {
    for (let k = 0; k < edgeA.length - 1; k++) {
      const t0 = edgeA[k];
      const t1 = edgeA[k + 1];
      const b0 = edgeB[k];
      const b1 = edgeB[k + 1];
      indices.push(t0, t1, b0);
      indices.push(t1, b1, b0);
    }
  };
  const frontTop: number[] = [];
  const frontBot: number[] = [];
  const rearTop: number[] = [];
  const rearBot: number[] = [];
  for (let iu = 0; iu <= segU; iu++) {
    frontTop.push(iu);
    frontBot.push(gridCount + iu);
    rearTop.push(segV * stride + (segU - iu));
    rearBot.push(gridCount + segV * stride + (segU - iu));
  }
  const rightTop: number[] = [];
  const rightBot: number[] = [];
  const leftTop: number[] = [];
  const leftBot: number[] = [];
  for (let iv = 0; iv <= segV; iv++) {
    rightTop.push(iv * stride + segU);
    rightBot.push(gridCount + iv * stride + segU);
    leftTop.push((segV - iv) * stride);
    leftBot.push(gridCount + (segV - iv) * stride);
  }
  stitchEdge(frontTop, frontBot);
  stitchEdge(rightTop, rightBot);
  stitchEdge(rearTop, rearBot);
  stitchEdge(leftTop, leftBot);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Seamlessly connects two exact 3D greenhouse anchor points (beltline corner -> roof corner)
 * with a sculpted automotive A/B/C pillar strut.
 */
function createConnectedPillar(
  start: THREE.Vector3,
  end: THREE.Vector3,
  thicknessX: number,
  thicknessZ: number,
  mat: THREE.Material,
  castShadow: boolean
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = Math.max(0.05, dir.length());
  const geo = new THREE.CylinderGeometry(thicknessX * 0.72, thicknessX, len + 0.04, 8);
  geo.scale(1, 1, thicknessZ / Math.max(0.01, thicknessX));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = castShadow;
  return mesh;
}

/**
 * Sculpted compound-curved door panel skin matching the body's tumblehome & character crease.
 */
function createCurvedDoorSkinGeometry(
  doorLen: number,
  doorH: number,
  side: -1 | 1
): THREE.BufferGeometry {
  const segZ = 6;
  const profileV: [number, number][] = [
    [-0.015, -doorH * 0.48],
    [0.018, -doorH * 0.34],
    [0.042, -doorH * 0.04],
    [0.036, doorH * 0.24],
    [0.008, doorH * 0.48],
  ];
  const segY = profileV.length - 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segZ; iz++) {
    const uz = iz / segZ;
    const z = uz * doorLen;
    const crownZ = Math.sin(uz * Math.PI) * 0.014;
    for (let iy = 0; iy <= segY; iy++) {
      const [dx, y] = profileV[iy];
      positions.push(side * (dx + crownZ), y, z);
      uvs.push(uz, iy / segY);
    }
  }

  const stride = segY + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let iy = 0; iy < segY; iy++) {
      const a = iz * stride + iy;
      const b = a + 1;
      const c = (iz + 1) * stride + iy;
      const d = c + 1;
      if (side > 0) {
        indices.push(a, b, d);
        indices.push(a, d, c);
      } else {
        indices.push(a, d, b);
        indices.push(a, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a realistic LatheGeometry radial performance tire with curved sidewalls
 * and chamfered tread shoulders (zero boxy cylinder+torus artifacts).
 */
function createRadialTireGeometry(radius: number, width: number, radialSegs = 28): THREE.BufferGeometry {
  const hw = width * 0.5;
  const rRim = radius * 0.68;
  const rSide = radius * 0.85;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rRim, -hw * 0.78),
    new THREE.Vector2(rRim * 1.07, -hw * 0.96),
    new THREE.Vector2(rSide, -hw * 1.02),
    new THREE.Vector2(radius * 0.955, -hw * 0.96),
    new THREE.Vector2(radius * 0.992, -hw * 0.78),
    new THREE.Vector2(radius, -hw * 0.42),
    new THREE.Vector2(radius * 1.005, 0),
    new THREE.Vector2(radius, hw * 0.42),
    new THREE.Vector2(radius * 0.992, hw * 0.78),
    new THREE.Vector2(radius * 0.955, hw * 0.96),
    new THREE.Vector2(rSide, hw * 1.02),
    new THREE.Vector2(rRim * 1.07, hw * 0.96),
    new THREE.Vector2(rRim, hw * 0.78),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegs);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Stepped concave forged alloy wheel barrel & outer lip via LatheGeometry.
 */
function createRimBarrelGeometry(radius: number, width: number, radialSegs = 24): THREE.BufferGeometry {
  const hw = width * 0.5;
  const rOuter = radius * 0.71;
  const rLip = radius * 0.67;
  const rInner = radius * 0.61;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rInner, -hw * 0.88),
    new THREE.Vector2(rOuter, -hw * 0.88),
    new THREE.Vector2(rOuter, -hw * 0.72),
    new THREE.Vector2(rLip, -hw * 0.62),
    new THREE.Vector2(rInner, -hw * 0.35),
    new THREE.Vector2(rInner, hw * 0.35),
    new THREE.Vector2(rLip, hw * 0.62),
    new THREE.Vector2(rOuter, hw * 0.72),
    new THREE.Vector2(rOuter, hw * 0.88),
    new THREE.Vector2(rInner, hw * 0.88),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegs);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

interface DetailedWheelParts {
  /** Rotating tire + forged rim + spokes + lug nuts + ventilated brake rotor */
  spinning: THREE.Group;
  /** Stationary steering-knuckle hardware (Brembo brake caliper stays fixed at 10-o'clock!) */
  hub: THREE.Group;
}

/**
 * Photorealistic forged alloy wheel assembly:
 * - LatheGeometry curved-shoulder radial tire
 * - Stepped concave forged alloy rim barrel + 6 customizable spoke architectures + 5 lug bolts
 * - Cross-drilled ventilated brake rotor
 * - Stationary 6-piston Brembo brake caliper mounted on the non-spinning hub knuckle
 */
function buildDetailedWheel(
  radius: number,
  width: number,
  side: -1 | 1,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  accentMat: THREE.Material,
  caliperMat: THREE.Material,
  discMat: THREE.Material,
  darkHubMat: THREE.Material,
  castShadow: boolean,
  rimStyle: CarRimStyle = 'twin5',
  neonRimMat?: THREE.Material
): DetailedWheelParts {
  const spinning = new THREE.Group();
  const hub = new THREE.Group();

  // 1. Lathe-profiled radial performance tire
  const tire = new THREE.Mesh(createRadialTireGeometry(radius, width, 28), tireMat);
  tire.castShadow = castShadow;
  spinning.add(tire);

  // 2. Concave stepped forged alloy rim barrel
  spinning.add(new THREE.Mesh(createRimBarrelGeometry(radius, width, 24), rimMat));

  // Inner dark shadow backing behind spokes for true wheel depth
  const innerDrumGeo = new THREE.CylinderGeometry(radius * 0.61, radius * 0.61, width * 0.44, 20);
  innerDrumGeo.rotateZ(Math.PI / 2);
  spinning.add(new THREE.Mesh(innerDrumGeo, darkHubMat));

  // Optional glowing outer rim lip for neon / cyber rims
  if (neonRimMat) {
    const lipRing = new THREE.TorusGeometry(radius * 0.68, 0.018, 8, 28);
    lipRing.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(lipRing, neonRimMat);
    m.position.x = side * width * 0.44;
    spinning.add(m);
  }

  // 3. Cross-drilled ventilated steel brake disc (spins with wheel)
  const discGeo = new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, width * 0.14, 24);
  discGeo.rotateZ(Math.PI / 2);
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.x = side * width * 0.1;
  spinning.add(disc);

  // 4. Stationary 6-piston sculpted Brembo brake caliper (mounts to hub, NEVER spins!)
  const caliperGeo = new THREE.TorusGeometry(radius * 0.48, radius * 0.095, 8, 12, Math.PI * 0.36);
  caliperGeo.rotateY(Math.PI / 2);
  const caliper = new THREE.Mesh(caliperGeo, caliperMat);
  caliper.position.x = side * width * 0.12;
  caliper.rotation.x = Math.PI * 0.68;
  hub.add(caliper);

  // 5. Concave sculpted wheel face spokes (pushed toward outer side for realistic concave dish!)
  const spokeFaceX = side * width * 0.3;
  const spokeDepth = width * 0.18;

  if (rimStyle === 'turbofan') {
    const discFace = new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width * 0.14, 24);
    discFace.rotateZ(Math.PI / 2);
    const df = new THREE.Mesh(discFace, rimMat);
    df.position.x = spokeFaceX;
    spinning.add(df);
    const vaneGeo = new THREE.BoxGeometry(width * 0.16, radius * 1.16, radius * 0.042);
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Mesh(vaneGeo, accentMat);
      v.position.x = spokeFaceX + side * 0.015;
      v.rotation.x = (i / 10) * Math.PI;
      spinning.add(v);
    }
  } else if (rimStyle === 'mesh') {
    const spokeGeo = new THREE.BoxGeometry(spokeDepth, radius * 1.24, radius * 0.042);
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.position.x = spokeFaceX;
      s.rotation.x = (i / 10) * Math.PI;
      spinning.add(s);
    }
  } else if (rimStyle === 'deepDish') {
    const dishRing = new THREE.TorusGeometry(radius * 0.66, 0.032, 8, 26);
    dishRing.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(dishRing, rimMat);
    m.position.x = side * width * 0.43;
    spinning.add(m);

    const spokeGeo = new THREE.BoxGeometry(spokeDepth, radius * 1.18, radius * 0.12);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.position.x = spokeFaceX - side * width * 0.06;
      s.rotation.x = (i / 5) * Math.PI;
      spinning.add(s);
    }
  } else if (rimStyle === 'blade') {
    const spokeGeo = new THREE.BoxGeometry(spokeDepth, radius * 1.22, radius * 0.11);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.position.x = spokeFaceX;
      s.rotation.x = (i / 5) * Math.PI + 0.22;
      spinning.add(s);
    }
  } else if (rimStyle === 'offroad') {
    const bead = new THREE.TorusGeometry(radius * 0.64, 0.038, 8, 18);
    bead.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(bead, accentMat);
    m.position.x = side * width * 0.43;
    spinning.add(m);

    const spokeGeo = new THREE.BoxGeometry(spokeDepth, radius * 1.18, radius * 0.13);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.position.x = spokeFaceX;
      s.rotation.x = (i / 6) * Math.PI;
      spinning.add(s);
    }
  } else {
    // Forged motorsport twin-5 Y-spokes
    const spokeGeo = new THREE.BoxGeometry(spokeDepth, radius * 1.22, radius * 0.058);
    for (let i = 0; i < 5; i++) {
      const baseAngle = (i / 5) * Math.PI;
      [-0.11, 0.11].forEach((offset) => {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.x = spokeFaceX;
        spoke.rotation.x = baseAngle + offset;
        spinning.add(spoke);
      });
    }
  }

  // 6. Concave center hub + 5 lug bolts + anodized center-lock nut
  const hubGeo = new THREE.CylinderGeometry(radius * 0.19, radius * 0.22, width * 0.24, 16);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, rimMat);
  hubMesh.position.x = spokeFaceX - side * 0.02;
  spinning.add(hubMesh);

  const lockGeo = new THREE.CylinderGeometry(radius * 0.1, radius * 0.11, width * 0.14, 12);
  lockGeo.rotateZ(Math.PI / 2);
  const lockMesh = new THREE.Mesh(lockGeo, accentMat);
  lockMesh.position.x = spokeFaceX + side * 0.05;
  spinning.add(lockMesh);

  const lugGeo = new THREE.CylinderGeometry(radius * 0.022, radius * 0.022, width * 0.08, 6);
  lugGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, discMat);
    lug.position.set(
      spokeFaceX + side * 0.055,
      Math.cos(ang) * radius * 0.14,
      Math.sin(ang) * radius * 0.14
    );
    spinning.add(lug);
  }

  return { spinning, hub };
}

function getRimColorHex(rimColor: CarRimColor): number {
  switch (rimColor) {
    case 'black':
      return 0x181c24;
    case 'gold':
      return 0xd4a017;
    case 'bronze':
      return 0x9a6b3e;
    case 'chrome':
      return 0xf8fafc;
    case 'neon':
      return 0x1e293b;
    default:
      return 0xdbe2ea;
  }
}

export function buildCartoonCar(
  archetype: CarArchetype,
  paintHex: string,
  accentHex: string,
  shadowTexture: THREE.Texture,
  castShadow: boolean,
  tireTreadTexture?: THREE.Texture,
  carbonTexture?: THREE.Texture,
  visual?: CarVisualStyle
): BuiltCarRig {
  const spec = CAR_SPECS[archetype];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const finish = visual?.finish ?? 'gloss';
  const isMatte = finish === 'matte';
  const isChrome = finish === 'chrome';
  const isIridescent = finish === 'iridescent';

  const isFormula = archetype === 'formula';
  const isBoxy =
    archetype === 'offroad' || archetype === 'pickup' || archetype === 'monster' || archetype === 'suv';
  const isSporty =
    archetype === 'coupe' ||
    archetype === 'gt' ||
    archetype === 'hyper' ||
    archetype === 'jdm' ||
    archetype === 'roadster' ||
    archetype === 'muscle' ||
    archetype === 'modernMuscle' ||
    archetype === 'prototype' ||
    archetype === 'crown';

  // 1. Photorealistic Automotive PBR Material Palette
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    roughness: isMatte ? 0.54 : isChrome ? 0.04 : 0.12,
    metalness: isMatte ? 0.28 : isChrome ? 0.98 : isIridescent ? 0.74 : 0.62,
    clearcoat: isMatte ? 0.1 : 1.0,
    clearcoatRoughness: isMatte ? 0.38 : 0.035,
    reflectivity: isMatte ? 0.4 : 1.0,
    iridescence: isIridescent ? 1.0 : 0.0,
    iridescenceIOR: 1.42,
    iridescenceThicknessRange: [180, 560],
    envMapIntensity: isChrome ? 2.7 : isMatte ? 1.1 : 2.25,
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.16,
    metalness: 0.56,
    clearcoat: 0.94,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.85,
  });

  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x161a24,
    map: carbonTexture ?? null,
    roughness: 0.32,
    metalness: 0.38,
    clearcoat: 0.78,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.45,
  });

  const glossTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0e15,
    roughness: 0.12,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.75,
  });

  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createHoneycombGrilleTexture(),
    roughness: 0.42,
    metalness: 0.72,
    envMapIntensity: 1.3,
  });

  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createLicensePlateTexture(),
    roughness: 0.34,
    metalness: 0.25,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.07,
    metalness: 0.98,
    envMapIntensity: 2.25,
  });

  const titaniumExhaustMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.15,
    metalness: 0.96,
    envMapIntensity: 1.95,
  });

  // Realistic clear-tinted automotive laminated glass (crystal reflections, unobstructed driver view)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x94c9e8,
    roughness: 0.03,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 1.0,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 2.4,
  });

  const headlightLensMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    roughness: 0.03,
    metalness: 0.1,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    envMapIntensity: 2.2,
  });

  const hlTint = visual?.headlightTint ?? 'white';
  const hlEmissive =
    hlTint === 'iceBlue'
      ? 0x7dd3fc
      : hlTint === 'amber'
      ? 0xfbbf24
      : hlTint === 'laserViolet'
      ? 0xd946ef
      : hlTint === 'gold'
      ? 0xfacc15
      : 0xfff8dc;
  const drlEmissive =
    hlTint === 'amber'
      ? 0xf59e0b
      : hlTint === 'laserViolet'
      ? 0xe879f9
      : hlTint === 'gold'
      ? 0xfde047
      : 0x7dd3fc;

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: hlEmissive,
    emissiveIntensity: 3.4,
    roughness: 0.06,
  });

  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: drlEmissive,
    emissiveIntensity: 3.0,
    roughness: 0.08,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1e2d,
    emissive: 0xdc2626,
    emissiveIntensity: 1.6,
    roughness: 0.08,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    map: tireTreadTexture ?? null,
    roughness: 0.84,
    metalness: 0.06,
  });

  const rimColorKey = visual?.rimColor ?? 'silver';
  const rimMat = new THREE.MeshStandardMaterial({
    color: getRimColorHex(rimColorKey),
    roughness: rimColorKey === 'chrome' ? 0.05 : rimColorKey === 'black' ? 0.32 : 0.12,
    metalness: rimColorKey === 'black' ? 0.68 : 0.96,
    envMapIntensity: rimColorKey === 'chrome' ? 2.5 : 2.0,
  });

  const neonRimMat =
    rimColorKey === 'neon'
      ? new THREE.MeshStandardMaterial({
          color: accentHex,
          emissive: accentHex,
          emissiveIntensity: 2.8,
          roughness: 0.12,
        })
      : undefined;

  const caliperMat = new THREE.MeshStandardMaterial({
    color: archetype === 'crown' || rimColorKey === 'gold' ? 0xd4a017 : 0xdc2626,
    roughness: 0.2,
    metalness: 0.58,
  });

  const discMat = new THREE.MeshStandardMaterial({
    color: 0xa1a9b4,
    roughness: 0.28,
    metalness: 0.9,
  });

  const innerWheelWellMat = new THREE.MeshStandardMaterial({
    color: 0x07090e,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });

  // 2. True 3D Multi-Section Sculpted Automotive Lower Body (compound curves + carved circular wheel arches!)
  const bodyW = spec.openWheel ? spec.width * (isFormula ? 0.62 : 0.56) : spec.width;
  const bodySampler = createProfileSampler(spec.bodyProfile);
  const contourParams: BodyContourParams = {
    bodyWidth: bodyW,
    minZ: bodySampler.minZ,
    maxZ: bodySampler.maxZ,
    frontWheelZ: spec.frontWheelZ,
    rearWheelZ: spec.rearWheelZ,
    wheelRadius: spec.wheelRadius,
    wheelWidth: spec.wheelWidth,
    rideHeight: spec.rideHeight,
    openWheel: Boolean(spec.openWheel),
    isFormula,
    isSporty,
    isBoxy,
    lifted: Boolean(spec.liftedSuspension),
  };

  const bodyGeo = createSculptedCarBodyGeometry(spec.bodyProfile, contourParams, true);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.position.y = spec.rideHeight;
  bodyMesh.castShadow = castShadow;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // Open-wheel suspension wishbone A-arms & F1 sculpted sidepod radiator inlets
  if (spec.openWheel) {
    const wheelTrackX = spec.width * 0.44;
    [spec.frontWheelZ, spec.rearWheelZ].forEach((wz) => {
      [-1, 1].forEach((side) => {
        const innerX = getPlanHalfWidthAt(wz, contourParams) * 0.78;
        const armLen = Math.max(0.24, wheelTrackX - innerX);
        [-0.08, 0.08].forEach((dy) => {
          [-0.1, 0.1].forEach((dz) => {
            const arm = new THREE.Mesh(
              new THREE.CylinderGeometry(0.018, 0.018, armLen, 6),
              carbonMat
            );
            arm.rotation.z = Math.PI / 2;
            arm.rotation.y = side * dz * 1.4;
            arm.position.set(
              side * (innerX + armLen * 0.48),
              spec.wheelRadius + dy,
              wz + dz * 0.5
            );
            bodyGroup.add(arm);
          });
        });
      });
    });

    if (isFormula) {
      // Sculpted F1 carbon sidepod intake openings + engine-cover airbox chimney
      [-1, 1].forEach((side) => {
        const podMouth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.08), innerWheelWellMat);
        podMouth.position.set(side * 0.48, spec.rideHeight + 0.34, -0.32);
        bodyGroup.add(podMouth);
        const podLip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.24), carbonMat);
        podLip.position.set(side * 0.48, spec.rideHeight + 0.46, -0.36);
        bodyGroup.add(podLip);
      });
      // F1 overhead roll-hoop airbox scoop behind the driver
      const airbox = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.56, 10), paintMat);
      airbox.rotation.x = Math.PI / 2 - 0.18;
      airbox.position.set(0, spec.rideHeight + 0.86, 0.62);
      bodyGroup.add(airbox);
      const airboxInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 10), innerWheelWellMat);
      airboxInlet.rotation.x = Math.PI / 2;
      airboxInlet.position.set(0, spec.rideHeight + 0.91, 0.34);
      bodyGroup.add(airboxInlet);
    }
  }

  // Dark recessed curved inner wheel-well liners + sleek sculpted fender arch lip trim
  const wheelX = spec.openWheel
    ? spec.width * 0.44
    : bodyW * 0.5 - spec.wheelWidth * 0.38;

  if (!spec.openWheel) {
    const archR = spec.wheelRadius + (spec.liftedSuspension ? 0.14 : 0.082);
    const wellDepth = spec.wheelWidth + 0.14;
    [spec.frontWheelZ, spec.rearWheelZ].forEach((wz) => {
      const localHW = getPlanHalfWidthAt(wz, contourParams);
      [-1, 1].forEach((side) => {
        // Curved inner wheel-well arch drum (hides interior behind the tire)
        const linerGeo = new THREE.CylinderGeometry(
          archR - 0.005,
          archR - 0.005,
          wellDepth,
          18,
          1,
          true,
          -Math.PI * 0.04,
          Math.PI * 1.08
        );
        linerGeo.rotateZ(Math.PI / 2);
        linerGeo.rotateX(Math.PI / 2);
        const liner = new THREE.Mesh(linerGeo, innerWheelWellMat);
        liner.position.set(side * (localHW - wellDepth * 0.5), spec.wheelRadius, wz);
        bodyGroup.add(liner);

        // Dark inboard wheel-well backing wall so you never see through the wheel arch
        const backPlateGeo = new THREE.CircleGeometry(archR, 18, 0, Math.PI);
        backPlateGeo.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
        const backPlate = new THREE.Mesh(backPlateGeo, innerWheelWellMat);
        backPlate.position.set(side * (localHW - wellDepth + 0.01), spec.wheelRadius, wz);
        bodyGroup.add(backPlate);

        // Sleek flush carbon/gloss-black wheel-arch lip trim hugging the carved circular opening
        const archLip = new THREE.Mesh(
          new THREE.TorusGeometry(archR + 0.006, 0.024, 8, 22, Math.PI),
          isBoxy ? carbonMat : glossTrimMat
        );
        archLip.rotation.y = Math.PI / 2;
        archLip.position.set(side * (localHW + 0.006), spec.wheelRadius, wz);
        bodyGroup.add(archLip);
      });
    });

    // Aerodynamic carbon side skirts between wheel arches
    const skirtLen = Math.max(0.6, spec.rearWheelZ - spec.frontWheelZ - archR * 2.02);
    const midAxleZ = (spec.frontWheelZ + spec.rearWheelZ) * 0.5;
    const midHW = getPlanHalfWidthAt(midAxleZ, contourParams);
    [-1, 1].forEach((side) => {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.068, skirtLen), carbonMat);
      skirt.position.set(side * (midHW - 0.01), spec.rideHeight + 0.04, midAxleZ);
      bodyGroup.add(skirt);
    });
  }

  // Flat carbon underbody floor tray + curved-corner front aerodynamic splitter lip
  const underbody = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.72, 0.055, spec.length * 0.88),
    innerWheelWellMat
  );
  underbody.position.set(0, spec.rideHeight + 0.025, 0);
  bodyGroup.add(underbody);

  const frontZ = bodySampler.minZ;
  const rearZ = bodySampler.maxZ;
  const noseHW = getPlanHalfWidthAt(frontZ + 0.24, contourParams);
  const rearHW = getPlanHalfWidthAt(rearZ - 0.24, contourParams);

  if (!isFormula) {
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(noseHW * 1.92, 0.045, 0.34),
      carbonMat
    );
    splitter.position.set(0, spec.rideHeight + 0.032, frontZ + 0.04);
    bodyGroup.add(splitter);

    // Subtle front splitter end-plate winglets on sporty models
    if (isSporty) {
      [-1, 1].forEach((side) => {
        const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.32), carbonMat);
        winglet.position.set(side * (noseHW * 0.96), spec.rideHeight + 0.08, frontZ + 0.08);
        bodyGroup.add(winglet);
      });
    }
  }

  // 3. True Open-Sided Curved Automotive Greenhouse (Curved Windshield + Crowned Roof + Connected A/B/C Pillars!)
  const cabinW = spec.width * spec.cabinWidthFactor;
  const roofMaxY = Math.max(...spec.cabinProfile.map((pt) => pt[1]));
  const roofMinZ = Math.min(...spec.cabinProfile.map((pt) => pt[0]));
  const roofMaxZ = Math.max(...spec.cabinProfile.map((pt) => pt[0]));

  // Derive exact greenhouse roof front & rear Z from cabinProfile upper vertices
  const upperCabPts = spec.cabinProfile.filter((pt) => pt[1] >= roofMaxY - 0.16);
  const roofFrontZ =
    upperCabPts.length > 0
      ? Math.min(...upperCabPts.map((pt) => pt[0]))
      : THREE.MathUtils.lerp(roofMinZ, roofMaxZ, 0.28);
  const roofRearZ =
    upperCabPts.length > 0
      ? Math.max(...upperCabPts.map((pt) => pt[0]))
      : THREE.MathUtils.lerp(roofMinZ, roofMaxZ, 0.72);

  const beltFrontY = spec.rideHeight + bodySampler.sample(roofMinZ).topY - 0.02;
  const beltRearY = spec.rideHeight + bodySampler.sample(roofMaxZ).topY - 0.02;
  const roofEdgeY = spec.rideHeight + roofMaxY - 0.04;

  const baseFrontHW = Math.min(cabinW * 0.52, getPlanHalfWidthAt(roofMinZ, contourParams) * 0.85);
  const baseRearHW = Math.min(cabinW * 0.51, getPlanHalfWidthAt(roofMaxZ, contourParams) * 0.84);
  const topFrontHW = baseFrontHW * (isBoxy ? 0.86 : 0.78);
  const topRearHW = baseRearHW * (isBoxy ? 0.88 : 0.74);

  const pillarMat =
    archetype === 'hyper' || archetype === 'gt' || archetype === 'prototype' || visual?.livery === 'twoToneRoof'
      ? glossTrimMat
      : paintMat;

  if (isFormula) {
    // Low curved polycarbonate F1 aero windscreen deflector
    const fBL = new THREE.Vector3(-0.24, spec.rideHeight + 0.53, -0.58);
    const fBR = new THREE.Vector3(0.24, spec.rideHeight + 0.53, -0.58);
    const fTR = new THREE.Vector3(0.2, spec.rideHeight + 0.69, -0.36);
    const fTL = new THREE.Vector3(-0.2, spec.rideHeight + 0.69, -0.36);
    const fScreen = new THREE.Mesh(createCurvedSheetGeometry(fBL, fBR, fTR, fTL, -0.05, 0.02, 8, 3), glassMat);
    fScreen.renderOrder = 3;
    bodyGroup.add(fScreen);
  } else if (spec.openTop) {
    // Roadster / Convertible: sleek raked wraparound curved windshield + sculpted A-pillars + rear speedster fairings
    const wsTopZ = roofMinZ + 0.48;
    const wsTopY = spec.rideHeight + roofMaxY - 0.02;
    const wsBL = new THREE.Vector3(-baseFrontHW, beltFrontY, roofMinZ);
    const wsBR = new THREE.Vector3(baseFrontHW, beltFrontY, roofMinZ);
    const wsTR = new THREE.Vector3(topFrontHW * 1.04, wsTopY, wsTopZ);
    const wsTL = new THREE.Vector3(-topFrontHW * 1.04, wsTopY, wsTopZ);

    const windshield = new THREE.Mesh(
      createCurvedSheetGeometry(wsBL, wsBR, wsTR, wsTL, -0.085, 0.035, 10, 5),
      glassMat
    );
    windshield.renderOrder = 3;
    bodyGroup.add(windshield);

    // Chrome/painted A-pillars & top windshield header bar
    bodyGroup.add(createConnectedPillar(wsBL, wsTL, 0.034, 0.044, chromeMat, castShadow));
    bodyGroup.add(createConnectedPillar(wsBR, wsTR, 0.034, 0.044, chromeMat, castShadow));
    bodyGroup.add(createConnectedPillar(wsTL, wsTR, 0.028, 0.036, chromeMat, castShadow));

    // Twin aerodynamic speedster tonneau humps behind the headrests
    [-baseRearHW * 0.52, baseRearHW * 0.52].forEach((hx) => {
      const hump = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.62, 6, 12), paintMat);
      hump.rotation.x = Math.PI / 2 + 0.14;
      hump.scale.set(1.12, 0.68, 1.0);
      hump.position.set(hx, beltRearY + 0.12, 0.88);
      hump.castShadow = castShadow;
      bodyGroup.add(hump);
    });
  } else {
    // Closed-cabin automotive greenhouse: Curved Windshield + Curved Rear Backlite + Crowned Roof + Connected A/B/C Pillars!
    const wsBL = new THREE.Vector3(-baseFrontHW, beltFrontY, roofMinZ);
    const wsBR = new THREE.Vector3(baseFrontHW, beltFrontY, roofMinZ);
    const wsTR = new THREE.Vector3(topFrontHW, roofEdgeY, roofFrontZ);
    const wsTL = new THREE.Vector3(-topFrontHW, roofEdgeY, roofFrontZ);

    const rwTL = new THREE.Vector3(-topRearHW, roofEdgeY, roofRearZ);
    const rwTR = new THREE.Vector3(topRearHW, roofEdgeY, roofRearZ);
    const rwBR = new THREE.Vector3(baseRearHW, beltRearY, roofMaxZ);
    const rwBL = new THREE.Vector3(-baseRearHW, beltRearY, roofMaxZ);

    // 1. Curved wraparound front windshield
    const windshield = new THREE.Mesh(
      createCurvedSheetGeometry(wsBL, wsBR, wsTR, wsTL, -0.09, 0.035, 10, 5),
      glassMat
    );
    windshield.renderOrder = 3;
    bodyGroup.add(windshield);

    // Twin realistic windshield wiper blades resting at the cowl
    [-baseFrontHW * 0.36, baseFrontHW * 0.2].forEach((wx) => {
      const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.024), glossTrimMat);
      wiper.position.set(wx, beltFrontY + 0.035, roofMinZ - 0.025);
      wiper.rotation.y = 0.08;
      wiper.rotation.z = 0.06;
      bodyGroup.add(wiper);
    });

    // 2. Curved sweeping rear backlite glass (facing +Z)
    const rearGlass = new THREE.Mesh(
      createCurvedSheetGeometry(rwBR, rwBL, rwTL, rwTR, 0.075, 0.03, 10, 5),
      glassMat
    );
    rearGlass.renderOrder = 3;
    bodyGroup.add(rearGlass);

    // 3. Sculpted crowned roof skin (double-bubble on sports/hypercars!)
    const isCarbonRoof =
      archetype === 'hyper' ||
      archetype === 'gt' ||
      archetype === 'prototype' ||
      visual?.livery === 'twoToneRoof';
    const roofGeo = createCurvedRoofGeometry(
      wsTL,
      wsTR,
      rwTR,
      rwTL,
      isBoxy ? 0.035 : 0.065,
      isSporty,
      0.048
    );
    const roofMesh = new THREE.Mesh(roofGeo, isCarbonRoof ? carbonMat : paintMat);
    roofMesh.castShadow = castShadow;
    roofMesh.receiveShadow = true;
    bodyGroup.add(roofMesh);

    // 4. Seamlessly connected A-pillars & C-pillars joining beltline directly to roof corners
    bodyGroup.add(createConnectedPillar(wsBL, wsTL, 0.038, 0.052, pillarMat, castShadow));
    bodyGroup.add(createConnectedPillar(wsBR, wsTR, 0.038, 0.052, pillarMat, castShadow));
    bodyGroup.add(createConnectedPillar(rwBL, rwTL, 0.052, 0.085, paintMat, castShadow));
    bodyGroup.add(createConnectedPillar(rwBR, rwTR, 0.052, 0.085, paintMat, castShadow));

    // Upper roof-rail trim connecting A-pillar top to C-pillar top + slim B-pillars & rear quarter glass
    bodyGroup.add(createConnectedPillar(wsTL, rwTL, 0.032, 0.04, glossTrimMat, false));
    bodyGroup.add(createConnectedPillar(wsTR, rwTR, 0.032, 0.04, glossTrimMat, false));

    const roofSpanZ = roofRearZ - roofFrontZ;
    if (roofSpanZ > 0.45 && archetype !== 'pickup' && archetype !== 'monster') {
      const bZ = THREE.MathUtils.lerp(roofFrontZ, roofRearZ, 0.52);
      const bBaseY = spec.rideHeight + bodySampler.sample(bZ).topY - 0.02;
      const bBaseHW = Math.min(cabinW * 0.51, getPlanHalfWidthAt(bZ, contourParams) * 0.85);
      const bTopHW = THREE.MathUtils.lerp(topFrontHW, topRearHW, 0.52);
      const bBL = new THREE.Vector3(-bBaseHW, bBaseY, bZ);
      const bTL = new THREE.Vector3(-bTopHW, roofEdgeY, bZ);
      const bBR = new THREE.Vector3(bBaseHW, bBaseY, bZ);
      const bTR = new THREE.Vector3(bTopHW, roofEdgeY, bZ);

      bodyGroup.add(createConnectedPillar(bBL, bTL, 0.032, 0.042, glossTrimMat, false));
      bodyGroup.add(createConnectedPillar(bBR, bTR, 0.032, 0.042, glossTrimMat, false));

      // Rear quarter side glass behind B-pillar
      const qGlassL = new THREE.Mesh(
        createCurvedSheetGeometry(bBL, rwBL, rwTL, bTL, 0, 0.012, 4, 3),
        glassMat
      );
      qGlassL.renderOrder = 3;
      bodyGroup.add(qGlassL);

      const qGlassR = new THREE.Mesh(
        createCurvedSheetGeometry(rwBR, bBR, bTR, rwTR, 0, 0.012, 4, 3),
        glassMat
      );
      qGlassR.renderOrder = 3;
      bodyGroup.add(qGlassR);
    }

    // Sleek shark-fin roof antenna
    if (!isBoxy) {
      const sharkFin = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 4), glossTrimMat);
      sharkFin.scale.set(0.55, 1, 1.45);
      sharkFin.rotation.x = -0.38;
      sharkFin.position.set(0, roofEdgeY + 0.085, THREE.MathUtils.lerp(roofFrontZ, roofRearZ, 0.78));
      bodyGroup.add(sharkFin);
    }
  }

  // 3B. Full 3D Cockpit Interior (Dashboard, Illuminated Gauges, Steering Wheel, Bucket Seats & Skeletal Driver!)
  const interiorGroup = new THREE.Group();
  bodyGroup.add(interiorGroup);

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x161a24,
    roughness: 0.68,
    metalness: 0.08,
  });
  const bolsterMat = new THREE.MeshStandardMaterial({
    color: 0x222836,
    roughness: 0.62,
  });
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0x11151e,
    roughness: 0.52,
    metalness: 0.18,
  });
  const dashGaugeMat = new THREE.MeshStandardMaterial({
    map: createDashboardTexture(),
    emissive: 0xffffff,
    emissiveMap: createDashboardTexture(),
    emissiveIntensity: 1.25,
    roughness: 0.2,
  });

  const isSingleSeater = Boolean(spec.openWheel || archetype === 'prototype');
  const beltY =
    spec.rideHeight +
    (isBoxy ? 0.72 : isFormula ? 0.42 : 0.56);
  const driverX = isSingleSeater ? 0 : -Math.min(0.36, cabinW * 0.24);
  const seatZ = spec.openWheel ? 0.22 : (roofMinZ + roofMaxZ) * 0.5 + 0.14;
  const dashZ = seatZ - (spec.openWheel ? 0.68 : 0.76);

  // Cabin Floor Tub & Center Console Tunnel
  const floorTub = new THREE.Mesh(
    new THREE.BoxGeometry(cabinW * 0.84, 0.12, Math.max(1.15, (roofMaxZ - roofMinZ) * 0.66)),
    innerWheelWellMat
  );
  floorTub.position.set(0, beltY - 0.16, seatZ - 0.12);
  interiorGroup.add(floorTub);

  if (!isSingleSeater) {
    const consoleTunnel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.05), dashMat);
    consoleTunnel.position.set(0, beltY + 0.02, seatZ - 0.2);
    interiorGroup.add(consoleTunnel);

    const shifterStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.16, 8), chromeMat);
    shifterStem.position.set(0, beltY + 0.18, seatZ - 0.42);
    shifterStem.rotation.x = -0.18;
    interiorGroup.add(shifterStem);

    const shifterKnob = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), accentMat);
    shifterKnob.position.set(0, beltY + 0.26, seatZ - 0.44);
    interiorGroup.add(shifterKnob);
  }

  // Sculpted Dashboard + Illuminated Digital Instrument Cluster
  const dashW = isSingleSeater ? cabinW * 0.72 : cabinW * 0.82;
  const dashMain = new THREE.Mesh(new THREE.BoxGeometry(dashW, 0.22, 0.34), dashMat);
  dashMain.position.set(0, beltY + 0.16, dashZ);
  interiorGroup.add(dashMain);

  const dashBinnacle = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.24), carbonMat);
  dashBinnacle.position.set(driverX, beltY + 0.28, dashZ + 0.02);
  interiorGroup.add(dashBinnacle);

  const gaugeScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.16), dashGaugeMat);
  gaugeScreen.position.set(driverX, beltY + 0.25, dashZ + 0.175);
  gaugeScreen.rotation.x = -0.22;
  interiorGroup.add(gaugeScreen);

  if (!isSingleSeater) {
    const infotainment = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), dashGaugeMat);
    infotainment.position.set(0.06, beltY + 0.21, dashZ + 0.175);
    infotainment.rotation.x = -0.18;
    interiorGroup.add(infotainment);
  }

  const cabinHeadroom = Math.max(0.42, roofMaxY - (beltY - spec.rideHeight));
  const driverScale = THREE.MathUtils.clamp(cabinHeadroom / 0.84, 0.72, 0.92);

  // Steering Column + Animated 3D Motorsport Steering Wheel with 9-o'clock / 3-o'clock IK Grip Targets
  const wheelZ = seatZ - 0.37 * driverScale;
  const wheelY = beltY + 0.3 * driverScale;
  const columnLen = Math.max(0.22, wheelZ - dashZ);
  const wheelColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.038, columnLen, 10),
    carbonMat
  );
  wheelColumn.rotation.x = Math.PI / 2 - 0.26;
  wheelColumn.position.set(driverX, wheelY - 0.035, (dashZ + wheelZ) * 0.5);
  interiorGroup.add(wheelColumn);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(driverX, wheelY, wheelZ);
  steeringWheel.rotation.x = -0.26;

  const wheelRadius = 0.16;
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.022, 10, 24), leatherMat);
  steeringWheel.add(wheelRim);

  const topMarker = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.046, 0.046), accentMat);
  topMarker.position.set(0, wheelRadius, 0);
  steeringWheel.add(topMarker);

  [-1, 1].forEach((side) => {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.02), chromeMat);
    spoke.position.set(side * 0.075, -0.015, 0);
    steeringWheel.add(spoke);
  });
  const bottomSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.13, 0.02), chromeMat);
  bottomSpoke.position.set(0, -0.085, 0);
  steeringWheel.add(bottomSpoke);

  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.058, 0.038, 14), carbonMat);
  wheelHub.rotation.x = Math.PI / 2;
  steeringWheel.add(wheelHub);

  const hubLogo = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.044, 12), accentMat);
  hubLogo.rotation.x = Math.PI / 2;
  steeringWheel.add(hubLogo);

  const leftGripTarget = new THREE.Object3D();
  leftGripTarget.name = 'LeftSteeringGripTarget';
  leftGripTarget.position.set(-wheelRadius, 0, 0.022);
  leftGripTarget.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0)
    )
  );
  steeringWheel.add(leftGripTarget);

  const rightGripTarget = new THREE.Object3D();
  rightGripTarget.name = 'RightSteeringGripTarget';
  rightGripTarget.position.set(wheelRadius, 0, 0.022);
  rightGripTarget.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-1, 0, 0)
    )
  );
  steeringWheel.add(rightGripTarget);

  interiorGroup.add(steeringWheel);

  // Racing Bucket Seats with Side Bolsters & Headrests
  const seatPositions = isSingleSeater ? [0] : [driverX, -driverX];
  seatPositions.forEach((sx) => {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.44), leatherMat);
    cushion.position.set(sx, beltY - 0.06, seatZ - 0.06);
    interiorGroup.add(cushion);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.56, 0.11), leatherMat);
    seatBack.position.set(sx, beltY + 0.24, seatZ + 0.18);
    seatBack.rotation.x = -0.18;
    interiorGroup.add(seatBack);

    [-0.19, 0.19].forEach((bx) => {
      const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.16), bolsterMat);
      bolster.position.set(sx + bx, beltY + 0.2, seatZ + 0.13);
      bolster.rotation.x = -0.18;
      interiorGroup.add(bolster);
    });

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.1), accentMat);
    headrest.position.set(sx, beltY + 0.56, seatZ + 0.23);
    interiorGroup.add(headrest);

    if (spec.openTop) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 16, Math.PI), chromeMat);
      hoop.position.set(sx, beltY + 0.48, seatZ + 0.34);
      interiorGroup.add(hoop);
    }
  });

  // Rigged Skeletal 3D Driver anchored in the seat & coupled via 2-bone IK to the rotating steering wheel
  const useProHelmet =
    archetype === 'formula' ||
    archetype === 'gt' ||
    archetype === 'hyper' ||
    archetype === 'prototype' ||
    archetype === 'crown' ||
    archetype === 'rally' ||
    archetype === 'buggy';
  const driverAnchor = new THREE.Group();
  driverAnchor.name = 'DriverSeatAnchor';
  driverAnchor.position.set(driverX, beltY - 0.02, seatZ + 0.02);
  interiorGroup.add(driverAnchor);

  const driverRig = buildSeatedDriver({
    useHelmet: useProHelmet,
    suitColorHex: paintHex,
    accentHex,
    scale: driverScale,
  });
  driverAnchor.add(driverRig.root);

  const driverAnimator = new DriverSkeletalController(driverRig, leftGripTarget, rightGripTarget);
  bodyGroup.updateMatrixWorld(true);
  driverAnimator.update({
    dt: 0.016,
    steerInput: 0,
    steeringWheelAngle: 0,
    speedNorm: 0,
    braking: false,
    nitroActive: false,
    lateralG: 0,
    isCockpitCamera: false,
    elapsed: 0,
  });

  // Warm Interior Cabin Dome Light (fades on smoothly when doors open in the Garage)
  const cabinLight = new THREE.PointLight(0xffedd5, 0, 3.8, 1.8);
  cabinLight.position.set(0, spec.rideHeight + roofMaxY - 0.08, seatZ - 0.12);
  interiorGroup.add(cabinLight);

  // First-person Cockpit Interior Camera eye position
  const cockpitCameraOffset = new THREE.Vector3(
    driverX,
    beltY + 0.62 * driverScale,
    seatZ - 0.02
  );

  // 4. Interactive Hinged Sculpted 3D Doors (Curved Skin + Inner Door Card + Frameless Glass + Aerodynamic Mirrors)
  let leftDoorPivot: THREE.Object3D | null = null;
  let rightDoorPivot: THREE.Object3D | null = null;
  const doorStyle: 'swing' | 'scissor' | 'none' = spec.openWheel
    ? 'none'
    : archetype === 'hyper' || archetype === 'gt' || archetype === 'prototype' || archetype === 'crown'
    ? 'scissor'
    : 'swing';

  if (doorStyle !== 'none') {
    const doorLen = Math.min(1.42, Math.max(0.96, (spec.rearWheelZ - spec.frontWheelZ) * 0.48));
    const doorFrontZ = seatZ - doorLen * 0.62;
    const doorMidZ = doorFrontZ + doorLen * 0.5;
    const doorEnv = bodySampler.sample(doorMidZ);
    const doorH = Math.max(0.42, (doorEnv.topY - doorEnv.botY) * 0.76);
    const doorCenterY = spec.rideHeight + (doorEnv.topY + doorEnv.botY) * 0.52;
    const doorMountHW = getPlanHalfWidthAt(doorMidZ, contourParams);
    const doorCardMat = new THREE.MeshStandardMaterial({ color: 0x161b26, roughness: 0.65 });

    const buildDoor = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (doorMountHW - 0.01), doorCenterY, doorFrontZ);

      // Compound-curved painted outer door skin
      const skin = new THREE.Mesh(createCurvedDoorSkinGeometry(doorLen, doorH, side), paintMat);
      skin.castShadow = castShadow;
      pivot.add(skin);

      // Crisp panel-gap seam line & lower rocker accent trim
      const sillTrim = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.048, doorLen * 0.94), carbonMat);
      sillTrim.position.set(side * 0.015, -doorH * 0.44, doorLen * 0.5);
      pivot.add(sillTrim);

      // Inner leather door card + padded armrest + metallic speaker ring
      const innerCard = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, doorH * 0.84, doorLen * 0.92),
        doorCardMat
      );
      innerCard.position.set(-side * 0.025, 0, doorLen * 0.5);
      pivot.add(innerCard);

      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.052, doorLen * 0.56), accentMat);
      armrest.position.set(-side * 0.055, -0.02, doorLen * 0.54);
      pivot.add(armrest);

      const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), chromeMat);
      speaker.rotation.z = Math.PI / 2;
      speaker.position.set(-side * 0.045, -0.12, doorLen * 0.24);
      pivot.add(speaker);

      // Recessed flush chrome exterior door handle
      const handlePocket = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.056, 0.22), glossTrimMat);
      handlePocket.position.set(side * 0.036, doorH * 0.24, doorLen * 0.72);
      pivot.add(handlePocket);

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.18), chromeMat);
      handle.position.set(side * 0.046, doorH * 0.24, doorLen * 0.72);
      pivot.add(handle);

      // Frameless curved side window glass (omitted on open-top roadsters)
      if (!spec.openTop) {
        const winH = Math.max(0.28, spec.rideHeight + roofMaxY - (doorCenterY + doorH * 0.5) - 0.04);
        const sideGlass = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, winH, doorLen * 0.76),
          glassMat
        );
        sideGlass.position.set(-side * 0.06, doorH * 0.5 + winH * 0.44, doorLen * 0.54);
        sideGlass.rotation.z = side * 0.26;
        sideGlass.renderOrder = 4;
        pivot.add(sideGlass);
      }

      // Aerodynamic Side Mirror mounted on the front of the door (swings/lifts with the door!)
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.038, 0.05), glossTrimMat);
      stalk.position.set(side * 0.09, doorH * 0.44, 0.14);
      pivot.add(stalk);

      const mirrorCap = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.12, 6, 10), paintMat);
      mirrorCap.rotation.z = Math.PI / 2;
      mirrorCap.position.set(side * 0.18, doorH * 0.5, 0.16);
      pivot.add(mirrorCap);

      const mirrorLed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.016, 0.018), drlMat);
      mirrorLed.position.set(side * 0.18, doorH * 0.5, 0.1);
      pivot.add(mirrorLed);

      bodyGroup.add(pivot);
      return pivot;
    };

    leftDoorPivot = buildDoor(-1);
    rightDoorPivot = buildDoor(1);
  }

  // 5. Photorealistic Front Fascia: Recessed Honeycomb Grille, Brake Air Curtains, Angled Multi-Lens LED Matrix Headlights!
  const frontEnv = bodySampler.sample(frontZ + 0.18);
  const frontMidY = spec.rideHeight + THREE.MathUtils.lerp(frontEnv.botY, frontEnv.topY, 0.48);
  const headlightBeams: THREE.Mesh[] = [];
  const beamMat = new THREE.MeshBasicMaterial({
    color: hlEmissive,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  if (!isFormula) {
    const grilleW = noseHW * 1.06;
    const grilleH = isBoxy ? 0.34 : 0.23;
    const grilleY = spec.rideHeight + Math.max(0.18, frontEnv.botY + grilleH * 0.62);

    // Sculpted chrome/gloss-black grille surround frame
    const grilleFrame = new THREE.Mesh(
      new THREE.BoxGeometry(grilleW + 0.08, grilleH + 0.06, 0.1),
      isSporty ? glossTrimMat : chromeMat
    );
    grilleFrame.position.set(0, grilleY, frontZ + 0.05);
    bodyGroup.add(grilleFrame);

    // Textured hexagonal metallic honeycomb intake grille mesh
    const grilleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(grilleW, grilleH, 0.115),
      grilleMat
    );
    grilleMesh.position.set(0, grilleY, frontZ + 0.042);
    bodyGroup.add(grilleMesh);

    // Side brake-cooling air curtain intakes flanking the main grille
    [-1, 1].forEach((side) => {
      const intakeX = side * (noseHW * 0.72);
      const intakePocket = new THREE.Mesh(
        new THREE.BoxGeometry(noseHW * 0.36, grilleH * 0.76, 0.1),
        grilleMat
      );
      intakePocket.position.set(intakeX, grilleY - 0.01, frontZ + 0.1);
      intakePocket.rotation.y = -side * 0.24;
      bodyGroup.add(intakePocket);

      const aeroBlade = new THREE.Mesh(
        new THREE.BoxGeometry(noseHW * 0.38, 0.022, 0.12),
        isSporty ? accentMat : glossTrimMat
      );
      aeroBlade.position.set(intakeX, grilleY - 0.01, frontZ + 0.095);
      aeroBlade.rotation.y = -side * 0.24;
      bodyGroup.add(aeroBlade);
    });

    // Metallic sculpted hood emblem crest
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.022, 16), chromeMat);
    emblem.rotation.x = Math.PI / 2 - 0.45;
    emblem.position.set(0, spec.rideHeight + frontEnv.topY + 0.01, frontZ + 0.12);
    bodyGroup.add(emblem);

    // Crisp textured Front License Plate
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.115, 0.024), plateMat);
    frontPlate.position.set(0, grilleY - grilleH * 0.12, frontZ - 0.018);
    bodyGroup.add(frontPlate);

    // Angled Multi-Lens Optical LED Matrix Headlights + Crystal Glass Lens Covers + Swept DRLs
    const hlX = noseHW * 0.68;
    const hlY = Math.max(grilleY + grilleH * 0.56, frontMidY + 0.06);

    [-1, 1].forEach((side) => {
      const hx = side * hlX;
      const hlGroup = new THREE.Group();
      hlGroup.position.set(hx, hlY, frontZ + 0.14);
      hlGroup.rotation.y = -side * 0.26;
      hlGroup.rotation.x = -0.14;

      // Dark sculpted inner optical housing
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.16), glossTrimMat);
      hlGroup.add(housing);

      // Dual glowing crystal LED matrix projector lenses
      [-0.095, 0.085].forEach((px, idx) => {
        const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.04, 12), chromeMat);
        bezel.rotation.x = Math.PI / 2;
        bezel.position.set(px, -0.005, -0.068);
        hlGroup.add(bezel);

        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(idx === 0 ? 0.042 : 0.036, 12, 10),
          headlightMat
        );
        bulb.position.set(px, -0.005, -0.075);
        hlGroup.add(bulb);
      });

      // Crisp swept signature LED Daytime Running Light (DRL) blade
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.022, 0.03), drlMat);
      drl.position.set(0, 0.052, -0.078);
      drl.rotation.z = side * -0.08;
      hlGroup.add(drl);

      // Sleek curved outer crystal headlight lens cover
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.145, 0.032), headlightLensMat);
      lens.position.set(0, 0, -0.082);
      hlGroup.add(lens);

      bodyGroup.add(hlGroup);

      // Volumetric forward headlight cone illuminating the road ahead (activated at night/dusk)
      const beamGeo = new THREE.ConeGeometry(2.1, 18, 16, 1, true);
      beamGeo.translate(0, -9, 0);
      beamGeo.rotateX(Math.PI / 2 - 0.06);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(hx, hlY, frontZ - 0.14);
      beam.visible = false;
      bodyGroup.add(beam);
      headlightBeams.push(beam);
    });
  } else {
    // Formula 1 nose camera pod & twin minimal laser marker lights
    [-0.14, 0.14].forEach((hx) => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), headlightMat);
      marker.position.set(hx, spec.rideHeight + 0.34, frontZ + 0.42);
      bodyGroup.add(marker);

      const beamGeo = new THREE.ConeGeometry(1.9, 17, 14, 1, true);
      beamGeo.translate(0, -8.5, 0);
      beamGeo.rotateX(Math.PI / 2 - 0.06);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(hx, spec.rideHeight + 0.34, frontZ - 0.1);
      beam.visible = false;
      bodyGroup.add(beam);
      headlightBeams.push(beam);
    });
  }

  // 6. Photorealistic Rear Fascia: Wrapped 3D OLED Taillights, License Plate, Multi-Fin Carbon Diffuser & Titanium Exhausts
  const rearEnv = bodySampler.sample(rearZ - 0.16);
  const tailY = spec.rideHeight + THREE.MathUtils.lerp(rearEnv.botY, rearEnv.topY, 0.72);
  const brakeLights: THREE.Mesh[] = [];

  if (!isFormula) {
    // Recessed gloss-black rear taillight valence panel
    const tailValence = new THREE.Mesh(
      new THREE.BoxGeometry(rearHW * 1.72, 0.165, 0.12),
      glossTrimMat
    );
    tailValence.position.set(0, tailY, rearZ - 0.05);
    bodyGroup.add(tailValence);

    // Continuous slim OLED lightbar connecting left & right clusters
    if (archetype !== 'muscle' && !isBoxy) {
      const lightBar = new THREE.Mesh(
        new THREE.BoxGeometry(rearHW * 1.56, 0.028, 0.05),
        brakeLightMat
      );
      lightBar.position.set(0, tailY, rearZ + 0.015);
      bodyGroup.add(lightBar);
      brakeLights.push(lightBar);
    }

    // Wrapped 3D OLED taillight clusters curving cleanly around the rear bumper corners
    [-1, 1].forEach((side) => {
      const cluster = new THREE.Group();
      cluster.position.set(side * (rearHW * 0.68), tailY, rearZ - 0.02);
      cluster.rotation.y = side * 0.22;

      if (archetype === 'muscle' || archetype === 'modernMuscle') {
        // Iconic tri-bar muscle OLED taillight blades
        [-0.12, 0, 0.12].forEach((bx) => {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.115, 0.055), brakeLightMat);
          blade.position.set(bx, 0, 0.02);
          cluster.add(blade);
          brakeLights.push(blade);
        });
      } else {
        // Sculpted dual-tier modern 3D OLED taillight blades + corner wrap
        const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.075, 0.055), brakeLightMat);
        mainBlade.position.set(0, 0.01, 0.022);
        cluster.add(mainBlade);
        brakeLights.push(mainBlade);

        const wrapFin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.16), brakeLightMat);
        wrapFin.position.set(side * 0.17, 0.01, -0.055);
        cluster.add(wrapFin);
        brakeLights.push(wrapFin);
      }

      bodyGroup.add(cluster);
    });

    // Recessed Rear License Plate
    const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.115, 0.024), plateMat);
    rearPlate.position.set(0, Math.max(spec.rideHeight + 0.28, tailY - 0.22), rearZ + 0.022);
    bodyGroup.add(rearPlate);
  } else {
    // Formula 1 central FIA rain LED light
    const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.05), brakeLightMat);
    rainLight.position.set(0, spec.rideHeight + 0.3, rearZ + 0.03);
    bodyGroup.add(rainLight);
    brakeLights.push(rainLight);
  }

  // Multi-fin carbon rear aerodynamic diffuser
  const diffW = isFormula ? rearHW * 1.6 : rearHW * 1.66;
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(diffW, 0.2, 0.24), carbonMat);
  diffuser.position.set(0, spec.rideHeight + 0.13, rearZ - 0.06);
  bodyGroup.add(diffuser);
  [-0.45, -0.22, 0, 0.22, 0.45].forEach((fx) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.17, 0.26), carbonMat);
    fin.position.set(fx * diffW * 0.9, spec.rideHeight + 0.11, rearZ - 0.02);
    bodyGroup.add(fin);
  });

  // 7. Double-Walled Titanium Exhaust Pipes & Glowing Nitro Afterburner Cones
  const nitroFlames: THREE.Mesh[] = [];
  const exhaustOffsets = isFormula
    ? [0]
    : spec.quadExhaust
    ? [-rearHW * 0.62, -rearHW * 0.42, rearHW * 0.42, rearHW * 0.62]
    : [-rearHW * 0.54, rearHW * 0.54];

  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });
  const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  exhaustOffsets.forEach((ex) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.064, 0.072, 0.26, 14),
      titaniumExhaustMat
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, spec.rideHeight + 0.14, rearZ + 0.05);
    bodyGroup.add(pipe);

    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.06, 12),
      innerWheelWellMat
    );
    bore.rotation.x = Math.PI / 2;
    bore.position.set(ex, spec.rideHeight + 0.14, rearZ + 0.165);
    bodyGroup.add(bore);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.35, 12), outerFlameMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(ex, spec.rideHeight + 0.14, rearZ + 0.84);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.78, 10), innerFlameMat);
    core.position.y = -0.22;
    flame.add(core);
    flame.visible = false;
    bodyGroup.add(flame);
    nitroFlames.push(flame);
  });

  // 8. Bespoke Liveries, Cyber Neon Lines, Hood Vents & Front Aero Canards
  const livery = visual?.livery ?? (spec.racingStripe ? 'singleStripe' : 'clean');
  const hoodMidZ = (frontZ + roofMinZ) * 0.5;
  const hoodY = spec.rideHeight + bodySampler.sample(hoodMidZ).topY + 0.048;
  const hoodLen = Math.max(0.7, Math.abs(roofMinZ - frontZ) * 0.74);
  const hoodSlope = Math.atan2(
    bodySampler.sample(frontZ + 0.25).topY - bodySampler.sample(roofMinZ - 0.1).topY,
    Math.max(0.4, roofMinZ - frontZ - 0.35)
  );
  const flankHW = getPlanHalfWidthAt(0.05, contourParams);

  if (livery === 'singleStripe') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, hoodLen), accentMat);
    stripe.position.set(0, hoodY, hoodMidZ);
    stripe.rotation.x = hoodSlope;
    bodyGroup.add(stripe);
  } else if (livery === 'twinStripe') {
    [-0.17, 0.17].forEach((sx) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, hoodLen), accentMat);
      stripe.position.set(sx, hoodY, hoodMidZ);
      stripe.rotation.x = hoodSlope;
      bodyGroup.add(stripe);
    });
  } else if (livery === 'sideFlash') {
    [-1, 1].forEach((side) => {
      const flash = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.11, spec.length * 0.44), accentMat);
      flash.position.set(side * (flankHW + 0.012), spec.rideHeight + 0.42, 0.08);
      flash.rotation.x = -0.05;
      bodyGroup.add(flash);
    });
  } else if (livery === 'checker') {
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 5; i++) {
        const sq = new THREE.Mesh(
          new THREE.BoxGeometry(0.042, 0.1, 0.2),
          i % 2 === 0 ? accentMat : chromeMat
        );
        sq.position.set(
          side * (flankHW + 0.012),
          spec.rideHeight + 0.34 + (i % 2) * 0.09,
          -0.5 + i * 0.24
        );
        bodyGroup.add(sq);
      }
    });
  } else if (livery === 'cyberGlow') {
    const glowMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 3.1,
      roughness: 0.1,
    });
    [-1, 1].forEach((side) => {
      const sideStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.036, spec.length * 0.48),
        glowMat
      );
      sideStrip.position.set(side * (flankHW + 0.018), spec.rideHeight + 0.26, 0.05);
      bodyGroup.add(sideStrip);
    });
    const hoodLine = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.02, hoodLen * 0.88), glowMat);
    hoodLine.position.set(0, hoodY + 0.006, hoodMidZ);
    hoodLine.rotation.x = hoodSlope;
    bodyGroup.add(hoodLine);
  } else if (livery === 'police') {
    const whiteDoorMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.16,
      metalness: 0.25,
      clearcoat: 1.0,
    });
    [-1, 1].forEach((side) => {
      const doorPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.4, spec.length * 0.32),
        whiteDoorMat
      );
      doorPanel.position.set(side * (flankHW + 0.012), spec.rideHeight + 0.44, 0.02);
      bodyGroup.add(doorPanel);
    });
  }

  if (visual?.hoodVent && !isFormula) {
    [-0.34, 0.34].forEach((vx) => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.032, 0.48), carbonMat);
      vent.position.set(vx, hoodY + 0.004, hoodMidZ);
      vent.rotation.x = hoodSlope;
      bodyGroup.add(vent);
    });
  }

  if (visual?.canards && !spec.openWheel) {
    [-1, 1].forEach((side) => {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.3), carbonMat);
      canard.position.set(side * (noseHW + 0.03), spec.rideHeight + 0.22, frontZ + 0.26);
      canard.rotation.z = side * 0.24;
      bodyGroup.add(canard);
    });
  }

  // 9. Sculpted Spoilers & Wings (9 distinct aero styles!)
  const spoilerType = visual?.spoiler ?? spec.spoiler;
  const deckY = spec.rideHeight + rearEnv.topY + 0.02;

  if (spoilerType === 'lip') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(rearHW * 1.72, 0.06, 0.22), carbonMat);
    lip.position.set(0, deckY + 0.03, rearZ - 0.12);
    lip.rotation.x = 0.22;
    bodyGroup.add(lip);
  } else if (spoilerType === 'ducktail') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(rearHW * 1.76, 0.18, 0.26), paintMat);
    duck.position.set(0, deckY + 0.07, rearZ - 0.08);
    duck.rotation.x = 0.48;
    bodyGroup.add(duck);
  } else if (spoilerType === 'twinFin') {
    [-rearHW * 0.68, rearHW * 0.68].forEach((fx) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.68), carbonMat);
      fin.position.set(fx, deckY + 0.18, rearZ - 0.24);
      fin.rotation.x = 0.22;
      bodyGroup.add(fin);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.64), accentMat);
      trim.position.set(fx, deckY + 0.39, rearZ - 0.2);
      trim.rotation.x = 0.22;
      bodyGroup.add(trim);
    });
  } else if (
    spoilerType === 'rally' ||
    spoilerType === 'gt' ||
    spoilerType === 'swanNeck' ||
    spoilerType === 'crown'
  ) {
    const wingY =
      deckY +
      (spoilerType === 'rally' ? 0.34 : spoilerType === 'swanNeck' ? 0.48 : 0.42);
    const wingW =
      spec.width *
      (spoilerType === 'gt' || spoilerType === 'swanNeck' || spoilerType === 'crown' ? 1.04 : 0.92);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(wingW, 0.065, spoilerType === 'swanNeck' ? 0.4 : 0.34),
      spoilerType === 'crown' ? accentMat : carbonMat
    );
    blade.position.set(0, wingY, rearZ - 0.12);
    blade.rotation.x = 0.12;
    bodyGroup.add(blade);

    if (spoilerType === 'crown') {
      const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.82, 0.048, 0.22), carbonMat);
      upperDeck.position.set(0, wingY + 0.16, rearZ - 0.08);
      upperDeck.rotation.x = 0.16;
      bodyGroup.add(upperDeck);
    }

    const strutOffset = spoilerType === 'swanNeck' ? wingW * 0.22 : wingW * 0.32;
    [-strutOffset, strutOffset].forEach((sx) => {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, spoilerType === 'swanNeck' ? 0.48 : 0.42, 0.2),
        carbonMat
      );
      strut.position.set(sx, wingY - 0.21, rearZ - (spoilerType === 'swanNeck' ? 0.2 : 0.12));
      strut.rotation.x = spoilerType === 'swanNeck' ? 0.24 : 0;
      bodyGroup.add(strut);
    });
    [-wingW * 0.5, wingW * 0.5].forEach((epx) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.24, 0.42),
        spoilerType === 'crown' ? accentMat : paintMat
      );
      plate.position.set(epx, wingY, rearZ - 0.12);
      bodyGroup.add(plate);
    });
  } else if (spoilerType === 'formula') {
    // Multi-element sculpted Formula 1 front wing + endplates
    const fWingMain = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 1.04, 0.055, 0.42), carbonMat);
    fWingMain.position.set(0, spec.rideHeight + 0.08, frontZ - 0.02);
    bodyGroup.add(fWingMain);

    const fWingFlap = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.98, 0.042, 0.2), accentMat);
    fWingFlap.position.set(0, spec.rideHeight + 0.14, frontZ + 0.08);
    fWingFlap.rotation.x = 0.22;
    bodyGroup.add(fWingFlap);

    [-spec.width * 0.52, spec.width * 0.52].forEach((ex) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.22, 0.48), paintMat);
      ep.position.set(ex, spec.rideHeight + 0.16, frontZ + 0.02);
      bodyGroup.add(ep);
    });

    // Dual-plane Formula 1 DRS rear wing + swan-neck pylon + endplates
    const rWing = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.88, 0.075, 0.4), carbonMat);
    rWing.position.set(0, spec.rideHeight + 0.94, rearZ - 0.1);
    bodyGroup.add(rWing);

    const rDrs = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.84, 0.05, 0.18), accentMat);
    rDrs.position.set(0, spec.rideHeight + 1.06, rearZ - 0.02);
    rDrs.rotation.x = 0.24;
    bodyGroup.add(rDrs);

    [-spec.width * 0.44, spec.width * 0.44].forEach((ex) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.44, 0.48), paintMat);
      ep.position.set(ex, spec.rideHeight + 0.88, rearZ - 0.08);
      bodyGroup.add(ep);
    });

    [-0.22, 0.22].forEach((sx) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.22), carbonMat);
      strut.position.set(sx, spec.rideHeight + 0.68, rearZ - 0.12);
      bodyGroup.add(strut);
    });
  }

  // 10. Archetype & Roof Accessories (Scoops, LED Lightbars, Police Sirens, LMP1 Dorsal Fins, Blowers, Monster Suspension)
  const roofAcc = visual?.roofAccessory ?? (spec.roofRack ? 'rack' : 'none');
  const roofTopY = roofEdgeY + (isBoxy ? 0.05 : 0.08);
  const roofMidZ = (roofFrontZ + roofRearZ) * 0.5;

  if (roofAcc === 'scoop' && !spec.openTop && !isFormula) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.17, 0.78), carbonMat);
    scoop.position.set(0, roofTopY + 0.06, roofMidZ + 0.1);
    bodyGroup.add(scoop);
  } else if (roofAcc === 'lightbar') {
    const barHousing = new THREE.Mesh(new THREE.BoxGeometry(topFrontHW * 1.75, 0.1, 0.13), carbonMat);
    barHousing.position.set(0, roofTopY + 0.06, roofFrontZ + 0.1);
    bodyGroup.add(barHousing);
    const barLens = new THREE.Mesh(new THREE.BoxGeometry(topFrontHW * 1.62, 0.06, 0.055), headlightMat);
    barLens.position.set(0, roofTopY + 0.06, roofFrontZ + 0.03);
    bodyGroup.add(barLens);
  } else if (roofAcc === 'siren') {
    const sirenBase = new THREE.Mesh(new THREE.BoxGeometry(topFrontHW * 1.55, 0.075, 0.22), carbonMat);
    sirenBase.position.set(0, roofTopY + 0.04, roofMidZ);
    bodyGroup.add(sirenBase);
    const redPod = new THREE.Mesh(
      new THREE.BoxGeometry(topFrontHW * 0.68, 0.12, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xff1e2d, emissive: 0xff1e2d, emissiveIntensity: 3.4 })
    );
    redPod.position.set(-topFrontHW * 0.4, roofTopY + 0.09, roofMidZ);
    bodyGroup.add(redPod);
    const bluePod = new THREE.Mesh(
      new THREE.BoxGeometry(topFrontHW * 0.68, 0.12, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x38bdf8, emissiveIntensity: 3.4 })
    );
    bluePod.position.set(topFrontHW * 0.4, roofTopY + 0.09, roofMidZ);
    bodyGroup.add(bluePod);
  } else if (roofAcc === 'dorsalFin') {
    const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.38, 1.48), carbonMat);
    dorsal.position.set(0, roofEdgeY - 0.05, rearZ - 0.92);
    bodyGroup.add(dorsal);
    const dorsalEdge = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.05, 1.44), accentMat);
    dorsalEdge.position.set(0, roofEdgeY + 0.12, rearZ - 0.92);
    bodyGroup.add(dorsalEdge);
  } else if (roofAcc === 'rack') {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(topFrontHW * 1.72, 0.09, 1.5), carbonMat);
    rack.position.set(0, roofTopY + 0.07, roofMidZ);
    bodyGroup.add(rack);
  }

  if (spec.rearLouvers) {
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.6) / 4.4;
      const zL = THREE.MathUtils.lerp(roofRearZ, roofMaxZ, t);
      const yL = THREE.MathUtils.lerp(roofEdgeY, beltRearY, t) + 0.02;
      const wL = THREE.MathUtils.lerp(topRearHW, baseRearHW, t) * 1.82;
      const slat = new THREE.Mesh(new THREE.BoxGeometry(wL, 0.032, 0.11), carbonMat);
      slat.position.set(0, yL, zL);
      slat.rotation.x = 0.28;
      bodyGroup.add(slat);
    }
  }

  if (spec.liftedSuspension) {
    const shockMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.72, roughness: 0.24 });
    [spec.frontWheelZ, spec.rearWheelZ].forEach((az) => {
      const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, spec.width * 0.84, 12),
        carbonMat
      );
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0, spec.wheelRadius, az);
      bodyGroup.add(axle);
      [-0.65, 0.65].forEach((sx) => {
        const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.52, 10), shockMat);
        shock.position.set(sx, spec.wheelRadius + 0.22, az);
        bodyGroup.add(shock);
      });
    });
  }

  if (spec.blower) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.32, 0.7), chromeMat);
    block.position.set(0, hoodY + 0.16, -1.16);
    bodyGroup.add(block);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.12), caliperMat);
    intake.position.set(0, hoodY + 0.26, -1.52);
    bodyGroup.add(intake);
  }

  if (spec.sideIntakes && !isFormula) {
    const intakeZ = spec.rearWheelZ - spec.wheelRadius - 0.42;
    const intakeHW = getPlanHalfWidthAt(intakeZ, contourParams);
    [-1, 1].forEach((side) => {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.62), glossTrimMat);
      scoop.position.set(side * (intakeHW - 0.02), spec.rideHeight + 0.42, intakeZ);
      bodyGroup.add(scoop);
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.52), accentMat);
      vane.position.set(side * (intakeHW - 0.01), spec.rideHeight + 0.42, intakeZ);
      bodyGroup.add(vane);
    });
  }

  if (spec.bullbar) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(noseHW * 1.48, 0.34, 0.12), chromeMat);
    bar.position.set(0, spec.rideHeight + 0.34, frontZ - 0.08);
    bodyGroup.add(bar);
  }

  if (spec.fogLights) {
    [-0.36, -0.12, 0.12, 0.36].forEach((fx) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.11, 14), headlightMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(fx, spec.rideHeight + 0.5, frontZ - 0.02);
      bodyGroup.add(pod);
    });
  }

  if (spec.rollCage) {
    [-0.64, 0.64].forEach((rx) => {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.22, 12), chromeMat);
      bar.position.set(rx, spec.rideHeight + 1.1, 1.12);
      bar.rotation.x = -0.45;
      bodyGroup.add(bar);
    });
  }

  if (spec.pickupBed) {
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.72, 0.12, 1.48), carbonMat);
    bedFloor.position.set(0, spec.rideHeight + 0.84, 1.45);
    bodyGroup.add(bedFloor);
  }

  if (spec.haloCockpit) {
    const haloArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.036, 8, 22, Math.PI),
      carbonMat
    );
    haloArc.rotation.x = Math.PI / 2 - 0.18;
    haloArc.position.set(0, spec.rideHeight + 0.94, 0.2);
    bodyGroup.add(haloArc);

    const haloPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.34, 8), carbonMat);
    haloPillar.position.set(0, spec.rideHeight + 0.84, -0.22);
    haloPillar.rotation.x = -0.35;
    bodyGroup.add(haloPillar);
  }

  // Optional HDR Glowing Neon Underglow Kit
  if (visual?.underglowHex) {
    const ugColor = new THREE.Color(visual.underglowHex);
    const ugMat = new THREE.MeshBasicMaterial({
      color: ugColor,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ugPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width * 1.38, spec.length * 1.12),
      ugMat
    );
    ugPlane.rotation.x = -Math.PI / 2;
    ugPlane.position.y = 0.04;
    root.add(ugPlane);

    const ugTubeMat = new THREE.MeshStandardMaterial({
      color: ugColor,
      emissive: ugColor,
      emissiveIntensity: 3.2,
    });
    [-1, 1].forEach((side) => {
      const tube = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, spec.length * 0.64),
        ugTubeMat
      );
      tube.position.set(side * (flankHW * 0.88), spec.rideHeight + 0.01, 0);
      bodyGroup.add(tube);
    });
  }

  // 11. Four Photorealistic Radial Lathe Wheels with Stationary Brembo Brake Calipers & Steering Pivots
  const wheels: THREE.Object3D[] = [];
  const frontWheelPivots: THREE.Object3D[] = [];
  const wheelCoords: [number, number, boolean, -1 | 1][] = [
    [-wheelX, spec.frontWheelZ, true, -1],
    [wheelX, spec.frontWheelZ, true, 1],
    [-wheelX, spec.rearWheelZ, false, -1],
    [wheelX, spec.rearWheelZ, false, 1],
  ];

  wheelCoords.forEach(([wx, wz, isFront, side]) => {
    const pivot = new THREE.Group();
    pivot.position.set(wx, spec.wheelRadius, wz);
    const { spinning, hub } = buildDetailedWheel(
      spec.wheelRadius,
      spec.wheelWidth,
      side,
      tireMat,
      rimMat,
      accentMat,
      caliperMat,
      discMat,
      innerWheelWellMat,
      castShadow,
      visual?.rimStyle ?? 'twin5',
      neonRimMat
    );
    // Stationary caliper attaches to steering pivot; spinning wheel rotates freely inside!
    pivot.add(hub);
    pivot.add(spinning);
    root.add(pivot);
    wheels.push(spinning);
    if (isFront) frontWheelPivots.push(pivot);
  });

  // 12. Soft Ground Contact Shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 1.48, spec.length * 1.24),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.82,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  // 13. Revive Invulnerability Shield Bubble
  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(spec.width, spec.length) * 0.56, 20, 14),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      wireframe: true,
    })
  );
  shieldMesh.position.y = spec.rideHeight + 0.72;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return {
    root,
    bodyGroup,
    wheels,
    frontWheelPivots,
    nitroFlames,
    brakeLights,
    headlightBeams,
    paintMaterials: [paintMat],
    shieldMesh,
    steeringWheel,
    leftGripTarget,
    rightGripTarget,
    driverHead: driverRig.bones.head,
    driverAnchor,
    driverScale,
    driverRig,
    driverAnimator,
    leftDoorPivot,
    rightDoorPivot,
    doorStyle,
    cabinLight,
    cockpitCameraOffset,
  };
}

export type TrafficKind = 'sedan' | 'van' | 'truck' | 'bus' | 'rival';

export interface TrafficRig {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  halfWidth: number;
  halfLength: number;
  kind: TrafficKind;
  leftBlinker: THREE.Mesh;
  rightBlinker: THREE.Mesh;
  brakeLightMats: THREE.MeshStandardMaterial[];
  rivalBeacon?: THREE.Mesh;
  rivalFlame?: THREE.Mesh;
}

const TRAFFIC_COLORS = [
  '#cbd5e1', // Silver Metallic
  '#1e293b', // Slate Obsidian
  '#f1f5f9', // Pearl White
  '#1e3a5f', // Deep Sapphire Navy
  '#7f1d1d', // Metallic Burgundy
  '#475569', // Gunmetal Gray
  '#785a3a', // Champagne Bronze
  '#14532d', // British Racing Green
];

/**
 * Helper for sculpted traffic greenhouses (curved front/rear glass + crowned roof + connected pillars).
 */
function addTrafficGreenhouse(
  parent: THREE.Group,
  rideHeight: number,
  bodySampler: ProfileSampler,
  contour: BodyContourParams,
  cabMinZ: number,
  roofFrontZ: number,
  roofRearZ: number,
  cabMaxZ: number,
  roofTopY: number,
  paintMat: THREE.Material,
  glassMat: THREE.Material,
  trimMat: THREE.Material,
  isSport: boolean
): void {
  const bFY = rideHeight + bodySampler.sample(cabMinZ).topY - 0.02;
  const bRY = rideHeight + bodySampler.sample(cabMaxZ).topY - 0.02;
  const rY = rideHeight + roofTopY;

  const bFHW = getPlanHalfWidthAt(cabMinZ, contour) * 0.84;
  const bRHW = getPlanHalfWidthAt(cabMaxZ, contour) * 0.82;
  const tFHW = bFHW * (isSport ? 0.76 : 0.82);
  const tRHW = bRHW * (isSport ? 0.72 : 0.82);

  const wsBL = new THREE.Vector3(-bFHW, bFY, cabMinZ);
  const wsBR = new THREE.Vector3(bFHW, bFY, cabMinZ);
  const wsTR = new THREE.Vector3(tFHW, rY, roofFrontZ);
  const wsTL = new THREE.Vector3(-tFHW, rY, roofFrontZ);

  const rwTL = new THREE.Vector3(-tRHW, rY, roofRearZ);
  const rwTR = new THREE.Vector3(tRHW, rY, roofRearZ);
  const rwBR = new THREE.Vector3(bRHW, bRY, cabMaxZ);
  const rwBL = new THREE.Vector3(-bRHW, bRY, cabMaxZ);

  parent.add(new THREE.Mesh(createCurvedSheetGeometry(wsBL, wsBR, wsTR, wsTL, -0.075, 0.03, 7, 4), glassMat));
  parent.add(new THREE.Mesh(createCurvedSheetGeometry(rwBR, rwBL, rwTL, rwTR, 0.065, 0.025, 7, 4), glassMat));
  parent.add(new THREE.Mesh(createCurvedSheetGeometry(wsBL, rwBL, rwTL, wsTL, 0, 0.012, 5, 3), glassMat));
  parent.add(new THREE.Mesh(createCurvedSheetGeometry(rwBR, wsBR, wsTR, rwTR, 0, 0.012, 5, 3), glassMat));

  parent.add(new THREE.Mesh(createCurvedRoofGeometry(wsTL, wsTR, rwTR, rwTL, 0.05, isSport, 0.045), paintMat));
  parent.add(createConnectedPillar(wsBL, wsTL, 0.038, 0.048, trimMat, false));
  parent.add(createConnectedPillar(wsBR, wsTR, 0.038, 0.048, trimMat, false));
  parent.add(createConnectedPillar(rwBL, rwTL, 0.05, 0.075, paintMat, false));
  parent.add(createConnectedPillar(rwBR, rwTR, 0.05, 0.075, paintMat, false));
}

export function buildTrafficVehicle(
  kind: TrafficKind,
  colorIndex: number,
  shadowTexture: THREE.Texture
): TrafficRig {
  const root = new THREE.Group();
  const color = kind === 'rival' ? '#e11d48' : TRAFFIC_COLORS[colorIndex % TRAFFIC_COLORS.length];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: kind === 'rival' ? 0.12 : 0.17,
    metalness: kind === 'rival' ? 0.64 : 0.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.95,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.24,
    metalness: 0.22,
    clearcoat: 0.72,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 0.42, metalness: 0.35 });
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createHoneycombGrilleTexture(),
    roughness: 0.45,
    metalness: 0.68,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createLicensePlateTexture(),
    roughness: 0.36,
    metalness: 0.22,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x091322,
    roughness: 0.03,
    metalness: 0.42,
    clearcoat: 1.0,
    side: THREE.DoubleSide,
    envMapIntensity: 2.3,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.14, metalness: 0.94 });
  const innerWellMat = new THREE.MeshStandardMaterial({ color: 0x07090e, roughness: 0.95, side: THREE.DoubleSide });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8dc, emissiveIntensity: 2.8 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff1e2d, emissive: 0xdc2626, emissiveIntensity: 1.45 });
  const blinkerMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  let w = 2.04;
  let l = 4.42;
  let wheelR = 0.41;
  let wheelW = 0.32;
  let zPairs: number[] = [-1.36, 1.36];
  let rivalBeacon: THREE.Mesh | undefined;
  let rivalFlame: THREE.Mesh | undefined;
  let lightY = 0.72;
  let tailY = 0.78;

  if (kind === 'rival') {
    w = 2.24;
    l = 4.72;
    wheelR = 0.44;
    wheelW = 0.38;
    zPairs = [-1.42, 1.42];
    lightY = 0.64;
    tailY = 0.74;
    const profile: [number, number][] = [
      [-2.3, 0.02], [2.24, 0.02], [2.36, 0.24], [2.3, 0.72], [1.48, 0.78],
      [-1.08, 0.68], [-2.04, 0.48], [-2.34, 0.26], [-2.36, 0.08],
    ];
    const contour: BodyContourParams = {
      bodyWidth: w,
      minZ: -2.36,
      maxZ: 2.36,
      frontWheelZ: -1.42,
      rearWheelZ: 1.42,
      wheelRadius: wheelR,
      wheelWidth: wheelW,
      rideHeight: 0.18,
      openWheel: false,
      isFormula: false,
      isSporty: true,
      isBoxy: false,
      lifted: false,
    };
    const body = new THREE.Mesh(createSculptedCarBodyGeometry(profile, contour, false), paintMat);
    body.position.y = 0.18;
    root.add(body);

    const sampler = createProfileSampler(profile);
    addTrafficGreenhouse(root, 0.18, sampler, contour, -1.04, -0.42, 0.56, 1.56, 1.18, paintMat, glassMat, trimMat, true);

    // GT Carbon Rear Wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.07, 0.34), trimMat);
    wing.position.set(0, 1.24, l / 2 - 0.16);
    root.add(wing);
    [-w * 0.32, w * 0.32].forEach((sx) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.18), trimMat);
      strut.position.set(sx, 1.04, l / 2 - 0.16);
      root.add(strut);
    });

    rivalBeacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    rivalBeacon.position.set(0, 2.55, 0);
    root.add(rivalBeacon);

    rivalFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 1.4, 10),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 })
    );
    rivalFlame.rotation.x = Math.PI / 2;
    rivalFlame.position.set(0, 0.36, l / 2 + 0.8);
    root.add(rivalFlame);
  } else if (kind === 'van') {
    // Realistic Modern Sculpted Luxury SUV / Crossover with carved wheel arches & greenhouse
    w = 2.14;
    l = 4.74;
    wheelR = 0.48;
    wheelW = 0.36;
    zPairs = [-1.42, 1.42];
    lightY = 0.84;
    tailY = 0.94;
    const profile: [number, number][] = [
      [-2.3, 0.05], [2.26, 0.05], [2.36, 0.3], [2.32, 0.92], [1.86, 0.96],
      [-0.98, 0.92], [-2.06, 0.78], [-2.34, 0.48], [-2.36, 0.18],
    ];
    const contour: BodyContourParams = {
      bodyWidth: w,
      minZ: -2.36,
      maxZ: 2.36,
      frontWheelZ: -1.42,
      rearWheelZ: 1.42,
      wheelRadius: wheelR,
      wheelWidth: wheelW,
      rideHeight: 0.28,
      openWheel: false,
      isFormula: false,
      isSporty: false,
      isBoxy: true,
      lifted: false,
    };
    const body = new THREE.Mesh(createSculptedCarBodyGeometry(profile, contour, false), paintMat);
    body.position.y = 0.28;
    root.add(body);

    const sampler = createProfileSampler(profile);
    addTrafficGreenhouse(root, 0.28, sampler, contour, -0.98, -0.5, 1.56, 2.02, 1.58, paintMat, glassMat, trimMat, false);
  } else if (kind === 'truck') {
    w = 2.26;
    l = 6.38;
    wheelR = 0.49;
    wheelW = 0.36;
    zPairs = [-2.22, 1.78];
    lightY = 0.76;
    tailY = 0.74;
    const cabProfile: [number, number][] = [
      [-3.14, 0.08], [-1.18, 0.08], [-1.18, 1.9], [-2.42, 1.9],
      [-2.82, 1.15], [-3.16, 0.78], [-3.16, 0.22],
    ];
    const cabContour: BodyContourParams = {
      bodyWidth: w * 0.92,
      minZ: -3.16,
      maxZ: -1.18,
      frontWheelZ: -2.22,
      rearWheelZ: 1.78,
      wheelRadius: wheelR,
      wheelWidth: wheelW,
      rideHeight: 0.28,
      openWheel: false,
      isFormula: false,
      isSporty: false,
      isBoxy: true,
      lifted: false,
    };
    const cab = new THREE.Mesh(createSculptedCarBodyGeometry(cabProfile, cabContour, false), paintMat);
    cab.position.y = 0.28;
    root.add(cab);

    const wind = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.62, 0.1), glassMat);
    wind.position.set(0, 1.66, -2.92);
    wind.rotation.x = -0.34;
    root.add(wind);

    const cargo = new THREE.Mesh(new THREE.BoxGeometry(w, 2.34, 4.18), whiteMat);
    cargo.position.set(0, 1.84, 0.96);
    root.add(cargo);

    const cargoStripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.025, 0.28, 4.19), paintMat);
    cargoStripe.position.set(0, 1.84, 0.96);
    root.add(cargoStripe);

    const chassisRail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.34, 4.2), trimMat);
    chassisRail.position.set(0, 0.56, 0.96);
    root.add(chassisRail);
  } else if (kind === 'bus') {
    w = 2.34;
    l = 7.45;
    wheelR = 0.5;
    wheelW = 0.36;
    zPairs = [-2.52, 1.78, 2.86];
    lightY = 0.78;
    tailY = 0.92;
    const busProfile: [number, number][] = [
      [-3.66, 0.08], [3.66, 0.08], [3.72, 0.35], [3.68, 2.52], [3.38, 2.74],
      [-3.32, 2.74], [-3.68, 2.36], [-3.72, 0.35],
    ];
    const busContour: BodyContourParams = {
      bodyWidth: w,
      minZ: -3.72,
      maxZ: 3.72,
      frontWheelZ: -2.52,
      rearWheelZ: 2.32,
      wheelRadius: wheelR,
      wheelWidth: wheelW,
      rideHeight: 0.28,
      openWheel: false,
      isFormula: false,
      isSporty: false,
      isBoxy: true,
      lifted: false,
    };
    const body = new THREE.Mesh(createSculptedCarBodyGeometry(busProfile, busContour, false), paintMat);
    body.position.y = 0.28;
    root.add(body);

    const windows = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.92, l * 0.86), glassMat);
    windows.position.set(0, 2.02, 0);
    root.add(windows);
  } else {
    // Realistic Sculpted Modern Sport Sedan with carved circular wheel arches & open greenhouse
    w = 2.04;
    l = 4.42;
    wheelR = 0.41;
    wheelW = 0.33;
    zPairs = [-1.36, 1.36];
    lightY = 0.68;
    tailY = 0.78;
    const profile: [number, number][] = [
      [-2.14, 0.04], [2.1, 0.04], [2.2, 0.24], [2.16, 0.72], [1.4, 0.8],
      [-0.98, 0.76], [-1.84, 0.6], [-2.18, 0.36], [-2.2, 0.14],
    ];
    const contour: BodyContourParams = {
      bodyWidth: w,
      minZ: -2.2,
      maxZ: 2.2,
      frontWheelZ: -1.36,
      rearWheelZ: 1.36,
      wheelRadius: wheelR,
      wheelWidth: wheelW,
      rideHeight: 0.22,
      openWheel: false,
      isFormula: false,
      isSporty: false,
      isBoxy: false,
      lifted: false,
    };
    const body = new THREE.Mesh(createSculptedCarBodyGeometry(profile, contour, false), paintMat);
    body.position.y = 0.22;
    root.add(body);

    const sampler = createProfileSampler(profile);
    addTrafficGreenhouse(root, 0.22, sampler, contour, -0.98, -0.4, 0.64, 1.4, 1.32, paintMat, glassMat, trimMat, false);

    // Sculpted side mirrors
    [-1, 1].forEach((side) => {
      const mirror = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.1, 4, 8), paintMat);
      mirror.rotation.z = Math.PI / 2;
      mirror.position.set(side * (w * 0.5 + 0.08), 1.04, -0.52);
      root.add(mirror);
    });
  }

  // Front honeycomb grille + angled projector headlights + wrapped OLED rear lightbar + license plate
  const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, 0.22, 0.08), grilleMat);
  grille.position.set(0, lightY - 0.16, -l / 2 + 0.04);
  root.add(grille);

  [-1, 1].forEach((side) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.08), headMat);
    hl.position.set(side * w * 0.32, lightY, -l / 2 + 0.06);
    hl.rotation.y = -side * 0.22;
    root.add(hl);
  });

  // Full-width realistic rear OLED brake lightbar (glows intensely when AI brakes)
  const tailPanel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.14, 0.08), trimMat);
  tailPanel.position.set(0, tailY, l / 2 - 0.02);
  root.add(tailPanel);

  const rearBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.74, 0.06, 0.06), tailMat);
  rearBar.position.set(0, tailY, l / 2 + 0.018);
  root.add(rearBar);

  // Crisp textured rear license plate
  const rPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.025), plateMat);
  rPlate.position.set(0, Math.max(0.48, tailY - 0.22), l / 2 + 0.02);
  root.add(rPlate);

  // Turn Signal Blinkers (amber)
  const leftBlinker = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), blinkerMat);
  leftBlinker.position.set(-w * 0.39, tailY, l / 2 + 0.05);
  leftBlinker.visible = false;
  root.add(leftBlinker);

  const rightBlinker = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), blinkerMat);
  rightBlinker.position.set(w * 0.39, tailY, l / 2 + 0.05);
  rightBlinker.visible = false;
  root.add(rightBlinker);

  // Lathe-profiled Radial Tires & Concave Alloy Rims tucked inside the wheel arches
  const wheels: THREE.Object3D[] = [];
  const tireGeo = createRadialTireGeometry(wheelR, wheelW, 20);
  const rimGeo = createRimBarrelGeometry(wheelR, wheelW, 18);
  const spokeGeo = new THREE.BoxGeometry(wheelW * 0.18, wheelR * 1.16, wheelR * 0.085);
  const wheelMountX = w * 0.5 - wheelW * 0.38;

  zPairs.forEach((wz) => {
    [-1, 1].forEach((side) => {
      // Dark wheel-well backing disc behind each traffic wheel
      const wellBack = new THREE.Mesh(new THREE.CircleGeometry(wheelR + 0.06, 14), innerWellMat);
      wellBack.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      wellBack.position.set(side * (wheelMountX - wheelW * 0.55), wheelR, wz);
      root.add(wellBack);

      const wg = new THREE.Group();
      wg.position.set(side * wheelMountX, wheelR, wz);
      wg.add(new THREE.Mesh(tireGeo, tireMat));
      wg.add(new THREE.Mesh(rimGeo, rimMat));
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.position.x = side * wheelW * 0.28;
        spoke.rotation.x = (s / 5) * Math.PI;
        wg.add(spoke);
      }
      root.add(wg);
      wheels.push(wg);
    });
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.42, l * 1.2),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.74,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.022;
  root.add(shadow);

  return {
    root,
    wheels,
    halfWidth: w * 0.47,
    halfLength: l * 0.48,
    kind,
    leftBlinker,
    rightBlinker,
    brakeLightMats: [tailMat],
    rivalBeacon,
    rivalFlame,
  };
}

export { buildRealisticSpectator as buildRoadsideSpectator, type SpectatorRig } from './humanBuilder';
