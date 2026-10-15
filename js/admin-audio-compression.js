/* Local voice compression. lamejs 1.2.1 (LGPL-3.0), bundled in vendor/. */
let codecPromise;
function codec() {
  if (window.lamejs) return Promise.resolve(window.lamejs);
  if (!codecPromise) codecPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/js/vendor/lame-1.2.1.min.js';
    script.onload = () => window.lamejs ? resolve(window.lamejs) : reject(Error('No se pudo cargar el compresor.'));
    script.onerror = () => { codecPromise = null; script.remove(); reject(Error('No se pudo cargar el compresor. Revisa la conexión.')); };
    document.head.append(script);
  });
  return codecPromise;
}
function check(signal) { if (signal?.aborted) throw new DOMException('Subida cancelada.', 'AbortError'); }
export async function compressAudio(file, signal, progress = () => {}) {
  check(signal);
  const Context = window.AudioContext || window.webkitAudioContext;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Context || !Offline) throw Error('Este navegador no permite comprimir audio. Usa una versión actual de Chrome o Safari.');
  progress('Analizando y comprimiendo audio en tu dispositivo…');
  const context = new Context();
  let decoded;
  try { decoded = await context.decodeAudioData(await file.arrayBuffer()); }
  catch (_) { throw Error('No se pudo leer el audio. Prueba con un archivo MP3, M4A o WAV válido.'); }
  finally { await context.close(); }
  check(signal);
  if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 || decoded.duration > 300)
    throw Error('La audioguía debe durar como máximo 5 minutos para mantener un consumo bajo.');
  const rate = 24000;
  const offline = new Offline(1, Math.ceil(decoded.duration * rate), rate);
  const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
  const mono = (await offline.startRendering()).getChannelData(0);
  check(signal);
  const lame = await codec();
  const encoder = new lame.Mp3Encoder(1, rate, 64);
  const parts = [], block = 1152;
  for (let offset = 0; offset < mono.length; offset += block) {
    check(signal);
    const pcm = new Int16Array(Math.min(block, mono.length - offset));
    for (let i = 0; i < pcm.length; i++) { const sample = Math.max(-1, Math.min(1, mono[offset + i])); pcm[i] = Math.round(sample * (sample < 0 ? 32768 : 32767)); }
    const data = encoder.encodeBuffer(pcm); if (data.length) parts.push(new Uint8Array(data));
    if (offset % (block * 80) === 0) {
      progress('Comprimiendo audio… ' + Math.round(offset / mono.length * 100) + '%');
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  const tail = encoder.flush(); if (tail.length) parts.push(new Uint8Array(tail));
  check(signal);
  const compressed = new File(parts, file.name.replace(/\.[^.]+$/, '') + '.mp3', {type: 'audio/mpeg'});
  const output = /\.mp3$/i.test(file.name) && file.size < compressed.size ? file : compressed;
  if (output.size > 3 * 1024 * 1024) throw Error('El audio comprimido supera 3 MB. Acorta la narración e inténtalo de nuevo.');
  const percent = Math.max(0, Math.round((1 - output.size / file.size) * 100));
  return {file: output, summary: (output.size / 1024 / 1024).toFixed(2) + ' MB · ' + percent + '% menos que el original'};
}
