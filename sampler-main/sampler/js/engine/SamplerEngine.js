// SamplerEngine — pur audio, réutilisable sans GUI
import { fetchPresetSounds } from '../../shared/js/api.js';
import { loadAndDecodeSound } from '../../shared/js/soundutils.js';

export class SamplerEngine {
  constructor(audioContext, opts = {}) {
    this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = opts.masterGain ?? 0.9;
    this.master.connect(this.ctx.destination);

    this.sounds = [];           // [{ id, name, url, buffer }]
    this.trims  = new Map();    // key -> { startSec, endSec }
    this._onPlay = null;        // callback(when, offsetSec, durSec, buffer)
    this._active = new Set();
  }

  setMasterGain(v){ this.master.gain.value = v; }
  onPlay(cb){ this._onPlay = cb; }

  async loadPreset(category) {
    const preset = await fetchPresetSounds(category);
    const sounds = preset.sounds || [];
    const buffers = await Promise.all(sounds.map(s => loadAndDecodeSound(s.url, this.ctx)));
    this.sounds = sounds.map((s,i)=> ({ ...s, buffer: buffers[i] }));

    // init trims (si non présents)
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
    const s = this.sounds[index]; if (!s?.buffer) return;
    const tr = this.getTrim(category, s) || { startSec: 0, endSec: s.buffer.duration };
    const dur = Math.max(0, tr.endSec - tr.startSec);

    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.connect(this.master);
    src.onended = () => this._active.delete(src);
    src.start(when, tr.startSec, dur);
    this._active.add(src);

    if (this._onPlay) this._onPlay(when, tr.startSec, dur, s.buffer);
  }

  playSingle(category, index){ this.noteOn(category, index); }

  playTogether(category){
    const t = this.ctx.currentTime + 0.05;
    this.sounds.forEach((_, i) => this.noteOn(category, i, t));
  }

  playSequential(category, bpm = 120){
    const beat = 60 / Math.max(40, Math.min(240, bpm));
    let t = this.ctx.currentTime + 0.05;
    this.sounds.forEach((_, i) => { this.noteOn(category, i, t); t += beat; });
  }

  stopAll(){
    this._active.forEach(s => { try { s.stop(0); } catch{} });
    this._active.clear();
  }

  _key(category, sound){ return `${category}:${sound?.id || sound?.name}`; }
}
