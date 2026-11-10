'use strict';
// TradingView-style drawing tools on a canvas over a Lightweight Charts chart.
// Points are stored as {t: unix seconds, p: price}, so drawings survive range changes and restarts.
// One instance per chart panel (Drawings.create); magnet / stay / hide / default style are shared by all panels.
// Long / Short Position are risk-reward annotations only: nothing here places or sends orders.
window.Drawings = (() => {
  // n = clicks to place (0 = freehand drag, -1 = click points, double-click or Enter to finish); txt = asks for text
  const T = {
    cursor: { l: 'Cursor' }, eraser: { l: 'Eraser (click a drawing to delete it)' },
    trend: { n: 2, l: 'Trend line' }, ray: { n: 2, l: 'Ray' }, info: { n: 2, l: 'Info line' }, extended: { n: 2, l: 'Extended line' }, angle: { n: 2, l: 'Trend angle' },
    hline: { n: 1, l: 'Horizontal line' }, hray: { n: 1, l: 'Horizontal ray' }, vline: { n: 1, l: 'Vertical line' }, cross: { n: 1, l: 'Cross line' },
    channel: { n: 3, l: 'Parallel channel' }, regression: { n: 2, l: 'Regression trend' }, flattop: { n: 3, l: 'Flat top / bottom' }, disjoint: { n: 3, l: 'Disjoint channel' },
    pitchfork: { n: 3, l: 'Pitchfork' }, schiff: { n: 3, l: 'Schiff pitchfork' }, mschiff: { n: 3, l: 'Modified Schiff pitchfork' }, insidefork: { n: 3, l: 'Inside pitchfork' }, pitchfan: { n: 3, l: 'Pitchfan' },
    fib: { n: 2, l: 'Fib retracement' }, fibext: { n: 3, l: 'Trend-based fib extension' }, fibchannel: { n: 3, l: 'Fib channel' }, fibtime: { n: 2, l: 'Fib time zone' },
    fibfan: { n: 2, l: 'Fib speed resistance fan' }, fibcircle: { n: 2, l: 'Fib circles' }, fibarc: { n: 2, l: 'Fib speed resistance arcs' }, fibwedge: { n: 3, l: 'Fib wedge' },
    gannbox: { n: 2, l: 'Gann box' }, gannsquare: { n: 2, l: 'Gann square' }, gannfan: { n: 2, l: 'Gann fan' },
    xabcd: { n: 5, l: 'XABCD pattern' }, cypher: { n: 5, l: 'Cypher pattern' }, abcd: { n: 4, l: 'ABCD pattern' }, hs: { n: 7, l: 'Head and shoulders' },
    trianglepat: { n: 4, l: 'Triangle pattern' }, threedrives: { n: 7, l: 'Three drives pattern' }, elliott: { n: 6, l: 'Elliott impulse wave (12345)' },
    elliottabc: { n: 4, l: 'Elliott correction wave (ABC)' }, elliotttri: { n: 6, l: 'Elliott triangle wave (ABCDE)' }, elliottwxy: { n: 4, l: 'Elliott double combo (WXY)' },
    cyclic: { n: 2, l: 'Cyclic lines' }, timecycle: { n: 2, l: 'Time cycles' }, sine: { n: 2, l: 'Sine line' },
    long: { n: 1, l: 'Long position (risk / reward)' }, short: { n: 1, l: 'Short position (risk / reward)' }, forecast: { n: 2, l: 'Forecast' },
    daterange: { n: 2, l: 'Date range' }, pricerange: { n: 2, l: 'Price range' }, measure: { n: 2, l: 'Date and price range' },
    avwap: { n: 1, l: 'Anchored VWAP' }, fixedvp: { n: 2, l: 'Fixed range volume profile' }, barspattern: { n: 2, l: 'Bars pattern (copy bars)' }, projection: { n: 3, l: 'Projection' },
    brush: { n: 0, l: 'Brush' }, highlighter: { n: 0, l: 'Highlighter' }, arrow: { n: 2, l: 'Arrow' }, arrowup: { n: 1, l: 'Arrow mark up' }, arrowdown: { n: 1, l: 'Arrow mark down' },
    rect: { n: 2, l: 'Rectangle' }, rotrect: { n: 3, l: 'Rotated rectangle' }, circle: { n: 2, l: 'Circle' }, ellipse: { n: 2, l: 'Ellipse' }, triangle: { n: 3, l: 'Triangle' },
    path: { n: -1, l: 'Path' }, polyline: { n: -1, l: 'Polyline' }, arc: { n: 3, l: 'Arc' }, curve: { n: 3, l: 'Curve' }, dcurve: { n: 3, l: 'Double curve' },
    text: { n: 1, l: 'Text', txt: 1 }, note: { n: 1, l: 'Note', txt: 1 }, callout: { n: 2, l: 'Callout', txt: 1 }, comment: { n: 1, l: 'Comment', txt: 1 },
    pricelabel: { n: 1, l: 'Price label' }, pricenote: { n: 2, l: 'Price note' }, signpost: { n: 1, l: 'Signpost', txt: 1 }, flag: { n: 1, l: 'Flag mark' },
    icon: { n: 1, l: 'Icon' }
  };
  const ICONS = ['★', '✓', '✗', '⚠', '⬆', '⬇', '●', '◆', '♥', '☺', '☹', '🔥', '🚀', '💰', '🎯', '📌', '👍', '👎', '💡', '⏰'];
  const GROUPS = [
    ['cursor', 'Cursors', ['cursor', 'eraser']],
    ['lines', 'Trend line tools', ['trend', 'ray', 'info', 'extended', 'angle', 'hline', 'hray', 'vline', 'cross', 'channel', 'regression', 'flattop', 'disjoint']],
    ['forks', 'Pitchforks', ['pitchfork', 'schiff', 'mschiff', 'insidefork', 'pitchfan']],
    ['fib', 'Fibonacci and Gann', ['fib', 'fibext', 'fibchannel', 'fibtime', 'fibfan', 'fibcircle', 'fibarc', 'fibwedge', 'gannbox', 'gannsquare', 'gannfan']],
    ['patterns', 'Patterns and cycles', ['xabcd', 'cypher', 'abcd', 'hs', 'trianglepat', 'threedrives', 'elliott', 'elliottabc', 'elliotttri', 'elliottwxy', 'cyclic', 'timecycle', 'sine']],
    ['forecast', 'Forecasting and measurement', ['long', 'short', 'forecast', 'daterange', 'pricerange', 'measure', 'avwap', 'fixedvp', 'barspattern', 'projection']],
    ['shapes', 'Geometric shapes and brushes', ['brush', 'highlighter', 'arrow', 'arrowup', 'arrowdown', 'rect', 'rotrect', 'circle', 'ellipse', 'triangle', 'path', 'polyline', 'arc', 'curve', 'dcurve']],
    ['text', 'Annotation', ['text', 'note', 'callout', 'comment', 'pricelabel', 'pricenote', 'signpost', 'flag']],
    ['icons', 'Icons', ICONS.map(i => 'icon:' + i)]
  ];
  const label = id => id.startsWith('icon:') ? 'Icon ' + id.slice(5) : (T[id] || {}).l || id;
  const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], FIBX = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618], FIBT = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
  const GANN = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1], GFAN = [[1, 8], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [8, 1]];
  const PCOL = ['#ff433d', '#ff9e1b', '#ffd400', '#00d26a', '#00e5ff', '#4aa8ff', '#c586ff', '#ff5fd2', '#ffffff', '#a0ff5f', '#ff8a3d', '#26c6da'];
  const G = { hidden: false, magnet: false, stay: false, style: { color: '#ff9e1b', width: 2 } };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = v => JSON.parse(JSON.stringify(v, (k, x) => k.startsWith('_') ? undefined : x));
  const npts = t => t && t.startsWith('icon:') ? 1 : (T[t] || {}).n;
  function create() {
  let chart, series, box, cv, ctx, getBars = () => [], onSave = () => {}, onTool = () => {}, onSelect = () => {};
  let list = [], sel = null, tool = 'cursor', pending = null, drag = null, undoStack = [], alive = true;
  const style = G.style;

  // ---- coordinates: time <-> fractional bar index <-> x ----
  function lmap() { const ts = chart.timeScale(), a = ts.logicalToCoordinate(0), b = ts.logicalToCoordinate(1); return a == null || b == null || a === b ? null : { a, s: b - a }; }
  function tToL(t) {
    const B = getBars(), n = B.length; if (!n) return null; if (n === 1) return 0;
    if (t <= B[0].time) return (t - B[0].time) / (B[1].time - B[0].time);
    if (t >= B[n - 1].time) return n - 1 + (t - B[n - 1].time) / (B[n - 1].time - B[n - 2].time);
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m].time <= t) lo = m; else hi = m; }
    return lo + (t - B[lo].time) / (B[hi].time - B[lo].time);
  }
  function lToT(l) {
    const B = getBars(), n = B.length; if (!n) return null; if (n === 1) return B[0].time;
    if (l <= 0) return B[0].time + l * (B[1].time - B[0].time);
    if (l >= n - 1) return B[n - 1].time + (l - n + 1) * (B[n - 1].time - B[n - 2].time);
    const i = Math.floor(l); return B[i].time + (l - i) * (B[i + 1].time - B[i].time);
  }
  function toXY(pt) { const m = lmap(), l = tToL(pt.t), y = series.priceToCoordinate(pt.p); return !m || l == null || y == null ? null : { x: m.a + m.s * l, y }; }
  const xOfL = l => { const m = lmap(); return m ? m.a + m.s * l : null; };
  const yOf = p => series.priceToCoordinate(p);
  function fromXY(x, y, snap) {
    const m = lmap(); if (!m) return null; const l = (x - m.a) / m.s; let p = series.coordinateToPrice(y), t = lToT(l); if (p == null || t == null) return null;
    if (snap && G.magnet) {
      const B = getBars(), b = B[Math.round(l)];
      if (b) { let best = null, bd = 16; for (const v of [b.open, b.high, b.low, b.close]) { const yy = yOf(v); if (yy != null && Math.abs(yy - y) < bd) { bd = Math.abs(yy - y); best = v; } } if (best != null) { p = best; t = b.time; } }
    }
    return { t, p };
  }
  const paneSize = () => { const p = chart.panes ? chart.panes()[0] : null;    // drawings live in the price pane only
    return { w: box.clientWidth - chart.priceScale('right').width(), h: p ? p.getHeight() : box.clientHeight - chart.timeScale().height() }; };
  const fmt = p => Math.abs(p) >= 1000 ? p.toFixed(1) : Math.abs(p) >= 1 ? p.toFixed(2) : p.toFixed(4);
  const pct = (a, b) => (b / a - 1) * 100;
  const sg = v => (v >= 0 ? '+' : '') ;
  const barIdx = t => { const n = getBars().length, l = tToL(t); return l == null ? null : Math.max(0, Math.min(n - 1, Math.round(l))); };

  // ---- rendering helpers (every stroke also records hit segments in g.segs) ----
  let g = null, W = 0, H = 0;
  function alpha(c, a) { const h = String(c).replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h.slice(0, 6), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function seg(a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); g.segs.push([a, b]); }
  function poly(P, close, noHit) { if (P.length < 2) return; ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y); if (close) ctx.closePath(); ctx.stroke();
    if (!noHit) { for (let i = 1; i < P.length; i++) g.segs.push([P[i - 1], P[i]]); if (close) g.segs.push([P[P.length - 1], P[0]]); } }
  function fill(P, col) { if (P.length < 3) return; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); P.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); }
  function extend(a, b, both) { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, k = 1e4 / L; return [both ? { x: a.x - dx * k, y: a.y - dy * k } : a, { x: b.x + dx * k, y: b.y + dy * k }]; }
  function tag(x, y, text, bg, fg, align, font) {
    ctx.font = font || '11px Consolas, monospace'; const lines = String(text).split('\n'), w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 8, h = lines.length * 14 + 2, X = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, Y = y - h / 2;
    ctx.fillStyle = bg; ctx.fillRect(X, Y, w, h); ctx.fillStyle = fg; ctx.textBaseline = 'middle'; lines.forEach((s, i) => ctx.fillText(s, X + 4, Y + 8 + i * 14)); const r = { x: X, y: Y, w, h }; g.rects.push(r); return r;
  }
  function label(x, y, s, col, base) { ctx.font = '11px Consolas, monospace'; ctx.fillStyle = col; ctx.textBaseline = base || 'bottom'; ctx.fillText(s, x, y); }
  function ellipse(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, hitIt = true) {
    rx = Math.abs(rx); ry = Math.abs(ry); ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, a0, a1); ctx.stroke();
    if (hitIt) { const N = 48, pts = []; for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * i / N; pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); } for (let i = 1; i < pts.length; i++) g.segs.push([pts[i - 1], pts[i]]); }
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function bez(a, c, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); ctx.stroke(); let p = a; for (let i = 1; i <= 24; i++) { const t = i / 24, q = { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y }; g.segs.push([p, q]); p = q; } }
  function arrowHead(a, b, L, col) { const ang = Math.atan2(b.y - a.y, b.x - a.x); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - L * Math.cos(ang - 0.45), b.y - L * Math.sin(ang - 0.45)); ctx.lineTo(b.x - L * Math.cos(ang + 0.45), b.y - L * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }
  function pattern(P, names, d, extra) {   // harmonic / wave patterns: legs, labels, optional ratio lines
    if (extra && extra.fills) extra.fills.forEach(ix => fill(ix.map(i => P[i]).filter(Boolean), alpha(d.color, 0.1)));
    poly(P); P.forEach((p, i) => { if (!names[i]) return; const up = i > 0 && P[i - 1] && p.y < P[i - 1].y || i === 0 && P[1] && p.y < P[1].y; tag(p.x, p.y + (up ? -13 : 13), names[i], alpha(d.color, 0.9), '#000', 'center'); });
    if (extra && extra.ratios) { ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; extra.ratios.forEach(([i, j, k, l]) => { if (!P[i] || !P[j]) return; seg(P[i], P[j]); const pts = d.pts, r = Math.abs((pts[l].p - pts[k].p) / ((pts[k].p - pts[i].p) || 1));
      if (P[k] && P[l] && Number.isFinite(r)) label((P[i].x + P[j].x) / 2 + 3, (P[i].y + P[j].y) / 2, r.toFixed(3), d.color); }); ctx.restore(); }
  }
  // the bars between two times, for tools that read prices (regression, VWAP, volume profile, outcome of a position)
  function range(t0, t1) { const B = getBars(); let i = barIdx(Math.min(t0, t1)), j = barIdx(Math.max(t0, t1)); return i == null ? { B, i: 0, j: -1 } : { B, i, j }; }

  function drawOne(d) {
    const P = d.pts.map(toXY); g = d._g = { segs: [], rects: [], P };
    if (P.some(p => !p)) return;
    ctx.strokeStyle = d.color; ctx.lineWidth = d.width; ctx.setLineDash(d.dash ? [6, 4] : []); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const [a, b, c] = P, col = d.color, ty = d.type;
    switch (ty) {
      case 'trend': seg(a, b); break;
      case 'ray': { const [, e] = extend(a, b); seg(a, e); break; }
      case 'extended': { const [s, e] = extend(a, b, true); seg(s, e); break; }
      case 'info': case 'angle': { seg(a, b); const p0 = d.pts[0].p, p1 = d.pts[1].p, nb = Math.round(tToL(d.pts[1].t) - tToL(d.pts[0].t)), deg = Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI;
        if (ty === 'angle') { ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; seg(a, { x: a.x + 40, y: a.y }); ctx.beginPath(); ctx.arc(a.x, a.y, 28, 0, -deg * Math.PI / 180, deg > 0); ctx.stroke(); ctx.restore(); label(a.x + 32, a.y - 4, deg.toFixed(1) + '°', col); }
        else tag(b.x + 6, b.y, `${sg(p1 - p0)}${fmt(p1 - p0)} (${sg(p1 - p0)}${pct(p0, p1).toFixed(2)}%)\n${nb} bars · ${deg.toFixed(1)}°`, alpha('#000000', 0.8), col);
        break; }
      case 'hline': seg({ x: 0, y: a.y }, { x: W, y: a.y }); tag(W - 2, a.y, fmt(d.pts[0].p), col, '#000', 'right'); break;
      case 'hray': seg(a, { x: W, y: a.y }); tag(W - 2, a.y, fmt(d.pts[0].p), col, '#000', 'right'); break;
      case 'vline': seg({ x: a.x, y: 0 }, { x: a.x, y: H }); break;
      case 'cross': seg({ x: 0, y: a.y }, { x: W, y: a.y }); seg({ x: a.x, y: 0 }, { x: a.x, y: H }); tag(W - 2, a.y, fmt(d.pts[0].p), col, '#000', 'right'); break;
      case 'arrow': seg(a, b); arrowHead(a, b, 8 + d.width * 2, col); break;
      case 'channel': {
        seg(a, b); if (!c) break;
        const yAt = a.x === b.x ? a.y : a.y + (c.x - a.x) * (b.y - a.y) / (b.x - a.x), dy = c.y - yAt, a2 = { x: a.x, y: a.y + dy }, b2 = { x: b.x, y: b.y + dy };
        seg(a2, b2); ctx.setLineDash([4, 4]); seg({ x: a.x, y: a.y + dy / 2 }, { x: b.x, y: b.y + dy / 2 }); ctx.setLineDash([]);
        fill([a, b, b2, a2], alpha(col, 0.08)); g.P = [a, b, mid(a2, b2)]; break;
      }
      case 'disjoint': { seg(a, b); const c2 = { x: b.x, y: b.y + (c.y - a.y) }; seg(c, c2); fill([a, b, c2, c], alpha(col, 0.08)); break; }
      case 'flattop': { seg(a, b); seg({ x: a.x, y: c.y }, { x: b.x, y: c.y }); fill([a, b, { x: b.x, y: c.y }, { x: a.x, y: c.y }], alpha(col, 0.08)); g.P = [a, b, { x: (a.x + b.x) / 2, y: c.y }]; break; }
      case 'regression': {
        const { B, i, j } = range(d.pts[0].t, d.pts[1].t); if (j - i < 2) { seg(a, b); break; }
        const n = j - i + 1, xs = [], ys = []; for (let k = i; k <= j; k++) { xs.push(k); ys.push(B[k].close); }
        const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0; xs.forEach((x, k) => { sxy += (x - mx) * (ys[k] - my); sxx += (x - mx) ** 2; });
        const sl = sxy / (sxx || 1), ic = my - sl * mx, sd = Math.sqrt(ys.reduce((s, v, k) => s + (v - (ic + sl * xs[k])) ** 2, 0) / n);
        const L = (k, off) => ({ x: xOfL(k), y: yOf(ic + sl * k + off) }), up = [L(i, 2 * sd), L(j, 2 * sd)], dn = [L(i, -2 * sd), L(j, -2 * sd)];
        if ([...up, ...dn].some(p => p.y == null)) break;
        fill([up[0], up[1], dn[1], dn[0]], alpha(col, 0.08)); seg(L(i, 0), L(j, 0)); ctx.setLineDash([5, 4]); seg(up[0], up[1]); seg(dn[0], dn[1]); ctx.setLineDash([]);
        g.P = [L(i, 0), L(j, 0)]; break;
      }
      case 'pitchfork': case 'schiff': case 'mschiff': case 'insidefork': {
        const m = mid(b, c), o = ty === 'schiff' ? { x: a.x, y: (a.y + b.y) / 2 } : ty === 'mschiff' ? mid(a, b) : a, dx = m.x - o.x, dy = m.y - o.y, far = k => ({ x: k.x + dx * 50, y: k.y + dy * 50 });
        if (ty !== 'pitchfork' && ty !== 'insidefork') { ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; seg(a, o); ctx.restore(); }
        seg(b, c); seg(o, far(m)); seg(b, far(b)); seg(c, far(c));
        fill([b, far(b), far(c), c], alpha(col, 0.06));
        if (ty === 'insidefork') { ctx.save(); ctx.setLineDash([4, 4]); [0.25, 0.75].forEach(f => { const p = { x: b.x + (c.x - b.x) * f, y: b.y + (c.y - b.y) * f }; seg(p, far(p)); }); ctx.restore(); }
        else { ctx.save(); ctx.globalAlpha = 0.6; ctx.lineWidth = 1; [-0.5, 1.5].forEach(f => { const p = { x: b.x + (c.x - b.x) * f, y: b.y + (c.y - b.y) * f }; seg(p, far(p)); }); ctx.restore(); }
        break;
      }
      case 'pitchfan': { seg(b, c); [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1].forEach((f, k) => { const p = { x: b.x + (c.x - b.x) * f, y: b.y + (c.y - b.y) * f }, [, e] = extend(a, p); ctx.strokeStyle = PCOL[k % PCOL.length]; ctx.lineWidth = 1; seg(a, e); }); break; }
      case 'fib': {
        const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), p0 = d.pts[0].p, p1 = d.pts[1].p; let prev = null;
        ctx.strokeStyle = alpha(col, 0.5); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); seg(a, b); ctx.setLineDash([]);
        FIB.forEach((lv, i) => {
          const pr = p1 + (p0 - p1) * lv, y = yOf(pr); if (y == null) return;
          if (prev != null) { ctx.fillStyle = alpha(PCOL[i % PCOL.length], 0.1); ctx.fillRect(x1, Math.min(prev, y), x2 - x1, Math.abs(y - prev)); }
          ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = d.width > 1 ? d.width - 1 : 1; seg({ x: x1, y }, { x: x2, y });
          label(x1 + 3, y - 1, lv + ' (' + fmt(pr) + ')', PCOL[i % PCOL.length]); prev = y;
        });
        g.rects.push({ x: x1, y: Math.min(a.y, b.y), w: x2 - x1, h: Math.abs(a.y - b.y) }); break;
      }
      case 'fibext': {
        ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; poly([a, b, c]); ctx.restore();
        const dp = d.pts[1].p - d.pts[0].p, x2 = c.x + Math.max(80, Math.abs(b.x - a.x));
        FIBX.forEach((lv, i) => { const pr = d.pts[2].p + dp * lv, y = yOf(pr); if (y == null) return; ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; seg({ x: c.x, y }, { x: x2, y }); label(c.x + 3, y - 1, lv + ' (' + fmt(pr) + ')', PCOL[i % PCOL.length]); });
        break;
      }
      case 'fibchannel': {
        const yAt = a.x === b.x ? a.y : a.y + (c.x - a.x) * (b.y - a.y) / (b.x - a.x), dy = c.y - yAt;
        FIBX.slice(0, 9).forEach((lv, i) => { const s = { x: a.x, y: a.y + dy * lv }, e = { x: b.x, y: b.y + dy * lv }, [, ee] = extend(s, e); ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; seg(s, ee); label(s.x - 30, s.y, String(lv), PCOL[i % PCOL.length], 'middle'); });
        g.P = [a, b, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + dy }]; break;
      }
      case 'fibtime': { const u = b.x - a.x; FIBT.forEach((k, i) => { const x = a.x + u * k; if (x > W + 5 || x < -5) return; ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; seg({ x, y: 0 }, { x, y: H }); label(x + 3, H - 4, String(k), PCOL[i % PCOL.length]); }); break; }
      case 'fibfan': {
        const dx = b.x - a.x, dy = b.y - a.y; ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(dx), Math.abs(dy)); ctx.restore();
        [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1].forEach((lv, i) => { ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; const p = { x: b.x, y: b.y - dy * lv }, [, e] = extend(a, p); seg(a, e); label(b.x + 3, p.y, String(lv), PCOL[i % PCOL.length], 'middle');
          const q = { x: b.x - dx * lv, y: b.y }; if (lv > 0 && lv < 1) { const [, e2] = extend(a, q); seg(a, e2); } });
        break;
      }
      case 'fibcircle': { const r = Math.hypot(b.x - a.x, b.y - a.y); ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; seg(a, b); ctx.restore(); [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618].forEach((lv, i) => { ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; ellipse(a.x, a.y, r * lv, r * lv); }); break; }
      case 'fibarc': { const r = Math.hypot(b.x - a.x, b.y - a.y), up = a.y > b.y; ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; seg(a, b); ctx.restore();
        [0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach((lv, i) => { ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; ellipse(b.x, b.y, r * lv, r * lv, up ? 0 : Math.PI, up ? Math.PI : Math.PI * 2); label(b.x + 3, b.y + (up ? r * lv : -r * lv), String(lv), PCOL[i % PCOL.length], 'middle'); }); break; }
      case 'fibwedge': { seg(a, b); seg(a, c); const r1 = Math.hypot(b.x - a.x, b.y - a.y), a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - a.y, c.x - a.x);
        FIB.slice(1).forEach((lv, i) => { ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a.x, a.y, r1 * lv, a1, a2, a2 < a1); ctx.stroke(); label(a.x + r1 * lv * Math.cos(a1) + 3, a.y + r1 * lv * Math.sin(a1), String(lv), PCOL[i % PCOL.length], 'middle'); }); break; }
      case 'gannbox': case 'gannsquare': {
        let x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y); if (ty === 'gannsquare') { h = w * Math.sign(b.y - a.y || 1); y1 = Math.min(a.y, a.y + h); h = Math.abs(h); }
        ctx.fillStyle = alpha(col, 0.06); ctx.fillRect(x1, y1, w, h); ctx.lineWidth = 1;
        GANN.forEach((lv, i) => { ctx.strokeStyle = PCOL[i % PCOL.length]; seg({ x: x1 + w * lv, y: y1 }, { x: x1 + w * lv, y: y1 + h }); seg({ x: x1, y: y1 + h * lv }, { x: x1 + w, y: y1 + h * lv }); label(x1 + w * lv + 2, y1 - 2, String(lv), PCOL[i % PCOL.length]); label(x1 - 34, y1 + h * lv, String(lv), PCOL[i % PCOL.length], 'middle'); });
        if (ty === 'gannsquare') { ctx.strokeStyle = col; seg({ x: x1, y: y1 }, { x: x1 + w, y: y1 + h }); seg({ x: x1, y: y1 + h }, { x: x1 + w, y: y1 }); }
        g.rects.push({ x: x1, y: y1, w, h }); break;
      }
      case 'gannfan': { const dx = b.x - a.x, dy = b.y - a.y; GFAN.forEach(([p, t], i) => { const r = p / t, e0 = { x: a.x + dx * Math.min(1, 1 / r), y: a.y + dy * Math.min(1, r) }, [, e] = extend(a, e0); ctx.strokeStyle = PCOL[i % PCOL.length]; ctx.lineWidth = 1; seg(a, e); label(e0.x + 3, e0.y, p + 'x' + t, PCOL[i % PCOL.length], 'middle'); }); break; }
      case 'xabcd': case 'cypher': pattern(P, ['X', 'A', 'B', 'C', 'D'], d, { fills: [[0, 1, 2], [2, 3, 4]], ratios: [[0, 2, 1, 2], [1, 3, 2, 3], [2, 4, 3, 4], [0, 4, 1, 4]] }); break;
      case 'abcd': pattern(P, ['A', 'B', 'C', 'D'], d, { ratios: [[0, 2, 1, 2], [1, 3, 2, 3]] }); break;
      case 'hs': { pattern(P, ['', 'Left shoulder', '', 'Head', '', 'Right shoulder', ''], d, { fills: [[1, 2, 4, 5]].map(x => x) });
        if (P[2] && P[4]) { const [s, e] = extend(P[2], P[4], true); ctx.save(); ctx.setLineDash([6, 4]); seg(s, e); ctx.restore(); label(P[4].x + 4, P[4].y + 14, 'Neckline', col); } break; }
      case 'trianglepat': { pattern(P, ['A', 'B', 'C', 'D'], d); if (P[3]) { ctx.save(); ctx.setLineDash([5, 4]); const [, e1] = extend(P[0], P[2]), [, e2] = extend(P[1], P[3]); seg(P[0], e1); seg(P[1], e2); ctx.restore(); } break; }
      case 'threedrives': pattern(P, ['', '1', '', '2', '', '3', ''], d, { ratios: [[2, 4, 3, 4], [4, 6, 5, 6]] }); break;
      case 'elliott': pattern(P, ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'], d); break;
      case 'elliottabc': pattern(P, ['(0)', '(A)', '(B)', '(C)'], d); break;
      case 'elliotttri': pattern(P, ['(0)', '(A)', '(B)', '(C)', '(D)', '(E)'], d); break;
      case 'elliottwxy': pattern(P, ['(0)', '(W)', '(X)', '(Y)'], d); break;
      case 'cyclic': { const u = Math.abs(b.x - a.x); if (u < 3) { seg(a, b); break; } for (let x = a.x, k = 0; x < W + u && k < 300; x += u, k++) seg({ x, y: 0 }, { x, y: H }); break; }
      case 'timecycle': { const u = Math.abs(b.x - a.x); if (u < 3) { seg(a, b); break; } for (let x = Math.min(a.x, b.x), k = 0; x < W && k < 200; x += u, k++) ellipse(x + u / 2, a.y, u / 2, u / 2, Math.PI, Math.PI * 2); break; }
      case 'sine': { const u = b.x - a.x, amp = (b.y - a.y) / 2, cy = (a.y + b.y) / 2; if (Math.abs(u) < 2) { seg(a, b); break; } const pts = []; for (let x = 0; x <= W; x += 3) pts.push({ x, y: cy - amp * Math.cos(Math.PI * (x - a.x) / u) }); poly(pts); break; }
      case 'long': case 'short': drawPosition(d, P); break;
      case 'forecast': { seg(a, b); arrowHead(a, b, 10, col); const p0 = d.pts[0].p, p1 = d.pts[1].p, nb = Math.round(tToL(d.pts[1].t) - tToL(d.pts[0].t));
        tag(b.x + 8, b.y, `Forecast ${fmt(p1)}\n${sg(p1 - p0)}${fmt(p1 - p0)} (${sg(p1 - p0)}${pct(p0, p1).toFixed(2)}%) in ${nb} bars`, alpha(p1 >= p0 ? '#00d26a' : '#ff433d', 0.9), '#000');
        const B = getBars(), last = B[B.length - 1]; if (last && last.time >= d.pts[1].t) { const ok = p1 >= p0 ? last.close >= p1 : last.close <= p1; tag(b.x + 8, b.y + 26, ok ? 'SUCCESS' : 'FAILED', ok ? '#00d26a' : '#ff433d', '#000'); } break; }
      case 'measure': case 'pricerange': case 'daterange': {
        const p0 = d.pts[0].p, p1 = d.pts[1].p, upc = ty === 'daterange' ? d.pts[1].t >= d.pts[0].t : p1 >= p0, cl = upc ? '#4aa8ff' : '#ff433d';
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        ctx.fillStyle = alpha(cl, 0.15); ctx.fillRect(x, y, w, h); ctx.strokeStyle = cl; ctx.lineWidth = 1;
        const { B, i, j } = range(d.pts[0].t, d.pts[1].t), nb = Math.round(tToL(d.pts[1].t) - tToL(d.pts[0].t)), vol = B.slice(i, j + 1).reduce((s, q) => s + (q.volume || 0), 0);
        const days = Math.abs(d.pts[1].t - d.pts[0].t) / 86400, span = days >= 1 ? days.toFixed(days < 10 ? 1 : 0) + 'd' : (days * 24).toFixed(1) + 'h';
        if (ty !== 'daterange') { seg({ x: cx, y: a.y }, { x: cx, y: b.y }); arrowHead({ x: cx, y: a.y }, { x: cx, y: b.y }, 7, cl); }
        if (ty !== 'pricerange') { seg({ x: a.x, y: cy }, { x: b.x, y: cy }); arrowHead({ x: a.x, y: cy }, { x: b.x, y: cy }, 7, cl); }
        const tx = ty === 'pricerange' ? `${sg(p1 - p0)}${fmt(p1 - p0)} (${sg(p1 - p0)}${pct(p0, p1).toFixed(2)}%)` : ty === 'daterange' ? `${nb} bars, ${span}\nVol ${vol >= 1e6 ? (vol / 1e6).toFixed(2) + 'M' : Math.round(vol)}` :
          `${sg(p1 - p0)}${fmt(p1 - p0)} (${sg(p1 - p0)}${pct(p0, p1).toFixed(2)}%)\n${nb} bars, ${span} · Vol ${vol >= 1e6 ? (vol / 1e6).toFixed(2) + 'M' : Math.round(vol)}`;
        tag(cx, upc ? y + h + 18 : y - 18, tx, cl, '#000', 'center'); g.rects.push({ x, y, w, h }); break;
      }
      case 'avwap': {
        const B = getBars(), i0 = barIdx(d.pts[0].t); if (i0 == null) break; let pv = 0, vv = 0; const pts = [];
        for (let k = i0; k < B.length; k++) { const q = B[k], tp = (q.high + q.low + q.close) / 3; pv += tp * (q.volume || 1); vv += q.volume || 1; const y = yOf(pv / vv); if (y != null) pts.push({ x: xOfL(k), y }); }
        poly(pts); if (pts.length) { const l = pts[pts.length - 1]; tag(l.x + 4, l.y, 'AVWAP ' + fmt(pv / vv), col, '#000'); } ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, 7); ctx.fillStyle = col; ctx.fill(); break;
      }
      case 'fixedvp': {
        const { B, i, j } = range(d.pts[0].t, d.pts[1].t); if (j <= i) { seg(a, b); break; }
        const bs = B.slice(i, j + 1), lo = Math.min(...bs.map(q => q.low)), hi = Math.max(...bs.map(q => q.high)), N = 24, step = (hi - lo) / N || 1, up = Array(N).fill(0), dn = Array(N).fill(0);
        bs.forEach(q => { const k0 = Math.min(N - 1, Math.floor((q.low - lo) / step)), k1 = Math.min(N - 1, Math.floor((q.high - lo) / step)), share = (q.volume || 0) / (k1 - k0 + 1); for (let k = k0; k <= k1; k++) (q.close >= q.open ? up : dn)[k] += share; });
        const tot = up.map((v, k) => v + dn[k]), mx = Math.max(...tot) || 1, poc = tot.indexOf(mx), x1 = xOfL(i), x2 = xOfL(j), wmax = (x2 - x1) * 0.7;
        let va = tot[poc], lo2 = poc, hi2 = poc; const sum = tot.reduce((s, v) => s + v, 0); while (va < sum * 0.7 && (lo2 > 0 || hi2 < N - 1)) { const dnv = lo2 > 0 ? tot[lo2 - 1] : -1, upv = hi2 < N - 1 ? tot[hi2 + 1] : -1; if (upv >= dnv) va += tot[++hi2]; else va += tot[--lo2]; }
        for (let k = 0; k < N; k++) { const y1 = yOf(lo + step * (k + 1)), y0 = yOf(lo + step * k); if (y1 == null || y0 == null) continue; const hh = Math.max(1, Math.abs(y0 - y1) - 1), wu = up[k] / mx * wmax, wd = dn[k] / mx * wmax, inVA = k >= lo2 && k <= hi2;
          ctx.fillStyle = alpha('#26a69a', inVA ? 0.55 : 0.25); ctx.fillRect(x1, y1, wu, hh); ctx.fillStyle = alpha('#ef5350', inVA ? 0.55 : 0.25); ctx.fillRect(x1 + wu, y1, wd, hh); }
        const yp = yOf(lo + step * (poc + 0.5)); ctx.strokeStyle = '#ff433d'; ctx.lineWidth = 2; if (yp != null) { seg({ x: x1, y: yp }, { x: x2, y: yp }); tag(x2 + 2, yp, 'POC ' + fmt(lo + step * (poc + 0.5)), '#ff433d', '#000'); }
        ctx.lineWidth = 1; ctx.strokeStyle = alpha(col, 0.6); ctx.setLineDash([4, 3]); [[hi2 + 1, 'VAH'], [lo2, 'VAL']].forEach(([k, s]) => { const y = yOf(lo + step * k); if (y != null) { seg({ x: x1, y }, { x: x2, y }); label(x2 + 2, y, s, col, 'middle'); } }); ctx.setLineDash([]);
        const yt = yOf(hi), yb = yOf(lo); ctx.strokeStyle = alpha(col, 0.4); ctx.strokeRect(x1, yt, x2 - x1, yb - yt); g.rects.push({ x: x1, y: yt, w: x2 - x1, h: yb - yt }); break;
      }
      case 'barspattern': {   // copies the bars between the two points and shows them again, starting at the second point's time is up to you: drag the copy
        const { B, i, j } = range(d.pts[0].t, d.pts[1].t); if (j <= i) break; const base = B[i].close, sh = d.pts[1].p - base, off = (tToL(d.pts[1].t) - i) + 1;
        ctx.lineWidth = 1; for (let k = i; k <= j; k++) { const q = B[k], x = xOfL(k + off), yh = yOf(q.high + sh), yl = yOf(q.low + sh), yo = yOf(q.open + sh), yc = yOf(q.close + sh); if ([yh, yl, yo, yc].some(v => v == null)) continue;
          ctx.strokeStyle = alpha(col, 0.8); ctx.beginPath(); ctx.moveTo(x, yh); ctx.lineTo(x, yl); ctx.moveTo(x - 2, yo); ctx.lineTo(x, yo); ctx.moveTo(x, yc); ctx.lineTo(x + 2, yc); ctx.stroke(); }
        ctx.save(); ctx.setLineDash([3, 3]); seg(a, b); ctx.restore(); g.rects.push({ x: xOfL(i + off) - 3, y: Math.min(yOf(B.slice(i, j + 1).reduce((m, q) => Math.max(m, q.high), -1e18) + sh) || 0, b.y), w: xOfL(j + off) - xOfL(i + off) + 6, h: 40 }); break;
      }
      case 'projection': { seg(a, b); const r = Math.hypot(b.x - a.x, b.y - a.y), a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - a.y, c.x - a.x); seg(a, c);
        ctx.fillStyle = alpha(col, 0.1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.arc(a.x, a.y, r, a1, a2, a2 < a1); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(a.x, a.y, r, a1, a2, a2 < a1); ctx.stroke();
        const dp = d.pts[2].p - d.pts[0].p; tag(c.x + 6, c.y, `${sg(dp)}${fmt(dp)} (${sg(dp)}${pct(d.pts[0].p, d.pts[2].p).toFixed(2)}%)`, alpha('#000000', 0.8), col); break; }
      case 'brush': case 'highlighter': { if (P.length < 2) break; if (ty === 'highlighter') { ctx.strokeStyle = alpha(col, 0.35); ctx.lineWidth = 10 + d.width * 2; } poly(P); break; }
      case 'arrowup': case 'arrowdown': { const up = ty === 'arrowup', s = 7 + d.width * 2, tip = { x: a.x, y: a.y }, dir = up ? 1 : -1, cl = up ? '#00d26a' : '#ff433d';
        const sh = [tip, { x: a.x + s, y: a.y + dir * s }, { x: a.x + s / 2.5, y: a.y + dir * s }, { x: a.x + s / 2.5, y: a.y + dir * s * 2.2 }, { x: a.x - s / 2.5, y: a.y + dir * s * 2.2 }, { x: a.x - s / 2.5, y: a.y + dir * s }, { x: a.x - s, y: a.y + dir * s }];
        fill(sh, d.color === G.style.color ? cl : col); g.rects.push({ x: a.x - s, y: Math.min(a.y, a.y + dir * s * 2.2), w: 2 * s, h: s * 2.2 }); if (d.text) label(a.x - ctx.measureText(d.text).width / 2, a.y + dir * (s * 2.2 + 12), d.text, col, 'middle'); break; }
      case 'rect': { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
        ctx.fillStyle = alpha(col, 0.12); ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); g.rects.push({ x, y, w, h }); g.P = [a, b]; break; }
      case 'rotrect': { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, dist = (c.x - a.x) * nx + (c.y - a.y) * ny, a2 = { x: a.x + nx * dist, y: a.y + ny * dist }, b2 = { x: b.x + nx * dist, y: b.y + ny * dist };
        fill([a, b, b2, a2], alpha(col, 0.12)); poly([a, b, b2, a2], true); g.P = [a, b, mid(a2, b2)]; break; }
      case 'circle': { const r = Math.hypot(b.x - a.x, b.y - a.y); ctx.fillStyle = alpha(col, 0.1); ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, 7); ctx.fill(); ellipse(a.x, a.y, r, r); break; }
      case 'ellipse': { const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2; ctx.fillStyle = alpha(col, 0.1); ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, 7); ctx.fill(); ellipse(cx, cy, rx, ry); break; }
      case 'triangle': fill([a, b, c], alpha(col, 0.12)); poly([a, b, c], true); break;
      case 'path': poly(P); if (P.length > 1) arrowHead(P[P.length - 2], P[P.length - 1], 8 + d.width * 2, col); break;
      case 'polyline': fill(P, alpha(col, 0.1)); poly(P, P.length > 2 && !(pending && pending.d === d)); break;
      case 'arc': case 'curve': { const cp = ty === 'arc' ? { x: 2 * b.x - (a.x + c.x) / 2, y: 2 * b.y - (a.y + c.y) / 2 } : b; if (ty === 'arc') { ctx.fillStyle = alpha(col, 0.08); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cp.x, cp.y, c.x, c.y); ctx.closePath(); ctx.fill(); } bez(a, cp, c); break; }
      case 'dcurve': { const m = mid(a, c), c1 = { x: (a.x + m.x) / 2 + (b.x - m.x), y: (a.y + m.y) / 2 + (b.y - m.y) }, c2 = { x: (m.x + c.x) / 2 - (b.x - m.x), y: (m.y + c.y) / 2 - (b.y - m.y) }; bez(a, c1, m); bez(m, c2, c); break; }
      case 'text': { ctx.font = `${10 + d.width * 2}px Consolas, monospace`; const t = d.text || 'Text', w = ctx.measureText(t).width + 10, h = 14 + d.width * 2;
        ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(a.x, a.y - h, w, h); ctx.strokeStyle = alpha(col, 0.8); ctx.lineWidth = 1; ctx.strokeRect(a.x, a.y - h, w, h);
        ctx.fillStyle = col; ctx.textBaseline = 'middle'; ctx.fillText(t, a.x + 5, a.y - h / 2); g.rects.push({ x: a.x, y: a.y - h, w, h }); break; }
      case 'note': case 'comment': { ctx.fillStyle = col; ctx.beginPath(); if (ty === 'note') { ctx.arc(a.x, a.y - 12, 6, 0, 7); ctx.fill(); ctx.fillRect(a.x - 1, a.y - 8, 2, 8); } else { ctx.fillRect(a.x - 8, a.y - 20, 16, 12); ctx.beginPath(); ctx.moveTo(a.x - 3, a.y - 8); ctx.lineTo(a.x, a.y); ctx.lineTo(a.x + 3, a.y - 8); ctx.fill(); }
        g.rects.push({ x: a.x - 8, y: a.y - 20, w: 16, h: 20 }); if (d.text) tag(a.x + 10, a.y - 22, d.text, 'rgba(0,0,0,.85)', col); break; }
      case 'callout': { const t = d.text || 'Callout', r = tag(b.x, b.y, t, alpha(col, 0.9), '#000', 'center', `${11 + d.width}px Consolas, monospace`); ctx.strokeStyle = col; ctx.lineWidth = 1; seg(a, { x: Math.max(r.x, Math.min(a.x, r.x + r.w)), y: a.y < r.y ? r.y : r.y + r.h }); ctx.beginPath(); ctx.arc(a.x, a.y, 2.5, 0, 7); ctx.fillStyle = col; ctx.fill(); break; }
      case 'pricelabel': { const r = tag(a.x + 8, a.y - 16, fmt(d.pts[0].p), col, '#000'); ctx.strokeStyle = col; ctx.lineWidth = 1; seg(a, { x: r.x, y: r.y + r.h }); break; }
      case 'pricenote': { seg(a, b); ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, 7); ctx.fillStyle = col; ctx.fill(); tag(b.x + 4, b.y, fmt(d.pts[0].p), col, '#000'); break; }
      case 'signpost': { const top = { x: a.x, y: a.y - 40 }; seg(a, top); tag(top.x, top.y - 9, d.text || 'Signpost', col, '#000', 'center'); break; }
      case 'flag': { ctx.fillStyle = col; ctx.fillRect(a.x - 1, a.y - 22, 2, 22); ctx.beginPath(); ctx.moveTo(a.x + 1, a.y - 22); ctx.lineTo(a.x + 15, a.y - 17); ctx.lineTo(a.x + 1, a.y - 12); ctx.closePath(); ctx.fill(); g.rects.push({ x: a.x - 2, y: a.y - 22, w: 17, h: 22 }); break; }
      case 'icon': { const s = 14 + d.width * 4; ctx.font = `${s}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`; ctx.fillStyle = col; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(d.text || '★', a.x, a.y); ctx.textAlign = 'left'; g.rects.push({ x: a.x - s / 2, y: a.y - s / 2, w: s, h: s }); break; }
    }
    if (d === sel) {
      const hs = ty === 'brush' || ty === 'highlighter' ? [g.P[0], g.P[g.P.length - 1]] : g.P;
      hs.forEach(p => { if (!p) return; ctx.setLineDash([]); ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.fillRect(p.x - 4, p.y - 4, 8, 8); ctx.strokeRect(p.x - 4, p.y - 4, 8, 8); });
    }
  }
  // Long / Short position: pts[0] = entry, pts[1] = target (its time is the right edge), pts[2] = stop. Annotation only.
  function drawPosition(d, P) {
    const [e, t, s] = P, long = d.type === 'long', en = d.pts[0].p, tp = d.pts[1].p, sp = d.pts[2].p, x1 = e.x, x2 = Math.max(t.x, e.x + 10), w = x2 - x1;
    ctx.fillStyle = 'rgba(0,210,106,0.18)'; ctx.fillRect(x1, Math.min(e.y, t.y), w, Math.abs(t.y - e.y));
    ctx.fillStyle = 'rgba(255,67,61,0.18)'; ctx.fillRect(x1, Math.min(e.y, s.y), w, Math.abs(s.y - e.y));
    ctx.setLineDash([]); ctx.lineWidth = 1; ctx.strokeStyle = '#888'; seg({ x: x1, y: e.y }, { x: x2, y: e.y });
    g.rects.push({ x: x1, y: Math.min(t.y, s.y), w, h: Math.abs(t.y - s.y) });
    const risk = Math.abs(en - sp), reward = Math.abs(tp - en), rr = risk ? reward / risk : 0, acct = +d.acct || 10000, rp = +d.risk || 1, qty = risk ? Math.floor(acct * rp / 100 / risk) : 0;
    const tTxt = `Target: ${fmt(tp)} (${sg(tp - en)}${fmt(tp - en)}, ${sg(tp - en)}${pct(en, tp).toFixed(2)}%) ${qty ? 'P&L ' + sg((tp - en) * (long ? 1 : -1)) + fmt(Math.abs(tp - en) * qty) : ''}`;
    const sTxt = `Stop: ${fmt(sp)} (${sg(sp - en)}${fmt(sp - en)}, ${sg(sp - en)}${pct(en, sp).toFixed(2)}%) ${qty ? 'P&L -' + fmt(risk * qty) : ''}`;
    tag((x1 + x2) / 2, t.y + (t.y < e.y ? -10 : 10), tTxt, 'rgba(0,150,80,.95)', '#fff', 'center');
    tag((x1 + x2) / 2, s.y + (s.y > e.y ? 10 : -10), sTxt, 'rgba(200,40,40,.95)', '#fff', 'center');
    tag((x1 + x2) / 2, e.y, `${long ? 'LONG' : 'SHORT'} ${fmt(en)} · Qty ${qty} · R:R ${rr.toFixed(2)}`, 'rgba(20,20,20,.9)', '#ddd', 'center');
    // what happened after the entry bar (first touch of target or stop), shown like TradingView's closed P&L
    const { B, i, j } = range(d.pts[0].t, d.pts[1].t); let out = null;
    for (let k = i + 1; k <= j && k < B.length; k++) { const q = B[k], hitT = long ? q.high >= tp : q.low <= tp, hitS = long ? q.low <= sp : q.high >= sp; if (hitS) { out = { k, p: sp, ok: false }; break; } if (hitT) { out = { k, p: tp, ok: true }; break; } }
    const lastK = Math.min(j, B.length - 1);
    if (!out && lastK > i && B[lastK]) out = { k: lastK, p: B[lastK].close, open: true };
    if (out) { const y = yOf(out.p), x = xOfL(out.k); if (y != null && x != null) {
      const pl = (out.p - en) * (long ? 1 : -1); ctx.fillStyle = pl >= 0 ? 'rgba(0,210,106,0.18)' : 'rgba(255,67,61,0.18)'; ctx.fillRect(x1, Math.min(e.y, y), x - x1, Math.abs(y - e.y));
      ctx.strokeStyle = '#ccc'; ctx.setLineDash([4, 3]); seg(e, { x, y }); ctx.setLineDash([]);
      tag(x + 4, y + (pl >= 0 === (y < e.y) ? -10 : 10), `${out.open ? 'Open' : out.ok ? 'Target hit' : 'Stop hit'} ${sg(pl)}${pct(en, en + pl).toFixed(2)}%`, out.open ? '#555' : out.ok ? '#00a050' : '#c82828', '#fff'); } }
    g.P = [e, { x: x2, y: t.y }, { x: x2, y: s.y }];
  }
  function render() {
    const dpr = window.devicePixelRatio || 1, BW = box.clientWidth, BH = box.clientHeight;
    if (cv.width !== Math.round(BW * dpr) || cv.height !== Math.round(BH * dpr)) { cv.width = Math.round(BW * dpr); cv.height = Math.round(BH * dpr); cv.style.width = BW + 'px'; cv.style.height = BH + 'px'; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, BW, BH);
    if (!getBars().length) return;
    const ps = paneSize(); W = ps.w; H = ps.h; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, ps.w, ps.h); ctx.clip();
    if (!G.hidden) list.forEach(d => { if (!d.hide) { ctx.save(); try { drawOne(d); } catch (e) { d._g = null; } ctx.restore(); } });
    if (pending) { ctx.save(); try { drawOne(pending.d); } catch (e) {} ctx.restore(); }
    ctx.restore();
  }
  function loop() { if (!alive) return; if (box && box.offsetParent) render(); requestAnimationFrame(loop); }

  // ---- hit testing ----
  function distSeg(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy; let t = L ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
  function hit(x, y) {
    if (G.hidden) return null; const p = { x, y };
    if (sel && sel._g && !sel.lock) { const hs = sel.type === 'brush' || sel.type === 'highlighter' ? [] : sel._g.P; for (let i = 0; i < hs.length; i++) if (hs[i] && Math.hypot(hs[i].x - x, hs[i].y - y) < 7) return { d: sel, handle: i }; }
    for (let k = list.length - 1; k >= 0; k--) {
      const d = list[k], gg = d._g; if (!gg || d.hide) continue;
      if (gg.segs.some(([a, b]) => distSeg(p, a, b) < 5 + d.width / 2)) return { d, handle: -1 };
      if (gg.rects.some(r => x >= r.x - 3 && x <= r.x + r.w + 3 && y >= r.y - 3 && y <= r.y + r.h + 3)) return { d, handle: -1 };
    }
    return null;
  }

  // ---- editing ----
  function snapshot() { undoStack.push(clone(list)); if (undoStack.length > 60) undoStack.shift(); }
  function changed() { onSave(clone(list)); onSelect(sel); }
  function select(d) { sel = d; onSelect(sel); }
  function setTool(t) {
    if (pending) pending = null; tool = t === 'eraser' || t === 'cursor' || npts(t) != null ? t : 'cursor';
    cv.style.pointerEvents = tool === 'cursor' ? 'none' : 'auto'; cv.style.cursor = tool === 'cursor' ? 'default' : tool === 'eraser' ? 'not-allowed' : 'crosshair'; onTool(tool);
  }
  function newDrawing(pt) {
    const type = tool.startsWith('icon:') ? 'icon' : tool, d = { id: uid(), type, pts: [pt], color: style.color, width: style.width };
    if (type === 'icon') d.text = tool.slice(5);
    if (type === 'long' || type === 'short') {   // default size: stop 1.5 x average bar range away, target at 2R, 20 bars wide
      const B = getBars(), last = B.slice(-14), rng = last.reduce((s, q) => s + q.high - q.low, 0) / (last.length || 1) || pt.p * 0.01, r = rng * 1.5, dir = type === 'long' ? 1 : -1;
      const l = tToL(pt.t), t2 = lToT(l + 20); d.pts = [pt, { t: t2, p: pt.p + dir * 2 * r }, { t: t2, p: pt.p - dir * r }]; d.acct = 10000; d.risk = 1;
    }
    return d;
  }
  function finish() {
    const d = pending.d; pending = null; snapshot(); list.push(d); select(d); changed();
    if (!G.stay) setTool('cursor');
    if (T[d.type] && T[d.type].txt) editText(d);
  }
  function editText(d) {
    const p = toXY(d.pts[d.type === 'callout' ? 1 : 0]); if (!p) return;
    const inp = document.createElement('input'); inp.className = 'txtEdit'; inp.value = d.text || ''; inp.placeholder = 'Text, then Enter';
    inp.style.left = p.x + 'px'; inp.style.top = (p.y - 24) + 'px'; box.appendChild(inp); inp.focus(); inp.select();
    let done = false; const commit = ok => { if (done) return; done = true; inp.remove();
      if (ok && inp.value.trim()) { snapshot(); d.text = inp.value.trim().slice(0, 300); changed(); }
      else if (!d.text && (d.type === 'text')) { list = list.filter(x => x !== d); select(null); changed(); } };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') commit(true); if (e.key === 'Escape') commit(false); };
    inp.onblur = () => commit(true);
  }
  function local(e) { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function constrain(d, handle) {   // keep linked points together while a handle is dragged
    if ((d.type === 'long' || d.type === 'short') && (handle === 1 || handle === 2)) { const t = d.pts[handle].t; d.pts[1].t = d.pts[2].t = Math.max(t, d.pts[0].t); }
    if ((d.type === 'long' || d.type === 'short') && handle === 0) { d.pts[1].t = d.pts[2].t = Math.max(d.pts[1].t, d.pts[0].t); }
    if (d.type === 'avwap') { const B = getBars(), i = barIdx(d.pts[0].t); if (B[i]) d.pts[0].t = B[i].time; }
  }

  function onDown(e) {
    if (e.button !== 0) return; const { x, y } = local(e); e.preventDefault(); e.stopPropagation();
    if (tool === 'eraser') { const h = hit(x, y); if (h) { snapshot(); list = list.filter(q => q !== h.d); if (sel === h.d) select(null); changed(); } return; }
    if (tool !== 'cursor') {
      if (y > paneSize().h) return;
      const pt = fromXY(x, y, true); if (!pt) return; const n = npts(tool);
      if (!pending) {
        const d = newDrawing(pt);
        if (n === 1) { pending = { d }; finish(); return; }
        if (n === 0) { pending = { d, brush: true }; return; }
        d.pts.push({ ...pt }); pending = { d, idx: 1, down: { x, y }, open: n === -1 };
      } else {
        pending.d.pts[pending.idx] = pt;
        if (pending.open || pending.idx + 1 < n) { pending.d.pts.push({ ...pt }); pending.idx++; pending.down = { x, y }; } else finish();
      }
      return;
    }
    const h = hit(x, y); if (!h) { select(null); return; }
    select(h.d); if (h.d.lock) return; snapshot();
    drag = { d: h.d, handle: h.handle, x, y, xy: h.d.pts.map(toXY), moved: false };
  }
  function onMove(e) {
    if (!box || !box.offsetParent) return; const { x, y } = local(e);
    if (drag) {
      drag.moved = true; const d = drag.d;
      if (drag.handle >= 0) {
        const pt = fromXY(x, y, true); if (!pt) return;
        if (d.type === 'rect' || d.type === 'channel' && drag.handle === 2 || d.type === 'flattop' && drag.handle === 2) { if (d.type === 'rect') d.pts[drag.handle] = pt; else d.pts[2] = { t: d.pts[2].t, p: pt.p }; }
        else if (d.type === 'regression' && drag.handle < 2) d.pts[drag.handle] = { t: pt.t, p: d.pts[drag.handle].p };
        else d.pts[drag.handle] = pt;
        constrain(d, drag.handle);
      }
      else { const dx = x - drag.x, dy = y - drag.y; drag.xy.forEach((q, i) => { if (!q) return; const pt = fromXY(q.x + dx, q.y + dy, false); if (pt) d.pts[i] = pt; }); constrain(d, -1); }
      return;
    }
    if (pending) {
      const pt = fromXY(x, y, true); if (!pt) return;
      if (pending.brush) { const last = toXY(pending.d.pts[pending.d.pts.length - 1]); if (!last || Math.hypot(last.x - x, last.y - y) > 2) pending.d.pts.push(pt); }
      else pending.d.pts[pending.idx] = pt;
      return;
    }
    if (tool === 'cursor') { const h = box.contains(e.target) ? hit(x, y) : null; cv.style.pointerEvents = h ? 'auto' : 'none'; cv.style.cursor = h ? (h.d.lock ? 'default' : h.handle >= 0 ? 'pointer' : 'move') : 'default'; }
  }
  function onUp(e) {
    if (drag) { const m = drag.moved; drag = null; if (m) changed(); else undoStack.pop(); return; }
    if (!pending) return;
    if (pending.brush) { if (pending.d.pts.length > 1) finish(); else pending = null; return; }
    if (pending.down && !pending.open) { const { x, y } = local(e); if (Math.hypot(x - pending.down.x, y - pending.down.y) > 4) {   // drag-to-draw
        if (pending.idx + 1 < npts(pending.d.type)) { pending.d.pts.push({ ...pending.d.pts[pending.idx] }); pending.idx++; pending.down = null; } else finish(); }
      else pending.down = null; }
  }
  function finishOpen() {   // path / polyline: drop the rubber-band point and any double-click duplicate
    const p = pending.d.pts; p.pop(); while (p.length > 1) { const a = toXY(p[p.length - 1]), b = toXY(p[p.length - 2]); if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < 4) p.pop(); else break; }
    if (p.length >= 2) finish(); else pending = null;
  }
  function cancel() { if (pending) { if (pending.open) finishOpen(); else pending = null; return true; } if (tool !== 'cursor') { setTool('cursor'); return true; } if (sel) { select(null); return true; } return false; }
  function removeSelected() { if (!sel) return; snapshot(); list = list.filter(x => x !== sel); select(null); changed(); }
  function undo() { if (!undoStack.length) return; list = undoStack.pop(); select(null); onSave(clone(list)); }

  function attach(o) {
    ({ chart, series, box, canvas: cv, bars: getBars, save: onSave } = o); onTool = o.onTool || onTool; onSelect = o.onSelect || onSelect; ctx = cv.getContext('2d');
    cv.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    cv.addEventListener('dblclick', e => { if (pending && pending.open) return finishOpen(); const { x, y } = local(e), h = hit(x, y); if (h && T[h.d.type] && T[h.d.type].txt) editText(h.d); });
    cv.addEventListener('wheel', e => { cv.style.pointerEvents = 'none'; const el = document.elementFromPoint(e.clientX, e.clientY); cv.style.pointerEvents = 'auto';
      if (el && el !== cv) { e.preventDefault(); el.dispatchEvent(new WheelEvent('wheel', e)); } }, { passive: false });
    requestAnimationFrame(loop);
  }
  function destroy() { alive = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
  function edit(f) { if (!sel) return; snapshot(); f(sel); changed(); }
  return {
    attach, setTool, undo, removeSelected, cancel, destroy, tool: () => tool,
    load(arr) { list = Array.isArray(arr) ? clone(arr) : []; sel = null; pending = null; drag = null; undoStack = []; onSelect(null); },
    clear() { if (!list.length) return; snapshot(); list = []; select(null); changed(); },
    style(s) { Object.assign(style, s); if (sel) edit(d => Object.assign(d, s)); },
    set(props) { edit(d => Object.assign(d, props)); },   // e.g. {lock: true}, {acct: 25000}
    duplicate() { if (!sel) return; snapshot(); const d = clone(sel); d.id = uid(); d.lock = false; const m = lmap(); d.pts = d.pts.map(p => ({ t: lToT(tToL(p.t) + 5) || p.t, p: p.p })); list.push(d); select(d); changed(); },
    order(front) { edit(d => { list = list.filter(x => x !== d); if (front) list.push(d); else list.unshift(d); }); },
    selected: () => sel, editText: () => sel && T[sel.type] && T[sel.type].txt && editText(sel),
    count: () => list.length
  };
  }
  return { create, setMagnet(v) { G.magnet = !!v; }, setStay(v) { G.stay = !!v; }, setHidden(v) { G.hidden = !!v; }, flags: G, TOOLS: T, GROUPS, ICONS, label, hasText: t => !!(T[t] && T[t].txt) };
})();
