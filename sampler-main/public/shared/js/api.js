export async function fetchPresets() {
  const r = await fetch('/api/presets');             // ← absolu
  if (!r.ok) throw new Error('GET /api/presets failed');
  return r.json();
}
export async function fetchPresetSounds(category) {
  const r = await fetch(`/api/presets/${encodeURIComponent(category)}`); // ← absolu
  if (!r.ok) throw new Error('GET /api/presets/:category failed');
  return r.json();
}
