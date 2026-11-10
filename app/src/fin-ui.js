'use strict';
// FIN screen: company financials laid out like TradingView's Financials (Overview, Statements, Statistics, Estimates, Dividends, Earnings, Segments).
// Data comes from api.fin(sym) (Yahoo Finance + FMP segments, main process). Everything inserted into HTML is escaped. Research only.
const FinScreen = (() => {
  const TABS = [['ov', 'Overview'], ['st', 'Statements'], ['stat', 'Statistics'], ['est', 'Estimates'], ['div', 'Dividends'], ['earn', 'Earnings'], ['seg', 'Segments']];
  let P = { sym: '', tab: 'ov', per: 'annual', stmt: 'is' }, D = null, busy = false, root = null, CW = 1200;
  try { const s = JSON.parse(localStorage.getItem('finP') || '{}'); if (s && typeof s === 'object') P = Object.assign(P, s); } catch (e) {}
  const save = () => { try { localStorage.setItem('finP', JSON.stringify(P)); } catch (e) {} };
  const $f = s => root.querySelector(s);
  // ---- formatting ----
  const big = v => { if (v == null || !Number.isFinite(v)) return '—'; const a = Math.abs(v), s = v < 0 ? '−' : ''; return s + (a >= 1e12 ? (a / 1e12).toFixed(2) + ' T' : a >= 1e9 ? (a / 1e9).toFixed(2) + ' B' : a >= 1e6 ? (a / 1e6).toFixed(2) + ' M' : a >= 1e3 ? (a / 1e3).toFixed(2) + ' K' : a.toFixed(2)); };
  const num = (v, d = 2) => v == null || !Number.isFinite(v) ? '—' : (v < 0 ? '−' : '') + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 2) => v == null || !Number.isFinite(v) ? '—' : num(v, d) + '%';
  const sp = v => v == null || !Number.isFinite(v) ? '<span class="mut">—</span>' : `<span class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%</span>`;
  const dt = t => t ? new Date(t * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const div = (a, b) => a == null || b == null || !b ? null : a / b;
  const fmtKind = (v, k) => k === 'eps' ? num(v) : k === 'pct' ? pct(v) : k === 'x' ? (v == null ? '—' : num(v) + 'x') : k === 'n' ? num(v) : big(v);
  // ---- periods ----
  const ts = () => P.per === 'annual' ? D.annual : D.quarterly;
  const plabel = d => P.per === 'annual' ? 'FY' + String(d).slice(0, 4) : new Date(d + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const row = k => (ts().rows || {})[k] || [];
  const priceAt = d => { const t = Date.parse(d + 'T23:59:59Z') / 1000, px = D.px || []; let v = null; for (const [pt, c] of px) { if (pt <= t) v = c; else break; } return v; };
  // ---- SVG bar chart: grouped bars, optional hatched forecast zone, value axis on the right ----
  function chart(labels, series, o = {}) {
    const W = Math.round(Math.max(300, o.half ? (CW >= 940 ? (CW - 10) / 2 - 22 : CW - 22) : CW - 22)), H = o.h || (o.half ? 170 : 200), padL = 8, padR = 64, padB = 22, padT = 8, n = labels.length; if (!n) return '<div class="mut small finEmpty">No data</div>';
    const vals = series.flatMap(s => s.vals.filter(v => v != null && Number.isFinite(v))); if (!vals.length) return '<div class="mut small finEmpty">No data</div>';
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); if (hi === lo) hi = lo + 1; const pad = (hi - lo) * 0.08; hi += hi > 0 ? pad : 0; lo -= lo < 0 ? pad : 0;
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo)), cw = (W - padL - padR) / n, bw = Math.min(34, cw * 0.8 / series.length);
    let g = '';
    if (o.fcFrom != null && o.fcFrom < n) { const x0 = padL + cw * o.fcFrom; g += `<rect x="${x0}" y="${padT}" width="${W - padR - x0}" height="${H - padT - padB}" fill="url(#finHatch)"/><text x="${(x0 + W - padR) / 2}" y="${padT + 14}" class="finFc" text-anchor="middle">FORECAST</text>`; }
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, yy = y(v); g += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" class="finGrid"/><text x="${W - padR + 6}" y="${yy + 4}" class="finAx">${esc(o.fmt === 'eps' ? num(v) : o.fmt === 'pct' ? num(v, 1) + '%' : big(v))}</text>`; }
    labels.forEach((l, i) => { const cx = padL + cw * (i + 0.5); g += `<text x="${cx}" y="${H - 6}" class="finAx" text-anchor="middle">${esc(l)}</text>`;
      series.forEach((s, j) => { const v = s.vals[i]; if (v == null || !Number.isFinite(v)) return; const x = cx - bw * series.length / 2 + j * bw + 1, y0 = y(0), yv = y(v);
        const col = s.colorFn ? s.colorFn(i, v) : s.c; g += `<rect x="${x}" y="${Math.min(y0, yv)}" width="${bw - 2}" height="${Math.max(1, Math.abs(y0 - yv))}" fill="${col}"><title>${esc(s.name + ' ' + l + ': ' + (o.fmt === 'eps' ? num(v) : o.fmt === 'pct' ? pct(v) : big(v)))}</title></rect>`; }); });
    (o.lines || []).forEach(ln => { const pts = ln.vals.map((v, i) => v == null ? null : [padL + cw * (i + 0.5), padT + (H - padT - padB) * (1 - (v - ln.lo) / ((ln.hi - ln.lo) || 1))]).filter(Boolean);
      if (pts.length > 1) g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${ln.c}" stroke-width="2"/>`; pts.forEach(p => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${ln.c}"/>`; }); });
    const leg = [...series.map(s => [s.name, s.c]), ...(o.lines || []).map(l => [l.name, l.c])].map(([nm, c]) => `<span><i style="background:${c}"></i>${esc(nm)}</span>`).join('');
    return `<svg class="finSvg" viewBox="0 0 ${W} ${H}" style="height:${H}px" preserveAspectRatio="none"><defs><pattern id="finHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="finHatchL"/></pattern></defs>${g}</svg><div class="finLeg">${leg}</div>`;
  }
  // reported vs estimate table + chart (the Earnings / Estimates layout)
  function repEst(title, labels, rep, est, fmt, fcFrom, note) {
    const sur = labels.map((_, i) => rep[i] != null && est[i] != null && est[i] ? (rep[i] - est[i]) / Math.abs(est[i]) * 100 : null), f = v => fmt === 'eps' ? num(v) : big(v);
    return `<div class="finCard"><div class="finH"><b>${esc(title)}</b>${note ? `<span class="mut small">${esc(note)}</span>` : ''}</div>` +
      chart(labels, [{ name: 'Reported', c: fmt === 'eps' ? 'var(--blu)' : 'var(--amb)', vals: rep }, { name: 'Estimate', c: 'var(--line3)', vals: est }], { fmt, fcFrom }) +
      `<table class="finT"><thead><tr><th>Currency: ${esc(D.finCcy)}</th>${labels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>` +
      `<tr class="hl"><td>Reported</td>${rep.map(v => `<td>${f(v)}</td>`).join('')}</tr><tr class="hl"><td>Estimate</td>${est.map(v => `<td>${f(v)}</td>`).join('')}</tr><tr><td>Surprise</td>${sur.map(v => `<td>${sp(v)}</td>`).join('')}</tr></tbody></table></div>`;
  }
  // ---- data assembly for reported vs estimate ----
  function epsRev(kind) {   // kind 'eps' | 'rev' → {labels, rep, est, fcFrom}
    if (P.per === 'annual') {
      const a = D.annual, L = a.dates.map(d => 'FY' + d.slice(0, 4)), rep = ((kind === 'eps' ? a.rows.DilutedEPS : a.rows.TotalRevenue) || L.map(() => null)).slice(), est = L.map(() => null);
      D.trend.filter(t => /y$/.test(t.period)).forEach(t => { const l = 'FY' + String(t.end || '').slice(0, 4), v = kind === 'eps' ? t.eps : t.rev, i = L.indexOf(l); if (i >= 0) est[i] = v; else { L.push(l); rep.push(null); est.push(v); } });
      const fc = rep.findIndex((v, i) => v == null && est[i] != null); return { labels: L, rep: rep.slice(), est, fcFrom: fc < 0 ? null : fc };
    }
    const L = [], rep = [], est = [];
    if (kind === 'eps') { D.hist.forEach(h => { L.push(new Date(h.date * 1000).toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })); rep.push(h.actual); est.push(h.est); }); }
    else { const q = D.quarterly; q.dates.slice(-6).forEach((d, i, arr) => { L.push(plabel(d)); rep.push((q.rows.TotalRevenue || [])[q.dates.length - arr.length + i]); est.push(null); }); }
    const fc = L.length; D.trend.filter(t => /q$/.test(t.period)).forEach(t => { L.push(t.end ? new Date(t.end + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }) + 'ᵉ' : t.period); rep.push(null); est.push(kind === 'eps' ? t.eps : t.rev); });
    return { labels: L, rep, est, fcFrom: fc < L.length ? fc : null };
  }
  // ---- ratios per period (Statistics) ----
  function ratios() {
    const t = ts(), R = k => t.rows[k] || [], n = t.dates.length, mult = P.per === 'annual' ? 1 : 4;
    const ttm = (k, i) => { const a = R(k); if (P.per === 'annual') return a[i]; if (i < 3) return null; let s = 0; for (let j = i - 3; j <= i; j++) { if (a[j] == null) return null; s += a[j]; } return s; };
    const out = [], col = f => t.dates.map((d, i) => f(i, d)), sh = i => R('OrdinarySharesNumber')[i] || R('DilutedAverageShares')[i];
    const mc = (i, d) => { const p = priceAt(d), s = sh(i); return p && s ? p * s : null; }, ev = (i, d) => { const m = mc(i, d); return m == null ? null : m + (R('TotalDebt')[i] || 0) - (R('CashCashEquivalentsAndShortTermInvestments')[i] ?? R('CashAndCashEquivalents')[i] ?? 0); };
    const sec = (h, rows) => out.push({ h, rows });
    sec('Key stats', [['Total common shares outstanding', col(i => sh(i)), 'n0'], ['Number of employees', t.dates.map((_, i) => i === n - 1 ? D.profile.employees : null), 'n0']]);
    sec('Valuation ratios', [['Price to earnings ratio', col((i, d) => div(mc(i, d), ttm('NetIncome', i))), 'x'], ['Price to sales ratio', col((i, d) => div(mc(i, d), ttm('TotalRevenue', i))), 'x'],
      ['Price to cash flow ratio', col((i, d) => div(mc(i, d), ttm('OperatingCashFlow', i))), 'x'], ['Price to book ratio', col((i, d) => div(mc(i, d), R('StockholdersEquity')[i])), 'x'],
      ['Enterprise value', col((i, d) => ev(i, d)), 'big'], ['Enterprise value to EBITDA ratio', col((i, d) => div(ev(i, d), ttm('EBITDA', i))), 'x'], ['Enterprise value to revenue', col((i, d) => div(ev(i, d), ttm('TotalRevenue', i))), 'x']]);
    const m = (a, b) => col(i => { const x = div(R(a)[i], R(b)[i]); return x == null ? null : x * 100; });
    sec('Profitability ratios', [['Return on assets %', col(i => { const x = div(ttm('NetIncome', i), R('TotalAssets')[i]); return x == null ? null : x * 100; }), 'pct'], ['Return on equity %', col(i => { const x = div(ttm('NetIncome', i), R('StockholdersEquity')[i]); return x == null ? null : x * 100; }), 'pct'],
      ['Return on invested capital %', col(i => { const e = ttm('EBIT', i), tx = div(R('TaxProvision')[i], R('PretaxIncome')[i]), ic = (R('TotalDebt')[i] || 0) + (R('StockholdersEquity')[i] || 0); return e == null || !ic ? null : e * (1 - Math.min(Math.max(tx || 0.21, 0), 0.5)) / ic * 100; }), 'pct'],
      ['Gross margin %', m('GrossProfit', 'TotalRevenue'), 'pct'], ['Operating margin %', m('OperatingIncome', 'TotalRevenue'), 'pct'], ['EBITDA margin %', m('EBITDA', 'TotalRevenue'), 'pct'], ['Net margin %', m('NetIncome', 'TotalRevenue'), 'pct']]);
    sec('Liquidity ratios', [['Quick ratio', col(i => div((R('CurrentAssets')[i] ?? null) == null ? null : R('CurrentAssets')[i] - (R('Inventory')[i] || 0), R('CurrentLiabilities')[i])), 'n'], ['Current ratio', col(i => div(R('CurrentAssets')[i], R('CurrentLiabilities')[i])), 'n'],
      ['Inventory turnover', col(i => div(ttm('CostOfRevenue', i), R('Inventory')[i])), 'n'], ['Asset turnover', col(i => div(ttm('TotalRevenue', i), R('TotalAssets')[i])), 'n']]);
    sec('Solvency ratios', [['Debt to assets ratio', col(i => div(R('TotalDebt')[i], R('TotalAssets')[i])), 'n'], ['Debt to equity ratio', col(i => div(R('TotalDebt')[i], R('StockholdersEquity')[i])), 'n'],
      ['Long term debt to total assets ratio', col(i => div(R('LongTermDebt')[i], R('TotalAssets')[i])), 'n'], ['Long term debt to total equity ratio', col(i => div(R('LongTermDebt')[i], R('StockholdersEquity')[i])), 'n']]);
    const ps = (k, f) => col(i => div(f ? f(i) : R(k)[i], sh(i)));
    sec('Per share metrics', [['Revenue per share', col(i => div(ttm('TotalRevenue', i), sh(i))), 'n'], ['Operating cash flow per share', col(i => div(ttm('OperatingCashFlow', i), sh(i))), 'n'], ['Free cash flow per share', col(i => div(ttm('FreeCashFlow', i), sh(i))), 'n'],
      ['EBIT per share', col(i => div(ttm('EBIT', i), sh(i))), 'n'], ['EBITDA per share', col(i => div(ttm('EBITDA', i), sh(i))), 'n'], ['Book value per share', ps('StockholdersEquity'), 'n'], ['Total debt per share', ps('TotalDebt'), 'n'],
      ['Cash per share', ps(null, i => R('CashCashEquivalentsAndShortTermInvestments')[i] ?? R('CashAndCashEquivalents')[i]), 'n'], ['Net current asset value per share', ps(null, i => R('CurrentAssets')[i] == null ? null : R('CurrentAssets')[i] - (R('TotalLiabilitiesNetMinorityInterest')[i] || 0)), 'n'],
      ['Tangible book value per share', ps('TangibleBookValue'), 'n'], ['Working capital per share', ps('WorkingCapital'), 'n'], ['CapEx per share', col(i => { const c = ttm('CapitalExpenditure', i); return div(c == null ? null : Math.abs(c), sh(i)); }), 'n']]);
    return { out, mult };
  }
  // ---- pages ----
  function overview() {
    const a = D.annual, R = k => a.rows[k] || [], L = a.dates.map(d => 'FY' + d.slice(0, 4)), last = a.dates.length - 1, p = D.profile, k = D.ks, f = D.fd;
    const facts = [['Market capitalization', big(D.mcap) + ' ' + D.currency], ['Dividend yield (indicated)', D.sd.divYield ? pct(D.sd.divYield * 100) : '—'], ['Price to earnings ratio (TTM)', D.sd.pe ? num(D.sd.pe) : '—'], ['Basic EPS (TTM)', k.teps != null ? num(k.teps) + ' ' + D.finCcy : '—'],
      ['Sector', p.sector || '—'], ['Industry', p.industry || '—'], ['Employees (FY)', p.employees ? big(p.employees).replace(' K', 'K').replace(' M', 'M') : '—'], ['CEO', p.ceo || '—'], ['Country', [p.city, p.country].filter(Boolean).join(', ') || '—'], ['Website', p.website || '—']];
    const nm = R('NetIncome').map((v, i) => div(v, R('TotalRevenue')[i]) == null ? null : div(v, R('TotalRevenue')[i]) * 100), nmv = nm.filter(v => v != null);
    const pe = a.dates.map((d, i) => { const pr = priceAt(d), s = R('OrdinarySharesNumber')[i] || R('DilutedAverageShares')[i]; return pr && s && R('NetIncome')[i] > 0 ? pr * s / R('NetIncome')[i] : null; }), ps = a.dates.map((d, i) => { const pr = priceAt(d), s = R('OrdinarySharesNumber')[i] || R('DilutedAverageShares')[i]; return pr && s && R('TotalRevenue')[i] ? pr * s / R('TotalRevenue')[i] : null; });
    const rv = R('TotalRevenue')[last], cogs = R('CostOfRevenue')[last], gp = R('GrossProfit')[last], opx = R('OperatingExpense')[last], oi = R('OperatingIncome')[last], pt = R('PretaxIncome')[last], ni = R('NetIncome')[last];
    const conv = [['Revenue', rv, 'var(--blu)'], ['COGS', cogs == null ? null : -cogs, 'var(--dn)'], ['Gross profit', gp, 'var(--up)'], ['Op expenses', opx == null ? null : -opx, 'var(--dn)'], ['Op income', oi, 'var(--up)'],
      ['Non-op income / expenses', pt != null && oi != null ? pt - oi : null, 'var(--mut)'], ['Taxes & other', pt != null && ni != null ? ni - pt : null, 'var(--dn)'], ['Net income', ni, 'var(--amb)']];
    const cmax = Math.max(1, ...conv.map(c => Math.abs(c[1] || 0)));
    const er = epsRev('eps'), cash = D.fd.cash ?? R('CashCashEquivalentsAndShortTermInvestments')[last] ?? R('CashAndCashEquivalents')[last], debt = D.fd.debt ?? R('TotalDebt')[last];
    const debtS = { name: 'Debt', c: 'var(--dn)', vals: R('TotalDebt') }, fcf = { name: 'Free cash flow', c: 'var(--up)', vals: R('FreeCashFlow') }, csh = { name: 'Cash & equivalents', c: 'var(--blu)', vals: R('CashCashEquivalentsAndShortTermInvestments').map((v, i) => v ?? R('CashAndCashEquivalents')[i]) };
    const ca = R('CurrentAssets')[last], ta = R('TotalAssets')[last], cl = R('CurrentLiabilities')[last], tl = R('TotalLiabilitiesNetMinorityInterest')[last];
    return `<div class="finGrid2"><div class="finCard"><div class="finH"><b>Key facts</b></div><div class="finFacts">${facts.map(([l, v]) => `<div><span class="mut">${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>${p.summary ? `<p class="finAbout">${esc(p.summary)}</p>` : ''}</div>
      <div class="finCard"><div class="finH"><b>Ownership</b></div><div class="finFacts"><div><span class="mut">Shares outstanding</span><b>${big(k.shares)}</b></div><div><span class="mut">Free float</span><b>${big(k.float)}${k.float && k.shares ? ' (' + pct(k.float / k.shares * 100) + ')' : ''}</b></div><div><span class="mut">Held by insiders</span><b>${k.insiders != null ? pct(k.insiders * 100) : '—'}</b></div><div><span class="mut">Held by institutions</span><b>${k.inst != null ? pct(k.inst * 100) : '—'}</b></div></div>
        <div class="finH"><b>Capital structure</b></div><div class="finFacts"><div><span class="mut">Market cap</span><b>${big(D.mcap)}</b></div><div><span class="mut">Debt</span><b>${big(debt)}</b></div><div><span class="mut">Cash &amp; equivalents</span><b>${big(cash)}</b></div><div><span class="mut">Enterprise value</span><b>${big(k.ev ?? (D.mcap != null ? D.mcap + (debt || 0) - (cash || 0) : null))}</b></div></div>
        <div class="finH"><b>Valuation</b></div><div class="finFacts"><div><span class="mut">Price to earnings (P/E)</span><b>${D.sd.pe ? num(D.sd.pe) + 'x' : '—'}</b></div><div><span class="mut">Price to sales (P/S)</span><b>${D.sd.ps ? num(D.sd.ps) + 'x' : '—'}</b></div><div><span class="mut">Forward P/E</span><b>${k.fpe ? num(k.fpe) + 'x' : '—'}</b></div><div><span class="mut">EV / EBITDA</span><b>${k.evEbitda ? num(k.evEbitda) + 'x' : '—'}</b></div></div></div></div>
      <div class="finGrid2"><div class="finCard"><div class="finH"><b>Valuation ratios</b><span class="mut small">P/E and P/S at each fiscal year end</span></div>${chart(L, [{ name: 'P/E', c: 'var(--amb)', vals: pe }, { name: 'P/S', c: 'var(--blu)', vals: ps }], { fmt: 'eps', half: 1 })}</div>
      <div class="finCard"><div class="finH"><b>Performance</b><span class="mut small">Net margin: ${nm.map((v, i) => esc(L[i]) + ' ' + pct(v, 1)).join(' · ')}</span></div>${chart(L, [{ name: 'Revenue', c: 'var(--blu)', vals: R('TotalRevenue') }, { name: 'Net income', c: 'var(--amb)', vals: R('NetIncome') }], { lines: nmv.length ? [{ name: 'Net margin %', c: 'var(--yel)', vals: nm, lo: Math.min(0, ...nmv), hi: Math.max(...nmv) * 1.15 || 1 }] : [], half: 1 })}</div></div>
      <div class="finGrid2"><div class="finCard"><div class="finH"><b>Revenue to profit conversion</b><span class="mut small">${esc(L[last] || '')}</span></div><div class="finConv">${conv.map(([l, v, c]) => `<div><span>${esc(l)}</span><i style="width:${v == null ? 0 : Math.abs(v) / cmax * 100}%;background:${c}"></i><b>${big(v)}</b></div>`).join('')}</div></div>
      <div class="finCard"><div class="finH"><b>Earnings</b><span class="mut small">Next: ${D.next.date ? esc(dt(D.next.date)) : '—'}${D.next.eps != null ? ' · EPS est ' + esc(num(D.next.eps)) : ''}</span></div>${chart(er.labels, [{ name: 'Actual', c: 'var(--blu)', vals: er.rep }, { name: 'Estimate', c: 'var(--line3)', vals: er.est }], { fmt: 'eps', fcFrom: er.fcFrom, half: 1 })}</div></div>
      <div class="finGrid2"><div class="finCard"><div class="finH"><b>Debt level and coverage</b></div>${chart(L, [debtS, fcf, csh], { half: 1 })}</div>
      <div class="finCard"><div class="finH"><b>Financial position</b><span class="mut small">${esc(L[last] || '')}</span></div>${chart(['Short term', 'Long term'], [{ name: 'Assets', c: 'var(--up)', vals: [ca, ta != null && ca != null ? ta - ca : null] }, { name: 'Liabilities', c: 'var(--dn)', vals: [cl, tl != null && cl != null ? tl - cl : null] }], { half: 1 })}</div></div>
      <div class="finGrid2">${segCard('By source / business', D.segments.product)}${segCard('By country', D.segments.geo)}</div>`;
  }
  function statements() {
    const t = ts(), meta = D.rowsMeta.filter(r => r.st === P.stmt), L = t.dates.map(plabel);
    const sel = `<div class="finSub">${[['is', 'Income statement'], ['bs', 'Balance sheet'], ['cf', 'Cash flow']].map(([k, l]) => `<button data-stmt="${k}" class="${P.stmt === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const main = { is: ['TotalRevenue', 'NetIncome'], bs: ['TotalAssets', 'TotalLiabilitiesNetMinorityInterest'], cf: ['OperatingCashFlow', 'FreeCashFlow'] }[P.stmt];
    const ch = chart(L, main.map((k, j) => ({ name: (meta.find(m => m.k === k) || {}).l || k, c: j ? 'var(--amb)' : 'var(--blu)', vals: t.rows[k] || [] })));
    const body = meta.filter(m => (t.rows[m.k] || []).some(v => v != null)).map(m => { const a = t.rows[m.k], step = P.per === 'annual' ? 1 : 4;
      return `<tr><td>${esc(m.l)}</td>${a.map((v, i) => { const pv = a[i - step], yoy = v != null && pv ? (v - pv) / Math.abs(pv) * 100 : null; return `<td>${m.kind === 'eps' ? num(v) : big(v)}${yoy != null ? `<br><small class="${yoy >= 0 ? 'up' : 'dn'}">${yoy >= 0 ? '+' : '−'}${Math.abs(yoy).toFixed(1)}%</small>` : ''}</td>`; }).join('')}</tr>`; }).join('');
    return sel + `<div class="finCard">${ch}<table class="finT"><thead><tr><th>Currency: ${esc(D.finCcy)} <span class="mut small">(% = change vs ${P.per === 'annual' ? 'previous year' : 'same quarter a year earlier'})</span></th>${L.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${L.length + 1}" class="mut">No ${esc(P.stmt)} data from Yahoo for this symbol.</td></tr>`}</tbody></table></div>`;
  }
  function statistics() {
    const t = ts(), L = t.dates.map(plabel), { out } = ratios(), k = D.ks, f = D.fd;
    const cur = { 'Price to earnings ratio': D.sd.pe, 'Price to sales ratio': D.sd.ps, 'Price to book ratio': k.pb, 'Enterprise value': k.ev, 'Enterprise value to EBITDA ratio': k.evEbitda, 'Enterprise value to revenue': k.evRev,
      'Return on assets %': f.roa != null ? f.roa * 100 : null, 'Return on equity %': f.roe != null ? f.roe * 100 : null, 'Gross margin %': f.gm != null ? f.gm * 100 : null, 'Operating margin %': f.om != null ? f.om * 100 : null, 'EBITDA margin %': f.em != null ? f.em * 100 : null, 'Net margin %': f.nm != null ? f.nm * 100 : null,
      'Quick ratio': f.qr, 'Current ratio': f.cr, 'Debt to equity ratio': f.de != null ? f.de / 100 : null, 'Total common shares outstanding': k.shares, 'Number of employees': D.profile.employees, 'Book value per share': k.bvps };
    const fwd = [['Price to earnings forward', k.fpe, 'x'], ['Price to sales forward', (() => { const y = D.trend.find(t => t.period === '+1y') || D.trend.find(t => t.period === '0y'); return y && y.rev && D.mcap ? D.mcap / y.rev : null; })(), 'x'], ['PEG ratio', k.peg, 'n'], ['Beta (5Y monthly)', k.beta, 'n'], ['Short interest % of float', k.shortPct != null ? k.shortPct * 100 : null, 'pct']];
    const F = (v, kind) => kind === 'n0' ? (v == null ? '—' : big(v)) : fmtKind(v, kind);
    return `<div class="finCard"><table class="finT"><thead><tr><th>Currency: ${esc(D.finCcy)} <span class="mut small">(${P.per === 'annual' ? 'fiscal years' : 'quarters; ratios use the trailing 4 quarters'})</span></th>${L.map(l => `<th>${esc(l)}</th>`).join('')}<th>Current</th></tr></thead><tbody>` +
      out.map(s => `<tr class="sec"><td colspan="${L.length + 2}">${esc(s.h)}</td></tr>` + s.rows.map(([l, vals, kind]) => `<tr><td>${esc(l)}</td>${vals.map(v => `<td>${F(v, kind)}</td>`).join('')}<td><b>${F(cur[l], kind)}</b></td></tr>`).join('') + (s.h === 'Valuation ratios' ? fwd.map(([l, v, kind]) => `<tr><td>${esc(l)}</td>${L.map(() => '<td class="mut">—</td>').join('')}<td><b>${F(v, kind)}</b></td></tr>`).join('') : '')).join('') + '</tbody></table></div>';
  }
  function estimates() {
    const e = epsRev('eps'), r = epsRev('rev'), f = D.fd, rc = D.rec[0];
    const tgt = f.tMean != null ? (() => { const lo = Math.min(f.tLow ?? f.tMean, D.price ?? f.tMean), hi = Math.max(f.tHigh ?? f.tMean, D.price ?? f.tMean), w = hi - lo || 1, x = v => ((v - lo) / w * 100).toFixed(1) + '%';
      return `<div class="finTgt"><div class="bar"></div>${[['Low', f.tLow, 'var(--dn)'], ['Average', f.tMean, 'var(--amb)'], ['High', f.tHigh, 'var(--up)'], ['Price', D.price, 'var(--blu)']].filter(z => z[1] != null).map(([l, v, c]) => `<span style="left:${x(v)};border-color:${c}"><b style="color:${c}">${esc(l)}</b> ${num(v)}</span>`).join('')}</div>
        <div class="small">Average target ${num(f.tMean)} ${esc(D.currency)} is ${sp(D.price ? (f.tMean / D.price - 1) * 100 : null)} from the current price, from ${f.analysts ?? '—'} analysts. Median ${num(f.tMed)}.</div>`; })() : '<div class="mut small">No price targets.</div>';
    const tot = rc ? rc.sb + rc.b + rc.h + rc.s + rc.ss : 0;
    const rating = rc && tot ? `<div class="finRec">${[['Strong buy', rc.sb, '#00a854'], ['Buy', rc.b, '#4caf50'], ['Hold', rc.h, '#9e9e9e'], ['Sell', rc.s, '#ff7043'], ['Strong sell', rc.ss, '#d32f2f']].map(([l, v, c]) => `<div><span>${l}</span><i style="width:${v / tot * 100}%;background:${c}"></i><b>${v}</b></div>`).join('')}</div><div class="small">Consensus: <b>${esc(String(f.rec || '').replace('_', ' ').toUpperCase() || '—')}</b>${f.recMean ? ' (' + num(f.recMean) + ' on a 1 strong buy to 5 strong sell scale)' : ''}</div>` : '<div class="mut small">No analyst ratings.</div>';
    const tr = D.trend.length ? `<table class="finT"><thead><tr><th>Period</th><th>Ends</th><th>EPS avg</th><th>EPS low</th><th>EPS high</th><th>Analysts</th><th>Revenue avg</th><th>Revenue low</th><th>Revenue high</th><th>Growth</th></tr></thead><tbody>${D.trend.map(t => `<tr><td>${esc({ '0q': 'This quarter', '+1q': 'Next quarter', '0y': 'This fiscal year', '+1y': 'Next fiscal year' }[t.period] || t.period)}</td><td>${esc(t.end || '—')}</td><td>${num(t.eps)}</td><td>${num(t.epsLo)}</td><td>${num(t.epsHi)}</td><td>${t.epsN ?? '—'}</td><td>${big(t.rev)}</td><td>${big(t.revLo)}</td><td>${big(t.revHi)}</td><td>${t.growth != null ? sp(t.growth * 100) : '—'}</td></tr>`).join('')}</tbody></table>` : '';
    return `<div class="finGrid2"><div class="finCard"><div class="finH"><b>Analyst rating</b></div>${rating}</div><div class="finCard"><div class="finH"><b>Price target (1 year)</b></div>${tgt}</div></div>` +
      repEst('EPS estimates', e.labels, e.rep, e.est, 'eps', e.fcFrom) + repEst('Revenue estimates', r.labels, r.rep, r.est, 'rev', r.fcFrom) + (tr ? `<div class="finCard"><div class="finH"><b>Consensus detail</b></div>${tr}</div>` : '');
  }
  function dividends() {
    const dv = D.div || []; if (!dv.length) return `<div class="finCard"><div class="finH"><b>No dividends</b></div><p>${esc(D.symbol)} has not paid a dividend in the last 10 years of price history.</p></div>`;
    const byY = {}; dv.forEach(x => { const y = new Date(x.t * 1000).getUTCFullYear(); byY[y] = (byY[y] || 0) + x.amt; }); const yrs = Object.keys(byY).sort(), cy = String(new Date().getUTCFullYear());
    const yEnd = y => { let v = null; for (const [t, c] of D.px || []) { if (new Date(t * 1000).getUTCFullYear() <= +y) v = c; } return v; };
    const yld = yrs.map(y => { const p = yEnd(y); return p ? byY[y] / p * 100 : null; }), a = D.annual, pay = a.dates.map((d, i) => { const dp = (a.rows.CashDividendsPaid || [])[i], ni = (a.rows.NetIncome || [])[i]; return dp != null && ni > 0 ? Math.abs(dp) / ni * 100 : null; });
    const grow = yrs.map((y, i) => i && byY[yrs[i - 1]] ? (byY[y] / byY[yrs[i - 1]] - 1) * 100 : null), s = D.sd;
    return `<div class="finCard"><div class="finFacts">${[['Dividend yield (indicated)', s.divYield != null ? pct(s.divYield * 100) : '—'], ['Annual dividend (indicated)', s.divRate != null ? num(s.divRate) + ' ' + D.currency : '—'], ['Payout ratio (TTM)', s.payout != null ? pct(s.payout * 100) : '—'], ['5-year average yield', s.avgYield5 != null ? pct(s.avgYield5) : '—'],
      ['Last ex-dividend date', dt(s.exDiv || D.next.exDiv)], ['Next payment date', dt(D.next.divDate)], ['Last payment', num(dv[dv.length - 1].amt, 4) + ' on ' + dt(dv[dv.length - 1].t)], ['Payments per year', String(dv.filter(x => x.t > Date.now() / 1000 - 366 * 86400).length)]].map(([l, v]) => `<div><span class="mut">${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
      <div class="finGrid2"><div class="finCard"><div class="finH"><b>Dividends per share</b><span class="mut small">by calendar year${yrs.includes(cy) ? ', ' + cy + ' so far' : ''}</span></div>${chart(yrs, [{ name: 'Dividend per share', c: 'var(--up)', vals: yrs.map(y => byY[y]) }], { fmt: 'eps', half: 1 })}</div>
      <div class="finCard"><div class="finH"><b>Dividend yield %</b><span class="mut small">year's dividends / year-end price</span></div>${chart(yrs, [{ name: 'Yield %', c: 'var(--amb)', vals: yld }], { fmt: 'pct', half: 1 })}</div></div>
      <div class="finGrid2"><div class="finCard"><div class="finH"><b>Payout ratio %</b><span class="mut small">dividends paid / net income</span></div>${chart(a.dates.map(d => 'FY' + d.slice(0, 4)), [{ name: 'Payout %', c: 'var(--blu)', vals: pay }], { fmt: 'pct', half: 1 })}</div>
      <div class="finCard"><div class="finH"><b>Dividend growth %</b></div>${chart(yrs, [{ name: 'Growth %', c: 'var(--up)', colorFn: (i, v) => v >= 0 ? 'var(--up)' : 'var(--dn)', vals: grow }], { fmt: 'pct', half: 1 })}</div></div>
      <div class="finCard"><div class="finH"><b>Payment history</b></div><table class="finT"><thead><tr><th>Ex-dividend date</th><th>Amount per share</th><th>Change</th></tr></thead><tbody>${dv.slice(-16).reverse().map((x, i, arr) => { const pv = arr[i + 1]; return `<tr><td>${esc(dt(x.t))}</td><td>${num(x.amt, 4)}</td><td>${pv ? sp((x.amt / pv.amt - 1) * 100) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function earnings() {
    const e = epsRev('eps'), r = epsRev('rev');
    return `<div class="finCard finNext"><b>Next earnings:</b> ${D.next.date ? esc(dt(D.next.date)) : '—'}${D.next.eps != null ? ` · EPS estimate <b>${num(D.next.eps)}</b>` : ''}${D.next.rev != null ? ` · Revenue estimate <b>${big(D.next.rev)}</b>` : ''}</div>` +
      repEst('Earnings per share', e.labels, e.rep, e.est, 'eps', e.fcFrom, P.per === 'annual' ? 'Yahoo has estimates for past quarters, so past fiscal years show reported only' : '') + repEst('Revenue', r.labels, r.rep, r.est, 'rev', r.fcFrom);
  }
  function segCard(title, list) {
    if (!list || !list.length) return `<div class="finCard"><div class="finH"><b>${esc(title)}</b></div><div class="mut small">${esc(D.segments.note || 'No segment data for this symbol.')}</div></div>`;
    const l = list[0], tot = l.data.reduce((s, x) => s + x[1], 0) || 1, C = ['var(--blu)', 'var(--amb)', 'var(--up)', '#c586ff', 'var(--yel)', '#ff5fd2', '#00e5ff', 'var(--dn)', 'var(--mut)'];
    return `<div class="finCard"><div class="finH"><b>${esc(title)}</b><span class="mut small">Period: ${esc(l.year)}</span></div><div class="finStack">${l.data.map((x, i) => `<i style="width:${x[1] / tot * 100}%;background:${C[i % C.length]}" title="${esc(x[0])}"></i>`).join('')}</div>
      <div class="finConv">${l.data.map((x, i) => `<div><span><i class="dot" style="background:${C[i % C.length]}"></i>${esc(x[0])}</span><i style="width:${x[1] / l.data[0][1] * 100}%;background:${C[i % C.length]}"></i><b>${big(x[1])} · ${pct(x[1] / tot * 100, 1)}</b></div>`).join('')}</div></div>`;
  }
  function segments() {
    const tbl = (title, list) => { if (!list || !list.length) return ''; const names = [...new Set(list.flatMap(y => y.data.map(x => x[0])))], yrs = list.slice().reverse();
      return `<div class="finCard"><div class="finH"><b>${esc(title)} over time</b></div><table class="finT"><thead><tr><th>Currency: ${esc(D.finCcy)}</th>${yrs.map(y => `<th>${esc(y.year)}</th>`).join('')}</tr></thead><tbody>${names.map(n => `<tr><td>${esc(n)}</td>${yrs.map(y => { const v = (y.data.find(x => x[0] === n) || [])[1]; return `<td>${big(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`; };
    return `<div class="finGrid2">${segCard('By source / business', D.segments.product)}${segCard('By country', D.segments.geo)}</div>` + tbl('By source / business', D.segments.product) + tbl('By country', D.segments.geo);
  }
  const PAGES = { ov: overview, st: statements, stat: statistics, est: estimates, div: dividends, earn: earnings, seg: segments };
  function draw() {
    if (!root) return; CW = Math.max(420, ($f('#finBody').clientWidth || 1200) - 24); $f('#finTabs').innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" class="${P.tab === k ? 'on' : ''}">${l}</button>`).join('');
    $f('#finPer').innerHTML = ['annual', 'quarterly'].map(k => `<button data-per="${k}" class="${P.per === k ? 'on' : ''}">${k === 'annual' ? 'Annual' : 'Quarterly'}</button>`).join('');
    $f('#finPer').style.visibility = ['div', 'seg'].includes(P.tab) ? 'hidden' : '';
    if (!D) { $f('#finBody').innerHTML = `<div class="mut finEmpty">${busy ? 'Loading financials…' : 'Type a ticker (e.g. NVDA, 700 HK) and press Enter, or use NVDA FA in the command line.'}</div>`; return; }
    $f('#finName').innerHTML = `<b>${esc(D.name)}</b> <span class="mut">${esc(D.symbol)}${D.exch ? ' · ' + esc(D.exch) : ''}</span> ${D.price != null ? `<b>${num(D.price)}</b> <span class="mut small">${esc(D.currency)}</span>` : ''}`;
    try { $f('#finBody').innerHTML = PAGES[P.tab]() + `<div class="mut small finSrc">Source: ${esc(D.src)} · ${esc(fmtLocal ? fmtLocal(D.time) : '')}${D.errors && D.errors.length ? ' · missing: ' + esc(D.errors.join('; ')) : ''}. Figures as reported, in ${esc(D.finCcy)}. Research only.</div>`; }
    catch (e) { $f('#finBody').innerHTML = `<div class="dn finEmpty">Could not draw this page: ${esc(String(e.message || e))}</div>`; }
  }
  async function load(sym) {
    sym = String(sym || '').trim(); if (!sym) return; P.sym = sym; save(); $f('#finSym').value = sym; busy = true; D = null; draw();
    const r = await api.fin(sym); busy = false; if (P.sym !== sym) return;
    if (!r || r.error) { $f('#finName').textContent = ''; $f('#finBody').innerHTML = `<div class="dn finEmpty">${esc((r && r.error) || 'No data')}</div>`; return; }
    D = r; draw();
  }
  function init() {
    root = document.getElementById('v-fin'); if (!root || root.dataset.ready) return; root.dataset.ready = 1;
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (root.classList.contains('on') && D) draw(); }, 200); });
    root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { P.tab = b.dataset.tab; save(); draw(); } else if (b.dataset.per) { P.per = b.dataset.per; save(); draw(); } else if (b.dataset.stmt) { P.stmt = b.dataset.stmt; save(); draw(); } else if (b.id === 'finReload') load(P.sym); });
    $f('#finSym').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') load(typeof resolve === 'function' ? resolveTicker($f('#finSym').value) : $f('#finSym').value); });
  }
  function resolveTicker(t) { try { const w = String(t).trim().toUpperCase().split(/\s+/); const m = withMarket(w); return resolve(m[0], null); } catch (e) { return String(t).trim().toUpperCase(); } }
  function show(sym) { init(); const want = sym || P.sym || (typeof activeChart === 'function' && activeChart() ? activeChart().p.sym : '') || 'AAPL'; if (want !== P.sym || !D) load(want); else draw(); }
  return { show, load, get data() { return D; }, get state() { return P; } };
})();
