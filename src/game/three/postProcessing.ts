import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { EnvironmentId, GraphicsQuality } from '../types';

export interface CinematicGradePreset {
  exposure: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  brightness: number;
  temperature: number; // -1 (cool) .. +1 (warm)
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  vignetteIntensity: number;
  vignetteSmoothness: number;
  grainAmount: number;
}

export interface PostProcessDynamicState {
  nitroFactor: number; // 0..1
  speedFactor: number; // 0..1
  feverFactor: number; // 0..1
  impactPulse: number; // 0..1
  isGarage: boolean;
  time: number;
}

const GARAGE_PRESET: CinematicGradePreset = {
  exposure: 1.18,
  bloomStrength: 0.36,
  bloomRadius: 0.5,
  bloomThreshold: 0.86,
  contrast: 1.12,
  saturation: 1.1,
  vibrance: 0.16,
  brightness: 0.01,
  temperature: -0.03,
  shadowTint: [0.91, 0.96, 1.07],
  highlightTint: [1.04, 1.02, 0.98],
  vignetteIntensity: 0.34,
  vignetteSmoothness: 0.58,
  grainAmount: 0.01,
};

const ENV_GRADE_PRESETS: Record<EnvironmentId, CinematicGradePreset> = {
  city: {
    exposure: 1.16,
    bloomStrength: 0.34,
    bloomRadius: 0.48,
    bloomThreshold: 0.88,
    contrast: 1.11,
    saturation: 1.12,
    vibrance: 0.18,
    brightness: 0.01,
    temperature: 0.04,
    shadowTint: [0.92, 0.97, 1.06],
    highlightTint: [1.05, 1.02, 0.96],
    vignetteIntensity: 0.24,
    vignetteSmoothness: 0.62,
    grainAmount: 0.011,
  },
  coastal: {
    exposure: 1.2,
    bloomStrength: 0.38,
    bloomRadius: 0.52,
    bloomThreshold: 0.86,
    contrast: 1.09,
    saturation: 1.16,
    vibrance: 0.22,
    brightness: 0.015,
    temperature: 0.07,
    shadowTint: [0.9, 1.0, 1.07],
    highlightTint: [1.06, 1.03, 0.95],
    vignetteIntensity: 0.22,
    vignetteSmoothness: 0.65,
    grainAmount: 0.01,
  },
  desert: {
    exposure: 1.18,
    bloomStrength: 0.4,
    bloomRadius: 0.54,
    bloomThreshold: 0.85,
    contrast: 1.13,
    saturation: 1.14,
    vibrance: 0.18,
    brightness: 0.01,
    temperature: 0.14,
    shadowTint: [0.95, 0.94, 1.04],
    highlightTint: [1.08, 1.01, 0.92],
    vignetteIntensity: 0.26,
    vignetteSmoothness: 0.6,
    grainAmount: 0.012,
  },
  forest: {
    exposure: 1.15,
    bloomStrength: 0.34,
    bloomRadius: 0.5,
    bloomThreshold: 0.87,
    contrast: 1.12,
    saturation: 1.15,
    vibrance: 0.2,
    brightness: 0.01,
    temperature: 0.03,
    shadowTint: [0.9, 0.99, 1.03],
    highlightTint: [1.05, 1.04, 0.95],
    vignetteIntensity: 0.25,
    vignetteSmoothness: 0.62,
    grainAmount: 0.011,
  },
  snow: {
    exposure: 1.14,
    bloomStrength: 0.36,
    bloomRadius: 0.52,
    bloomThreshold: 0.9,
    contrast: 1.1,
    saturation: 1.09,
    vibrance: 0.16,
    brightness: 0.01,
    temperature: -0.09,
    shadowTint: [0.9, 0.97, 1.08],
    highlightTint: [1.02, 1.03, 1.05],
    vignetteIntensity: 0.23,
    vignetteSmoothness: 0.64,
    grainAmount: 0.01,
  },
  nightCity: {
    exposure: 1.24,
    bloomStrength: 0.68,
    bloomRadius: 0.62,
    bloomThreshold: 0.68,
    contrast: 1.16,
    saturation: 1.22,
    vibrance: 0.24,
    brightness: 0.015,
    temperature: -0.06,
    shadowTint: [0.88, 0.94, 1.12],
    highlightTint: [1.07, 0.98, 1.06],
    vignetteIntensity: 0.34,
    vignetteSmoothness: 0.56,
    grainAmount: 0.014,
  },
  sunsetCanyon: {
    exposure: 1.2,
    bloomStrength: 0.52,
    bloomRadius: 0.58,
    bloomThreshold: 0.78,
    contrast: 1.14,
    saturation: 1.19,
    vibrance: 0.22,
    brightness: 0.012,
    temperature: 0.18,
    shadowTint: [0.93, 0.9, 1.07],
    highlightTint: [1.1, 0.99, 0.89],
    vignetteIntensity: 0.29,
    vignetteSmoothness: 0.58,
    grainAmount: 0.012,
  },
};

/**
 * Unified Cinematic Color Grading, Split-Toning, Vibrance, Vignette,
 * Speed Chromatic Aberration & Subtle Filmic Dither Shader.
 * Runs after ACES Filmic OutputPass so all grading stays banded-free and vibrant.
 */
const CinematicColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uContrast: { value: 1.12 },
    uSaturation: { value: 1.14 },
    uVibrance: { value: 0.18 },
    uBrightness: { value: 0.01 },
    uTemperature: { value: 0.04 },
    uShadowTint: { value: new THREE.Vector3(0.92, 0.97, 1.06) },
    uHighlightTint: { value: new THREE.Vector3(1.05, 1.02, 0.96) },
    uVignetteIntensity: { value: 0.24 },
    uVignetteSmoothness: { value: 0.62 },
    uChromaticAmount: { value: 0.0 },
    uGrainAmount: { value: 0.011 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uVibrance;
    uniform float uBrightness;
    uniform float uTemperature;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uVignetteIntensity;
    uniform float uVignetteSmoothness;
    uniform float uChromaticAmount;
    uniform float uGrainAmount;
    uniform float uTime;

    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float radialDist = length(centered);

      // Radial Chromatic Aberration (active only on Nitro / Boost / Crash impact)
      vec3 color;
      if (uChromaticAmount > 0.0001) {
        vec2 offset = centered * radialDist * uChromaticAmount;
        float r = texture2D(tDiffuse, clamp(vUv + offset, 0.001, 0.999)).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, clamp(vUv - offset, 0.001, 0.999)).b;
        color = vec3(r, g, b);
      } else {
        color = texture2D(tDiffuse, vUv).rgb;
      }

      // Lift brightness slightly before S-curve contrast
      color = clamp(color + uBrightness, 0.0, 1.0);

      // White balance / cinematic temperature shift
      color.r *= 1.0 + uTemperature * 0.14;
      color.g *= 1.0 + uTemperature * 0.03;
      color.b *= 1.0 - uTemperature * 0.13;

      // Split-toning (cool/rich shadows + warm/luminous highlights)
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float shadowWeight = smoothstep(0.58, 0.04, luma);
      float highlightWeight = smoothstep(0.42, 0.96, luma);
      vec3 splitTone = mix(vec3(1.0), uShadowTint, shadowWeight * 0.65);
      splitTone = mix(splitTone, uHighlightTint, highlightWeight * 0.55);
      color *= splitTone;

      // Filmic S-curve contrast around mid-grey (preserves sky & shadow detail)
      vec3 sCurve = color * color * (3.0 - 2.0 * color);
      float sBlend = clamp((uContrast - 1.0) * 1.65, 0.0, 0.55);
      color = mix(color, sCurve, sBlend);
      color = (color - 0.5) * (1.0 + (uContrast - 1.0) * 0.45) + 0.5;
      color = clamp(color, 0.0, 1.0);

      // Selective Vibrance (boosts less-saturated midtones without oversaturating neon/paint)
      float cMax = max(color.r, max(color.g, color.b));
      float cMin = min(color.r, min(color.g, color.b));
      float satCurrent = cMax - cMin;
      float vibBoost = uVibrance * (1.0 - satCurrent);
      float luma2 = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma2), color, uSaturation + vibBoost);

      // Smooth cinematic vignette (subtly deepens framing at speed)
      float vig = smoothstep(0.88, 0.88 - uVignetteSmoothness, radialDist);
      color *= mix(1.0 - uVignetteIntensity, 1.0, vig);

      // Micro filmic dither / grain (prevents 8-bit banding on sky & wet asphalt)
      float grain = (hash12(gl_FragCoord.xy + fract(uTime * 17.31) * 100.0) - 0.5) * uGrainAmount;
      color = clamp(color + grain, 0.0, 1.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class CinematicPostProcessor {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private renderTarget: THREE.WebGLRenderTarget | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private colorGradePass: ShaderPass | null = null;
  private outputPass: OutputPass | null = null;

  private isSoftwareGl: boolean;
  private quality: GraphicsQuality = 'high';
  private activeEnv: EnvironmentId = 'city';

  // Smoothly damped current values (zero allocations in update)
  private currentExposure = 1.16;
  private currentBloomStrength = 0.34;
  private currentBloomRadius = 0.48;
  private currentBloomThreshold = 0.88;
  private currentContrast = 1.11;
  private currentSaturation = 1.12;
  private currentVibrance = 0.18;
  private currentBrightness = 0.01;
  private currentTemperature = 0.04;
  private currentVignette = 0.24;
  private currentVignetteSmooth = 0.62;
  private currentChromatic = 0.0;
  private currentGrain = 0.011;
  private currentShadowTint = new THREE.Vector3(0.92, 0.97, 1.06);
  private currentHighlightTint = new THREE.Vector3(1.05, 1.02, 0.96);

  private width: number;
  private height: number;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    isSoftwareGl: boolean
  ) {
    this.renderer = renderer;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.isSoftwareGl = isSoftwareGl;

    // Configure ACES Filmic Tonemapping on renderer (applies both to direct render & OutputPass)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.currentExposure;

    if (!isSoftwareGl) {
      this.initComposer(scene, camera);
    }
  }

  private initComposer(scene: THREE.Scene, camera: THREE.Camera): void {
    const pixelRatio = this.renderer.getPixelRatio();
    const supportsWebGL2 = this.renderer.capabilities.isWebGL2;

    // HalfFloatType HDR render target keeps >1.0 emissive/specular intensities intact for true HDR Bloom + ACES Tonemapping!
    this.renderTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(this.width * pixelRatio)),
      Math.max(1, Math.floor(this.height * pixelRatio)),
      {
        type: THREE.HalfFloatType,
        samples: supportsWebGL2 && this.quality === 'high' ? 4 : 0,
      }
    );

    this.composer = new EffectComposer(this.renderer, this.renderTarget);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(this.width, this.height);

    // 1. Scene linear HDR render
    this.composer.addPass(new RenderPass(scene, camera));

    // 2. Linear HDR Bloom (runs before tonemapping so headlights, LEDs, neon & nitro glow cleanly)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(this.width / 2)), Math.max(1, Math.floor(this.height / 2))),
      this.currentBloomStrength,
      this.currentBloomRadius,
      this.currentBloomThreshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. ACES Filmic Tonemapping + sRGB Output Encoding
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // 4. Cinematic Color Grading, Split-Toning, Vibrance, Vignette & Dynamic Boost Aberration
    this.colorGradePass = new ShaderPass(CinematicColorGradeShader);
    this.composer.addPass(this.colorGradePass);
  }

  public setEnvironment(envId: EnvironmentId, immediate = false): void {
    this.activeEnv = envId;
    if (immediate) {
      this.snapToPreset(ENV_GRADE_PRESETS[envId]);
    }
  }

  public setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    if (this.isSoftwareGl || !this.composer) return;

    const pixelRatio = this.renderer.getPixelRatio();
    if (this.renderTarget) {
      const targetSamples =
        this.renderer.capabilities.isWebGL2 && quality === 'high' ? 4 : 0;
      if (this.renderTarget.samples !== targetSamples) {
        this.renderTarget.samples = targetSamples;
      }
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = quality !== 'low';
    }
    if (this.colorGradePass) {
      this.colorGradePass.enabled = quality !== 'low';
    }

    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(this.width, this.height);
    if (this.bloomPass) {
      const scale = quality === 'medium' ? 0.38 : 0.5;
      this.bloomPass.resolution.set(
        Math.max(1, Math.floor(this.width * scale)),
        Math.max(1, Math.floor(this.height * scale))
      );
    }
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (!this.composer) return;

    const pixelRatio = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(this.width, this.height);
    if (this.bloomPass) {
      const scale = this.quality === 'medium' ? 0.38 : 0.5;
      this.bloomPass.resolution.set(
        Math.max(1, Math.floor(this.width * scale)),
        Math.max(1, Math.floor(this.height * scale))
      );
    }
  }

  private snapToPreset(p: CinematicGradePreset): void {
    this.currentExposure = p.exposure;
    this.currentBloomStrength = p.bloomStrength;
    this.currentBloomRadius = p.bloomRadius;
    this.currentBloomThreshold = p.bloomThreshold;
    this.currentContrast = p.contrast;
    this.currentSaturation = p.saturation;
    this.currentVibrance = p.vibrance;
    this.currentBrightness = p.brightness;
    this.currentTemperature = p.temperature;
    this.currentVignette = p.vignetteIntensity;
    this.currentVignetteSmooth = p.vignetteSmoothness;
    this.currentGrain = p.grainAmount;
    this.currentShadowTint.set(p.shadowTint[0], p.shadowTint[1], p.shadowTint[2]);
    this.currentHighlightTint.set(p.highlightTint[0], p.highlightTint[1], p.highlightTint[2]);
    this.applyUniforms(0);
  }

  public update(dt: number, state: PostProcessDynamicState): void {
    const base = state.isGarage ? GARAGE_PRESET : ENV_GRADE_PRESETS[this.activeEnv];
    const nitro = THREE.MathUtils.clamp(state.nitroFactor, 0, 1);
    const speed = THREE.MathUtils.clamp(state.speedFactor, 0, 1);
    const fever = THREE.MathUtils.clamp(state.feverFactor, 0, 1);
    const impact = THREE.MathUtils.clamp(state.impactPulse, 0, 1);

    const targetExposure = base.exposure + nitro * 0.08 + fever * 0.04 - impact * 0.14;
    const targetBloomStrength =
      base.bloomStrength + nitro * 0.24 + fever * 0.12 + impact * 0.28;
    const targetBloomRadius = base.bloomRadius + nitro * 0.12;
    const targetBloomThreshold = Math.max(0.52, base.bloomThreshold - nitro * 0.08 - fever * 0.04);

    const targetContrast = base.contrast + nitro * 0.05 + impact * 0.12;
    const targetSaturation = base.saturation + nitro * 0.08 + fever * 0.07 - impact * 0.18;
    const targetVibrance = base.vibrance + nitro * 0.06;
    const targetVignette =
      base.vignetteIntensity + speed * 0.08 + nitro * 0.14 + impact * 0.26;
    const targetChromatic = state.isGarage
      ? 0
      : nitro * 0.0042 + fever * 0.0014 + speed * 0.0008 + impact * 0.011;

    const lambda = 6.5;
    this.currentExposure = THREE.MathUtils.damp(this.currentExposure, targetExposure, lambda, dt);
    this.currentBloomStrength = THREE.MathUtils.damp(
      this.currentBloomStrength,
      targetBloomStrength,
      lambda,
      dt
    );
    this.currentBloomRadius = THREE.MathUtils.damp(
      this.currentBloomRadius,
      targetBloomRadius,
      lambda,
      dt
    );
    this.currentBloomThreshold = THREE.MathUtils.damp(
      this.currentBloomThreshold,
      targetBloomThreshold,
      lambda,
      dt
    );
    this.currentContrast = THREE.MathUtils.damp(this.currentContrast, targetContrast, lambda, dt);
    this.currentSaturation = THREE.MathUtils.damp(
      this.currentSaturation,
      targetSaturation,
      lambda,
      dt
    );
    this.currentVibrance = THREE.MathUtils.damp(this.currentVibrance, targetVibrance, lambda, dt);
    this.currentBrightness = THREE.MathUtils.damp(
      this.currentBrightness,
      base.brightness,
      lambda,
      dt
    );
    this.currentTemperature = THREE.MathUtils.damp(
      this.currentTemperature,
      base.temperature + fever * 0.05,
      lambda,
      dt
    );
    this.currentVignette = THREE.MathUtils.damp(this.currentVignette, targetVignette, lambda, dt);
    this.currentVignetteSmooth = THREE.MathUtils.damp(
      this.currentVignetteSmooth,
      base.vignetteSmoothness,
      lambda,
      dt
    );
    this.currentChromatic = THREE.MathUtils.damp(
      this.currentChromatic,
      targetChromatic,
      10,
      dt
    );
    this.currentGrain = THREE.MathUtils.damp(this.currentGrain, base.grainAmount, lambda, dt);

    const tFactor = 1 - Math.exp(-lambda * dt);
    this.currentShadowTint.x += (base.shadowTint[0] - this.currentShadowTint.x) * tFactor;
    this.currentShadowTint.y += (base.shadowTint[1] - this.currentShadowTint.y) * tFactor;
    this.currentShadowTint.z += (base.shadowTint[2] - this.currentShadowTint.z) * tFactor;

    this.currentHighlightTint.x += (base.highlightTint[0] - this.currentHighlightTint.x) * tFactor;
    this.currentHighlightTint.y += (base.highlightTint[1] - this.currentHighlightTint.y) * tFactor;
    this.currentHighlightTint.z += (base.highlightTint[2] - this.currentHighlightTint.z) * tFactor;

    this.applyUniforms(state.time);
  }

  private applyUniforms(time: number): void {
    this.renderer.toneMappingExposure = this.currentExposure;

    if (this.bloomPass) {
      this.bloomPass.strength = this.currentBloomStrength;
      this.bloomPass.radius = this.currentBloomRadius;
      this.bloomPass.threshold = this.currentBloomThreshold;
    }

    if (this.colorGradePass) {
      const u = this.colorGradePass.uniforms;
      u.uContrast.value = this.currentContrast;
      u.uSaturation.value = this.currentSaturation;
      u.uVibrance.value = this.currentVibrance;
      u.uBrightness.value = this.currentBrightness;
      u.uTemperature.value = this.currentTemperature;
      (u.uShadowTint.value as THREE.Vector3).copy(this.currentShadowTint);
      (u.uHighlightTint.value as THREE.Vector3).copy(this.currentHighlightTint);
      u.uVignetteIntensity.value = this.currentVignette;
      u.uVignetteSmoothness.value = this.currentVignetteSmooth;
      u.uChromaticAmount.value = this.currentChromatic;
      u.uGrainAmount.value = this.currentGrain;
      u.uTime.value = time;
    }
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.isSoftwareGl && this.composer && this.quality !== 'low') {
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  public dispose(): void {
    this.bloomPass?.dispose();
    this.colorGradePass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();
    this.renderTarget?.dispose();
    this.composer = null;
    this.renderTarget = null;
    this.bloomPass = null;
    this.colorGradePass = null;
    this.outputPass = null;
  }
}
