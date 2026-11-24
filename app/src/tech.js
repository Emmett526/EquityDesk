'use strict';
// technicals rating
const Tech = (() => {
  const cache = new Map();
  const fin = v => typeof v === 'number' && Number.isFinite(v);
  const zh = () => !!(window.I18N && I18N.lang === 'zh-HK');
  const L = (en, z) => (zh() ? z : en);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // math helpers
  const sma = (a, n, i = a.length - 1) => { if (i + 1 < n) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n; };
  const emaArr = (a, n) => { const k = 2 / (n + 1), out = []; let e = null; a.forEach((v, i) => { e = i < n - 1 ? null : i === n - 1 ? sma(a, n, i) : v * k + e * (1 - k); out.push(e); }); return out; };
  const wilder = (a, n) => { const out = []; let s = null; a.forEach((v, i) => { if (i < n - 1) out.push(null); else if (i === n - 1) { s = a.slice(0, n).reduce((p, q) => p + q, 0) / n; out.push(s); } else { s = (s * (n - 1) + v) / n; out.push(s); } }); return out; };
  const hi = (a, n, i) => Math.max(...a.slice(i - n + 1, i + 1));
  const lo = (a, n, i) => Math.min(...a.slice(i - n + 1, i + 1));

  // indicators
  function compute(bars) {
    const b = (bars || []).filter(x => fin(x.close) && fin(x.high) && fin(x.low));
    if (b.length < 60) return null;
    const c = b.map(x => x.close), h = b.map(x => x.high), l = b.map(x => x.low), n = c.length - 1, px = c[n];
    const ma = [], osc = [];
    const sig = v => v > 0 ? 1 : v < 0 ? -1 : 0;

    // moving averages: price above = buy, below = sell
    for (const p of [10, 20, 30, 50, 100, 200]) {
      const s = sma(c, p); if (fin(s)) ma.push({ name: `SMA ${p}`, val: s, s: sig(px - s) });
      const e = emaArr(c, p)[n]; if (fin(e)) ma.push({ name: `EMA ${p}`, val: e, s: sig(px - e) });
    }

    // RSI 14
    const ch = c.map((v, i) => i ? v - c[i - 1] : 0).slice(1);
    const ag = wilder(ch.map(x => Math.max(x, 0)), 14), al = wilder(ch.map(x => Math.max(-x, 0)), 14);
    const rsiAt = i => al[i] === 0 ? 100 : 100 - 100 / (1 + ag[i] / al[i]);
    const rsi = rsiAt(ch.length - 1), rsiP = rsiAt(ch.length - 2);
    osc.push({ name: 'RSI (14)', val: rsi, s: rsi < 30 && rsi > rsiP ? 1 : rsi > 70 && rsi < rsiP ? -1 : 0 });

    // stochastic 14,3,3
    const kRaw = c.map((v, i) => i < 13 ? null : (hi(h, 14, i) - lo(l, 14, i)) ? (v - lo(l, 14, i)) / (hi(h, 14, i) - lo(l, 14, i)) * 100 : 50);
    const kS = kRaw.map((v, i) => i < 15 ? null : (kRaw[i] + kRaw[i - 1] + kRaw[i - 2]) / 3), dS = kS.map((v, i) => i < 17 ? null : (kS[i] + kS[i - 1] + kS[i - 2]) / 3);
    osc.push({ name: 'Stochastic %K (14, 3, 3)', val: kS[n], s: kS[n] < 20 && kS[n] > dS[n] ? 1 : kS[n] > 80 && kS[n] < dS[n] ? -1 : 0 });

    // CCI 20
    const tp = c.map((v, i) => (h[i] + l[i] + v) / 3), tpS = sma(tp, 20), md = tp.slice(-20).reduce((s, v) => s + Math.abs(v - tpS), 0) / 20;
    const cci = md ? (tp[n] - tpS) / (0.015 * md) : 0;
    osc.push({ name: 'CCI (20)', val: cci, s: cci < -100 ? 1 : cci > 100 ? -1 : 0 });

    // ADX 14
    const pdm = [], mdm = [], trr = [];
    for (let i = 1; i <= n; i++) { const up = h[i] - h[i - 1], dn = l[i - 1] - l[i]; pdm.push(up > dn && up > 0 ? up : 0); mdm.push(dn > up && dn > 0 ? dn : 0); trr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))); }
    const atr = wilder(trr, 14), pS = wilder(pdm, 14), mS = wilder(mdm, 14), pdi = pS.map((v, i) => atr[i] ? v / atr[i] * 100 : null), mdi = mS.map((v, i) => atr[i] ? v / atr[i] * 100 : null);
    const dx = pdi.map((v, i) => fin(v) && fin(mdi[i]) && v + mdi[i] ? Math.abs(v - mdi[i]) / (v + mdi[i]) * 100 : 0), adx = wilder(dx.slice(13), 14), m = pdi.length - 1, adxV = adx[adx.length - 1];
    osc.push({ name: 'ADX (14)', val: adxV, s: adxV > 20 ? sig(pdi[m] - mdi[m]) : 0 });

    // awesome oscillator
    const mid = h.map((v, i) => (v + l[i]) / 2), ao = i => sma(mid, 5, i) - sma(mid, 34, i), aoN = ao(n), aoP = ao(n - 1);
    osc.push({ name: 'Awesome oscillator', val: aoN, s: aoN > 0 && aoN > aoP ? 1 : aoN < 0 && aoN < aoP ? -1 : 0 });

    // momentum 10
    const mo = px - c[n - 10], moP = c[n - 1] - c[n - 11];
    osc.push({ name: 'Momentum (10)', val: mo, s: mo > 0 && mo > moP ? 1 : mo < 0 && mo < moP ? -1 : 0 });

    // MACD 12, 26, 9
    const e12 = emaArr(c, 12), e26 = emaArr(c, 26), macd = c.map((v, i) => fin(e12[i]) && fin(e26[i]) ? e12[i] - e26[i] : null);
    const sigL = emaArr(macd.filter(fin), 9), macdN = macd[n], sigN = sigL[sigL.length - 1];
    osc.push({ name: 'MACD (12, 26, 9)', val: macdN, s: sig(macdN - sigN) });

    // Williams %R 14
    const wr = (hi(h, 14, n) - lo(l, 14, n)) ? (hi(h, 14, n) - px) / (hi(h, 14, n) - lo(l, 14, n)) * -100 : -50;
    osc.push({ name: 'Williams %R (14)', val: wr, s: wr < -80 ? 1 : wr > -20 ? -1 : 0 });

    // ultimate oscillator 7, 14, 28
    const bp = c.map((v, i) => i ? v - Math.min(l[i], c[i - 1]) : 0), tr2 = c.map((v, i) => i ? Math.max(h[i], c[i - 1]) - Math.min(l[i], c[i - 1]) : 0);
    const av = p => { const s1 = bp.slice(-p).reduce((s, v) => s + v, 0), s2 = tr2.slice(-p).reduce((s, v) => s + v, 0); return s2 ? s1 / s2 : 0; };
    const uo = 100 * (4 * av(7) + 2 * av(14) + av(28)) / 7;
    osc.push({ name: 'Ultimate oscillator (7, 14, 28)', val: uo, s: uo < 30 ? 1 : uo > 70 ? -1 : 0 });

    const score = list => list.length ? list.reduce((s, x) => s + x.s, 0) / list.length : 0;
    const count = list => ({ buy: list.filter(x => x.s > 0).length, neutral: list.filter(x => !x.s).length, sell: list.filter(x => x.s < 0).length });
    const sMa = score(ma), sOsc = score(osc), sAll = (sMa + sOsc) / 2;
    return { ma, osc, sMa, sOsc, sAll, cMa: count(ma), cOsc: count(osc), cAll: count([...ma, ...osc]), date: b[n].time };
  }

  // score -> label
  const level = v => v >= 0.5 ? 'sb' : v >= 0.1 ? 'b' : v > -0.1 ? 'n' : v > -0.5 ? 's' : 'ss';
  const NAMES = () => ({ sb: L('Strong buy', '強烈買入'), b: L('Buy', '買入'), n: L('Neutral', '中性'), s: L('Sell', '賣出'), ss: L('Strong sell', '強烈賣出') });
  const COL = { sb: '#00a854', b: '#4caf50', n: '#9e9e9e', s: '#ff7043', ss: '#d32f2f' };

  // fetch (cached 10 min)
  async function get(sym) {
    const c = cache.get(sym); if (c && Date.now() - c.t < 10 * 60e3) return c.v;
    let v = null; try { const r = await api.bars(sym, '1Y', 'D'); v = r && !r.error ? compute(r.bars) : null; } catch (e) {}
    cache.set(sym, { t: Date.now(), v }); return v;
  }
  const peek = sym => { const c = cache.get(sym); return c ? c.v : undefined; };

  // draw
  function scale(v) {   // scale bar
    const x = Math.max(0, Math.min(100, (v + 1) / 2 * 100)), N = NAMES();
    return `<div class="techScale">${['ss', 's', 'n', 'b', 'sb'].map(k => `<span style="background:${COL[k]}">${esc(N[k])}</span>`).join('')}<i style="left:${x.toFixed(1)}%"></i></div>`;
  }
  function rows(cnt) {   // count bars
    const tot = cnt.buy + cnt.neutral + cnt.sell || 1;
    return `<div class="finRec">${[[L('Buy', '買入'), cnt.buy, COL.b], [L('Neutral', '中性'), cnt.neutral, COL.n], [L('Sell', '賣出'), cnt.sell, COL.s]].map(([l, v, c]) => `<div><span>${l}</span><i style="width:${v / tot * 100}%;background:${c}"></i><b>${v}</b></div>`).join('')}</div>`;
  }
  function card(sym, opts = {}) {
    const t = peek(sym), N = NAMES(), head = `<div class="finH"><b>${L('Technicals', '技術分析')}</b></div>`;
    if (t === undefined) return `<div class="finCard techCard" data-noi18n>${head}<div class="mut small">${L('Loading daily prices…', '正在載入每日股價…')}</div></div>`;
    if (!t) return `<div class="finCard techCard" data-noi18n>${head}<div class="mut small">${L('Not enough price history for a technical rating (needs about 3 months of daily prices).', '價格歷史不足，未能給出技術評級（需要約 3 個月的每日股價）。')}</div></div>`;
    const k = level(t.sAll), f = v => fin(v) ? (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)) : '—';
    const sigTxt = s => s > 0 ? `<span class="up">${L('Buy', '買入')}</span>` : s < 0 ? `<span class="dn">${L('Sell', '賣出')}</span>` : `<span class="mut">${L('Neutral', '中性')}</span>`;
    const group = (title, list, sc) => `<tr class="sec"><td colspan="3">${title}: ${esc(N[level(sc)])}</td></tr>` + list.map(x => `<tr><td>${esc(x.name)}</td><td>${f(x.val)}</td><td>${sigTxt(x.s)}</td></tr>`).join('');
    return `<div class="finCard techCard" data-noi18n>${head}<div class="techBig" style="color:${COL[k]}">${esc(N[k])}</div>${scale(t.sAll)}` +
      `<div class="techSub"><span>${L('Moving averages', '移動平均線')}: <b style="color:${COL[level(t.sMa)]}">${esc(N[level(t.sMa)])}</b></span><span>${L('Oscillators', '震盪指標')}: <b style="color:${COL[level(t.sOsc)]}">${esc(N[level(t.sOsc)])}</b></span></div>` +
      rows(t.cAll) +
      `<details${opts.open ? ' open' : ''}><summary class="small">${L('All indicators', '所有指標')} (${t.ma.length + t.osc.length})</summary><table class="finT techT"><thead><tr><th>${L('Indicator', '指標')}</th><th>${L('Value', '數值')}</th><th>${L('Signal', '訊號')}</th></tr></thead><tbody>` +
      group(L('Moving averages', '移動平均線'), t.ma, t.sMa) + group(L('Oscillators', '震盪指標'), t.osc, t.sOsc) + `</tbody></table></details>` +
      `<div class="mut small">${L('From daily prices over the last year: 12 moving averages and 9 oscillators each vote buy, neutral or sell. A summary of price signals, not advice.', '根據過去一年的每日股價：12 條移動平均線及 9 個震盪指標各自投票買入、中性或賣出。只是價格訊號摘要，並非投資建議。')}</div></div>`;
  }
  return { get, peek, card, compute, level };
})();
