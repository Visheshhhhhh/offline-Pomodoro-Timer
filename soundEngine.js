/**
 * SoundEngine - 100% Offline Web Audio API Synthesizer
 * Generates ambient soundscapes and alert chimes procedurally without external MP3s.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.chimeGain = null;

    this.activeAmbient = null; // 'rain', 'brown', 'binaural', 'wind'
    this.ambientNodes = [];
    this.alertLoopTimer = null;
    this.isMuted = false;

    this.volumeSettings = {
      master: 0.8,
      ambient: 0.5,
      chime: 0.9,
    };

    // Analyser node for audio visualizer
    this.analyser = null;
  }

  /**
   * Initializes Audio Context on user gesture
   */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('Web Audio API not supported in this browser.');
      return;
    }

    this.ctx = new AudioCtx();

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volumeSettings.master, this.ctx.currentTime);

    // Analyser for visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;

    // Connect Master -> Analyser -> Destination
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Ambient Sub-bus
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.volumeSettings.ambient, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    // Chime Sub-bus
    this.chimeGain = this.ctx.createGain();
    this.chimeGain.gain.setValueAtTime(this.volumeSettings.chime, this.ctx.currentTime);
    this.chimeGain.connect(this.masterGain);
  }

  setMasterVolume(vol) {
    this.volumeSettings.master = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volumeSettings.master, this.ctx.currentTime, 0.05);
    }
  }

  setAmbientVolume(vol) {
    this.volumeSettings.ambient = Math.max(0, Math.min(1, vol));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.volumeSettings.ambient, this.ctx.currentTime, 0.05);
    }
  }

  setChimeVolume(vol) {
    this.volumeSettings.chime = Math.max(0, Math.min(1, vol));
    if (this.chimeGain && this.ctx) {
      this.chimeGain.gain.setTargetAtTime(this.volumeSettings.chime, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volumeSettings.master,
        this.ctx.currentTime,
        0.05
      );
    }
    return this.isMuted;
  }

  // -------------------------------------------------------------
  // PROCEDURAL ALARM CHIMES
  // -------------------------------------------------------------

  /**
   * Play selected alert sound once or start looping for popup alert
   * Types: 'zenBowl', 'gong', 'digitalBeep', 'marimba'
   */
  playChime(type = 'zenBowl') {
    this.init();
    if (!this.ctx) return;

    switch (type) {
      case 'gong':
        this._playGong();
        break;
      case 'digitalBeep':
        this._playDigitalBeep();
        break;
      case 'marimba':
        this._playMarimba();
        break;
      case 'zenBowl':
      default:
        this._playZenBowl();
        break;
    }
  }

  /**
   * Start repeated alarm chime until user acknowledges completion popup
   */
  startAlarmLoop(type = 'zenBowl') {
    this.stopAlarmLoop();
    this.playChime(type);

    // Repeat chime every 3.5 seconds
    this.alertLoopTimer = setInterval(() => {
      this.playChime(type);
    }, 3500);
  }

  stopAlarmLoop() {
    if (this.alertLoopTimer) {
      clearInterval(this.alertLoopTimer);
      this.alertLoopTimer = null;
    }
  }

  _playZenBowl() {
    const t = this.ctx.currentTime;

    // Harmonic frequencies for Tibetan singing bowl sound
    const freqs = [216, 432, 648, 864];
    const gains = [0.6, 0.3, 0.15, 0.05];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      // Mild pitch drop for resonance
      osc.frequency.exponentialRampToValueAtTime(freq * 0.998, t + 3.0);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(gains[idx], t + 0.08); // soft attack
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2); // long tail decay

      osc.connect(gain);
      gain.connect(this.chimeGain);

      osc.start(t);
      osc.stop(t + 3.3);
    });
  }

  _playGong() {
    const t = this.ctx.currentTime;
    const freqs = [110, 164.81, 220, 329.63, 440];

    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.4 / (i + 1), t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 4.0);

      osc.connect(gain);
      gain.connect(this.chimeGain);

      osc.start(t);
      osc.stop(t + 4.1);
    });
  }

  _playDigitalBeep() {
    const t = this.ctx.currentTime;
    const notes = [880, 1174.66, 1760]; // A5, D6, A6

    notes.forEach((note, i) => {
      const startTime = t + i * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(this.chimeGain);

      osc.start(startTime);
      osc.stop(startTime + 0.11);
    });
  }

  _playMarimba() {
    const t = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    chord.forEach((freq, i) => {
      const startTime = t + i * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8);

      osc.connect(gain);
      gain.connect(this.chimeGain);

      osc.start(startTime);
      osc.stop(startTime + 0.85);
    });
  }

  // -------------------------------------------------------------
  // PROCEDURAL AMBIENT SOUND GENERATORS (100% Offline)
  // -------------------------------------------------------------

  /**
   * Toggle or switch ambient focus soundscape
   * @param {string|null} type - 'rain', 'brown', 'binaural', 'wind' or null to stop
   */
  setAmbient(type) {
    this.init();
    if (!this.ctx) return;

    this.stopAmbient();

    if (!type || type === 'none') {
      this.activeAmbient = null;
      return;
    }

    this.activeAmbient = type;

    switch (type) {
      case 'rain':
        this._startRainSound();
        break;
      case 'brown':
        this._startBrownNoise();
        break;
      case 'binaural':
        this._startBinauralBeats();
        break;
      case 'wind':
        this._startWindSound();
        break;
    }
  }

  stopAmbient() {
    this.ambientNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {
        // node already stopped
      }
    });
    this.ambientNodes = [];
    this.activeAmbient = null;
  }

  /**
   * Helper: Generate audio buffer of white noise
   */
  _createNoiseBuffer(duration = 5) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Rain Soundscape (Filtered white noise + low pass + random crackle)
   */
  _startRainSound() {
    const noiseBuffer = this.createLoopingNoiseNode(5);

    // Filter for rain hiss/patter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    noiseBuffer.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    noiseBuffer.start();
    this.ambientNodes.push(noiseBuffer, filter, gain);
  }

  /**
   * Deep Brown Noise (Deep focus frequency curve)
   */
  _startBrownNoise() {
    const bufferSize = this.ctx.sampleRate * 5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain compensation
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    noise.start();
    this.ambientNodes.push(noise, filter, gain);
  }

  /**
   * 40Hz Binaural Beats (Beta Waves for Deep Concentration)
   * Left ear: 200Hz, Right ear: 240Hz
   */
  _startBinauralBeats() {
    const t = this.ctx.currentTime;
    const merger = this.ctx.createChannelMerger(2);

    // Left channel
    const oscL = this.ctx.createOscillator();
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(200, t);

    // Right channel (200 + 40Hz difference)
    const oscR = this.ctx.createOscillator();
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(240, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);

    oscL.connect(merger, 0, 0); // Left channel
    oscR.connect(merger, 0, 1); // Right channel

    merger.connect(gain);
    gain.connect(this.ambientGain);

    oscL.start();
    oscR.start();

    this.ambientNodes.push(oscL, oscR, merger, gain);
  }

  /**
   * Soft Wind Ambient
   */
  _startWindSound() {
    const noise = this.createLoopingNoiseNode(5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    // LFO to modulate wind frequency (gusts)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime); // Slow sweep

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(200, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    noise.start();
    lfo.start();

    this.ambientNodes.push(noise, filter, lfo, lfoGain, gain);
  }

  createLoopingNoiseNode(duration = 5) {
    const buffer = this._createNoiseBuffer(duration);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    return noise;
  }
}

// Expose singleton sound engine instance globally
window.soundEngine = new SoundEngine();
