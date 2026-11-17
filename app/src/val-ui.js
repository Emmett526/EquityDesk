'use strict';
// VAL (tab 6): valuation, forecasts and fundamentals for one stock, in sub-tabs:
//   Summary · DCF · Relative valuation · Discount rate · Forecasts · Fundamentals (profitability, solvency, economic moat)
// - DCF: ten years of free cash flow (five years at a starting growth rate, five years fading to a terminal rate),
//   discounted at a cost of capital built from the stock's beta, plus a terminal value. Bear / base / bull scenarios,
//   every assumption can be changed, and a sensitivity grid shows how the value moves with discount rate and terminal growth.
// - Multiples (P/E, EV/EBITDA, FCF yield...) and the Wall Street view (consensus rating, price targets, estimates).
// Data: the same Yahoo Finance answer as FIN (api.fin, cached 30 minutes in the main process), so opening VAL costs no
// extra calls. Text is written in English and Traditional Chinese here (the container is skipped by i18n.js).
// A model estimate for research, not financial advice and not a price forecast.
const ValScreen = (() => {
  const P = { sym: '', sc: 'base', tab: 'sum' };
  try { Object.assign(P, JSON.parse(localStorage.getItem('valState') || '{}')); } catch (e) {}
  let D = null, root = null, busy = false, fxRate = 1, ov = {};   // ov: the user's own assumptions for this symbol
  const $v = s => root.querySelector(s);
  const save = () => { try { localStorage.setItem('valState', JSON.stringify({ sym: P.sym, sc: P.sc, tab: P.tab })); } catch (e) {} };
  const zh = () => !!(window.I18N && I18N.lang === 'zh-HK');
  const L = (en, z) => (zh() ? z : en);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fin = v => v != null && Number.isFinite(+v);
  const n2 = (v, d = 2) => fin(v) ? (+v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const pc = (v, d = 1) => fin(v) ? (v * 100).toFixed(d) + '%' : '—';
  const sp = (v, d = 1) => fin(v) ? (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%' : '—';
  const big = v => { if (!fin(v)) return '—'; const a = Math.abs(v), s = v < 0 ? '−' : ''; return s + (a >= 1e12 ? (a / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : a.toFixed(0)); };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const last = arr => { if (!Array.isArray(arr)) return null; for (let i = arr.length - 1; i >= 0; i--) if (fin(arr[i])) return +arr[i]; return null; };
  const RF = 0.0425, ERP = 0.05, KD = 0.055, TAX = 0.21;   // risk-free rate, equity risk premium, pre-tax cost of debt, tax rate

  // ---- the model's starting point, from the data ----
  function defaults() {
    const fd = D.fd || {}, ks = D.ks || {}, an = (D.annual && D.annual.rows) || {}, notes = [];
    let fcf = fin(fd.fcf) ? fd.fcf : last(an.FreeCashFlow), fcfSrc = fin(fd.fcf) ? 'ttm' : 'annual';
    if (!(fcf > 0)) { const ni = last(an.NetIncome); if (ni > 0) { fcf = ni * 0.8; fcfSrc = 'ni'; } }
    // growth for years 1-5: analysts' revenue growth for next year, else this year, else the last reported growth
    const tr = k => (D.trend || []).find(t => t.period === k) || {};
    const gNext = fin(tr('+1y').rev) && tr('+1y').revYago ? tr('+1y').rev / tr('+1y').revYago - 1 : null;
    const gNow = fin(tr('0y').rev) && tr('0y').revYago ? tr('0y').rev / tr('0y').revYago - 1 : null;
    let g = [gNext, gNow, fd.revGrowth].find(fin), gSrc = g === gNext ? 'est1y' : g === gNow ? 'est0y' : g != null ? 'hist' : 'none';
    if (g == null) g = 0.06; g = clamp(g, -0.3, 0.5);
    // growth by year 5: analysts' long-term (5-year) growth if Yahoo has it, else the year-1 rate capped at 8%.
    // A one-year estimate is never carried for five years (it overstates cyclical stocks at a peak).
    const ltg = (tr('+5y') || {}).growth, gL = fin(ltg) ? clamp(ltg, 0, 0.15) : clamp(g, 0, 0.08), gLSrc = fin(ltg) ? 'ltg' : 'cap';
    // free cash flow margin: today's, fading over five years to halfway between today's and its usual (median) level,
    // so record (or very poor) margins are not assumed to last forever
    const Y = years(), rev = fin(fd.rev) && fd.rev > 0 ? fd.rev : (Y.slice(-1)[0] || {}).rev;
    const hm = Y.filter(y => fin(y.fcf) && y.rev > 0).map(y => y.fcf / y.rev), mHist = hm.length >= 3 ? med(hm) : null;
    const m0 = fin(fcf) && rev > 0 ? fcf / rev : null, m = m0 == null ? null : mHist == null ? m0 : Math.max((m0 + mHist) / 2, Math.min(m0, 0.02));
    const ly = years().slice(-1)[0] || {}, beta = clamp(fin(ks.beta) ? ks.beta : 1, 0.4, 2.5), debt = fin(fd.debt) ? fd.debt : ly.debt || 0, cash = fin(fd.cash) ? fd.cash : ly.cash || 0;
    let shares = ks.shares; if (!(shares > 0)) shares = last(an.DilutedAverageShares) || last(an.OrdinarySharesNumber);
    if (fcfSrc === 'ni') notes.push(L('Free cash flow is not positive, so 80% of net income is used as the starting cash flow.', '自由現金流不是正數，所以用淨利潤的 80% 作起點現金流。'));
    if (m0 != null && mHist != null && Math.abs(m0 - mHist) > 0.05) notes.push(L(`Free cash flow margin is ${pc(m0)} now against a usual ${pc(mHist)}, so the model fades it to ${pc(m)} over five years.`, `目前自由現金流利潤率為 ${pc(m0)}，一般水平為 ${pc(mHist)}，所以模型在五年內把它調整至 ${pc(m)}。`));
    return { fcf, fcfSrc, rev, m0, m, mHist, g, gSrc, gL, gLSrc, gT: 0.025, rf: RF, erp: ERP, beta, kd: KD, tax: TAX, debt, cash, shares, notes };
  }
  // a scenario's assumptions: base = defaults (or the user's own numbers), bear and bull move growth and the discount rate
  // cost of capital (CAPM for equity, after-tax cost of debt, weights at market value of equity and book value of debt)
  function wacc(b) {
    const mcapF = D.mcap > 0 ? D.mcap / (fxRate || 1) : 0, wd = mcapF > 0 ? b.debt / (b.debt + mcapF) : 0, ke = b.rf + b.beta * b.erp, kdA = b.kd * (1 - b.tax);
    return { ke, kdA, wd, we: 1 - wd, raw: ke * (1 - wd) + kdA * wd, r: clamp(ke * (1 - wd) + kdA * wd, 0.05, 0.2) };
  }
  function assume(sc) {
    const b = Object.assign(defaults(), ov); Object.assign(b, wacc(b)); if (ov.r != null) b.r = ov.r;
    if (sc === 'bear') return Object.assign({}, b, { g: Math.min(b.g * 0.6, b.g - 0.04), gL: Math.max(-0.02, b.gL - 0.02), m: b.m * 0.8, r: b.r + 0.01, gT: Math.max(0.01, b.gT - 0.005) });
    if (sc === 'bull') return Object.assign({}, b, { g: Math.max(b.g * 1.4, b.g + 0.04), gL: b.gL + 0.02, m: b.m * 1.15, r: Math.max(0.05, b.r - 0.01), gT: b.gT + 0.005 });
    return b;
  }
  // ten-year DCF -> value per share in the price currency
  function dcf(a) {
    if (!(a.rev > 0) || !fin(a.m0) || !(a.m > 0) || !(a.shares > 0) || !(a.r > a.gT)) return null;
    // revenue: year-1 growth fades to the year-5 rate, then to terminal growth by year 10; FCF = revenue x margin
    const rows = []; let rv = a.rev, pvSum = 0;
    for (let y = 1; y <= 10; y++) {
      const g = y <= 5 ? a.g + (a.gL - a.g) * (y - 1) / 4 : a.gL + (a.gT - a.gL) * (y - 5) / 5; rv *= 1 + g;
      const m = y <= 5 ? a.m0 + (a.m - a.m0) * y / 5 : a.m, f = rv * m;
      const df = 1 / Math.pow(1 + a.r, y), pv = f * df; pvSum += pv; rows.push({ y, g, rv, m, f, df, pv });
    }
    const tv = rows[9].f * (1 + a.gT) / (a.r - a.gT), pvTv = tv * rows[9].df, ev = pvSum + pvTv, eq = ev + a.cash - a.debt;
    return { rows, pvSum, tv, pvTv, ev, eq, ps: eq / a.shares * fxRate, tvShare: pvTv / ev };
  }
  const verdict = up => !fin(up) ? ['—', ''] : up > 0.15 ? [L('Undervalued', '估值偏低'), 'up'] : up < -0.15 ? [L('Overvalued', '估值偏高'), 'dn'] : [L('Fairly valued', '估值合理'), ''];
  const recLabel = m => !fin(m) ? '—' : m <= 1.5 ? L('Strong buy', '強烈買入') : m <= 2.5 ? L('Buy', '買入') : m <= 3.5 ? L('Hold', '持有') : m <= 4.5 ? L('Sell', '賣出') : L('Strong sell', '強烈賣出');

  // ---- drawing ----
  function card(title, body, cls = '') { return `<div class="finCard valCard ${cls}"><div class="finH"><b>${title}</b></div>${body}</div>`; }
  function rangeBar(lo, hi, marks) {   // horizontal scale from lo to hi with labelled marks [{v, label, cls}]
    if (!fin(lo) || !fin(hi) || hi <= lo) return '';
    const pad = (hi - lo) * 0.08, a = lo - pad, b = hi + pad, x = v => clamp((v - a) / (b - a) * 100, 0, 100);
    // labels go below, above, then further below the bar, so close values never overlap
    const tops = [40, -4, 68], last = [-99, -99, -99], ms = marks.filter(m => fin(m.v)).map(m => Object.assign({ x: x(m.v) }, m)).sort((p, q) => p.x - q.x);
    for (const m of ms) { let r = last.findIndex(l => m.x - l >= 11); if (r < 0) r = last.indexOf(Math.min(...last)); m.row = r; last[r] = m.x; }
    const deep = ms.some(m => m.row === 2);
    return `<div class="valBar"${deep ? ' style="margin-bottom:40px"' : ''}><div class="valBarTrack" style="left:${x(lo)}%;right:${100 - x(hi)}%"></div>` +
      ms.map(m => `<div class="valMark ${m.cls || ''}" style="left:${m.x}%"><i></i><span style="top:${tops[m.row]}px">${esc(m.label)}<br><b>${n2(m.v)}</b></span></div>`).join('') + '</div>';
  }
  function chart(res) {   // projected free cash flow (light) and its present value (solid)
    const W = 620, H = 170, pad = 30, rows = res.rows, mx = Math.max(...rows.map(r => r.f)) || 1, bw = (W - pad * 2) / rows.length;
    const y = v => H - 22 - (v / mx) * (H - 40);
    let g = rows.map((r, i) => { const x = pad + i * bw + 4;
      return `<rect x="${x}" y="${y(r.f)}" width="${bw - 8}" height="${H - 22 - y(r.f)}" class="vcF"><title>${L('Year', '第')} ${r.y}${L('', ' 年')}: FCF ${big(r.f)}</title></rect>` +
        `<rect x="${x + (bw - 8) * 0.25}" y="${y(r.pv)}" width="${(bw - 8) * 0.5}" height="${H - 22 - y(r.pv)}" class="vcP"><title>PV ${big(r.pv)}</title></rect>` +
        `<text x="${x + (bw - 8) / 2}" y="${H - 6}" text-anchor="middle">${L('Y', '')}${r.y}${L('', '年')}</text>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="valChart">${g}</svg><div class="mut small valLeg"><i class="vcF"></i> ${L('Projected free cash flow', '預測自由現金流')} <i class="vcP"></i> ${L('Present value', '現值')}</div>`;
  }
  function sens(a, price) {
    const rs = [-0.02, -0.01, 0, 0.01, 0.02].map(d => a.r + d).filter(r => r > 0.03), gs = [-0.01, -0.005, 0, 0.005, 0.01].map(d => a.gT + d);
    const head = `<tr><th>${L('Terminal growth ↓ · Discount rate →', '永續增長 ↓ · 折現率 →')}</th>${rs.map(r => `<th>${pc(r)}</th>`).join('')}</tr>`;
    const body = gs.map(gT => `<tr><th>${pc(gT)}</th>${rs.map(r => { const v = dcf(Object.assign({}, a, { r, gT })); const ps = v && v.ps;
      const c = !fin(ps) || !fin(price) ? '' : ps > price * 1.15 ? 'up' : ps < price * 0.85 ? 'dn' : '';
      return `<td class="${c}${Math.abs(r - a.r) < 1e-9 && Math.abs(gT - a.gT) < 1e-9 ? ' valMe' : ''}">${fin(ps) ? n2(ps) : '—'}</td>`; }).join('')}</tr>`).join('');
    return `<table class="valTbl valWide valSens">${head}${body}</table>`;
  }
  const field = (k, label, v, step, tip, raw) => `<label title="${esc(tip)}"><span>${label}</span><input type="number" step="${step}" data-k="${k}"${raw ? ' data-raw="1"' : ''} value="${fin(v) ? (raw ? Math.round(v) : +(+v).toFixed(2)) : ''}"${ov[k] != null ? ' class="valMine"' : ''}></label>`;
  const facts = list => `<div class="valFacts">${list.map(([l, v, c]) => `<div><span class="mut">${l}</span><b class="${c || ''}">${v}</b></div>`).join('')}</div>`;
  const resetBtn = () => `<button class="btn sm" data-act="reset">${L('Reset to data', '還原數據預設')}</button>`;
  const grade = (v, good, ok, hiBetter = true) => !fin(v) ? '' : (hiBetter ? v >= good : v <= good) ? 'up' : (hiBetter ? v >= ok : v <= ok) ? '' : 'dn';
  const avg = a => { const x = a.filter(fin); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
  const med = a => { const x = a.filter(fin).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
  const sd = a => { const x = a.filter(fin), m = avg(x); return x.length > 1 ? Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1)) : null; };

  // ---- per-year history from the annual statements (financial currency) ----
  function years() {
    const an = D.annual || { dates: [], rows: {} }, R = k => (an.rows || {})[k] || [];
    return (an.dates || []).map((d, i) => { const v = k => fin(R(k)[i]) ? +R(k)[i] : null;
      const rev = v('TotalRevenue'), ni = v('NetIncome'), eq = v('StockholdersEquity'), debt = v('TotalDebt'), ebit = v('EBIT') ?? v('OperatingIncome'), cash = v('CashCashEquivalentsAndShortTermInvestments') ?? v('CashAndCashEquivalents');
      const ie = v('InterestExpense'), tax = v('TaxProvision'), pre = v('PretaxIncome'), tr = pre > 0 && tax != null ? clamp(tax / pre, 0, 0.4) : 0.21;
      const ic = (eq || 0) + (debt || 0) - (cash || 0);
      return { d, rev, gp: v('GrossProfit'), op: v('OperatingIncome'), ni, fcf: v('FreeCashFlow'), eps: v('DilutedEPS'), sh: v('DilutedAverageShares') ?? v('OrdinarySharesNumber'), eq, debt, cash, ebit, ebitda: v('EBITDA'), ie: ie != null ? Math.abs(ie) : null,
        ca: v('CurrentAssets'), cl: v('CurrentLiabilities'), ta: v('TotalAssets'), tl: v('TotalLiabilitiesNetMinorityInterest'),
        roic: ebit != null && ic > 0 ? ebit * (1 - tr) / ic : null, roe: ni != null && eq > 0 ? ni / eq : null };
    });
  }
  // price at (or just before) a date, from the month-end closes
  function pxAt(d) { const t = Date.parse(d) / 1000, px = D.px || []; let best = null; for (const [ts, c] of px) { if (ts <= t + 20 * 86400) best = c; else break; } return best; }

  // ---- relative valuation: the stock against its own history (yearly multiples at each fiscal year end) ----
  function relative() {
    const Y = years(), fx = fxRate, price = D.price, out = { rows: [], methods: [] };
    Y.forEach(y => { const p = pxAt(y.d); if (!fin(p)) return;
      out.rows.push({ d: y.d, p, pe: y.eps > 0 ? p / (y.eps * fx) : null, ps: y.rev > 0 && y.sh > 0 ? p / (y.rev / y.sh * fx) : null, pfcf: y.fcf > 0 && y.sh > 0 ? p / (y.fcf / y.sh * fx) : null }); });
    const lastY = Y[Y.length - 1] || {}, sh = (D.ks && D.ks.shares) || lastY.sh;
    const eps = fin(D.ks && D.ks.teps) ? D.ks.teps : lastY.eps != null ? lastY.eps * fx : null;
    const revPs = fin(D.fd && D.fd.rev) && sh > 0 ? D.fd.rev / sh * fx : lastY.rev > 0 && lastY.sh > 0 ? lastY.rev / lastY.sh * fx : null;
    const fcfPs = fin(D.fd && D.fd.fcf) && sh > 0 ? D.fd.fcf / sh * fx : lastY.fcf > 0 && lastY.sh > 0 ? lastY.fcf / lastY.sh * fx : null;
    // at a profit peak (margins far above their usual level) a usual multiple times peak earnings overstates value,
    // so earnings and cash flow are scaled back halfway to the usual margin for these methods
    const nmH = med(Y.filter(y => fin(y.ni) && y.rev > 0).map(y => y.ni / y.rev)), nmNow = D.fd && D.fd.nm;
    const kE = Y.length >= 3 && nmH > 0 && nmNow > nmH * 1.5 ? (nmH + nmNow) / 2 / nmNow : 1;
    const fm = Y.filter(y => fin(y.fcf) && y.rev > 0).map(y => y.fcf / y.rev), fmH = med(fm), fmNow = fcfPs > 0 && revPs > 0 ? fcfPs / revPs : null;
    const kF = fm.length >= 3 && fmH > 0 && fmNow > fmH * 1.5 ? (fmH + fmNow) / 2 / fmNow : 1;
    out.peak = kE < 1 || kF < 1; out.nmH = nmH; out.nmNow = nmNow;
    const add = (key, name, nowMult, base) => { const m = med(out.rows.map(r => r[key]).filter(v => v > 0 && v < 500)); if (!fin(m) || !(base > 0)) return; out.methods.push({ key, name, now: nowMult, med: m, implied: m * base }); };
    add('pe', L('Price / earnings', '市盈率'), D.sd && D.sd.pe, eps * kE);
    add('ps', L('Price / sales', '市銷率'), D.sd && D.sd.ps, revPs);
    add('pfcf', L('Price / free cash flow', '股價 / 自由現金流'), fcfPs > 0 && fin(price) ? price / fcfPs : null, fcfPs * kF);
    const fpe = D.ks && D.ks.fpe, feps = D.ks && D.ks.feps, mPe = (out.methods.find(m => m.key === 'pe') || {}).med;
    if (fin(mPe) && feps > 0) out.methods.push({ key: 'fpe', name: L('Forward earnings × usual P/E', '預測盈利 × 一般市盈率'), now: fpe, med: mPe, implied: mPe * feps * kE });
    out.value = med(out.methods.map(m => m.implied)); return out;
  }

  // ---- moat indicators: a transparent score from long-run returns and margins (an estimate, not a rating agency view) ----
  function moat() {
    const Y = years().filter(y => y.rev > 0), pts = [], add = (ok, en, z, why) => pts.push({ ok, t: L(en, z), why });
    const roic = Y.map(y => y.roic), gm = Y.map(y => y.gp != null ? y.gp / y.rev : null), fm = Y.map(y => y.fcf != null ? y.fcf / y.rev : null), om = Y.map(y => y.op != null ? y.op / y.rev : null);
    const aRoic = avg(roic), aGm = avg(gm), sGm = sd(gm), aFm = avg(fm), first = Y[0], lastY = Y[Y.length - 1];
    const cagr = first && lastY && Y.length > 1 && first.rev > 0 ? Math.pow(lastY.rev / first.rev, 1 / (Y.length - 1)) - 1 : null;
    add(aRoic > 0.12 && roic.filter(v => v > 0.1).length >= Math.max(1, roic.filter(fin).length - 1), 'Returns on capital above 12% year after year', '資本回報率長期高於 12%', pc(aRoic));
    add(aRoic > 0.2, 'Returns on capital above 20%', '資本回報率高於 20%', pc(aRoic));
    add(aGm > 0.4, 'Gross margin above 40% (pricing power)', '毛利率高於 40%（定價能力）', pc(aGm));
    add(fin(sGm) && sGm < 0.04, 'Stable gross margin (within ±4 points)', '毛利率穩定（±4 個百分點內）', fin(sGm) ? '±' + (sGm * 100).toFixed(1) + L(' pts', ' 點') : '—');
    add(cagr > 0.05, 'Revenue growing more than 5% a year', '收入每年增長超過 5%', pc(cagr));
    add(aFm > 0.1, 'Free cash flow above 10% of revenue', '自由現金流高於收入的 10%', pc(aFm));
    const score = pts.filter(p => p.ok).length, known = Y.length >= 2;
    const lvl = !known ? '—' : score >= 5 ? L('Wide', '寬闊') : score >= 3 ? L('Narrow', '狹窄') : L('None found', '未見護城河');
    return { pts, score, lvl, cls: !known ? '' : score >= 5 ? 'up' : score >= 3 ? '' : 'dn', yrs: Y.length, om };
  }

  // ---- pages ----
  function pgSummary(ctx) {
    const { res, cur, price, ccy, up, vt, vc, tUp, rel, mo, a, fd } = ctx, scName = { bear: L('bear case', '悲觀情境'), base: L('base case', '基本情境'), bull: L('bull case', '樂觀情境') }[P.sc];
    const relUp = fin(rel.value) && fin(price) ? rel.value / price - 1 : null;
    const blend = avg([cur && cur.ps, rel.value]), bUp = fin(blend) && fin(price) ? blend / price - 1 : null, [bt, bc] = verdict(bUp);
    let o = card(L('Valuation summary', '估值摘要'), `<div class="valSum">` +
      `<div><span class="mut">${L('Intrinsic value', '內在價值')}</span><b class="valBig ${bc}">${n2(blend)} <small>${esc(ccy)}</small></b><span class="small ${bUp >= 0 ? 'up' : 'dn'}">${sp(bUp)} · ${bt}</span></div>` +
      `<div><span class="mut">${L('DCF value', '現金流折現價值')} (${scName})</span><b class="valBig">${n2(cur && cur.ps)}</b><span class="small ${up >= 0 ? 'up' : 'dn'}">${sp(up)}</span></div>` +
      `<div><span class="mut">${L('Relative value', '相對估值')}</span><b class="valBig">${n2(rel.value)}</b><span class="small ${relUp >= 0 ? 'up' : 'dn'}">${sp(relUp)}</span></div>` +
      `<div><span class="mut">${L('Price', '股價')}</span><b class="valBig">${n2(price)}</b></div>` +
      `<div><span class="mut">${L('Analyst target (mean)', '分析師目標價（平均）')}</span><b class="valBig">${n2(fd.tMean)}</b><span class="small ${tUp >= 0 ? 'up' : 'dn'}">${sp(tUp)} · ${recLabel(fd.recMean)}</span></div>` +
      `<div><span class="mut">${L('Economic moat', '經濟護城河')}</span><b class="valBig ${mo.cls}">${mo.lvl}</b><span class="mut small">${mo.score} / 6</span></div></div>` +
      rangeBar(Math.min(...[res.bear && res.bear.ps, rel.value, fd.tLow, price].filter(fin)), Math.max(...[res.bull && res.bull.ps, rel.value, fd.tHigh, price].filter(fin)),
        [{ v: res.bear && res.bear.ps, label: L('DCF bear', 'DCF 悲觀'), cls: 'dnM' }, { v: res.base && res.base.ps, label: L('DCF base', 'DCF 基本'), cls: 'baseM' }, { v: res.bull && res.bull.ps, label: L('DCF bull', 'DCF 樂觀'), cls: 'upM' }, { v: rel.value, label: L('Relative', '相對'), cls: 'relM' }, { v: price, label: L('Price', '股價'), cls: 'pxM' }]) +
      `<div class="mut small">${L('Intrinsic value is the average of the DCF value (selected case) and the relative value. Within ±15% of the price counts as fairly valued.', '內在價值是現金流折現價值（所選情境）與相對估值的平均。與股價相差 ±15% 以內視為估值合理。')}${a.notes.map(x => ' ' + esc(x)).join('')}</div>`, 'wide');
    o += pgMultiplesCard(ctx);
    return o;
  }
  function pgMultiplesCard({ fd, ks, sdd, ccy }) {
    const fcfY = fin(fd.fcf) && D.mcap > 0 ? fd.fcf * fxRate / D.mcap : null;
    return card(L('Multiples today', '目前估值倍數'), facts([[L('P/E (trailing)', '市盈率（過去）'), n2(sdd.pe)], [L('P/E (forward)', '市盈率（預測）'), n2(ks.fpe)], ['PEG', n2(ks.peg)], [L('Price / sales', '市銷率'), n2(sdd.ps)], [L('Price / book', '市賬率'), n2(ks.pb)], ['EV / EBITDA', n2(ks.evEbitda)], [L('EV / revenue', '企業價值 / 收入'), n2(ks.evRev)], [L('FCF yield', '自由現金流收益率'), pc(fcfY)], [L('Dividend yield', '股息率'), pc(sdd.divYield, 2)], [L('Market cap', '市值'), big(D.mcap) + ' ' + ccy]]));
  }
  function pgDcf({ cur, a, price, ccy }) {
    const inp = `<div class="valInputs">` +
      field('g', L('Revenue growth, year 1 (%)', '第 1 年收入增長（%）'), a.g * 100, 0.5, L('Next year. Growth then moves in a straight line to the year-5 rate.', '明年的增長，之後按直線調整至第 5 年的增長率。')) +
      field('gL', L('Revenue growth, year 5 (%)', '第 5 年收入增長（%）'), a.gL * 100, 0.5, L('Long-run growth reached by year 5. Years 6-10 fade to terminal growth.', '第 5 年達到的長期增長，第 6-10 年逐步降至永續增長。')) +
      field('m', L('FCF margin, year 5 on (%)', '第 5 年起自由現金流利潤率（%）'), a.m * 100, 0.5, L("Free cash flow as a share of revenue once things settle. Today's margin moves to this over five years.", '自由現金流佔收入的比例（長期水平）。目前的利潤率會在五年內調整至此。')) +
      field('gT', L('Terminal growth (%)', '永續增長（%）'), a.gT * 100, 0.25, L('Growth after year 10, forever. Usually close to long-run inflation, 2-3%.', '第 10 年後的永續增長，一般接近長期通脹，即 2-3%。')) +
      field('r', L('Discount rate (%)', '折現率（%）'), a.r * 100, 0.25, L('From the Discount rate tab; type here to override it.', '來自「折現率」分頁；在此輸入可直接覆蓋。')) +
      resetBtn() + `</div><div class="mut small">${L('Start: revenue', '起點：收入')} ${big(a.rev)} ${esc(D.finCcy)} · ${L('free cash flow', '自由現金流')} ${big(a.fcf)} (${L('margin', '利潤率')} ${pc(a.m0)}${fin(a.mHist) ? ', ' + L('usual', '一般') + ' ' + pc(a.mHist) : ''})</div>`;
    if (!cur) return card(L('Discounted cash flow model', '現金流折現模型'), inp + `<div class="mut">${L('A cash-flow valuation is not meaningful here: no positive free cash flow or net income, missing share count, or a discount rate at or below terminal growth. Try Relative valuation instead, or type your own FCF margin.', '這裏不適合用現金流估值：沒有正數的自由現金流或淨利潤、缺少股數，或折現率不高於永續增長。可改看「相對估值」，或自行輸入自由現金流利潤率。')}</div>`, 'wide');
    const fx = fxRate !== 1 ? `<div class="mut small">${L(`Financials are reported in ${D.finCcy}; values are converted to ${ccy} at ${n2(fxRate, 4)}.`, `財務數據以 ${D.finCcy} 申報，按 ${n2(fxRate, 4)} 換算為 ${ccy}。`)}</div>` : '';
    const gSrc = { est1y: L("analysts' revenue growth estimate for next year", '分析師對明年收入增長的預測'), est0y: L("analysts' revenue growth estimate for this year", '分析師對今年收入增長的預測'), hist: L('last reported revenue growth', '最近公布的收入增長'), none: L('a default 6% (no estimate available)', '預設 6%（沒有預測數據）') }[a.gSrc] + '; ' + (a.gLSrc === 'ltg' ? L("year-5 growth from analysts' 5-year estimate", '第 5 年增長來自分析師的五年預測') : L('year-5 growth is the year-1 rate capped at 0-8%', '第 5 年增長為第 1 年增長，限制在 0-8%'));
    return card(L('Discounted cash flow model', '現金流折現模型'), inp +
      `<div class="mut small">${L('Starting growth from', '起點增長來自')} ${gSrc}${ov.g != null ? L(' (changed by you)', '（已由你修改）') : ''}. ${P.sc !== 'base' ? L('Bear and bull move growth, the margin, the discount rate and terminal growth from the base numbers.', '悲觀及樂觀情境會按基本數字調整增長、利潤率、折現率及永續增長。') : ''}</div>` + fx + chart(cur) +
      `<table class="valTbl"><tr><th>${L('Year', '年')}</th>${cur.rows.map(r => `<th>${r.y}</th>`).join('')}</tr>` +
      `<tr><th>${L('Revenue growth', '收入增長')}</th>${cur.rows.map(r => `<td>${pc(r.g)}</td>`).join('')}</tr><tr><th>${L('Revenue', '收入')}</th>${cur.rows.map(r => `<td>${big(r.rv)}</td>`).join('')}</tr><tr><th>${L('FCF margin', '自由現金流利潤率')}</th>${cur.rows.map(r => `<td>${pc(r.m)}</td>`).join('')}</tr><tr><th>FCF</th>${cur.rows.map(r => `<td>${big(r.f)}</td>`).join('')}</tr>` +
      `<tr><th>${L('Discount factor', '折現系數')}</th>${cur.rows.map(r => `<td>${r.df.toFixed(3)}</td>`).join('')}</tr><tr><th>${L('Present value', '現值')}</th>${cur.rows.map(r => `<td>${big(r.pv)}</td>`).join('')}</tr></table>` +
      facts([[L('PV of 10 years of FCF', '十年自由現金流現值'), big(cur.pvSum)], [L('PV of terminal value', '永續價值現值'), big(cur.pvTv) + ' (' + pc(cur.tvShare, 0) + ')'], [L('Enterprise value', '企業價值'), big(cur.ev)], [L('+ Cash − debt', '+ 現金 − 債務'), big(a.cash - a.debt)], [L('Equity value', '股權價值'), big(cur.eq)], [L('Shares', '股數'), big(a.shares)], [L('Value per share', '每股價值'), n2(cur.ps) + ' ' + ccy], [L('vs price', '對比股價'), sp(cur.ps / price - 1), cur.ps >= price ? 'up' : 'dn']]), 'wide') +
      card(L('Sensitivity: value per share', '敏感度：每股價值'), sens(a, price) + `<div class="mut small">${L('Green: more than 15% above the price. Red: more than 15% below. The outlined cell is the current scenario.', '綠色：高於股價 15% 以上；紅色：低於股價 15% 以上；有框的格是目前情境。')}</div>`, 'wide');
  }
  function pgRelative(ctx) {
    const { rel, price, ccy } = ctx, relUp = fin(rel.value) && fin(price) ? rel.value / price - 1 : null;
    const body = rel.methods.length ? `<table class="valTbl valWide"><tr><th>${L('Method', '方法')}</th><th>${L('Today', '目前')}</th><th>${L('Usual (median)', '一般水平（中位數）')}</th><th>${L('Implied price', '推算股價')}</th><th>${L('vs price', '對比股價')}</th></tr>` +
      rel.methods.map(m => { const u = m.implied / price - 1; return `<tr><th>${m.name}</th><td>${n2(m.now, 1)}</td><td>${n2(m.med, 1)}</td><td>${n2(m.implied)}</td><td class="${u >= 0 ? 'up' : 'dn'}">${sp(u)}</td></tr>`; }).join('') +
      `<tr class="valTot"><th>${L('Relative value (median of methods)', '相對估值（各方法中位數）')}</th><td></td><td></td><td>${n2(rel.value)} ${esc(ccy)}</td><td class="${relUp >= 0 ? 'up' : 'dn'}">${sp(relUp)}</td></tr></table>`
      : `<div class="mut">${L('Not enough history to compare multiples (needs yearly earnings, sales or cash flow and prices).', '歷史數據不足以比較倍數（需要每年的盈利、收入或現金流及股價）。')}</div>`;
    const hist = rel.rows.length ? `<table class="valTbl valWide"><tr><th>${L('Fiscal year end', '財政年度結算')}</th><th>${L('Price', '股價')}</th><th>P/E</th><th>P/S</th><th>P/FCF</th></tr>${rel.rows.map(r => `<tr><th>${esc(r.d)}</th><td>${n2(r.p)}</td><td>${n2(r.pe, 1)}</td><td>${n2(r.ps, 1)}</td><td>${n2(r.pfcf, 1)}</td></tr>`).join('')}</table>` : '';
    return card(L('Relative valuation: against its own history', '相對估值：與自身歷史比較'), body + `<div class="mut small">${L('Each method asks: if the stock traded at its usual multiple of the last few years, what would the price be? Peer comparison is not included because the free data has no peer list.', '每個方法都在問：如果股票按過去幾年的一般倍數交易，股價應是多少？由於免費數據沒有同業名單，所以不包括同業比較。')}${rel.peak ? ' ' + L(`Margins are well above their usual level (net margin ${pc(rel.nmNow)} vs a usual ${pc(rel.nmH)}), which often happens at a cycle peak, so earnings and cash flow are scaled back halfway to usual margins before applying the multiples (as the DCF does).`, `利潤率遠高於一般水平（淨利潤率 ${pc(rel.nmNow)}，一般為 ${pc(rel.nmH)}），這常見於周期高峰，所以先把盈利及現金流調低至目前與一般利潤率的中間水平，再套用倍數（與 DCF 做法一致）。`) : ''}</div>`, 'wide') +
      (hist ? card(L('Multiples by year', '每年估值倍數'), hist) : '') + pgMultiplesCard(ctx);
  }
  function pgRate({ a }) {
    return card(L('Discount rate (cost of capital)', '折現率（資金成本）'), `<div class="valInputs">` +
      field('rf', L('Risk-free rate (%)', '無風險利率（%）'), a.rf * 100, 0.05, L('Roughly the 10-year US Treasury yield.', '大約等於美國十年期國債孳息率。')) +
      field('erp', L('Equity risk premium (%)', '股票風險溢價（%）'), a.erp * 100, 0.25, L('Extra return investors want for owning shares instead of bonds; 4-6% is common.', '投資者持有股票而非債券所要求的額外回報，一般為 4-6%。')) +
      field('beta', 'Beta', a.beta, 0.05, L("How much the stock moves with the market (Yahoo's 5-year beta).", '股票相對大市的波動程度（Yahoo 五年 beta）。'), true) +
      field('kd', L('Cost of debt, pre-tax (%)', '債務成本，除稅前（%）'), a.kd * 100, 0.25, L('Interest rate the company pays on its debt.', '公司借貸所付的利率。')) +
      field('tax', L('Tax rate (%)', '稅率（%）'), a.tax * 100, 1, L('Interest is tax-deductible, so debt costs less after tax.', '利息可扣稅，所以除稅後債務成本較低。')) + resetBtn() + `</div>` +
      `<table class="valTbl valWide"><tr><th>${L('Cost of equity', '股本成本')} = ${L('risk-free', '無風險利率')} + beta × ${L('premium', '溢價')}</th><td>${pc(a.rf, 2)} + ${n2(a.beta)} × ${pc(a.erp, 2)}</td><td><b>${pc(a.ke, 2)}</b></td></tr>` +
      `<tr><th>${L('After-tax cost of debt', '除稅後債務成本')}</th><td>${pc(a.kd, 2)} × (1 − ${pc(a.tax, 0)})</td><td><b>${pc(a.kdA, 2)}</b></td></tr>` +
      `<tr><th>${L('Weights: equity / debt', '比重：股本 / 債務')}</th><td>${big(D.mcap)} / ${big(a.debt * fxRate)} ${esc(D.currency)}</td><td><b>${pc(a.we, 0)} / ${pc(a.wd, 0)}</b></td></tr>` +
      `<tr class="valTot"><th>WACC</th><td>${pc(a.ke, 2)} × ${pc(a.we, 0)} + ${pc(a.kdA, 2)} × ${pc(a.wd, 0)}</td><td><b>${pc(a.raw, 2)}</b></td></tr></table>` +
      `<div class="mut small">${L('The DCF uses this rate (kept between 5% and 20%)', 'DCF 使用此折現率（限制在 5% 至 20% 之間）')}${ov.r != null ? L(', but you have typed your own rate in the DCF tab: ', '，但你已在 DCF 分頁輸入自訂折現率：') + pc(ov.r, 2) : ''}.</div>`, 'wide');
  }
  function pgForecast({ fd, price, tUp, ccy }) {
    const rc = (D.rec || [])[0], tot = rc ? rc.sb + rc.b + rc.h + rc.s + rc.ss : 0;
    const dist = tot ? `<div class="valDist">${[[rc.sb, L('Strong buy', '強烈買入'), 'sb'], [rc.b, L('Buy', '買入'), 'b'], [rc.h, L('Hold', '持有'), 'h'], [rc.s, L('Sell', '賣出'), 's'], [rc.ss, L('Strong sell', '強烈賣出'), 'ss']].map(([n, l, c]) => `<div><span>${l}</span><i class="vd-${c}" style="width:${n / tot * 100}%"></i><b>${n}</b></div>`).join('')}</div>` : '';
    const pName = { '0q': L('This quarter', '本季'), '+1q': L('Next quarter', '下季'), '0y': L('This year', '今年'), '+1y': L('Next year', '明年') };
    const tr = (D.trend || []);
    const est = tr.length ? `<table class="valTbl valWide"><tr><th></th>${tr.map(t => `<th>${pName[t.period] || esc(t.period)}${t.end ? `<br><span class="mut small">${esc(t.end)}</span>` : ''}</th>`).join('')}</tr>` +
      [[L('EPS estimate', '每股盈利預測'), t => n2(t.eps)], [L('EPS low – high', '每股盈利 最低 – 最高'), t => n2(t.epsLo) + ' – ' + n2(t.epsHi)], [L('EPS a year ago', '一年前每股盈利'), t => n2(t.epsYago)], [L('EPS growth', '每股盈利增長'), t => fin(t.eps) && t.epsYago ? sp(t.eps / Math.abs(t.epsYago) - (t.epsYago < 0 ? -1 : 1)) : '—'],
       [L('Revenue estimate', '收入預測'), t => big(t.rev)], [L('Revenue growth', '收入增長'), t => fin(t.rev) && t.revYago ? sp(t.rev / t.revYago - 1) : '—'], [L('Analysts', '分析師人數'), t => fin(t.epsN) ? t.epsN : '—']]
        .map(([l, f]) => `<tr><th>${l}</th>${tr.map(t => `<td>${f(t)}</td>`).join('')}</tr>`).join('') + '</table>' : `<div class="mut">${L('No estimates in the data.', '數據中沒有預測。')}</div>`;
    const h = (D.hist || []).slice(-4);
    const hist = h.length ? `<table class="valTbl valWide"><tr><th>${L('Quarter', '季度')}</th><th>${L('Estimate', '預測')}</th><th>${L('Actual', '實際')}</th><th>${L('Surprise', '意外幅度')}</th></tr>${h.map(x => `<tr><th>${esc(fin(x.date) ? new Date(x.date * 1000).toISOString().slice(0, 10) : x.date)}</th><td>${n2(x.est)}</td><td>${n2(x.actual)}</td><td class="${x.surprise >= 0 ? 'up' : 'dn'}">${fin(x.surprise) ? (x.surprise >= 0 ? '+' : '') + x.surprise.toFixed(1) + '%' : '—'}</td></tr>`).join('')}</table>` : '';
    const trend = (D.rec || []).length > 1 ? `<table class="valTbl valWide"><tr><th>${L('Month', '月份')}</th><th>${L('Strong buy', '強烈買入')}</th><th>${L('Buy', '買入')}</th><th>${L('Hold', '持有')}</th><th>${L('Sell', '賣出')}</th><th>${L('Strong sell', '強烈賣出')}</th></tr>${D.rec.map(r => `<tr><th>${{ '0m': L('This month', '本月'), '-1m': L('1 month ago', '1 個月前'), '-2m': L('2 months ago', '2 個月前'), '-3m': L('3 months ago', '3 個月前') }[r.period] || esc(r.period)}</th><td>${r.sb}</td><td>${r.b}</td><td>${r.h}</td><td>${r.s}</td><td>${r.ss}</td></tr>`).join('')}</table>` : '';
    return card(L('Price target forecast', '目標價預測'), fin(fd.tMean) ? `<div class="valSum"><div><span class="mut">${L('Consensus', '綜合評級')}</span><b class="valBig">${recLabel(fd.recMean)}</b><span class="mut small">${fin(fd.recMean) ? n2(fd.recMean) + ' / 5 (1 = ' + L('strong buy', '強烈買入') + ') · ' : ''}${fin(fd.analysts) ? fd.analysts + L(' analysts', ' 位分析師') : ''}</span></div>` +
      [[L('Low', '最低'), fd.tLow], [L('Mean', '平均'), fd.tMean], [L('Median', '中位數'), fd.tMed], [L('High', '最高'), fd.tHigh]].map(([l, v]) => `<div><span class="mut">${l}</span><b class="valBig">${n2(v)}</b><span class="small ${v >= price ? 'up' : 'dn'}">${fin(v) && fin(price) ? sp(v / price - 1) : ''}</span></div>`).join('') + `</div>` +
      rangeBar(Math.min(fd.tLow, price), Math.max(fd.tHigh, price), [{ v: fd.tLow, label: L('Low', '最低'), cls: 'dnM' }, { v: fd.tMean, label: L('Mean', '平均'), cls: 'baseM' }, { v: fd.tHigh, label: L('High', '最高'), cls: 'upM' }, { v: price, label: L('Price', '股價'), cls: 'pxM' }]) + dist +
      `<div class="mut small">${L('12-month price targets from analysts covering the stock, in', '覆蓋該股分析師的 12 個月目標價，貨幣為')} ${esc(ccy)}.</div>` : `<div class="mut">${L('No analyst price targets in the data for this symbol.', '數據中沒有這隻股票的分析師目標價。')}</div>`, 'wide') +
      card(L('Financial estimates', '財務預測'), est, 'wide') + (hist ? card(L('Earnings: estimate vs actual', '盈利：預測對比實際'), hist) : '') + (trend ? card(L('Rating changes', '評級變化'), trend) : '');
  }
  function pgFund({ fd: fd0, mo }) {
    const Y = years(), lastY = Y[Y.length - 1] || {}, r = (k, f) => fin(fd0[k]) ? fd0[k] : f;   // trailing figures from Yahoo, else the last fiscal year
    const fd = Object.assign({}, fd0, { gm: r('gm', lastY.rev > 0 && lastY.gp != null ? lastY.gp / lastY.rev : null), om: r('om', lastY.rev > 0 && lastY.op != null ? lastY.op / lastY.rev : null), nm: r('nm', lastY.rev > 0 && lastY.ni != null ? lastY.ni / lastY.rev : null),
      roe: r('roe', lastY.roe), roa: r('roa', lastY.ta > 0 && lastY.ni != null ? lastY.ni / lastY.ta : null), cr: r('cr', lastY.cl > 0 && lastY.ca != null ? lastY.ca / lastY.cl : null), cash: r('cash', lastY.cash), debt: r('debt', lastY.debt),
      rev: r('rev', lastY.rev), fcf: r('fcf', lastY.fcf), ebitda: r('ebitda', lastY.ebitda) });
    const cov = lastY.ebit != null && lastY.ie > 0 ? lastY.ebit / lastY.ie : null, nd = (fd.debt || 0) - (fd.cash || 0), ndE = fin(fd.ebitda) && fd.ebitda > 0 ? nd / fd.ebitda : null;
    const de = fin(fd.de) ? fd.de / 100 : lastY.eq > 0 && lastY.debt != null ? lastY.debt / lastY.eq : null, fcfM = fin(fd.fcf) && fd.rev > 0 ? fd.fcf / fd.rev : null;
    const prof = facts([[L('Gross margin', '毛利率'), pc(fd.gm), grade(fd.gm, 0.4, 0.2)], [L('Operating margin', '經營利潤率'), pc(fd.om), grade(fd.om, 0.15, 0.05)], [L('Net margin', '淨利潤率'), pc(fd.nm), grade(fd.nm, 0.1, 0.03)], [L('FCF margin', '自由現金流利潤率'), pc(fcfM), grade(fcfM, 0.1, 0.02)],
      [L('Return on equity', '股本回報率'), pc(fd.roe), grade(fd.roe, 0.15, 0.08)], [L('Return on assets', '資產回報率'), pc(fd.roa), grade(fd.roa, 0.07, 0.03)], [L('Return on invested capital', '投入資本回報率'), pc(lastY.roic), grade(lastY.roic, 0.12, 0.06)]]);
    const ph = Y.length ? `<table class="valTbl valWide"><tr><th>${L('Fiscal year', '財政年度')}</th>${Y.map(y => `<th>${esc(String(y.d).slice(0, 4))}</th>`).join('')}</tr>` +
      [[L('Revenue', '收入'), y => big(y.rev)], [L('Gross margin', '毛利率'), y => y.rev > 0 && y.gp != null ? pc(y.gp / y.rev) : '—'], [L('Operating margin', '經營利潤率'), y => y.rev > 0 && y.op != null ? pc(y.op / y.rev) : '—'], [L('Net margin', '淨利潤率'), y => y.rev > 0 && y.ni != null ? pc(y.ni / y.rev) : '—'], ['ROE', y => pc(y.roe)], ['ROIC', y => pc(y.roic)]]
        .map(([l, f]) => `<tr><th>${l}</th>${Y.map(y => `<td>${f(y)}</td>`).join('')}</tr>`).join('') + '</table>' : '';
    const solv = facts([[L('Debt / equity', '負債 / 股本'), fin(de) ? n2(de) : '—', grade(de, 0.5, 1.5, false)], [L('Net debt / EBITDA', '淨負債 / EBITDA'), fin(ndE) ? n2(ndE) + (ndE < 0 ? L(' (net cash)', '（淨現金）') : '') : '—', grade(ndE, 1.5, 3.5, false)], [L('Interest coverage (EBIT / interest)', '利息覆蓋率（EBIT / 利息）'), fin(cov) ? n2(cov, 1) + '×' : lastY.ebit > 0 && !lastY.ie ? L('No interest', '沒有利息') : '—', fin(cov) ? grade(cov, 8, 3) : lastY.ebit > 0 && !lastY.ie ? 'up' : ''],
      [L('Current ratio', '流動比率'), n2(fd.cr), grade(fd.cr, 1.5, 1)], [L('Quick ratio', '速動比率'), n2(fd.qr), grade(fd.qr, 1, 0.7)], [L('Cash', '現金'), big(fd.cash) + ' ' + esc(D.finCcy)], [L('Total debt', '總負債'), big(fd.debt) + ' ' + esc(D.finCcy)], [L('Liabilities / assets', '負債 / 資產'), lastY.ta > 0 && lastY.tl != null ? pc(lastY.tl / lastY.ta) : '—', lastY.ta > 0 ? grade(lastY.tl / lastY.ta, 0.5, 0.75, false) : '']]);
    const moatH = `<div class="valSum"><div><span class="mut">${L('Economic moat (indicator)', '經濟護城河（指標）')}</span><b class="valBig ${mo.cls}">${mo.lvl}</b><span class="mut small">${mo.score} / 6 · ${mo.yrs} ${L('years of data', '年數據')}</span></div></div>` +
      `<div class="valChecks">${mo.pts.map(p => `<div class="${p.ok ? 'up' : 'mut'}">${p.ok ? '✓' : '✗'} ${p.t} <b>${esc(p.why)}</b></div>`).join('')}</div>` +
      `<div class="mut small">${L('Wide: 5-6 checks. Narrow: 3-4. A moat means lasting advantages (brand, network, switching costs, scale) that keep returns high; these numbers are signs of one, not proof.', '寬闊：5-6 項；狹窄：3-4 項。護城河指能令回報長期偏高的持久優勢（品牌、網絡效應、轉換成本、規模），這些數字只是跡象，並非證明。')}</div>`;
    return card(L('Profitability', '盈利能力'), prof + ph, 'wide') + card(L('Solvency', '償債能力'), solv + `<div class="mut small">${L('Green: strong. Red: weak. Banks and insurers carry high debt by design, so these ratios do not suit them.', '綠色：強；紅色：弱。銀行及保險公司本身負債較高，這些比率不適用。')}</div>`) + card(L('Economic moat', '經濟護城河'), moatH);
  }
  const TABS = () => [['sum', L('Summary', '摘要')], ['dcf', L('DCF valuation', '現金流折現估值')], ['rel', L('Relative valuation', '相對估值')], ['rate', L('Discount rate', '折現率')], ['fc', L('Forecasts', '預測')], ['fund', L('Fundamentals', '基本面')]];
  function draw() {
    if (!root) return;
    $v('#valTitle').textContent = L('Valuation', '估值'); $v('#valSym').placeholder = L('Ticker', '代號'); $v('#valReload').title = L('Reload', '重新載入');
    $v('#valTabs').innerHTML = TABS().map(([k, l]) => `<button data-tab="${k}" class="${P.tab === k ? 'on' : ''}">${l}</button>`).join('');
    $v('#valSc').innerHTML = [['bear', L('Bear', '悲觀')], ['base', L('Base', '基本')], ['bull', L('Bull', '樂觀')]].map(([k, l]) => `<button data-sc="${k}" class="${P.sc === k ? 'on' : ''}" title="${esc(L('DCF scenario', 'DCF 情境'))}">${l}</button>`).join('');
    $v('#valSc').style.visibility = ['sum', 'dcf'].includes(P.tab) ? '' : 'hidden';
    if (!D) { $v('#valName').textContent = ''; $v('#valBody').innerHTML = `<div class="mut finEmpty">${busy ? L('Loading…', '載入中…') : L('Type a ticker (e.g. NVDA, 700 HK) and press Enter, or type NVDA VAL in the command line.', '輸入代號（例如 NVDA、700 HK）再按 Enter，或在指令列輸入 NVDA VAL。')}</div>`; return; }
    const price = D.price, ccy = D.currency, fd = D.fd || {}, ks = D.ks || {}, sdd = D.sd || {};
    $v('#valName').innerHTML = `<b>${esc(D.name)}</b> <span class="mut">${esc(D.symbol)}</span> ${fin(price) ? `<b>${n2(price)}</b> <span class="mut small">${esc(ccy)}</span>` : ''}`;
    const res = { bear: dcf(assume('bear')), base: dcf(assume('base')), bull: dcf(assume('bull')) }, a = assume(P.sc), cur = res[P.sc];
    const up = cur && fin(price) ? cur.ps / price - 1 : null, [vt, vc] = verdict(up), tUp = fin(fd.tMean) && fin(price) ? fd.tMean / price - 1 : null;
    const ctx = { res, a, cur, price, ccy, fd, ks, sdd, up, vt, vc, tUp, rel: relative(), mo: moat() };
    let out = '';
    try { out = ({ sum: pgSummary, dcf: pgDcf, rel: pgRelative, rate: pgRate, fc: pgForecast, fund: pgFund }[P.tab] || pgSummary)(ctx); }
    catch (e) { out = `<div class="dn finEmpty">${L('Could not draw this page', '無法顯示此頁')}: ${esc(String(e.message || e))}</div>`; }
    out += `<div class="mut small finSrc">${L('Source', '來源')}: ${esc(D.src || 'Yahoo Finance')} · ${L('A model estimate for research only, not financial advice. Results depend entirely on the assumptions.', '模型估算，只供研究，並非投資建議。結果完全取決於假設。')}</div>`;
    const keep = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
    $v('#valBody').innerHTML = out;
    if (keep) { const i = $v(`#valBody input[data-k="${keep}"]`); if (i) i.focus(); }
  }
  async function load(sym) {
    sym = String(sym || '').trim().toUpperCase(); if (!sym) return;
    if (sym !== P.sym) ov = {}; P.sym = sym; save(); $v('#valSym').value = sym; busy = true; D = null; draw();
    const r = await api.fin(sym); if (P.sym !== sym) return;
    if (!r || r.error) { busy = false; $v('#valName').textContent = ''; $v('#valBody').innerHTML = `<div class="dn finEmpty">${esc((r && r.error) || L('No data', '沒有數據'))}</div>`; return; }
    fxRate = 1; const fc = r.finCcy, pc_ = r.currency;
    if (fc && pc_ && fc !== pc_) { try { const from = fc, to = pc_ === 'GBp' ? 'GBP' : pc_; const m = await api.fx([[from, to]]); const v = m && m[from + to]; if (fin(v)) fxRate = v * (pc_ === 'GBp' ? 100 : 1); } catch (e) {} }
    busy = false; D = r; draw();
  }
  function resolveTicker(t) { try { const w = String(t).trim().toUpperCase().split(/\s+/); return resolve(withMarket(w)[0], null); } catch (e) { return String(t).trim().toUpperCase(); } }
  function init() {
    root = document.getElementById('v-lab'); if (!root || root.dataset.ready) return; root.dataset.ready = 1;
    root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { P.tab = b.dataset.tab; save(); draw(); } else if (b.dataset.sc) { P.sc = b.dataset.sc; save(); draw(); } else if (b.dataset.act === 'reset') { ov = {}; draw(); } else if (b.id === 'valReload') load(P.sym); });
    root.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; const v = parseFloat(e.target.value);
      if (!Number.isFinite(v)) delete ov[k]; else ov[k] = e.target.dataset.raw ? v : v / 100;
      if (P.sc !== 'base') P.sc = 'base'; draw(); });
    $v('#valSym').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') load(resolveTicker($v('#valSym').value)); });
    window.addEventListener('eqlang', () => { if (D && root.classList.contains('on')) load(P.sym); else draw(); });
  }
  function show(sym) { init(); const want = sym || P.sym || (typeof activeChart === 'function' && activeChart() ? activeChart().p.sym : '') || 'AAPL'; if (want !== (D && D.symbol) || !D) load(want); else draw(); }
  return { show, load, get data() { return D; }, get state() { return P; }, dcf: a => dcf(a) };
})();
