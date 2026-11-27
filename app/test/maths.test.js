'use strict';
// maths checks: node test/maths.test.js
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = f => path.join(__dirname, '..', 'src', f);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

(async () => {
  // options maths
  global.window = {}; require(src('options.js')); const Opt = window.Opt;
  process.env.EQUITY_MOCK = '1'; const provider = require(src('provider.js'));
  const o = await provider.options('NVDA', 60, 180), r = Opt.compute(o, 180, '30');
  const ks = r.rows.map(x => x.k);
  ok(Number.isFinite(r.net), 'net GEX is a number');
  ok(ks.includes(r.mp) && ks.includes(r.cw) && ks.includes(r.pw), 'max pain and walls are strikes');
  ok(r.zg > Math.min(...ks) && r.zg < Math.max(...ks), 'zero gamma inside the strike range');
  ok(r.mv > 0 && r.pcOI > 0, 'expected move and P/C');
  const o2 = JSON.parse(JSON.stringify(o)); o2.exps[0].puts.forEach(x => { x.bid = x.ask = x.last = 0; });
  const r2 = Opt.compute(o2, 180, 'near'), ivMove = 180 * r2.atm * Math.sqrt(Math.max(o2.exps[0].exp + 72000 - Date.now() / 1000, 3600) / (365 * 86400));
  ok(Math.abs(r2.mv - ivMove) < 1e-6, 'one unpriced leg -> IV move, not half a straddle');

  // dcf
  const store = {}, ctx = { window: {}, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, document: {}, console };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(src('val-ui.js'), 'utf8') + '\nthis.ValScreen = ValScreen;', ctx);
  const a = { rev: 1000, m0: 0.2, m: 0.2, g: 0.1, gL: 0.05, gT: 0.025, r: 0.09, shares: 100, cash: 50, debt: 20 };
  const v = ctx.ValScreen.dcf(a), hiR = ctx.ValScreen.dcf(Object.assign({}, a, { r: 0.11 }));
  ok(v && v.ps > 0, 'dcf gives a price');
  ok(hiR.ps < v.ps, 'higher discount rate -> lower value');
  ok(ctx.ValScreen.dcf(Object.assign({}, a, { r: 0.02 })) === null, 'r <= terminal growth -> no value');
  ok(Math.abs(v.eq - (v.ev + 50 - 20)) < 1e-9, 'equity = EV + cash - debt');

  // MON stats with fake Yahoo (beta / alpha / HV / YTD must fill in)
  delete process.env.EQUITY_MOCK;
  let crumbs = 0; const day = 86400, t0 = Math.floor(Date.now() / 1000) - 300 * day;
  const chart = k => { const ts = [], c = []; let p = 100; for (let i = 0; i < 300; i++) { ts.push(t0 + i * day); p *= 1 + Math.sin(i * k) * 0.01; c.push(p); }
    return { chart: { result: [{ meta: {}, timestamp: ts, indicators: { quote: [{ open: c, high: c, low: c, close: c, volume: c.map(() => 1) }] } }] } }; };
  const res = (j, txt) => ({ ok: true, status: 200, headers: { getSetCookie: () => ['A=1; path=/'] }, json: async () => j, text: async () => txt || JSON.stringify(j) });
  global.fetch = async url => {
    if (url.includes('getcrumb')) { crumbs++; return res(null, 'abc'); }
    if (url.includes('fc.yahoo.com')) return res({});
    if (url.includes('/v8/finance/chart/SPY')) return res(chart(0.3));
    if (url.includes('/v8/finance/chart/')) return res(chart(0.31));
    if (url.includes('/v7/finance/quote')) return res({ quoteResponse: { result: [{ shortName: 'Test', regularMarketPrice: 120 }] } });
    if (url.includes('quoteSummary')) return res({ quoteSummary: { result: [{}] } });
    return res({ optionChain: { result: [{ expirationDates: [], options: [] }] } });
  };
  const [s] = await provider.stats(['TST', 'TS2', 'TS3']);
  ok(s.beta != null && s.alpha != null && s.hv > 0, 'beta, alpha and HV from daily bars');
  ok(crumbs === 1, 'one crumb request for many calls (got ' + crumbs + ')');

  // news: one bad character keeps the feed
  const news = require(src('news.js'));
  const items = news.parse('<rss><item><title>A &#99999999; B</title><link>https://x.com/a</link></item><item><title>C</title><link>https://x.com/c</link></item></rss>', ['t', 'T']);
  ok(items.length === 2, 'bad entity does not drop the feed');

  console.log(n + ' checks passed');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
