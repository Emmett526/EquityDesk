'use strict';
// Built-in indicator library (TradingView-style). Each study returns arrays aligned with the bars; null = no value yet.
window.Studies = (() => {
  // ---- array helpers ----
  const N = v => v == null || Number.isNaN(v) ? null : v;
  const src = (b, s) => b.map(x => s === 'open' ? x.open : s === 'high' ? x.high : s === 'low' ? x.low : s === 'hl2' ? (x.high + x.low) / 2 : s === 'hlc3' ? (x.high + x.low + x.close) / 3 : s === 'ohlc4' ? (x.open + x.high + x.low + x.close) / 4 : x.close);
  function sma(a, n) { const o = []; let s = 0, c = 0, q = []; for (const v of a) { q.push(v); if (v != null) { s += v; c++; } if (q.length > n) { const r = q.shift(); if (r != null) { s -= r; c--; } } o.push(q.length === n && c === n ? s / n : null); } return o; }
  function ema(a, n, alpha) { const k = alpha || 2 / (n + 1), o = []; let e = null, seen = 0, acc = 0;
    for (const v of a) { if (v == null) { o.push(e); continue; } if (e == null) { acc += v; seen++; if (seen === n) e = acc / n; o.push(e); } else { e = v * k + e * (1 - k); o.push(e); } } return o; }
  const rma = (a, n) => ema(a, n, 1 / n);
  function wma(a, n) { const o = []; for (let i = 0; i < a.length; i++) { if (i < n - 1) { o.push(null); continue; } let s = 0, w = 0, ok = true; for (let j = 0; j < n; j++) { const v = a[i - j]; if (v == null) { ok = false; break; } s += v * (n - j); w += n - j; } o.push(ok ? s / w : null); } return o; }
  function stdev(a, n) { const m = sma(a, n); return a.map((_, i) => { if (m[i] == null) return null; let s = 0; for (let j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) ** 2; return Math.sqrt(s / n); }); }
  const win = (a, n, f) => a.map((_, i) => { if (i < n - 1) return null; const w = a.slice(i - n + 1, i + 1); return w.some(v => v == null) ? null : f(w); });
  const highest = (a, n) => win(a, n, w => Math.max(...w)), lowest = (a, n) => win(a, n, w => Math.min(...w));
  const tr = b => b.map((x, i) => i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low);
  const atr = (b, n) => rma(tr(b), n);
  const ma = (a, n, t) => t === 'EMA' ? ema(a, n) : t === 'WMA' ? wma(a, n) : t === 'RMA' ? rma(a, n) : sma(a, n);
  const sub = (a, b) => a.map((v, i) => v == null || b[i] == null ? null : v - b[i]);
  const change = (a, n = 1) => a.map((v, i) => i < n || v == null || a[i - n] == null ? null : v - a[i - n]);
  const sum = (a, n) => win(a, n, w => w.reduce((x, y) => x + y, 0));
  const rsiA = (a, n) => { const ch = change(a), g = rma(ch.map(v => v == null ? null : Math.max(v, 0)), n), l = rma(ch.map(v => v == null ? null : Math.max(-v, 0)), n); return g.map((v, i) => v == null || l[i] == null ? null : l[i] === 0 ? 100 : 100 - 100 / (1 + v / l[i])); };
  const hmaA = (s, n) => { const h = Math.max(1, Math.round(n / 2)); return wma(sub(wma(s, h).map(v => v == null ? null : 2 * v), wma(s, n)), Math.max(1, Math.round(Math.sqrt(n)))); };
  // least-squares line over the last n values, evaluated at the newest bar (like ta.linreg(src, n, 0))
  const linregA = (a, n) => win(a, n, w => { let sx = 0, sy = 0, sxy = 0, sxx = 0; w.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; }); const sl = (n * sxy - sx * sy) / ((n * sxx - sx * sx) || 1); return (sy - sl * sx) / n + sl * (n - 1); });
  // confirmed pivots: [index, value] where value is the highest (or lowest) of `left` bars before and `right` bars after
  function pivots(a, left, right, high) { const o = []; for (let i = left; i < a.length - right; i++) { const v = a[i]; if (v == null) continue; let ok = true; for (let j = i - left; j <= i + right && ok; j++) if (j !== i && a[j] != null && (high ? a[j] > v || (a[j] === v && j < i) : a[j] < v || (a[j] === v && j < i))) ok = false; if (ok) o.push([i, v]); } return o; }
  // zigzag swings: alternate highs and lows that move at least dev % and are at least depth bars apart
  function zz(b, dev, depth) { const sw = [], gap = Math.max(1, Math.round(depth / 3)); let dir = 0, hi = null, lo = null;
    b.forEach((x, i) => {
      if (dir === 0) { if (!hi || x.high >= hi[1]) hi = [i, x.high]; if (!lo || x.low <= lo[1]) lo = [i, x.low];
        if ((hi[1] / lo[1] - 1) * 100 >= dev) { if (hi[0] > lo[0]) { sw.push(lo, hi); dir = 1; } else { sw.push(hi, lo); dir = -1; } } return; }
      const k = sw.length - 1, last = sw[k];
      if (dir === 1) { if (x.high >= last[1]) sw[k] = [i, x.high]; else if ((last[1] / x.low - 1) * 100 >= dev && i - last[0] >= gap) { sw.push([i, x.low]); dir = -1; } }
      else { if (x.low <= last[1]) sw[k] = [i, x.low]; else if ((x.high / last[1] - 1) * 100 >= dev && i - last[0] >= gap) { sw.push([i, x.high]); dir = 1; } } });
    return sw; }
  // ---- calendar periods in the exchange's own time zone (set per run from the chart's symbol) ----
  let TZ = 'UTC', dayFmt = null; const dayCache = new Map();
  function setTz(z) { z = z || 'UTC'; if (z === TZ && dayFmt) return; try { dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' }); TZ = z; } catch (e) { dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }); TZ = 'UTC'; } dayCache.clear(); }
  function ymd(t) { const k = Math.floor(t / 900); let v = dayCache.get(k); if (!v) { const [y, m, d] = dayFmt.format(new Date(t * 1000)).split('-').map(Number); v = [y, m - 1, d]; if (dayCache.size > 20000) dayCache.clear(); dayCache.set(k, v); } return v; }
  function perKey(t, tf) { const [y, m, d] = ymd(t); return tf === 'D' ? y * 400 + m * 32 + d : tf === 'W' ? Math.floor((Date.UTC(y, m, d) / 864e5 + 3) / 7) : tf === 'M' ? y * 12 + m : tf === 'Q' ? y * 4 + Math.floor(m / 3) : y; }
  const stepOf = b => { if (b.length < 2) return 86400; const d = []; for (let i = Math.max(1, b.length - 50); i < b.length; i++) d.push(b[i].time - b[i - 1].time); d.sort((x, y) => x - y); return d[d.length >> 1] || 86400; };
  function groups(b, tf) { const g = []; let key = null; b.forEach((x, i) => { const k = perKey(x.time, tf); if (k !== key) { key = k; g.push({ s: i, e: i, o: x.open, h: x.high, l: x.low, c: x.close }); } else { const z = g[g.length - 1]; z.e = i; z.h = Math.max(z.h, x.high); z.l = Math.min(z.l, x.low); z.c = x.close; } }); return g; }
  // previous completed period's high / low / close / open on every bar, plus the current period's open
  function prevPer(b, tf) { const g = groups(b, tf), o = { h: [], l: [], c: [], o: [], co: [], first: g.map(x => x.s) };
    g.forEach((x, k) => { const pv = g[k - 1]; for (let i = x.s; i <= x.e; i++) { o.h.push(pv ? pv.h : null); o.l.push(pv ? pv.l : null); o.c.push(pv ? pv.c : null); o.o.push(pv ? pv.o : null); o.co.push(x.o); } }); return o; }
  // gap the step lines where a new period starts (only when a period spans more than one bar)
  function brk(o, first) { const f = new Set(first); Object.values(o).forEach(a => { if (Array.isArray(a)) for (const i of f) if (i > 0 && f.has(i) && !f.has(i + 1) && i + 1 < a.length) a[i] = null; }); return o; }
  const fmt = v => Math.abs(v) >= 1000 ? v.toFixed(1) : v.toFixed(2);
  const SRC = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'], MAT = ['SMA', 'EMA', 'WMA', 'RMA'];
  const I = (k, l, d, o) => ({ k, l, d, ...(o || {}) });

  // ---- library ----
  // pane: 'overlay' (on price) or 'new' (own pane). plots: k, name, color, type line|hist|dots|step
  const L = [
    { id: 'sma', name: 'Moving Average Simple', short: 'SMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 20), I('src', 'Source', 'close', { opts: SRC })], plots: [{ k: 'ma', c: '#ffd400' }], calc: (b, p) => ({ ma: sma(src(b, p.src), p.len) }) },
    { id: 'ema', name: 'Moving Average Exponential', short: 'EMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 21), I('src', 'Source', 'close', { opts: SRC })], plots: [{ k: 'ma', c: '#ff5fd2' }], calc: (b, p) => ({ ma: ema(src(b, p.src), p.len) }) },
    { id: 'wma', name: 'Moving Average Weighted', short: 'WMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 20), I('src', 'Source', 'close', { opts: SRC })], plots: [{ k: 'ma', c: '#00e5ff' }], calc: (b, p) => ({ ma: wma(src(b, p.src), p.len) }) },
    { id: 'hma', name: 'Hull Moving Average', short: 'HMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 9)], plots: [{ k: 'ma', c: '#a0ff5f' }],
      calc: (b, p) => { const s = src(b, 'close'), h = Math.max(1, Math.round(p.len / 2)); return { ma: wma(sub(wma(s, h).map(v => v == null ? null : 2 * v), wma(s, p.len)), Math.max(1, Math.round(Math.sqrt(p.len)))) }; } },
    { id: 'vwma', name: 'Volume Weighted Moving Average', short: 'VWMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 20)], plots: [{ k: 'ma', c: '#ff8a3d' }],
      calc: (b, p) => { const pv = sum(b.map(x => x.close * x.volume), p.len), v = sum(b.map(x => x.volume), p.len); return { ma: pv.map((x, i) => x == null || !v[i] ? null : x / v[i]) }; } },
    { id: 'marib', name: 'Moving Average Ribbon', short: 'MA Ribbon', cat: 'Moving averages', pane: 'overlay', inputs: [I('t', 'Type', 'EMA', { opts: MAT }), I('l1', 'MA 1', 20), I('l2', 'MA 2', 50), I('l3', 'MA 3', 100), I('l4', 'MA 4', 200)],
      plots: [{ k: 'a', c: '#ffd400', name: 'MA1' }, { k: 'b', c: '#ff8a3d', name: 'MA2' }, { k: 'c', c: '#ff5fd2', name: 'MA3' }, { k: 'd', c: '#4aa8ff', name: 'MA4' }],
      calc: (b, p) => { const s = src(b, 'close'); return { a: ma(s, p.l1, p.t), b: ma(s, p.l2, p.t), c: ma(s, p.l3, p.t), d: ma(s, p.l4, p.t) }; } },
    { id: 'vwap', name: 'VWAP (session)', short: 'VWAP', cat: 'Volume', pane: 'overlay', inputs: [I('src', 'Source', 'hlc3', { opts: SRC })], plots: [{ k: 'vwap', c: '#00e5ff' }],
      calc: (b, p) => { const s = src(b, p.src), o = []; let day = null, pv = 0, v = 0; b.forEach((x, i) => { const d = new Date(x.time * 1000).toISOString().slice(0, 10); if (d !== day) { day = d; pv = 0; v = 0; } pv += s[i] * x.volume; v += x.volume; o.push(v ? pv / v : null); }); return { vwap: o }; } },
    { id: 'bb', name: 'Bollinger Bands', short: 'BB', cat: 'Volatility', pane: 'overlay', inputs: [I('len', 'Length', 20), I('mult', 'StdDev', 2), I('src', 'Source', 'close', { opts: SRC })],
      plots: [{ k: 'mid', c: '#ff8a3d', name: 'Basis' }, { k: 'up', c: '#4aa8ff', name: 'Upper' }, { k: 'lo', c: '#4aa8ff', name: 'Lower' }],
      calc: (b, p) => { const s = src(b, p.src), m = sma(s, p.len), d = stdev(s, p.len); return { mid: m, up: m.map((v, i) => v == null ? null : v + p.mult * d[i]), lo: m.map((v, i) => v == null ? null : v - p.mult * d[i]) }; } },
    { id: 'kc', name: 'Keltner Channels', short: 'KC', cat: 'Volatility', pane: 'overlay', inputs: [I('len', 'Length', 20), I('mult', 'Multiplier', 2), I('alen', 'ATR length', 10)],
      plots: [{ k: 'mid', c: '#ff5fd2', name: 'Basis' }, { k: 'up', c: '#00e5ff', name: 'Upper' }, { k: 'lo', c: '#00e5ff', name: 'Lower' }],
      calc: (b, p) => { const m = ema(src(b, 'close'), p.len), a = atr(b, p.alen); return { mid: m, up: m.map((v, i) => v == null || a[i] == null ? null : v + p.mult * a[i]), lo: m.map((v, i) => v == null || a[i] == null ? null : v - p.mult * a[i]) }; } },
    { id: 'dc', name: 'Donchian Channels', short: 'DC', cat: 'Volatility', pane: 'overlay', inputs: [I('len', 'Length', 20)],
      plots: [{ k: 'up', c: '#4aa8ff', name: 'Upper' }, { k: 'mid', c: '#ff8a3d', name: 'Basis' }, { k: 'lo', c: '#4aa8ff', name: 'Lower' }],
      calc: (b, p) => { const h = highest(b.map(x => x.high), p.len), l = lowest(b.map(x => x.low), p.len); return { up: h, lo: l, mid: h.map((v, i) => v == null ? null : (v + l[i]) / 2) }; } },
    { id: 'env', name: 'Envelope', short: 'Env', cat: 'Volatility', pane: 'overlay', inputs: [I('len', 'Length', 20), I('pct', 'Percent', 10)],
      plots: [{ k: 'mid', c: '#ff8a3d', name: 'Basis' }, { k: 'up', c: '#4aa8ff', name: 'Upper' }, { k: 'lo', c: '#4aa8ff', name: 'Lower' }],
      calc: (b, p) => { const m = sma(src(b, 'close'), p.len); return { mid: m, up: m.map(v => v == null ? null : v * (1 + p.pct / 100)), lo: m.map(v => v == null ? null : v * (1 - p.pct / 100)) }; } },
    { id: 'ichi', name: 'Ichimoku Cloud', short: 'Ichimoku', cat: 'Trend', pane: 'overlay', inputs: [I('t', 'Conversion', 9), I('k', 'Base', 26), I('s', 'Span B', 52), I('d', 'Displacement', 26)],
      plots: [{ k: 'conv', c: '#4aa8ff', name: 'Conversion' }, { k: 'base', c: '#ff433d', name: 'Base' }, { k: 'lag', c: '#a0ff5f', name: 'Lagging' }, { k: 'sa', c: '#00d26a', name: 'Lead A' }, { k: 'sb', c: '#ff5f5f', name: 'Lead B' }],
      calc: (b, p) => { const H = b.map(x => x.high), Lw = b.map(x => x.low), mid = n => { const lo = lowest(Lw, n); return highest(H, n).map((v, i) => v == null ? null : (v + lo[i]) / 2); };
        const conv = mid(p.t), base = mid(p.k), a = conv.map((v, i) => v == null || base[i] == null ? null : (v + base[i]) / 2), bb = mid(p.s), n = b.length, sh = (arr, d) => arr.map((_, i) => i - d >= 0 && i - d < n ? arr[i - d] : null);
        return { conv, base, lag: b.map((_, i) => i + p.d < n ? b[i + p.d].close : null), sa: sh(a, p.d - 1), sb: sh(bb, p.d - 1) }; } },
    { id: 'psar', name: 'Parabolic SAR', short: 'SAR', cat: 'Trend', pane: 'overlay', inputs: [I('start', 'Start', 0.02), I('inc', 'Increment', 0.02), I('max', 'Max', 0.2)], plots: [{ k: 'sar', c: '#ffffff', type: 'dots' }],
      calc: (b, p) => { const o = [null]; if (b.length < 2) return { sar: b.map(() => null) }; let up = b[1].close >= b[0].close, af = p.start, ep = up ? b[0].high : b[0].low, sar = up ? b[0].low : b[0].high;
        for (let i = 1; i < b.length; i++) { sar = sar + af * (ep - sar); const x = b[i];
          if (up) { sar = Math.min(sar, b[i - 1].low, i > 1 ? b[i - 2].low : b[i - 1].low); if (x.low < sar) { up = false; sar = ep; ep = x.low; af = p.start; } else if (x.high > ep) { ep = x.high; af = Math.min(af + p.inc, p.max); } }
          else { sar = Math.max(sar, b[i - 1].high, i > 1 ? b[i - 2].high : b[i - 1].high); if (x.high > sar) { up = true; sar = ep; ep = x.high; af = p.start; } else if (x.low < ep) { ep = x.low; af = Math.min(af + p.inc, p.max); } }
          o.push(sar); } return { sar: o }; } },
    { id: 'st', name: 'Supertrend', short: 'Supertrend', cat: 'Trend', pane: 'overlay', inputs: [I('len', 'ATR length', 10), I('mult', 'Factor', 3)], plots: [{ k: 'up', c: '#00d26a', name: 'Up', type: 'step' }, { k: 'dn', c: '#ff433d', name: 'Down', type: 'step' }],
      calc: (b, p) => { const a = atr(b, p.len), U = [], D = []; let fu = null, fl = null, dir = 1;
        b.forEach((x, i) => { if (a[i] == null) { U.push(null); D.push(null); return; } const hl = (x.high + x.low) / 2, bu = hl + p.mult * a[i], bl = hl - p.mult * a[i], pc = i ? b[i - 1].close : x.close;
          fu = fu == null || bu < fu || pc > fu ? bu : fu; fl = fl == null || bl > fl || pc < fl ? bl : fl;
          if (dir === 1 && x.close < fl) dir = -1; else if (dir === -1 && x.close > fu) dir = 1;
          U.push(dir === 1 ? fl : null); D.push(dir === -1 ? fu : null); }); return { up: U, dn: D }; } },
    { id: 'pivots', name: 'Pivot Points Standard (prior bar)', short: 'Pivots', cat: 'Trend', pane: 'overlay', inputs: [], plots: [{ k: 'p', c: '#ff8a3d', name: 'P', type: 'step' }, { k: 'r1', c: '#ff433d', name: 'R1', type: 'step' }, { k: 's1', c: '#00d26a', name: 'S1', type: 'step' }, { k: 'r2', c: '#ff7b72', name: 'R2', type: 'step' }, { k: 's2', c: '#3ddc97', name: 'S2', type: 'step' }],
      calc: b => { const o = { p: [], r1: [], s1: [], r2: [], s2: [] }; b.forEach((x, i) => { if (!i) { Object.values(o).forEach(a => a.push(null)); return; } const q = b[i - 1], P = (q.high + q.low + q.close) / 3;
        o.p.push(P); o.r1.push(2 * P - q.low); o.s1.push(2 * P - q.high); o.r2.push(P + q.high - q.low); o.s2.push(P - q.high + q.low); }); return o; } },
    { id: 'linreg', name: 'Linear Regression Channel', short: 'LinReg', cat: 'Trend', pane: 'overlay', inputs: [I('len', 'Length', 50), I('dev', 'Deviation', 2)],
      plots: [{ k: 'mid', c: '#4aa8ff', name: 'Line' }, { k: 'up', c: '#ff433d', name: 'Upper' }, { k: 'lo', c: '#00d26a', name: 'Lower' }],
      calc: (b, p) => { const n = b.length, L2 = Math.min(p.len, n), o = { mid: Array(n).fill(null), up: Array(n).fill(null), lo: Array(n).fill(null) }; if (L2 < 2) return o;
        const ys = b.slice(n - L2).map(x => x.close); let sx = 0, sy = 0, sxy = 0, sxx = 0; ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
        const m = (L2 * sxy - sx * sy) / (L2 * sxx - sx * sx), c = (sy - m * sx) / L2, sd = Math.sqrt(ys.reduce((a, y, x) => a + (y - (m * x + c)) ** 2, 0) / L2);
        ys.forEach((_, x) => { const v = m * x + c; o.mid[n - L2 + x] = v; o.up[n - L2 + x] = v + p.dev * sd; o.lo[n - L2 + x] = v - p.dev * sd; }); return o; } },

    { id: 'rsi', name: 'Relative Strength Index', short: 'RSI', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 14), I('src', 'Source', 'close', { opts: SRC })], levels: [70, 50, 30], plots: [{ k: 'rsi', c: '#c586ff' }],
      calc: (b, p) => { const ch = change(src(b, p.src)), g = rma(ch.map(v => v == null ? null : Math.max(v, 0)), p.len), l = rma(ch.map(v => v == null ? null : Math.max(-v, 0)), p.len); return { rsi: g.map((v, i) => v == null || l[i] == null ? null : l[i] === 0 ? 100 : 100 - 100 / (1 + v / l[i])) }; } },
    { id: 'macd', name: 'MACD', short: 'MACD', cat: 'Momentum', pane: 'new', inputs: [I('fast', 'Fast', 12), I('slow', 'Slow', 26), I('sig', 'Signal', 9), I('src', 'Source', 'close', { opts: SRC })], levels: [0],
      plots: [{ k: 'hist', c: '#26a69a', name: 'Histogram', type: 'hist' }, { k: 'macd', c: '#4aa8ff', name: 'MACD' }, { k: 'signal', c: '#ff8a3d', name: 'Signal' }],
      calc: (b, p) => { const s = src(b, p.src), m = sub(ema(s, p.fast), ema(s, p.slow)), sg = ema(m, p.sig); return { macd: m, signal: sg, hist: sub(m, sg) }; } },
    { id: 'stoch', name: 'Stochastic', short: 'Stoch', cat: 'Momentum', pane: 'new', inputs: [I('k', '%K length', 14), I('ks', '%K smoothing', 1), I('d', '%D smoothing', 3)], levels: [80, 50, 20],
      plots: [{ k: 'k', c: '#4aa8ff', name: '%K' }, { k: 'd', c: '#ff8a3d', name: '%D' }],
      calc: (b, p) => { const h = highest(b.map(x => x.high), p.k), l = lowest(b.map(x => x.low), p.k), raw = b.map((x, i) => h[i] == null || h[i] === l[i] ? null : 100 * (x.close - l[i]) / (h[i] - l[i])), k = sma(raw, p.ks); return { k, d: sma(k, p.d) }; } },
    { id: 'stochrsi', name: 'Stochastic RSI', short: 'Stoch RSI', cat: 'Momentum', pane: 'new', inputs: [I('rsi', 'RSI length', 14), I('st', 'Stoch length', 14), I('k', 'K', 3), I('d', 'D', 3)], levels: [80, 20],
      plots: [{ k: 'k', c: '#4aa8ff', name: 'K' }, { k: 'd', c: '#ff8a3d', name: 'D' }],
      calc: (b, p) => { const r = byId.rsi.calc(b, { len: p.rsi, src: 'close' }).rsi, h = highest(r, p.st), l = lowest(r, p.st), raw = r.map((v, i) => v == null || h[i] == null || h[i] === l[i] ? null : 100 * (v - l[i]) / (h[i] - l[i])), k = sma(raw, p.k); return { k, d: sma(k, p.d) }; } },
    { id: 'cci', name: 'Commodity Channel Index', short: 'CCI', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 20)], levels: [100, 0, -100], plots: [{ k: 'cci', c: '#00e5ff' }],
      calc: (b, p) => { const s = src(b, 'hlc3'), m = sma(s, p.len); return { cci: s.map((v, i) => { if (m[i] == null) return null; let d = 0; for (let j = i - p.len + 1; j <= i; j++) d += Math.abs(s[j] - m[i]); d /= p.len; return d ? (v - m[i]) / (0.015 * d) : 0; }) }; } },
    { id: 'willr', name: 'Williams %R', short: '%R', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 14)], levels: [-20, -50, -80], plots: [{ k: 'r', c: '#c586ff' }],
      calc: (b, p) => { const h = highest(b.map(x => x.high), p.len), l = lowest(b.map(x => x.low), p.len); return { r: b.map((x, i) => h[i] == null || h[i] === l[i] ? null : -100 * (h[i] - x.close) / (h[i] - l[i])) }; } },
    { id: 'roc', name: 'Rate Of Change', short: 'ROC', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 9)], levels: [0], plots: [{ k: 'roc', c: '#4aa8ff' }],
      calc: (b, p) => ({ roc: b.map((x, i) => i < p.len ? null : 100 * (x.close / b[i - p.len].close - 1)) }) },
    { id: 'mom', name: 'Momentum', short: 'Mom', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 10)], levels: [0], plots: [{ k: 'm', c: '#4aa8ff' }], calc: (b, p) => ({ m: change(src(b, 'close'), p.len) }) },
    { id: 'ao', name: 'Awesome Oscillator', short: 'AO', cat: 'Momentum', pane: 'new', inputs: [], levels: [0], plots: [{ k: 'ao', c: '#26a69a', type: 'hist' }], calc: b => { const s = src(b, 'hl2'); return { ao: sub(sma(s, 5), sma(s, 34)) }; } },
    { id: 'uo', name: 'Ultimate Oscillator', short: 'UO', cat: 'Momentum', pane: 'new', inputs: [I('a', 'Fast', 7), I('b', 'Middle', 14), I('c', 'Slow', 28)], levels: [70, 30], plots: [{ k: 'uo', c: '#ff5fd2' }],
      calc: (b, p) => { const bp = b.map((x, i) => x.close - Math.min(x.low, i ? b[i - 1].close : x.low)), t = tr(b), av = n => { const st = sum(t, n); return sum(bp, n).map((v, i) => v == null || !st[i] ? null : v / st[i]); };
        const A = av(p.a), B = av(p.b), C = av(p.c); return { uo: C.map((v, i) => v == null ? null : 100 * (4 * A[i] + 2 * B[i] + v) / 7) }; } },
    { id: 'trix', name: 'TRIX', short: 'TRIX', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 18)], levels: [0], plots: [{ k: 't', c: '#ff8a3d' }],
      calc: (b, p) => { const e = ema(ema(ema(src(b, 'close').map(Math.log), p.len), p.len), p.len); return { t: change(e).map(v => v == null ? null : v * 10000) }; } },
    { id: 'adx', name: 'Directional Movement Index (ADX)', short: 'DMI', cat: 'Trend', pane: 'new', inputs: [I('len', 'DI length', 14), I('sm', 'ADX smoothing', 14)], levels: [25],
      plots: [{ k: 'adx', c: '#ff8a3d', name: 'ADX' }, { k: 'pdi', c: '#00d26a', name: '+DI' }, { k: 'mdi', c: '#ff433d', name: '-DI' }],
      calc: (b, p) => { const up = b.map((x, i) => i ? x.high - b[i - 1].high : null), dn = b.map((x, i) => i ? b[i - 1].low - x.low : null);
        const pdm = up.map((u, i) => u == null ? null : u > dn[i] && u > 0 ? u : 0), mdm = dn.map((d, i) => d == null ? null : d > up[i] && d > 0 ? d : 0), t = rma(tr(b), p.len);
        const pdi = rma(pdm, p.len).map((v, i) => v == null || !t[i] ? null : 100 * v / t[i]), mdi = rma(mdm, p.len).map((v, i) => v == null || !t[i] ? null : 100 * v / t[i]);
        const dx = pdi.map((v, i) => v == null || mdi[i] == null || v + mdi[i] === 0 ? null : 100 * Math.abs(v - mdi[i]) / (v + mdi[i])); return { adx: rma(dx, p.sm), pdi, mdi }; } },
    { id: 'aroon', name: 'Aroon', short: 'Aroon', cat: 'Trend', pane: 'new', inputs: [I('len', 'Length', 14)], plots: [{ k: 'up', c: '#ff8a3d', name: 'Up' }, { k: 'dn', c: '#4aa8ff', name: 'Down' }],
      calc: (b, p) => { const o = { up: [], dn: [] }; b.forEach((_, i) => { if (i < p.len) { o.up.push(null); o.dn.push(null); return; } let hi = i, lo = i; for (let j = i - p.len; j <= i; j++) { if (b[j].high >= b[hi].high) hi = j; if (b[j].low <= b[lo].low) lo = j; }
        o.up.push(100 * (p.len - (i - hi)) / p.len); o.dn.push(100 * (p.len - (i - lo)) / p.len); }); return o; } },

    { id: 'atr', name: 'Average True Range', short: 'ATR', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 14)], plots: [{ k: 'atr', c: '#ff433d' }], calc: (b, p) => ({ atr: atr(b, p.len) }) },
    { id: 'stdev', name: 'Standard Deviation', short: 'StdDev', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 20)], plots: [{ k: 's', c: '#4aa8ff' }], calc: (b, p) => ({ s: stdev(src(b, 'close'), p.len) }) },
    { id: 'hv', name: 'Historical Volatility', short: 'HV', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 20), I('ann', 'Periods per year', 252)], plots: [{ k: 'hv', c: '#ff8a3d' }],
      calc: (b, p) => ({ hv: stdev(b.map((x, i) => i ? Math.log(x.close / b[i - 1].close) : null), p.len).map(v => v == null ? null : 100 * v * Math.sqrt(p.ann)) }) },
    { id: 'bbw', name: 'Bollinger Bands Width', short: 'BBW', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 20), I('mult', 'StdDev', 2)], plots: [{ k: 'w', c: '#00e5ff' }],
      calc: (b, p) => { const s = src(b, 'close'), m = sma(s, p.len), d = stdev(s, p.len); return { w: m.map((v, i) => v == null ? null : 2 * p.mult * d[i] / v) }; } },

    { id: 'vol', name: 'Volume', short: 'Vol', cat: 'Volume', pane: 'new', inputs: [I('len', 'MA length', 20)], plots: [{ k: 'v', c: '#26a69a', name: 'Volume', type: 'hist' }, { k: 'ma', c: '#4aa8ff', name: 'MA' }],
      calc: (b, p) => ({ v: b.map(x => x.volume), ma: sma(b.map(x => x.volume), p.len), _colors: { v: b.map(x => x.close >= x.open ? '#1f6f4a' : '#7a2a28') } }) },
    { id: 'obv', name: 'On Balance Volume', short: 'OBV', cat: 'Volume', pane: 'new', inputs: [], plots: [{ k: 'obv', c: '#4aa8ff' }],
      calc: b => { let o = 0; return { obv: b.map((x, i) => (o += i ? Math.sign(x.close - b[i - 1].close) * x.volume : 0)) }; } },
    { id: 'mfi', name: 'Money Flow Index', short: 'MFI', cat: 'Volume', pane: 'new', inputs: [I('len', 'Length', 14)], levels: [80, 20], plots: [{ k: 'mfi', c: '#c586ff' }],
      calc: (b, p) => { const t = src(b, 'hlc3'), mf = t.map((v, i) => v * b[i].volume), pos = sum(mf.map((v, i) => i && t[i] > t[i - 1] ? v : 0), p.len), neg = sum(mf.map((v, i) => i && t[i] < t[i - 1] ? v : 0), p.len);
        return { mfi: pos.map((v, i) => v == null ? null : neg[i] === 0 ? 100 : 100 - 100 / (1 + v / neg[i])) }; } },
    { id: 'cmf', name: 'Chaikin Money Flow', short: 'CMF', cat: 'Volume', pane: 'new', inputs: [I('len', 'Length', 20)], levels: [0], plots: [{ k: 'cmf', c: '#00d26a' }],
      calc: (b, p) => { const mfv = b.map(x => x.high === x.low ? 0 : ((x.close - x.low) - (x.high - x.close)) / (x.high - x.low) * x.volume), a = sum(mfv, p.len), v = sum(b.map(x => x.volume), p.len); return { cmf: a.map((x, i) => x == null || !v[i] ? null : x / v[i]) }; } },
    { id: 'ad', name: 'Accumulation/Distribution', short: 'A/D', cat: 'Volume', pane: 'new', inputs: [], plots: [{ k: 'ad', c: '#ff8a3d' }],
      calc: b => { let a = 0; return { ad: b.map(x => (a += x.high === x.low ? 0 : ((x.close - x.low) - (x.high - x.close)) / (x.high - x.low) * x.volume)) }; } },
    // ---- more TradingView built-ins ----
    { id: 'dema', name: 'Double EMA', short: 'DEMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 9)], plots: [{ k: 'ma', c: '#4aa8ff' }],
      calc: (b, p) => { const e1 = ema(src(b, 'close'), p.len), e2 = ema(e1, p.len); return { ma: e1.map((v, i) => v == null || e2[i] == null ? null : 2 * v - e2[i]) }; } },
    { id: 'tema', name: 'Triple EMA', short: 'TEMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 9)], plots: [{ k: 'ma', c: '#00e5ff' }],
      calc: (b, p) => { const e1 = ema(src(b, 'close'), p.len), e2 = ema(e1, p.len), e3 = ema(e2, p.len); return { ma: e1.map((v, i) => v == null || e3[i] == null ? null : 3 * v - 3 * e2[i] + e3[i]) }; } },
    { id: 'smma', name: 'Smoothed Moving Average', short: 'SMMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 7)], plots: [{ k: 'ma', c: '#ff8a3d' }], calc: (b, p) => ({ ma: rma(src(b, 'close'), p.len) }) },
    { id: 'lsma', name: 'Least Squares Moving Average', short: 'LSMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 25)], plots: [{ k: 'ma', c: '#c586ff' }], calc: (b, p) => ({ ma: linregA(src(b, 'close'), p.len) }) },
    { id: 'alma', name: 'Arnaud Legoux Moving Average', short: 'ALMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 9), I('off', 'Offset', 0.85), I('sig', 'Sigma', 6)], plots: [{ k: 'ma', c: '#2196f3' }],
      calc: (b, p) => { const m = p.off * (p.len - 1), s = p.len / p.sig, w = []; for (let j = 0; j < p.len; j++) w.push(Math.exp(-((j - m) ** 2) / (2 * s * s))); const ws = w.reduce((x, y) => x + y, 0);
        return { ma: win(src(b, 'close'), p.len, a => a.reduce((x, v, j) => x + v * w[j], 0) / ws) }; } },
    { id: 'kama', name: 'Kaufman Adaptive Moving Average', short: 'KAMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 10), I('fast', 'Fast', 2), I('slow', 'Slow', 30)], plots: [{ k: 'ma', c: '#ffd400' }],
      calc: (b, p) => { const s = src(b, 'close'), fs = 2 / (p.fast + 1), ss = 2 / (p.slow + 1), o = []; let k = null;
        s.forEach((v, i) => { if (i < p.len) { o.push(null); if (i === p.len - 1) k = v; return; } let vol = 0; for (let j = i - p.len + 1; j <= i; j++) vol += Math.abs(s[j] - s[j - 1]); const er = vol ? Math.abs(v - s[i - p.len]) / vol : 0, sc = (er * (fs - ss) + ss) ** 2; k = k + sc * (v - k); o.push(k); }); return { ma: o }; } },
    { id: 'mcg', name: 'McGinley Dynamic', short: 'McGinley', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 14)], plots: [{ k: 'ma', c: '#26c6da' }],
      calc: (b, p) => { const s = src(b, 'close'), e = ema(s, p.len); let m = null; return { ma: s.map((v, i) => { if (m == null) { m = e[i]; return m; } m = m + (v - m) / (p.len * (v / m) ** 4); return m; }) }; } },
    { id: 'vortex', name: 'Vortex Indicator', short: 'VI', cat: 'Trend', pane: 'new', inputs: [I('len', 'Length', 14)], plots: [{ k: 'p', c: '#4aa8ff', name: 'VI+' }, { k: 'm', c: '#ff433d', name: 'VI-' }],
      calc: (b, p) => { const vp = b.map((x, i) => i ? Math.abs(x.high - b[i - 1].low) : null), vm = b.map((x, i) => i ? Math.abs(x.low - b[i - 1].high) : null), t = sum(tr(b).map((v, i) => i ? v : null), p.len), sp = sum(vp, p.len), sm = sum(vm, p.len);
        return { p: sp.map((v, i) => v == null || !t[i] ? null : v / t[i]), m: sm.map((v, i) => v == null || !t[i] ? null : v / t[i]) }; } },
    { id: 'fisher', name: 'Fisher Transform', short: 'Fisher', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 9)], levels: [1.5, 0.75, 0, -0.75, -1.5], plots: [{ k: 'f', c: '#4aa8ff', name: 'Fisher' }, { k: 't', c: '#ff8a3d', name: 'Trigger' }],
      calc: (b, p) => { const hl = src(b, 'hl2'), hh = highest(hl, p.len), ll = lowest(hl, p.len); let v = 0, f = 0; const F = hl.map((x, i) => { if (hh[i] == null) return null; v = 0.66 * ((hh[i] === ll[i] ? 0 : (x - ll[i]) / (hh[i] - ll[i])) - 0.5) + 0.67 * v; v = Math.max(-0.999, Math.min(0.999, v)); f = 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * f; return f; });
        return { f: F, t: F.map((x, i) => i ? F[i - 1] : null) }; } },
    { id: 'tsi', name: 'True Strength Index', short: 'TSI', cat: 'Momentum', pane: 'new', inputs: [I('long', 'Long', 25), I('short', 'Short', 13), I('sig', 'Signal', 13)], levels: [0], plots: [{ k: 't', c: '#4aa8ff', name: 'TSI' }, { k: 's', c: '#ff433d', name: 'Signal' }],
      calc: (b, p) => { const m = change(src(b, 'close')), n = ema(ema(m, p.long), p.short), d = ema(ema(m.map(v => v == null ? null : Math.abs(v)), p.long), p.short), t = n.map((v, i) => v == null || !d[i] ? null : 100 * v / d[i]); return { t, s: ema(t, p.sig) }; } },
    { id: 'cmo', name: 'Chande Momentum Oscillator', short: 'CMO', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 9)], levels: [50, 0, -50], plots: [{ k: 'c', c: '#4aa8ff' }],
      calc: (b, p) => { const m = change(src(b, 'close')), u = sum(m.map(v => v == null ? null : Math.max(v, 0)), p.len), d = sum(m.map(v => v == null ? null : Math.max(-v, 0)), p.len); return { c: u.map((v, i) => v == null || v + d[i] === 0 ? null : 100 * (v - d[i]) / (v + d[i])) }; } },
    { id: 'kst', name: 'Know Sure Thing', short: 'KST', cat: 'Momentum', pane: 'new', inputs: [I('sig', 'Signal', 9)], levels: [0], plots: [{ k: 'k', c: '#00d26a', name: 'KST' }, { k: 's', c: '#ff433d', name: 'Signal' }],
      calc: (b, p) => { const s = src(b, 'close'), roc = n => s.map((v, i) => i < n ? null : 100 * (v / s[i - n] - 1)), r = [[10, 10, 1], [15, 10, 2], [20, 10, 3], [30, 15, 4]].map(([n, m, w]) => sma(roc(n), m).map(v => v == null ? null : v * w));
        const k = s.map((_, i) => r.some(x => x[i] == null) ? null : r.reduce((a, x) => a + x[i], 0)); return { k, s: sma(k, p.sig) }; } },
    { id: 'coppock', name: 'Coppock Curve', short: 'Coppock', cat: 'Momentum', pane: 'new', inputs: [I('wma', 'WMA length', 10), I('l', 'Long ROC', 14), I('s', 'Short ROC', 11)], levels: [0], plots: [{ k: 'c', c: '#4aa8ff' }],
      calc: (b, p) => { const s = src(b, 'close'), roc = n => s.map((v, i) => i < n ? null : 100 * (v / s[i - n] - 1)), rl = roc(p.l), rs = roc(p.s); return { c: wma(rl.map((v, i) => v == null || rs[i] == null ? null : v + rs[i]), p.wma) }; } },
    { id: 'dpo', name: 'Detrended Price Oscillator', short: 'DPO', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 21)], levels: [0], plots: [{ k: 'd', c: '#4aa8ff' }],
      calc: (b, p) => { const s = src(b, 'close'), m = sma(s, p.len), k = Math.floor(p.len / 2) + 1; return { d: s.map((v, i) => i < k || m[i] == null ? null : s[i - k] - m[i]) }; } },
    { id: 'bop', name: 'Balance of Power', short: 'BOP', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Smoothing', 14)], levels: [0], plots: [{ k: 'b', c: '#ff5fd2' }], calc: (b, p) => ({ b: sma(b.map(x => x.high === x.low ? 0 : (x.close - x.open) / (x.high - x.low)), p.len) }) },
    { id: 'bbp', name: 'Bull Bear Power', short: 'BBP', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 13)], levels: [0], plots: [{ k: 'p', c: '#26a69a', type: 'hist' }],
      calc: (b, p) => { const e = ema(src(b, 'close'), p.len); return { p: b.map((x, i) => e[i] == null ? null : x.high - e[i] + x.low - e[i]) }; } },
    { id: 'crsi', name: 'Connors RSI', short: 'CRSI', cat: 'Momentum', pane: 'new', inputs: [I('rsi', 'RSI length', 3), I('streak', 'Streak length', 2), I('rank', 'Rank length', 100)], levels: [90, 50, 10], plots: [{ k: 'c', c: '#c586ff' }],
      calc: (b, p) => { const s = src(b, 'close'); let st = 0; const streak = s.map((v, i) => { if (!i) return 0; st = v > s[i - 1] ? (st > 0 ? st + 1 : 1) : v < s[i - 1] ? (st < 0 ? st - 1 : -1) : 0; return st; });
        const r1 = rsiA(s, p.rsi), r2 = rsiA(streak, p.streak), roc = s.map((v, i) => i ? v / s[i - 1] - 1 : null);
        const pr = roc.map((v, i) => { if (i < p.rank || v == null) return null; let c = 0; for (let j = i - p.rank; j < i; j++) if (roc[j] != null && roc[j] < v) c++; return 100 * c / p.rank; });
        return { c: s.map((_, i) => r1[i] == null || r2[i] == null || pr[i] == null ? null : (r1[i] + r2[i] + pr[i]) / 3) }; } },
    { id: 'chop', name: 'Choppiness Index', short: 'CHOP', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 14)], levels: [61.8, 38.2], plots: [{ k: 'c', c: '#4aa8ff' }],
      calc: (b, p) => { const t = sum(tr(b), p.len), hh = highest(b.map(x => x.high), p.len), ll = lowest(b.map(x => x.low), p.len); return { c: t.map((v, i) => v == null || hh[i] === ll[i] ? null : 100 * Math.log10(v / (hh[i] - ll[i])) / Math.log10(p.len)) }; } },
    { id: 'chopzone', name: 'Chop Zone', short: 'Chop Zone', cat: 'Trend', pane: 'new', inputs: [I('len', 'EMA length', 34), I('per', 'Periods', 30)], plots: [{ k: 'z', c: '#FDD835', type: 'hist' }],
      calc: (b, p) => { const s = src(b, 'close'), av = src(b, 'hlc3'), e = ema(s, p.len), hh = highest(b.map(x => x.high), p.per), ll = lowest(b.map(x => x.low), p.per), col = [];
        const z = s.map((_, i) => { if (!i || e[i] == null || e[i - 1] == null || hh[i] == null || hh[i] === ll[i]) { col.push(null); return null; } const y = (e[i - 1] - e[i]) / av[i] * (25 / (hh[i] - ll[i]) * ll[i]), a0 = Math.round(180 * Math.acos(1 / Math.sqrt(1 + y * y)) / Math.PI), a = y > 0 ? -a0 : a0;
          col.push(a >= 5 ? '#26C6DA' : a >= 3.57 ? '#43A047' : a >= 2.14 ? '#A5D6A7' : a > 0.71 ? '#009688' : a <= -5 ? '#D50000' : a <= -3.57 ? '#E91E63' : a <= -2.14 ? '#FF6D00' : a <= -0.71 ? '#FFB74D' : '#FDD835'); return 1; });
        return { z, _colors: { z: col } }; } },
    { id: 'ulcer', name: 'Ulcer Index', short: 'Ulcer', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 14)], plots: [{ k: 'u', c: '#ff433d' }],
      calc: (b, p) => { const s = src(b, 'close'), hh = highest(s, p.len), dd = s.map((v, i) => hh[i] == null ? null : (100 * (v - hh[i]) / hh[i]) ** 2); return { u: sma(dd, p.len).map(v => v == null ? null : Math.sqrt(Math.max(0, v))) }; } },
    { id: 'mass', name: 'Mass Index', short: 'Mass', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 10)], levels: [27, 26.5], plots: [{ k: 'm', c: '#4aa8ff' }],
      calc: (b, p) => { const r = b.map(x => x.high - x.low), e1 = ema(r, 9), e2 = ema(e1, 9); return { m: sum(e1.map((v, i) => v == null || !e2[i] ? null : v / e2[i]), p.len) }; } },
    { id: 'efi', name: "Elder's Force Index", short: 'EFI', cat: 'Volume', pane: 'new', inputs: [I('len', 'Length', 13)], levels: [0], plots: [{ k: 'f', c: '#ff433d' }], calc: (b, p) => ({ f: ema(b.map((x, i) => i ? (x.close - b[i - 1].close) * x.volume : null), p.len) }) },
    { id: 'eom', name: 'Ease of Movement', short: 'EOM', cat: 'Volume', pane: 'new', inputs: [I('len', 'Length', 14), I('div', 'Divisor', 10000)], levels: [0], plots: [{ k: 'e', c: '#00d26a' }],
      calc: (b, p) => ({ e: sma(b.map((x, i) => !i || !x.volume ? null : p.div * ((x.high + x.low) / 2 - (b[i - 1].high + b[i - 1].low) / 2) * (x.high - x.low) / x.volume), p.len) }) },
    { id: 'pvt', name: 'Price Volume Trend', short: 'PVT', cat: 'Volume', pane: 'new', inputs: [], plots: [{ k: 'p', c: '#4aa8ff' }], calc: b => { let a = 0; return { p: b.map((x, i) => (a += i ? (x.close / b[i - 1].close - 1) * x.volume : 0)) }; } },
    { id: 'chosc', name: 'Chaikin Oscillator', short: 'ChOsc', cat: 'Volume', pane: 'new', inputs: [I('fast', 'Fast', 3), I('slow', 'Slow', 10)], levels: [0], plots: [{ k: 'c', c: '#ff5fd2' }],
      calc: (b, p) => { let a = 0; const ad = b.map(x => (a += x.high === x.low ? 0 : ((x.close - x.low) - (x.high - x.close)) / (x.high - x.low) * x.volume)); return { c: sub(ema(ad, p.fast), ema(ad, p.slow)) }; } },
    { id: 'klinger', name: 'Klinger Oscillator', short: 'KVO', cat: 'Volume', pane: 'new', inputs: [I('fast', 'Fast', 34), I('slow', 'Slow', 55), I('sig', 'Signal', 13)], levels: [0], plots: [{ k: 'k', c: '#4aa8ff', name: 'KO' }, { k: 's', c: '#00d26a', name: 'Signal' }],
      calc: (b, p) => { const hlc = src(b, 'hlc3'), sv = b.map((x, i) => i ? (hlc[i] >= hlc[i - 1] ? x.volume : -x.volume) : 0), k = sub(ema(sv, p.fast), ema(sv, p.slow)); return { k, s: ema(k, p.sig) }; } },
    { id: 'ppo', name: 'Percentage Price Oscillator', short: 'PPO', cat: 'Momentum', pane: 'new', inputs: [I('fast', 'Fast', 12), I('slow', 'Slow', 26), I('sig', 'Signal', 9)], levels: [0],
      plots: [{ k: 'h', c: '#26a69a', name: 'Histogram', type: 'hist' }, { k: 'p', c: '#4aa8ff', name: 'PPO' }, { k: 's', c: '#ff8a3d', name: 'Signal' }],
      calc: (b, p) => { const s = src(b, 'close'), f = ema(s, p.fast), l = ema(s, p.slow), o = f.map((v, i) => v == null || !l[i] ? null : 100 * (v - l[i]) / l[i]), sg = ema(o, p.sig); return { h: sub(o, sg), p: o, s: sg }; } },
    { id: 'smi', name: 'Stochastic Momentum Index', short: 'SMI', cat: 'Momentum', pane: 'new', inputs: [I('k', '%K length', 10), I('d', '%D length', 3), I('e', 'EMA length', 3)], levels: [40, 0, -40], plots: [{ k: 's', c: '#4aa8ff', name: 'SMI' }, { k: 'e', c: '#ff8a3d', name: 'Signal' }],
      calc: (b, p) => { const hh = highest(b.map(x => x.high), p.k), ll = lowest(b.map(x => x.low), p.k), rel = b.map((x, i) => hh[i] == null ? null : x.close - (hh[i] + ll[i]) / 2), rng = hh.map((v, i) => v == null ? null : v - ll[i]);
        const n = ema(ema(rel, p.d), p.d), d = ema(ema(rng, p.d), p.d), s = n.map((v, i) => v == null || !d[i] ? null : 200 * v / d[i]); return { s, e: ema(s, p.e) }; } },
    { id: 'rvol', name: 'Relative Volume', short: 'RVOL', cat: 'Volume', pane: 'new', inputs: [I('len', 'Length', 20)], levels: [1], plots: [{ k: 'r', c: '#ff9e1b', type: 'hist' }],
      calc: (b, p) => { const v = b.map(x => x.volume), m = sma(v, p.len); return { r: v.map((x, i) => !m[i] ? null : x / m[i]), _colors: { r: v.map((x, i) => m[i] && x / m[i] >= 2 ? '#ff9e1b' : '#5a4a2a') } }; } },
    { id: 'vwapb', name: 'VWAP with bands', short: 'VWAP±σ', cat: 'Volume', pane: 'overlay', inputs: [I('m1', 'Band 1', 1), I('m2', 'Band 2', 2)],
      plots: [{ k: 'v', c: '#00e5ff', name: 'VWAP' }, { k: 'u1', c: '#26a69a', name: '+1' }, { k: 'l1', c: '#26a69a', name: '-1' }, { k: 'u2', c: '#ff8a3d', name: '+2' }, { k: 'l2', c: '#ff8a3d', name: '-2' }],
      calc: (b, p) => { let pv = 0, vv = 0, pv2 = 0, day = null; const o = { v: [], u1: [], l1: [], u2: [], l2: [] };
        b.forEach(x => { const d = Math.floor(x.time / 86400), tp = (x.high + x.low + x.close) / 3, w = x.volume || 1; if (d !== day && b.length > 1 && b[1].time - b[0].time < 86400) { pv = vv = pv2 = 0; day = d; } pv += tp * w; vv += w; pv2 += tp * tp * w;
          const v = pv / vv, sd = Math.sqrt(Math.max(0, pv2 / vv - v * v)); o.v.push(v); o.u1.push(v + p.m1 * sd); o.l1.push(v - p.m1 * sd); o.u2.push(v + p.m2 * sd); o.l2.push(v - p.m2 * sd); }); return o; } },

    // ---- support and resistance ----
    { id: 'sr', name: 'Support and Resistance (pivot levels)', short: 'S/R', cat: 'Support & resistance', pane: 'overlay', inputs: [I('left', 'Pivot left bars', 10), I('right', 'Pivot right bars', 10), I('max', 'Max levels', 8), I('merge', 'Merge within %', 0.6), I('touch', 'Min touches', 1)],
      plots: [], calc: (b, p) => {
        const piv = [...pivots(b.map(x => x.high), p.left, p.right, true), ...pivots(b.map(x => x.low), p.left, p.right, false)].map(([i, v]) => ({ i, v })), lv = [];
        piv.sort((a, c) => a.v - c.v).forEach(q => { const z = lv.find(l => Math.abs(q.v / l.v - 1) * 100 <= p.merge); if (z) { z.v = (z.v * z.n + q.v) / (z.n + 1); z.n++; z.last = Math.max(z.last, q.i); } else lv.push({ v: q.v, n: 1, last: q.i }); });
        const last = b[b.length - 1].close; const keep = lv.filter(l => l.n >= p.touch).sort((a, c) => Math.abs(a.v - last) - Math.abs(c.v - last)).slice(0, p.max);
        return { _lines: keep.map(l => ({ p: l.v, c: l.v >= last ? '#ff433d' : '#00d26a', w: Math.min(4, l.n), t: (l.v >= last ? 'R ' : 'S ') + l.n + 'x' })) }; } },
    { id: 'srbreaks', name: 'Support and Resistance Levels with Breaks', short: 'S/R Breaks', cat: 'Support & resistance', pane: 'overlay', inputs: [I('left', 'Left bars', 15), I('right', 'Right bars', 15), I('vol', 'Volume threshold %', 20)],
      plots: [{ k: 'r', c: '#ff433d', name: 'Resistance', type: 'step' }, { k: 's', c: '#00d26a', name: 'Support', type: 'step' }],
      calc: (b, p) => { const n = b.length, r = Array(n).fill(null), s = Array(n).fill(null), ph = new Map(pivots(b.map(x => x.high), p.left, p.right, true)), pl = new Map(pivots(b.map(x => x.low), p.left, p.right, false));
        const v = b.map(x => x.volume), osc = sub(ema(v, 5), ema(v, 10)).map((x, i) => { const l = ema(v, 10)[i]; return x == null || !l ? null : 100 * x / l; }), mk = []; let R = null, S = null;
        for (let i = 0; i < n; i++) { const j = i - p.right; if (ph.has(j)) R = ph.get(j); if (pl.has(j)) S = pl.get(j); r[i] = R; s[i] = S;
          if (i && R != null && b[i].close > R && b[i - 1].close <= R && (osc[i] || 0) > p.vol) mk.push({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a', text: 'B' });
          if (i && S != null && b[i].close < S && b[i - 1].close >= S && (osc[i] || 0) > p.vol) mk.push({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d', text: 'B' }); }
        return { r, s, _markers: mk }; } },
    { id: 'pivotshl', name: 'Pivot Points High Low', short: 'Pivots HL', cat: 'Support & resistance', pane: 'overlay', inputs: [I('left', 'Left bars', 10), I('right', 'Right bars', 10)], plots: [],
      calc: (b, p) => ({ _markers: [...pivots(b.map(x => x.high), p.left, p.right, true).map(([i, v]) => ({ i, pos: 'above', shape: 'square', c: '#ff433d', text: fmt(v), size: 0 })),
        ...pivots(b.map(x => x.low), p.left, p.right, false).map(([i, v]) => ({ i, pos: 'below', shape: 'square', c: '#00d26a', text: fmt(v), size: 0 }))] }) },
    { id: 'fractals', name: 'Williams Fractals', short: 'Fractals', cat: 'Support & resistance', pane: 'overlay', inputs: [I('n', 'Periods', 2)], plots: [],
      calc: (b, p) => ({ _markers: [...pivots(b.map(x => x.high), p.n, p.n, true).map(([i]) => ({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d' })), ...pivots(b.map(x => x.low), p.n, p.n, false).map(([i]) => ({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a' }))] }) },
    { id: 'zigzag', name: 'ZigZag', short: 'ZigZag', cat: 'Support & resistance', pane: 'overlay', inputs: [I('dev', 'Deviation %', 5), I('depth', 'Depth', 10)], plots: [{ k: 'z', c: '#2196f3' }],
      calc: (b, p) => { const sw = zz(b, p.dev, p.depth), z = Array(b.length).fill(null); for (let k = 1; k < sw.length; k++) { const [i0, v0] = sw[k - 1], [i1, v1] = sw[k]; for (let i = i0; i <= i1; i++) z[i] = v0 + (v1 - v0) * (i - i0) / ((i1 - i0) || 1); }
        return { z, _markers: sw.slice(1).map(([i, v], k) => ({ i, pos: v >= (sw[k] || [0, 0])[1] ? 'above' : 'below', shape: 'circle', c: '#2196f3', text: fmt(v), size: 0 })) }; } },
    { id: 'autofib', name: 'Auto Fib Retracement', short: 'Auto Fib', cat: 'Support & resistance', pane: 'overlay', inputs: [I('dev', 'Deviation %', 5), I('depth', 'Depth', 10)], plots: [],
      calc: (b, p) => { const sw = zz(b, p.dev, p.depth); if (sw.length < 2) return {}; const [, a] = sw[sw.length - 2], [, c] = sw[sw.length - 1], C = ['#808080', '#ff433d', '#ff9e1b', '#4caf50', '#00e5ff', '#4aa8ff', '#808080', '#c586ff', '#ff5fd2'];
        return { _lines: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618].map((lv, k) => ({ p: c + (a - c) * lv, c: C[k], w: 1, t: lv + ' (' + fmt(c + (a - c) * lv) + ')' })) }; } },
    { id: 'fvg', name: 'Fair Value Gaps', short: 'FVG', cat: 'Support & resistance', pane: 'overlay', inputs: [I('max', 'Max unfilled gaps', 5), I('min', 'Min gap %', 0.1)], plots: [],
      calc: (b, p) => { const g = []; for (let i = 2; i < b.length; i++) { if (b[i].low > b[i - 2].high && (b[i].low / b[i - 2].high - 1) * 100 >= p.min) g.push({ up: true, top: b[i].low, bot: b[i - 2].high, i }); if (b[i].high < b[i - 2].low && (b[i - 2].low / b[i].high - 1) * 100 >= p.min) g.push({ up: false, top: b[i - 2].low, bot: b[i].high, i }); }
        const open = g.filter(x => !b.slice(x.i + 1).some(q => x.up ? q.low <= x.bot : q.high >= x.top)).slice(-p.max);
        return { _lines: open.flatMap(x => [{ p: x.top, c: x.up ? '#00d26a' : '#ff433d', w: 1, s: 1, t: (x.up ? 'Bull' : 'Bear') + ' FVG' }, { p: x.bot, c: x.up ? '#00d26a' : '#ff433d', w: 1, s: 1, t: '' }]), _markers: open.map(x => ({ i: x.i - 1, pos: x.up ? 'below' : 'above', shape: 'square', c: x.up ? '#00d26a' : '#ff433d', size: 0 })) }; } },
    { id: 'ms', name: 'Market Structure (BOS / CHoCH)', short: 'Structure', cat: 'Support & resistance', pane: 'overlay', inputs: [I('len', 'Swing length', 5)], plots: [{ k: 'h', c: '#ff433d', name: 'Swing high', type: 'step' }, { k: 'l', c: '#00d26a', name: 'Swing low', type: 'step' }],
      calc: (b, p) => { const n = b.length, ph = new Map(pivots(b.map(x => x.high), p.len, p.len, true)), pl = new Map(pivots(b.map(x => x.low), p.len, p.len, false)), h = Array(n).fill(null), l = Array(n).fill(null), mk = []; let H = null, L = null, trend = 0, hu = false, lu = false;
        for (let i = 0; i < n; i++) { const j = i - p.len; if (ph.has(j)) { H = ph.get(j); hu = false; } if (pl.has(j)) { L = pl.get(j); lu = false; } h[i] = H; l[i] = L;
          if (H != null && !hu && b[i].close > H) { mk.push({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a', text: trend < 0 ? 'CHoCH' : 'BOS' }); trend = 1; hu = true; }
          if (L != null && !lu && b[i].close < L) { mk.push({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d', text: trend > 0 ? 'CHoCH' : 'BOS' }); trend = -1; lu = true; } }
        return { h, l, _markers: mk }; } },

    // ---- popular community scripts (own implementations of the published ideas) ----
    { id: 'sqz', name: 'Squeeze Momentum', short: 'SQZMOM', cat: 'Community', pane: 'new', inputs: [I('bb', 'BB length', 20), I('bbm', 'BB mult', 2), I('kc', 'KC length', 20), I('kcm', 'KC mult', 1.5)],
      plots: [{ k: 'v', c: '#00e676', name: 'Momentum', type: 'hist' }, { k: 'q', c: '#888888', name: 'Squeeze', type: 'dots' }],
      calc: (b, p) => { const s = src(b, 'close'), bm = sma(s, p.bb), sd = stdev(s, p.bb), km = sma(s, p.kc), rg = sma(tr(b), p.kc), hh = highest(b.map(x => x.high), p.kc), ll = lowest(b.map(x => x.low), p.kc);
        const d = s.map((v, i) => hh[i] == null || km[i] == null ? null : v - ((hh[i] + ll[i]) / 2 + km[i]) / 2), v = linregA(d, p.kc), vc = [], qc = [];
        v.forEach((x, i) => { const pv = i ? v[i - 1] : null; vc.push(x == null ? null : x >= 0 ? (pv != null && x > pv ? '#00e676' : '#1b5e20') : (pv != null && x < pv ? '#ff1744' : '#880e4f'));
          const on = bm[i] != null && rg[i] != null && bm[i] - p.bbm * sd[i] > km[i] - p.kcm * rg[i] && bm[i] + p.bbm * sd[i] < km[i] + p.kcm * rg[i]; qc.push(on ? '#ff433d' : '#00d26a'); });
        return { v, q: v.map(x => x == null ? null : 0), _colors: { v: vc, q: qc } }; } },
    { id: 'wt', name: 'WaveTrend Oscillator', short: 'WaveTrend', cat: 'Community', pane: 'new', inputs: [I('n1', 'Channel length', 10), I('n2', 'Average length', 21)], levels: [60, 53, 0, -53, -60],
      plots: [{ k: 'd', c: '#4aa8ff', name: 'Diff', type: 'hist' }, { k: 'a', c: '#00d26a', name: 'WT1' }, { k: 'b', c: '#ff433d', name: 'WT2' }],
      calc: (b, p) => { const ap = src(b, 'hlc3'), esa = ema(ap, p.n1), d = ema(ap.map((v, i) => esa[i] == null ? null : Math.abs(v - esa[i])), p.n1), ci = ap.map((v, i) => esa[i] == null || !d[i] ? null : (v - esa[i]) / (0.015 * d[i])), a = ema(ci, p.n2), w2 = sma(a, 4);
        const mk = []; a.forEach((v, i) => { if (!i || v == null || w2[i] == null || a[i - 1] == null || w2[i - 1] == null) return; if (a[i - 1] < w2[i - 1] && v >= w2[i] && v < -53) mk.push({ i, pos: 'below', shape: 'circle', c: '#00d26a' }); if (a[i - 1] > w2[i - 1] && v <= w2[i] && v > 53) mk.push({ i, pos: 'above', shape: 'circle', c: '#ff433d' }); });
        return { d: sub(a, w2), a, b: w2, _markers: mk }; } },
    { id: 'utbot', name: 'UT Bot (ATR trailing signals)', short: 'UT Bot', cat: 'Community', pane: 'overlay', inputs: [I('key', 'Key value', 1), I('atr', 'ATR period', 10)], plots: [{ k: 't', c: '#ff9e1b', name: 'Trailing stop', type: 'step' }],
      calc: (b, p) => { const s = src(b, 'close'), a = atr(b, p.atr), t = [], mk = [], col = []; let st = null;
        s.forEach((x, i) => { if (a[i] == null) { t.push(null); col.push(null); return; } const nl = p.key * a[i], px = i ? s[i - 1] : x, prev = st == null ? x : st;
          st = x > prev && px > prev ? Math.max(prev, x - nl) : x < prev && px < prev ? Math.min(prev, x + nl) : x > prev ? x - nl : x + nl;
          if (i && t[i - 1] != null) { if (px <= t[i - 1] && x > st) mk.push({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a', text: 'Buy' }); if (px >= t[i - 1] && x < st) mk.push({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d', text: 'Sell' }); }
          t.push(st); col.push(x > st ? '#00d26a' : '#ff433d'); });
        return { t, _colors: { t: col }, _markers: mk }; } },
    { id: 'nwe', name: 'Nadaraya-Watson Envelope', short: 'NW Env', cat: 'Community', pane: 'overlay', inputs: [I('h', 'Bandwidth', 8), I('mult', 'Multiplier', 3), I('win', 'Window', 200)],
      plots: [{ k: 'u', c: '#ff433d', name: 'Upper' }, { k: 'm', c: '#808080', name: 'Estimate' }, { k: 'l', c: '#00d26a', name: 'Lower' }],
      calc: (b, p) => { const s = src(b, 'close'), W = Math.min(p.win, 500), w = []; for (let j = 0; j < W; j++) w.push(Math.exp(-(j * j) / (2 * p.h * p.h))); const m = s.map((_, i) => { let a = 0, c = 0; for (let j = 0; j < W && i - j >= 0; j++) { a += s[i - j] * w[j]; c += w[j]; } return i < 10 ? null : a / c; });
        const mae = sma(s.map((v, i) => m[i] == null ? null : Math.abs(v - m[i])), Math.min(W, 100)).map(v => v == null ? null : v * p.mult), mk = [];
        s.forEach((v, i) => { if (!i || mae[i] == null) return; if (s[i - 1] <= m[i - 1] + mae[i - 1] && v > m[i] + mae[i]) mk.push({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d' }); if (s[i - 1] >= m[i - 1] - mae[i - 1] && v < m[i] - mae[i]) mk.push({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a' }); });
        return { u: m.map((v, i) => mae[i] == null ? null : v + mae[i]), m, l: m.map((v, i) => mae[i] == null ? null : v - mae[i]), _markers: mk }; } },
    { id: 'vixfix', name: 'Williams Vix Fix', short: 'VixFix', cat: 'Community', pane: 'new', inputs: [I('pd', 'Lookback', 22), I('bbl', 'BB length', 20), I('mult', 'BB mult', 2), I('lb', 'Percentile lookback', 50), I('ph', 'Highest percentile', 0.85)],
      plots: [{ k: 'w', c: '#808080', type: 'hist' }],
      calc: (b, p) => { const hc = highest(b.map(x => x.close), p.pd), w = b.map((x, i) => hc[i] == null ? null : (hc[i] - x.low) / hc[i] * 100), m = sma(w, p.bbl), sd = stdev(w, p.bbl), rh = highest(w, p.lb);
        return { w, _colors: { w: w.map((v, i) => v != null && (m[i] != null && v >= m[i] + p.mult * sd[i] || rh[i] != null && v >= rh[i] * p.ph) ? '#00d26a' : '#555555') } }; } },
    { id: 'chandelier', name: 'Chandelier Exit', short: 'CE', cat: 'Community', pane: 'overlay', inputs: [I('len', 'ATR period', 22), I('mult', 'ATR multiplier', 3)], plots: [{ k: 'l', c: '#00d26a', name: 'Long stop', type: 'step' }, { k: 's', c: '#ff433d', name: 'Short stop', type: 'step' }],
      calc: (b, p) => { const a = atr(b, p.len), hc = highest(b.map(x => x.close), p.len), lc = lowest(b.map(x => x.close), p.len), L = [], S = [], mk = []; let ls = null, ss = null, dir = 1;
        b.forEach((x, i) => { if (a[i] == null || hc[i] == null) { L.push(null); S.push(null); return; } let l = hc[i] - p.mult * a[i], s = lc[i] + p.mult * a[i]; const pc = i ? b[i - 1].close : x.close;
          if (ls != null && pc > ls) l = Math.max(l, ls); if (ss != null && pc < ss) s = Math.min(s, ss); const nd = ss != null && x.close > ss ? 1 : ls != null && x.close < ls ? -1 : dir;
          if (nd !== dir) mk.push({ i, pos: nd > 0 ? 'below' : 'above', shape: nd > 0 ? 'arrowUp' : 'arrowDown', c: nd > 0 ? '#00d26a' : '#ff433d', text: nd > 0 ? 'Buy' : 'Sell' }); dir = nd; ls = l; ss = s; L.push(dir > 0 ? l : null); S.push(dir < 0 ? s : null); });
        return { l: L, s: S, _markers: mk }; } },
    { id: 'halftrend', name: 'HalfTrend', short: 'HalfTrend', cat: 'Community', pane: 'overlay', inputs: [I('amp', 'Amplitude', 2), I('dev', 'Channel deviation', 2)], plots: [{ k: 'h', c: '#2196f3', name: 'HalfTrend' }],
      calc: (b, p) => { const n = b.length, a = atr(b, 100), hh = highest(b.map(x => x.high), p.amp), ll = lowest(b.map(x => x.low), p.amp), hm = sma(b.map(x => x.high), p.amp), lm = sma(b.map(x => x.low), p.amp), h = [], col = [], mk = [];
        let trend = 0, next = 0, maxL = n ? b[0].low : 0, minH = n ? b[0].high : 0, up = 0, dn = 0;
        for (let i = 0; i < n; i++) { if (hh[i] == null) { h.push(null); col.push(null); continue; } const x = b[i], pl = i ? b[i - 1].low : x.low, ph = i ? b[i - 1].high : x.high, prevT = trend;
          if (next === 1) { maxL = Math.max(ll[i], maxL); if (hm[i] < maxL && x.close < pl) { trend = 1; next = 0; minH = hh[i]; } } else { minH = Math.min(hh[i], minH); if (lm[i] > minH && x.close > ph) { trend = 0; next = 1; maxL = ll[i]; } }
          if (trend === 0) { up = prevT !== 0 ? dn : Math.max(maxL, up || maxL); } else { dn = prevT !== 1 ? up : Math.min(minH, dn || minH); }
          if (trend !== prevT && i) mk.push({ i, pos: trend === 0 ? 'below' : 'above', shape: trend === 0 ? 'arrowUp' : 'arrowDown', c: trend === 0 ? '#2196f3' : '#ff433d' });
          h.push(trend === 0 ? up : dn); col.push(trend === 0 ? '#2196f3' : '#ff433d'); }
        return { h, _colors: { h: col }, _markers: mk }; } },
    { id: 'qqe', name: 'QQE', short: 'QQE', cat: 'Community', pane: 'new', inputs: [I('rsi', 'RSI length', 6), I('sf', 'Smoothing', 5), I('qf', 'QQE factor', 3)], levels: [0],
      plots: [{ k: 'h', c: '#26a69a', name: 'RSI - 50', type: 'hist' }, { k: 'q', c: '#ffffff', name: 'QQE line' }],
      calc: (b, p) => { const r = ema(rsiA(src(b, 'close'), p.rsi), p.sf), wl = p.rsi * 2 - 1, dar = ema(ema(r.map((v, i) => i && v != null && r[i - 1] != null ? Math.abs(v - r[i - 1]) : null), wl), wl).map(v => v == null ? null : v * p.qf);
        let lb = null, sb = null, trend = 1; const fl = [];
        r.forEach((v, i) => { if (v == null || dar[i] == null) { fl.push(null); return; } const pv = r[i - 1], plb = lb, psb = sb, nl = v - dar[i], ns = v + dar[i];
          lb = plb != null && pv > plb && v > plb ? Math.max(plb, nl) : nl; sb = psb != null && pv < psb && v < psb ? Math.min(psb, ns) : ns;
          if (psb != null && pv <= psb && v > psb) trend = 1; else if (plb != null && pv >= plb && v < plb) trend = -1; fl.push((trend === 1 ? lb : sb) - 50); });
        const h = r.map(v => v == null ? null : v - 50); return { h, q: fl, _colors: { h: h.map(v => v == null ? null : v > 10 ? '#00c3ff' : v < -10 ? '#ff0062' : '#707070') } }; } },
    { id: 'hullsuite', name: 'Hull Suite (trend colored HMA)', short: 'Hull Suite', cat: 'Community', pane: 'overlay', inputs: [I('len', 'Length', 55)], plots: [{ k: 'h', c: '#00d26a', name: 'HMA' }, { k: 'p', c: '#00d26a', name: 'HMA[2]' }],
      calc: (b, p) => { const h = hmaA(src(b, 'close'), p.len), pr = h.map((_, i) => i >= 2 ? h[i - 2] : null), col = h.map((v, i) => v == null || pr[i] == null ? null : v > pr[i] ? '#00d26a' : '#ff433d'); return { h, p: pr, _colors: { h: col, p: col } }; } },
    { id: 'rangefilter', name: 'Range Filter', short: 'Range Filter', cat: 'Community', pane: 'overlay', inputs: [I('per', 'Sampling period', 100), I('mult', 'Range multiplier', 3)],
      plots: [{ k: 'f', c: '#ffffff', name: 'Filter' }, { k: 'h', c: '#4caf5080', name: 'High band' }, { k: 'l', c: '#ff433d80', name: 'Low band' }],
      calc: (b, p) => { const s = src(b, 'close'), wper = p.per * 2 - 1, rng = ema(ema(s.map((v, i) => i ? Math.abs(v - s[i - 1]) : null), p.per), wper).map(v => v == null ? null : v * p.mult), f = [], col = [], mk = []; let filt = null, up = 0, dn = 0, cond = 0;
        s.forEach((x, i) => { if (rng[i] == null) { f.push(null); col.push(null); return; } const pf = filt == null ? x : filt; filt = x > pf ? (x - rng[i] < pf ? pf : x - rng[i]) : (x + rng[i] > pf ? pf : x + rng[i]);
          up = filt > pf ? up + 1 : filt < pf ? 0 : up; dn = filt < pf ? dn + 1 : filt > pf ? 0 : dn; const L = x > filt && up > 0, S = x < filt && dn > 0, nc = L ? 1 : S ? -1 : cond;
          if (L && cond === -1) mk.push({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a', text: 'Buy' }); if (S && cond === 1) mk.push({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d', text: 'Sell' }); cond = nc;
          f.push(filt); col.push(up > 0 ? '#00d26a' : dn > 0 ? '#ff433d' : '#ff9e1b'); });
        return { f, h: f.map((v, i) => v == null ? null : v + rng[i]), l: f.map((v, i) => v == null ? null : v - rng[i]), _colors: { f: col }, _markers: mk }; } },
    { id: 'trendmagic', name: 'Trend Magic', short: 'Trend Magic', cat: 'Community', pane: 'overlay', inputs: [I('cci', 'CCI period', 20), I('atr', 'ATR period', 5), I('mult', 'ATR multiplier', 1)], plots: [{ k: 'm', c: '#2196f3', name: 'Magic' }],
      calc: (b, p) => { const c = byId.cci.calc(b, { len: p.cci }).cci, a = sma(tr(b), p.atr), m = [], col = []; let v = null;
        b.forEach((x, i) => { if (c[i] == null || a[i] == null) { m.push(null); col.push(null); return; } const up = x.low - a[i] * p.mult, dn = x.high + a[i] * p.mult; v = c[i] >= 0 ? (v != null && up < v ? v : up) : (v != null && dn > v ? v : dn); m.push(v); col.push(c[i] >= 0 ? '#2196f3' : '#ff433d'); });
        return { m, _colors: { m: col } }; } },
    { id: 'atrstop', name: 'ATR Trailing Stop', short: 'ATR Stop', cat: 'Community', pane: 'overlay', inputs: [I('len', 'ATR period', 14), I('mult', 'Multiplier', 3)], plots: [{ k: 's', c: '#ff9e1b', name: 'Stop', type: 'step' }],
      calc: (b, p) => { const a = atr(b, p.len), out = [], col = []; let st = null;
        b.forEach((x, i) => { if (a[i] == null) { out.push(null); col.push(null); return; } const pc = i ? b[i - 1].close : x.close, l = p.mult * a[i]; st = st == null ? x.close - l : x.close > st && pc > st ? Math.max(st, x.close - l) : x.close < st && pc < st ? Math.min(st, x.close + l) : x.close > st ? x.close - l : x.close + l; out.push(st); col.push(x.close > st ? '#00d26a' : '#ff433d'); });
        return { s: out, _colors: { s: col } }; } },
    { id: 'rsidiv', name: 'RSI Divergence', short: 'RSI Div', cat: 'Community', pane: 'new', inputs: [I('len', 'RSI length', 14), I('lb', 'Pivot lookback', 5), I('max', 'Max bars between pivots', 60)], levels: [70, 50, 30], plots: [{ k: 'r', c: '#c586ff', name: 'RSI' }],
      calc: (b, p) => { const r = rsiA(src(b, 'close'), p.len), lo = pivots(r, p.lb, p.lb, false), hi = pivots(r, p.lb, p.lb, true), mk = [];
        for (let k = 1; k < lo.length; k++) { const [i0, r0] = lo[k - 1], [i1, r1] = lo[k]; if (i1 - i0 <= p.max && r1 > r0 && b[i1].low < b[i0].low) mk.push({ i: i1, pos: 'below', shape: 'arrowUp', c: '#00d26a', text: 'Bull' }); }
        for (let k = 1; k < hi.length; k++) { const [i0, r0] = hi[k - 1], [i1, r1] = hi[k]; if (i1 - i0 <= p.max && r1 < r0 && b[i1].high > b[i0].high) mk.push({ i: i1, pos: 'above', shape: 'arrowDown', c: '#ff433d', text: 'Bear' }); }
        return { r, _markers: mk }; } },
    { id: 'ttmwave', name: 'MACD with signal crosses', short: 'MACD X', cat: 'Community', pane: 'new', inputs: [I('fast', 'Fast', 12), I('slow', 'Slow', 26), I('sig', 'Signal', 9)], levels: [0],
      plots: [{ k: 'h', c: '#26a69a', name: 'Histogram', type: 'hist' }, { k: 'm', c: '#2196f3', name: 'MACD' }, { k: 's', c: '#ff6d00', name: 'Signal' }],
      calc: (b, p) => { const s = src(b, 'close'), m = sub(ema(s, p.fast), ema(s, p.slow)), sg = ema(m, p.sig), h = sub(m, sg), mk = [];
        m.forEach((v, i) => { if (!i || v == null || sg[i] == null || m[i - 1] == null || sg[i - 1] == null) return; if (m[i - 1] <= sg[i - 1] && v > sg[i]) mk.push({ i, pos: 'below', shape: 'circle', c: '#00d26a' }); if (m[i - 1] >= sg[i - 1] && v < sg[i]) mk.push({ i, pos: 'above', shape: 'circle', c: '#ff433d' }); });
        return { h, m, s: sg, _colors: { h: h.map((v, i) => v == null ? null : v >= 0 ? (i && h[i - 1] != null && v < h[i - 1] ? '#b2dfdb' : '#26a69a') : (i && h[i - 1] != null && v > h[i - 1] ? '#ffcdd2' : '#ff5252')) }, _markers: mk }; } },

    // ---- levels & sessions (v1.16): previous highs/lows, separators, pivots by period, opening range, sessions, key levels ----
    { id: 'prevhl', name: 'Previous Day / Week / Month High Low', short: 'Prev H/L', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('show', 'Show', 'Day + Week + Month', { opts: ['Day + Week + Month', 'Day + Week', 'Day only', 'Week only', 'Month only'] }), I('cl', 'Previous close too', 'Yes', { opts: ['Yes', 'No'] })],
      plots: [{ k: 'dh', c: '#00e5ff', name: 'PDH', type: 'step' }, { k: 'dl', c: '#00e5ff', name: 'PDL', type: 'step' }, { k: 'dc', c: '#7fdfff', name: 'PDC', type: 'step' }, { k: 'wh', c: '#ff9e1b', name: 'PWH', type: 'step' }, { k: 'wl', c: '#ff9e1b', name: 'PWL', type: 'step' }, { k: 'mh', c: '#ff5fd2', name: 'PMH', type: 'step' }, { k: 'ml', c: '#ff5fd2', name: 'PML', type: 'step' }],
      calc: (b, p) => { const o = {}, on = { D: /Day/.test(p.show), W: /Week/.test(p.show), M: /Month/.test(p.show) };
        [['D', 'd'], ['W', 'w'], ['M', 'm']].forEach(([tf, k]) => { if (!on[tf]) return; const v = prevPer(b, tf); o[k + 'h'] = v.h; o[k + 'l'] = v.l; if (tf === 'D' && p.cl === 'Yes') o.dc = v.c; });
        return o; } },
    { id: 'seps', name: 'Session Separators (day / week / month lines)', short: 'Separators', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('tf', 'Separate', 'Auto', { opts: ['Auto', 'Day', 'Week', 'Month', 'Quarter', 'Year'] })],
      plots: [{ k: 'v', c: '#8888884d', name: 'Separator', type: 'vline' }],
      calc: (b, p) => { const tf = p.tf === 'Auto' ? (stepOf(b) < 86400 ? 'D' : stepOf(b) < 7 * 86400 ? 'M' : 'Y') : p.tf[0], k = b.map(x => perKey(x.time, tf)); return { v: k.map((x, i) => i && x !== k[i - 1] ? 1 : null) }; } },
    { id: 'pivstd', name: 'Pivot Points Standard (Traditional, Fibonacci, Woodie, Classic, DeMark, Camarilla)', short: 'Pivots Std', cat: 'Levels & sessions', pane: 'overlay',
      inputs: [I('kind', 'Type', 'Traditional', { opts: ['Traditional', 'Fibonacci', 'Woodie', 'Classic', 'DeMark', 'Camarilla'] }), I('tf', 'Pivots timeframe', 'Auto', { opts: ['Auto', 'Day', 'Week', 'Month', 'Quarter', 'Year'] })],
      plots: [{ k: 'p', c: '#ff9e1b', name: 'P', type: 'step' }, { k: 'r1', c: '#ff433d', name: 'R1', type: 'step' }, { k: 's1', c: '#00d26a', name: 'S1', type: 'step' }, { k: 'r2', c: '#ff433d', name: 'R2', type: 'step' }, { k: 's2', c: '#00d26a', name: 'S2', type: 'step' }, { k: 'r3', c: '#ff433d', name: 'R3', type: 'step' }, { k: 's3', c: '#00d26a', name: 'S3', type: 'step' }, { k: 'r4', c: '#c62828', name: 'R4', type: 'step' }, { k: 's4', c: '#2e7d32', name: 'S4', type: 'step' }],
      calc: (b, p) => { const st = stepOf(b), tf = p.tf === 'Auto' ? (st <= 900 ? 'D' : st < 86400 ? 'W' : st < 7 * 86400 ? 'M' : 'Y') : p.tf[0], v = prevPer(b, tf), K = ['p', 'r1', 's1', 'r2', 's2', 'r3', 's3', 'r4', 's4'], o = Object.fromEntries(K.map(k => [k, []]));
        b.forEach((x, i) => { const H = v.h[i], L = v.l[i], C = v.c[i], O = v.o[i], cur = v.co[i]; if (H == null) { K.forEach(k => o[k].push(null)); return; } const R = H - L; let P, l = {};
          if (p.kind === 'Woodie') { P = (H + L + 2 * cur) / 4; const r3 = H + 2 * (P - L), s3 = L - 2 * (H - P); l = { r1: 2 * P - L, s1: 2 * P - H, r2: P + R, s2: P - R, r3, s3, r4: r3 + R, s4: s3 - R }; }
          else if (p.kind === 'Fibonacci') { P = (H + L + C) / 3; l = { r1: P + 0.382 * R, s1: P - 0.382 * R, r2: P + 0.618 * R, s2: P - 0.618 * R, r3: P + R, s3: P - R }; }
          else if (p.kind === 'Classic') { P = (H + L + C) / 3; l = { r1: 2 * P - L, s1: 2 * P - H, r2: P + R, s2: P - R, r3: P + 2 * R, s3: P - 2 * R, r4: P + 3 * R, s4: P - 3 * R }; }
          else if (p.kind === 'DeMark') { const X = C < O ? H + 2 * L + C : C > O ? 2 * H + L + C : H + L + 2 * C; P = X / 4; l = { r1: X / 2 - L, s1: X / 2 - H }; }
          else if (p.kind === 'Camarilla') { P = (H + L + C) / 3; l = { r1: C + R * 1.1 / 12, s1: C - R * 1.1 / 12, r2: C + R * 1.1 / 6, s2: C - R * 1.1 / 6, r3: C + R * 1.1 / 4, s3: C - R * 1.1 / 4, r4: C + R * 1.1 / 2, s4: C - R * 1.1 / 2 }; }
          else { P = (H + L + C) / 3; l = { r1: 2 * P - L, s1: 2 * P - H, r2: P + R, s2: P - R, r3: 2 * P + (H - 2 * L), s3: 2 * P - (2 * H - L), r4: 3 * P + (H - 3 * L), s4: 3 * P - (3 * H - L) }; }
          l.p = P; K.forEach(k => o[k].push(l[k] == null ? null : l[k])); });
        return brk(o, v.first); } },
    { id: 'cpr', name: 'Central Pivot Range (CPR)', short: 'CPR', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('tf', 'Timeframe', 'Day', { opts: ['Day', 'Week', 'Month'] })],
      plots: [{ k: 'tc', c: '#4aa8ff', name: 'TC', type: 'step' }, { k: 'p', c: '#ff9e1b', name: 'Pivot', type: 'step' }, { k: 'bc', c: '#4aa8ff', name: 'BC', type: 'step' }],
      calc: (b, p) => { const v = prevPer(b, p.tf[0]), P = v.h.map((h, i) => h == null ? null : (h + v.l[i] + v.c[i]) / 3), B = v.h.map((h, i) => h == null ? null : (h + v.l[i]) / 2);
        return brk({ p: P, bc: B.map((x, i) => x == null ? null : Math.min(x, 2 * P[i] - x)), tc: B.map((x, i) => x == null ? null : Math.max(x, 2 * P[i] - x)) }, v.first); } },
    { id: 'opens', name: 'Daily / Weekly / Monthly Open', short: 'Opens', cat: 'Levels & sessions', pane: 'overlay', inputs: [],
      plots: [{ k: 'd', c: '#ffd400', name: 'Day open', type: 'step' }, { k: 'w', c: '#ff9e1b', name: 'Week open', type: 'step' }, { k: 'm', c: '#ff5fd2', name: 'Month open', type: 'step' }],
      calc: b => { const o = {}; [['D', 'd'], ['W', 'w'], ['M', 'm']].forEach(([tf, k]) => { const v = prevPer(b, tf); o[k] = brk({ x: v.co }, v.first).x; }); if (stepOf(b) >= 86400) delete o.d; return o; } },
    { id: 'orb', name: 'Opening Range (high / low of the first minutes)', short: 'ORB', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('min', 'Minutes', 30), I('ext', 'Breakout targets (x range)', 1)],
      plots: [{ k: 'h', c: '#00d26a', name: 'OR high', type: 'step' }, { k: 'l', c: '#ff433d', name: 'OR low', type: 'step' }, { k: 'ut', c: '#00d26a80', name: 'Target up', type: 'step' }, { k: 'dt', c: '#ff433d80', name: 'Target down', type: 'step' }],
      calc: (b, p) => { const n = b.length, h = Array(n).fill(null), l = Array(n).fill(null), ut = Array(n).fill(null), dt = Array(n).fill(null), mk = []; if (stepOf(b) >= 86400) return { h, l, ut, dt };
        let day = null, t0 = 0, H = null, L = null, done = false, br = 0;
        b.forEach((x, i) => { const d = perKey(x.time, 'D'); if (d !== day) { day = d; t0 = x.time; H = x.high; L = x.low; done = false; br = 0; }
          if (!done && x.time < t0 + p.min * 60) { H = Math.max(H, x.high); L = Math.min(L, x.low); return; } done = true; const R = (H - L) * p.ext;
          h[i] = H; l[i] = L; if (p.ext > 0) { ut[i] = H + R; dt[i] = L - R; }
          if (!br && x.close > H) { br = 1; mk.push({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a', text: 'ORB' }); } else if (!br && x.close < L) { br = -1; mk.push({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d', text: 'ORB' }); } });
        return { h, l, ut, dt, _markers: mk }; } },
    { id: 'sessions', name: 'Trading Sessions (Asia / London / New York high low)', short: 'Sessions', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('asia', 'Asia UTC (start-end hours)', '0-9', { opts: ['0-9', '23-8', '1-8'] }), I('ldn', 'London UTC', '7-16', { opts: ['7-16', '8-16.5'] }), I('ny', 'New York UTC', '13.5-20', { opts: ['13.5-20', '12-21', '14.5-21'] })],
      plots: [{ k: 'ah', c: '#ff5fd2', name: 'Asia high', type: 'step' }, { k: 'al', c: '#ff5fd2', name: 'Asia low', type: 'step' }, { k: 'lh', c: '#4aa8ff', name: 'London high', type: 'step' }, { k: 'll', c: '#4aa8ff', name: 'London low', type: 'step' }, { k: 'nh', c: '#ff9e1b', name: 'NY high', type: 'step' }, { k: 'nl', c: '#ff9e1b', name: 'NY low', type: 'step' }],
      calc: (b, p) => { const o = {}; if (stepOf(b) >= 86400) return o;
        [['a', p.asia], ['l', p.ldn], ['n', p.ny]].forEach(([k, r]) => { const [s, e] = r.split('-').map(Number), inS = t => { const hr = (t % 86400) / 3600; return s < e ? hr >= s && hr < e : hr >= s || hr < e; };
          const H = [], L = []; let ch = null, cl = null, was = false; b.forEach((x, i) => { const now = inS(x.time); if (now && !was) { ch = x.high; cl = x.low; H.push(null); L.push(null); } else { if (now) { ch = Math.max(ch, x.high); cl = Math.min(cl, x.low); } H.push(ch); L.push(cl); } was = now; });
          o[k + 'h'] = H; o[k + 'l'] = L; });
        return o; } },
    { id: 'hl52', name: '52-Week High / Low', short: '52W H/L', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('wk', 'Weeks', 52)],
      plots: [{ k: 'h', c: '#00d26a', name: '52W high', type: 'step' }, { k: 'l', c: '#ff433d', name: '52W low', type: 'step' }],
      calc: (b, p) => { const span = p.wk * 7 * 86400, h = [], l = [], qh = [], ql = []; let j = 0;
        b.forEach((x, i) => { while (qh.length && b[qh[qh.length - 1]].high <= x.high) qh.pop(); qh.push(i); while (ql.length && b[ql[ql.length - 1]].low >= x.low) ql.pop(); ql.push(i);
          while (b[j].time <= x.time - span) j++; while (qh[0] < j) qh.shift(); while (ql[0] < j) ql.shift(); const full = b[0].time <= x.time - span * 0.97; h.push(full ? b[qh[0]].high : null); l.push(full ? b[ql[0]].low : null); });
        const last = b.length - 1, ok = h[last] != null; return { h, l, _lines: ok ? [{ p: h[last], c: '#00d26a', w: 1, s: 1, t: '52W high' }, { p: l[last], c: '#ff433d', w: 1, s: 1, t: '52W low' }] : [] }; } },
    { id: 'ath', name: 'All-Time High / Low (loaded history)', short: 'ATH/ATL', cat: 'Levels & sessions', pane: 'overlay', inputs: [],
      plots: [{ k: 'h', c: '#00d26a', name: 'ATH', type: 'step' }, { k: 'l', c: '#ff433d', name: 'ATL', type: 'step' }],
      calc: b => { let H = -Infinity, L = Infinity; const h = [], l = []; b.forEach(x => { H = Math.max(H, x.high); L = Math.min(L, x.low); h.push(H); l.push(L); });
        return { h, l, _lines: [{ p: H, c: '#00d26a', w: 1, s: 1, t: 'High of loaded range' }, { p: L, c: '#ff433d', w: 1, s: 1, t: 'Low of loaded range' }] }; } },
    { id: 'round', name: 'Round Numbers (psychological levels)', short: 'Round #', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('step', 'Step (0 = auto)', 0), I('n', 'Levels each side', 5)], plots: [],
      calc: (b, p) => { const c = b[b.length - 1].close, st = p.step > 0 ? p.step : Math.pow(10, Math.floor(Math.log10(c)) - 1) * (c / Math.pow(10, Math.floor(Math.log10(c))) < 3 ? 2.5 : 5), base = Math.round(c / st) * st, L = [];
        for (let k = -p.n; k <= p.n; k++) { const v = base + k * st; if (v > 0) L.push({ p: +v.toFixed(6), c: k % 2 ? '#88888866' : '#aaaaaa99', w: 1, s: 1, t: fmt(v) }); } return { _lines: L }; } },
    { id: 'adr', name: 'Average Daily Range Levels', short: 'ADR levels', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('len', 'Days', 14)],
      plots: [{ k: 'h', c: '#00d26a', name: 'ADR high', type: 'step' }, { k: 'l', c: '#ff433d', name: 'ADR low', type: 'step' }],
      calc: (b, p) => { const g = groups(b, 'D'), rng = sma(g.map(x => x.h - x.l), p.len), h = [], l = [];
        g.forEach((x, k) => { const a = k ? rng[k - 1] : null; let H = -Infinity, L = Infinity; for (let i = x.s; i <= x.e; i++) { H = Math.max(H, b[i].high); L = Math.min(L, b[i].low); h.push(a == null ? null : L + a); l.push(a == null ? null : H - a); } });
        return brk({ h, l }, g.map(x => x.s)); } },
    { id: 'vwapp', name: 'VWAP (anchored to week, month, quarter or year)', short: 'VWAP P', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('tf', 'Anchor period', 'Week', { opts: ['Day', 'Week', 'Month', 'Quarter', 'Year'] }), I('m', 'Band multiplier (0 = off)', 1)],
      plots: [{ k: 'v', c: '#00e5ff', name: 'VWAP' }, { k: 'u', c: '#00e5ff66', name: 'Upper' }, { k: 'd', c: '#00e5ff66', name: 'Lower' }],
      calc: (b, p) => { const v = [], u = [], d = []; let key = null, pv = 0, vv = 0, pv2 = 0;
        b.forEach(x => { const k = perKey(x.time, p.tf[0]), tp = (x.high + x.low + x.close) / 3; if (k !== key) { key = k; pv = vv = pv2 = 0; } pv += tp * x.volume; vv += x.volume; pv2 += tp * tp * x.volume;
          if (!vv) { v.push(null); u.push(null); d.push(null); return; } const m = pv / vv, sd = Math.sqrt(Math.max(0, pv2 / vv - m * m)); v.push(m); u.push(p.m > 0 ? m + p.m * sd : null); d.push(p.m > 0 ? m - p.m * sd : null); });
        return { v, u, d }; } },
    { id: 'vpl', name: 'Volume Profile Levels (POC, value area high / low)', short: 'VP levels', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('len', 'Bars (0 = all loaded)', 0), I('rows', 'Rows', 60), I('va', 'Value area %', 70)], plots: [],
      calc: (b, p) => { const a = p.len > 0 ? b.slice(-p.len) : b, lo = Math.min(...a.map(x => x.low)), hi = Math.max(...a.map(x => x.high)), n = p.rows, st = (hi - lo) / n || 1, row = Array(n).fill(0);
        a.forEach(x => { const r0 = Math.min(n - 1, Math.floor((x.low - lo) / st)), r1 = Math.min(n - 1, Math.floor((x.high - lo) / st)), share = x.volume / (r1 - r0 + 1); for (let r = r0; r <= r1; r++) row[r] += share; });
        const tot = row.reduce((s, x) => s + x, 0); if (!tot) return {}; let poc = row.indexOf(Math.max(...row)), up = poc, dn = poc, acc = row[poc];
        while (acc < tot * p.va / 100 && (up < n - 1 || dn > 0)) { const nu = up < n - 1 ? row[up + 1] : -1, nd = dn > 0 ? row[dn - 1] : -1; if (nu >= nd) acc += row[++up]; else acc += row[--dn]; }
        const mid = r => lo + (r + 0.5) * st; return { _lines: [{ p: mid(poc), c: '#ff9e1b', w: 2, t: 'POC' }, { p: lo + (up + 1) * st, c: '#4aa8ff', w: 1, s: 1, t: 'VAH' }, { p: lo + dn * st, c: '#4aa8ff', w: 1, s: 1, t: 'VAL' }] }; } },
    { id: 'gaps', name: 'Price Gaps (unfilled)', short: 'Gaps', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('min', 'Min gap %', 0.5), I('max', 'Max gaps shown', 6)], plots: [],
      calc: (b, p) => { const g = []; for (let i = 1; i < b.length; i++) { const a = b[i - 1], x = b[i]; if (x.low > a.high && (x.low / a.high - 1) * 100 >= p.min) g.push({ up: 1, top: x.low, bot: a.high, i }); if (x.high < a.low && (a.low / x.high - 1) * 100 >= p.min) g.push({ up: 0, top: a.low, bot: x.high, i }); }
        const open = g.filter(z => !b.slice(z.i + 1).some(q => z.up ? q.low <= z.bot : q.high >= z.top)).slice(-p.max);
        return { _lines: open.flatMap(z => [{ p: z.top, c: z.up ? '#00d26a' : '#ff433d', w: 1, s: 1, t: (z.up ? 'Gap up ' : 'Gap down ') + fmt(z.bot) + '-' + fmt(z.top) }, { p: z.bot, c: z.up ? '#00d26a' : '#ff433d', w: 1, s: 1, t: '' }]), _markers: open.map(z => ({ i: z.i, pos: z.up ? 'below' : 'above', shape: 'square', c: z.up ? '#00d26a' : '#ff433d', text: 'gap', size: 0 })) }; } },
    { id: 'mtfma', name: 'Higher Timeframe Moving Average (daily / weekly MA on any chart)', short: 'HTF MA', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('tf', 'Timeframe', 'Day', { opts: ['Day', 'Week', 'Month'] }), I('t', 'Type', 'SMA', { opts: ['SMA', 'EMA'] }), I('len', 'Length', 200)],
      plots: [{ k: 'm', c: '#ffd400', name: 'MA', type: 'step' }],
      calc: (b, p) => { const g = groups(b, p.tf[0]), cl = g.map(x => b[x.e].close), done = p.t === 'EMA' ? ema(cl, p.len) : sma(cl, p.len), k = 2 / (p.len + 1), m = [];
        g.forEach((x, j) => { for (let i = x.s; i <= x.e; i++) { const c = b[i].close; if (p.t === 'EMA') m.push(j && done[j - 1] != null ? done[j - 1] * (1 - k) + c * k : null);
          else { if (j + 1 < p.len) { m.push(null); continue; } let s = c; for (let q = j - p.len + 1; q < j; q++) s += cl[q]; m.push(s / p.len); } } });
        return { m }; } },
    { id: 'macross', name: 'Moving Average Cross (golden / death cross)', short: 'MA Cross', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('t', 'Type', 'SMA', { opts: MAT }), I('f', 'Fast', 50), I('s', 'Slow', 200)],
      plots: [{ k: 'f', c: '#ffd400', name: 'Fast' }, { k: 's', c: '#4aa8ff', name: 'Slow' }],
      calc: (b, p) => { const c = src(b, 'close'), f = ma(c, p.f, p.t), s = ma(c, p.s, p.t), mk = [];
        f.forEach((v, i) => { if (!i || v == null || s[i] == null || f[i - 1] == null || s[i - 1] == null) return; if (f[i - 1] <= s[i - 1] && v > s[i]) mk.push({ i, pos: 'below', shape: 'arrowUp', c: '#00d26a', text: 'Golden' }); if (f[i - 1] >= s[i - 1] && v < s[i]) mk.push({ i, pos: 'above', shape: 'arrowDown', c: '#ff433d', text: 'Death' }); });
        return { f, s, _markers: mk }; } },
    { id: 'candles', name: 'Candlestick Patterns (engulfing, hammer, doji, stars, harami)', short: 'Candles', cat: 'Levels & sessions', pane: 'overlay', inputs: [I('trend', 'Need prior trend (bars, 0 = off)', 5)], plots: [],
      calc: (b, p) => { const mk = [], body = x => Math.abs(x.close - x.open), rng = x => x.high - x.low || 1e-9, up = x => x.close > x.open, a14 = atr(b, 14);
        const down = i => !p.trend || (i >= p.trend && b[i - 1].close < b[i - p.trend].close), rise = i => !p.trend || (i >= p.trend && b[i - 1].close > b[i - p.trend].close);
        for (let i = 2; i < b.length; i++) { const x = b[i], y = b[i - 1], z = b[i - 2], av = a14[i] || rng(x), add = (pos, t, c) => mk.push({ i, pos, shape: pos === 'below' ? 'arrowUp' : 'arrowDown', c, text: t, size: 0 });
          const lw = Math.min(x.open, x.close) - x.low, uw = x.high - Math.max(x.open, x.close);
          if (up(x) && !up(y) && x.close >= y.open && x.open <= y.close && body(x) > body(y) && down(i)) add('below', 'Bull engulf', '#00d26a');
          else if (!up(x) && up(y) && x.open >= y.close && x.close <= y.open && body(x) > body(y) && rise(i)) add('above', 'Bear engulf', '#ff433d');
          else if (lw >= 2 * body(x) && uw <= body(x) * 0.6 && rng(x) > 0.6 * av && down(i)) add('below', 'Hammer', '#00d26a');
          else if (uw >= 2 * body(x) && lw <= body(x) * 0.6 && rng(x) > 0.6 * av && rise(i)) add('above', 'Shooting star', '#ff433d');
          else if (!up(z) && body(z) > 0.6 * av && body(y) < 0.3 * body(z) && up(x) && x.close > (z.open + z.close) / 2 && down(i - 1)) add('below', 'Morning star', '#00d26a');
          else if (up(z) && body(z) > 0.6 * av && body(y) < 0.3 * body(z) && !up(x) && x.close < (z.open + z.close) / 2 && rise(i - 1)) add('above', 'Evening star', '#ff433d');
          else if (body(y) > 0.6 * av && body(x) < 0.5 * body(y) && Math.max(x.open, x.close) < Math.max(y.open, y.close) && Math.min(x.open, x.close) > Math.min(y.open, y.close)) add(up(y) ? 'above' : 'below', 'Harami', '#ff9e1b');
          else if (body(x) <= 0.1 * rng(x) && rng(x) > 0.5 * av) mk.push({ i, pos: 'above', shape: 'circle', c: '#aaaaaa', text: 'Doji', size: 0 }); }
        return { _markers: mk }; } },
    { id: 'inout', name: 'Inside / Outside Bars', short: 'In/Out bars', cat: 'Levels & sessions', pane: 'overlay', inputs: [], plots: [],
      calc: b => ({ _markers: b.flatMap((x, i) => !i ? [] : x.high < b[i - 1].high && x.low > b[i - 1].low ? [{ i, pos: 'above', shape: 'square', c: '#ff9e1b', text: 'IB', size: 0 }] : x.high > b[i - 1].high && x.low < b[i - 1].low ? [{ i, pos: 'above', shape: 'square', c: '#4aa8ff', text: 'OB', size: 0 }] : []) }) },
    // ---- more classic indicators (v1.16) ----
    { id: 'alligator', name: 'Williams Alligator', short: 'Alligator', cat: 'Trend', pane: 'overlay', inputs: [I('j', 'Jaw length', 13), I('t', 'Teeth length', 8), I('l', 'Lips length', 5)],
      plots: [{ k: 'j', c: '#2196f3', name: 'Jaw' }, { k: 't', c: '#e91e63', name: 'Teeth' }, { k: 'l', c: '#66bb6a', name: 'Lips' }],
      calc: (b, p) => { const s = src(b, 'hl2'), sh = (a, n) => a.map((_, i) => i >= n ? a[i - n] : null); return { j: sh(rma(s, p.j), 8), t: sh(rma(s, p.t), 5), l: sh(rma(s, p.l), 3) }; } },
    { id: 'ac', name: 'Accelerator Oscillator', short: 'AC', cat: 'Momentum', pane: 'new', inputs: [], levels: [0], plots: [{ k: 'h', c: '#26a69a', type: 'hist' }],
      calc: b => { const m = src(b, 'hl2'), ao = sub(sma(m, 5), sma(m, 34)), h = sub(ao, sma(ao, 5)); return { h, _colors: { h: h.map((v, i) => v == null ? null : i && h[i - 1] != null && v < h[i - 1] ? '#ff5252' : '#26a69a') } }; } },
    { id: 'efi', name: 'Elder Force Index', short: 'EFI', cat: 'Volume', pane: 'new', inputs: [I('len', 'Length', 13)], levels: [0], plots: [{ k: 'f', c: '#ff5fd2' }],
      calc: (b, p) => ({ f: ema(b.map((x, i) => i ? (x.close - b[i - 1].close) * x.volume : null), p.len) }) },
    { id: 'vosc', name: 'Volume Oscillator', short: 'Vol Osc', cat: 'Volume', pane: 'new', inputs: [I('s', 'Short', 5), I('l', 'Long', 10)], levels: [0], plots: [{ k: 'o', c: '#4aa8ff' }],
      calc: (b, p) => { const v = b.map(x => x.volume), s = ema(v, p.s), l = ema(v, p.l); return { o: s.map((x, i) => x == null || !l[i] ? null : 100 * (x - l[i]) / l[i]) }; } },
    { id: 'netvol', name: 'Net Volume', short: 'Net Vol', cat: 'Volume', pane: 'new', inputs: [], levels: [0], plots: [{ k: 'n', c: '#26a69a', type: 'hist' }],
      calc: b => ({ n: b.map((x, i) => !i ? null : x.close > b[i - 1].close ? x.volume : x.close < b[i - 1].close ? -x.volume : 0) }) },
    { id: 'rvi', name: 'Relative Vigor Index', short: 'RVGI', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Length', 10)], levels: [0], plots: [{ k: 'r', c: '#00d26a', name: 'RVGI' }, { k: 's', c: '#ff433d', name: 'Signal' }],
      calc: (b, p) => { const w4 = a => a.map((_, i) => i < 3 || a[i - 3] == null ? null : (a[i] + 2 * a[i - 1] + 2 * a[i - 2] + a[i - 3]) / 6), num = sum(w4(b.map(x => x.close - x.open)), p.len), den = sum(w4(b.map(x => x.high - x.low)), p.len), r = num.map((v, i) => v == null || !den[i] ? null : v / den[i]); return { r, s: w4(r) }; } },
    { id: 'stc', name: 'Schaff Trend Cycle', short: 'STC', cat: 'Momentum', pane: 'new', inputs: [I('len', 'Cycle length', 10), I('fast', 'Fast', 23), I('slow', 'Slow', 50)], levels: [25, 75], plots: [{ k: 's', c: '#ff9e1b' }],
      calc: (b, p) => { const m = sub(ema(src(b, 'close'), p.fast), ema(src(b, 'close'), p.slow)), st = (a, n) => { const o = []; let f = null, pf = null; a.forEach((v, i) => { if (v == null || i < n - 1 || a[i - n + 1] == null) { o.push(null); return; } const w = a.slice(i - n + 1, i + 1), lo = Math.min(...w), r = Math.max(...w) - lo; f = r > 0 ? (v - lo) / r * 100 : (f == null ? 50 : f); pf = pf == null ? f : pf + 0.5 * (f - pf); o.push(pf); }); return o; };
        return { s: st(st(m, p.len), p.len) }; } },
    { id: 'gmma', name: 'Guppy Multiple Moving Average', short: 'GMMA', cat: 'Moving averages', pane: 'overlay', inputs: [],
      plots: [3, 5, 8, 10, 12, 15].map((n, k) => ({ k: 's' + k, c: '#4aa8ff', name: 'EMA ' + n })).concat([30, 35, 40, 45, 50, 60].map((n, k) => ({ k: 'l' + k, c: '#ff433d', name: 'EMA ' + n }))),
      calc: b => { const c = src(b, 'close'), o = {}; [3, 5, 8, 10, 12, 15].forEach((n, k) => { o['s' + k] = ema(c, n); }); [30, 35, 40, 45, 50, 60].forEach((n, k) => { o['l' + k] = ema(c, n); }); return o; } },
    { id: 'zlema', name: 'Zero Lag EMA', short: 'ZLEMA', cat: 'Moving averages', pane: 'overlay', inputs: [I('len', 'Length', 21)], plots: [{ k: 'm', c: '#a0ff5f' }],
      calc: (b, p) => { const c = src(b, 'close'), lag = Math.floor((p.len - 1) / 2); return { m: ema(c.map((v, i) => i >= lag ? 2 * v - c[i - lag] : null), p.len) }; } },
    { id: 'chvol', name: 'Chaikin Volatility', short: 'Chaikin Vol', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Length', 10), I('roc', 'ROC length', 10)], levels: [0], plots: [{ k: 'v', c: '#ff8a3d' }],
      calc: (b, p) => { const e = ema(b.map(x => x.high - x.low), p.len); return { v: e.map((v, i) => v == null || i < p.roc || !e[i - p.roc] ? null : 100 * (v - e[i - p.roc]) / e[i - p.roc]) }; } },
    { id: 'adrp', name: 'ADR % (average daily range percent)', short: 'ADR%', cat: 'Volatility', pane: 'new', inputs: [I('len', 'Days', 20)], plots: [{ k: 'a', c: '#ffd400', type: 'step' }],
      calc: (b, p) => { const g = groups(b, 'D'), r = sma(g.map(x => { let H = -Infinity, L = Infinity; for (let i = x.s; i <= x.e; i++) { H = Math.max(H, b[i].high); L = Math.min(L, b[i].low); } return H / L; }), p.len), a = [];
        g.forEach((x, k) => { for (let i = x.s; i <= x.e; i++) a.push(k && r[k - 1] != null ? 100 * (r[k - 1] - 1) : null); }); return { a }; } },
    { id: 'aroonosc', name: 'Aroon Oscillator', short: 'Aroon Osc', cat: 'Trend', pane: 'new', inputs: [I('len', 'Length', 14)], levels: [0], plots: [{ k: 'o', c: '#4aa8ff' }],
      calc: (b, p) => { const r = byId.aroon.calc(b, { len: p.len }); return { o: sub(r.up, r.dn) }; } },
    { id: 'cks', name: 'Chande Kroll Stop', short: 'CK Stop', cat: 'Volatility', pane: 'overlay', inputs: [I('p', 'ATR length', 10), I('x', 'Multiplier', 1), I('q', 'Stop length', 9)],
      plots: [{ k: 'l', c: '#00d26a', name: 'Stop long' }, { k: 's', c: '#ff433d', name: 'Stop short' }],
      calc: (b, p) => { const a = atr(b, p.p), fh = highest(b.map(x => x.high), p.p).map((v, i) => v == null || a[i] == null ? null : v - p.x * a[i]), fl = lowest(b.map(x => x.low), p.p).map((v, i) => v == null || a[i] == null ? null : v + p.x * a[i]); return { s: highest(fh, p.q), l: lowest(fl, p.q) }; } },
    { id: 'lrslope', name: 'Linear Regression Slope', short: 'LR Slope', cat: 'Trend', pane: 'new', inputs: [I('len', 'Length', 50)], levels: [0], plots: [{ k: 's', c: '#c586ff' }],
      calc: (b, p) => { const c = src(b, 'close'), l = linregA(c, p.len); return { s: l.map((v, i) => v == null || l[i - 1] == null ? null : v - l[i - 1]) }; } },
  ];
  const byId = Object.fromEntries(L.map(d => [d.id, d]));
  function defaults(d) { return Object.fromEntries(d.inputs.map(i => [i.k, i.d])); }
  function run(id, bars, params, ctx) {
    setTz(ctx && ctx.tz);
    const d = byId[id]; const p = { ...defaults(d), ...(params || {}) };
    d.inputs.forEach(i => { if (typeof i.d === 'number') p[i.k] = Number.isFinite(+p[i.k]) ? +p[i.k] : i.d; if (typeof i.d === 'number' && Number.isInteger(i.d) && i.d > 0) p[i.k] = Math.max(1, Math.round(p[i.k])); });
    const out = d.calc(bars, p), colors = out._colors || {}, lines = out._lines || [], markers = out._markers || []; delete out._colors; delete out._lines; delete out._markers;
    return { out, colors, lines, markers };
  }
  const CATS = ['Moving averages', 'Trend', 'Momentum', 'Volatility', 'Volume', 'Support & resistance', 'Levels & sessions', 'Community'];
  return { list: L, byId, defaults, run, CATS, N };
})();
