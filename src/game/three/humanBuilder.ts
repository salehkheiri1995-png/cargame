import * as THREE from 'three';
import type { DriverSkeletonRig } from './driverAnimator';
import { createHumanFaceTexture } from './textures';

export type HumanArchetype = 'man' | 'woman' | 'child' | 'marshal';

export interface SpectatorRig {
  group: THREE.Group;
  archetype: HumanArchetype;
  headPivot: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftForearm: THREE.Object3D;
  rightForearm: THREE.Object3D;
  phase: number;
  baseX: number;
  baseZ: number;
  facingY: number;
}

export type SeatedDriverRig = DriverSkeletonRig;

const SKIN_TONES = ['#f3cfb4', '#e5b895', '#d49e72', '#b97e53', '#f6d5be'];
const HAIR_COLORS = ['#18181b', '#3f2310', '#5c3317', '#854d0e', '#1f2937', '#713f12'];
const EYE_COLORS = ['#2e4a38', '#3b2516', '#2563eb', '#451a03'];
const MEN_JACKETS = ['#1e293b', '#991b1b', '#0f4c81', '#14532d', '#4c1d95', '#b45309', '#374151'];
const WOMEN_TOPS = ['#be185d', '#0369a1', '#7e22ce', '#0f766e', '#c2410c', '#1d4ed8', '#dc2626'];
const KID_HOODIES = ['#f97316', '#0ea5e9', '#10b981', '#ec4899', '#eab308', '#8b5cf6'];
const PANTS_COLORS = ['#1e293b', '#1e3a5f', '#27272a', '#3f3f46', '#334155'];

let sharedGeos: {
  manTorso: THREE.LatheGeometry;
  womanTorso: THREE.LatheGeometry;
  childTorso: THREE.LatheGeometry;
  headGeo: THREE.SphereGeometry;
  neckGeo: THREE.CylinderGeometry;
  upperLimbGeo: THREE.LatheGeometry;
  lowerLimbGeo: THREE.LatheGeometry;
  thighGeo: THREE.LatheGeometry;
  calfGeo: THREE.LatheGeometry;
  handGeo: THREE.SphereGeometry;
  shoeUpperGeo: THREE.BoxGeometry;
  shoeSoleGeo: THREE.BoxGeometry;
  helmetShellGeo: THREE.SphereGeometry;
} | null = null;

function createSculptedHeadGeo(): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(0.118, 18, 14);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    y *= 1.18;
    if (y < 0) {
      const chinTaper = 1 - Math.min(0.28, (-y / 0.14) * 0.28);
      x *= chinTaper;
      z *= 0.94 + Math.max(0, z > 0 ? 0.08 : -0.04);
    } else {
      x *= 0.94;
      z *= 1.04;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function getSharedHumanGeos() {
  if (sharedGeos) return sharedGeos;

  const manTorso = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.155, 0.03),
      new THREE.Vector2(0.145, 0.16),
      new THREE.Vector2(0.168, 0.34),
      new THREE.Vector2(0.205, 0.48),
      new THREE.Vector2(0.165, 0.55),
      new THREE.Vector2(0.068, 0.58),
    ],
    14
  );

  const womanTorso = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.162, 0.04),
      new THREE.Vector2(0.118, 0.19),
      new THREE.Vector2(0.152, 0.35),
      new THREE.Vector2(0.166, 0.46),
      new THREE.Vector2(0.132, 0.51),
      new THREE.Vector2(0.056, 0.54),
    ],
    14
  );

  const childTorso = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.135, 0.03),
      new THREE.Vector2(0.132, 0.18),
      new THREE.Vector2(0.144, 0.33),
      new THREE.Vector2(0.112, 0.39),
      new THREE.Vector2(0.058, 0.42),
    ],
    12
  );

  const upperLimbGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.01, 0.03),
      new THREE.Vector2(0.058, 0.0),
      new THREE.Vector2(0.052, -0.14),
      new THREE.Vector2(0.043, -0.28),
      new THREE.Vector2(0.01, -0.3),
    ],
    10
  );

  const lowerLimbGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.01, 0.02),
      new THREE.Vector2(0.044, 0.0),
      new THREE.Vector2(0.038, -0.14),
      new THREE.Vector2(0.03, -0.26),
      new THREE.Vector2(0.01, -0.27),
    ],
    10
  );

  const thighGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.01, 0.02),
      new THREE.Vector2(0.088, 0.0),
      new THREE.Vector2(0.076, -0.22),
      new THREE.Vector2(0.062, -0.43),
      new THREE.Vector2(0.01, -0.45),
    ],
    10
  );

  const calfGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.01, 0.02),
      new THREE.Vector2(0.062, 0.0),
      new THREE.Vector2(0.064, -0.12),
      new THREE.Vector2(0.045, -0.38),
      new THREE.Vector2(0.01, -0.4),
    ],
    10
  );

  sharedGeos = {
    manTorso,
    womanTorso,
    childTorso,
    headGeo: createSculptedHeadGeo(),
    neckGeo: new THREE.CylinderGeometry(0.046, 0.056, 0.11, 10),
    upperLimbGeo,
    lowerLimbGeo,
    thighGeo,
    calfGeo,
    handGeo: new THREE.SphereGeometry(0.036, 8, 8),
    shoeUpperGeo: new THREE.BoxGeometry(0.095, 0.065, 0.21),
    shoeSoleGeo: new THREE.BoxGeometry(0.102, 0.024, 0.222),
    helmetShellGeo: new THREE.SphereGeometry(0.155, 18, 14),
  };

  return sharedGeos;
}

export function buildRealisticSpectator(
  seed: number,
  forcedArchetype?: HumanArchetype
): SpectatorRig {
  const geos = getSharedHumanGeos();
  const group = new THREE.Group();

  const archetypes: HumanArchetype[] = ['man', 'woman', 'child', 'man', 'marshal', 'woman', 'child'];
  const archetype = forcedArchetype ?? archetypes[seed % archetypes.length];
  const isChild = archetype === 'child';
  const isWoman = archetype === 'woman';
  const isMarshal = archetype === 'marshal';

  const skinHex = SKIN_TONES[seed % SKIN_TONES.length];
  const hairHex = HAIR_COLORS[(seed * 3) % HAIR_COLORS.length];
  const eyeHex = EYE_COLORS[(seed * 5) % EYE_COLORS.length];
  const hasGlasses = !isChild && seed % 3 === 0;
  const hasBeard = archetype === 'man' && seed % 2 === 0;

  const topHex = isMarshal
    ? '#84cc16'
    : isChild
    ? KID_HOODIES[seed % KID_HOODIES.length]
    : isWoman
    ? WOMEN_TOPS[seed % WOMEN_TOPS.length]
    : MEN_JACKETS[seed % MEN_JACKETS.length];

  const pantsHex = isMarshal ? '#0f172a' : PANTS_COLORS[(seed * 2) % PANTS_COLORS.length];

  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.56, metalness: 0.02 });
  const faceMat = new THREE.MeshStandardMaterial({
    map: createHumanFaceTexture({
      skinHex,
      eyeHex,
      hairHex,
      sunglasses: hasGlasses,
      beard: hasBeard,
      isWoman,
      isChild,
    }),
    roughness: 0.5,
    metalness: 0.02,
  });
  const topMat = new THREE.MeshStandardMaterial({ color: topHex, roughness: 0.78, metalness: 0.04 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsHex, roughness: 0.86 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.72 });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: isChild ? '#ef4444' : seed % 2 === 0 ? '#111827' : '#e2e8f0',
    roughness: 0.62,
  });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 });
  const accentTrimMat = new THREE.MeshStandardMaterial({
    color: isMarshal ? 0xfacc15 : 0xf8fafc,
    emissive: isMarshal ? 0xca8a04 : 0x000000,
    emissiveIntensity: isMarshal ? 0.55 : 0,
    roughness: 0.4,
  });

  const bodyScale = isChild ? 0.68 : isWoman ? 0.94 : 1.02;
  const charRoot = new THREE.Group();
  charRoot.scale.setScalar(bodyScale);
  group.add(charRoot);

  const hipY = 0.88;
  const legSpread = isWoman ? 0.095 : 0.11;
  [-1, 1].forEach((side) => {
    const lx = side * legSpread;
    const thigh = new THREE.Mesh(geos.thighGeo, pantsMat);
    thigh.position.set(lx, hipY, 0);
    thigh.scale.set(isWoman ? 0.92 : 1.0, 1.0, isWoman ? 0.92 : 1.0);
    charRoot.add(thigh);

    const calfMat = isChild && seed % 2 === 0 ? skinMat : pantsMat;
    const calf = new THREE.Mesh(geos.calfGeo, calfMat);
    calf.position.set(lx, hipY - 0.42, 0);
    charRoot.add(calf);

    const shoeUpper = new THREE.Mesh(geos.shoeUpperGeo, shoeMat);
    shoeUpper.position.set(lx, 0.054, 0.045);
    charRoot.add(shoeUpper);
    const shoeSole = new THREE.Mesh(geos.shoeSoleGeo, soleMat);
    shoeSole.position.set(lx, 0.012, 0.045);
    charRoot.add(shoeSole);
  });

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.14, 0.13, 12), pantsMat);
  pelvis.scale.set(isWoman ? 1.12 : 1.06, 1, 0.76);
  pelvis.position.set(0, hipY + 0.02, 0);
  charRoot.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148, 0.148, 0.036, 12),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45 })
  );
  belt.scale.set(isWoman ? 1.1 : 1.06, 1, 0.78);
  belt.position.set(0, hipY + 0.08, 0);
  charRoot.add(belt);

  const torsoGeo = isChild ? geos.childTorso : isWoman ? geos.womanTorso : geos.manTorso;
  const torsoY = hipY + 0.07;
  const torso = new THREE.Mesh(torsoGeo, topMat);
  torso.scale.set(1.08, 1.0, 0.68);
  torso.position.set(0, torsoY, 0);
  charRoot.add(torso);

  const shoulderY = torsoY + (isChild ? 0.35 : isWoman ? 0.46 : 0.5);

  if (isMarshal) {
    [torsoY + 0.16, torsoY + 0.28].forEach((sy) => {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.175, 0.038, 12), accentTrimMat);
      stripe.scale.set(1.09, 1, 0.71);
      stripe.position.set(0, sy, 0);
      charRoot.add(stripe);
    });
  } else {
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.024, isChild ? 0.28 : 0.4, 0.02), accentTrimMat);
    zip.position.set(0, torsoY + (isChild ? 0.18 : 0.25), 0.125);
    charRoot.add(zip);
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.024, 8, 14), topMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, shoulderY + 0.04, 0);
  charRoot.add(collar);

  if (isChild) {
    const packMat = new THREE.MeshStandardMaterial({
      color: seed % 2 === 0 ? 0x2563eb : 0xf43f5e,
      roughness: 0.7,
    });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.12), packMat);
    pack.position.set(0, torsoY + 0.21, -0.14);
    charRoot.add(pack);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.04), accentTrimMat);
    pocket.position.set(0, torsoY + 0.14, -0.2);
    charRoot.add(pocket);
  }

  const neck = new THREE.Mesh(geos.neckGeo, skinMat);
  neck.position.set(0, shoulderY + 0.08, 0);
  charRoot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, shoulderY + 0.15, 0);
  if (isChild) {
    headPivot.scale.setScalar(1.18);
  }
  charRoot.add(headPivot);

  const headMesh = new THREE.Mesh(geos.headGeo, faceMat);
  headMesh.position.set(0, 0.095, 0);
  headMesh.rotation.y = -Math.PI / 2;
  headPivot.add(headMesh);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 6), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.09, 0.12);
  headPivot.add(nose);

  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), skinMat);
    ear.scale.set(0.55, 1.25, 0.85);
    ear.position.set(side * 0.11, 0.095, -0.005);
    headPivot.add(ear);
  });

  const wearsCap = isMarshal || (archetype === 'man' && seed % 2 === 1) || (isChild && seed % 2 === 0);
  if (wearsCap) {
    const capMat = new THREE.MeshStandardMaterial({
      color: isMarshal ? 0x0f172a : isChild ? 0xfacc15 : 0x1e3a8a,
      roughness: 0.65,
    });
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      capMat
    );
    capDome.scale.set(0.98, 1.08, 1.06);
    capDome.position.set(0, 0.122, -0.004);
    headPivot.add(capDome);

    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.12, 0.014, 14, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      capMat
    );
    brim.position.set(0, 0.132, 0.07);
    brim.rotation.x = 0.12;
    headPivot.add(brim);
  } else {
    const hairTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hairTop.scale.set(1.0, 1.12, 1.08);
    hairTop.position.set(0, 0.115, -0.012);
    headPivot.add(hairTop);

    if (isWoman) {
      const backHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.18, 6, 10), hairMat);
      backHair.position.set(0, 0.03, -0.095);
      backHair.rotation.x = 0.22;
      headPivot.add(backHair);

      const pony = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.18, 6, 8), hairMat);
      pony.position.set(0, 0.05, -0.165);
      pony.rotation.x = 0.45;
      headPivot.add(pony);
    }
  }

  const shoulderX = isChild ? 0.175 : isWoman ? 0.195 : 0.235;
  const sleeveMat = topMat;
  const forearmMat = seed % 2 === 0 ? skinMat : topMat;

  const buildArm = (side: -1 | 1) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * shoulderX, shoulderY, 0);

    const upper = new THREE.Mesh(geos.upperLimbGeo, sleeveMat);
    shoulderPivot.add(upper);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.275, 0);
    shoulderPivot.add(elbowPivot);

    const lower = new THREE.Mesh(geos.lowerLimbGeo, forearmMat);
    elbowPivot.add(lower);

    const hand = new THREE.Mesh(geos.handGeo, skinMat);
    hand.position.set(0, -0.265, 0);
    elbowPivot.add(hand);

    charRoot.add(shoulderPivot);
    return { shoulderPivot, elbowPivot };
  };

  const left = buildArm(-1);
  const right = buildArm(1);

  if (isMarshal || seed % 4 === 1) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), poleMat);
    pole.position.set(0, -0.44, 0.04);
    right.elbowPivot.add(pole);

    const flagMat = new THREE.MeshStandardMaterial({
      color: isMarshal ? 0x22c55e : 0xfacc15,
      emissive: isMarshal ? 0x16a34a : 0xca8a04,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), flagMat);
    flag.position.set(0.17, -0.62, 0.04);
    right.elbowPivot.add(flag);
  } else if (seed % 5 === 2 && !isChild) {
    const camBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.085, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45, metalness: 0.5 })
    );
    camBody.position.set(-0.04, -0.27, 0.05);
    right.elbowPivot.add(camBody);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.036, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.25, metalness: 0.8 })
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(-0.04, -0.27, 0.11);
    right.elbowPivot.add(lens);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32 * bodyScale, 14),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  group.add(shadow);

  return {
    group,
    archetype,
    headPivot,
    leftArm: left.shoulderPivot,
    rightArm: right.shoulderPivot,
    leftForearm: left.elbowPivot,
    rightForearm: right.elbowPivot,
    phase: seed * 1.37,
    baseX: 0,
    baseZ: 0,
    facingY: 0,
  };
}

/**
 * Generates a continuous, smoothly weighted skeletal arm geometry (deltoid -> bicep -> elbow -> forearm -> wrist)
 * spanning from local y = 0 down to y = -(upperLen + foreLen), offset to the shoulder's bind-pose position.
 */
function createSkinnedArmGeometry(
  upperLen: number,
  foreLen: number,
  bindOffset: THREE.Vector3,
  upperBoneIdx: number,
  foreBoneIdx: number,
  handBoneIdx: number
): THREE.BufferGeometry {
  const totalLen = upperLen + foreLen;
  const radialSegs = 12;
  const heightSegs = 18;
  const geo = new THREE.CylinderGeometry(1, 1, totalLen, radialSegs, heightSegs, false);

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i); // [-totalLen/2, +totalLen/2]
    const vz = pos.getZ(i);

    // Distance along arm from shoulder (0) to wrist (totalLen)
    const tDist = totalLen * 0.5 - vy;
    const tNorm = THREE.MathUtils.clamp(tDist / totalLen, 0, 1);

    // Sculpted anatomical sleeve profile: rounded shoulder cap -> bicep -> elbow taper -> forearm -> wrist cuff
    let radius: number;
    if (tNorm < 0.08) {
      radius = THREE.MathUtils.lerp(0.056, 0.064, tNorm / 0.08);
    } else if (tNorm < 0.48) {
      radius = THREE.MathUtils.lerp(0.064, 0.049, (tNorm - 0.08) / 0.4);
    } else if (tNorm < 0.56) {
      radius = 0.047; // elbow joint
    } else {
      radius = THREE.MathUtils.lerp(0.047, 0.034, (tNorm - 0.56) / 0.44);
    }

    const finalX = vx * radius + bindOffset.x;
    const finalY = -tDist + bindOffset.y;
    const finalZ = vz * radius + bindOffset.z;
    pos.setXYZ(i, finalX, finalY, finalZ);

    // Smooth linear-blend skinning weights across shoulder -> elbow -> wrist joints
    const elbowHalfBand = 0.055;
    const wristStart = totalLen - 0.035;

    if (tDist <= upperLen - elbowHalfBand) {
      skinIndices.push(upperBoneIdx, foreBoneIdx, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    } else if (tDist < upperLen + elbowHalfBand) {
      const f = (tDist - (upperLen - elbowHalfBand)) / (elbowHalfBand * 2);
      const smoothF = f * f * (3 - 2 * f);
      skinIndices.push(upperBoneIdx, foreBoneIdx, 0, 0);
      skinWeights.push(1 - smoothF, smoothF, 0, 0);
    } else if (tDist < wristStart) {
      skinIndices.push(foreBoneIdx, handBoneIdx, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    } else {
      const w = THREE.MathUtils.clamp((tDist - wristStart) / Math.max(0.001, totalLen - wristStart), 0, 1);
      skinIndices.push(foreBoneIdx, handBoneIdx, 0, 0);
      skinWeights.push(1 - w * 0.65, w * 0.65, 0, 0);
    }
  }

  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a detailed gloved racing hand (wrist cuff, palm, curled gripping fingers, and thumb)
 * attached directly to the driver's leftHand / rightHand skeletal bone.
 */
function buildGlovedRacingHand(
  side: -1 | 1,
  gloveMat: THREE.Material,
  trimMat: THREE.Material
): THREE.Group {
  const handGroup = new THREE.Group();

  // Wrist racing gauntlet cuff
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.045, 10), trimMat);
  cuff.position.set(0, -0.01, 0);
  handGroup.add(cuff);

  // Sculpted palm extending along -Y
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.072, 0.036), gloveMat);
  palm.position.set(0, -0.056, 0);
  handGroup.add(palm);

  // Curled fingers wrapping cleanly around the steering wheel rim
  const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.052, 5, 8), gloveMat);
  fingers.rotation.z = Math.PI / 2;
  fingers.position.set(0, -0.092, 0.018);
  handGroup.add(fingers);

  // Opposable thumb resting cleanly on the inner rim spoke
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.036, 4, 8), gloveMat);
  thumb.position.set(-side * 0.038, -0.06, 0.012);
  thumb.rotation.z = side * 0.65;
  thumb.rotation.x = 0.35;
  handGroup.add(thumb);

  return handGroup;
}

/**
 * Builds a full Three.js Skeletal Rig (THREE.Bone hierarchy + THREE.Skeleton + THREE.SkinnedMesh arms +
 * procedural AnimationClip played via THREE.AnimationMixer) for the seated race driver.
 */
export function buildSeatedDriver(options: {
  useHelmet: boolean;
  suitColorHex: string;
  accentHex: string;
  scale?: number;
}): DriverSkeletonRig {
  const geos = getSharedHumanGeos();
  const root = new THREE.Group();
  root.name = 'SeatedDriverRoot';
  const s = options.scale ?? 0.88;
  root.scale.setScalar(s);

  const suitMat = new THREE.MeshStandardMaterial({
    color: options.useHelmet ? 0x111827 : 0x1e293b,
    roughness: 0.62,
    metalness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.accentHex),
    roughness: 0.35,
    metalness: 0.35,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.14,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#e6b892', roughness: 0.52 });

  // 1. Construct the True Skeletal Bone Hierarchy
  const upperArmLength = 0.32;
  const forearmLength = 0.3;

  const hipsBone = new THREE.Bone();
  hipsBone.name = 'Hips';
  hipsBone.position.set(0, 0.04, 0.03);

  const spineBone = new THREE.Bone();
  spineBone.name = 'Spine';
  spineBone.position.set(0, 0.14, 0);
  hipsBone.add(spineBone);

  const chestBone = new THREE.Bone();
  chestBone.name = 'Chest';
  chestBone.position.set(0, 0.28, 0);
  spineBone.add(chestBone);

  const neckBone = new THREE.Bone();
  neckBone.name = 'Neck';
  neckBone.position.set(0, 0.11, 0.01);
  chestBone.add(neckBone);

  const headBone = new THREE.Bone();
  headBone.name = 'Head';
  headBone.position.set(0, 0.06, 0);
  neckBone.add(headBone);

  // Left Arm Skeletal Chain: Shoulder -> Elbow -> Wrist/Hand
  const leftUpperArm = new THREE.Bone();
  leftUpperArm.name = 'LeftUpperArm';
  leftUpperArm.position.set(-0.21, -0.01, 0.01);
  chestBone.add(leftUpperArm);

  const leftForearm = new THREE.Bone();
  leftForearm.name = 'LeftForearm';
  leftForearm.position.set(0, -upperArmLength, 0);
  leftUpperArm.add(leftForearm);

  const leftHand = new THREE.Bone();
  leftHand.name = 'LeftHand';
  leftHand.position.set(0, -forearmLength, 0);
  leftForearm.add(leftHand);

  // Right Arm Skeletal Chain: Shoulder -> Elbow -> Wrist/Hand
  const rightUpperArm = new THREE.Bone();
  rightUpperArm.name = 'RightUpperArm';
  rightUpperArm.position.set(0.21, -0.01, 0.01);
  chestBone.add(rightUpperArm);

  const rightForearm = new THREE.Bone();
  rightForearm.name = 'RightForearm';
  rightForearm.position.set(0, -upperArmLength, 0);
  rightUpperArm.add(rightForearm);

  const rightHand = new THREE.Bone();
  rightHand.name = 'RightHand';
  rightHand.position.set(0, -forearmLength, 0);
  rightForearm.add(rightHand);

  root.add(hipsBone);

  const bonesList: THREE.Bone[] = [
    hipsBone,       // 0
    spineBone,      // 1
    chestBone,      // 2
    neckBone,       // 3
    headBone,       // 4
    leftUpperArm,   // 5
    leftForearm,    // 6
    leftHand,       // 7
    rightUpperArm,  // 8
    rightForearm,   // 9
    rightHand,      // 10
  ];

  // Update bind-pose transforms before creating THREE.Skeleton & binding SkinnedMeshes
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bonesList);

  // 2. Seated Thighs attached to Hips Bone
  [-0.1, 0.1].forEach((tx) => {
    const thigh = new THREE.Mesh(geos.thighGeo, suitMat);
    thigh.rotation.x = Math.PI / 2 - 0.12;
    thigh.position.set(tx, 0.02, -0.05);
    hipsBone.add(thigh);
  });

  // 3. Torso, Racing Harness Straps & Shoulder Pads attached to Spine/Chest Bones
  const torso = new THREE.Mesh(geos.manTorso, suitMat);
  torso.scale.set(1.04, 0.92, 0.66);
  torso.rotation.x = 0.12;
  torso.position.set(0, -0.15, 0.01);
  spineBone.add(torso);

  [-0.085, 0.085].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.4, 0.03), trimMat);
    strap.position.set(sx, -0.14, -0.105);
    strap.rotation.x = 0.12;
    chestBone.add(strap);

    // Sculpted deltoid shoulder bolster covering upper sleeve seam
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), suitMat);
    pad.position.set(sx < 0 ? -0.205 : 0.205, -0.01, 0.01);
    chestBone.add(pad);
  });

  // Neck Mesh attached to Neck Bone
  const neck = new THREE.Mesh(geos.neckGeo, options.useHelmet ? gloveMat : skinMat);
  neck.position.set(0, 0.02, 0);
  neckBone.add(neck);

  // 4. Head / Racing Helmet inside headVisual (attached to Head Bone so Cockpit Cam can toggle visibility cleanly)
  const headVisual = new THREE.Group();
  headVisual.name = 'DriverHeadVisual';
  headBone.add(headVisual);

  if (options.useHelmet) {
    const helmetMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(options.suitColorHex),
      roughness: 0.12,
      metalness: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const shell = new THREE.Mesh(geos.helmetShellGeo, helmetMat);
    shell.scale.set(0.95, 1.02, 1.12);
    shell.position.set(0, 0.08, 0);
    headVisual.add(shell);

    const hStripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.156, 0.018, 6, 16, Math.PI),
      trimMat
    );
    hStripe.rotation.y = Math.PI / 2;
    hStripe.position.set(0, 0.08, 0);
    headVisual.add(hStripe);

    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.92,
      roughness: 0.08,
      clearcoat: 1.0,
    });
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.148, 0.148, 0.082, 16, 1, true, Math.PI * 0.66, Math.PI * 0.68),
      visorMat
    );
    visor.position.set(0, 0.09, -0.02);
    headVisual.add(visor);
  } else {
    const driverFaceMat = new THREE.MeshStandardMaterial({
      map: createHumanFaceTexture({
        skinHex: '#e6b892',
        eyeHex: '#2563eb',
        hairHex: '#18181b',
        sunglasses: true,
        beard: false,
      }),
      roughness: 0.5,
    });
    const head = new THREE.Mesh(geos.headGeo, driverFaceMat);
    head.rotation.y = Math.PI / 2;
    head.position.set(0, 0.085, 0);
    headVisual.add(head);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.126, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.72 })
    );
    hair.scale.set(1.0, 1.1, 1.06);
    hair.position.set(0, 0.105, 0.01);
    headVisual.add(hair);
  }

  // 5. True THREE.SkinnedMesh Left & Right Racing Arms bound to the Skeleton!
  const leftBindPos = new THREE.Vector3(-0.21, 0.45, 0.04);
  const rightBindPos = new THREE.Vector3(0.21, 0.45, 0.04);

  const leftArmGeo = createSkinnedArmGeometry(upperArmLength, forearmLength, leftBindPos, 5, 6, 7);
  const leftArmSkinned = new THREE.SkinnedMesh(leftArmGeo, suitMat);
  leftArmSkinned.name = 'DriverLeftArmSkinned';
  leftArmSkinned.frustumCulled = false;
  root.add(leftArmSkinned);
  leftArmSkinned.bind(skeleton);

  const rightArmGeo = createSkinnedArmGeometry(upperArmLength, forearmLength, rightBindPos, 8, 9, 10);
  const rightArmSkinned = new THREE.SkinnedMesh(rightArmGeo, suitMat);
  rightArmSkinned.name = 'DriverRightArmSkinned';
  rightArmSkinned.frustumCulled = false;
  root.add(rightArmSkinned);
  rightArmSkinned.bind(skeleton);

  // 6. Articulated Gloved Racing Hands attached directly to LeftHand & RightHand skeletal bones
  leftHand.add(buildGlovedRacingHand(-1, gloveMat, trimMat));
  rightHand.add(buildGlovedRacingHand(1, gloveMat, trimMat));

  // 7. Procedural Skeletal AnimationClip (subtle chest breathing & seated poise via AnimationMixer)
  const breathTimes = [0, 1.3, 2.6];
  const spineBreathTrack = new THREE.NumberKeyframeTrack(
    'Spine.rotation[x]',
    breathTimes,
    [0.01, -0.025, 0.01]
  );
  const chestBreathTrack = new THREE.NumberKeyframeTrack(
    'Chest.rotation[x]',
    breathTimes,
    [0.0, 0.024, 0.0]
  );
  const idleClip = new THREE.AnimationClip('DriverIdleBreath', 2.6, [
    spineBreathTrack,
    chestBreathTrack,
  ]);

  const mixer = new THREE.AnimationMixer(root);

  return {
    root,
    skeleton,
    skinnedMeshes: [leftArmSkinned, rightArmSkinned],
    bones: {
      hips: hipsBone,
      spine: spineBone,
      chest: chestBone,
      neck: neckBone,
      head: headBone,
      leftUpperArm,
      leftForearm,
      leftHand,
      rightUpperArm,
      rightForearm,
      rightHand,
    },
    headVisual,
    headPivot: headBone,
    leftArmPivot: leftUpperArm,
    rightArmPivot: rightUpperArm,
    mixer,
    clips: [idleClip],
    upperArmLength,
    forearmLength,
    isExternalModel: false,
  };
}
