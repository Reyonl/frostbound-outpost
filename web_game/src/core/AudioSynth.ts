export class AudioSynth {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainPeak = 0.12,
  ): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playChop(): void {
    this.playTone(190, 75, 0.085, 'triangle', 0.14);
  }

  playTreeFall(): void {
    this.playTone(150, 48, 0.22, 'sawtooth', 0.11);
  }

  playPickup(stackIndex: number): void {
    const base = 360 + Math.min(stackIndex, 24) * 22;
    this.playTone(base, base * 1.32, 0.09, 'sine', 0.11);
  }

  playDrop(): void {
    this.playTone(520, 260, 0.07, 'sine', 0.08);
  }

  playCash(): void {
    this.playTone(680, 1020, 0.11, 'triangle', 0.1);
  }

  playHit(): void {
    this.playTone(130, 52, 0.12, 'square', 0.1);
  }

  playShoot(): void {
    this.playTone(460, 180, 0.08, 'triangle', 0.08);
  }

  playUnlock(): void {
    this.playTone(420, 840, 0.24, 'triangle', 0.14);
  }
}
