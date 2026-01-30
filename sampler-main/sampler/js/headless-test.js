/**
 * Test Headless du SamplerEngine
 * Ce fichier teste le moteur audio SANS interface graphique
 */

import { SamplerEngine } from '/sampler/js/engine/SamplerEngine.js';

// --- Éléments DOM ---
const consoleEl = document.getElementById('console');
const runBtn = document.getElementById('runTests');
const clearBtn = document.getElementById('clearLogs');
const statusEl = document.getElementById('status');

// --- Logging ---
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function clearLogs() {
  consoleEl.innerHTML = '<div class="log-entry info">Logs effacés.</div>';
}

function setStatus(text, state) {
  statusEl.style.display = 'block';
  statusEl.textContent = text;
  statusEl.className = `status ${state}`;
}

// --- Tests ---
let ctx;
let engine;
let testResults = { passed: 0, failed: 0 };

async function test(name, fn) {
  try {
    log(`Test: ${name}...`, 'info');
    await fn();
    log(`✓ ${name} - PASSÉ`, 'success');
    testResults.passed++;
    return true;
  } catch (err) {
    log(`✗ ${name} - ÉCHOUÉ: ${err.message}`, 'error');
    testResults.failed++;
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runAllTests() {
  testResults = { passed: 0, failed: 0 };
  setStatus('Tests en cours...', 'running');
  log('═══════════════════════════════════════', 'info');
  log('Démarrage des tests headless du SamplerEngine', 'info');
  log('═══════════════════════════════════════', 'info');

  // --- Test 1: Création de l'AudioContext ---
  await test('Création AudioContext', async () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    assert(ctx instanceof AudioContext, 'AudioContext non créé');
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  });

  // --- Test 2: Création du SamplerEngine ---
  await test('Création SamplerEngine', async () => {
    engine = new SamplerEngine(ctx, { masterGain: 0.8 });
    assert(engine !== null, 'Engine non créé');
    assert(engine.ctx === ctx, 'AudioContext non assigné');
    assert(engine.master.gain.value === 0.8, 'Master gain incorrect');
  });

  // --- Test 3: Chargement d'un preset ---
  await test('Chargement preset "808"', async () => {
    let progressCalled = false;
    await engine.loadPreset('808', (progress, name) => {
      progressCalled = true;
      log(`  └─ Chargé ${Math.round(progress * 100)}%: ${name}`, 'info');
    });
    assert(engine.sounds.length > 0, 'Aucun son chargé');
    assert(progressCalled, 'Callback de progression non appelé');
    log(`  └─ ${engine.sounds.length} sons chargés`, 'success');
  });

  // --- Test 4: Vérification des buffers audio ---
  await test('Vérification des buffers audio', async () => {
    for (const sound of engine.sounds) {
      assert(sound.buffer instanceof AudioBuffer, `Buffer manquant pour ${sound.name}`);
      assert(sound.buffer.duration > 0, `Durée invalide pour ${sound.name}`);
    }
    log(`  └─ Tous les buffers sont valides`, 'success');
  });

  // --- Test 5: Configuration du Master Gain ---
  await test('Configuration Master Gain', async () => {
    engine.setMasterGain(0.5);
    assert(engine.master.gain.value === 0.5, 'Master gain non modifié');
    engine.setMasterGain(0.9);
    assert(engine.master.gain.value === 0.9, 'Master gain non restauré');
  });

  // --- Test 6: Configuration des Trims ---
  await test('Configuration Trims (start/end)', async () => {
    const sound = engine.sounds[0];
    const category = '808';

    // Set trim
    engine.setTrim(category, sound, 0.1, 0.5);
    const trim = engine.getTrim(category, sound);

    assert(trim !== null, 'Trim non trouvé');
    assert(trim.startSec === 0.1, `startSec incorrect: ${trim.startSec}`);
    assert(trim.endSec === 0.5, `endSec incorrect: ${trim.endSec}`);
  });

  // --- Test 7: Callback onPlay ---
  await test('Callback onPlay', async () => {
    let callbackFired = false;
    let callbackData = null;

    engine.onPlay((when, offset, dur, buffer) => {
      callbackFired = true;
      callbackData = { when, offset, dur, buffer };
    });

    engine.playSingle('808', 0);

    // Attendre un peu pour que le callback soit appelé
    await new Promise(r => setTimeout(r, 100));

    assert(callbackFired, 'Callback onPlay non appelé');
    assert(callbackData.buffer instanceof AudioBuffer, 'Buffer non passé au callback');
    log(`  └─ Callback reçu: offset=${callbackData.offset.toFixed(2)}s, dur=${callbackData.dur.toFixed(2)}s`, 'success');
  });

  // --- Test 8: playSingle ---
  await test('playSingle (jouer un son)', async () => {
    engine.playSingle('808', 0);
    // Vérifier qu'il y a des sources actives
    await new Promise(r => setTimeout(r, 50));
    assert(engine._active.size > 0, 'Aucune source active après playSingle');
  });

  // --- Test 9: stopAll ---
  await test('stopAll (arrêter tous les sons)', async () => {
    engine.playSingle('808', 0);
    engine.playSingle('808', 1);
    await new Promise(r => setTimeout(r, 50));

    engine.stopAll();
    assert(engine._active.size === 0, 'Sources encore actives après stopAll');
  });

  // --- Test 10: playTogether ---
  await test('playTogether (jouer tous ensemble)', async () => {
    engine.stopAll();
    engine.playTogether('808');
    await new Promise(r => setTimeout(r, 50));
    // Plusieurs sources devraient être actives
    assert(engine._active.size > 1, `Seulement ${engine._active.size} source(s) active(s)`);
    engine.stopAll();
  });

  // --- Test 11: playSequential ---
  await test('playSequential (jouer en séquence)', async () => {
    engine.stopAll();
    engine.playSequential('808', 120);
    // Les sons sont schedulés mais pas tous actifs immédiatement
    await new Promise(r => setTimeout(r, 50));
    assert(engine._active.size >= 1, 'Aucune source active dans le séquenceur');
    engine.stopAll();
  });

  // --- Résumé ---
  log('═══════════════════════════════════════', 'info');
  log(`RÉSUMÉ: ${testResults.passed} passés, ${testResults.failed} échoués`,
      testResults.failed === 0 ? 'success' : 'error');
  log('═══════════════════════════════════════', 'info');

  if (testResults.failed === 0) {
    setStatus(`✓ Tous les tests passés (${testResults.passed}/${testResults.passed})`, 'passed');
  } else {
    setStatus(`✗ ${testResults.failed} test(s) échoué(s) sur ${testResults.passed + testResults.failed}`, 'failed');
  }
}

// --- Event Listeners ---
runBtn.addEventListener('click', () => {
  clearLogs();
  runAllTests();
});

clearBtn.addEventListener('click', clearLogs);

// --- Message initial ---
log('Cliquez sur "Lancer les tests" pour démarrer', 'info');
log('Ce test vérifie SamplerEngine SANS interface graphique', 'info');
