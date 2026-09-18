// Web Audio API Synthesizer for Tactical HUD & Mobile Alerts

class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private volume: number = 0.4;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled() {
    return this.soundEnabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Target Lock Sound (Tactical dual chirp)
  public playTargetLocked() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.08);

      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);

      // Second beep
      setTimeout(() => {
        if (!this.ctx || !this.soundEnabled) return;
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        const t2 = this.ctx.currentTime;

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(2800, t2);
        gain2.gain.setValueAtTime(this.volume * 0.35, t2);
        gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.15);

        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);

        osc2.start(t2);
        osc2.stop(t2 + 0.15);
      }, 100);
    } catch {
      // ignore audio errors
    }
  }

  // Mobile Push Notification Chime
  public playMobileNotification() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const notes = [587.33, 880, 1174.66]; // D5, A5, D6 modern notification chime
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteTime = now + idx * 0.07;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(this.volume * 0.5, noteTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.4);
      });
    } catch {
      // ignore
    }
  }

  // Critical Alert Siren (High threat watchlist or sudden confrontation)
  public playCriticalAlarm() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1600, now + 0.15);
      osc.frequency.linearRampToValueAtTime(800, now + 0.3);

      gain.gain.setValueAtTime(this.volume * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // ignore
    }
  }

  // Mechanical Servo Motor Tick / Step
  public playServoMovement() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.05);

      gain.gain.setValueAtTime(this.volume * 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // ignore
    }
  }
}

export const soundManager = new SoundEngine();
