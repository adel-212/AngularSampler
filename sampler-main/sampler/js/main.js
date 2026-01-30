import { SamplerEngine } from '/sampler/js/engine/SamplerEngine.js';
import { SamplerGUI } from '/sampler/ui/SamplerGUI.js';

const ctx = new (window.AudioContext || window.webkitAudioContext)();
const engine = new SamplerEngine(ctx, { masterGain: 0.9 });

const root = document.getElementById('sampler-root');
const gui  = new SamplerGUI(root, engine);
gui.mount();
