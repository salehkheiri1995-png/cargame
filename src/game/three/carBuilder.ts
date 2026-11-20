import * as THREE from 'three';
import type { CarArchetype, CarRimColor, CarRimStyle, CarSpoilerStyle, CarVisualStyle } from '../types';
import { buildSeatedDriver } from './humanBuilder';
import { createDashboardTexture } from './textures';

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
  driverHead: THREE.Object3D;
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

function createSmoothCurvedExtrusion(
  points: [number, number][],
  width: number,
  bevelThickness = 0.11,
  bevelSize = 0.14
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const p1x = curr[0] + (prev[0] - curr[0]) * 0.24;
    const p1y = curr[1] + (prev[1] - curr[1]) * 0.24;
    const p2x = curr[0] + (next[0] - curr[0]) * 0.24;
    const p2y = curr[1] + (next[1] - curr[1]) * 0.24;
    if (i === 0) {
      shape.moveTo(p1x, p1y);
    } else {
      shape.lineTo(p1x, p1y);
    }
    shape.quadraticCurveTo(curr[0], curr[1], p2x, p2y);
  }
  shape.closePath();

  const innerW = Math.max(0.18, width - bevelThickness * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerW,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 7,
    curveSegments: 16,
  });

  geo.translate(0, 0, -innerW / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a tapered, realistic curved automotive greenhouse cabin (narrower at the roof than beltline!)
 */
function createTaperedCabinGeometry(
  points: [number, number][],
  baseWidth: number,
  taperTop = 0.78
): THREE.BufferGeometry {
  const geo = createSmoothCurvedExtrusion(points, baseWidth, 0.08, 0.1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanY = Math.max(0.01, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y - minY) / spanY, 0, 1);
    const scaleX = THREE.MathUtils.lerp(1.0, taperTop, t * t);
    pos.setX(i, pos.getX(i) * scaleX);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Realistic forged 5-twin-spoke alloy wheel with cross-drilled brake rotor,
 * painted Brembo caliper, lug nuts, and rounded performance tire sidewall!
 */
function buildDetailedWheel(
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  accentMat: THREE.Material,
  caliperMat: THREE.Material,
  discMat: THREE.Material,
  castShadow: boolean,
  rimStyle: CarRimStyle = 'twin5',
  neonRimMat?: THREE.Material
): THREE.Group {
  const g = new THREE.Group();

  // Main radial tire carcass
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 28);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = castShadow;
  g.add(tire);

  // Rounded outer & inner rubber tire shoulders
  const sidewallGeo = new THREE.TorusGeometry(radius * 0.84, width * 0.19, 10, 26);
  sidewallGeo.rotateY(Math.PI / 2);
  [-width * 0.4, width * 0.4].forEach((sx) => {
    const sw = new THREE.Mesh(sidewallGeo, tireMat);
    sw.position.x = sx;
    g.add(sw);
  });

  // Concave deep-dish forged alloy barrel
  const rimBarrelGeo = new THREE.CylinderGeometry(radius * 0.69, radius * 0.69, width + 0.014, 24);
  rimBarrelGeo.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(rimBarrelGeo, rimMat));

  // Optional glowing outer rim lip for neon / cyber rims
  if (neonRimMat) {
    const lipRing = new THREE.TorusGeometry(radius * 0.68, 0.022, 8, 28);
    lipRing.rotateY(Math.PI / 2);
    [-width * 0.51, width * 0.51].forEach((lx) => {
      const m = new THREE.Mesh(lipRing, neonRimMat);
      m.position.x = lx;
      g.add(m);
    });
  }

  // Cross-drilled ventilated steel brake disc
  const discGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width * 0.52, 22);
  discGeo.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(discGeo, discMat));

  // Brembo brake caliper
  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.62, radius * 0.34, radius * 0.24),
    caliperMat
  );
  caliper.position.set(0, radius * 0.36, -radius * 0.24);
  g.add(caliper);

  if (rimStyle === 'turbofan') {
    // Aerodynamic solid disc turbofan wheel with radial cooling vanes
    const discFace = new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, width + 0.026, 24);
    discFace.rotateZ(Math.PI / 2);
    g.add(new THREE.Mesh(discFace, rimMat));
    const vaneGeo = new THREE.BoxGeometry(width + 0.036, radius * 1.18, radius * 0.045);
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Mesh(vaneGeo, accentMat);
      v.rotation.x = (i / 8) * Math.PI;
      g.add(v);
    }
  } else if (rimStyle === 'mesh') {
    // Multi-spoke Y-mesh racing rim (16 fine spokes)
    const spokeGeo = new THREE.BoxGeometry(width + 0.03, radius * 1.26, radius * 0.055);
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.rotation.x = (i / 8) * Math.PI;
      g.add(s);
    }
  } else if (rimStyle === 'deepDish') {
    // Deep polished outer lip + 5 wide star spokes
    const dishRing = new THREE.TorusGeometry(radius * 0.66, 0.042, 8, 26);
    dishRing.rotateY(Math.PI / 2);
    [-width * 0.48, width * 0.48].forEach((dx) => {
      const m = new THREE.Mesh(dishRing, rimMat);
      m.position.x = dx;
      g.add(m);
    });
    const spokeGeo = new THREE.BoxGeometry(width + 0.018, radius * 1.18, radius * 0.14);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.rotation.x = (i / 5) * Math.PI;
      g.add(s);
    }
  } else if (rimStyle === 'blade') {
    // Directional swept hypercar turbine blades
    const spokeGeo = new THREE.BoxGeometry(width + 0.032, radius * 1.24, radius * 0.12);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.rotation.x = (i / 5) * Math.PI + 0.2;
      g.add(s);
    }
  } else if (rimStyle === 'offroad') {
    // Heavy-duty 6-spoke beadlock off-road rim
    const bead = new THREE.TorusGeometry(radius * 0.64, 0.045, 8, 16);
    bead.rotateY(Math.PI / 2);
    [-width * 0.48, width * 0.48].forEach((dx) => {
      const m = new THREE.Mesh(bead, accentMat);
      m.position.x = dx;
      g.add(m);
    });
    const spokeGeo = new THREE.BoxGeometry(width + 0.032, radius * 1.2, radius * 0.15);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.rotation.x = (i / 6) * Math.PI;
      g.add(s);
    }
  } else {
    // Default twin-5 forged alloy spokes
    const spokeGeo = new THREE.BoxGeometry(width + 0.032, radius * 1.24, radius * 0.085);
    for (let i = 0; i < 5; i++) {
      const baseAngle = (i / 5) * Math.PI;
      [-0.1, 0.1].forEach((offset) => {
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        spoke.rotation.x = baseAngle + offset;
        g.add(spoke);
      });
    }
  }

  // Polished center-lock hub cap
  const hubGeo = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width + 0.044, 16);
  hubGeo.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(hubGeo, accentMat));

  return g;
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

  // 1. Photorealistic Automotive Paint (Gloss Metallic / Satin Matte / Mirror Chrome / Chameleon Iridescent!)
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    roughness: isMatte ? 0.56 : isChrome ? 0.05 : 0.14,
    metalness: isMatte ? 0.26 : isChrome ? 0.98 : isIridescent ? 0.72 : 0.56,
    clearcoat: isMatte ? 0.08 : 1.0,
    clearcoatRoughness: isMatte ? 0.42 : 0.04,
    reflectivity: isMatte ? 0.35 : 1.0,
    iridescence: isIridescent ? 1.0 : 0.0,
    iridescenceIOR: 1.42,
    iridescenceThicknessRange: [180, 560],
    envMapIntensity: isChrome ? 2.6 : isMatte ? 1.05 : 2.05,
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.18,
    metalness: 0.52,
    clearcoat: 0.92,
    clearcoatRoughness: 0.07,
    envMapIntensity: 1.75,
  });

  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x161922,
    map: carbonTexture ?? null,
    roughness: 0.34,
    metalness: 0.36,
    clearcoat: 0.75,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.35,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.08,
    metalness: 0.98,
    envMapIntensity: 2.1,
  });

  const titaniumExhaustMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.16,
    metalness: 0.96,
    envMapIntensity: 1.9,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    roughness: 0.04,
    metalness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    envMapIntensity: 2.25,
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
    emissiveIntensity: 3.3,
    roughness: 0.06,
  });

  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: drlEmissive,
    emissiveIntensity: 2.9,
    roughness: 0.08,
  });

  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1e2d,
    emissive: 0xdc2626,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16171b,
    map: tireTreadTexture ?? null,
    roughness: 0.84,
    metalness: 0.05,
  });

  const rimColorKey = visual?.rimColor ?? 'silver';
  const rimMat = new THREE.MeshStandardMaterial({
    color: getRimColorHex(rimColorKey),
    roughness: rimColorKey === 'chrome' ? 0.06 : rimColorKey === 'black' ? 0.34 : 0.14,
    metalness: rimColorKey === 'black' ? 0.65 : 0.94,
    envMapIntensity: rimColorKey === 'chrome' ? 2.4 : 1.9,
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
    roughness: 0.22,
    metalness: 0.55,
  });

  const discMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.3,
    metalness: 0.88,
  });

  const innerWheelWellMat = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    roughness: 0.95,
  });

  // 2. Sculpted Main Automotive Lower Body + Hood Power-Dome
  const bodyW = spec.openWheel ? spec.width * 0.58 : spec.width;
  const bodyGeo = createSmoothCurvedExtrusion(spec.bodyProfile, bodyW, 0.12, 0.15);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.position.y = spec.rideHeight;
  bodyMesh.castShadow = castShadow;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // Subtle sculpted hood bulge / power-dome for authentic automotive surfacing
  if (!spec.openWheel) {
    const hoodDome = new THREE.Mesh(
      new THREE.CapsuleGeometry(bodyW * 0.22, spec.length * 0.24, 6, 12),
      paintMat
    );
    hoodDome.rotation.x = Math.PI / 2;
    hoodDome.scale.set(1.35, 0.24, 1.0);
    hoodDome.position.set(0, spec.rideHeight + 0.72, -spec.length * 0.24);
    bodyGroup.add(hoodDome);
  }

  // Carbon aerodynamic front splitter + side skirts + flared widebody wheel-arch fenders!
  const underbody = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 1.02, 0.075, spec.length * 0.99),
    carbonMat
  );
  underbody.position.set(0, spec.rideHeight + 0.03, 0);
  bodyGroup.add(underbody);

  // Front aerodynamic carbon splitter lip with vertical end-plates
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 1.05, 0.055, 0.36),
    carbonMat
  );
  splitter.position.set(0, spec.rideHeight + 0.04, -spec.length / 2 - 0.06);
  bodyGroup.add(splitter);

  const wheelX = spec.openWheel
    ? spec.width * 0.44
    : spec.width / 2 - spec.wheelWidth * 0.16;

  if (!spec.openWheel) {
    // Sculpted flared widebody fenders & recessed dark wheel wells
    [spec.frontWheelZ, spec.rearWheelZ].forEach((wz) => {
      [-1, 1].forEach((side) => {
        const archOuter = new THREE.Mesh(
          new THREE.TorusGeometry(spec.wheelRadius + 0.1, 0.075, 10, 22, Math.PI),
          paintMat
        );
        archOuter.rotation.y = Math.PI / 2;
        archOuter.position.set(side * (bodyW / 2 + 0.01), spec.wheelRadius, wz);
        bodyGroup.add(archOuter);

        const archTrim = new THREE.Mesh(
          new THREE.TorusGeometry(spec.wheelRadius + 0.065, 0.042, 8, 20, Math.PI),
          carbonMat
        );
        archTrim.rotation.y = Math.PI / 2;
        archTrim.position.set(side * (bodyW / 2 + 0.03), spec.wheelRadius, wz);
        bodyGroup.add(archTrim);

        // Dark recessed wheel well backing
        const well = new THREE.Mesh(
          new THREE.CylinderGeometry(spec.wheelRadius + 0.04, spec.wheelRadius + 0.04, 0.25, 18),
          innerWheelWellMat
        );
        well.rotation.z = Math.PI / 2;
        well.position.set(side * (bodyW / 2 - 0.15), spec.wheelRadius, wz);
        bodyGroup.add(well);
      });
    });

    // Side carbon skirts (handles now live on the interactive hinged 3D doors!)
    [-1, 1].forEach((side) => {
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.09, spec.rearWheelZ - spec.frontWheelZ - spec.wheelRadius * 2.1),
        carbonMat
      );
      skirt.position.set(side * (bodyW / 2 + 0.02), spec.rideHeight + 0.06, 0);
      bodyGroup.add(skirt);
    });
  }

  // 3. Tapered Transparent Automotive Cabin Greenhouse + Full 3D Interior, Driver & Steering Wheel!
  const cabinW = spec.width * spec.cabinWidthFactor;
  const cabinGeo = createTaperedCabinGeometry(spec.cabinProfile, cabinW, 0.78);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.position.y = spec.rideHeight;
  cabinMesh.renderOrder = 3;
  cabinMesh.castShadow = false;
  bodyGroup.add(cabinMesh);

  const roofMaxY = Math.max(...spec.cabinProfile.map((p) => p[1]));
  const roofMinZ = Math.min(...spec.cabinProfile.map((p) => p[0]));
  const roofMaxZ = Math.max(...spec.cabinProfile.map((p) => p[0]));

  // 3B. Full 3D Interior Cabin (Dashboard, Illuminated Gauges, Rotating Steering Wheel, Bucket Seats & Seated Driver)
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
  const beltY = spec.rideHeight + (archetype === 'offroad' || archetype === 'pickup' || archetype === 'monster' || archetype === 'suv' ? 0.72 : archetype === 'formula' ? 0.42 : 0.56);
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
    const consoleTunnel = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 1.05),
      dashMat
    );
    consoleTunnel.position.set(0, beltY + 0.02, seatZ - 0.2);
    interiorGroup.add(consoleTunnel);

    // Metallic Gear Shifter Knob
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

  // Steering Column + Animated 3D Motorsport Steering Wheel (rotates live with player input!)
  const wheelColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.28, 10), carbonMat);
  wheelColumn.rotation.x = Math.PI / 2 - 0.28;
  wheelColumn.position.set(driverX, beltY + 0.23, dashZ + 0.21);
  interiorGroup.add(wheelColumn);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(driverX, beltY + 0.26, dashZ + 0.31);
  steeringWheel.rotation.x = -0.28;

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 24), leatherMat);
  steeringWheel.add(wheelRim);

  // Motorsport 12-o'clock top-center accent stripe on steering wheel rim
  const topMarker = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.046, 0.046), accentMat);
  topMarker.position.set(0, 0.16, 0);
  steeringWheel.add(topMarker);

  // 3 brushed alloy spokes + carbon center airbag/logo hub
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

  // Realistic Seated 3D Driver gripping the steering wheel!
  const useProHelmet =
    archetype === 'formula' ||
    archetype === 'gt' ||
    archetype === 'hyper' ||
    archetype === 'prototype' ||
    archetype === 'crown' ||
    archetype === 'rally' ||
    archetype === 'buggy';
  const cabinHeadroom = Math.max(0.42, roofMaxY - (beltY - spec.rideHeight));
  const driverScale = THREE.MathUtils.clamp(cabinHeadroom / 0.84, 0.68, 0.92);
  const driverRig = buildSeatedDriver({
    useHelmet: useProHelmet,
    suitColorHex: paintHex,
    accentHex,
    scale: driverScale,
  });
  driverRig.root.position.set(driverX, beltY - 0.02, seatZ + 0.02);
  interiorGroup.add(driverRig.root);

  // Warm Interior Cabin Dome Light (fades on smoothly when doors open in the Garage!)
  const cabinLight = new THREE.PointLight(0xffedd5, 0, 3.8, 1.8);
  cabinLight.position.set(0, spec.rideHeight + roofMaxY - 0.08, seatZ - 0.12);
  interiorGroup.add(cabinLight);

  // First-person Cockpit Interior Camera eye position (sees steering wheel, glowing gauges & road ahead!)
  const cockpitCameraOffset = new THREE.Vector3(
    driverX,
    beltY + 0.56 * driverScale,
    seatZ - 0.18
  );

  // Roof Cap, Slim Carbon A-Pillars & Shark-fin Antenna for closed-cabin cars
  if (!spec.openTop) {
    const isTwoTone = visual?.livery === 'twoToneRoof';
    const roofPanel = new THREE.Mesh(
      new THREE.BoxGeometry(cabinW * 0.74, 0.075, (roofMaxZ - roofMinZ) * 0.44),
      archetype === 'hyper' || archetype === 'gt' || archetype === 'prototype' || isTwoTone
        ? carbonMat
        : paintMat
    );
    roofPanel.position.set(
      0,
      spec.rideHeight + roofMaxY + 0.025,
      (roofMinZ + roofMaxZ) * 0.5 + 0.06
    );
    bodyGroup.add(roofPanel);

    // Slim sculpted carbon A-pillars framing the transparent windshield
    [-1, 1].forEach((side) => {
      const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.62, 0.065), carbonMat);
      aPillar.position.set(
        side * (cabinW * 0.42),
        spec.rideHeight + roofMaxY - 0.28,
        roofMinZ + 0.34
      );
      aPillar.rotation.x = -0.62;
      aPillar.rotation.z = side * 0.14;
      bodyGroup.add(aPillar);
    });

    // Sleek shark-fin roof antenna
    const sharkFin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), carbonMat);
    sharkFin.rotation.x = -0.35;
    sharkFin.position.set(0, spec.rideHeight + roofMaxY + 0.11, (roofMinZ + roofMaxZ) * 0.5 + 0.42);
    bodyGroup.add(sharkFin);
  }

  // 4. Interactive Hinged 3D Doors (Swing Doors or Hypercar Upward Scissor Doors + Attached Side Mirrors!)
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
    const doorH = 0.48;
    const doorCenterY = spec.rideHeight + 0.44;
    const doorCardMat = new THREE.MeshStandardMaterial({ color: 0x161b26, roughness: 0.65 });

    const buildDoor = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (bodyW / 2 + 0.015), doorCenterY, doorFrontZ);

      // Painted outer sculpted door skin extending rearward along +Z
      const skin = new THREE.Mesh(new THREE.BoxGeometry(0.065, doorH, doorLen), paintMat);
      skin.position.set(0, 0, doorLen / 2);
      skin.castShadow = castShadow;
      pivot.add(skin);

      // Subtle door sill accent trim
      const sillTrim = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.055, doorLen * 0.94), carbonMat);
      sillTrim.position.set(0, -doorH * 0.42, doorLen / 2);
      pivot.add(sillTrim);

      // Inner leather door card + padded armrest + metallic speaker grille
      const innerCard = new THREE.Mesh(new THREE.BoxGeometry(0.035, doorH * 0.86, doorLen * 0.92), doorCardMat);
      innerCard.position.set(-side * 0.045, 0, doorLen / 2);
      pivot.add(innerCard);

      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, doorLen * 0.56), accentMat);
      armrest.position.set(-side * 0.075, -0.02, doorLen * 0.54);
      pivot.add(armrest);

      const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), chromeMat);
      speaker.rotation.z = Math.PI / 2;
      speaker.position.set(-side * 0.065, -0.12, doorLen * 0.24);
      pivot.add(speaker);

      // Flush chrome exterior door handle
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.04, 0.21), chromeMat);
      handle.position.set(side * 0.038, 0.13, doorLen * 0.72);
      pivot.add(handle);

      // Frameless side window glass (omitted on open-top roadsters for authentic convertible feel)
      if (!spec.openTop) {
        const winH = Math.max(0.28, (spec.rideHeight + roofMaxY - (doorCenterY + doorH / 2)) * 0.76);
        const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.022, winH, doorLen * 0.8), glassMat);
        sideGlass.position.set(-side * 0.055, doorH / 2 + winH * 0.45, doorLen * 0.52);
        sideGlass.rotation.z = side * 0.24;
        sideGlass.renderOrder = 4;
        pivot.add(sideGlass);
      }

      // Aerodynamic Side Mirror mounted on the front of the door (swings/lifts with the door!)
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.042, 0.055), carbonMat);
      stalk.position.set(side * 0.08, doorH * 0.46, 0.14);
      pivot.add(stalk);

      const mirrorCap = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.13, 6, 10), paintMat);
      mirrorCap.rotation.z = Math.PI / 2;
      mirrorCap.position.set(side * 0.17, doorH * 0.52, 0.16);
      pivot.add(mirrorCap);

      const mirrorLed = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, 0.02), drlMat);
      mirrorLed.position.set(side * 0.17, doorH * 0.52, 0.09);
      pivot.add(mirrorLed);

      bodyGroup.add(pivot);
      return pivot;
    };

    leftDoorPivot = buildDoor(-1);
    rightDoorPivot = buildDoor(1);
  }

  // 5. Realistic Front Fascia: Honeycomb Grille, Chrome Surround, Multi-Projector LEDs & Light Cones!
  const frontZ = -spec.length / 2;
  const grilleW = bodyW * 0.56;
  const grilleSurround = new THREE.Mesh(
    new THREE.BoxGeometry(grilleW + 0.08, 0.3, 0.1),
    chromeMat
  );
  grilleSurround.position.set(0, spec.rideHeight + 0.26, frontZ + 0.02);
  bodyGroup.add(grilleSurround);

  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(grilleW, 0.25, 0.12),
    carbonMat
  );
  grille.position.set(0, spec.rideHeight + 0.26, frontZ + 0.01);
  bodyGroup.add(grille);

  // Chrome hood emblem badge
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 16), chromeMat);
  emblem.rotation.x = Math.PI / 2 - 0.35;
  emblem.position.set(0, spec.rideHeight + 0.48, frontZ + 0.08);
  bodyGroup.add(emblem);

  // Front License Plate
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.03), plateMat);
  frontPlate.position.set(0, spec.rideHeight + 0.18, frontZ - 0.04);
  bodyGroup.add(frontPlate);

  // Multi-Projector LED Headlights + Swept Blade DRLs + Volumetric Headlight Beams!
  const headlightBeams: THREE.Mesh[] = [];
  const beamMat = new THREE.MeshBasicMaterial({
    color: hlEmissive,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const hlX = bodyW * 0.35;

  [-hlX, hlX].forEach((hx) => {
    const housing = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.105, 0.26, 6, 12),
      carbonMat
    );
    housing.rotation.z = Math.PI / 2;
    housing.position.set(hx, spec.rideHeight + 0.44, frontZ + 0.08);
    bodyGroup.add(housing);

    // Dual optical projector bulbs inside housing
    [-0.07, 0.07].forEach((px) => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), headlightMat);
      bulb.position.set(hx + px, spec.rideHeight + 0.44, frontZ + 0.01);
      bodyGroup.add(bulb);
    });

    // Sleek LED blade daytime running light
    const drl = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.32, 4, 8), drlMat);
    drl.rotation.z = Math.PI / 2 + (hx < 0 ? 0.14 : -0.14);
    drl.position.set(hx, spec.rideHeight + 0.52, frontZ + 0.03);
    bodyGroup.add(drl);

    // Volumetric forward headlight cone illuminating the road ahead (dramatic at night/dusk!)
    const beamGeo = new THREE.ConeGeometry(2.1, 18, 16, 1, true);
    beamGeo.translate(0, -9, 0);
    beamGeo.rotateX(Math.PI / 2 - 0.06);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(hx, spec.rideHeight + 0.44, frontZ - 0.15);
    beam.visible = false; // Enabled automatically in night/sunset environments
    bodyGroup.add(beam);
    headlightBeams.push(beam);
  });

  // 6. Full-Width 3D OLED Rear Lightbar + Carbon Diffuser + Burnt-Titanium Exhausts
  const rearZ = spec.length / 2;
  const brakeLights: THREE.Mesh[] = [];

  const tailHousing = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.88, 0.17, 0.1),
    carbonMat
  );
  tailHousing.position.set(0, spec.rideHeight + 0.56, rearZ - 0.02);
  bodyGroup.add(tailHousing);

  // Full-width glowing OLED red lightbar + outer 3D signatures
  const lightBar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.032, bodyW * 0.78, 6, 12),
    brakeLightMat
  );
  lightBar.rotation.z = Math.PI / 2;
  lightBar.position.set(0, spec.rideHeight + 0.56, rearZ + 0.04);
  bodyGroup.add(lightBar);
  brakeLights.push(lightBar);

  [-bodyW * 0.34, bodyW * 0.34].forEach((tx) => {
    const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.28, 6, 12), brakeLightMat);
    tl.rotation.z = Math.PI / 2;
    tl.position.set(tx, spec.rideHeight + 0.56, rearZ + 0.045);
    bodyGroup.add(tl);
    brakeLights.push(tl);
  });

  // Rear license plate
  const rearPlate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.03), plateMat);
  rearPlate.position.set(0, spec.rideHeight + 0.35, rearZ + 0.04);
  bodyGroup.add(rearPlate);

  // Multi-fin carbon rear aerodynamic diffuser
  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 0.82, 0.22, 0.22),
    carbonMat
  );
  diffuser.position.set(0, spec.rideHeight + 0.15, rearZ - 0.02);
  bodyGroup.add(diffuser);
  [-0.45, -0.22, 0, 0.22, 0.45].forEach((fx) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.26), carbonMat);
    fin.position.set(fx * bodyW * 0.75, spec.rideHeight + 0.13, rearZ + 0.02);
    bodyGroup.add(fin);
  });

  // 7. Titanium Exhaust Pipes & Glowing Dual/Quad Nitro Afterburner Cones
  const nitroFlames: THREE.Mesh[] = [];
  const exhaustOffsets = spec.quadExhaust
    ? [-0.56, -0.36, 0.36, 0.56]
    : [-bodyW * 0.27, bodyW * 0.27];

  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });
  const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  exhaustOffsets.forEach((ex) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.076, 0.28, 14),
      titaniumExhaustMat
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, spec.rideHeight + 0.15, rearZ + 0.09);
    bodyGroup.add(pipe);

    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.06, 12),
      innerWheelWellMat
    );
    bore.rotation.x = Math.PI / 2;
    bore.position.set(ex, spec.rideHeight + 0.15, rearZ + 0.22);
    bodyGroup.add(bore);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.35, 12), outerFlameMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(ex, spec.rideHeight + 0.15, rearZ + 0.88);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.78, 10), innerFlameMat);
    core.position.y = -0.22;
    flame.add(core);
    flame.visible = false;
    bodyGroup.add(flame);
    nitroFlames.push(flame);
  });

  // 8. Bespoke Liveries, Cyber Neon Lines, Hood Vents & Front Canards
  const livery = visual?.livery ?? (spec.racingStripe ? 'singleStripe' : 'clean');
  const hoodY = spec.rideHeight + (archetype === 'offroad' || archetype === 'pickup' || archetype === 'monster' ? 0.95 : 0.78);

  if (livery === 'singleStripe') {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.022, spec.length * 0.42),
      accentMat
    );
    stripe.position.set(0, hoodY, -spec.length * 0.24);
    bodyGroup.add(stripe);
  } else if (livery === 'twinStripe') {
    [-0.18, 0.18].forEach((sx) => {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.024, spec.length * 0.44),
        accentMat
      );
      stripe.position.set(sx, hoodY, -spec.length * 0.23);
      bodyGroup.add(stripe);
    });
  } else if (livery === 'sideFlash') {
    [-1, 1].forEach((side) => {
      const flash = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.14, spec.length * 0.56),
        accentMat
      );
      flash.position.set(side * (bodyW / 2 + 0.015), spec.rideHeight + 0.44, 0.1);
      flash.rotation.x = -0.06;
      bodyGroup.add(flash);
    });
  } else if (livery === 'checker') {
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 6; i++) {
        const sq = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.12, 0.22),
          i % 2 === 0 ? accentMat : chromeMat
        );
        sq.position.set(
          side * (bodyW / 2 + 0.015),
          spec.rideHeight + 0.36 + (i % 2) * 0.1,
          -0.65 + i * 0.26
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
        new THREE.BoxGeometry(0.055, 0.045, spec.length * 0.62),
        glowMat
      );
      sideStrip.position.set(side * (bodyW / 2 + 0.025), spec.rideHeight + 0.26, 0.05);
      bodyGroup.add(sideStrip);
    });
    const hoodLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.025, spec.length * 0.36),
      glowMat
    );
    hoodLine.position.set(0, hoodY + 0.01, -spec.length * 0.25);
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
        new THREE.BoxGeometry(0.05, 0.44, spec.length * 0.38),
        whiteDoorMat
      );
      doorPanel.position.set(side * (bodyW / 2 + 0.014), spec.rideHeight + 0.45, 0.02);
      bodyGroup.add(doorPanel);
    });
  }

  if (visual?.hoodVent) {
    [-0.36, 0.36].forEach((vx) => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.56), carbonMat);
      vent.position.set(vx, hoodY + 0.01, -spec.length * 0.24);
      bodyGroup.add(vent);
    });
  }

  if (visual?.canards && !spec.openWheel) {
    [-1, 1].forEach((side) => {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.34), carbonMat);
      canard.position.set(side * (bodyW / 2 + 0.05), spec.rideHeight + 0.24, frontZ + 0.2);
      canard.rotation.z = side * 0.24;
      bodyGroup.add(canard);
    });
  }

  // 9. Sculpted Spoilers & Wings (9 distinct aero styles!)
  const spoilerType = visual?.spoiler ?? spec.spoiler;
  if (spoilerType === 'lip') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.07, 0.24), carbonMat);
    lip.position.set(0, spec.rideHeight + 0.8, rearZ - 0.1);
    lip.rotation.x = 0.22;
    bodyGroup.add(lip);
  } else if (spoilerType === 'ducktail') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.94, 0.2, 0.28), paintMat);
    duck.position.set(0, spec.rideHeight + 0.84, rearZ - 0.06);
    duck.rotation.x = 0.48;
    bodyGroup.add(duck);
  } else if (spoilerType === 'twinFin') {
    [-bodyW * 0.36, bodyW * 0.36].forEach((fx) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.48, 0.72), carbonMat);
      fin.position.set(fx, spec.rideHeight + 0.96, rearZ - 0.22);
      fin.rotation.x = 0.22;
      bodyGroup.add(fin);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.68), accentMat);
      trim.position.set(fx, spec.rideHeight + 1.18, rearZ - 0.18);
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
      spec.rideHeight +
      (spoilerType === 'rally' ? 1.1 : spoilerType === 'swanNeck' ? 1.24 : 1.18);
    const wingW =
      spec.width *
      (spoilerType === 'gt' || spoilerType === 'swanNeck' || spoilerType === 'crown' ? 1.06 : 0.94);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(wingW, 0.075, spoilerType === 'swanNeck' ? 0.42 : 0.36),
      spoilerType === 'crown' ? accentMat : carbonMat
    );
    blade.position.set(0, wingY, rearZ - 0.12);
    blade.rotation.x = 0.12;
    bodyGroup.add(blade);

    if (spoilerType === 'crown') {
      const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(wingW * 0.82, 0.05, 0.22), carbonMat);
      upperDeck.position.set(0, wingY + 0.16, rearZ - 0.08);
      upperDeck.rotation.x = 0.16;
      bodyGroup.add(upperDeck);
    }

    const strutOffset = spoilerType === 'swanNeck' ? wingW * 0.22 : wingW * 0.32;
    [-strutOffset, strutOffset].forEach((sx) => {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, spoilerType === 'swanNeck' ? 0.5 : 0.44, 0.22),
        carbonMat
      );
      strut.position.set(sx, wingY - 0.22, rearZ - (spoilerType === 'swanNeck' ? 0.2 : 0.12));
      strut.rotation.x = spoilerType === 'swanNeck' ? 0.24 : 0;
      bodyGroup.add(strut);
    });
    [-wingW * 0.5, wingW * 0.5].forEach((epx) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.26, 0.44),
        spoilerType === 'crown' ? accentMat : paintMat
      );
      plate.position.set(epx, wingY, rearZ - 0.12);
      bodyGroup.add(plate);
    });
  } else if (spoilerType === 'formula') {
    const fWing = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 1.06, 0.075, 0.44), accentMat);
    fWing.position.set(0, spec.rideHeight + 0.11, frontZ - 0.06);
    bodyGroup.add(fWing);

    const rWing = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.92, 0.1, 0.42), carbonMat);
    rWing.position.set(0, spec.rideHeight + 0.96, rearZ - 0.12);
    bodyGroup.add(rWing);

    [-0.5, 0.5].forEach((sx) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, 0.26), carbonMat);
      strut.position.set(sx, spec.rideHeight + 0.72, rearZ - 0.12);
      bodyGroup.add(strut);
    });
  }

  // 10. Archetype & Roof Accessories (Scoops, LED Lightbars, Police Sirens, LMP1 Dorsal Fins, Blowers, Monster Suspension)
  const roofAcc = visual?.roofAccessory ?? (spec.roofRack ? 'rack' : 'none');
  const roofTopY = spec.rideHeight + roofMaxY + 0.08;
  const roofMidZ = (roofMinZ + roofMaxZ) * 0.5;

  if (roofAcc === 'scoop' && !spec.openTop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.82), carbonMat);
    scoop.position.set(0, roofTopY + 0.08, roofMidZ + 0.12);
    bodyGroup.add(scoop);
  } else if (roofAcc === 'lightbar') {
    const barHousing = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.82, 0.11, 0.14), carbonMat);
    barHousing.position.set(0, roofTopY + 0.08, roofMinZ + 0.28);
    bodyGroup.add(barHousing);
    const barLens = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.76, 0.065, 0.06), headlightMat);
    barLens.position.set(0, roofTopY + 0.08, roofMinZ + 0.2);
    bodyGroup.add(barLens);
  } else if (roofAcc === 'siren') {
    const sirenBase = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.72, 0.08, 0.24), carbonMat);
    sirenBase.position.set(0, roofTopY + 0.05, roofMidZ);
    bodyGroup.add(sirenBase);
    const redPod = new THREE.Mesh(
      new THREE.BoxGeometry(cabinW * 0.3, 0.13, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xff1e2d, emissive: 0xff1e2d, emissiveIntensity: 3.4 })
    );
    redPod.position.set(-cabinW * 0.19, roofTopY + 0.1, roofMidZ);
    bodyGroup.add(redPod);
    const bluePod = new THREE.Mesh(
      new THREE.BoxGeometry(cabinW * 0.3, 0.13, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x38bdf8, emissiveIntensity: 3.4 })
    );
    bluePod.position.set(cabinW * 0.19, roofTopY + 0.1, roofMidZ);
    bodyGroup.add(bluePod);
  } else if (roofAcc === 'dorsalFin') {
    const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.55), carbonMat);
    dorsal.position.set(0, spec.rideHeight + roofMaxY - 0.05, rearZ - 0.92);
    bodyGroup.add(dorsal);
    const dorsalEdge = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.055, 1.52), accentMat);
    dorsalEdge.position.set(0, spec.rideHeight + roofMaxY + 0.14, rearZ - 0.92);
    bodyGroup.add(dorsalEdge);
  } else if (roofAcc === 'rack') {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.84, 0.1, 1.56), carbonMat);
    rack.position.set(0, spec.rideHeight + 1.74, 0.52);
    bodyGroup.add(rack);
  }

  if (spec.rearLouvers) {
    for (let i = 0; i < 4; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.66, 0.035, 0.12), carbonMat);
      slat.position.set(0, spec.rideHeight + 1.24 - i * 0.11, 0.84 + i * 0.18);
      slat.rotation.x = 0.25;
      bodyGroup.add(slat);
    }
  }

  if (spec.liftedSuspension) {
    // Visible Monster Truck heavy-duty axle beams & coilover shocks!
    const shockMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25 });
    [spec.frontWheelZ, spec.rearWheelZ].forEach((az) => {
      const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, spec.width * 0.86, 12),
        carbonMat
      );
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0, spec.wheelRadius, az);
      bodyGroup.add(axle);
      [-0.65, 0.65].forEach((sx) => {
        const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.52, 10), shockMat);
        shock.position.set(sx, spec.wheelRadius + 0.22, az);
        bodyGroup.add(shock);
      });
    });
  }

  if (spec.blower) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.72), chromeMat);
    block.position.set(0, spec.rideHeight + 0.95, -1.16);
    bodyGroup.add(block);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.12), caliperMat);
    intake.position.set(0, spec.rideHeight + 1.06, -1.52);
    bodyGroup.add(intake);
  }

  if (spec.sideIntakes) {
    [-1, 1].forEach((side) => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.92), carbonMat);
      vent.position.set(side * (bodyW / 2 - 0.02), spec.rideHeight + 0.46, 0.34);
      bodyGroup.add(vent);
    });
  }

  if (spec.bullbar) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, 0.36, 0.14), chromeMat);
    bar.position.set(0, spec.rideHeight + 0.36, frontZ - 0.1);
    bodyGroup.add(bar);
  }

  if (spec.fogLights) {
    [-0.36, -0.12, 0.12, 0.36].forEach((fx) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 14), headlightMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(fx, spec.rideHeight + 0.54, frontZ - 0.04);
      bodyGroup.add(pod);
    });
  }

  if (spec.rollCage) {
    [-0.68, 0.68].forEach((rx) => {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.25, 12), chromeMat);
      bar.position.set(rx, spec.rideHeight + 1.12, 1.15);
      bar.rotation.x = -0.45;
      bodyGroup.add(bar);
    });
  }

  if (spec.pickupBed) {
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.74, 0.12, 1.52), carbonMat);
    bedFloor.position.set(0, spec.rideHeight + 0.84, 1.45);
    bodyGroup.add(bedFloor);
  }

  if (spec.haloCockpit) {
    // Authentic F1 Carbon Titanium Halo Safety Hoop arching over the helmeted driver
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

  // Optional HDR Glowing Neon Underglow Kit!
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
        new THREE.BoxGeometry(0.04, 0.04, spec.length * 0.68),
        ugTubeMat
      );
      tube.position.set(side * (bodyW * 0.46), spec.rideHeight + 0.01, 0);
      bodyGroup.add(tube);
    });
  }

  // 11. Four Detailed Forged Alloy Wheels with Front Steering Pivots
  const wheels: THREE.Object3D[] = [];
  const frontWheelPivots: THREE.Object3D[] = [];
  const wheelCoords: [number, number, boolean][] = [
    [-wheelX, spec.frontWheelZ, true],
    [wheelX, spec.frontWheelZ, true],
    [-wheelX, spec.rearWheelZ, false],
    [wheelX, spec.rearWheelZ, false],
  ];

  wheelCoords.forEach(([wx, wz, isFront]) => {
    const pivot = new THREE.Group();
    pivot.position.set(wx, spec.wheelRadius, wz);
    const wheelGroup = buildDetailedWheel(
      spec.wheelRadius,
      spec.wheelWidth,
      tireMat,
      rimMat,
      accentMat,
      caliperMat,
      discMat,
      castShadow,
      visual?.rimStyle ?? 'twin5',
      neonRimMat
    );
    pivot.add(wheelGroup);
    root.add(pivot);
    wheels.push(wheelGroup);
    if (isFront) frontWheelPivots.push(pivot);
  });

  // 12. Soft Ground Contact Shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.width * 1.5, spec.length * 1.26),
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
    driverHead: driverRig.headPivot,
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

// Realistic modern metallic highway fleet colors (instead of toy primary plastic colors!)
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

export function buildTrafficVehicle(
  kind: TrafficKind,
  colorIndex: number,
  shadowTexture: THREE.Texture
): TrafficRig {
  const root = new THREE.Group();
  const color = kind === 'rival' ? '#e11d48' : TRAFFIC_COLORS[colorIndex % TRAFFIC_COLORS.length];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: kind === 'rival' ? 0.12 : 0.18,
    metalness: kind === 'rival' ? 0.62 : 0.48,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.85,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.26,
    metalness: 0.2,
    clearcoat: 0.65,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.55, metalness: 0.35 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x060d18,
    roughness: 0.03,
    metalness: 0.45,
    clearcoat: 1.0,
    envMapIntensity: 2.2,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.16, metalness: 0.92 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8dc, emissiveIntensity: 2.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff1e2d, emissive: 0xdc2626, emissiveIntensity: 1.35 });
  const blinkerMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  let w = 2.02;
  let l = 4.38;
  let rivalBeacon: THREE.Mesh | undefined;
  let rivalFlame: THREE.Mesh | undefined;

  if (kind === 'rival') {
    w = 2.22;
    l = 4.68;
    const bodyGeo = createSmoothCurvedExtrusion(
      [
        [-2.28, 0.02], [2.22, 0.02], [2.32, 0.24], [2.26, 0.7], [1.44, 0.76],
        [-1.1, 0.66], [-2.06, 0.46], [-2.32, 0.26], [-2.34, 0.08],
      ],
      w,
      0.11,
      0.14
    );
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.y = 0.18;
    root.add(body);

    const cabGeo = createTaperedCabinGeometry(
      [
        [-1.04, 0.6], [1.56, 0.64], [0.84, 1.16], [0.3, 1.2], [-0.42, 1.18], [-0.94, 0.84],
      ],
      w * 0.74,
      0.76
    );
    const cab = new THREE.Mesh(cabGeo, glassMat);
    cab.position.y = 0.18;
    root.add(cab);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.08, 0.36), trimMat);
    wing.position.set(0, 1.24, l / 2 - 0.16);
    root.add(wing);

    rivalBeacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    rivalBeacon.position.set(0, 2.55, 0);
    root.add(rivalBeacon);

    rivalFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 1.45, 10),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 })
    );
    rivalFlame.rotation.x = Math.PI / 2;
    rivalFlame.position.set(0, 0.36, l / 2 + 0.82);
    root.add(rivalFlame);
  } else if (kind === 'van') {
    // Realistic Modern Luxury SUV / Crossover
    w = 2.1;
    l = 4.78;
    const bodyGeo = createSmoothCurvedExtrusion(
      [
        [-2.32, 0.06], [2.28, 0.06], [2.36, 0.32], [2.32, 1.56], [2.04, 1.72],
        [-1.24, 1.7], [-1.86, 1.04], [-2.36, 0.66], [-2.36, 0.2],
      ],
      w,
      0.1,
      0.13
    );
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.y = 0.28;
    root.add(body);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.54, l * 0.7), glassMat);
    glassBand.position.set(0, 1.46, 0.02);
    root.add(glassBand);
  } else if (kind === 'truck') {
    w = 2.26;
    l = 6.38;
    const cabGeo = createSmoothCurvedExtrusion(
      [
        [-3.12, 0.08], [-1.18, 0.08], [-1.18, 1.9], [-2.4, 1.9],
        [-2.82, 1.15], [-3.16, 0.78], [-3.16, 0.22],
      ],
      w * 0.92,
      0.09,
      0.11
    );
    const cab = new THREE.Mesh(cabGeo, paintMat);
    cab.position.y = 0.28;
    root.add(cab);

    const wind = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.62, 1.15), glassMat);
    wind.position.set(0, 1.56, -2.18);
    root.add(wind);

    const cargo = new THREE.Mesh(new THREE.BoxGeometry(w, 2.38, 4.15), whiteMat);
    cargo.position.set(0, 1.78, 0.94);
    root.add(cargo);

    const cargoStripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.3, 4.16), paintMat);
    cargoStripe.position.set(0, 1.78, 0.94);
    root.add(cargoStripe);
  } else if (kind === 'bus') {
    w = 2.34;
    l = 7.45;
    const busGeo = createSmoothCurvedExtrusion(
      [
        [-3.66, 0.08], [3.66, 0.08], [3.72, 0.35], [3.68, 2.52], [3.38, 2.74],
        [-3.32, 2.74], [-3.68, 2.36], [-3.72, 0.35],
      ],
      w,
      0.1,
      0.12
    );
    const body = new THREE.Mesh(busGeo, paintMat);
    body.position.y = 0.28;
    root.add(body);

    const windows = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.95, l * 0.88), glassMat);
    windows.position.set(0, 2.02, 0);
    root.add(windows);
  } else {
    // Realistic Modern Sport Sedan
    const bodyGeo = createSmoothCurvedExtrusion(
      [
        [-2.14, 0.04], [2.1, 0.04], [2.18, 0.24], [2.14, 0.72], [1.38, 0.78],
        [-0.98, 0.74], [-1.84, 0.6], [-2.16, 0.36], [-2.18, 0.14],
      ],
      w,
      0.1,
      0.13
    );
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.y = 0.22;
    root.add(body);

    const cabGeo = createTaperedCabinGeometry(
      [
        [-0.98, 0.66], [1.38, 0.68], [0.96, 1.3], [0.62, 1.36], [-0.42, 1.35], [-0.88, 1.02],
      ],
      w * 0.76,
      0.78
    );
    const cab = new THREE.Mesh(cabGeo, glassMat);
    cab.position.y = 0.22;
    root.add(cab);

    // Side mirrors
    [-1, 1].forEach((side) => {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.1), paintMat);
      mirror.position.set(side * (w / 2 + 0.08), 1.05, -0.5);
      root.add(mirror);
    });
  }

  // Front grille + bright projector headlights + full-width rear brake lightbar
  const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.26, 0.08), trimMat);
  grille.position.set(0, 0.54, -l / 2 - 0.01);
  root.add(grille);

  [-w * 0.34, w * 0.34].forEach((lx) => {
    const hl = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), headMat);
    hl.rotation.z = Math.PI / 2;
    hl.position.set(lx, 0.72, -l / 2 - 0.02);
    root.add(hl);
  });

  // Full-width realistic rear OLED brake lightbar (glows intensely when AI brakes!)
  const rearBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, w * 0.76, 4, 10), tailMat);
  rearBar.rotation.z = Math.PI / 2;
  rearBar.position.set(0, 0.76, l / 2 + 0.025);
  root.add(rearBar);

  // Rear license plate
  const rPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.12, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
  );
  rPlate.position.set(0, 0.54, l / 2 + 0.03);
  root.add(rPlate);

  // Turn Signal Blinkers (amber)
  const leftBlinker = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), blinkerMat);
  leftBlinker.position.set(-w * 0.42, 0.76, l / 2 + 0.06);
  leftBlinker.visible = false;
  root.add(leftBlinker);

  const rightBlinker = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), blinkerMat);
  rightBlinker.position.set(w * 0.42, 0.76, l / 2 + 0.06);
  rightBlinker.visible = false;
  root.add(rightBlinker);

  // Alloy Wheels
  const wheels: THREE.Object3D[] = [];
  const wheelR = kind === 'truck' || kind === 'bus' ? 0.48 : 0.4;
  const wheelW = 0.3;
  const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.62, wheelR * 0.62, wheelW + 0.02, 16);
  rimGeo.rotateZ(Math.PI / 2);

  const zPairs =
    kind === 'bus'
      ? [-l * 0.34, l * 0.24, l * 0.38]
      : kind === 'truck'
      ? [-l * 0.35, l * 0.28]
      : [-l * 0.32, l * 0.32];

  zPairs.forEach((wz) => {
    [-w / 2 - 0.01, w / 2 + 0.01].forEach((wx) => {
      const wg = new THREE.Group();
      wg.position.set(wx, wheelR, wz);
      wg.add(new THREE.Mesh(tireGeo, tireMat));
      wg.add(new THREE.Mesh(rimGeo, rimMat));
      root.add(wg);
      wheels.push(wg);
    });
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.44, l * 1.2),
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
