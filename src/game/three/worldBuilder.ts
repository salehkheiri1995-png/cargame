import * as THREE from 'three';
import type { EnvironmentConfig, EnvironmentId } from '../types';
import { buildRealisticSpectator, type HumanArchetype, type SpectatorRig } from './humanBuilder';
import {
  createBuildingFacadeTexture,
  createCheckpointBannerTexture,
  createHighwayGantryTexture,
  createNeonBillboardTexture,
  createRoadPbrTextures,
  createSignTexture,
  createSkyDomeTexture,
  createTerrainTexture,
  type RoadPbrTextures,
} from './textures';

export const ROAD_WIDTH = 14.8;
export const ROAD_LENGTH = 260;
export const LANE_CENTERS = [-4.95, -1.65, 1.65, 4.95];

export function getCurveOffsetX(z: number, curveStrength: number): number {
  if (z >= 0) return 0;
  return curveStrength * z * z * 0.00058;
}

export function getHillOffsetY(z: number, hillStrength: number): number {
  if (z >= 0) return 0;
  const ramp = Math.min(1, -z / 36);
  return hillStrength * Math.sin(-z * 0.022) * ramp * ramp;
}

interface BendableSurface {
  geometry: THREE.BufferGeometry;
  basePositions: Float32Array;
  meshZ: number;
  isRotatedPlane: boolean;
}

export interface WorldRig {
  group: THREE.Group;
  roadTextures: RoadPbrTextures;
  terrainTexture: THREE.CanvasTexture;
  props: THREE.Group[];
  propBaseX: number[];
  roadSideFurniture: THREE.Group[];
  furnitureBaseX: number[];
  gantries: THREE.Group[];
  spectators: SpectatorRig[];
  clouds: THREE.Group[];
  snowPoints: THREE.Points | null;
  rainPoints: THREE.Points | null;
  checkpointArch: THREE.Group;
  bendables: BendableSurface[];
  disposables: { dispose: () => void }[];
}

export function applyWorldCurvature(
  rig: WorldRig,
  curveStrength: number,
  hillStrength: number
): void {
  for (let s = 0; s < rig.bendables.length; s++) {
    const b = rig.bendables[s];
    const pos = b.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const base = b.basePositions;
    const count = pos.count;

    if (b.isRotatedPlane) {
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const bx = base[i3];
        const by = base[i3 + 1];
        const bz = base[i3 + 2];
        const worldZ = b.meshZ - by;
        arr[i3] = bx + getCurveOffsetX(worldZ, curveStrength);
        arr[i3 + 2] = bz + getHillOffsetY(worldZ, hillStrength);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const bx = base[i3];
        const by = base[i3 + 1];
        const bz = base[i3 + 2];
        const worldZ = b.meshZ + bz;
        arr[i3] = bx + getCurveOffsetX(worldZ, curveStrength);
        arr[i3 + 1] = by + getHillOffsetY(worldZ, hillStrength);
      }
    }
    pos.needsUpdate = true;
  }
}

function registerBendable(
  list: BendableSurface[],
  geometry: THREE.BufferGeometry,
  meshZ: number,
  isRotatedPlane: boolean
): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  list.push({
    geometry,
    basePositions: new Float32Array(pos.array as Float32Array),
    meshZ,
    isRotatedPlane,
  });
}

function buildModernSkyscraper(
  w: number,
  h: number,
  d: number,
  facadeTex: THREE.Texture,
  isNight: boolean,
  neonHex: string
): THREE.Group {
  const g = new THREE.Group();

  // Architectural concrete & glass lobby podium
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.45, 2.8, d + 0.45),
    new THREE.MeshStandardMaterial({
      color: isNight ? 0x0f172a : 0x334155,
      roughness: 0.55,
      metalness: 0.25,
    })
  );
  plinth.position.y = 1.4;
  g.add(plinth);

  // Main modern curtain-wall glass tower
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      map: facadeTex,
      emissive: isNight ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
      emissiveMap: isNight ? facadeTex : null,
      emissiveIntensity: isNight ? 0.92 : 0,
      roughness: 0.26,
      metalness: 0.45,
      envMapIntensity: 1.5,
    })
  );
  body.position.y = 2.8 + h / 2;
  g.add(body);

  // Sleek steel roof parapet
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.55, d + 0.4),
    new THREE.MeshStandardMaterial({
      color: isNight ? 0x1e293b : 0x475569,
      roughness: 0.38,
      metalness: 0.6,
    })
  );
  roof.position.y = 2.8 + h + 0.28;
  g.add(roof);

  // Glowing neon architectural crown band in Night City!
  if (isNight) {
    const neonCrown = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.52, 0.24, d + 0.52),
      new THREE.MeshStandardMaterial({
        color: neonHex,
        emissive: neonHex,
        emissiveIntensity: 3.0,
        roughness: 0.1,
      })
    );
    neonCrown.position.y = 2.8 + h + 0.55;
    g.add(neonCrown);
  }

  // Rooftop mechanical core + spire with red aviation beacon
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.42, 1.4, d * 0.42),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
  );
  core.position.y = 2.8 + h + 1.2;
  g.add(core);

  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.09, 3.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
  );
  spire.position.set(0, 2.8 + h + 3.4, 0);
  g.add(spire);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xff2244,
      emissive: 0xff1e2d,
      emissiveIntensity: isNight ? 3.5 : 1.0,
    })
  );
  beacon.position.set(0, 2.8 + h + 5.0, 0);
  g.add(beacon);

  return g;
}

function buildHighwayGantry(gantryTex: THREE.Texture, isNight: boolean): THREE.Group {
  const g = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x334155 : 0x94a3b8,
    metalness: 0.82,
    roughness: 0.32,
  });

  const spanX = ROAD_WIDTH / 2 + 1.3;
  [-spanX, spanX].forEach((px) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 8.2, 12), steelMat);
    leg.position.set(px, 4.1, 0);
    g.add(leg);
  });

  // Overhead steel bridge truss bars
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(spanX * 2 + 0.8, 0.34, 0.34), steelMat);
  topBeam.position.set(0, 8.1, 0);
  g.add(topBeam);

  const lowBeam = new THREE.Mesh(new THREE.BoxGeometry(spanX * 2 + 0.8, 0.24, 0.24), steelMat);
  lowBeam.position.set(0, 6.75, 0);
  g.add(lowBeam);

  // Crisp realistic highway directional sign board
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 2.45, 0.22),
    new THREE.MeshStandardMaterial({
      map: gantryTex,
      emissive: isNight ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
      emissiveMap: isNight ? gantryTex : null,
      emissiveIntensity: isNight ? 1.15 : 0,
      roughness: 0.32,
    })
  );
  board.position.set(0, 7.45, 0.14);
  g.add(board);

  // Subtle neon accent bar under gantry at night
  if (isNight) {
    const glowBar = new THREE.Mesh(
      new THREE.BoxGeometry(11.6, 0.1, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 3.2,
      })
    );
    glowBar.position.set(0, 6.18, 0.14);
    g.add(glowBar);
  }

  return g;
}

function buildRealisticTree(scale: number, foliageHex: string): THREE.Group {
  const g = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.92 });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * scale, 0.42 * scale, 2.6 * scale, 12),
    barkMat
  );
  trunk.position.y = 1.3 * scale;
  g.add(trunk);

  // Visible diverging natural branches
  [-0.38, 0.38].forEach((ang, idx) => {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.14 * scale, 1.35 * scale, 8),
      barkMat
    );
    branch.position.set((idx === 0 ? -0.32 : 0.32) * scale, 2.35 * scale, 0);
    branch.rotation.z = ang;
    g.add(branch);
  });

  const leafMat = new THREE.MeshStandardMaterial({ color: foliageHex, roughness: 0.78 });
  const highlightMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(foliageHex).offsetHSL(0.02, 0.04, 0.07),
    roughness: 0.72,
  });
  const deepMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(foliageHex).offsetHSL(-0.01, 0.04, -0.08),
    roughness: 0.82,
  });

  const clusters: [number, number, number, number, THREE.Material][] = [
    [0, 3.25, 0, 1.48, leafMat],
    [0.92, 2.8, 0.35, 1.08, highlightMat],
    [-0.86, 2.85, -0.32, 1.04, deepMat],
    [0.12, 4.25, -0.14, 0.96, highlightMat],
    [-0.35, 3.6, 0.65, 0.88, deepMat],
  ];
  clusters.forEach(([x, y, z, r, mat]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 14, 12), mat);
    m.scale.set(1.08, 0.88, 1.08);
    m.position.set(x * scale, y * scale, z * scale);
    g.add(m);
  });

  return g;
}

function buildPineTree(scale: number, snowy: boolean): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * scale, 0.38 * scale, 1.9 * scale, 12),
    new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.92 })
  );
  trunk.position.y = 0.95 * scale;
  g.add(trunk);

  const pineMat = new THREE.MeshStandardMaterial({
    color: snowy ? 0x164e4a : 0x1f4d2e,
    roughness: 0.78,
  });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.42 });

  for (let i = 0; i < 5; i++) {
    const r = (1.95 - i * 0.34) * scale;
    const h = (1.95 - i * 0.16) * scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), pineMat);
    cone.position.y = (2.15 + i * 1.0) * scale;
    g.add(cone);

    if (snowy) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.68, h * 0.48, 14), snowMat);
      cap.position.y = (2.62 + i * 1.0) * scale;
      g.add(cap);
    }
  }
  return g;
}

function buildPalmTree(scale: number): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c4a26, roughness: 0.88 });
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        (0.28 - i * 0.03) * scale,
        (0.35 - i * 0.03) * scale,
        1.26 * scale,
        12
      ),
      trunkMat
    );
    seg.position.set(i * 0.16 * scale, (0.62 + i * 1.12) * scale, 0);
    seg.rotation.z = -0.09 * i;
    g.add(seg);
  }
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2d6a36, roughness: 0.62 });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.CapsuleGeometry(0.26 * scale, 2.3 * scale, 6, 10), frondMat);
    frond.scale.set(1.0, 1.0, 0.32);
    frond.position.set(
      0.65 * scale + Math.cos(angle) * 1.24 * scale,
      5.85 * scale,
      Math.sin(angle) * 1.24 * scale
    );
    frond.rotation.y = -angle;
    frond.rotation.z = Math.PI / 2 - 0.36;
    g.add(frond);
  }
  return g;
}

function buildCanyonFormation(seed: number, sunsetPalette: boolean): THREE.Group {
  const g = new THREE.Group();
  if (seed % 3 === 0 || sunsetPalette) {
    const rockMat = new THREE.MeshStandardMaterial({
      color: sunsetPalette ? 0x7c2d12 : 0xa1491c,
      roughness: 0.88,
    });
    const midMat = new THREE.MeshStandardMaterial({
      color: sunsetPalette ? 0x9a3412 : 0xb45c26,
      roughness: 0.84,
    });
    const topMat = new THREE.MeshStandardMaterial({
      color: sunsetPalette ? 0xc2410c : 0xc87433,
      roughness: 0.8,
    });
    const scaleH = sunsetPalette ? 1.55 : 1.0;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 6.2, 5.4 * scaleH, 14), rockMat);
    base.position.y = 2.7 * scaleH;
    g.add(base);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 2.8 * scaleH, 14), midMat);
    tier2.position.y = 6.6 * scaleH;
    g.add(tier2);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.5, 1.5 * scaleH, 14), topMat);
    cap.position.y = 8.6 * scaleH;
    g.add(cap);
  } else {
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2d6a38, roughness: 0.72 });
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 3.0, 8, 14), cactusMat);
    stem.position.y = 1.9;
    g.add(stem);
    const arm1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.1, 6, 12), cactusMat);
    arm1.position.set(0.7, 2.35, 0);
    arm1.rotation.z = -0.45;
    g.add(arm1);
    const arm2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.95, 6, 12), cactusMat);
    arm2.position.set(-0.68, 1.95, 0);
    arm2.rotation.z = 0.45;
    g.add(arm2);
  }
  return g;
}

function buildHighwaySign(signTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.78, roughness: 0.28 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.6, 12), postMat);
  post.position.y = 1.8;
  g.add(post);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 1.72, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
  );
  frame.position.y = 3.65;
  g.add(frame);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.56, 1.56, 0.16),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.25 })
  );
  board.position.y = 3.65;
  g.add(board);
  return g;
}

function buildHighwayLampPost(side: number, accentHex: string, isNight: boolean): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x475569 : 0x94a3b8,
    metalness: 0.8,
    roughness: 0.26,
  });
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0xe0f2fe : 0xfef9c3,
    emissive: isNight ? 0x7dd3fc : 0xfef08a,
    emissiveIntensity: isNight ? 4.2 : 1.8,
    roughness: 0.12,
  });
  const reflectorMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: isNight ? 2.6 : 1.2,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.55, 12), poleMat);
  base.position.y = 0.28;
  g.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.135, 6.4, 12), poleMat);
  pole.position.y = 3.5;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 2.4, 10), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-side * 1.15, 6.62, 0);
  g.add(arm);

  const fixture = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.55, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.36 })
  );
  fixture.rotation.z = Math.PI / 2;
  fixture.position.set(-side * 2.12, 6.58, 0);
  g.add(fixture);

  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.26), lampHeadMat);
  bulb.position.set(-side * 2.12, 6.46, 0);
  g.add(bulb);

  const railPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.92, 0.16), poleMat);
  railPost.position.set(-side * 0.55, 0.46, 0);
  g.add(railPost);

  const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.14), reflectorMat);
  reflector.position.set(-side * 0.62, 0.72, 0);
  g.add(reflector);

  return g;
}

function buildCloud(isNight: boolean, isSunset: boolean): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x1e293b : isSunset ? 0xfdba74 : 0xf8fafc,
    roughness: 0.92,
    metalness: 0,
  });
  const p1 = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 12), mat);
  const p2 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 12), mat);
  p2.position.set(2.3, -0.35, 0.3);
  const p3 = new THREE.Mesh(new THREE.SphereGeometry(2.0, 14, 12), mat);
  p3.position.set(-2.2, -0.4, -0.2);
  const p4 = new THREE.Mesh(new THREE.SphereGeometry(1.75, 14, 10), mat);
  p4.position.set(0.4, 0.9, -0.4);
  g.add(p1, p2, p3, p4);
  return g;
}

function buildCheckpointArch(bannerTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.26, metalness: 0.4 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.6,
  });

  [-ROAD_WIDTH / 2 - 0.8, ROAD_WIDTH / 2 + 0.8].forEach((px) => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.88, 1.0, 14), metalMat);
    base.position.set(px, 0.5, 0);
    g.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 7.6, 14), pillarMat);
    pillar.position.set(px, 4.1, 0);
    g.add(pillar);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), trimMat);
    beacon.position.set(px, 8.2, 0);
    g.add(beacon);
  });

  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(ROAD_WIDTH + 2.6, 2.2, 0.55),
    new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.24 })
  );
  banner.position.set(0, 6.9, 0);
  g.add(banner);

  g.visible = false;
  return g;
}

function buildDigitalBillboard(
  tex: THREE.Texture,
  isNight: boolean,
  side: number
): THREE.Group {
  const g = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.82,
    roughness: 0.3,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 7.6, 12), steelMat);
  pillar.position.y = 3.8;
  g.add(pillar);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(8.8, 4.4, 0.48), steelMat);
  frame.position.set(0, 8.8, 0);
  g.add(frame);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(8.2, 3.9),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: isNight ? 1.55 : 0.45,
      roughness: 0.2,
    })
  );
  screen.position.set(0, 8.8, 0.26);
  g.add(screen);

  // Subtle tilt toward the highway so drivers read it cleanly
  g.rotation.y = side === -1 ? 0.28 : -0.28;
  return g;
}

function buildAlpineChalet(): THREE.Group {
  const g = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.48 });
  const warmWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.6, 4.8), timberMat);
  body.position.y = 1.8;
  g.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.7, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4.9;
  g.add(roof);

  [-1.4, 0, 1.4].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.05), warmWindowMat);
    win.position.set(wx, 1.9, 2.43);
    g.add(win);
  });

  return g;
}

function buildDistantHorizon(envId: EnvironmentId): THREE.Group {
  const g = new THREE.Group();
  const horizonZ = -205;

  if (envId === 'city' || envId === 'nightCity') {
    const isNight = envId === 'nightCity';
    const matA = new THREE.MeshStandardMaterial({
      color: isNight ? 0x0f172a : 0x64748b,
      roughness: 0.65,
      metalness: 0.3,
    });
    const matB = new THREE.MeshStandardMaterial({
      color: isNight ? 0x1e1b4b : 0x475569,
      roughness: 0.65,
      metalness: 0.3,
    });
    for (let i = -8; i <= 8; i++) {
      if (Math.abs(i) <= 1) continue;
      const h = 28 + (Math.abs(i * 19) % 5) * 14;
      const w = 11 + (Math.abs(i) % 3) * 4;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), i % 2 === 0 ? matA : matB);
      tower.position.set(i * 18, h / 2 - 1, horizonZ - (Math.abs(i) % 2) * 18);
      g.add(tower);

      if (isNight && i % 2 === 0) {
        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.4, 0.8, 14.4),
          new THREE.MeshStandardMaterial({
            color: i % 4 === 0 ? 0x38bdf8 : 0xec4899,
            emissive: i % 4 === 0 ? 0x38bdf8 : 0xec4899,
            emissiveIntensity: 3.0,
          })
        );
        crown.position.set(i * 18, h - 1.2, horizonZ - (Math.abs(i) % 2) * 18);
        g.add(crown);
      }
    }

    // Iconic Distant Landmark Observation Needle Spire
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.8, 78, 16), matB);
    needle.position.set(-46, 38, horizonZ - 26);
    g.add(needle);
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 5.4, 6.5, 20),
      new THREE.MeshStandardMaterial({
        color: isNight ? 0x38bdf8 : 0xe2e8f0,
        emissive: isNight ? 0x38bdf8 : 0x000000,
        emissiveIntensity: isNight ? 2.4 : 0,
        roughness: 0.25,
        metalness: 0.7,
      })
    );
    pod.position.set(-46, 62, horizonZ - 26);
    g.add(pod);
  } else if (envId === 'snow' || envId === 'forest') {
    const rockMat = new THREE.MeshStandardMaterial({
      color: envId === 'snow' ? 0x475569 : 0x1c4532,
      roughness: 0.85,
    });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
    for (let i = -6; i <= 6; i++) {
      const r = 26 + (Math.abs(i) % 3) * 11;
      const h = 40 + (Math.abs(i * 7) % 4) * 15;
      const mtn = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), rockMat);
      mtn.position.set(i * 32, h / 2 - 2, horizonZ - 12);
      g.add(mtn);
      if (envId === 'snow') {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.48, h * 0.44, 14), capMat);
        cap.position.set(i * 32, h * 0.78 - 2, horizonZ - 12);
        g.add(cap);
      }
    }
  } else if (envId === 'desert' || envId === 'sunsetCanyon') {
    const mesaMat = new THREE.MeshStandardMaterial({
      color: envId === 'sunsetCanyon' ? 0x6b221a : 0xa15126,
      roughness: 0.86,
    });
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const h = (envId === 'sunsetCanyon' ? 32 : 20) + (Math.abs(i * 5) % 4) * 11;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(14, 26, h, 16), mesaMat);
      mesa.position.set(i * 32, h / 2 - 1, horizonZ - 10);
      g.add(mesa);
    }
  } else if (envId === 'coastal') {
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x2b5e36, roughness: 0.82 });
    [48, 92, 138].forEach((ix, idx) => {
      const isl = new THREE.Mesh(new THREE.ConeGeometry(18 + idx * 5, 14 + idx * 4, 16), islandMat);
      isl.position.set(ix, 5, horizonZ + idx * 14);
      g.add(isl);
    });

    // Iconic Coastal Lighthouse on the closest headland island!
    const lhTower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 2.4, 18, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    lhTower.position.set(48, 20, horizonZ);
    g.add(lhTower);
    const lhStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 2.05, 5, 16),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 })
    );
    lhStripe.position.set(48, 20, horizonZ);
    g.add(lhStripe);
    const lhBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 14, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 3.4,
      })
    );
    lhBeacon.position.set(48, 30, horizonZ);
    g.add(lhBeacon);
  }

  return g;
}

export function buildWorldEnvironment(
  env: EnvironmentConfig,
  maxAnisotropy: number
): WorldRig {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const bendables: BendableSurface[] = [];
  const roadCenterZ = -ROAD_LENGTH * 0.35;
  const isNight = Boolean(env.isNight);
  const isWet = Boolean(env.isWet);

  // 1. Photographic Sky Dome (Daylight, Starry Midnight, or Dramatic Sunset)
  const skyTex = createSkyDomeTexture(env);
  const skyGeo = new THREE.SphereGeometry(285, 32, 20);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.position.set(0, 20, -40);
  group.add(skyDome);
  disposables.push(skyTex, skyGeo, skyMat);

  // 2. Distant Horizon Silhouettes
  group.add(buildDistantHorizon(env.id));

  // 3. Wide Ground Terrain
  const terrainTexture = createTerrainTexture(env.id, env.terrainColor, maxAnisotropy);
  const terrainGeo = new THREE.PlaneGeometry(480, ROAD_LENGTH + 180);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: terrainTexture,
    roughness: isWet ? 0.62 : 0.9,
    metalness: isWet ? 0.14 : 0.02,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(0, -0.1, roadCenterZ);
  terrain.receiveShadow = true;
  group.add(terrain);
  disposables.push(terrainTexture, terrainGeo, terrainMat);

  // Coastal Ocean + Shoreline Foam
  if (env.id === 'coastal') {
    const oceanGeo = new THREE.PlaneGeometry(210, ROAD_LENGTH + 180);
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      roughness: 0.12,
      metalness: 0.24,
      clearcoat: 0.95,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(126, -0.04, roadCenterZ);
    group.add(ocean);

    const foamGeo = new THREE.PlaneGeometry(4.2, ROAD_LENGTH + 180);
    const foamMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.35 });
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(22, -0.03, roadCenterZ);
    group.add(foam);
    disposables.push(oceanGeo, oceanMat, foamGeo, foamMat);
  }

  // 4. Subdivided Bendable Road Shoulders / Concrete Sidewalks
  const shoulderGeo = new THREE.PlaneGeometry(ROAD_WIDTH + 6.4, ROAD_LENGTH + 20, 6, 44);
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: env.shoulderColor,
    roughness: isWet ? 0.45 : 0.82,
    metalness: isWet ? 0.18 : 0.04,
  });
  const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
  shoulder.rotation.x = -Math.PI / 2;
  shoulder.position.set(0, -0.03, roadCenterZ);
  shoulder.receiveShadow = true;
  group.add(shoulder);
  registerBendable(bendables, shoulderGeo, roadCenterZ, true);
  disposables.push(shoulderGeo, shoulderMat);

  // 5. Photorealistic 2048px Wet/Dry PBR 4-Lane Expressway Surface
  const roadTextures = createRoadPbrTextures(env, maxAnisotropy);
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 10, 48);
  const roadMat = new THREE.MeshPhysicalMaterial({
    map: roadTextures.map,
    roughnessMap: roadTextures.roughnessMap,
    bumpMap: roadTextures.bumpMap,
    bumpScale: isWet ? 0.04 : 0.06,
    roughness: isWet ? 0.46 : 0.86,
    metalness: isWet ? 0.18 : 0.08,
    clearcoat: isWet ? 0.65 : 0.08,
    clearcoatRoughness: isWet ? 0.14 : 0.6,
    envMapIntensity: isWet ? 1.85 : 1.05,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.006, roadCenterZ);
  road.receiveShadow = true;
  group.add(road);
  registerBendable(bendables, roadGeo, roadCenterZ, true);
  disposables.push(
    roadTextures.map,
    roadTextures.roughnessMap,
    roadTextures.bumpMap,
    roadGeo,
    roadMat
  );

  // 6. Subdivided Bendable Concrete Curbs + Galvanized Steel Guardrails (Glowing Neon Strips at Night!)
  const curbMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x334155 : 0xcbd5e1,
    roughness: 0.55,
  });
  const railBeamMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x475569 : 0xdbeafe,
    roughness: 0.28,
    metalness: 0.78,
  });
  const railAccentMat = new THREE.MeshStandardMaterial({
    color: env.curbPrimary,
    emissive: isNight ? env.curbPrimary : 0x000000,
    emissiveIntensity: isNight ? 2.4 : 0,
    roughness: 0.3,
    metalness: 0.28,
  });

  [-1, 1].forEach((side) => {
    const cx = side * (ROAD_WIDTH / 2 + 0.3);
    const curbGeo = new THREE.BoxGeometry(0.58, 0.22, ROAD_LENGTH, 1, 1, 44);
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(cx, 0.09, roadCenterZ);
    curb.receiveShadow = true;
    group.add(curb);
    registerBendable(bendables, curbGeo, roadCenterZ, false);
    disposables.push(curbGeo);

    const rx = side * (ROAD_WIDTH / 2 + 0.8);
    const beamGeo = new THREE.BoxGeometry(0.18, 0.26, ROAD_LENGTH, 1, 1, 44);
    const beam = new THREE.Mesh(beamGeo, railBeamMat);
    beam.position.set(rx, 0.62, roadCenterZ);
    group.add(beam);
    registerBendable(bendables, beamGeo, roadCenterZ, false);
    disposables.push(beamGeo);

    const accentGeo = new THREE.BoxGeometry(0.2, 0.075, ROAD_LENGTH, 1, 1, 44);
    const accent = new THREE.Mesh(accentGeo, railAccentMat);
    accent.position.set(rx, 0.62, roadCenterZ);
    group.add(accent);
    registerBendable(bendables, accentGeo, roadCenterZ, false);
    disposables.push(accentGeo);
  });
  disposables.push(curbMat, railBeamMat, railAccentMat);

  // 7. Scrolling Highway Streetlamps + Glowing Road-Edge Cat's-Eye Studs
  const roadSideFurniture: THREE.Group[] = [];
  const furnitureBaseX: number[] = [];
  const studMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x38bdf8 : 0xfacc15,
    emissive: isNight ? 0x38bdf8 : 0xf59e0b,
    emissiveIntensity: isNight ? 3.2 : 1.4,
    roughness: 0.15,
  });
  disposables.push(studMat);
  const lampPairs = 12;
  const lampSpacing = 240 / lampPairs;
  for (let i = 0; i < lampPairs; i++) {
    const z = -212 + i * lampSpacing;
    [-1, 1].forEach((side) => {
      const lamp = buildHighwayLampPost(side, env.curbPrimary, isNight);
      // Glowing road-edge reflector stud seated right inside the curb!
      const stud = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.34), studMat);
      stud.position.set(-side * 1.42, 0.06, 0);
      lamp.add(stud);
      const bx = side * (ROAD_WIDTH / 2 + 1.45);
      lamp.position.set(bx, 0, z);
      group.add(lamp);
      roadSideFurniture.push(lamp);
      furnitureBaseX.push(bx);
    });
  }

  // 8. Realistic Overhead Expressway Gantry Bridges (huge speed & scale realism!)
  const gantries: THREE.Group[] = [];
  const gantryTex = createHighwayGantryTexture(isNight, maxAnisotropy);
  disposables.push(gantryTex);
  for (let i = 0; i < 3; i++) {
    const gantry = buildHighwayGantry(gantryTex, isNight);
    gantry.position.set(0, 0, -55 - i * 82);
    group.add(gantry);
    gantries.push(gantry);
  }

  // 9. Roadside Realistic Articulated 3D Spectators (families, kids, fans & marshals behind guardrails)
  const spectators: SpectatorRig[] = [];
  const groupPatterns: HumanArchetype[][] = [
    ['man', 'child'],
    ['woman', 'child'],
    ['marshal'],
    ['man', 'woman'],
    ['woman', 'child'],
    ['man'],
  ];
  const clusterCount = 12;
  let seedCounter = 0;
  for (let c = 0; c < clusterCount; c++) {
    const side = c % 2 === 0 ? -1 : 1;
    const pattern = groupPatterns[c % groupPatterns.length];
    const clusterBaseZ = -205 + (c / clusterCount) * 235;
    const clusterBaseX = side * (ROAD_WIDTH / 2 + 2.35 + (c % 3) * 0.42);
    pattern.forEach((arch, memberIdx) => {
      seedCounter++;
      const spec = buildRealisticSpectator(seedCounter * 3 + 1, arch);
      const bx = clusterBaseX + side * (memberIdx * 0.24);
      const bz = clusterBaseZ + memberIdx * 0.92;
      const facingY = side === -1 ? Math.PI * 0.48 : -Math.PI * 0.48;
      spec.baseX = bx;
      spec.baseZ = bz;
      spec.facingY = facingY;
      spec.group.position.set(bx, 0, bz);
      spec.group.rotation.y = facingY;
      group.add(spec.group);
      spectators.push(spec);
    });
  }

  // 10. Roadside Pooled Realistic Scenery Props
  const props: THREE.Group[] = [];
  const propBaseX: number[] = [];
  const signTextures = [
    createSignTexture('arrow', maxAnisotropy),
    createSignTexture('turbo', maxAnisotropy),
    createSignTexture('limit', maxAnisotropy),
  ];
  signTextures.forEach((t) => disposables.push(t));

  const cityFacades =
    env.id === 'city' || env.id === 'nightCity'
      ? [
          createBuildingFacadeTexture('#475569', '#7dd3fc', maxAnisotropy, isNight),
          createBuildingFacadeTexture('#64748b', '#bae6fd', maxAnisotropy, isNight),
          createBuildingFacadeTexture('#334155', '#f472b6', maxAnisotropy, isNight),
          createBuildingFacadeTexture('#52525b', '#fde68a', maxAnisotropy, isNight),
          createBuildingFacadeTexture('#3b4c63', '#38bdf8', maxAnisotropy, isNight),
        ]
      : [];
  cityFacades.forEach((t) => disposables.push(t));

  const billboardTextures =
    env.id === 'city' || env.id === 'nightCity'
      ? [
          createNeonBillboardTexture(0, isNight, maxAnisotropy),
          createNeonBillboardTexture(1, isNight, maxAnisotropy),
          createNeonBillboardTexture(2, isNight, maxAnisotropy),
        ]
      : [];
  billboardTextures.forEach((t) => disposables.push(t));

  const neonColors = ['#38bdf8', '#ec4899', '#a855f7', '#facc15', '#2dd4bf'];
  const propCount = 42;

  for (let i = 0; i < propCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -215 + (i / propCount) * 245;
    let prop: THREE.Group;
    let bx: number;

    if (i % 9 === 0) {
      prop = buildHighwaySign(signTextures[i % signTextures.length]);
      bx = side * (ROAD_WIDTH / 2 + 2.65);
    } else if ((env.id === 'city' || env.id === 'nightCity') && i % 8 === 3) {
      prop = buildDigitalBillboard(billboardTextures[i % billboardTextures.length], isNight, side);
      bx = side * (ROAD_WIDTH / 2 + 5.8);
    } else {
      prop = createBiomeProp(env.id, i, side, cityFacades, isNight, neonColors);
      const xOffset =
        env.id === 'city' || env.id === 'nightCity'
          ? ROAD_WIDTH / 2 + 7.8 + (i % 3) * 3.8
          : env.id === 'coastal' && side === 1
          ? ROAD_WIDTH / 2 + 5.0 + (i % 2) * 3.0
          : env.id === 'sunsetCanyon'
          ? ROAD_WIDTH / 2 + 8.2 + (i % 3) * 4.0
          : ROAD_WIDTH / 2 + 5.6 + (i % 4) * 3.6;
      bx = side * xOffset;
    }

    prop.position.set(bx, 0, z);
    group.add(prop);
    props.push(prop);
    propBaseX.push(bx);
  }

  // 11. Atmospheric Clouds
  const clouds: THREE.Group[] = [];
  const isSunset = env.id === 'sunsetCanyon';
  for (let i = 0; i < 12; i++) {
    const cloud = buildCloud(isNight, isSunset);
    const s = 1.35 + (i % 4) * 0.48;
    cloud.scale.setScalar(s);
    cloud.position.set(
      (i % 2 === 0 ? -1 : 1) * (20 + ((i * 13) % 60)),
      26 + (i % 4) * 5.5,
      -210 + i * 20
    );
    group.add(cloud);
    clouds.push(cloud);
  }

  // 12. Falling Snow (Alpine) OR Falling Rain Streaks (Neon Night City!)
  let snowPoints: THREE.Points | null = null;
  if (env.id === 'snow') {
    const count = 300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 68;
      positions[i * 3 + 1] = Math.random() * 24 + 1;
      positions[i * 3 + 2] = -Math.random() * 140 + 15;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.4,
      transparent: true,
      opacity: 0.88,
    });
    snowPoints = new THREE.Points(geo, mat);
    group.add(snowPoints);
    disposables.push(geo, mat);
  }

  let rainPoints: THREE.Points | null = null;
  if (env.rainEnabled) {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 46;
      positions[i * 3 + 1] = Math.random() * 22 + 0.5;
      positions[i * 3 + 2] = -Math.random() * 110 + 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.24,
      transparent: true,
      opacity: 0.62,
    });
    rainPoints = new THREE.Points(geo, mat);
    group.add(rainPoints);
    disposables.push(geo, mat);
  }

  // 13. Checkpoint Archway
  const bannerTex = createCheckpointBannerTexture(maxAnisotropy);
  disposables.push(bannerTex);
  const checkpointArch = buildCheckpointArch(bannerTex);
  group.add(checkpointArch);

  return {
    group,
    roadTextures,
    terrainTexture,
    props,
    propBaseX,
    roadSideFurniture,
    furnitureBaseX,
    gantries,
    spectators,
    clouds,
    snowPoints,
    rainPoints,
    checkpointArch,
    bendables,
    disposables,
  };
}

function createBiomeProp(
  envId: EnvironmentId,
  index: number,
  side: number,
  cityFacades: THREE.Texture[],
  isNight: boolean,
  neonColors: string[]
): THREE.Group {
  switch (envId) {
    case 'city':
    case 'nightCity': {
      if (!isNight && index % 4 === 0) {
        return buildRealisticTree(1.15 + (index % 3) * 0.22, index % 2 === 0 ? '#2d5a27' : '#3a6b35');
      }
      const w = 6.2 + (index % 3) * 1.8;
      const h = (isNight ? 14.0 : 10.5) + (index % 5) * 4.4;
      const d = 6.2 + (index % 2) * 1.8;
      return buildModernSkyscraper(
        w,
        h,
        d,
        cityFacades[index % cityFacades.length],
        isNight,
        neonColors[index % neonColors.length]
      );
    }
    case 'coastal': {
      if (side === 1 && index % 4 === 1) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 3.0, 10),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc })
        );
        pole.position.y = 1.5;
        const canopy = new THREE.Mesh(
          new THREE.ConeGeometry(2.3, 0.92, 16),
          new THREE.MeshStandardMaterial({
            color: index % 2 === 0 ? 0xea580c : 0x0284c7,
            roughness: 0.45,
          })
        );
        canopy.position.y = 3.0;
        g.add(pole, canopy);
        return g;
      }
      return buildPalmTree(1.08 + (index % 3) * 0.22);
    }
    case 'desert':
      return buildCanyonFormation(index, false);
    case 'sunsetCanyon':
      return buildCanyonFormation(index, true);
    case 'forest':
      return index % 2 === 0
        ? buildPineTree(1.35 + (index % 3) * 0.28, false)
        : buildRealisticTree(1.4 + (index % 3) * 0.25, '#255229');
    case 'snow': {
      if (index % 7 === 2) {
        return buildAlpineChalet();
      }
      if (index % 4 === 0) {
        const g = new THREE.Group();
        const peak = new THREE.Mesh(
          new THREE.ConeGeometry(6.4 + (index % 3) * 1.8, 14.5 + (index % 4) * 3.6, 14),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
        );
        peak.position.y = 7.25;
        const cap = new THREE.Mesh(
          new THREE.ConeGeometry(3.3 + (index % 3) * 0.85, 6.2, 14),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42 })
        );
        cap.position.y = 11.8;
        g.add(peak, cap);
        return g;
      }
      return buildPineTree(1.3 + (index % 3) * 0.28, true);
    }
  }
}
