'use strict';
// Level 2 order book from Interactive Brokers (TWS / IB Gateway API). Read-only: it only requests market depth, never orders.
// Needs IB Gateway or TWS running with the API enabled, plus IBKR market-depth data subscriptions (e.g. Nasdaq TotalView).
const { IBApi, EventName, Stock } = require('@stoqey/ib');
const INFO = new Set([2104, 2106, 2107, 2108, 2119, 2158]);   // "data farm connection is OK" style notices
let api = null, key = '', connected = false, lastErr = '', sub = null, nextId = 7000, idleT = null;

function ensure(s) {
  const k = `${s.ibHost || '127.0.0.1'}:${s.ibPort || 4002}:${s.ibClientId || 37}`;
  if (api && k === key) { if (!connected) try { api.connect(+s.ibClientId || 37); } catch (e) {} return; }
  if (api) try { api.disconnect(); } catch (e) {}
  key = k; connected = false; sub = null;
  api = new IBApi({ host: s.ibHost || '127.0.0.1', port: +s.ibPort || 4002 });
  api.on(EventName.connected, () => { connected = true; lastErr = ''; });
  api.on(EventName.disconnected, () => { connected = false; sub = null; });
  api.on(EventName.error, (err, code, reqId) => { if (INFO.has(code)) return; const m = (err && err.message || String(err)) + (code ? ' (' + code + ')' : ''); lastErr = m; if (sub && reqId === sub.id) sub.err = m; });
  const apply = (id, pos, op, side, price, size, mm) => {
    if (!sub || id !== sub.id) return; const a = side === 1 ? sub.bids : sub.asks, row = [price, size, mm || ''];
    if (op === 0) a.splice(pos, 0, row); else if (op === 1) a[pos] = row; else if (op === 2) a.splice(pos, 1);
    sub.t = Date.now();
  };
  api.on(EventName.updateMktDepth, (id, pos, op, side, price, size) => apply(id, pos, op, side, price, size));
  api.on(EventName.updateMktDepthL2, (id, pos, mm, op, side, price, size) => apply(id, pos, op, side, price, size, mm));
  try { api.connect(+s.ibClientId || 37); } catch (e) { lastErr = String(e.message || e); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));
// Venue: SMART aggregates every venue you subscribe to; ISLAND = Nasdaq TotalView, NYSE = NYSE OpenBook, ARCA = NYSE Arca book. Non-US symbols use their home exchange.
const VENUE_NAME = { SMART: 'SMART depth', ISLAND: 'Nasdaq TotalView', NYSE: 'NYSE OpenBook', ARCA: 'NYSE Arca', BATS: 'Cboe BZX', IEX: 'IEX' };
const HOME = { HK: ['SEHK', 'HKD', s => String(+s)], T: ['TSEJ', 'JPY'], L: ['LSE', 'GBP'], DE: ['IBIS', 'EUR'], PA: ['SBF', 'EUR'], AS: ['AEB', 'EUR'], SW: ['EBS', 'CHF'], TO: ['TSE', 'CAD'], AX: ['ASX', 'AUD'], SI: ['SGX', 'SGD'], NS: ['NSE', 'INR'], MI: ['BVME', 'EUR'], MC: ['BM', 'EUR'], KS: ['KSE', 'KRW'] };
function contract(sym, venue) {
  const m = sym.match(/^(.+)\.([A-Z]{1,2})$/), h = m && HOME[m[2]];
  if (m && !h) throw new Error(`IBKR depth is not set up for .${m[2]} symbols`);
  if (h) return { c: new Stock(h[2] ? h[2](m[1]) : m[1].replace(/\./g, ' '), h[0], h[1]), smart: false, label: h[0] + ' depth' };
  return { c: new Stock(sym.replace(/-/g, ' '), venue || 'SMART', 'USD'), smart: (venue || 'SMART') === 'SMART', label: VENUE_NAME[venue] || venue };
}
async function book(sym, s) {
  ensure(s);
  for (let i = 0; i < 30 && !connected; i++) await wait(100);
  if (!connected) throw new Error(`Cannot reach IB Gateway/TWS at ${s.ibHost || '127.0.0.1'}:${s.ibPort || 4002}. Start it and enable the API (read-only is fine).` + (lastErr ? ' ' + lastErr : ''));
  if (!sub || sub.sym !== sym || sub.venue !== s.ibVenue) {
    if (sub) try { api.cancelMktDepth(sub.id, true); } catch (e) {}
    const k = contract(sym, s.ibVenue);
    sub = { sym, venue: s.ibVenue, id: ++nextId, bids: [], asks: [], t: 0, err: '', label: k.label };
    api.reqMktDepth(sub.id, k.c, 10, k.smart);
    for (let i = 0; i < 20 && !sub.t && !sub.err; i++) await wait(100);
  }
  clearTimeout(idleT); idleT = setTimeout(() => { if (sub) try { api.cancelMktDepth(sub.id, true); } catch (e) {} sub = null; }, 60000);   // free the depth slot when nobody is watching
  if (sub.err) { const e = sub.err; sub = null; throw new Error('IBKR depth: ' + e); }
  const clean = a => a.filter(Boolean).map(([p, z, mm]) => [p, z, mm]);
  return { bids: clean(sub.bids), asks: clean(sub.asks), time: sub.t || Date.now(), label: sub.label };
}
module.exports = { book };
