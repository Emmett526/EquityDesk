'use strict';
// Local AI models through Ollama: install Ollama, download (pull) Gemma 4 or gpt-oss with progress, remove a model.
// Everything talks to the user's own Ollama server; nothing here sends app data anywhere.
const os = require('os'), fs = require('fs'), path = require('path');
const ai = require('./ai');

// Sizes are Ollama's download sizes (Nov 2026). Memory figures are rough guides for usable speed, not hard limits.
const CATALOG = [
  { id: 'gemma4:31b', fam: 'gemma4', name: 'Gemma 4 31B', best: true, gb: 20, mem: 24, note: 'Most capable Gemma 4 (dense, 256K context, reads images). Best with a 24 GB GPU; on CPU it needs 32 GB RAM and is slow.' },
  { id: 'gemma4:26b', fam: 'gemma4', name: 'Gemma 4 26B MoE', gb: 19, mem: 20, note: 'Close to 31B in quality but much faster (only 4B active per token).' },
  { id: 'gemma4:e4b', fam: 'gemma4', dflt: true, name: 'Gemma 4 E4B', gb: 10, mem: 12, note: 'What plain "gemma4" gives you. Runs on most PCs.' },
  { id: 'gpt-oss:120b', fam: 'gpt-oss', name: 'gpt-oss 120B', best: true, gb: 65, mem: 80, note: "OpenAI's most capable open-weight model (Apache 2.0). Needs about 80 GB of GPU or system memory." },
  { id: 'gpt-oss:20b', fam: 'gpt-oss', dflt: true, name: 'gpt-oss 20B', gb: 14, mem: 16, note: 'What plain "gpt-oss" gives you. Runs with 16 GB of memory.' }
];
const NAME_OK = /^[a-z0-9][a-z0-9._\-\/]{0,80}(:[a-z0-9._\-]{1,40})?$/i;
const pulls = new Map();   // model -> AbortController
let sendProgress = () => {};

function modelsDir() { return process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models'); }
function freeGb(dir) {
  for (let d = dir; d; d = path.dirname(d) === d ? '' : path.dirname(d)) {
    try { if (fs.existsSync(d)) { const st = fs.statfsSync(d); return Math.round(st.bavail * st.bsize / 1e9); } } catch (e) { return null; }
  }
  return null;
}
async function reach(s, start) {
  try { return await ai.ollamaTags(s); }
  catch (e) {
    if (start && ai.isLocal(s) && (await ai.startServe(s))) return ai.ollamaTags(s);
    throw e;
  }
}
async function status(s) {
  const exe = ai.ollamaExe(), out = { catalog: CATALOG, ramGb: Math.round(os.totalmem() / 1e9), freeGb: freeGb(modelsDir()), installed: exe !== 'ollama' || null, running: false, names: [], pulling: [...pulls.keys()], platform: process.platform };
  try { const t = await reach(s, false); out.running = true; out.names = t.names; out.installed = true;
    try { const r = await fetch(t.base + '/api/version', { signal: AbortSignal.timeout(3000) }); out.version = (await r.json()).version; } catch (e) {} }
  catch (e) { out.error = String(e.message || e).slice(0, 200); }
  return out;
}
// Downloads the official Windows installer from ollama.com and opens it; the user clicks through Ollama's own setup.
async function installOllama(shell) {
  if (process.platform !== 'win32') { shell.openExternal('https://ollama.com/download'); return { ok: true, msg: 'Opened ollama.com/download in your browser.' }; }
  const file = path.join(os.tmpdir(), 'OllamaSetup.exe');
  const r = await fetch('https://ollama.com/download/OllamaSetup.exe', { redirect: 'follow', signal: AbortSignal.timeout(15 * 60e3) });
  if (!r.ok || !r.body) throw new Error('Download failed: HTTP ' + r.status);
  const total = +r.headers.get('content-length') || 0, w = fs.createWriteStream(file); let done = 0, last = 0;
  for await (const chunk of r.body) { done += chunk.length; if (!w.write(chunk)) await new Promise(res => w.once('drain', res));
    if (Date.now() - last > 300) { last = Date.now(); sendProgress({ model: 'ollama', status: 'downloading Ollama', done, total, pct: total ? done / total : 0 }); } }
  await new Promise((res, rej) => w.end(err => err ? rej(err) : res()));
  const head = Buffer.alloc(2), fd = fs.openSync(file, 'r'); fs.readSync(fd, head, 0, 2, 0); fs.closeSync(fd);
  if (head.toString('ascii') !== 'MZ' || done < 5e6) throw new Error('The download does not look like the Ollama installer. Get it from ollama.com/download instead.');
  sendProgress({ model: 'ollama', status: 'starting the Ollama installer', done, total: done, pct: 1 });
  const err = await shell.openPath(file); if (err) throw new Error('Could not start the installer: ' + err);
  return { ok: true, msg: 'The Ollama installer is open. Finish it, then come back and download a model.' };
}
async function pull(s, model) {
  model = String(model || '').trim();
  if (!NAME_OK.test(model)) throw new Error('That is not an Ollama model name.');
  if (pulls.has(model)) return { ok: false, msg: model + ' is already downloading.' };
  const { base } = await reach(s, true), ctl = new AbortController(); pulls.set(model, ctl);
  const layers = new Map(); let status = 'starting', last = 0;
  const emit = force => { if (!force && Date.now() - last < 250) return; last = Date.now();
    let done = 0, total = 0; for (const l of layers.values()) { done += l.c; total += l.t; }
    sendProgress({ model, status, done, total, pct: total ? done / total : 0 }); };
  try {
    const r = await fetch(base + '/api/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: true }), signal: ctl.signal });
    if (!r.ok) throw new Error('Ollama: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    let buf = '';
    for await (const chunk of r.body) {
      buf += Buffer.from(chunk).toString('utf8'); let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
        let j; try { j = JSON.parse(line); } catch (e) { continue; }
        if (j.error) throw new Error('Ollama: ' + j.error);
        status = j.status || status;
        if (j.digest && j.total) layers.set(j.digest, { t: +j.total, c: +j.completed || 0 });
        emit(status === 'success');
      }
    }
    if (status !== 'success') throw new Error('The download stopped before it finished (' + status + '). Press Download again to resume.');
    return { ok: true, msg: model + ' is installed.' };
  } catch (e) {
    if (ctl.signal.aborted) return { ok: false, msg: 'Download paused. Press Download again to resume where it stopped.' };
    throw e;
  } finally { pulls.delete(model); sendProgress({ model, status: 'idle', done: 0, total: 0, pct: 0, end: true }); }
}
function cancel(model) { const c = pulls.get(String(model)); if (c) c.abort(); return !!c; }
async function remove(s, model) {
  model = String(model || '').trim(); if (!NAME_OK.test(model)) throw new Error('That is not an Ollama model name.');
  const { base } = await reach(s, true);
  const r = await fetch(base + '/api/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
  if (!r.ok) throw new Error('Ollama: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return { ok: true, msg: model + ' removed.' };
}
module.exports = { CATALOG, status, installOllama, pull, cancel, remove, onProgress: f => { sendProgress = f; } };
