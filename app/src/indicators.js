'use strict';
// Custom indicators written in Python or C. Runs in the main process as a child program with a timeout.
// Imported code runs with the user's own permissions, so only import files you trust.
const path = require('path'), fs = require('fs'), crypto = require('crypto'), { execFile, spawn } = require('child_process');

const TIMEOUT_MS = 20000, MAX_OUT = 32 * 1024 * 1024;
let root = '';
const dir = (...p) => path.join(root, 'indicators', ...p);
const listFile = () => dir('indicators.json');
const readList = () => { try { return JSON.parse(fs.readFileSync(listFile(), 'utf8')); } catch (e) { return []; } };
const writeList = l => { fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(listFile(), JSON.stringify(l, null, 2)); };
function init(userData) { root = userData; fs.mkdirSync(dir('build'), { recursive: true }); }

// Header comments, e.g. "# @name RSI 14", "// @pane separate", "// @outputs rsi", "// @param length 14"
function parseHeader(src, file) {
  const m = { name: path.basename(file).replace(/\.[^.]+$/, ''), pane: 'overlay', outputs: [], params: [], levels: [], styles: {}, palettes: {} };
  for (const line of src.split(/\r?\n/).slice(0, 60)) {
    const x = line.match(/^\s*(?:#|\/\/|\/\*+|\*)\s*@(\w+)\s+(.*?)\s*(?:\*\/)?\s*$/); if (!x) continue;
    const [, k, v] = x;
    if (k === 'name') m.name = v.slice(0, 60);
    else if (k === 'pane') m.pane = /sep|pane|below|osc/i.test(v) ? 'separate' : 'overlay';
    else if (k === 'outputs') m.outputs = v.split(/[\s,]+/).filter(Boolean).slice(0, 8);
    else if (k === 'param') { const [n, d] = v.split(/\s+/); if (n) m.params.push({ name: n.slice(0, 30), value: Number(d) || 0 }); }
    else if (k === 'plot') { const [n, t] = v.split(/\s+/); if (n && /^(line|hist|step|dots)$/.test(t)) m.styles[n.slice(0, 30)] = t; }   // "@plot chop hist"
    else if (k === 'palette') { const [n, ...c] = v.split(/[\s,]+/); const ok = c.filter(x => /^#[0-9a-f]{3,8}$/i.test(x)).slice(0, 32); if (n && ok.length) m.palettes[n.slice(0, 30)] = ok; }   // "@palette chop #f00 #0f0": <name>_color output picks the colour
    else if (k === 'level') v.split(/[\s,]+/).map(Number).filter(Number.isFinite).forEach(n => m.levels.push(n));
  }
  if (!m.outputs.length) m.outputs = ['value'];
  return m;
}

function importFile(file) {
  const ext = path.extname(file).toLowerCase(), lang = ext === '.py' ? 'python' : ext === '.c' ? 'c' : null;
  if (!lang) throw new Error('Choose a .py or .c file');
  const src = fs.readFileSync(file, 'utf8');
  if (src.length > 500000) throw new Error('File is too large (500 KB max)');
  if (lang === 'python' && !/def\s+compute\s*\(/.test(src)) throw new Error('Python indicators need a function: def compute(bars, params)');
  if (lang === 'c' && !/\bcompute\s*\(/.test(src)) throw new Error('C indicators need: void compute(int n, const double *open, const double *high, const double *low, const double *close, const double *volume, const double *params, double **out)');
  const id = crypto.randomBytes(6).toString('hex'), store = 'ind_' + id + ext;
  fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(dir(store), src);
  const meta = { id, lang, file: store, origin: file, enabled: true, ...parseHeader(src, file) };
  const l = readList(); l.push(meta); writeList(l); return meta;
}
function reload(id) {           // pick up edits to the original file
  const l = readList(), m = l.find(x => x.id === id); if (!m) throw new Error('Unknown indicator');
  const src = fs.readFileSync(m.origin, 'utf8'); fs.writeFileSync(dir(m.file), src);
  const params = m.params; Object.assign(m, parseHeader(src, m.origin));
  m.params = m.params.map(p => ({ ...p, value: (params.find(q => q.name === p.name) || p).value }));
  writeList(l); return m;
}
function update(id, patch) {
  const l = readList(), m = l.find(x => x.id === id); if (!m) throw new Error('Unknown indicator');
  if (typeof patch.enabled === 'boolean') m.enabled = patch.enabled;
  if (Array.isArray(patch.params)) m.params = m.params.map((p, i) => ({ ...p, value: Number.isFinite(+patch.params[i]) ? +patch.params[i] : p.value }));
  if (patch.pane === 'overlay' || patch.pane === 'separate') m.pane = patch.pane;
  writeList(l); return m;
}
function remove(id) { const l = readList(), m = l.find(x => x.id === id); if (m) { try { fs.unlinkSync(dir(m.file)); } catch (e) {} } writeList(l.filter(x => x.id !== id)); return true; }

function run(cmd, args, input, opts = {}) {
  return new Promise((resolve, reject) => {
    let out = '', err = '', done = false;
    const p = spawn(cmd, args, { cwd: opts.cwd || dir(), windowsHide: true, shell: false });
    const t = setTimeout(() => { if (!done) { done = true; p.kill(); reject(new Error('Timed out after ' + TIMEOUT_MS / 1000 + 's')); } }, opts.timeout || TIMEOUT_MS);
    p.stdout.on('data', d => { out += d; if (out.length > MAX_OUT) { p.kill(); } });
    p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on('error', e => { if (!done) { done = true; clearTimeout(t); reject(e); } });
    p.on('close', code => { if (done) return; done = true; clearTimeout(t); code === 0 ? resolve(out) : reject(new Error((err || out || 'exit code ' + code).trim().split(/\r?\n/).slice(-8).join('\n'))); });
    if (input != null) p.stdin.end(input); else p.stdin.end();
  });
}
// Try each candidate command until one starts; ENOENT means "not installed", anything else is a real error.
async function firstWorking(cands, args, input, opts) {
  let last;
  for (const c of cands) {
    const [cmd, ...pre] = c.split(/\s+(?=-)/);
    try { return { out: await run(cmd, [...pre, ...args], input, opts), cmd: c }; }
    catch (e) { last = e; if (e.code !== 'ENOENT') throw e; }
  }
  const err = new Error('not found'); err.notFound = true; err.cause = last; throw err;
}

const PY_RUNNER = `import sys, json, math, importlib.util
def clean(v):
    try:
        v = float(v)
        return v if math.isfinite(v) else None
    except Exception:
        return None
def main():
    req = json.load(sys.stdin)
    spec = importlib.util.spec_from_file_location("user_indicator", req["file"])
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    res = mod.compute(req["bars"], req["params"])
    if hasattr(res, "tolist"): res = res.tolist()
    seq = lambda x: isinstance(x, (list, tuple)) or hasattr(x, "tolist")
    names = req["outputs"]
    if isinstance(res, dict): items = list(res.items())
    elif isinstance(res, (list, tuple)) and len(res) and seq(res[0]):
        items = [(names[i] if i < len(names) else "out%d" % (i + 1), r) for i, r in enumerate(res)]
    else: items = [(names[0], res)]
    out = {}
    for k, s in items:
        if hasattr(s, "tolist"): s = s.tolist()
        out[str(k)] = [clean(v) for v in s]
    sys.stdout.write(json.dumps(out))
main()
`;
const C_HARNESS = `#include <stdio.h>
#include <stdlib.h>
#include <math.h>
void compute(int n, const double *open, const double *high, const double *low, const double *close, const double *volume, const double *params, double **out);
int main(void) {
  int n, k, np, i, j;
  if (scanf("%d %d %d", &n, &k, &np) != 3 || n < 0 || k < 1 || k > 8 || np < 0) return 2;
  double *o = calloc(n + 1, 8), *h = calloc(n + 1, 8), *l = calloc(n + 1, 8), *c = calloc(n + 1, 8), *v = calloc(n + 1, 8), *p = calloc(np + 1, 8);
  double **out = calloc(k, sizeof(double *));
  for (j = 0; j < np; j++) if (scanf("%lf", &p[j]) != 1) return 3;
  for (i = 0; i < n; i++) if (scanf("%lf %lf %lf %lf %lf", &o[i], &h[i], &l[i], &c[i], &v[i]) != 5) return 4;
  for (j = 0; j < k; j++) { out[j] = malloc(sizeof(double) * (n + 1)); for (i = 0; i < n; i++) out[j][i] = NAN; }
  compute(n, o, h, l, c, v, p, out);
  for (j = 0; j < k; j++) { for (i = 0; i < n; i++) { double x = out[j][i]; if (isfinite(x)) printf("%.10g ", x); else fputs("x ", stdout); } putchar('\\n'); }
  return 0;
}
`;
const PY_CANDS = process.platform === 'win32' ? ['py -3', 'python', 'python3'] : ['python3', 'python'];
const C_CANDS = ['gcc', 'clang', 'tcc', 'cc'];

async function compileC(m, s) {
  const src = fs.readFileSync(dir(m.file), 'utf8');
  const hash = crypto.createHash('sha256').update(src + C_HARNESS).digest('hex').slice(0, 16);
  const exe = dir('build', m.id + '_' + hash + (process.platform === 'win32' ? '.exe' : ''));
  if (fs.existsSync(exe)) return exe;
  fs.writeFileSync(dir('build', 'harness.c'), C_HARNESS);
  const cands = s.cCompiler ? [s.cCompiler] : C_CANDS;
  try { await firstWorking(cands, ['-O2', '-o', exe, dir('build', 'harness.c'), dir(m.file), ...(process.platform === 'win32' ? [] : ['-lm'])], null, { timeout: 60000 }); }
  catch (e) {
    if (e.notFound) throw new Error('No C compiler found. Install one (for example w64devkit, MSYS2 gcc or TCC) and set its path in Settings.');
    throw new Error('Compile failed:\n' + e.message);
  }
  for (const f of fs.readdirSync(dir('build'))) if (f.startsWith(m.id + '_') && dir('build', f) !== exe) { try { fs.unlinkSync(dir('build', f)); } catch (e) {} }
  return exe;
}

async function compute(id, bars, s, over) {   // over: optional {paramName: value} for this chart instance
  const m = readList().find(x => x.id === id); if (!m) throw new Error('Unknown indicator');
  if (!Array.isArray(bars) || !bars.length) throw new Error('No bars loaded');
  bars = bars.slice(-20000);
  if (over && typeof over === 'object') m.params = m.params.map(p => ({ ...p, value: Number.isFinite(+over[p.name]) ? +over[p.name] : p.value }));
  const params = m.params.map(p => +p.value || 0);
  let series = {};
  if (m.lang === 'python') {
    fs.writeFileSync(dir('runner.py'), PY_RUNNER);
    const cols = { time: [], open: [], high: [], low: [], close: [], volume: [] };
    bars.forEach(b => { for (const k in cols) cols[k].push(+b[k] || 0); });
    const req = JSON.stringify({ file: dir(m.file), bars: cols, params: Object.fromEntries(m.params.map(p => [p.name, +p.value || 0])), outputs: m.outputs });
    let r;
    try { r = await firstWorking(s.pythonPath ? [s.pythonPath] : PY_CANDS, [dir('runner.py')], req); }
    catch (e) { if (e.notFound) throw new Error('Python was not found. Install Python 3 from python.org or set its path in Settings.'); throw e; }
    series = JSON.parse(r.out);
  } else {
    const exe = await compileC(m, s);
    const lines = [bars.length + ' ' + m.outputs.length + ' ' + params.length, params.join(' ')];
    bars.forEach(b => lines.push([b.open, b.high, b.low, b.close, b.volume].map(x => +x || 0).join(' ')));
    const out = await run(exe, [], lines.join('\n') + '\n');
    out.trim().split(/\r?\n/).forEach((ln, j) => { series[m.outputs[j] || 'out' + (j + 1)] = ln.trim().split(/\s+/).map(x => x === 'x' ? null : +x); });
  }
  const res = {};
  for (const [k, v] of Object.entries(series).slice(0, 8)) {
    if (!Array.isArray(v)) continue;
    const a = v.slice(-bars.length); res[k.slice(0, 30)] = a.map((y, i) => y == null || !Number.isFinite(+y) ? null : { time: bars[i + bars.length - a.length].time, value: +y }).filter(Boolean);
  }
  if (!Object.keys(res).length) throw new Error('The indicator returned no series');
  return { id, series: res };
}

// Custom UI themes: run a .py with Python, or compile a .c (no harness) and run it; returns stdout. Same trust level as indicators.
async function runTheme(file, ext, s) {
  if (ext === '.py') { try { return (await firstWorking(s.pythonPath ? [s.pythonPath] : PY_CANDS, [file], null, { timeout: 15000 })).out; }
    catch (e) { if (e.notFound) throw new Error('Python 3 was not found. Install it from python.org or set its path in SET.'); throw e; } }
  const src = fs.readFileSync(file, 'utf8'), hash = crypto.createHash('sha256').update(src).digest('hex').slice(0, 16);
  const exe = dir('build', 'theme_' + hash + (process.platform === 'win32' ? '.exe' : ''));
  if (!fs.existsSync(exe)) { try { await firstWorking(s.cCompiler ? [s.cCompiler] : C_CANDS, ['-O1', '-o', exe, file], null, { timeout: 60000 }); }
    catch (e) { if (e.notFound) throw new Error('No C compiler found. Install one (for example w64devkit, MSYS2 gcc or TCC) and set its path in SET.'); throw new Error('Compile failed:\n' + e.message); } }
  return run(exe, [], null, { timeout: 15000 });
}
module.exports = { init, importFile, reload, update, remove, list: readList, compute, runTheme };
