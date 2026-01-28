import { fetchPresets } from '../../shared/js/api.js';
import { SamplerEngine } from '../engine/SamplerEngine.js';
import { WaveformView } from './WaveformView.js';

export class SamplerGUI {
  constructor(rootEl, engine){
    this.root = rootEl;
    this.engine = engine;

    this.root.innerHTML = `
      <div class="topbar">
        <label>Preset
          <select id="preset" class="select"></select>
        </label>
        <label>Sound
          <select id="sound" class="select"></select>
        </label>
        <label>BPM <input id="bpm" class="number" type="number" min="40" max="240" value="120" /></label>
        <label>Mode
          <select id="mode" class="select">
            <option value="single">Play current</option>
            <option value="together">Play all together</option>
            <option value="sequential">Sequential</option>
          </select>
        </label>
        <button id="play" class="btn primary">Play</button>
        <button id="stop" class="btn">Stop</button>
        <label>Master
          <input id="master" type="range" min="0" max="1" step="0.01" value="0.9" class="range" style="width:220px" />
        </label>
      </div>

      <div class="row">
        <div class="canvas-wrap">
          <canvas id="wave"></canvas>
          <canvas id="playhead" class="overlay"></canvas>
          <canvas id="trims" class="trim"></canvas>
        </div>
      </div>

      <details class="muted"><summary>Details</summary>
        <pre id="meta"></pre>
      </details>
    `;

    // refs
    this.presetSel = this.root.querySelector('#preset');
    this.soundSel  = this.root.querySelector('#sound');
    this.bpmInp    = this.root.querySelector('#bpm');
    this.modeSel   = this.root.querySelector('#mode');
    this.playBtn   = this.root.querySelector('#play');
    this.stopBtn   = this.root.querySelector('#stop');
    this.masterInp = this.root.querySelector('#master');
    this.meta      = this.root.querySelector('#meta');

    const wave = this.root.querySelector('#wave');
    const o    = this.root.querySelector('#playhead');
    const t    = this.root.querySelector('#trims');
    this.view  = new WaveformView(wave, o, t);

    // state
    this.category = null;
    this.index = 0;

    // hook playhead
    this.engine.onPlay((when, offset, dur, buffer)=>{
      this.view.startPlayhead(this.engine.ctx, when, offset, dur);
    });

    // events
    this._wire();
  }

  async mount(){
    const presets = await fetchPresets();
    this.presetSel.innerHTML = presets.map(p => `<option value="${p.category}">${p.name} (${p.count})</option>`).join('');
    this.category = presets[0]?.category ?? null;
    this.presetSel.value = this.category;
    await this._loadCategory(this.category);
  }

  _wire(){
    this.presetSel.oninput = async () => {
      this.category = this.presetSel.value;
      await this._loadCategory(this.category);
    };
    this.soundSel.oninput  = () => { this.index = parseInt(this.soundSel.value,10); this._showCurrent(); };
    this.playBtn.onclick   = () => this._play();
    this.stopBtn.onclick   = () => { this.engine.stopAll(); this.view.stopPlayhead(); };
    this.masterInp.oninput = () => this.engine.setMasterGain(parseFloat(this.masterInp.value));
    window.addEventListener('resize', ()=> this.view.drawWave());
  }

  async _loadCategory(cat){
    await this.engine.loadPreset(cat);
    this.soundSel.innerHTML = this.engine.sounds.map((s,i)=> `<option value="${i}">${s.name||s.id}</option>`).join('');
    this.index = 0; this.soundSel.value = '0';
    this._showCurrent(true);
  }

  _showCurrent(resetDefault=false){
    const s = this.engine.sounds[this.index]; if (!s?.buffer) return;
    this.view.setBuffer(s.buffer);

    const key = `trim:${this.category}:${s.id||s.name}`;
    if (!resetDefault){
      const raw = localStorage.getItem(key);
      if (raw) {
        try{
          const {startSec,endSec}=JSON.parse(raw);
          this.engine.setTrim(this.category, s, startSec, endSec);
          this.view.setTrimsPx(this.view.secToPx(startSec), this.view.secToPx(endSec));
        }catch{}
      }
    }
    // défaut 10%/90% si aucune persist
    if (!localStorage.getItem(key)) {
      const l = Math.round(this.view.canvas.clientWidth * .10);
      const r = Math.round(this.view.canvas.clientWidth * .90);
      this.view.setTrimsPx(l, r);
      this.engine.setTrim(this.category, s, this.view.pxToSec(l), this.view.pxToSec(r));
      localStorage.setItem(key, JSON.stringify(this.engine.getTrim(this.category, s)));
    }

    // persiste à chaque bougé de trims (debounce léger)
    const persist = () => {
      const { leftX, rightX } = this.view.getTrimsPx();
      this.engine.setTrim(this.category, s, this.view.pxToSec(leftX), this.view.pxToSec(rightX));
      try{ localStorage.setItem(key, JSON.stringify(this.engine.getTrim(this.category, s))); }catch{}
    };
    const original = this.view.drawTrims.bind(this.view);
    this.view.drawTrims = () => { original(); clearTimeout(this._t); this._t = setTimeout(persist, 120); };

    this.meta.textContent = `Preset: ${this.category} • ${s.name||s.id} • ${s.buffer.duration.toFixed(2)}s`;
  }

  _play(){
    if (this.engine.ctx.state === 'suspended') this.engine.ctx.resume();
    this.view.stopPlayhead();

    const mode = this.modeSel.value;
    if (mode==='single') this.engine.playSingle(this.category, this.index);
    else if (mode==='together') this.engine.playTogether(this.category);
    else this.engine.playSequential(this.category, parseInt(this.bpmInp.value,10)||120);
  }
}
