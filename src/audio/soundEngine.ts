// Web Audio procedural sound engine for Béisbol Dominicano 9
class SoundEngine {
  private ctx: AudioContext | null = null;
  public merengueEnabled = true;
  public sfxEnabled = true;
  private merengueTimer: number | null = null;
  private step = 0;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public startMerengueLoop() {
    this.initContext();
    if (this.merengueTimer !== null) return;

    // 138 BPM Merengue Dominicano 16-step pattern (~110ms per step)
    const melodyNotes = [
      523.25, 0, 659.25, 783.99,
      659.25, 523.25, 587.33, 0,
      587.33, 0, 698.46, 783.99,
      659.25, 587.33, 523.25, 0,
    ];

    this.merengueTimer = window.setInterval(() => {
      if (!this.merengueEnabled || !this.ctx || this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;
      const s = this.step % 16;

      // 1. Güira Dominicana (metallic brush)
      this.playGuira(now, s % 2 === 1 ? 0.03 : 0.015);

      // 2. Tambora Dominicana (low thumps)
      if (s === 0 || s === 6 || s === 8 || s === 12 || s === 14) {
        this.playTambora(now, s === 0 || s === 8 ? 115 : 155, 0.045);
      }

      // 3. Acordeón / Merengue melody
      const freq = melodyNotes[s];
      if (freq > 0) {
        this.playAccordionNote(now, freq, 0.022);
      }

      this.step++;
    }, 115);
  }

  public stopMerengueLoop() {
    if (this.merengueTimer !== null) {
      clearInterval(this.merengueTimer);
      this.merengueTimer = null;
    }
  }

  private playGuira(time: number, gainVal: number) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.038);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  private playTambora(time: number, freq: number, gainVal: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(55, time + 0.08);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.085);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  private playAccordionNote(time: number, freq: number, gainVal: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, time);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.095);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  public playPitchSound() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playBatCrack(isHomeRun: boolean) {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isHomeRun ? 920 : 680, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

    gain.gain.setValueAtTime(isHomeRun ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    if (isHomeRun) {
      this.playCrowdBulla(1.8, true);
    } else {
      this.playCrowdBulla(0.7, false);
    }
  }

  public playCrowdBulla(duration = 1.0, withCorneta = false) {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(0.9, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);

    // Corneta Dominicana fanfare
    if (withCorneta) {
      const notes = [
        { f: 523.25, t: 0.05, d: 0.11 },
        { f: 523.25, t: 0.18, d: 0.11 },
        { f: 659.25, t: 0.31, d: 0.14 },
        { f: 783.99, t: 0.48, d: 0.45 },
      ];
      notes.forEach((n) => {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(n.f, now + n.t);
        g.gain.setValueAtTime(0.14, now + n.t);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start(now + n.t);
        o.stop(now + n.t + n.d + 0.02);
      });
    }
  }

  public playStrikeOrOut() {
    if (!this.sfxEnabled) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.22);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }
}

export const soundEngine = new SoundEngine();
