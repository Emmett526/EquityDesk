'use strict';
// Exchange depth from Databento (databento.com), read-only. XNAS.ITCH is Nasdaq TotalView-ITCH and XNYS.PILLAR is NYSE's integrated (OpenBook) feed.
// Uses the historical HTTP API, polling the newest data it has (MBP-10: 10 price levels a side), so it trails the market by however far
// Databento's historical end lags (seconds to minutes depending on your plan). Usage is billed by Databento per byte.
const BASE = 'https://hist.databento.com/v0/';
const LABEL = { 'XNAS.ITCH': 'Nasdaq TotalView', 'XNYS.PILLAR': 'NYSE OpenBook', 'ARCX.PILLAR': 'NYSE Arca', 'DBEQ.BASIC': 'Databento Equities Basic', 'EQUS.MINI': 'Databento US Equities Mini' };
const auth = key => ({ Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64') });
const rangeCache = new Map();   // dataset -> {t, end}

async function call(key, ep, params, method = 'GET') {
  if (!key) throw new Error('Add your Databento API key in SET first.');
  const q = new URLSearchParams(params), ctl = AbortSignal.timeout(15000);
  const r = method === 'GET' ? await fetch(BASE + ep + '?' + q, { headers: auth(key), signal: ctl })
    : await fetch(BASE + ep, { method: 'POST', headers: { ...auth(key), 'Content-Type': 'application/x-www-form-urlencoded' }, body: q, signal: ctl });
  const t = await r.text();
  if (!r.ok) { let m = t.slice(0, 200); try { const j = JSON.parse(t); m = j.detail || j.message || m; } catch (e) {} throw new Error('Databento HTTP ' + r.status + ': ' + (typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 240)); }
  return t;
}
async function datasetEnd(key, ds) {
  const c = rangeCache.get(ds); if (c && Date.now() - c.t < 5000) return c.end;
  const j = JSON.parse(await call(key, 'metadata.get_dataset_range', { dataset: ds }));
  const end = j.end || j.end_date; if (!end) throw new Error('Databento: no data range for ' + ds);
  rangeCache.set(ds, { t: Date.now(), end }); return end;
}
const px = v => v == null || v === 'null' ? null : +v;
async function book(sym, key, ds) {
  if (/\.[A-Z]{1,2}$/.test(sym) || sym.startsWith('^')) throw new Error('Databento depth here covers US-listed stocks only');
  ds = ds || 'XNAS.ITCH'; const end = await datasetEnd(key, ds), endMs = Date.parse(end);
  let rec = null;
  for (const win of [2e3, 60e3, 15 * 60e3]) {   // newest record in the smallest window that has one
    const text = await call(key, 'timeseries.get_range', { dataset: ds, symbols: sym.replace(/-/g, '.'), schema: 'mbp-10', stype_in: 'raw_symbol', encoding: 'json', pretty_px: 'true', pretty_ts: 'true',
      start: new Date(endMs - win).toISOString(), end: new Date(endMs).toISOString(), limit: '20000' }, 'POST');
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length) { rec = JSON.parse(lines[lines.length - 1]); break; }
  }
  if (!rec || !Array.isArray(rec.levels)) throw new Error(`Databento: no ${sym} book in ${ds} near ${end}`);
  const bids = [], asks = [];
  rec.levels.forEach(l => { const b = px(l.bid_px), a = px(l.ask_px); if (b && l.bid_sz) bids.push([b, +l.bid_sz, l.bid_ct ? l.bid_ct + ' ord' : '']); if (a && l.ask_sz) asks.push([a, +l.ask_sz, l.ask_ct ? l.ask_ct + ' ord' : '']); });
  const ts = Date.parse(rec.ts_recv || (rec.hd && rec.hd.ts_event) || end);
  return { bids, asks, time: Number.isFinite(ts) ? ts : endMs, label: (LABEL[ds] || ds) + ' (as of ' + new Date(Number.isFinite(ts) ? ts : endMs).toISOString().slice(11, 19) + ' UTC)' };
}
async function test(key, ds) { ds = ds || 'XNAS.ITCH'; const end = await datasetEnd(key, ds); return `${LABEL[ds] || ds} available up to ${end}`; }
module.exports = { book, test, LABEL };
