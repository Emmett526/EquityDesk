'use strict';
// options maths (GEX, max pain, OI, expected move, P/C)
window.Opt = (() => {
  const npdf = x => Math.exp(-x * x / 2) / 2.5066282746;
  const yrs = (e, now) => Math.max(e + 72000 - now, 3600) / (365 * 86400);   // expiry ~4 pm New York
  function gam(S, K, T, iv) { if (!(S > 0 && K > 0 && T > 0 && iv > 0.01)) return 0; const v = iv * Math.sqrt(T), d1 = (Math.log(S / K) + (0.04 + iv * iv / 2) * T) / v; return npdf(d1) / (S * v); }
  // pick expirations
  function pick(o, sel) { const now = Date.now() / 1000, live = (o && o.exps || []).filter(x => x.exp + 86400 > now); if (!live.length) return [];
    if (/^e:/.test(sel)) { const e = live.find(x => String(x.exp) === sel.slice(2)); return e ? [e] : [live[0]]; }
    if (sel === 'near') return [live[0]]; const d = +sel || 30, r = live.filter(x => x.exp - now <= d * 86400); return r.length ? r : [live[0]]; }
  // dollar gamma per 1% move: calls +, puts −
  function gexAt(ex, S, now) { let t = 0; ex.forEach(e => { const T = yrs(e.exp, now); e.calls.forEach(c => { t += gam(S, c.k, T, c.iv) * c.oi * 100 * S * S * 0.01; }); e.puts.forEach(q => { t -= gam(S, q.k, T, q.iv) * q.oi * 100 * S * S * 0.01; }); }); return t; }
  function compute(o, S, sel) {
    const ex = pick(o, sel), now = Date.now() / 1000; S = S || o.spot; if (!ex.length || !(S > 0)) return null;
    const m = new Map(), row = k => { let r = m.get(k); if (!r) m.set(k, r = { k, cg: 0, pg: 0, coi: 0, poi: 0, cv: 0, pv: 0 }); return r; };
    ex.forEach(e => { const T = yrs(e.exp, now);
      e.calls.forEach(c => { const r = row(c.k); r.cg += gam(S, c.k, T, c.iv) * c.oi * 100 * S * S * 0.01; r.coi += c.oi; r.cv += c.v; });
      e.puts.forEach(q => { const r = row(q.k); r.pg += gam(S, q.k, T, q.iv) * q.oi * 100 * S * S * 0.01; r.poi += q.oi; r.pv += q.v; }); });
    const rows = [...m.values()].sort((a, b) => a.k - b.k); rows.forEach(r => { r.g = r.cg - r.pg; });
    const sum = f => rows.reduce((t, r) => t + r[f], 0), net = sum('g');
    const cw = rows.reduce((a, r) => !a || r.cg > a.cg ? r : a, null), pw = rows.reduce((a, r) => !a || r.pg > a.pg ? r : a, null);
    // zero gamma: where total GEX changes sign, nearest to price
    let prev = null, zg = null; for (let i = -80; i <= 80; i++) { const x = S * (1 + i * 0.0025), g = gexAt(ex, x, now);
      if (prev && prev.g !== 0 && Math.sign(g) !== Math.sign(prev.g)) { const z = prev.x + (x - prev.x) * (-prev.g) / (g - prev.g); if (zg == null || Math.abs(z - S) < Math.abs(zg - S)) zg = z; } prev = { x, g }; }
    // max pain (nearest expiry in the set)
    const e0 = ex[0]; let mp = null; rows.forEach(({ k: X }) => { let pay = 0; e0.calls.forEach(c => { pay += c.oi * Math.max(0, X - c.k); }); e0.puts.forEach(q => { pay += q.oi * Math.max(0, q.k - X); }); if (!mp || pay < mp.pay) mp = { k: X, pay }; });
    // expected move: ATM straddle of the nearest expiry
    const near = a => a.reduce((b, x) => !b || Math.abs(x.k - S) < Math.abs(b.k - S) ? x : b, null), c0 = near(e0.calls), p0 = near(e0.puts);
    const mid = x => x ? (x.bid > 0 && x.ask > 0 ? (x.bid + x.ask) / 2 : x.last || 0) : 0, ivs = [c0, p0].filter(x => x && x.iv > 0.01).map(x => x.iv), atm = ivs.length ? ivs.reduce((s, x) => s + x, 0) / ivs.length : null;
    const mc = mid(c0), mpp = mid(p0); let mv = mc > 0 && mpp > 0 ? (mc + mpp) * 0.85 : 0; if (!(mv > 0) && atm) mv = S * atm * Math.sqrt(yrs(e0.exp, now));   // both legs priced, else IV
    return { S, exps: ex, rows, net, cw: cw && cw.cg > 0 ? cw.k : null, pw: pw && pw.pg > 0 ? pw.k : null, zg, mp: mp && mp.k, mv: mv > 0 ? mv : null, mvExp: e0.exp, atm,
      pcOI: sum('coi') ? sum('poi') / sum('coi') : null, pcV: sum('cv') ? sum('pv') / sum('cv') : null };
  }
  return { compute, pick };
})();
