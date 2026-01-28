import { fetchPresets, fetchPresetSounds } from '../shared/js/api.js';

const $ = (s,root=document)=>root.querySelector(s);

let ctx, master;
let rows = [];  // [{name, buffer, gain, mute, solo, vol, steps:Array(16)}]
let currentStep = -1;
let isPlaying = false;
let timer = null;

const grid   = $('#grid');
const playBt = $('#play');
const stopBt = $('#stop');
const bpmInp = $('#bpm');
const swing  = $('#swing');
const masterVol = $('#master');
const clearBt= $('#clear');
const saveBt = $('#save');
const loadBt = $('#load');
const presetSel = $('#preset');

window.addEventListener('load', init);

async function init(){
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = parseFloat(masterVol.value);
  master.connect(ctx.destination);

  const presets = await fetchPresets();
  presetSel.innerHTML = presets.map(p=>`<option value="${p.category}">${p.name} (${p.count})</option>`).join('');
  presetSel.oninput = buildFromPreset;
  await buildFromPreset();

  playBt.onclick = start;
  stopBt.onclick = stop;
  clearBt.onclick= clearAll;
  saveBt.onclick = savePattern;
  loadBt.onclick = loadPattern;
  masterVol.oninput = ()=> master.gain.value = parseFloat(masterVol.value);
}

async function buildFromPreset(){
  const cat = presetSel.value;
  const { sounds } = await fetchPresetSounds(cat);
  // charge quelques sons (max 10 pour la démo)
  const top = sounds.slice(0, 10);

  const buffers = await Promise.all(top.map(s => fetch(s.url).then(r=>r.arrayBuffer()).then(a=>ctx.decodeAudioData(a))));
  rows = top.map((s,i) => ({
    name: s.name,
    buffer: buffers[i],
    vol: 0.8,
    mute: false,
    solo: false,
    gain: (()=>{const g=ctx.createGain(); g.gain.value=0.8; g.connect(master); return g;})(),
    steps: new Array(16).fill(false)
  }));

  renderGrid();
}

function renderGrid(){
  grid.innerHTML = '';
  rows.forEach((r,ri)=>{
    const row = document.createElement('div');
    row.className='row';

    const cName = cell('name', r.name);
    const cAct  = cell('actions',
      btn('Mute', ()=>{r.mute=!r.mute;}),
      btn('Solo', ()=>{r.solo=!r.solo;})
    );
    const cVol  = cell('vol');
    const vol = document.createElement('input');
    vol.type='range'; vol.min=0; vol.max=1; vol.step=0.01; vol.value=r.vol; vol.className='range vol';
    vol.oninput = ()=>{ r.vol=parseFloat(vol.value); r.gain.gain.value=r.vol; };
    cVol.append(vol);

    row.append(cName,cAct,cVol);

    for (let s=0;s<16;s++){
      const b = document.createElement('button');
      b.className='btn-step';
      b.onclick = (e) => {
        if (e.shiftKey) { // toggle colonne entière
          rows.forEach(rr => rr.steps[s] = !rr.steps[s]);
          renderGrid(); return;
        }
        r.steps[s] = !r.steps[s];
        b.classList.toggle('on', r.steps[s]);
      };
      b.classList.toggle('on', r.steps[s]);
      row.append(b);
    }

    grid.append(row);
  });
}

function cell(cls, ...children){
  const d = document.createElement('div');
  d.className = `cell ${cls}`;
  children.forEach(c => d.append(c));
  return d;
}
function btn(label, onClick){
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

function start(){
  if (isPlaying) return;
  if (ctx.state==='suspended') ctx.resume();
  isPlaying = true;
  schedule();
}
function stop(){
  isPlaying = false;
  if (timer) { clearTimeout(timer); timer=null; }
  currentStep = -1;
  setPlayingCol(-1);
}
function clearAll(){
  rows.forEach(r => r.steps.fill(false));
  renderGrid();
}

function schedule(){
  if (!isPlaying) return;
  const bpm = Math.max(40, Math.min(240, parseInt(bpmInp.value,10)||120));
  const stepDur = 60 / bpm / 4; // 16 steps = 4 per beat

  currentStep = (currentStep+1) % 16;
  const t = ctx.currentTime + 0.02;

  const anySolo = rows.some(r => r.solo);

  rows.forEach(r => {
    if (!r.buffer) return;
    if (!r.steps[currentStep]) return;
    if (anySolo && !r.solo) return;
    if (r.mute) return;

    const s = ctx.createBufferSource();
    s.buffer = r.buffer;
    s.connect(r.gain);
    s.start(t);
  });

  setPlayingCol(currentStep);

  // swing simple sur les “&”
  const isOff = currentStep % 2 === 1;
  const swingAmt = parseFloat(swing.value) * 0.5; // max +50% sur le off-beat
  const nextDelay = isOff ? stepDur * (1 + swingAmt) : stepDur * (1 - swingAmt*0.5);

  timer = setTimeout(schedule, nextDelay*1000);
}

function setPlayingCol(step){
  // highlight visuel (outline) — on manipule la grille directement
  const rowsEls = [...grid.querySelectorAll('.row')];
  rowsEls.forEach(row => {
    const pads = [...row.querySelectorAll('.btn-step')];
    pads.forEach((p,i)=> p.classList.toggle('playing', i===step));
  });
}

function savePattern(){
  const data = rows.map(r => ({ name:r.name, vol:r.vol, mute:r.mute, solo:r.solo, steps:r.steps }));
  localStorage.setItem('ex4:pattern', JSON.stringify(data));
}
function loadPattern(){
  const raw = localStorage.getItem('ex4:pattern');
  if (!raw) return;
  try{
    const arr = JSON.parse(raw);
    arr.forEach((d,i)=>{
      if (!rows[i]) return;
      rows[i].vol=d.vol; rows[i].mute=d.mute; rows[i].solo=d.solo; rows[i].steps=d.steps||rows[i].steps;
      rows[i].gain.gain.value=rows[i].vol;
    });
    renderGrid();
  }catch{}
}
