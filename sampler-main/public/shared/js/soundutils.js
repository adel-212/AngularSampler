export async function loadAndDecodeSound(url, ctx){
  const r = await fetch(url);
  const a = await r.arrayBuffer();
  return await ctx.decodeAudioData(a);
}

// utilitaire lecture simple d’un segment (optionnel)
export function playSegment(ctx, buffer, startSec, endSec, destination = ctx.destination){
  const dur = Math.max(0, endSec - startSec);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(destination);
  src.start(ctx.currentTime + 0.02, startSec, dur);
  return src;
}
