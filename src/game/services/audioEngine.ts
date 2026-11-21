// 100% Procedural Web Audio API sound & music synthesizer for Turbo Road

class TurboAudioEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private nitroNoiseNode: AudioBufferSourceNode | null = null;
  private nitroGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicVolume = 0.45;
  private sfxVolume = 0.8;
  private musicMode: 'none' | 'menu' | 'race' = 'none';
  private musicTimer: number | null = null;
  private musicStep = 0;
  private coinStreak = 0;
  private lastCoinTime = 0;
  private brakeCooldown = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.32;
      this.musicGain.connect(this.ctx.destination);

      // Generate reusable white noise buffer for nitro, brakes, and crashes
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 1.5;
      this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  /** Called when the app goes to the background (Capacitor/WebView). */
  public suspend(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => undefined);
    }
  }

  /** Called when the app returns to the foreground; restarts music safely. */
  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    const mode = this.musicMode;
    if (mode !== 'none') {
      this.musicMode = 'none';
      this.setMusicMode(mode);
    }
  }

  public setVolumes(musicVol: number, sfxVol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, musicVol));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.04);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.32, this.ctx.currentTime, 0.05);
    }
  }

  public playButtonClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.06);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playIgnition(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.55);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.62);
  }

  public startEngineLoop(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.stopEngineLoop();

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.001;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;

    this.engineSubOsc = ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 40;

    this.engineOsc.connect(filter);
    this.engineSubOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc.start();
    this.engineSubOsc.start();

    // Nitro filtered noise channel
    if (this.noiseBuffer) {
      const nFilter = ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.value = 900;
      nFilter.Q.value = 1.2;

      this.nitroGain = ctx.createGain();
      this.nitroGain.gain.value = 0.0001;

      this.nitroNoiseNode = ctx.createBufferSource();
      this.nitroNoiseNode.buffer = this.noiseBuffer;
      this.nitroNoiseNode.loop = true;
      this.nitroNoiseNode.connect(nFilter);
      nFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.sfxGain);
      this.nitroNoiseNode.start();
    }
  }

  public updateEngine(speedRatio: number, nitroActive: boolean, braking: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineGain) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1.5, speedRatio));
    const baseFreq = 65 + clamped * 135 + (nitroActive ? 45 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
    this.engineGain.gain.setTargetAtTime(
      this.sfxVolume > 0.01 ? 0.08 + clamped * 0.07 : 0.0001,
      now,
      0.08
    );

    if (this.nitroGain) {
      this.nitroGain.gain.setTargetAtTime(
        nitroActive && this.sfxVolume > 0.01 ? 0.24 : 0.0001,
        now,
        0.06
      );
    }

    if (braking && now > this.brakeCooldown && speedRatio > 0.35) {
      this.brakeCooldown = now + 0.32;
      this.playBrakeScreech();
    }
  }

  public stopEngineLoop(): void {
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      this.nitroNoiseNode?.stop();
    } catch {
      // already stopped
    }
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineGain = null;
    this.nitroNoiseNode = null;
    this.nitroGain = null;
  }

  private playBrakeScreech(): void {
    if (!this.ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = ctxGain(this.ctx, 0.08);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1650, now);
    osc.frequency.exponentialRampToValueAtTime(1120, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playDoorToggle(opening: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = ctx.currentTime;
    const latch = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latch.type = 'triangle';
    latch.frequency.setValueAtTime(opening ? 320 : 190, now);
    latch.frequency.exponentialRampToValueAtTime(opening ? 140 : 75, now + 0.08);
    latchGain.gain.setValueAtTime(0.24, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    latch.connect(latchGain);
    latchGain.connect(this.sfxGain);
    latch.start(now);
    latch.stop(now + 0.1);

    const strut = ctx.createOscillator();
    const strutGain = ctx.createGain();
    strut.type = 'sine';
    strut.frequency.setValueAtTime(opening ? 210 : 390, now + 0.04);
    strut.frequency.exponentialRampToValueAtTime(opening ? 420 : 130, now + 0.26);
    strutGain.gain.setValueAtTime(0.08, now + 0.04);
    strutGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    strut.connect(strutGain);
    strutGain.connect(this.sfxGain);
    strut.start(now + 0.04);
    strut.stop(now + 0.3);
  }

  public playCoin(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = ctx.currentTime;
    if (now - this.lastCoinTime < 0.75) {
      this.coinStreak = Math.min(8, this.coinStreak + 1);
    } else {
      this.coinStreak = 0;
    }
    this.lastCoinTime = now;

    const pitchBoost = Math.pow(1.06, this.coinStreak);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880 * pitchBoost, now);
    osc.frequency.setValueAtTime(1318.5 * pitchBoost, now + 0.055);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playNitroBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.28);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playNearMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.14);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playCheckpoint(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.2);
    });
  }

  public playCrash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const now = ctx.currentTime;

    // Low impact punch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.35);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);

    // Metallic crunch noise burst
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + 0.42);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.42, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.45);
    }
  }

  public playRewardFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0.01) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.22, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  }

  public playCarUnlock(): void {
    this.playRewardFanfare();
    this.playIgnition();
  }

  public setMusicMode(mode: 'none' | 'menu' | 'race'): void {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (mode === 'none') return;

    this.musicStep = 0;
    const tempoMs = mode === 'race' ? 145 : 220;

    // Bright cartoon arcade progressions
    const menuMelody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
    const raceMelody = [
      392, 523.25, 659.25, 523.25, 783.99, 659.25, 587.33, 659.25,
      440, 587.33, 698.46, 587.33, 880, 783.99, 659.25, 587.33,
    ];
    const raceBass = [130.81, 130.81, 164.81, 164.81, 174.61, 174.61, 196, 196];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.musicGain || this.musicVolume <= 0.01) {
        return;
      }
      const now = this.ctx.currentTime;
      const melody = mode === 'race' ? raceMelody : menuMelody;
      const note = melody[this.musicStep % melody.length];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = mode === 'race' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(mode === 'race' ? 0.14 : 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tempoMs / 1000 * 0.88);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = mode === 'race' ? 1200 : 950;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + tempoMs / 1000);

      if (mode === 'race') {
        const bassNote = raceBass[Math.floor(this.musicStep / 2) % raceBass.length];
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'sawtooth';
        bOsc.frequency.setValueAtTime(bassNote, now);
        bGain.gain.setValueAtTime(0.22, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + tempoMs / 1000 * 0.9);
        const bFilter = this.ctx.createBiquadFilter();
        bFilter.type = 'lowpass';
        bFilter.frequency.value = 380;
        bOsc.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(this.musicGain);
        bOsc.start(now);
        bOsc.stop(now + tempoMs / 1000);
      }

      this.musicStep++;
    }, tempoMs);
  }
}

function ctxGain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, ctx.currentTime);
  return g;
}

export const audioEngine = new TurboAudioEngine();
