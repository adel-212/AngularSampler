import { fetchPresets } from '/shared/js/api.js';
import { SamplerEngine } from '/sampler/js/engine/SamplerEngine.js';
import { WaveformView } from '/sampler/ui/WaveformView.js';

// Mapping clavier → pads (AZERTY)
// Disposition 4x4 correspondant aux pads sur un clavier AZERTY :
//   Rangée 4 (pads 12-15) : 1 2 3 4
//   Rangée 3 (pads 8-11)  : Q W E R
//   Rangée 2 (pads 4-7)   : A S D F
//   Rangée 1 (pads 0-3)   : Z X C V
const KEYBOARD_MAP = {
  // Rangée du bas (pads 0-3) - touches Z X C V sur AZERTY
  'KeyW': 12, 'KeyX': 13, 'KeyC': 14, 'KeyV': 15,
  // Rangée 2 (pads 4-7) - touches A S D F sur AZERTY
  'KeyQ': 8, 'KeyS': 9, 'KeyD': 10, 'KeyF': 11,
  // Rangée 3 (pads 8-11) - touches Q W E R sur AZERTY
  'KeyA': 4, 'KeyZ': 5, 'KeyE': 6, 'KeyR': 7,
  // Rangée du haut (pads 12-15) - chiffres
  'Digit1': 0, 'Digit2': 1, 'Digit3': 2, 'Digit4': 3
};

export class SamplerGUI {
  constructor(rootEl, engine) {
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
        <button id="resetTrims" class="btn ghost">Reset Trims</button>
        <label>Master
          <input id="master" type="range" min="0" max="1" step="0.01" value="0.9" class="range" style="width:220px" />
        </label>
        <span id="midiStatus" class="midi-status" title="Statut MIDI">MIDI: --</span>
      </div>

      <div id="progress-container" class="progress-container" style="display:none;">
        <div class="progress-label">Chargement: <span id="progress-text">0%</span></div>
        <div class="progress-bar">
          <div id="progress-fill" class="progress-fill"></div>
        </div>
      </div>

      <div class="sampler-main">
        <div id="pads-grid" class="pads-grid">
          <!-- Les pads seront générés dynamiquement -->
        </div>

        <div class="waveform-section">
          <div class="canvas-wrap">
            <canvas id="wave"></canvas>
            <canvas id="playhead" class="overlay"></canvas>
            <canvas id="trims" class="trim"></canvas>
          </div>
          
          <!-- Recording section -->
          <div class="recording-section">
            <div class="recording-controls">
              <button id="recordBtn" class="btn record-btn">Enregistrer</button>
              <span id="recordStatus" class="record-status"></span>
              <select id="targetPad" class="select target-pad">
                <option value="">Affecter au pad...</option>
              </select>
              <button id="assignRecording" class="btn ghost" disabled>Affecter</button>
            </div>
          </div>
          
          <!-- Effects Panel -->
          <div class="effects-panel">
            <h4>Effets du pad selectionne</h4>
            <div class="effects-row">
              <label class="effect-label">
                <span>Volume</span>
                <input id="fxVolume" type="range" min="0" max="2" step="0.05" value="1" class="range effect-slider" />
                <span id="fxVolumeVal" class="effect-value">100%</span>
              </label>
              <label class="effect-label">
                <span>Pan</span>
                <input id="fxPan" type="range" min="-1" max="1" step="0.05" value="0" class="range effect-slider" />
                <span id="fxPanVal" class="effect-value">C</span>
              </label>
              <label class="effect-label">
                <span>Pitch</span>
                <input id="fxPitch" type="range" min="0.5" max="2" step="0.05" value="1" class="range effect-slider" />
                <span id="fxPitchVal" class="effect-value">1.0x</span>
              </label>
              <button id="resetEffects" class="btn ghost">Reset</button>
            </div>
          </div>
        </div>
      </div>

      <details class="muted"><summary>Details</summary>
        <pre id="meta"></pre>
      </details>
    `;

    // refs
    this.presetSel = this.root.querySelector('#preset');
    this.soundSel = this.root.querySelector('#sound');
    this.bpmInp = this.root.querySelector('#bpm');
    this.modeSel = this.root.querySelector('#mode');
    this.playBtn = this.root.querySelector('#play');
    this.stopBtn = this.root.querySelector('#stop');
    this.resetTrimsBtn = this.root.querySelector('#resetTrims');
    this.masterInp = this.root.querySelector('#master');
    this.meta = this.root.querySelector('#meta');

    // progress refs
    this.progressContainer = this.root.querySelector('#progress-container');
    this.progressText = this.root.querySelector('#progress-text');
    this.progressFill = this.root.querySelector('#progress-fill');

    // pads grid ref
    this.padsGrid = this.root.querySelector('#pads-grid');

    // Recording refs
    this.recordBtn = this.root.querySelector('#recordBtn');
    this.recordStatus = this.root.querySelector('#recordStatus');
    this.targetPadSelect = this.root.querySelector('#targetPad');
    this.assignRecordingBtn = this.root.querySelector('#assignRecording');

    // Recording state
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordedBuffer = null;
    this.isRecording = false;

    // Effects refs
    this.fxVolume = this.root.querySelector('#fxVolume');
    this.fxVolumeVal = this.root.querySelector('#fxVolumeVal');
    this.fxPan = this.root.querySelector('#fxPan');
    this.fxPanVal = this.root.querySelector('#fxPanVal');
    this.fxPitch = this.root.querySelector('#fxPitch');
    this.fxPitchVal = this.root.querySelector('#fxPitchVal');
    this.resetEffectsBtn = this.root.querySelector('#resetEffects');

    // MIDI refs and state
    this.midiStatus = this.root.querySelector('#midiStatus');
    this.midiAccess = null;
    this.midiInputs = [];
    this.midiBaseNote = 36; // C1 = Note 36 → Pad 0

    const wave = this.root.querySelector('#wave');
    const o = this.root.querySelector('#playhead');
    const t = this.root.querySelector('#trims');
    this.view = new WaveformView(wave, o, t);

    // state
    this.category = null;
    this.index = 0;

    // hook playhead
    this.engine.onPlay((when, offset, dur, buffer) => {
      this.view.startPlayhead(this.engine.ctx, when, offset, dur);
    });

    // events
    this._wire();
  }

  async mount() {
    const presets = await fetchPresets();
    this.presetSel.innerHTML = presets.map(p => `<option value="${p.category}">${p.name} (${p.count})</option>`).join('');
    this.category = presets[0]?.category ?? null;
    this.presetSel.value = this.category;
    await this._loadCategory(this.category);

    // Initialize MIDI
    this._initMIDI();
  }

  _wire() {
    this.presetSel.oninput = async () => {
      this.category = this.presetSel.value;
      await this._loadCategory(this.category);
    };
    this.soundSel.oninput = () => { this.index = parseInt(this.soundSel.value, 10); this._showCurrent(); };
    this.playBtn.onclick = () => this._play();
    this.stopBtn.onclick = () => { this.engine.stopAll(); this.view.stopPlayhead(); };
    this.masterInp.oninput = () => this.engine.setMasterGain(parseFloat(this.masterInp.value));

    // Reset all trims button
    this.resetTrimsBtn.onclick = () => {
      // Clear all trim data from localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('trim:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // Clear trims in engine
      this.engine.trims.clear();

      // Reset current view to defaults
      this._showCurrent(true);
    };

    // Effects handlers
    this.fxVolume.oninput = () => {
      const val = parseFloat(this.fxVolume.value);
      this.engine.setEffect(this.index, 'volume', val);
      this.fxVolumeVal.textContent = `${Math.round(val * 100)}%`;
      this._saveEffects();
    };

    this.fxPan.oninput = () => {
      const val = parseFloat(this.fxPan.value);
      this.engine.setEffect(this.index, 'pan', val);
      this.fxPanVal.textContent = val < -0.1 ? 'L' : val > 0.1 ? 'R' : 'C';
      this._saveEffects();
    };

    this.fxPitch.oninput = () => {
      const val = parseFloat(this.fxPitch.value);
      this.engine.setEffect(this.index, 'pitch', val);
      this.fxPitchVal.textContent = `${val.toFixed(2)}x`;
      this._saveEffects();
    };

    this.resetEffectsBtn.onclick = () => {
      this.engine.setEffect(this.index, 'volume', 1.0);
      this.engine.setEffect(this.index, 'pan', 0);
      this.engine.setEffect(this.index, 'pitch', 1.0);
      this._updateEffectsUI();
      this._saveEffects();
    };

    // Recording button handler
    this.recordBtn.onclick = async () => {
      if (this.isRecording) {
        // Stop recording
        this.mediaRecorder?.stop();
        this.isRecording = false;
        this.recordBtn.textContent = 'Enregistrer';
        this.recordBtn.classList.remove('recording');
        this.recordStatus.textContent = 'Traitement...';
      } else {
        // Start recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.recordedChunks = [];

          this.mediaRecorder = new MediaRecorder(stream);

          this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              this.recordedChunks.push(e.data);
            }
          };

          this.mediaRecorder.onstop = async () => {
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());

            // Convert to AudioBuffer
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            const arrayBuffer = await blob.arrayBuffer();

            try {
              this.recordedBuffer = await this.engine.ctx.decodeAudioData(arrayBuffer);
              this.recordStatus.textContent = `✅ Enregistré (${this.recordedBuffer.duration.toFixed(1)}s)`;
              this.assignRecordingBtn.disabled = false;

              // Show waveform of recorded audio
              this.view.setBuffer(this.recordedBuffer);
              this.meta.textContent = `Enregistrement: ${this.recordedBuffer.duration.toFixed(2)}s`;
            } catch (err) {
              this.recordStatus.textContent = '❌ Erreur de décodage';
              console.error('Audio decode error:', err);
            }
          };

          this.mediaRecorder.start();
          this.isRecording = true;
          this.recordBtn.textContent = '⏹️ Stop';
          this.recordBtn.classList.add('recording');
          this.recordStatus.textContent = '🔴 Enregistrement...';
          this.assignRecordingBtn.disabled = true;

        } catch (err) {
          this.recordStatus.textContent = '❌ Micro non autorisé';
          console.error('Microphone access error:', err);
        }
      }
    };

    // Assign recording to pad
    this.assignRecordingBtn.onclick = () => {
      const padIndex = parseInt(this.targetPadSelect.value, 10);
      if (isNaN(padIndex) || !this.recordedBuffer) return;

      // Add or replace the sound at the pad index
      const recordingId = `recording-${Date.now()}`;
      const soundData = {
        id: recordingId,
        name: `Enregistrement ${new Date().toLocaleTimeString()}`,
        url: null, // Local recording, no URL
        buffer: this.recordedBuffer
      };

      // Extend the sounds array if needed
      while (this.engine.sounds.length <= padIndex) {
        this.engine.sounds.push(null);
      }
      this.engine.sounds[padIndex] = soundData;

      // Rebuild pads and update view
      this._buildPads();
      this.index = padIndex;
      this.soundSel.value = String(padIndex);
      this._showCurrent(true);

      this.recordStatus.textContent = `✅ Affecté au pad ${padIndex + 1}`;
      this.assignRecordingBtn.disabled = true;
      this.recordedBuffer = null;
    };

    window.addEventListener('resize', () => this.view.drawWave());

    // Mapping clavier → pads
    window.addEventListener('keydown', (e) => {
      // Ignorer si on tape dans un champ de saisie
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Ignorer les répétitions (touche maintenue)
      if (e.repeat) return;

      const padIndex = KEYBOARD_MAP[e.code];
      if (padIndex !== undefined && padIndex < this.engine.sounds.length) {
        e.preventDefault();
        this._onPadClick(padIndex);
      }
    });
  }

  async _loadCategory(cat) {
    this._showProgress(0, 'Démarrage...');

    await this.engine.loadPreset(cat, (progress, soundName) => {
      this._showProgress(progress, soundName);
    });

    this._hideProgress();
    this.soundSel.innerHTML = this.engine.sounds.map((s, i) => `<option value="${i}">${s.name || s.id}</option>`).join('');
    this.index = 0; this.soundSel.value = '0';
    this._buildPads();
    this._showCurrent(true);
  }

  _buildPads() {
    this.padsGrid.innerHTML = '';

    // Créer 16 pads (4x4), organisés de bas en haut, gauche à droite
    // Rangée 0 (bas) = indices 0-3, Rangée 3 (haut) = indices 12-15
    // Pour afficher du haut vers le bas dans le DOM, on inverse les rangées
    const totalPads = 16;
    const cols = 4;
    const rows = 4;

    // Labels des touches clavier pour chaque pad (AZERTY)
    const keyLabels = [
      'Z', 'X', 'C', 'V',   // Rangée 1 (pads 0-3) - AZERTY
      'A', 'S', 'D', 'F',   // Rangée 2 (pads 4-7) - AZERTY
      'Q', 'W', 'E', 'R',   // Rangée 3 (pads 8-11) - AZERTY
      '1', '2', '3', '4'    // Rangée 4 (pads 12-15)
    ];

    // Populate target pad dropdown for recording assignment
    this.targetPadSelect.innerHTML = '<option value="">Affecter au pad...</option>' +
      Array.from({ length: totalPads }, (_, i) => {
        const sound = this.engine.sounds[i];
        const label = sound ? `Pad ${i + 1} (${(sound.name || sound.id).substring(0, 15)})` : `Pad ${i + 1} (vide)`;
        return `<option value="${i}">${label}</option>`;
      }).join('');

    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const sound = this.engine.sounds[index];
        const keyLabel = keyLabels[index] || '';

        const pad = document.createElement('div');
        pad.className = 'pad';
        pad.dataset.index = index;

        if (sound) {
          pad.classList.add('active');
          // Nom court du son (sans extension)
          const shortName = (sound.name || sound.id || `Pad ${index}`)
            .replace(/\.(wav|mp3|ogg)$/i, '')
            .substring(0, 12);
          pad.innerHTML = `
            <span class="pad-key">${keyLabel}</span>
            <span class="pad-index">${index + 1}</span>
            <span class="pad-name">${shortName}</span>
          `;
          pad.onclick = () => this._onPadClick(index);
        } else {
          pad.classList.add('empty');
          pad.innerHTML = `
            <span class="pad-key">${keyLabel}</span>
            <span class="pad-index">${index + 1}</span>
          `;
        }

        this.padsGrid.appendChild(pad);
      }
    }
  }

  _onPadClick(index) {
    if (this.engine.ctx.state === 'suspended') this.engine.ctx.resume();

    // Mettre à jour l'index courant et le menu déroulant
    this.index = index;
    this.soundSel.value = String(index);

    // Effet visuel: flash sur le pad
    const pad = this.padsGrid.querySelector(`[data-index="${index}"]`);
    if (pad) {
      pad.classList.add('playing');
      setTimeout(() => pad.classList.remove('playing'), 150);
    }

    // Mettre à jour le pad sélectionné
    this.padsGrid.querySelectorAll('.pad').forEach(p => p.classList.remove('selected'));
    if (pad) pad.classList.add('selected');

    // Jouer le son
    this.engine.playSingle(this.category, index);

    // Mettre à jour la waveform
    this._showCurrent();
  }

  _showProgress(progress, soundName = '') {
    this.progressContainer.style.display = 'block';
    const percent = Math.round(progress * 100);
    this.progressText.textContent = `${percent}% - ${soundName}`;
    this.progressFill.style.width = `${percent}%`;
  }

  _hideProgress() {
    this.progressContainer.style.display = 'none';
    this.progressFill.style.width = '0%';
  }

  _showCurrent(resetDefault = false) {
    const s = this.engine.sounds[this.index]; if (!s?.buffer) return;
    this.view.setBuffer(s.buffer);

    const key = `trim:${this.category}:${s.id || s.name}`;
    if (!resetDefault) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const { startSec, endSec } = JSON.parse(raw);
          this.engine.setTrim(this.category, s, startSec, endSec);
          this.view.setTrimsPx(this.view.secToPx(startSec), this.view.secToPx(endSec));
        } catch { }
      }
    }
    // défaut 10%/90% si aucune persist
    if (!localStorage.getItem(key)) {
      const l = Math.round(this.view.canvas.width * .10);
      const r = Math.round(this.view.canvas.width * .90);
      this.view.setTrimsPx(l, r);
      this.engine.setTrim(this.category, s, this.view.pxToSec(l), this.view.pxToSec(r));
      localStorage.setItem(key, JSON.stringify(this.engine.getTrim(this.category, s)));
    }

    // persiste à chaque bougé de trims (debounce léger)
    const persist = () => {
      const { leftX, rightX } = this.view.getTrimsPx();
      this.engine.setTrim(this.category, s, this.view.pxToSec(leftX), this.view.pxToSec(rightX));
      try { localStorage.setItem(key, JSON.stringify(this.engine.getTrim(this.category, s))); } catch { }
    };
    const original = this.view.drawTrims.bind(this.view);
    this.view.drawTrims = () => { original(); clearTimeout(this._t); this._t = setTimeout(persist, 120); };

    this.meta.textContent = `Preset: ${this.category} • ${s.name || s.id} • ${s.buffer.duration.toFixed(2)}s`;

    // Load and display effects for current pad
    this._loadEffects();
    this._updateEffectsUI();
  }

  _play() {
    if (this.engine.ctx.state === 'suspended') this.engine.ctx.resume();
    this.view.stopPlayhead();

    const mode = this.modeSel.value;
    if (mode === 'single') this.engine.playSingle(this.category, this.index);
    else if (mode === 'together') this.engine.playTogether(this.category);
    else this.engine.playSequential(this.category, parseInt(this.bpmInp.value, 10) || 120);
  }

  // Effects helper methods
  _saveEffects() {
    const s = this.engine.sounds[this.index];
    if (!s) return;
    const key = `fx:${this.category}:${s.id || s.name}`;
    const fx = this.engine.getEffect(this.index);
    try { localStorage.setItem(key, JSON.stringify(fx)); } catch { }
  }

  _loadEffects() {
    const s = this.engine.sounds[this.index];
    if (!s) return;
    const key = `fx:${this.category}:${s.id || s.name}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const fx = JSON.parse(raw);
        if (fx.volume !== undefined) this.engine.setEffect(this.index, 'volume', fx.volume);
        if (fx.pan !== undefined) this.engine.setEffect(this.index, 'pan', fx.pan);
        if (fx.pitch !== undefined) this.engine.setEffect(this.index, 'pitch', fx.pitch);
      } catch { }
    }
  }

  _updateEffectsUI() {
    const fx = this.engine.getEffect(this.index);
    this.fxVolume.value = fx.volume;
    this.fxVolumeVal.textContent = `${Math.round(fx.volume * 100)}%`;
    this.fxPan.value = fx.pan;
    this.fxPanVal.textContent = fx.pan < -0.1 ? 'L' : fx.pan > 0.1 ? 'R' : 'C';
    this.fxPitch.value = fx.pitch;
    this.fxPitchVal.textContent = `${fx.pitch.toFixed(2)}x`;
  }

  // MIDI Support
  async _initMIDI() {
    if (!navigator.requestMIDIAccess) {
      this.midiStatus.textContent = 'MIDI: Non supporte';
      this.midiStatus.classList.add('midi-unsupported');
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this._updateMIDIStatus();

      // Listen for device connections/disconnections
      this.midiAccess.onstatechange = () => this._updateMIDIStatus();

    } catch (err) {
      console.warn('MIDI access denied:', err);
      this.midiStatus.textContent = 'MIDI: Refuse';
      this.midiStatus.classList.add('midi-denied');
    }
  }

  _updateMIDIStatus() {
    // Disconnect existing handlers
    this.midiInputs.forEach(input => {
      input.onmidimessage = null;
    });
    this.midiInputs = [];

    // Connect to all available MIDI inputs
    for (const input of this.midiAccess.inputs.values()) {
      if (input.state === 'connected') {
        input.onmidimessage = (e) => this._handleMIDIMessage(e);
        this.midiInputs.push(input);
      }
    }

    // Update status display
    const count = this.midiInputs.length;
    if (count > 0) {
      const name = this.midiInputs[0].name?.substring(0, 15) || 'MIDI';
      this.midiStatus.textContent = `MIDI: ${name}`;
      this.midiStatus.classList.remove('midi-disconnected', 'midi-unsupported', 'midi-denied');
      this.midiStatus.classList.add('midi-connected');
      this.midiStatus.title = `${count} périphérique(s) MIDI connecté(s)`;
    } else {
      this.midiStatus.textContent = 'MIDI: --';
      this.midiStatus.classList.remove('midi-connected');
      this.midiStatus.classList.add('midi-disconnected');
      this.midiStatus.title = 'Aucun périphérique MIDI';
    }
  }

  _handleMIDIMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status & 0xF0;

    // Note On (0x90) with velocity > 0
    if (command === 0x90 && velocity > 0) {
      const padIndex = note - this.midiBaseNote;

      // Check if within valid pad range (0-15)
      if (padIndex >= 0 && padIndex < 16 && padIndex < this.engine.sounds.length) {
        // Resume audio context if needed
        if (this.engine.ctx.state === 'suspended') {
          this.engine.ctx.resume();
        }

        // Trigger pad with velocity affecting volume (optional)
        const velocityScale = velocity / 127;
        const originalVolume = this.engine.getEffect(padIndex).volume;

        // Temporarily boost/reduce volume based on velocity
        this.engine.setEffect(padIndex, 'volume', originalVolume * velocityScale);
        this._onPadClick(padIndex);

        // Restore original volume after a short delay
        setTimeout(() => {
          this.engine.setEffect(padIndex, 'volume', originalVolume);
        }, 50);
      }
    }
  }
}
