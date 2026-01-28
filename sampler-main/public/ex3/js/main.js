import { loadAndDecodeSound } from '../../shared/js/soundutils.js';
import { fetchPresets, fetchPresetSounds } from '../../shared/js/api.js';

let ctx;
let presets = [];
let currentCategory = null;

let sounds = [];          
let decoded = [];         
let active = new Set();
let currentIndex = 0;

// --- UI
const $ = s => document.querySelector(s);
const presetSelect = $('#presetSelect');
const soundSelect  = $('#soundSelect');
const buttonsBox   = $('#buttonsContainer');
const bpmSel       = $('#bpm');
const modeSel      = $('#playMode');
const playBtn      = $('#playBtn');
const stopBtn      = $('#stopBtn');

// canvases
const waveCanvas   = $('#wave');
const playheadCv   = $('#playhead');
const trimsCv      = $('#trims');

const wctx = waveCanvas.getContext('2d');
const phx  = playheadCv.getContext('2d');
const tctx = trimsCv.getContext('2d');

const metaEl = $('#meta');

// --- Trim state (persisté par son)
const trimsBySound = new Map(); 
const LS_KEY = 'ex3-trims-v1';

// load/save trims
function loadTrimsLS(){
  try{
    const o = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    Object.entries(o).forEach(([url, val]) => trimsBySound.set(url, val));
  }catch{}
}
function saveTrimsLS(){
  const o = {};
  trimsBySound.forEach((v,k)=>o[k]=v);
  localStorage.setItem(LS_KEY, JSON.stringify(o));
}
window.addEventListener('beforeunload', saveTrimsLS);

// helpers trims for current sound
function getTrimsFor(url){
  let tr = trimsBySound.get(url);
  if (!tr) { tr = { l:0, r:1 }; trimsBySound.set(url,tr); }
  return tr;
}

// --- Resize canvases (pixels internes = taille CSS)
function resizeCanvases(){
  const wrap = document.querySelector('.wavewrap');
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  [waveCanvas, playheadCv, trimsCv].forEach(c => { c.width = W; c.height = H; });
  // redessiner ce qu'il faut
  drawAll();
}

window.addEventListener('load', init);
window.addEventListener('resize', resizeCanvases);

async function init(){
  loadTrimsLS();

  // contexte audio (création différée si navigateur bloque l’autoplay)
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // presets
  presets = await fetchPresets();
  presetSelect.innerHTML = '';
  for (const p of presets){
    const opt = document.createElement('option');
    opt.value = p.category;
    opt.textContent = `${p.name} (${p.count})`;
    presetSelect.appendChild(opt);
  }
  currentCategory = presets[0]?.category || '808';
  presetSelect.value = currentCategory;

  await loadCategory(currentCategory);

  // events
  presetSelect.oninput = async () => {
    currentCategory = presetSelect.value;
    await loadCategory(currentCategory);
  };
  soundSelect.oninput = () => {
    currentIndex = parseInt(soundSelect.value,10) || 0;
    drawAll(); 
  };

  playBtn.onclick = () => { if (ctx.state==='suspended') ctx.resume(); playDependingOnMode(); };
  stopBtn.onclick = stopAll;

  // trims interactions
  initTrimsInteractions();
  resizeCanvases();
}

/* ----------------- Data load ----------------- */
async function loadCategory(category){
  const preset = await fetchPresetSounds(category);
  sounds = preset.sounds || [];

  decoded = await Promise.all(sounds.map(s => loadAndDecodeSound(s.url, ctx)));

  buildSoundUI();

  currentIndex = 0;
  soundSelect.value = '0';
  drawAll();
}

function buildSoundUI(){
  // menu
  soundSelect.innerHTML = '';
  sounds.forEach((s, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = s.name || s.id;
    soundSelect.appendChild(opt);
  });

  // boutons play
  buttonsBox.innerHTML = '';
  sounds.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'btn ghost';
    b.textContent = `PLAY — ${s.name || s.id}`;
    b.onclick = () => { if (ctx.state==='suspended') ctx.resume(); playSingle(i); };
    buttonsBox.appendChild(b);
  });
}

/* ----------------- Helpers playback ----------------- */
function getCurrentSound(){
  const s = sounds[currentIndex];
  const b = decoded[currentIndex];
  return { sound: s, buffer: b };
}
function getCurrentSegmentSec(){
  const { sound, buffer } = getCurrentSound();
  if (!sound || !buffer) return { start: 0, dur: 0 };
  const { l, r } = getTrimsFor(sound.url);
  const start = clamp(l, 0, 1) * buffer.duration;
  const end   = clamp(r, 0, 1) * buffer.duration;
  const dur   = Math.max(0.001, end - start); // jamais 0 -> sinon le navigateur joue tout
  return { start, dur, total: buffer.duration };
}

/* ----------------- Play logic ----------------- */
function playDependingOnMode(){
  const m = modeSel.value;
  if (m==='single') playSingle(currentIndex);
  else if (m==='together') playTogether();
  else playSequential();
}

function playSingle(i){
  currentIndex = i;
  const { buffer } = getCurrentSound();
  if (!buffer) return;

  const { start, dur } = getCurrentSegmentSec();

  const src = ctx.createBufferSource();
  src.buffer = buffer; src.connect(ctx.destination);
  src.onended = () => { active.delete(src); stopPlayhead(); };
  src.start(ctx.currentTime + 0.01, start, dur);
  active.add(src);

  startPlayhead(start, dur); // animé de start -> start+dur
}

function playTogether(){
  stopPlayhead(); // pas d'animation dans ce mode
  const t0 = ctx.currentTime + 0.05;
  decoded.forEach((buffer, i) => {
    if (!buffer) return;
    const { l, r } = getTrimsFor(sounds[i].url);
    const start = clamp(l, 0, 1) * buffer.duration;
    const end   = clamp(r, 0, 1) * buffer.duration;
    const dur   = Math.max(0.001, end - start);

    const s = ctx.createBufferSource();
    s.buffer = buffer; s.connect(ctx.destination);
    s.onended = () => active.delete(s);
    s.start(t0, start, dur);
    active.add(s);
  });
 
  drawIdlePlayhead();
}

function playSequential(){
  stopPlayhead(); // pas d'animation multi-sons
  const bpm  = clamp(parseInt(bpmSel.value,10)||120, 40, 240);
  const beat = 60/bpm;
  let t = ctx.currentTime + 0.05;

  decoded.forEach((buffer, i) => {
    if (!buffer) return;
    const { l, r } = getTrimsFor(sounds[i].url);
    const start = clamp(l, 0, 1) * buffer.duration;
    const end   = clamp(r, 0, 1) * buffer.duration;
    const dur   = Math.max(0.001, end - start);

    const s = ctx.createBufferSource();
    s.buffer = buffer; s.connect(ctx.destination);
    s.onended = () => active.delete(s);
    s.start(t, start, dur);
    active.add(s);

    // tu peux aussi faire t += dur si tu veux enchaîner sans “beat”
    t += beat;
  });
  drawIdlePlayhead();
}

function stopAll(){
  active.forEach(s=>{try{s.stop(0);}catch{}});
  active.clear();
  stopPlayhead();
}

/* ----------------- Rendering ----------------- */
function drawAll(){
  drawWave(currentIndex);
  drawTrims();         
  drawIdlePlayhead();  
}

function drawWave(i){
  const buf = decoded[i];
  const sound = sounds[i];
  if(!buf || !sound){ wctx.clearRect(0,0,waveCanvas.width,waveCanvas.height); return; }

  // waveform
  wctx.clearRect(0,0,waveCanvas.width,waveCanvas.height);
  const peaks = computePeaks(buf, waveCanvas.width);
  const h = waveCanvas.height, mid = h/2;

  wctx.strokeStyle = '#1f2532';
  wctx.beginPath(); wctx.moveTo(0,mid); wctx.lineTo(waveCanvas.width,mid); wctx.stroke();

  wctx.fillStyle = '#60a5fa';
  for (let x=0;x<peaks.length;x++){
    const p = peaks[x];
    const y1 = mid - (p.max*(h/2-2));
    const y2 = mid - (p.min*(h/2-2));
    wctx.fillRect(x, y1, 1, Math.max(1, y2-y1));
  }

  metaEl.textContent =
    `Preset: ${currentCategory} — Sound: ${sound.name || sound.id} — durée: ${buf.duration.toFixed(2)}s`;
}

function drawTrims(){
  tctx.clearRect(0,0,trimsCv.width,trimsCv.height);
  const url = sounds[currentIndex]?.url;
  if(!url) return;
  const {l,r} = getTrimsFor(url);
  const xL = Math.round(l * trimsCv.width);
  const xR = Math.round(r * trimsCv.width);

  // zones grisés
  tctx.fillStyle = 'rgba(255,255,255,0.06)';
  tctx.fillRect(0,0,xL,trimsCv.height);
  tctx.fillRect(xR,0,trimsCv.width-xR,trimsCv.height);

  // poignées
  tctx.strokeStyle = '#93c5fd';
  tctx.lineWidth = 2;
  tctx.beginPath();
  tctx.moveTo(xL, 0); tctx.lineTo(xL, trimsCv.height);
  tctx.moveTo(xR, 0); tctx.lineTo(xR, trimsCv.height);
  tctx.stroke();
}

function drawPlayhead(x){
  phx.clearRect(0,0,playheadCv.width,playheadCv.height);
  if (x==null) return;
  phx.strokeStyle = 'rgba(147,197,253,.9)';
  phx.lineWidth = 2;
  phx.beginPath();
  phx.moveTo(x,0); phx.lineTo(x,playheadCv.height);
  phx.stroke();
}

function drawIdlePlayhead(){
  const { buffer } = getCurrentSound();
  if (!buffer) { drawPlayhead(null); return; }
  const { start, total } = getCurrentSegmentSec();
  const x = (start / total) * playheadCv.width;
  drawPlayhead(x);
}

/* ----------------- Playhead anim ----------------- */
let rafId = null;
function startPlayhead(offsetSec, durSec){
  stopPlayhead();
  const { buffer } = getCurrentSound();
  if(!buffer) return;

  const total = buffer.duration;
  const start = offsetSec || 0;           // secondes absolues dans le buffer
  const dur   = durSec   || (total - start);

  const t0 = performance.now();

  // position initiale au début du segment
  drawPlayhead((start / total) * playheadCv.width);

  const step = () => {
    const elapsed = (performance.now() - t0)/1000;
    const clamped = Math.min(elapsed, dur);
    const absolute = start + clamped;                      // position absolue dans le buffer
    const x = (absolute / total) * playheadCv.width;       // converti en pixels
    drawPlayhead(x);

    if (elapsed < dur) {
      rafId = requestAnimationFrame(step);
    } else {
      // fin pile sur la barre de fin
      drawPlayhead(((start + dur) / total) * playheadCv.width);
      rafId = null;
    }
  };
  rafId = requestAnimationFrame(step);
}
function stopPlayhead(){
  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
  drawIdlePlayhead();
}

/* ----------------- Trims interactions ----------------- */
function initTrimsInteractions(){
  let dragging = null; 
  const handleWidth = 8;

  const posToRatio = x => clamp(x / trimsCv.width, 0, 1);

  function whichHandle(x){
    const url = sounds[currentIndex]?.url; if(!url) return null;
    const {l,r} = getTrimsFor(url);
    const xL = l * trimsCv.width, xR = r * trimsCv.width;
    if (Math.abs(x-xL) <= handleWidth) return 'L';
    if (Math.abs(x-xR) <= handleWidth) return 'R';
    return null;
  }

  trimsCv.addEventListener('mousedown', (e)=>{
    const rect = trimsCv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    dragging = whichHandle(x);
    if (!dragging){
      const url = sounds[currentIndex]?.url; if(!url) return;
      const r = posToRatio(x);
      const tr = getTrimsFor(url);
      const distL = Math.abs(r - tr.l);
      const distR = Math.abs(r - tr.r);
      dragging = (distL < distR) ? 'L' : 'R';
    }
    onMove(e);
  });

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', ()=>{ dragging=null; saveTrimsLS(); });

  function onMove(e){
    if (!dragging) return;
    const rect = trimsCv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const r = posToRatio(x);
    const url = sounds[currentIndex]?.url; if(!url) return;
    const tr = getTrimsFor(url);

    if (dragging==='L'){ tr.l = Math.min(r, tr.r-0.001); }
    else { tr.r = Math.max(r, tr.l+0.001); }

    drawTrims();
    drawIdlePlayhead();
  }
}

/* ----------------- Utils ----------------- */
function computePeaks(buffer, width){
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels>1 ? buffer.getChannelData(1) : null;
  const total = buffer.length;
  const bin = Math.max(1, Math.floor(total/width));
  const out = new Array(width);
  for (let x=0;x<width;x++){
    const start = x*bin, end = Math.min(total, start+bin);
    let min= 1, max=-1;
    for (let j=start;j<end;j++){
      const m = ch1 ? 0.5*(ch0[j]+(ch1[j]||0)) : ch0[j];
      if (m<min) min=m; if (m>max) max=m;
    }
    out[x]={min,max};
  }
  return out;
}
function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
