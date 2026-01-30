/**
 * SamplerEngine - Moteur audio pour sampler
 * Gère le chargement des presets, le trim, les effets et la lecture
 */
import { fetchPresetSounds } from '/shared/js/api.js';
import { loadAndDecodeSound } from '/shared/js/soundutils.js';

export class SamplerEngine {
  constructor(audioContext, opts = {}) {
    this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = opts.masterGain ?? 0.9;
    this.master.connect(this.ctx.destination);

    this.sounds = [];
    this.trims = new Map();
    this.effects = new Map();
    this._onPlay = null;
    this._active = new Set();
  }

  setMasterGain(v) { this.master.gain.value = v; }
  onPlay(cb) { this._onPlay = cb; }

  // Gestion des effets par pad
  getEffect(index) {
    if (!this.effects.has(index)) {
      this.effects.set(index, { volume: 1.0, pan: 0, pitch: 1.0 });
    }
    return this.effects.get(index);
  }

  setEffect(index, type, value) {
    const fx = this.getEffect(index);
    fx[type] = value;
    this.effects.set(index, fx);
  }

  async loadPreset(category, onProgress = null) {
    const preset = await fetchPresetSounds(category);
    const sounds = preset.sounds || [];
    const total = sounds.length;
    const buffers = [];

    for (let i = 0; i < total; i++) {
      const buffer = await loadAndDecodeSound(sounds[i].url, this.ctx);
      buffers.push(buffer);
      if (onProgress) onProgress((i + 1) / total, sounds[i].name || sounds[i].id);
    }

    this.sounds = sounds.map((s, i) => ({ ...s, buffer: buffers[i] }));

    // Initialise les trims par défaut
    this.sounds.forEach(s => {
      const key = this._key(category, s);
      if (!this.trims.has(key)) {
        this.trims.set(key, { startSec: 0, endSec: s.buffer?.duration ?? 0 });
      }
    });
  }

  setTrim(category, sound, startSec, endSec) {
    this.trims.set(this._key(category, sound), { startSec, endSec });
  }

  getTrim(category, sound) {
    return this.trims.get(this._key(category, sound));
  }

  noteOn(category, index, when = this.ctx.currentTime + 0.02) {
    const s = this.sounds[index];
    if (!s?.buffer) return;

    const tr = this.getTrim(category, s) || { startSec: 0, endSec: s.buffer.duration };
    const fx = this.getEffect(index);
    const baseDur = Math.max(0, tr.endSec - tr.startSec);
    const dur = baseDur / fx.pitch;

    // Chaîne audio: Source -> Gain -> Pan -> Master
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = fx.pitch;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = fx.volume;

    const panNode = this.ctx.createStereoPanner();
    panNode.pan.value = fx.pan;

    src.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(this.master);

    src.onended = () => this._active.delete(src);
    src.start(when, tr.startSec, baseDur);
    this._active.add(src);

    if (this._onPlay) this._onPlay(when, tr.startSec, dur, s.buffer);
  }

  playSingle(category, index) { this.noteOn(category, index); }

  playTogether(category) {
    const t = this.ctx.currentTime + 0.05;
    this.sounds.forEach((_, i) => this.noteOn(category, i, t));
  }

  playSequential(category, bpm = 120) {
    const beat = 60 / Math.max(40, Math.min(240, bpm));
    let t = this.ctx.currentTime + 0.05;
    this.sounds.forEach((_, i) => { this.noteOn(category, i, t); t += beat; });
  }

  stopAll() {
    this._active.forEach(s => { try { s.stop(0); } catch { } });
    this._active.clear();
  }

  _key(category, sound) { return `${category}:${sound?.id || sound?.name}`; }
}
