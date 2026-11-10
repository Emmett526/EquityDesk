'use strict';
// Company financials for the FIN screen (TradingView-style Financials): statements, estimates, earnings, dividends, segments.
// Yahoo Finance (no key) for almost everything; segments come from FMP when a key is saved. Runs in the main process.
const provider = require('./provider');

// statement rows: [Yahoo timeseries name, label, statement, kind]  kind: money | eps | shares
const ROWS = [
  ['TotalRevenue', 'Total revenue', 'is'], ['CostOfRevenue', 'Cost of goods sold', 'is'], ['GrossProfit', 'Gross profit', 'is'], ['OperatingExpense', 'Operating expenses', 'is'],
  ['ResearchAndDevelopment', 'Research & development', 'is'], ['SellingGeneralAndAdministration', 'Selling, general & admin', 'is'], ['OperatingIncome', 'Operating income', 'is'],
  ['InterestExpense', 'Interest expense', 'is'], ['PretaxIncome', 'Pretax income', 'is'], ['TaxProvision', 'Income tax', 'is'], ['NetIncome', 'Net income', 'is'],
  ['EBITDA', 'EBITDA', 'is'], ['EBIT', 'EBIT', 'is'], ['BasicEPS', 'Basic EPS', 'is', 'eps'], ['DilutedEPS', 'Diluted EPS', 'is', 'eps'], ['DilutedAverageShares', 'Diluted shares', 'is', 'shares'],
  ['TotalAssets', 'Total assets', 'bs'], ['CurrentAssets', 'Current assets', 'bs'], ['CashAndCashEquivalents', 'Cash & equivalents', 'bs'], ['CashCashEquivalentsAndShortTermInvestments', 'Cash & short-term investments', 'bs'],
  ['Receivables', 'Receivables', 'bs'], ['Inventory', 'Inventory', 'bs'], ['NetPPE', 'Property, plant & equipment (net)', 'bs'], ['Goodwill', 'Goodwill', 'bs'], ['TotalNonCurrentAssets', 'Non-current assets', 'bs'],
  ['TotalLiabilitiesNetMinorityInterest', 'Total liabilities', 'bs'], ['CurrentLiabilities', 'Current liabilities', 'bs'], ['LongTermDebt', 'Long-term debt', 'bs'], ['TotalDebt', 'Total debt', 'bs'], ['NetDebt', 'Net debt', 'bs'],
  ['StockholdersEquity', "Shareholders' equity", 'bs'], ['TangibleBookValue', 'Tangible book value', 'bs'], ['WorkingCapital', 'Working capital', 'bs'], ['OrdinarySharesNumber', 'Shares outstanding', 'bs', 'shares'],
  ['OperatingCashFlow', 'Cash from operations', 'cf'], ['InvestingCashFlow', 'Cash from investing', 'cf'], ['FinancingCashFlow', 'Cash from financing', 'cf'], ['CapitalExpenditure', 'Capital expenditure', 'cf'],
  ['FreeCashFlow', 'Free cash flow', 'cf'], ['DepreciationAndAmortization', 'Depreciation & amortization', 'cf'], ['StockBasedCompensation', 'Stock-based compensation', 'cf'],
  ['CashDividendsPaid', 'Dividends paid', 'cf'], ['RepurchaseOfCapitalStock', 'Share buybacks', 'cf'], ['EndCashPosition', 'Cash at end of period', 'cf']
];
const cache = new Map();   // symbol -> {t, v}
const nc = x => x && typeof x === 'object' ? (Number.isFinite(+x.raw) ? +x.raw : null) : Number.isFinite(+x) && x !== null && x !== '' ? +x : null;
const enc = encodeURIComponent;

async function timeseries(s, per) {
  const now = Math.floor(Date.now() / 1000), types = ROWS.map(r => per + r[0]).join(',');
  const j = await provider.yJson(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${enc(s)}?type=${types}&period1=1420070400&period2=${now}`);
  const res = (j.timeseries && j.timeseries.result) || [], dates = new Set(), vals = {};
  let ccy = null;
  res.forEach(r => { const t = r.meta && r.meta.type && r.meta.type[0]; if (!t || !Array.isArray(r[t])) return; const k = t.slice(per.length);
    r[t].forEach(p => { if (!p || !p.asOfDate || !p.reportedValue) return; dates.add(p.asOfDate); (vals[k] = vals[k] || {})[p.asOfDate] = nc(p.reportedValue); if (p.currencyCode && !ccy && k !== 'BasicEPS') ccy = p.currencyCode; }); });
  const d = [...dates].sort().slice(per === 'annual' ? -6 : -10);
  return { dates: d, ccy, rows: Object.fromEntries(ROWS.map(r => [r[0], d.map(x => vals[r[0]] && vals[r[0]][x] != null ? vals[r[0]][x] : null)])) };
}
async function summary(s) {
  const mods = 'assetProfile,summaryDetail,defaultKeyStatistics,financialData,earnings,earningsHistory,earningsTrend,calendarEvents,recommendationTrend,price';
  return (await provider.yJson(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${enc(s)}?modules=${mods}`)).quoteSummary.result[0];
}
async function monthly(s) {   // month-end closes (for P/E history) and the dividend history
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${enc(s)}?range=10y&interval=1mo&events=div`, { headers: { 'User-Agent': provider.UA } });
  if (!r.ok) throw new Error('chart HTTP ' + r.status);
  const c = (await r.json()).chart.result[0], q = c.indicators.quote[0], px = [];
  (c.timestamp || []).forEach((t, i) => { if (q.close[i] != null) px.push([t, q.close[i]]); });
  const dv = Object.values((c.events && c.events.dividends) || {}).map(x => ({ t: x.date, amt: +x.amount })).filter(x => x.amt > 0).sort((a, b) => a.t - b.t);
  return { px, div: dv };
}
async function fmpSeg(s, key, kind) {
  const r = await fetch(`https://financialmodelingprep.com/stable/revenue-${kind}-segmentation?symbol=${enc(s)}&period=annual&apikey=${enc(key)}`, { headers: { 'User-Agent': provider.UA } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j)) throw new Error(j && (j['Error Message'] || j.message) ? String(j['Error Message'] || j.message).slice(0, 160) : 'HTTP ' + r.status);
  return j.slice(0, 5).map(x => ({ year: x.fiscalYear || String(x.date || '').slice(0, 4), date: x.date, data: Object.entries(x.data || {}).filter(e => Number.isFinite(+e[1])).map(([k, v]) => [k, +v]).sort((a, b) => b[1] - a[1]) })).filter(x => x.data.length);
}

function shape(s, sum, an, qt, mo) {
  const g = (o, k) => o ? nc(o[k]) : null, ap = sum.assetProfile || {}, sd = sum.summaryDetail || {}, ks = sum.defaultKeyStatistics || {}, fd = sum.financialData || {}, pr = sum.price || {}, ce = sum.calendarEvents || {}, ea = sum.earnings || {};
  const trend = ((sum.earningsTrend || {}).trend || []).filter(t => ['0q', '+1q', '0y', '+1y'].includes(t.period)).map(t => ({ period: t.period, end: t.endDate,
    eps: g(t.earningsEstimate, 'avg'), epsLo: g(t.earningsEstimate, 'low'), epsHi: g(t.earningsEstimate, 'high'), epsN: g(t.earningsEstimate, 'numberOfAnalysts'), epsYago: g(t.earningsEstimate, 'yearAgoEps'),
    rev: g(t.revenueEstimate, 'avg'), revLo: g(t.revenueEstimate, 'low'), revHi: g(t.revenueEstimate, 'high'), revN: g(t.revenueEstimate, 'numberOfAnalysts'), revYago: g(t.revenueEstimate, 'yearAgoRevenue'), growth: g(t, 'growth') }));
  const hist = ((sum.earningsHistory || {}).history || []).map(h => ({ date: g(h, 'quarter'), actual: g(h, 'epsActual'), est: g(h, 'epsEstimate'), surprise: g(h, 'surprisePercent') != null ? g(h, 'surprisePercent') * 100 : null })).filter(h => h.date);
  const ec = (ea.earningsChart || {}).quarterly || [], fc = ea.financialsChart || {};
  return {
    symbol: s, name: pr.longName || pr.shortName || s, exch: pr.exchangeName || '', currency: pr.currency || sd.currency || 'USD', finCcy: fd.financialCurrency || ea.financialCurrency || an.ccy || pr.currency || 'USD',
    price: g(fd, 'currentPrice') ?? g(pr, 'regularMarketPrice'), mcap: g(pr, 'marketCap') ?? g(sd, 'marketCap'),
    profile: { sector: ap.sector || '', industry: ap.industry || '', employees: g(ap, 'fullTimeEmployees'), website: ap.website || '', country: ap.country || '', city: ap.city || '', summary: String(ap.longBusinessSummary || '').slice(0, 2000),
      ceo: ((ap.companyOfficers || []).find(o => /chief executive|ceo/i.test(o.title || '')) || {}).name || '' },
    ks: { shares: g(ks, 'sharesOutstanding'), float: g(ks, 'floatShares'), insiders: g(ks, 'heldPercentInsiders'), inst: g(ks, 'heldPercentInstitutions'), ev: g(ks, 'enterpriseValue'), evRev: g(ks, 'enterpriseToRevenue'), evEbitda: g(ks, 'enterpriseToEbitda'),
      fpe: g(ks, 'forwardPE') ?? g(sd, 'forwardPE'), pb: g(ks, 'priceToBook'), peg: g(ks, 'pegRatio'), beta: g(sd, 'beta') ?? g(ks, 'beta'), shortPct: g(ks, 'shortPercentOfFloat'), teps: g(ks, 'trailingEps'), feps: g(ks, 'forwardEps'), bvps: g(ks, 'bookValue') },
    fd: { cash: g(fd, 'totalCash'), debt: g(fd, 'totalDebt'), ebitda: g(fd, 'ebitda'), rev: g(fd, 'totalRevenue'), fcf: g(fd, 'freeCashflow'), ocf: g(fd, 'operatingCashflow'), gm: g(fd, 'grossMargins'), om: g(fd, 'operatingMargins'), em: g(fd, 'ebitdaMargins'), nm: g(fd, 'profitMargins'),
      roe: g(fd, 'returnOnEquity'), roa: g(fd, 'returnOnAssets'), cr: g(fd, 'currentRatio'), qr: g(fd, 'quickRatio'), de: g(fd, 'debtToEquity'), revGrowth: g(fd, 'revenueGrowth'), epsGrowth: g(fd, 'earningsGrowth'),
      tHigh: g(fd, 'targetHighPrice'), tLow: g(fd, 'targetLowPrice'), tMean: g(fd, 'targetMeanPrice'), tMed: g(fd, 'targetMedianPrice'), rec: fd.recommendationKey || '', recMean: g(fd, 'recommendationMean'), analysts: g(fd, 'numberOfAnalystOpinions') },
    sd: { pe: g(sd, 'trailingPE'), ps: g(sd, 'priceToSalesTrailing12Months'), divRate: g(sd, 'dividendRate'), divYield: g(sd, 'dividendYield'), payout: g(sd, 'payoutRatio'), exDiv: g(sd, 'exDividendDate'), avgYield5: g(sd, 'fiveYearAvgDividendYield'), tDivRate: g(sd, 'trailingAnnualDividendRate') },
    next: { date: ce.earnings && ce.earnings.earningsDate && ce.earnings.earningsDate[0] ? nc(ce.earnings.earningsDate[0]) : null, eps: ce.earnings ? nc(ce.earnings.earningsAverage) : null, rev: ce.earnings ? nc(ce.earnings.revenueAverage) : null, divDate: nc(ce.dividendDate), exDiv: nc(ce.exDividendDate) },
    rec: ((sum.recommendationTrend || {}).trend || []).map(t => ({ period: t.period, sb: t.strongBuy || 0, b: t.buy || 0, h: t.hold || 0, s: t.sell || 0, ss: t.strongSell || 0 })),
    trend, hist, qChart: ec.map(x => ({ label: x.date, actual: nc(x.actual), est: nc(x.estimate) })),
    revYear: (fc.yearly || []).map(x => ({ label: String(x.date), rev: nc(x.revenue), earn: nc(x.earnings) })), revQ: (fc.quarterly || []).map(x => ({ label: String(x.date), rev: nc(x.revenue), earn: nc(x.earnings) })),
    annual: an, quarterly: qt, px: mo.px, div: mo.div, rowsMeta: ROWS.map(r => ({ k: r[0], l: r[1], st: r[2], kind: r[3] || 'money' }))
  };
}
const EMPTY_TS = { dates: [], rows: {}, ccy: null };
async function fin(sym, s) {
  sym = provider.clean(sym); if (!sym) throw new Error('No symbol');
  if (process.env.EQUITY_MOCK) return mock(sym, s);
  const c = cache.get(sym); if (c && Date.now() - c.t < 30 * 60e3) return c.v;
  const [sm, an, qt, mo] = await Promise.allSettled([summary(sym), timeseries(sym, 'annual'), timeseries(sym, 'quarterly'), monthly(sym)]);
  if (sm.status !== 'fulfilled' && an.status !== 'fulfilled') throw new Error('Yahoo has no financials for ' + sym + ': ' + String((sm.reason || {}).message || sm.reason || '').slice(0, 120));
  const v = shape(sym, sm.value || {}, an.value || EMPTY_TS, qt.value || EMPTY_TS, mo.value || { px: [], div: [] });
  v.errors = [sm, an, qt, mo].map((x, i) => x.status === 'rejected' ? ['profile & estimates', 'annual statements', 'quarterly statements', 'price & dividend history'][i] + ': ' + String(x.reason && x.reason.message || x.reason).slice(0, 100) : null).filter(Boolean);
  v.segments = { product: [], geo: [], note: '' };
  if (s && s.fmpKey) { const [p, gg] = await Promise.allSettled([fmpSeg(sym, s.fmpKey, 'product'), fmpSeg(sym, s.fmpKey, 'geographic')]);
    v.segments.product = p.value || []; v.segments.geo = gg.value || []; if (p.status === 'rejected' && gg.status === 'rejected') v.segments.note = 'FMP: ' + String(p.reason.message || p.reason); }
  else v.segments.note = 'Revenue by business and by region comes from Financial Modeling Prep. Save an FMP key in SET to see it.';
  v.src = 'Yahoo Finance' + (s && s.fmpKey ? ' · FMP (segments)' : ''); v.time = Date.now();
  cache.set(sym, { t: Date.now(), v }); return v;
}

// ---- offline demo data (EQUITY_MOCK=1), clearly labelled ----
function mock(sym) {
  let x = 0; for (const ch of sym) x = (x * 31 + ch.charCodeAt(0)) >>> 0; const r = k => ((x >> k) % 1000) / 1000;
  const y0 = new Date().getFullYear() - 5, years = [0, 1, 2, 3, 4].map(i => `${y0 + i}-12-31`), base = 2e9 * (1 + r(3) * 40), gr = 1.08 + r(5) * 0.25;
  const mk = (dates, scale, n) => { const rows = {}; dates.forEach((_, i) => { const rev = base * scale * Math.pow(gr, i / n) * (1 + 0.03 * Math.sin(i)), gm = 0.45 + r(7) * 0.3, om = gm - 0.18, ni = rev * (om - 0.05), sh = 1e9 * (0.3 + r(9));
    const v = { TotalRevenue: rev, CostOfRevenue: rev * (1 - gm), GrossProfit: rev * gm, OperatingExpense: rev * (gm - om), ResearchAndDevelopment: rev * 0.12, SellingGeneralAndAdministration: rev * (gm - om - 0.12), OperatingIncome: rev * om, InterestExpense: rev * 0.01, PretaxIncome: ni * 1.2, TaxProvision: ni * 0.2, NetIncome: ni,
      EBITDA: rev * (om + 0.06), EBIT: rev * om, BasicEPS: ni / sh, DilutedEPS: ni / sh / 1.01, DilutedAverageShares: sh * 1.01, TotalAssets: rev * 2.2 / scale, CurrentAssets: rev * 0.9 / scale, CashAndCashEquivalents: rev * 0.35 / scale, CashCashEquivalentsAndShortTermInvestments: rev * 0.5 / scale,
      Receivables: rev * 0.15 / scale, Inventory: rev * 0.08 / scale, NetPPE: rev * 0.4 / scale, Goodwill: rev * 0.3 / scale, TotalNonCurrentAssets: rev * 1.3 / scale, TotalLiabilitiesNetMinorityInterest: rev * 1.1 / scale, CurrentLiabilities: rev * 0.45 / scale, LongTermDebt: rev * 0.4 / scale, TotalDebt: rev * 0.5 / scale,
      NetDebt: rev * 0.15 / scale, StockholdersEquity: rev * 1.1 / scale, TangibleBookValue: rev * 0.8 / scale, WorkingCapital: rev * 0.45 / scale, OrdinarySharesNumber: sh, OperatingCashFlow: ni * 1.3, InvestingCashFlow: -rev * 0.1, FinancingCashFlow: -ni * 0.6, CapitalExpenditure: -rev * 0.06,
      FreeCashFlow: ni * 1.3 - rev * 0.06, DepreciationAndAmortization: rev * 0.06, StockBasedCompensation: rev * 0.03, CashDividendsPaid: -ni * 0.25, RepurchaseOfCapitalStock: -ni * 0.3, EndCashPosition: rev * 0.35 / scale };
    Object.entries(v).forEach(([k, val]) => { (rows[k] = rows[k] || []).push(val); }); }); return { dates, ccy: 'USD', rows }; };
  const qd = []; for (let i = 0; i < 8; i++) { const d = new Date(Date.UTC(y0 + 3, 2 + i * 3 + 1, 0)); qd.push(d.toISOString().slice(0, 10)); }
  const an = mk(years, 1, 1), qt = mk(qd, 0.25, 4), lastEps = an.rows.DilutedEPS[4], price = Math.max(5, lastEps * (15 + r(4) * 30));
  const sum = { price: { longName: sym + ' Inc (mock)', currency: 'USD', marketCap: { raw: price * an.rows.OrdinarySharesNumber[4] }, regularMarketPrice: { raw: price }, exchangeName: 'Mock' },
    assetProfile: { sector: 'Technology', industry: 'Semiconductors', fullTimeEmployees: 5000 + Math.round(r(2) * 90000), website: 'https://example.com', country: 'United States', longBusinessSummary: 'Mock company used for offline testing. Numbers are synthetic.', companyOfficers: [{ name: 'Jane Doe', title: 'Chief Executive Officer' }] },
    summaryDetail: { trailingPE: { raw: price / lastEps }, priceToSalesTrailing12Months: { raw: price * an.rows.OrdinarySharesNumber[4] / an.rows.TotalRevenue[4] }, dividendRate: { raw: price * 0.012 }, dividendYield: { raw: 0.012 }, payoutRatio: { raw: 0.25 }, exDividendDate: { raw: Date.now() / 1000 - 20 * 86400 }, fiveYearAvgDividendYield: { raw: 1.1 }, beta: { raw: 1.2 } },
    defaultKeyStatistics: { sharesOutstanding: { raw: an.rows.OrdinarySharesNumber[4] }, floatShares: { raw: an.rows.OrdinarySharesNumber[4] * 0.97 }, heldPercentInsiders: { raw: 0.03 }, heldPercentInstitutions: { raw: 0.7 }, enterpriseValue: { raw: price * an.rows.OrdinarySharesNumber[4] * 1.02 }, forwardPE: { raw: price / (lastEps * gr) }, forwardEps: { raw: lastEps * gr }, trailingEps: { raw: lastEps }, priceToBook: { raw: 6 } },
    financialData: { currentPrice: { raw: price }, targetHighPrice: { raw: price * 1.4 }, targetLowPrice: { raw: price * 0.8 }, targetMeanPrice: { raw: price * 1.15 }, targetMedianPrice: { raw: price * 1.12 }, recommendationKey: 'buy', recommendationMean: { raw: 2.1 }, numberOfAnalystOpinions: { raw: 30 }, financialCurrency: 'USD' },
    earnings: { earningsChart: { quarterly: [0, 1, 2, 3].map(i => ({ date: `${i + 1}Q${y0 + 4}`, actual: { raw: qt.rows.DilutedEPS[4 + i] }, estimate: { raw: qt.rows.DilutedEPS[4 + i] * (0.95 + 0.04 * i) } })) },
      financialsChart: { yearly: [1, 2, 3, 4].map(i => ({ date: y0 + i, revenue: { raw: an.rows.TotalRevenue[i] }, earnings: { raw: an.rows.NetIncome[i] } })) } },
    earningsHistory: { history: [0, 1, 2, 3].map(i => ({ quarter: { raw: Date.parse(qd[4 + i]) / 1000 }, epsActual: { raw: qt.rows.DilutedEPS[4 + i] }, epsEstimate: { raw: qt.rows.DilutedEPS[4 + i] * 0.97 }, surprisePercent: { raw: 0.031 } })) },
    earningsTrend: { trend: [['0q', 0.25], ['+1q', 0.26], ['0y', 1], ['+1y', gr]].map(([p, m], i) => ({ period: p, endDate: i < 2 ? qd[7] : `${y0 + 4 + i - 1}-12-31`, growth: { raw: gr - 1 }, earningsEstimate: { avg: { raw: lastEps * m * gr }, low: { raw: lastEps * m * gr * 0.9 }, high: { raw: lastEps * m * gr * 1.1 }, numberOfAnalysts: { raw: 25 } },
      revenueEstimate: { avg: { raw: an.rows.TotalRevenue[4] * m * gr }, low: { raw: an.rows.TotalRevenue[4] * m * gr * 0.95 }, high: { raw: an.rows.TotalRevenue[4] * m * gr * 1.05 }, numberOfAnalysts: { raw: 22 } } })) },
    calendarEvents: { earnings: { earningsDate: [{ raw: Date.now() / 1000 + 30 * 86400 }], earningsAverage: { raw: lastEps * 0.27 }, revenueAverage: { raw: an.rows.TotalRevenue[4] * 0.27 } } },
    recommendationTrend: { trend: [{ period: '0m', strongBuy: 8, buy: 14, hold: 7, sell: 1, strongSell: 0 }] } };
  const px = [], div = []; for (let m = 0; m < 120; m++) { const t = Date.UTC(y0 - 5, m, 1) / 1000; px.push([t, price * Math.pow(0.985, 120 - m) * (1 + 0.08 * Math.sin(m / 5))]); if (m % 3 === 2) div.push({ t, amt: +(price * 0.003 * Math.pow(0.99, 120 - m)).toFixed(3) }); }
  const v = shape(sym, sum, an, qt, { px, div });
  v.segments = { product: [0, 1, 2].map(i => ({ year: String(y0 + 4 - i), data: [['Data center', base * 0.6], ['Gaming', base * 0.25], ['Automotive', base * 0.1], ['Other', base * 0.05]] })), geo: [{ year: String(y0 + 4), data: [['United States', base * 0.5], ['China', base * 0.2], ['Taiwan', base * 0.15], ['Other countries', base * 0.15]] }], note: '' };
  v.src = 'Mock data'; v.errors = []; v.time = Date.now(); return v;
}
module.exports = { fin, ROWS };
