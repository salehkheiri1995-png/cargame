import * as THREE from 'three';
import type { EnvironmentConfig, EnvironmentId } from '../types';

export interface RoadPbrTextures {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

/**
 * Photorealistic 2048px PBR 4-lane expressway textures:
 * - Fine weathered tarmac mineral grain (zero blocky pixel artifacts)
 * - Longitudinal glossy tire wear tracks + wet rain puddles for night/sunset worlds
 * - Crisp highway dashed lane dividers, cat's-eye studs, and concrete shoulder markings
 */
export function createRoadPbrTextures(
  env: EnvironmentConfig,
  maxAnisotropy: number
): RoadPbrTextures {
  const size = 2048;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  const isWet = Boolean(env.isWet);
  const isNight = Boolean(env.isNight);

  // 1. Base tarmac gradient with subtle asphalt crown shading
  const baseGrad = ctx.createLinearGradient(0, 0, size, 0);
  baseGrad.addColorStop(0, env.roadColor);
  baseGrad.addColorStop(0.5, isNight ? '#19202e' : '#2d323c');
  baseGrad.addColorStop(1, env.roadColor);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Base roughness: wet roads are dramatically glossier so headlights & sky reflect!
  rctx.fillStyle = isWet ? '#484848' : '#b8b8b8';
  rctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  // 2. Natural asphalt aggregate variation (soft translucent radial blotches, zero pixels)
  for (let i = 0; i < 650; i++) {
    const x = ((i * 521) % size);
    const y = ((i * 887) % size);
    const rad = 14 + (i % 38);
    const light = i % 2 === 0;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, light ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.055)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();

    // Wet rain puddles in roughness map (super glossy dark mirrors!)
    if (isWet && i % 4 === 0) {
      const pg = rctx.createRadialGradient(x, y, 4, x, y, rad * 2.2);
      pg.addColorStop(0, 'rgba(18, 18, 18, 0.92)');
      pg.addColorStop(0.65, 'rgba(34, 34, 34, 0.55)');
      pg.addColorStop(1, 'rgba(72, 72, 72, 0)');
      rctx.fillStyle = pg;
      rctx.beginPath();
      rctx.arc(x, y, rad * 2.2, 0, Math.PI * 2);
      rctx.fill();
    }
  }

  // Fine mineral sand micro-grain (1.2px smooth dots)
  for (let i = 0; i < 16000; i++) {
    const x = (i * 197 + ((i * i) % 97)) % size;
    const y = (i * 353 + ((i * 13) % 127)) % size;
    const shade = 26 + (i % 36);
    ctx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 9}, 0.16)`;
    ctx.fillRect(x, y, 1.5, 1.5);

    const bVal = 114 + (i % 28);
    bctx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bctx.fillRect(x, y, 1.8, 1.8);
  }

  // 3. Realistic darker polished tire-wear tracks along all 4 lanes
  const laneCenters = [size * 0.175, size * 0.39, size * 0.61, size * 0.825];
  laneCenters.forEach((cx) => {
    [-68, 68].forEach((wheelOff) => {
      const wg = ctx.createLinearGradient(cx + wheelOff - 48, 0, cx + wheelOff + 48, 0);
      wg.addColorStop(0, 'rgba(0,0,0,0)');
      wg.addColorStop(0.5, 'rgba(5,8,14,0.28)');
      wg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(cx + wheelOff - 48, 0, 96, size);

      const rg = rctx.createLinearGradient(cx + wheelOff - 44, 0, cx + wheelOff + 44, 0);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(0.5, isWet ? 'rgba(12,12,12,0.85)' : 'rgba(110,110,110,0.65)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      rctx.fillStyle = rg;
      rctx.fillRect(cx + wheelOff - 44, 0, 88, size);
    });
  });

  // 4. Subtle realistic sealed tar expansion joints & fine cracks
  ctx.strokeStyle = 'rgba(8, 10, 16, 0.45)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const startX = 160 + ((i * 251) % (size - 320));
    const startY = (i * 139) % size;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + 42, startY + 64, startX - 18, startY + 135);
    ctx.stroke();
  }

  // 5. Realistic concrete edge rumble strips & highway edge lines
  const curbW = 92;
  ctx.fillStyle = isNight ? '#1e293b' : '#475569';
  ctx.fillRect(0, 0, curbW, size);
  ctx.fillRect(size - curbW, 0, curbW, size);

  // Subtle painted safety kerb markers along outer edge
  const segH = 128;
  for (let y = 0; y < size; y += segH) {
    const isPrim = (y / segH) % 2 === 0;
    ctx.fillStyle = isPrim ? env.curbPrimary : env.curbSecondary;
    ctx.fillRect(0, y, 28, segH);
    ctx.fillRect(size - 28, y, 28, segH);
  }

  // Crisp continuous white/gold highway shoulder stripes
  ctx.fillStyle = isNight ? '#bae6fd' : '#f1f5f9';
  ctx.fillRect(curbW + 18, 0, 22, size);
  ctx.fillRect(size - curbW - 40, 0, 22, size);
  rctx.fillStyle = '#555555';
  rctx.fillRect(curbW + 18, 0, 22, size);
  rctx.fillRect(size - curbW - 40, 0, 22, size);

  // 6. Double amber/gold centerline + crisp dashed lane separators
  ctx.fillStyle = isNight ? '#f59e0b' : '#eab308';
  ctx.fillRect(size / 2 - 18, 0, 12, size);
  ctx.fillRect(size / 2 + 6, 0, 12, size);

  const dashPositions = [size * 0.282, size * 0.718];
  ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
  for (const dx of dashPositions) {
    for (let y = 24; y < size; y += 256) {
      ctx.beginPath();
      ctx.roundRect(dx - 9, y, 18, 128, 6);
      ctx.fill();

      // Reflective cat's-eye road stud
      ctx.fillStyle = isNight ? '#38bdf8' : '#fef08a';
      ctx.beginPath();
      ctx.arc(dx, y + 188, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
    }
  }

  const configureTex = (canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 14);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    map: configureTex(albedoCanvas, true),
    roughnessMap: configureTex(roughCanvas, false),
    bumpMap: configureTex(bumpCanvas, false),
  };
}

export function createTerrainTexture(
  envId: EnvironmentId,
  baseHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const isDark = envId === 'nightCity';
  for (let i = 0; i < 420; i++) {
    const x = (i * 211) % size;
    const y = (i * 337) % size;
    const r = 36 + (i % 78);
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const bright = i % 2 === 0;
    if (isDark) {
      g.addColorStop(0, bright ? 'rgba(56,189,248,0.06)' : 'rgba(2,6,23,0.35)');
    } else {
      g.addColorStop(0, bright ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.09)');
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (envId === 'desert' || envId === 'coastal' || envId === 'sunsetCanyon') {
    ctx.strokeStyle =
      envId === 'sunsetCanyon' ? 'rgba(251, 146, 60, 0.14)' : 'rgba(255, 240, 200, 0.14)';
    ctx.lineWidth = 10;
    for (let y = 24; y < size; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.33, y - 24, size * 0.66, y + 24, size, y);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 22);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createSkyDomeTexture(env: EnvironmentConfig): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, env.skyTop);
  grad.addColorStop(0.55, env.skyBottom);
  grad.addColorStop(0.86, env.fogColor);
  grad.addColorStop(1, env.fogColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  if (env.isNight) {
    // Crisp starfield + distant glowing city horizon haze + cool moon halo
    for (let i = 0; i < 240; i++) {
      const sx = (i * 197 + 31) % 1024;
      const sy = (i * 83 + 17) % 240;
      const r = i % 7 === 0 ? 1.8 : 0.9;
      ctx.fillStyle = `rgba(226, 232, 240, ${0.4 + (i % 6) * 0.1})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cool moonlight halo
    const moon = ctx.createRadialGradient(512, 165, 8, 512, 165, 130);
    moon.addColorStop(0, 'rgba(224, 242, 254, 0.95)');
    moon.addColorStop(0.18, 'rgba(147, 197, 253, 0.45)');
    moon.addColorStop(0.55, 'rgba(59, 130, 246, 0.12)');
    moon.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(512, 165, 130, 0, Math.PI * 2);
    ctx.fill();

    // Magenta & cyan skyline light pollution glow at the horizon
    const neonHaze = ctx.createLinearGradient(0, 260, 0, 420);
    neonHaze.addColorStop(0, 'rgba(15, 23, 42, 0)');
    neonHaze.addColorStop(0.55, 'rgba(168, 85, 247, 0.22)');
    neonHaze.addColorStop(1, 'rgba(14, 165, 233, 0.28)');
    ctx.fillStyle = neonHaze;
    ctx.fillRect(0, 260, 1024, 160);
  } else {
    // Soft photographic atmospheric cirrus clouds
    for (let i = 0; i < 22; i++) {
      const cx = (i * 149) % 1024;
      const cy = 96 + (i % 5) * 34;
      const rw = 95 + (i % 4) * 52;
      const rh = 15 + (i % 3) * 7;
      const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, rw);
      cg.addColorStop(
        0,
        env.id === 'sunsetCanyon' ? 'rgba(255, 214, 165, 0.34)' : 'rgba(255,255,255,0.22)'
      );
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, rh / rw);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, rw, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Photographic Sun Disc + Volumetric Golden-Hour Halo
    const sunX = 512;
    const sunY = env.id === 'sunsetCanyon' ? 245 : 185;
    const sunR = env.id === 'sunsetCanyon' ? 220 : 165;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, sunR);
    sunGlow.addColorStop(0, 'rgba(255, 255, 245, 1)');
    sunGlow.addColorStop(
      0.16,
      env.id === 'sunsetCanyon' ? 'rgba(253, 186, 116, 0.92)' : 'rgba(254, 240, 138, 0.85)'
    );
    sunGlow.addColorStop(
      0.48,
      env.id === 'sunsetCanyon' ? 'rgba(249, 115, 22, 0.35)' : 'rgba(253, 186, 116, 0.22)'
    );
    sunGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createBoostPadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, 'rgba(14, 165, 233, 0.12)');
  bg.addColorStop(0.5, 'rgba(56, 189, 248, 0.58)');
  bg.addColorStop(1, 'rgba(139, 92, 246, 0.2)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 512);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [120, 256, 392].forEach((cy) => {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(42, cy + 48);
    ctx.lineTo(128, cy - 32);
    ctx.lineTo(214, cy + 48);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(42, cy + 48);
    ctx.lineTo(128, cy - 32);
    ctx.lineTo(214, cy + 48);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTireTreadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#15161a';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#262830';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  for (let y = -32; y < 288; y += 34) {
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(128, y + 22);
    ctx.lineTo(242, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#0b0c0f';
  ctx.fillRect(114, 0, 10, 256);
  ctx.fillRect(132, 0, 10, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCarbonTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 16) {
    for (let x = 0; x < 128; x += 16) {
      const even = ((x + y) / 16) % 2 === 0;
      ctx.fillStyle = even ? '#1e222b' : '#14171f';
      ctx.fillRect(x, y, 8, 16);
      ctx.fillStyle = even ? '#14171f' : '#252a36';
      ctx.fillRect(x + 8, y, 8, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 28, 128, 128, 124);
  grad.addColorStop(0, 'rgba(4, 7, 14, 0.92)');
  grad.addColorStop(0.58, 'rgba(4, 7, 14, 0.5)');
  grad.addColorStop(1, 'rgba(4, 7, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Modern glass-curtain architectural skyscraper facades (realistic daylight or glowing midnight windows!)
 */
export function createBuildingFacadeTexture(
  baseHex: string,
  windowHex: string,
  maxAnisotropy: number,
  isNight = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const wallGrad = ctx.createLinearGradient(0, 0, 0, 512);
  wallGrad.addColorStop(0, isNight ? '#0c1322' : baseHex);
  wallGrad.addColorStop(1, isNight ? '#1e293b' : '#cbd5e1');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Horizontal steel/concrete floor spandrels
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = isNight ? '#090d16' : 'rgba(15,23,42,0.22)';
    ctx.fillRect(0, y, 512, 10);
  }

  // Curtain-wall glass panes
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 5; col++) {
      const wx = 16 + col * 98;
      const wy = 14 + row * 64;
      const hash = (row * 17 + col * 31) % 11;

      if (isNight) {
        const lit = hash < 6;
        if (lit) {
          const glow = ctx.createLinearGradient(wx, wy, wx, wy + 44);
          glow.addColorStop(0, hash % 2 === 0 ? windowHex : '#fde68a');
          glow.addColorStop(1, hash % 2 === 0 ? '#0284c7' : '#d97706');
          ctx.fillStyle = glow;
        } else {
          ctx.fillStyle = '#0f172a';
        }
        ctx.beginPath();
        ctx.roundRect(wx, wy, 82, 44, 3);
        ctx.fill();
      } else {
        const wg = ctx.createLinearGradient(wx, wy, wx, wy + 44);
        wg.addColorStop(0, '#1e3a5f');
        wg.addColorStop(0.55, windowHex);
        wg.addColorStop(1, '#334155');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.roundRect(wx, wy, 82, 44, 3);
        ctx.fill();

        // Diagonal sky reflection gloss
        ctx.fillStyle = 'rgba(255,255,255,0.26)';
        ctx.beginPath();
        ctx.moveTo(wx + 8, wy + 42);
        ctx.lineTo(wx + 32, wy + 2);
        ctx.lineTo(wx + 48, wy + 2);
        ctx.lineTo(wx + 24, wy + 42);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createHighwayGantryTexture(
  isNight: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 1024, 256);
  if (isNight) {
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#1e1b4b');
    bg.addColorStop(1, '#0c4a6e');
  } else {
    bg.addColorStop(0, '#065f46');
    bg.addColorStop(1, '#047857');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);

  // Outer crisp reflective border
  ctx.strokeStyle = isNight ? '#38bdf8' : '#f8fafc';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 1000, 232);

  // Route shield badge
  ctx.fillStyle = isNight ? '#ec4899' : '#facc15';
  ctx.beginPath();
  ctx.roundRect(44, 48, 168, 160, 18);
  ctx.fill();

  ctx.fillStyle = isNight ? '#ffffff' : '#0f172a';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E-01', 128, 130);

  // Expressway destination typography
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = 'bold 62px sans-serif';
  ctx.fillText(isNight ? 'NEON METRO EXPRESS' : 'TURBO EXPRESSWAY', 250, 104);

  ctx.fillStyle = isNight ? '#7dd3fc' : '#d1fae5';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(isNight ? 'DOWNTOWN  4 KM  ▼     BAY BRIDGE  12 KM  ▼' : 'CITY CENTER  5 KM  ▼     COASTAL EXIT  10 KM  ▼', 250, 178);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCheckpointBannerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      ctx.fillStyle = (x / sq + y / sq) % 2 === 0 ? '#facc15' : '#0f172a';
      ctx.fillRect(x, y, sq, sq);
    }
  }

  const grad = ctx.createLinearGradient(0, 28, 512, 100);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#0284c7');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 28, 512, 72);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TURBO CHECKPOINT', 256, 65);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createSignTexture(
  kind: 'arrow' | 'turbo' | 'limit',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = kind === 'limit' ? '#f8fafc' : kind === 'turbo' ? '#0f172a' : '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 244, 28);
  ctx.fill();

  ctx.strokeStyle = kind === 'limit' ? '#dc2626' : kind === 'turbo' ? '#38bdf8' : '#0f172a';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.roundRect(16, 16, 224, 224, 22);
  ctx.stroke();

  ctx.fillStyle = kind === 'turbo' ? '#38bdf8' : '#0f172a';
  ctx.font = 'bold 88px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (kind === 'limit') ctx.fillText('240', 128, 134);
  else if (kind === 'turbo') ctx.fillText('GT', 128, 134);
  else ctx.fillText('▲', 128, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createNeonBillboardTexture(
  variant: number,
  isNight: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const themes = [
    { bg0: '#090d1a', bg1: '#1e1b4b', accent: '#38bdf8', sub: '#facc15', title: 'APEX GT', desc: 'TURBO SERIES' },
    { bg0: '#160918', bg1: '#4a044e', accent: '#ec4899', sub: '#38bdf8', title: 'NITRO X', desc: 'NIGHT CIRCUIT' },
    { bg0: '#0b1320', bg1: '#064e3b', accent: '#2dd4bf', sub: '#fde047', title: 'HYPER LAB', desc: 'AERO DYNAMICS' },
  ];
  const th = themes[variant % themes.length];

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, isNight ? th.bg0 : '#0f172a');
  grad.addColorStop(1, th.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Diagonal speed streaks
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = -2; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 110, 0);
    ctx.lineTo(i * 110 + 48, 0);
    ctx.lineTo(i * 110 - 30, 256);
    ctx.lineTo(i * 110 - 78, 256);
    ctx.closePath();
    ctx.fill();
  }

  // Luminous frame border
  ctx.strokeStyle = th.accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 492, 236);

  // Headline & racing tagline
  ctx.fillStyle = th.accent;
  ctx.font = 'italic bold 76px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(th.title, 256, 106);

  ctx.fillStyle = th.sub;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(th.desc, 256, 182);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

const faceTextureCache = new Map<string, THREE.CanvasTexture>();

export function createHumanFaceTexture(options: {
  skinHex: string;
  eyeHex: string;
  hairHex: string;
  sunglasses?: boolean;
  beard?: boolean;
  isWoman?: boolean;
  isChild?: boolean;
}): THREE.CanvasTexture {
  const key = JSON.stringify(options);
  const cached = faceTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const skinBase = ctx.createLinearGradient(0, 0, 0, 256);
  skinBase.addColorStop(0, options.skinHex);
  skinBase.addColorStop(0.65, options.skinHex);
  skinBase.addColorStop(1, '#9a6b4c');
  ctx.fillStyle = skinBase;
  ctx.fillRect(0, 0, 512, 256);

  const cx = 256;
  const cheekGlow = ctx.createRadialGradient(cx - 42, 146, 4, cx - 42, 146, 28);
  cheekGlow.addColorStop(0, options.isChild || options.isWoman ? 'rgba(239, 108, 125, 0.28)' : 'rgba(210, 115, 95, 0.16)');
  cheekGlow.addColorStop(1, 'rgba(239, 108, 125, 0)');
  ctx.fillStyle = cheekGlow;
  ctx.fillRect(cx - 72, 116, 60, 60);

  const cheekGlowR = ctx.createRadialGradient(cx + 42, 146, 4, cx + 42, 146, 28);
  cheekGlowR.addColorStop(0, options.isChild || options.isWoman ? 'rgba(239, 108, 125, 0.28)' : 'rgba(210, 115, 95, 0.16)');
  cheekGlowR.addColorStop(1, 'rgba(239, 108, 125, 0)');
  ctx.fillStyle = cheekGlowR;
  ctx.fillRect(cx + 12, 116, 60, 60);

  ctx.strokeStyle = options.hairHex;
  ctx.lineWidth = options.isWoman ? 4.2 : 5.5;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx + side * 14, 104);
    ctx.quadraticCurveTo(cx + side * 28, 97, cx + side * 44, 104);
    ctx.stroke();
  });

  const eyeY = options.isChild ? 124 : 120;
  const eyeRx = options.isChild ? 12 : 11;
  const eyeRy = options.isChild ? 8.5 : 6.8;
  [-1, 1].forEach((side) => {
    const ex = cx + side * 28;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = options.eyeHex;
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeRy * 0.78, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#090b10';
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeRy * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 2.2, eyeY - 2.2, 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = options.isWoman ? 3.2 : 2.3;
    ctx.beginPath();
    ctx.arc(ex, eyeY + 1, eyeRx, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  });

  ctx.fillStyle = 'rgba(72, 42, 26, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, 146, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (options.beard && !options.isWoman && !options.isChild) {
    ctx.fillStyle = 'rgba(28, 22, 18, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, 178, 46, 26, 0, 0, Math.PI);
    ctx.fill();
  }

  ctx.strokeStyle = options.isWoman ? '#b91c4c' : '#8c443c';
  ctx.lineWidth = options.isWoman ? 4.2 : 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 16, 166);
  ctx.quadraticCurveTo(cx, 175, cx + 16, 166);
  ctx.stroke();

  if (options.isChild) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, 169, 9, 3.2, 0, 0, Math.PI);
    ctx.fill();
  }

  if (options.sunglasses) {
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    [-1, 1].forEach((side) => {
      const gx = cx + side * 28 - 17;
      ctx.beginPath();
      ctx.roundRect(gx, eyeY - 11, 34, 21, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
      ctx.beginPath();
      ctx.moveTo(gx + 5, eyeY - 8);
      ctx.lineTo(gx + 15, eyeY - 8);
      ctx.lineTo(gx + 8, eyeY + 7);
      ctx.lineTo(gx + 2, eyeY + 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#090d16';
    });
    ctx.fillRect(cx - 11, eyeY - 5, 22, 3.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  tex.needsUpdate = true;
  faceTextureCache.set(key, tex);
  return tex;
}

let cachedDashboardTexture: THREE.CanvasTexture | null = null;

export function createDashboardTexture(): THREE.CanvasTexture {
  if (cachedDashboardTexture) return cachedDashboardTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 504, 152);

  const drawDial = (cx: number, cy: number, r: number, color: string, label: string, val: string) => {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 1.92);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.95, Math.PI * 2.25);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(val, cx, cy - 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, cx, cy + 22);
  };

  drawDial(98, 84, 52, '#38bdf8', 'RPM x1000', '7.4');
  drawDial(224, 84, 52, '#facc15', 'KM/H', '248');

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(306, 20, 184, 118, 12);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 1;
  for (let gx = 326; gx < 480; gx += 24) {
    ctx.beginPath();
    ctx.moveTo(gx, 24);
    ctx.lineTo(gx, 134);
    ctx.stroke();
  }
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(332, 122);
  ctx.bezierCurveTo(368, 92, 412, 66, 456, 36);
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TURBO OS  •  SPORT+', 320, 42);

  const ledColors = ['#22c55e', '#22c55e', '#22c55e', '#eab308', '#eab308', '#ef4444', '#ef4444'];
  ledColors.forEach((c, idx) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(88 + idx * 24, 18, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  tex.needsUpdate = true;
  cachedDashboardTexture = tex;
  return tex;
}

let cachedHoneycombGrilleTexture: THREE.CanvasTexture | null = null;

/**
 * Procedural metallic hexagonal honeycomb intake grille mesh for photorealistic front bumpers.
 */
export function createHoneycombGrilleTexture(): THREE.CanvasTexture {
  if (cachedHoneycombGrilleTexture) return cachedHoneycombGrilleTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep recessed radiator cavity behind the grille
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, size, size);

  // Subtle horizontal intercooler core fins behind the mesh
  ctx.fillStyle = '#111622';
  for (let y = 6; y < size; y += 16) {
    ctx.fillRect(0, y, size, 4);
  }

  // Hexagonal satin-metallic honeycomb ribs
  const r = 16;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  ctx.lineJoin = 'round';

  for (let col = -1; col <= Math.ceil(size / dx) + 1; col++) {
    for (let row = -1; row <= Math.ceil(size / dy) + 1; row++) {
      const cx = col * dx;
      const cy = row * dy + (col % 2 !== 0 ? dy * 0.5 : 0);

      // Dark metallic bevel shadow
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3;
        const px = cx + Math.cos(ang) * (r - 2.2);
        const py = cy + Math.sin(ang) * (r - 2.2);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = '#333b4d';
      ctx.lineWidth = 4.2;
      ctx.stroke();

      // Subtle top specular highlight along hex edge
      ctx.strokeStyle = '#525f7a';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 1.3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  tex.needsUpdate = true;
  cachedHoneycombGrilleTexture = tex;
  return tex;
}

let cachedLicensePlateTexture: THREE.CanvasTexture | null = null;

/**
 * Crisp realistic modern sport license plate texture with blue side band and metallic border.
 */
export function createLicensePlateTexture(): THREE.CanvasTexture {
  if (cachedLicensePlateTexture) return cachedLicensePlateTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Embossed matte-white aluminum plate base
  const bg = ctx.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, '#f8fafc');
  bg.addColorStop(0.5, '#e8edf4');
  bg.addColorStop(1, '#d8e0eb');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);

  // Dark outer frame bezel
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 118);

  // Left blue country/sport series band
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(10, 10, 62, 108);

  // Mini emblem stripes & series label inside blue band
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(20, 22, 42, 7);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(20, 29, 42, 7);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(20, 36, 42, 7);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TRB', 41, 86);

  // Right regional badge separator
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(416, 12);
  ctx.lineTo(416, 116);
  ctx.stroke();

  // Main embossed plate characters
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('74 · GT 99', 244, 68);

  // Region code on right
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('01', 460, 74);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('PRO', 460, 32);

  // Subtle mounting bolts
  ctx.fillStyle = '#94a3b8';
  [92, 400].forEach((bx) => {
    ctx.beginPath();
    ctx.arc(bx, 64, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  tex.needsUpdate = true;
  cachedLicensePlateTexture = tex;
  return tex;
}



