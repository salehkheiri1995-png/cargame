import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface DriverBoneMap {
  hips: THREE.Bone;
  spine: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  leftUpperArm: THREE.Bone;
  leftForearm: THREE.Bone;
  leftHand: THREE.Bone;
  rightUpperArm: THREE.Bone;
  rightForearm: THREE.Bone;
  rightHand: THREE.Bone;
}

export interface DriverSkeletonRig {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  skinnedMeshes: THREE.SkinnedMesh[];
  bones: DriverBoneMap;
  /** Visual head/helmet subtree so first-person cockpit camera can hide head while keeping arms/hands visible */
  headVisual: THREE.Object3D;
  /** Legacy alias pointing to bones.head */
  headPivot: THREE.Object3D;
  /** Legacy alias pointing to bones.leftUpperArm */
  leftArmPivot: THREE.Object3D;
  /** Legacy alias pointing to bones.rightUpperArm */
  rightArmPivot: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  upperArmLength: number;
  forearmLength: number;
  isExternalModel?: boolean;
}

export interface DriverAnimationState {
  dt: number;
  /** Normalized steering input in [-1, 1] (-1 = left, +1 = right) */
  steerInput: number;
  /** Current steering wheel Z rotation in radians */
  steeringWheelAngle: number;
  /** Normalized speed [0, 1] */
  speedNorm: number;
  braking: boolean;
  nitroActive: boolean;
  /** Lateral velocity / G-force cue */
  lateralG: number;
  /** Current dynamic highway curvature (+ = right curve, - = left curve) */
  roadCurvature?: number;
  isCockpitCamera: boolean;
  elapsed: number;
}

// Reusable scratch objects (zero per-frame allocations inside the 60fps race loop)
const _invChestWorld = new THREE.Matrix4();
const _targetChestPos = new THREE.Vector3();
const _shoulderPos = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _planeNormal = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _elbowPos = new THREE.Vector3();
const _upperDir = new THREE.Vector3();
const _foreDir = new THREE.Vector3();
const _xAxis = new THREE.Vector3();
const _yAxis = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();
const _qUpperChest = new THREE.Quaternion();
const _qForeChest = new THREE.Quaternion();
const _qInvUpper = new THREE.Quaternion();
const _qInvFore = new THREE.Quaternion();
const _qChestWorld = new THREE.Quaternion();
const _qGripWorld = new THREE.Quaternion();
const _qHandChest = new THREE.Quaternion();
const _qHandTarget = new THREE.Quaternion();
const _qSlerpHand = new THREE.Quaternion();

/**
 * Real-time skeletal animation + 2-bone analytical Inverse Kinematics (IK) controller
 * that couples a driver's rigged THREE.Skeleton arms & gloved hands directly onto
 * the rotating steering wheel grip targets during active races and garage previews.
 */
export class DriverSkeletalController {
  public rig: DriverSkeletonRig;
  private leftGripTarget: THREE.Object3D;
  private rightGripTarget: THREE.Object3D;
  private idleAction: THREE.AnimationAction | null = null;

  private smoothedSteer = 0;
  private smoothedLean = 0;
  private smoothedPitch = 0;
  private smoothedHeadYaw = 0;
  private smoothedHeadRoll = 0;
  private smoothedHeadPitch = 0;
  private readonly headPose = { yaw: 0, roll: 0, pitch: 0 };

  constructor(
    rig: DriverSkeletonRig,
    leftGripTarget: THREE.Object3D,
    rightGripTarget: THREE.Object3D
  ) {
    this.rig = rig;
    this.leftGripTarget = leftGripTarget;
    this.rightGripTarget = rightGripTarget;
    this.bindIdleClip();
  }

  private bindIdleClip(): void {
    if (this.rig.clips.length > 0) {
      this.idleAction = this.rig.mixer.clipAction(this.rig.clips[0]);
      this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
      this.idleAction.play();
    }
  }

  /**
   * Hot-swap the driver's skeletal rig (e.g. after loading an external GLTF/GLB skeletal model)
   * while keeping steering wheel grip targets intact.
   */
  public setRig(newRig: DriverSkeletonRig): void {
    this.dispose();
    this.rig = newRig;
    this.idleAction = null;
    this.bindIdleClip();
  }

  public getHeadPose(): { yaw: number; roll: number; pitch: number } {
    return this.headPose;
  }

  public update(state: DriverAnimationState): void {
    const {
      dt,
      steerInput,
      steeringWheelAngle,
      speedNorm,
      braking,
      nitroActive,
      lateralG,
      roadCurvature = 0,
      isCockpitCamera,
      elapsed,
    } = state;
    const { bones, mixer, headVisual, skeleton } = this.rig;

    // 1. Hide only head/helmet in Cockpit First-Person view so the lens sees over the animated arms & wheel!
    headVisual.visible = !isCockpitCamera;

    // 2. Step Three.js skeletal AnimationMixer (drives subtle idle breathing & racing posture clip)
    mixer.update(dt);

    // 3. Smooth dynamic racing kinematics for spine & chest
    this.smoothedSteer = THREE.MathUtils.damp(this.smoothedSteer, steerInput, 14, dt);
    const targetLean = THREE.MathUtils.clamp(-lateralG * 0.012 - this.smoothedSteer * 0.06, -0.14, 0.14);
    const targetPitch = braking ? 0.11 : nitroActive ? -0.08 : 0.02;
    this.smoothedLean = THREE.MathUtils.damp(this.smoothedLean, targetLean, 9, dt);
    this.smoothedPitch = THREE.MathUtils.damp(this.smoothedPitch, targetPitch, 8, dt);

    const roadVibration = Math.sin(elapsed * 22) * 0.008 * speedNorm;
    const baseSpineX = this.idleAction ? bones.spine.rotation.x : 0;
    const baseChestX = this.idleAction ? bones.chest.rotation.x : 0;

    bones.spine.rotation.z = this.smoothedLean * 0.45;
    bones.spine.rotation.x = baseSpineX + this.smoothedPitch * 0.45;

    bones.chest.rotation.z = this.smoothedLean * 0.55;
    bones.chest.rotation.y = -this.smoothedSteer * 0.09; // Natural shoulder counter-twist as arms turn wheel
    bones.chest.rotation.x = baseChestX + this.smoothedPitch * 0.35 + roadVibration;

    // 4. Procedural Cervical (Neck + Head) Rotation: Driver subtly leans & gazes into curves!
    this.updateProceduralHeadRotation(
      dt,
      this.smoothedSteer,
      roadCurvature,
      speedNorm,
      braking,
      nitroActive,
      lateralG,
      roadVibration
    );

    // 5. Refresh world matrices of chest & rotating steering wheel before solving exact 2-bone arm IK
    bones.chest.updateWorldMatrix(true, false);
    this.leftGripTarget.updateWorldMatrix(true, false);
    this.rightGripTarget.updateWorldMatrix(true, false);

    _invChestWorld.copy(bones.chest.matrixWorld).invert();
    bones.chest.getWorldQuaternion(_qChestWorld);

    // 6. Solve analytical 2-bone skeletal IK for both arms so hands stay locked onto the rotating wheel rim!
    this.solveArmIK(
      -1,
      bones.leftUpperArm,
      bones.leftForearm,
      bones.leftHand,
      this.leftGripTarget,
      steeringWheelAngle
    );
    this.solveArmIK(
      1,
      bones.rightUpperArm,
      bones.rightForearm,
      bones.rightHand,
      this.rightGripTarget,
      steeringWheelAngle
    );

    // 7. Push updated bone matrices to the GPU SkinnedMesh skeleton
    bones.hips.updateMatrixWorld(true);
    skeleton.update();
  }

  /**
   * Procedurally drives the neck & head bones so the driver subtly leans into corners
   * and looks toward the apex based on live steering input, road curvature, and speed.
   * Convention (driver facing -Z): +rotation.z leans head LEFT, +rotation.y looks LEFT.
   */
  private updateProceduralHeadRotation(
    dt: number,
    steerInput: number,
    roadCurvature: number,
    speedNorm: number,
    braking: boolean,
    nitroActive: boolean,
    lateralG: number,
    roadVibration: number
  ): void {
    const { bones } = this.rig;

    // Blend live steering input with subtle anticipation of upcoming road curvature
    const curveSignal = THREE.MathUtils.clamp(steerInput + roadCurvature * 0.26, -1.35, 1.35);
    const speedGain = 0.72 + 0.44 * speedNorm;

    // Roll into the curve (negative steerInput = left turn -> positive Z roll leans head left into curve)
    const targetHeadRoll = THREE.MathUtils.clamp(
      -curveSignal * 0.19 * speedGain - lateralG * 0.004,
      -0.26,
      0.26
    );
    // Gaze into the apex (negative steerInput = left turn -> positive Y yaw looks left)
    const targetHeadYaw = THREE.MathUtils.clamp(-curveSignal * 0.34 * speedGain, -0.44, 0.44);
    // Subtle chin tuck when leaning hard into corners + braking/nitro inertia pitch
    const targetHeadPitch = THREE.MathUtils.clamp(
      (braking ? 0.1 : nitroActive ? -0.075 : 0.015) + Math.abs(curveSignal) * 0.036 + roadVibration * 0.7,
      -0.12,
      0.15
    );

    this.smoothedHeadRoll = THREE.MathUtils.damp(this.smoothedHeadRoll, targetHeadRoll, 8.5, dt);
    this.smoothedHeadYaw = THREE.MathUtils.damp(this.smoothedHeadYaw, targetHeadYaw, 10.5, dt);
    this.smoothedHeadPitch = THREE.MathUtils.damp(this.smoothedHeadPitch, targetHeadPitch, 9, dt);

    this.headPose.roll = this.smoothedHeadRoll;
    this.headPose.yaw = this.smoothedHeadYaw;
    this.headPose.pitch = this.smoothedHeadPitch;

    const hasDistinctNeck = bones.neck !== bones.chest && bones.neck !== bones.head;
    if (hasDistinctNeck) {
      // Natural anatomical split: neck takes ~38% of lateral curve lean & ~32% of apex yaw
      bones.neck.rotation.z = this.smoothedHeadRoll * 0.38;
      bones.neck.rotation.y = this.smoothedHeadYaw * 0.32;
      bones.neck.rotation.x = this.smoothedHeadPitch * 0.3;

      bones.head.rotation.z = this.smoothedHeadRoll * 0.62;
      bones.head.rotation.y = this.smoothedHeadYaw * 0.68;
      bones.head.rotation.x = this.smoothedHeadPitch * 0.7;
    } else {
      bones.head.rotation.z = this.smoothedHeadRoll;
      bones.head.rotation.y = this.smoothedHeadYaw;
      bones.head.rotation.x = this.smoothedHeadPitch;
    }
  }

  private solveArmIK(
    side: -1 | 1,
    upperArm: THREE.Bone,
    forearm: THREE.Bone,
    hand: THREE.Bone,
    gripTarget: THREE.Object3D,
    steeringWheelAngle: number
  ): void {
    const L1 = this.rig.upperArmLength;
    const L2 = this.rig.forearmLength;

    // Transform wheel grip target from world space into chestBone local space
    gripTarget.getWorldPosition(_targetChestPos);
    _targetChestPos.applyMatrix4(_invChestWorld);

    _shoulderPos.copy(upperArm.position);
    _toTarget.subVectors(_targetChestPos, _shoulderPos);

    let dist = _toTarget.length();
    const minReach = Math.abs(L1 - L2) + 0.025;
    const maxReach = L1 + L2 - 0.008;
    if (dist < 0.0001) {
      _dir.set(0, -1, 0);
      dist = minReach;
    } else {
      _dir.copy(_toTarget).divideScalar(dist);
      dist = THREE.MathUtils.clamp(dist, minReach, maxReach);
    }

    // Law of Cosines for shoulder elevation inside the arm-bend plane
    const cosAlpha = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

    // Natural racing driver elbow pole: elbows drop downward & flare slightly outward, shifting smoothly as wheel rotates
    const steerRollShift = Math.sin(steeringWheelAngle) * 0.16 * side;
    _pole.set(side * 0.78, -0.68 + steerRollShift, 0.18).normalize();

    // Build orthonormal IK plane: _planeNormal perpendicular to (_dir, _pole), _perp toward _pole
    _planeNormal.crossVectors(_dir, _pole);
    if (_planeNormal.lengthSq() < 0.0001) {
      _planeNormal.set(side, 0, 0);
    } else {
      _planeNormal.normalize();
    }
    _perp.crossVectors(_planeNormal, _dir).normalize();

    // Exact elbow position in chestBone local space
    _elbowPos
      .copy(_shoulderPos)
      .addScaledVector(_dir, L1 * cosAlpha)
      .addScaledVector(_perp, L1 * sinAlpha);

    // Exact clamped wrist target in chestBone local space
    _targetChestPos.copy(_shoulderPos).addScaledVector(_dir, dist);

    // Upper arm bone orientation (arm bones extend along local -Y from shoulder -> elbow -> wrist)
    _upperDir.subVectors(_elbowPos, _shoulderPos).normalize();
    _yAxis.copy(_upperDir).negate();
    _xAxis.copy(_planeNormal);
    if (side < 0) _xAxis.negate();
    _zAxis.crossVectors(_xAxis, _yAxis).normalize();
    _xAxis.crossVectors(_yAxis, _zAxis).normalize();
    _rotMat.makeBasis(_xAxis, _yAxis, _zAxis);
    _qUpperChest.setFromRotationMatrix(_rotMat);
    upperArm.quaternion.copy(_qUpperChest);

    // Forearm bone orientation in chest space -> converted to upperArm local space
    _foreDir.subVectors(_targetChestPos, _elbowPos).normalize();
    _yAxis.copy(_foreDir).negate();
    _xAxis.copy(_planeNormal);
    if (side < 0) _xAxis.negate();
    _zAxis.crossVectors(_xAxis, _yAxis).normalize();
    _xAxis.crossVectors(_yAxis, _zAxis).normalize();
    _rotMat.makeBasis(_xAxis, _yAxis, _zAxis);
    _qForeChest.setFromRotationMatrix(_rotMat);

    _qInvUpper.copy(_qUpperChest).invert();
    forearm.quaternion.multiplyQuaternions(_qInvUpper, _qForeChest);

    // Hand/wrist bone orientation: align gloved hand to follow the rotating steering wheel grip rim
    gripTarget.getWorldQuaternion(_qGripWorld);
    _qHandChest.copy(_qChestWorld).invert().multiply(_qGripWorld);
    _qInvFore.copy(_qForeChest).invert();
    _qHandTarget.multiplyQuaternions(_qInvFore, _qHandChest);

    // Blend cleanly so the wrist never over-twists unnaturally at extreme lock
    _qSlerpHand.identity().slerp(_qHandTarget, 0.85);
    hand.quaternion.copy(_qSlerpHand);
  }

  public dispose(): void {
    if (this.idleAction) {
      this.idleAction.stop();
      this.idleAction = null;
    }
    this.rig.mixer.stopAllAction();
    this.rig.mixer.uncacheRoot(this.rig.root);
  }
}

/**
 * Matches standard Mixamo / ReadyPlayerMe / Blender / glTF humanoid bone names
 * so externally loaded rigged GLB/GLTF driver models bind automatically to steering wheel IK.
 */
function findBoneByPatterns(bones: THREE.Bone[], patterns: RegExp[]): THREE.Bone | null {
  for (const pat of patterns) {
    const hit = bones.find((b) => pat.test(b.name));
    if (hit) return hit;
  }
  return null;
}

/**
 * Loads an external rigged GLTF/GLB driver model and extracts its THREE.Skeleton,
 * THREE.AnimationMixer, clips, and mapped arm/hand bones for live steering wheel animation.
 */
export async function loadExternalDriverSkeleton(
  url: string,
  targetScale = 0.86
): Promise<DriverSkeletonRig> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const root = new THREE.Group();
  root.scale.setScalar(targetScale);
  root.add(gltf.scene);

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  const allBones: THREE.Bone[] = [];
  let primarySkeleton: THREE.Skeleton | null = null;

  gltf.scene.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh) {
      obj.frustumCulled = false;
      skinnedMeshes.push(obj);
      if (!primarySkeleton && obj.skeleton) {
        primarySkeleton = obj.skeleton;
      }
    }
    if (obj instanceof THREE.Bone) {
      allBones.push(obj);
    }
  });

  if (!primarySkeleton || allBones.length === 0) {
    throw new Error('Loaded GLTF driver model does not contain a valid Skeleton or Bones.');
  }

  const skeleton = primarySkeleton as THREE.Skeleton;
  const fallbackBone = allBones[0];

  const hips = findBoneByPatterns(allBones, [/hips/i, /pelvis/i, /root/i]) ?? fallbackBone;
  const spine = findBoneByPatterns(allBones, [/spine1?$/i, /spine/i]) ?? hips;
  const chest = findBoneByPatterns(allBones, [/spine2/i, /chest/i, /upperchest/i]) ?? spine;
  const neck = findBoneByPatterns(allBones, [/neck/i]) ?? chest;
  const head = findBoneByPatterns(allBones, [/head/i]) ?? neck;

  const leftUpperArm =
    findBoneByPatterns(allBones, [/left.*upper.*arm/i, /leftarm/i, /arm[_.]?l/i, /upperarm[_.]?l/i]) ??
    chest;
  const leftForearm =
    findBoneByPatterns(allBones, [/left.*fore.*arm/i, /leftlowerarm/i, /forearm[_.]?l/i]) ??
    leftUpperArm;
  const leftHand =
    findBoneByPatterns(allBones, [/left.*hand/i, /hand[_.]?l/i, /wrist[_.]?l/i]) ?? leftForearm;

  const rightUpperArm =
    findBoneByPatterns(allBones, [/right.*upper.*arm/i, /rightarm/i, /arm[_.]?r/i, /upperarm[_.]?r/i]) ??
    chest;
  const rightForearm =
    findBoneByPatterns(allBones, [/right.*fore.*arm/i, /rightlowerarm/i, /forearm[_.]?r/i]) ??
    rightUpperArm;
  const rightHand =
    findBoneByPatterns(allBones, [/right.*hand/i, /hand[_.]?r/i, /wrist[_.]?r/i]) ?? rightForearm;

  // Measure actual limb lengths from the loaded skeleton's bind pose
  root.updateMatrixWorld(true);
  const measuredL1 = Math.max(0.2, leftForearm.position.length() || 0.32);
  const measuredL2 = Math.max(0.18, leftHand.position.length() || 0.3);

  const mixer = new THREE.AnimationMixer(root);

  return {
    root,
    skeleton,
    skinnedMeshes,
    bones: {
      hips,
      spine,
      chest,
      neck,
      head,
      leftUpperArm,
      leftForearm,
      leftHand,
      rightUpperArm,
      rightForearm,
      rightHand,
    },
    headVisual: head,
    headPivot: head,
    leftArmPivot: leftUpperArm,
    rightArmPivot: rightUpperArm,
    mixer,
    clips: gltf.animations ?? [],
    upperArmLength: measuredL1,
    forearmLength: measuredL2,
    isExternalModel: true,
  };
}
