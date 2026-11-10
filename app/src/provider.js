'use strict';
// Market data with fallback. Runs in the main process (no CORS, key never reaches the page).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EquityDesk/1.0';
const RANGES = {            // range -> [yahoo range, yahoo interval, fmp kind]
  '1D': ['1d', '5m', '5min'], '5D': ['5d', '15m', '15min'], '1M': ['1mo', '1h', '1hour'],
  '3M': ['3mo', '1d', 'eod'], '6M': ['6mo', '1d', 'eod'], '1Y': ['1y', '1d', 'eod'],
  '5Y': ['5y', '1wk', 'eod']
};
const DAYS = { '1D': 1, '5D': 5, '1M': 31, '3M': 92, '6M': 183, '1Y': 366, '5Y': 1830 };
// Bar intervals: [yahoo interval, seconds, fmp kind, bars merged per output bar, longest range Yahoo serves]
const IVS = { '1m': ['1m', 60, '1min', 1, '5D'], '2m': ['2m', 120, null, 1, '1M'], '5m': ['5m', 300, '5min', 1, '1M'], '15m': ['15m', 900, '15min', 1, '1M'], '30m': ['30m', 1800, '30min', 1, '1M'],
  '1h': ['60m', 3600, '1hour', 1, '1Y'], '2h': ['60m', 7200, '1hour', 2, '1Y'], '4h': ['60m', 14400, '4hour', 4, '1Y'], 'D': ['1d', 86400, 'eod', 1, '5Y'], 'W': ['1wk', 604800, 'eod', 1, '5Y'], 'M': ['1mo', 2592000, 'eod', 1, '5Y'] };
const RANGE_ORDER = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y'];
const AUTO_IV = { '1D': '5m', '5D': '15m', '1M': '1h', '3M': 'D', '6M': 'D', '1Y': 'D', '5Y': 'W' };
// -> { range, iv } with the range shortened to what the data source serves for that interval
function plan(range, iv) {
  if (!RANGES[range]) range = '6M'; if (!iv || iv === 'auto' || !IVS[iv]) iv = AUTO_IV[range];
  if (RANGE_ORDER.indexOf(range) > RANGE_ORDER.indexOf(IVS[iv][4])) range = IVS[iv][4];
  return { range, iv };
}
// merge n consecutive bars of the same day (2h / 4h from hourly bars)
function merge(bars, n) {
  if (n <= 1) return bars; const out = []; let cur = null, k = 0, day = null;
  for (const b of bars) { const d = Math.floor(b.time / 86400); if (!cur || k >= n || d !== day) { cur = { ...b }; out.push(cur); k = 0; day = d; } else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.volume += b.volume; } k++; }
  return out;
}
const YR = { '1D': '1d', '5D': '5d', '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', '5Y': '5y' };

async function getJson(url, timeoutMs = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) { let m = ''; try { const t = await r.text(); try { const j = JSON.parse(t); m = j['Error Message'] || j.message || j.error || (j.chart && j.chart.error && j.chart.error.description) || ''; } catch (e) { m = t.slice(0, 120); } } catch (e) {}
      throw new Error('HTTP ' + r.status + (m ? ' ' + String(typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 200) : '')); }
    return await r.json();
  } finally { clearTimeout(t); }
}
const num = v => (v == null || Number.isNaN(+v) ? null : +v);
const clean = s => String(s).trim().toUpperCase().replace(/[^A-Z0-9.\-^=]/g, '');

// ---------- Yahoo ----------
async function yahooChart(sym, range, interval) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}&includePrePost=false`;
  const j = await getJson(u);
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error('no data for ' + sym);
  return r;
}
async function yahooQuote(sym) {
  const r = await yahooChart(sym, '1d', '5m');
  const m = r.meta, price = num(m.regularMarketPrice), prev = num(m.chartPreviousClose) ?? num(m.previousClose);
  return { symbol: sym, price, prev, chg: price != null && prev ? price - prev : null,
    pct: price != null && prev ? (price / prev - 1) * 100 : null, high: num(m.regularMarketDayHigh),
    low: num(m.regularMarketDayLow), vol: num(m.regularMarketVolume), currency: m.currency,
    time: m.regularMarketTime ? m.regularMarketTime * 1000 : Date.now(), src: 'Yahoo' };
}
async function yahooBars(sym, rg, iv) {
  const [yi] = IVS[iv], yr = YR[rg];
  const r = await yahooChart(sym, yr, yi), q = r.indicators.quote[0], out = [];
  (r.timestamp || []).forEach((t, i) => {
    if (q.close[i] == null || q.open[i] == null) return;
    out.push({ time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] || 0 });
  });
  if (!out.length) throw new Error('empty series');
  return merge(out, IVS[iv][3]);
}

// Top of book (bid/ask + sizes) from Yahoo's quote API, which needs a cookie + crumb.
let crumb = null;
async function yahooCrumb(force) {
  if (crumb && !force && Date.now() - crumb.at < 3600e3) return crumb;
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' }).catch(() => null);
  const set = r1 && (r1.headers.getSetCookie ? r1.headers.getSetCookie() : [r1.headers.get('set-cookie')]).filter(Boolean);
  const cookie = (set || []).map(c => c.split(';')[0]).join('; ');
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
  const c = (await r2.text()).trim();
  if (!r2.ok || !c || c.length > 40 || /[<{]/.test(c)) throw new Error('Yahoo crumb unavailable');
  crumb = { cookie, crumb: c, at: Date.now() }; return crumb;
}
async function yahooBook(sym) {
  for (const force of [false, true]) {
    const c = await yahooCrumb(force);
    const r = await fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}&crumb=${encodeURIComponent(c.crumb)}`, { headers: { 'User-Agent': UA, Cookie: c.cookie, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) continue;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const q = ((await r.json()).quoteResponse || {}).result || [];
    if (!q[0]) throw new Error('no quote for ' + sym);
    const x = q[0];
    return { symbol: sym, bid: num(x.bid), ask: num(x.ask), bidSize: num(x.bidSize), askSize: num(x.askSize), last: num(x.regularMarketPrice),
      prev: num(x.regularMarketPreviousClose), state: x.marketState || '', exch: x.exchange || '', levels: null, time: x.regularMarketTime ? x.regularMarketTime * 1000 : Date.now(), src: 'Yahoo L1' };
  }
  throw new Error('Yahoo refused the quote request');
}

// ---------- FMP (stable API) ----------
const FMP = 'https://financialmodelingprep.com/stable';
async function fmpQuote(sym, key) {
  const j = await getJson(`${FMP}/quote?symbol=${encodeURIComponent(sym)}&apikey=${key}`);
  const q = Array.isArray(j) ? j[0] : null;
  if (!q || q.price == null) throw new Error('FMP: no quote (' + (j && (j['Error Message'] || j.message) || 'empty') + ')');
  return { symbol: sym, price: num(q.price), prev: num(q.previousClose), chg: num(q.change),
    pct: num(q.changePercentage ?? q.changesPercentage), high: num(q.dayHigh), low: num(q.dayLow),
    vol: num(q.volume), currency: 'USD', time: q.timestamp ? q.timestamp * 1000 : Date.now(), src: 'FMP' };
}
async function fmpBars(sym, rg, key, iv) {
  const kind = IVS[iv][2], toIso = d => d.toISOString().slice(0, 10);
  if (!kind) throw new Error('FMP has no ' + iv + ' bars');
  let rows;
  if (kind === 'eod') {
    const to = new Date(), from = new Date(Date.now() - DAYS[rg] * 864e5);
    rows = await getJson(`${FMP}/historical-price-eod/full?symbol=${encodeURIComponent(sym)}&from=${toIso(from)}&to=${toIso(to)}&apikey=${key}`);
  } else {
    const from = new Date(Date.now() - (DAYS[rg] + 3) * 864e5);
    rows = await getJson(`${FMP}/historical-chart/${kind}?symbol=${encodeURIComponent(sym)}&from=${toIso(from)}&to=${toIso(new Date())}&apikey=${key}`);
  }
  if (!Array.isArray(rows) || !rows.length) throw new Error('FMP: empty series');
  let out = rows.map(x => ({ time: Math.floor(Date.parse(String(x.date).replace(' ', 'T') + (String(x.date).length > 10 ? 'Z' : 'T00:00:00Z')) / 1000),
    open: +x.open, high: +x.high, low: +x.low, close: +x.close, volume: +(x.volume || 0) })).filter(b => b.time && b.close);
  out.sort((a, b) => a.time - b.time);
  if (kind !== 'eod') { const last = out[out.length - 1].time; out = out.filter(b => last - b.time < DAYS[rg] * 86400); }
  if (iv === 'W' || iv === 'M') { const g = new Map(); out.forEach(b => { const d = new Date(b.time * 1000), k = iv === 'M' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : Math.floor((b.time / 86400 + 3) / 7);
    const c = g.get(k); if (!c) g.set(k, { ...b }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; c.volume += b.volume; } }); out = [...g.values()]; }
  return out;
}

// ---------- public API ----------
function order(settings) {
  const hasKey = !!settings.fmpKey;
  const pref = settings.provider || 'fmp-first';
  if (pref === 'yahoo') return ['yahoo'];
  if (pref === 'fmp') return hasKey ? ['fmp'] : [];
  return hasKey ? ['fmp', 'yahoo'] : ['yahoo'];
}
async function tryChain(settings, fy, ff) {
  const errs = [];
  for (const p of order(settings)) {
    try { return p === 'fmp' ? await ff(settings.fmpKey) : await fy(); }
    catch (e) { const m = (e.message || e).toString(); errs.push(p + ': ' + (settings.fmpKey ? m.split(settings.fmpKey).join('***') : m)); }
  }
  throw new Error(errs.join(' | ') || 'no provider available (add an FMP key or choose Yahoo)');
}
// Offline demo/test mode: set EQUITY_MOCK=1 (synthetic random-walk data, clearly labelled "Mock").
function mockSeed(sym) { let h = 7; for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function mockBars(sym, n, step) { let x = mockSeed(sym), p = 50 + (x % 400); const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296, out = [], now = Math.floor(Date.now() / 1000);
  for (let i = n; i > 0; i--) { const o = p, c = o * (1 + (rnd() - 0.48) * 0.02), h = Math.max(o, c) * (1 + rnd() * 0.006), l = Math.min(o, c) * (1 - rnd() * 0.006); out.push({ time: now - i * step, open: o, high: h, low: l, close: c, volume: Math.floor(1e6 + rnd() * 5e6) }); p = c; } return out; }
async function quotes(symbols, settings) {
  if (process.env.EQUITY_MOCK) return symbols.map(clean).filter(Boolean).map(s => { const b = mockBars(s, 160, 86400), l = b[b.length - 1], pr = b[b.length - 2].close; return { symbol: s, price: l.close, prev: pr, chg: l.close - pr, pct: (l.close / pr - 1) * 100, high: l.high, low: l.low, vol: l.volume, src: 'Mock', time: Date.now() }; });
  const syms = [...new Set(symbols.map(clean).filter(Boolean))].slice(0, 60);
  const res = await Promise.all(syms.map(s => tryChain(settings, () => yahooQuote(s), k => fmpQuote(s, k))
    .catch(e => ({ symbol: s, error: String(e.message || e) }))));
  return res;
}
async function bars(symbol, range, settings, interval) {
  const s = clean(symbol), { range: rg, iv } = plan(range, interval);
  if (process.env.EQUITY_MOCK) { const step = IVS[iv][1]; return { symbol: s, range: rg, iv, bars: mockBars(s, Math.max(20, Math.min(400, Math.round(step >= 86400 ? DAYS[rg] * 86400 * 0.69 / step : DAYS[rg] * 23400 / step))), step) }; }
  const data = await tryChain(settings, () => yahooBars(s, rg, iv), k => fmpBars(s, rg, k, iv));
  return { symbol: s, range: rg, iv, bars: data };
}
// latest trade for second charts (built live from ticks): light v7 quote call
let mockTick = {};
async function tick(symbol) {
  const s = clean(symbol);
  if (process.env.EQUITY_MOCK) { const b = mockBars(s, 2, 60); let m = mockTick[s] || { p: b[1].close, v: 1e6 }; m = { p: m.p * (1 + (Math.random() - 0.5) * 0.0015), v: m.v + Math.round(Math.random() * 3000) }; mockTick[s] = m; return { symbol: s, price: m.p, volume: m.v, time: Date.now() }; }
  const j = await yJson(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(s)}&fields=regularMarketPrice,regularMarketVolume,regularMarketTime,marketState`);
  const q = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0]; if (!q || q.regularMarketPrice == null) throw new Error('no tick for ' + s);
  return { symbol: s, price: q.regularMarketPrice, volume: q.regularMarketVolume || 0, time: Date.now(), tradeTime: q.regularMarketTime ? q.regularMarketTime * 1000 : null, state: q.marketState || '' };
}
// Order book. Free sources only give level 1 (best bid/ask); `levels` stays null unless a depth feed is added.
async function book(symbol, settings, opts = {}) {
  const s = clean(symbol);
  if (process.env.EQUITY_MOCK) {   // synthetic depth, clearly labelled (no depth for the chart's quote box, like the real path)
    const mb = mockBars(s, 160, 86400), b = mb[mb.length - 1], tick = b.close > 100 ? 0.01 : 0.01, mid = Math.round(b.close * 100) / 100;
    let x = mockSeed(s) + Math.floor(Date.now() / 3000); const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
    const bids = [], asks = []; for (let i = 0; i < 12; i++) { bids.push([+(mid - tick * (i + 1)).toFixed(2), Math.round(100 + rnd() * 2400)]); asks.push([+(mid + tick * (i + 1)).toFixed(2), Math.round(100 + rnd() * 2400)]); }
    return { symbol: s, bid: bids[0][0], ask: asks[0][0], bidSize: bids[0][1], askSize: asks[0][1], last: mid, levels: opts.depth ? { bids, asks } : null, time: Date.now(), src: opts.depth ? 'Mock depth' : 'Mock L1' };
  }
  let l1, depthErr = '';
  try { l1 = await yahooBook(s); }
  catch (e) { const q = (await quotes([s], settings))[0] || {}; l1 = { symbol: s, bid: null, ask: null, last: q.price ?? null, levels: null, time: q.time || Date.now(), src: q.src || '', error: 'Bid/ask unavailable: ' + (e.message || e) }; }
  if (settings.ibkrDepth && opts.depth) {
    // US stocks: a direct exchange feed (Nasdaq TotalView / NYSE OpenBook) wins over the broker when one is set up; the broker is the fallback.
    const us = !/\.[A-Z]{1,2}$/.test(s) && !s.startsWith('^'), ex = l1.exch || '', nyse = /^(NYQ|NYSE)$/.test(ex), tries = [], errs = [];
    const db = (key, ds) => () => require('./dbdepth').book(s, key, ds).then(d => Object.assign(d, { label: d.label + ' via Databento' }));
    if (us) {
      const tv = settings.tvFeed === 'databento' && settings.tvKey, ob = settings.obFeed === 'databento' && settings.obKey;
      if (ob && nyse) tries.push(['NYSE OpenBook', db(settings.obKey, 'XNYS.PILLAR')]);
      if (tv) tries.push(['Nasdaq TotalView', db(settings.tvKey, 'XNAS.ITCH')]);
      if (ob && !nyse && !ex) tries.push(['NYSE OpenBook', db(settings.obKey, 'XNYS.PILLAR')]);
    }
    const B = require('./brokers').BROKERS[settings.depthSource];
    if (settings.depthSource === 'ibkr') tries.push(['IBKR', () => require('./ibdepth').book(s, settings).then(d => Object.assign(d, { label: 'IBKR ' + d.label }))]);
    else if (B) tries.push([B.name, () => B.book(s, settings, { exch: ex })]);
    for (const [name, fn] of tries) {
      try {
        const d = await fn();
        if (!d.bids.length && !d.asks.length) throw new Error('empty book (market closed or no data permission?)');
        l1.levels = { bids: d.bids, asks: d.asks }; l1.src = d.label + (l1.src ? ' + ' + l1.src : '');
        if (d.bids[0]) { l1.bid = d.bids[0][0]; l1.bidSize = d.bids[0][1]; } if (d.asks[0]) { l1.ask = d.asks[0][0]; l1.askSize = d.asks[0][1]; }
        delete l1.error; if (errs.length) l1.depthNote = 'Fell back because ' + errs.join(' · '); errs.length = 0; break;
      } catch (e) { errs.push(name + ': ' + String(e.message || e)); }
    }
    if (errs.length) depthErr = errs.join(' · ');
  }
  if (depthErr) l1.depthError = depthErr;
  return l1;
}
// ---------- watchlist stats: fundamentals, beta / alpha vs SPY, ATM option greeks, FX ----------
const statCache = new Map();   // symbol -> {t, v}
async function yJson(url, retry = true) {
  const c = await yahooCrumb(); const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'crumb=' + encodeURIComponent(c.crumb), { headers: { 'User-Agent': UA, Cookie: c.cookie, Accept: 'application/json' } });
  if (r.status === 401 && retry) { await yahooCrumb(true); return yJson(url, false); }
  if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
}
const nc = x => x && typeof x === 'object' && 'raw' in x ? num(x.raw) : num(x);
function normCdf(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
// Black-Scholes call delta and theta per calendar day
function callGreeks(S, K, T, vol, r = 0.04) {
  if (!(S > 0 && K > 0 && T > 0 && vol > 0)) return { delta: null, theta: null };
  const sq = Math.sqrt(T), d1 = (Math.log(S / K) + (r + vol * vol / 2) * T) / (vol * sq), d2 = d1 - vol * sq, pdf = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  return { delta: normCdf(d1), theta: (-S * pdf * vol / (2 * sq) - r * K * Math.exp(-r * T) * normCdf(d2)) / 365 };
}
const rets = b => b.slice(1).map((x, i) => ({ t: x.time, r: x.close / b[i].close - 1 }));
function betaAlpha(bs, bm) {   // daily returns over the past year, aligned by date; alpha = annualised (Jensen, risk-free 0)
  const m = new Map(rets(bm).map(x => [Math.floor(x.t / 86400), x.r])), pr = rets(bs).map(x => [x.r, m.get(Math.floor(x.t / 86400))]).filter(x => x[1] != null);
  if (pr.length < 30) return { beta: null, alpha: null, vol: null };
  const n = pr.length, ma = pr.reduce((s, x) => s + x[0], 0) / n, mb = pr.reduce((s, x) => s + x[1], 0) / n; let cov = 0, vb = 0, va = 0; pr.forEach(([a, b]) => { cov += (a - ma) * (b - mb); vb += (b - mb) ** 2; va += (a - ma) ** 2; });
  const beta = vb ? cov / vb : null; return { beta, alpha: beta == null ? null : (ma - beta * mb) * 252 * 100, vol: Math.sqrt(va / n * 252) };
}
async function oneStat(s, spy) {
  const out = { symbol: s, src: [] };
  const [q, sum, opt, bs] = await Promise.allSettled([
    yJson(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(s)}`).then(j => j.quoteResponse.result[0]),
    yJson(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(s)}?modules=summaryDetail,defaultKeyStatistics`).then(j => j.quoteSummary.result[0]),
    yJson(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(s)}`).then(j => j.optionChain.result[0]),
    yahooBars(s, '1Y')]);
  if (q.status === 'fulfilled' && q.value) { const v = q.value; Object.assign(out, { name: v.shortName || v.longName || '', currency: v.currency, price: num(v.regularMarketPrice), pe: num(v.trailingPE), fpe: num(v.forwardPE), eps: num(v.epsTrailingTwelveMonths), feps: num(v.epsForward),
    mcap: num(v.marketCap), div: num(v.trailingAnnualDividendYield) != null ? num(v.trailingAnnualDividendYield) * 100 : null, hi52: num(v.fiftyTwoWeekHigh), lo52: num(v.fiftyTwoWeekLow), pb: num(v.priceToBook), avgVol: num(v.averageDailyVolume3Month) }); out.src.push('Yahoo quote'); }
  if (sum.status === 'fulfilled' && sum.value) { const d = sum.value.summaryDetail || {}, k = sum.value.defaultKeyStatistics || {}; out.betaY = nc(d.beta) ?? nc(k.beta); out.peg = nc(k.pegRatio); out.short = nc(k.shortPercentOfFloat) != null ? nc(k.shortPercentOfFloat) * 100 : null; if (out.pe == null) out.pe = nc(d.trailingPE); }
  if (bs.status === 'fulfilled' && spy) { const ba = betaAlpha(bs.value, spy); out.beta = ba.beta; out.alpha = ba.alpha; out.hv = ba.vol; const b = bs.value, l = b[b.length - 1]; if (out.price == null) out.price = l.close;
    if (out.hi52 == null) { out.hi52 = Math.max(...b.map(x => x.high)); out.lo52 = Math.min(...b.map(x => x.low)); } out.ytd = (() => { const y = new Date().getFullYear(), f = b.find(x => new Date(x.time * 1000).getFullYear() === y); return f ? (l.close / f.close - 1) * 100 : null; })(); }
  // nearest-expiry (at least 7 days out) at-the-money call; IV from the chain, else 1Y historical volatility
  if (opt.status === 'fulfilled' && opt.value && out.price) {
    try { let ch = opt.value; const now = Date.now() / 1000, exps = ch.expirationDates || [], e = exps.find(x => x - now > 7 * 86400) || exps[0];
      if (e && (!ch.options[0] || ch.options[0].expirationDate !== e)) ch = (await yJson(`https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(s)}?date=${e}`)).optionChain.result[0];
      const calls = (ch.options[0] || {}).calls || [], c = calls.reduce((a, x) => !a || Math.abs(x.strike - out.price) < Math.abs(a.strike - out.price) ? x : a, null);
      if (c) { const T = Math.max(1, (c.expiration - now) / 86400) / 365, iv = num(c.impliedVolatility); const g = callGreeks(out.price, c.strike, T, iv > 0.01 ? iv : out.hv);
        Object.assign(out, { delta: g.delta, theta: g.theta, iv: iv ? iv * 100 : null, optStrike: c.strike, optExp: c.expiration, optSrc: iv > 0.01 ? 'IV' : 'HV' }); } } catch (e) {}
  }
  if (out.delta == null && out.price && out.hv) { const g = callGreeks(out.price, out.price, 30 / 365, out.hv); Object.assign(out, { delta: g.delta, theta: g.theta, optStrike: out.price, optExp: Date.now() / 1000 + 30 * 86400, optSrc: 'HV' }); }
  if (out.beta == null) out.beta = out.betaY ?? null;
  return out;
}
async function stats(symbols) {
  const syms = [...new Set(symbols.map(clean).filter(Boolean))].slice(0, 60);
  if (process.env.EQUITY_MOCK) return syms.map(s => { const x = mockSeed(s), b = mockBars(s, 160, 86400), p = b[b.length - 1].close, r = k => ((x >> k) % 1000) / 1000, hv = 0.2 + r(3) * 0.4, g = callGreeks(p, Math.round(p), 30 / 365, hv);
    return { symbol: s, name: s + ' Inc (mock)', currency: 'USD', price: p, pe: 10 + r(1) * 40, fpe: 9 + r(2) * 30, eps: p / (10 + r(1) * 40), mcap: 1e9 * (5 + r(4) * 2000), div: r(5) * 3, hi52: Math.max(...b.map(q => q.high)), lo52: Math.min(...b.map(q => q.low)),
      pb: 1 + r(6) * 10, beta: 0.6 + r(7) * 1.2, alpha: (r(8) - 0.5) * 30, hv: hv, iv: hv * 110, delta: g.delta, theta: g.theta, optStrike: Math.round(p), optExp: Date.now() / 1000 + 30 * 86400, optSrc: 'mock', ytd: (r(9) - 0.4) * 40, peg: 1 + r(10) * 2, short: r(11) * 8, src: ['Mock'] }; });
  let spy = null; try { spy = await yahooBars('SPY', '1Y'); } catch (e) {}
  return Promise.all(syms.map(async s => { const c = statCache.get(s); if (c && Date.now() - c.t < 30 * 60e3) return c.v;
    try { const v = await oneStat(s, spy); statCache.set(s, { t: Date.now(), v }); return v; } catch (e) { return { symbol: s, error: String(e.message || e) }; } }));
}
// FX: how many units of `to` one unit of `from` buys
async function fx(pairs) {
  const out = {};
  await Promise.all((pairs || []).slice(0, 20).map(async ([f, t]) => { f = String(f).toUpperCase().slice(0, 3); t = String(t).toUpperCase().slice(0, 3); const k = f + t; if (f === t) { out[k] = 1; return; }
    if (process.env.EQUITY_MOCK) { const U = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 151, CNY: 7.2, HKD: 7.8, CAD: 1.37, AUD: 1.52, CHF: 0.88, INR: 84, SGD: 1.34, KRW: 1380, MYR: 4.4, THB: 34, TWD: 32 }; out[k] = (U[t] || 1) / (U[f] || 1); return; }
    try { const q = await yahooQuote(k + '=X'); if (q.price) out[k] = q.price; } catch (e) {} }));
  return out;
}

const testFmp = key => fmpQuote('AAPL', key);
module.exports = { tick, plan, IVS, quotes, bars, book, clean, RANGES, stats, fx, callGreeks, testFmp, yJson, UA };
