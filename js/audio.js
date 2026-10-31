/* Small procedural sound engine — no external assets. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.started = false;
    this.noise = null;
    this.ambientNodes = [];
    this.lastHeart = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.42 : 0;
    this.master.connect(this.ctx.destination);

    const length = Math.floor(this.ctx.sampleRate * 1.2);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      data[i] = last;
    }
    this.noise = buffer;
    this.startAmbient();
  }

  startAmbient() {
    if (!this.ctx || this.started) return;
    this.started = true;
    const ctx = this.ctx;

    // Low room tone.
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noise;
    rumble.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 105;
    low.Q.value = 0.7;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.12;
    rumble.connect(low).connect(rumbleGain).connect(this.master);
    rumble.start();
    this.ambientNodes.push(rumble);

    // Refrigeration / electrical hum.
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 49.5;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 160;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.018;
    hum.connect(humFilter).connect(humGain).connect(this.master);
    hum.start();
    this.ambientNodes.push(hum);

    const flicker = ctx.createOscillator();
    flicker.type = 'sine';
    flicker.frequency.value = 0.09;
    const flickerGain = ctx.createGain();
    flickerGain.gain.value = 0.008;
    flicker.connect(flickerGain).connect(humGain.gain);
    flicker.start();
    this.ambientNodes.push(flicker);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) {
      if (on) this.init();
      return;
    }
    if (on && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(on ? 0.42 : 0, this.ctx.currentTime + 0.18);
  }

  tone(freq, duration = 0.15, gain = 0.1, type = 'sine', slide = null) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  burst(duration = 0.12, freq = 800, q = 0.8, gain = 0.1, type = 'bandpass') {
    if (!this.ctx || !this.enabled || !this.noise) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(now, Math.random() * 0.4);
    src.stop(now + duration + 0.02);
  }

  footstep(kind = 'walk') {
    const soft = kind === 'crouch';
    const sprint = kind === 'sprint';
    this.burst(soft ? 0.055 : sprint ? 0.075 : 0.09, soft ? 260 : sprint ? 190 : 310, 0.7, soft ? 0.012 : sprint ? 0.045 : 0.025, 'lowpass');
  }

  swing() {
    this.burst(0.16, 1200, 0.9, 0.045, 'highpass');
    this.tone(105, 0.1, 0.028, 'triangle', 60);
  }

  hit() {
    this.tone(88, 0.16, 0.13, 'sine', 42);
    this.burst(0.08, 480, 0.8, 0.1, 'lowpass');
  }

  execute() {
    this.tone(61, 0.38, 0.2, 'sine', 31);
    this.burst(0.2, 380, 0.5, 0.16, 'lowpass');
    setTimeout(() => {
      this.tone(740, 0.24, 0.04, 'sawtooth', 320);
      this.burst(0.22, 2100, 1.1, 0.025, 'bandpass');
    }, 60);
  }

  alert() {
    this.tone(220, 0.13, 0.055, 'sawtooth', 260);
    setTimeout(() => this.tone(330, 0.18, 0.05, 'sawtooth', 280), 120);
  }

  pickup() {
    this.tone(520, 0.09, 0.035, 'triangle', 760);
    setTimeout(() => this.tone(780, 0.1, 0.025, 'triangle', 900), 70);
  }

  glass() {
    this.burst(0.28, 3400, 1.2, 0.06, 'highpass');
    this.tone(1480, 0.16, 0.025, 'triangle', 920);
  }

  ui() {
    this.tone(640, 0.045, 0.02, 'square', 520);
  }

  heartbeat(intensity = 1) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHeart < 0.48) return;
    this.lastHeart = now;
    this.tone(52, 0.12, 0.035 * intensity, 'sine', 37);
    setTimeout(() => this.tone(46, 0.1, 0.022 * intensity, 'sine', 34), 110);
  }

  win() {
    this.tone(196, 0.5, 0.06, 'triangle', 294);
    setTimeout(() => this.tone(294, 0.7, 0.045, 'triangle', 392), 220);
    setTimeout(() => this.tone(392, 1.2, 0.035, 'sine', 440), 470);
  }

  lose() {
    this.tone(130, 0.8, 0.08, 'sawtooth', 65);
    setTimeout(() => this.tone(98, 1.2, 0.06, 'sine', 49), 300);
  }
}
