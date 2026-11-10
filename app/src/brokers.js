'use strict';
// Order book depth from other brokers' official market-data APIs. Read-only by design: every call below is a quote request.
// Nothing in this file can place, change or cancel an order, read positions or balances, or unlock trading.
//   futu       Futu / moomoo OpenD (runs on your PC, logged in with your Futu ID). Plain TCP + JSON on port 11111.
//   longbridge Longbridge OpenAPI (app key, app secret, access token from open.longbridge.com).
//   tiger      Tiger Brokers OpenAPI (Tiger ID + RSA private key from the Tiger developer page).
//   schwab     Charles Schwab Trader API streamer: NASDAQ_BOOK / NYSE_BOOK (app key + secret, you sign in once a week).
const net = require('net'), crypto = require('crypto');
const wait = ms => new Promise(r => setTimeout(r, ms));
const parts = sym => { const m = String(sym).match(/^(.+)\.([A-Z]{1,2})$/); return m ? { base: m[1], sfx: m[2] } : { base: String(sym), sfx: '' }; };
const usOnly = (sym, who) => { if (sym.startsWith('^')) throw new Error(`${who} has no order book for an index`); };
const lv = (rows, p, v, n) => (rows || []).map(r => [+p(r), +v(r), n(r) ? n(r) + ' ord' : '']).filter(r => r[0] > 0 && r[1] > 0);

// ---------------- Futu / moomoo OpenD ----------------
// Protocol: 44-byte little-endian header ("FT", protoID, fmt=1 JSON, ver 0, serial, bodyLen, SHA1(body), 8 reserved) + JSON body.
const FUTU_MKT = { '': 11, HK: 1, SS: 21, SZ: 22, SI: 31, T: 41, AX: 51, TO: 71 };
const futu = { sock: null, key: '', buf: Buffer.alloc(0), serial: 1, pend: new Map(), ready: null, ka: null, subs: new Map(), name: 'Futu' };
function futuSend(id, body, ms = 8000) {
  const json = Buffer.from(JSON.stringify(body)), h = Buffer.alloc(44), sn = futu.serial++ >>> 0;
  h.write('FT', 0, 'ascii'); h.writeUInt32LE(id, 2); h.writeUInt8(1, 6); h.writeUInt8(0, 7); h.writeUInt32LE(sn, 8); h.writeUInt32LE(json.length, 12);
  crypto.createHash('sha1').update(json).digest().copy(h, 16);
  return new Promise((res, rej) => {
    const t = setTimeout(() => { futu.pend.delete(sn); rej(new Error('Futu OpenD did not answer in time')); }, ms);
    futu.pend.set(sn, { res: v => { clearTimeout(t); res(v); }, rej: e => { clearTimeout(t); rej(e); } });
    try { futu.sock.write(Buffer.concat([h, json])); } catch (e) { futu.pend.delete(sn); clearTimeout(t); rej(e); }
  });
}
function futuReset(msg) {
  clearInterval(futu.ka); futu.ka = null; futu.ready = null; futu.subs.clear(); futu.buf = Buffer.alloc(0);
  if (futu.sock) try { futu.sock.destroy(); } catch (e) {}
  futu.sock = null; for (const p of futu.pend.values()) p.rej(new Error(msg || 'Futu OpenD connection closed')); futu.pend.clear();
}
function futuData(d) {
  futu.buf = Buffer.concat([futu.buf, d]);
  while (futu.buf.length >= 44) {
    if (futu.buf.toString('ascii', 0, 2) !== 'FT') return futuReset('Unexpected reply from OpenD. Is the port the API port (11111), not the WebSocket one?');
    const len = futu.buf.readUInt32LE(12); if (futu.buf.length < 44 + len) return;
    const sn = futu.buf.readUInt32LE(8), fmt = futu.buf.readUInt8(6), body = futu.buf.subarray(44, 44 + len); futu.buf = futu.buf.subarray(44 + len);
    const p = futu.pend.get(sn); if (!p) continue; futu.pend.delete(sn);   // pushes are not registered, so anything unmatched is ignored
    if (fmt !== 1) { p.rej(new Error('OpenD replied in an encrypted or protobuf format. Turn off RSA encryption for API connections in OpenD.')); continue; }
    try { p.res(JSON.parse(body.toString('utf8'))); } catch (e) { p.rej(new Error('Could not read the OpenD reply')); }
  }
}
const futuOk = (r, what) => { if (!r || r.retType !== 0) throw new Error(`Futu ${what}: ${(r && r.retMsg) || 'failed'}`); return r.s2c || {}; };
function futuConnect(s) {
  const host = s.futuHost || '127.0.0.1', port = +s.futuPort || 11111, k = host + ':' + port;
  if (futu.ready && futu.key === k) return futu.ready;
  futuReset(); futu.key = k;
  futu.ready = new Promise((res, rej) => {
    const sock = net.connect({ host, port }); futu.sock = sock; sock.setNoDelay(true);
    const fail = e => { if (futu.sock === sock) futuReset(); rej(new Error(`Cannot reach Futu/moomoo OpenD at ${k}. Start OpenD and log in.` + (e && e.code ? ' (' + e.code + ')' : ''))); };
    sock.setTimeout(8000, () => fail({ code: 'timeout' }));
    sock.once('error', fail);
    sock.on('data', futuData);
    sock.on('close', () => { if (futu.sock === sock) futuReset(); });
    sock.once('connect', async () => {
      sock.setTimeout(0);
      try {
        const r = futuOk(await futuSend(1001, { c2s: { clientVer: 100, clientID: 'EquityDesk-' + process.pid, recvNotify: false, packetEncAlgo: -1, pushProtoFmt: 1, programmingLanguage: 'JavaScript' } }), 'login');
        const iv = Math.max(5, (+r.keepAliveInterval || 10) * 0.8) * 1000;
        futu.ka = setInterval(() => futuSend(1004, { c2s: { time: Math.floor(Date.now() / 1000) } }).catch(() => {}), iv);
        sock.removeListener('error', fail); sock.on('error', () => {});
        res(true);
      } catch (e) { futuReset(); rej(e); }
    });
  });
  futu.ready.catch(() => {});
  return futu.ready;
}
function futuSec(sym) {
  usOnly(sym, 'Futu'); const { base, sfx } = parts(sym); const market = FUTU_MKT[sfx];
  if (market == null) throw new Error(`Futu depth is not set up for .${sfx} symbols`);
  return { market, code: sfx === 'HK' ? String(+base).padStart(5, '0') : sfx ? base : base.replace(/-/g, '.') };
}
futu.book = async (sym, s) => {
  const sec = futuSec(sym); await futuConnect(s);
  const id = sec.market + ':' + sec.code;
  if (!futu.subs.has(id)) {
    if (futu.subs.size >= 40) {   // free old subscriptions (OpenD keeps a subscription at least a minute)
      const old = [...futu.subs].filter(([, t]) => Date.now() - t > 65000).slice(0, 20);
      if (old.length) { await futuSend(3001, { c2s: { securityList: old.map(([k]) => { const [m, c] = k.split(/:(.*)/); return { market: +m, code: c }; }), subTypeList: [2], isSubOrUnSub: false } }).catch(() => {}); old.forEach(([k]) => futu.subs.delete(k)); }
    }
    futuOk(await futuSend(3001, { c2s: { securityList: [sec], subTypeList: [2], isSubOrUnSub: true, isRegOrUnRegPush: false } }), 'subscribe');
    futu.subs.set(id, Date.now()); await wait(300);
  }
  const r = futuOk(await futuSend(3012, { c2s: { security: sec, num: 10 } }), 'order book');
  return { bids: lv(r.orderBookBidList, x => x.price, x => x.volume, x => x.orederCount), asks: lv(r.orderBookAskList, x => x.price, x => x.volume, x => x.orederCount), time: Date.now(), label: 'Futu OpenD' };
};
futu.test = async s => { futuReset(); await futuConnect(s); return 'connected to OpenD at ' + futu.key; };

// ---------------- Longbridge ----------------
const longbridge = { ctx: null, sig: '', name: 'Longbridge' };
function lbSym(sym) {
  usOnly(sym, 'Longbridge'); const { base, sfx } = parts(sym);
  const m = { '': 'US', HK: 'HK', SS: 'SH', SZ: 'SZ', SI: 'SG' }[sfx]; if (!m) throw new Error(`Longbridge depth is not set up for .${sfx} symbols`);
  return (sfx === 'HK' ? String(+base) : base.replace(/-/g, '.')) + '.' + m;
}
async function lbCtx(s) {
  if (!s.lbAppKey || !s.lbAppSecret || !s.lbToken) throw new Error('Add your Longbridge app key, app secret and access token in SET first.');
  const sig = crypto.createHash('sha256').update(s.lbAppKey + '\n' + s.lbAppSecret + '\n' + s.lbToken).digest('hex');
  if (longbridge.ctx && longbridge.sig === sig) return longbridge.ctx;
  let lb; try { lb = await require('./lbnative').load(s.dataDir); } catch (e) { throw new Error('The Longbridge SDK could not load on this PC: ' + String(e.message || e).slice(0, 160)); }
  longbridge.ctx = lb.QuoteContext.new(lb.Config.fromApikey(s.lbAppKey, s.lbAppSecret, s.lbToken)); longbridge.sig = sig;
  return longbridge.ctx;
}
const dnum = d => d == null ? 0 : typeof d === 'number' ? d : typeof d.toNumber === 'function' ? d.toNumber() : +d;
longbridge.book = async (sym, s) => {
  const code = lbSym(sym), ctx = await lbCtx(s);
  let r; try { r = await ctx.depth(code); } catch (e) { longbridge.ctx = null; throw new Error('Longbridge: ' + String(e.message || e).slice(0, 200)); }
  return { bids: lv(r.bids, x => dnum(x.price), x => x.volume, x => x.orderNum), asks: lv(r.asks, x => dnum(x.price), x => x.volume, x => x.orderNum), time: Date.now(), label: 'Longbridge' };
};
longbridge.test = async s => { longbridge.ctx = null; const ctx = await lbCtx(s); const lvl = await ctx.quoteLevel(); return 'quote level ' + (lvl || 'unknown'); };

// ---------------- Tiger Brokers ----------------
const tiger = { qc: null, sig: '', name: 'Tiger' };
function tgSym(sym) {
  usOnly(sym, 'Tiger'); const { base, sfx } = parts(sym);
  if (sfx === '') return { symbol: base.replace(/-/g, '.'), market: 'US' };
  if (sfx === 'HK') return { symbol: String(+base).padStart(5, '0'), market: 'HK' };
  if (sfx === 'SS' || sfx === 'SZ') return { symbol: base, market: 'CN' };
  if (sfx === 'SI') return { symbol: base, market: 'SG' };
  throw new Error(`Tiger depth is not set up for .${sfx} symbols`);
}
function tgClient(s) {
  if (!s.tigerId || !s.tigerKey) throw new Error('Add your Tiger ID and private key in SET first.');
  const sig = crypto.createHash('sha256').update([s.tigerId, s.tigerKey, s.tigerLicense, s.tigerToken].join('\n')).digest('hex');
  if (tiger.qc && tiger.sig === sig) return tiger.qc;
  const T = require('@tigeropenapi/tigeropen');
  // enableDynamicDomain:false stops the SDK spawning a helper process; tokenLoader keeps it from reading token files on disk.
  const cfg = T.createClientConfig({ tigerId: s.tigerId, privateKey: s.tigerKey, license: s.tigerLicense || undefined, token: s.tigerToken || undefined, tokenLoader: () => '', enableDynamicDomain: false, language: 'en_US' });
  tiger.qc = new T.QuoteClient(new T.HttpClient(cfg, undefined, { useQuoteServerUrl: true })); tiger.sig = sig;
  return tiger.qc;
}
tiger.book = async (sym, s) => {
  const q = tgSym(sym), qc = tgClient(s);
  let r; try { r = await qc.getQuoteDepth({ symbols: [q.symbol], market: q.market }); } catch (e) { throw new Error('Tiger: ' + String(e.message || e).slice(0, 200)); }
  const d = (Array.isArray(r) ? r : [r]).find(x => x && String(x.symbol).toUpperCase() === q.symbol.toUpperCase()) || (Array.isArray(r) ? r[0] : r) || {};
  return { bids: lv(d.bids, x => x.price, x => x.volume, x => x.count), asks: lv(d.asks, x => x.price, x => x.volume, x => x.count), time: Date.now(), label: 'Tiger' };
};
tiger.test = async s => { tiger.qc = null; const r = await tgClient(s).getMarketState('US'); return 'connected' + (Array.isArray(r) && r[0] && r[0].marketStatus ? ' (US market: ' + r[0].marketStatus + ')' : ''); };

// ---------------- Charles Schwab ----------------
// OAuth: the user signs in on schwab.com in their own browser; we only ever receive the redirect URL with a one-time code.
// The refresh token (7 days) is stored encrypted by main.js; the 30-minute access token stays in memory.
const SCH = 'https://api.schwabapi.com';
const schwab = { access: '', exp: 0, ws: null, wsReady: null, books: new Map(), subs: new Set(), req: 1, info: null, err: '', name: 'Schwab' };
const schCb = s => s.schwabCallback || 'https://127.0.0.1';
const basic = s => 'Basic ' + Buffer.from(s.schwabKey + ':' + s.schwabSecret).toString('base64');
schwab.authUrl = s => { if (!s.schwabKey) throw new Error('Save your Schwab app key and secret first.'); return `${SCH}/v1/oauth/authorize?client_id=${encodeURIComponent(s.schwabKey)}&redirect_uri=${encodeURIComponent(schCb(s))}`; };
async function schToken(s, body) {
  if (!s.schwabKey || !s.schwabSecret) throw new Error('Save your Schwab app key and secret first.');
  const r = await fetch(SCH + '/v1/oauth/token', { method: 'POST', headers: { Authorization: basic(s), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), signal: AbortSignal.timeout(15000) });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok || !j.access_token) throw new Error('Schwab sign-in failed: ' + (j.error_description || j.error || 'HTTP ' + r.status));
  schwab.access = j.access_token; schwab.exp = Date.now() + ((+j.expires_in || 1800) - 60) * 1000;
  return j;
}
// Returns the new refresh token so main.js can encrypt and store it.
schwab.exchange = async (s, pasted) => {
  if (!s.schwabKey || !s.schwabSecret) throw new Error('Save your Schwab app key and secret first.');
  let code = String(pasted || '').trim(); const m = code.match(/[?&]code=([^&#\s]+)/); if (m) code = m[1];
  try { code = decodeURIComponent(code); } catch (e) {}
  if (!code || code.length < 4) throw new Error('Paste the whole address your browser showed after you signed in (it contains code=…).');
  const j = await schToken(s, { grant_type: 'authorization_code', code, redirect_uri: schCb(s) });
  schwabClose(); return j.refresh_token || '';
};
async function schAccess(s) {
  if (schwab.access && Date.now() < schwab.exp) return schwab.access;
  if (!s.schwabRefresh) throw new Error('Sign in to Schwab in SET first (Sign in, then paste the address).');
  const j = await schToken(s, { grant_type: 'refresh_token', refresh_token: s.schwabRefresh });
  if (j.refresh_token && j.refresh_token !== s.schwabRefresh && s.saveSecret) s.saveSecret('schwabRefresh', j.refresh_token);
  return schwab.access;
}
function schwabClose() { if (schwab.ws) try { schwab.ws.close(); } catch (e) {} schwab.ws = null; schwab.wsReady = null; schwab.subs.clear(); schwab.books.clear(); }
async function schStream(s) {
  if (schwab.wsReady) return schwab.wsReady;
  schwab.wsReady = (async () => {
    const tok = await schAccess(s);
    const r = await fetch(SCH + '/trader/v1/userPreference', { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('Schwab: could not get streamer details (HTTP ' + r.status + '). Your app needs the Accounts and Trading product for streaming.');
    const pref = await r.json(), si = (pref.streamerInfo || [])[0];   // only the streamer fields are kept; account details in the reply are dropped
    if (!si || !si.streamerSocketUrl) throw new Error('Schwab: no streamer details on this login');
    schwab.info = { url: si.streamerSocketUrl, cid: si.schwabClientCustomerId, corr: si.schwabClientCorrelId, ch: si.schwabClientChannel, fn: si.schwabClientFunctionId };
    const WS = require('ws'), ws = new WS(schwab.info.url); schwab.ws = ws;
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Schwab streamer login timed out')), 12000);
      ws.on('error', e => { clearTimeout(t); rej(new Error('Schwab streamer: ' + (e.message || e))); });
      ws.on('close', () => { if (schwab.ws === ws) { schwab.ws = null; schwab.wsReady = null; schwab.subs.clear(); } });
      ws.on('open', () => ws.send(JSON.stringify({ requests: [{ service: 'ADMIN', command: 'LOGIN', requestid: '0', SchwabClientCustomerId: schwab.info.cid, SchwabClientCorrelId: schwab.info.corr,
        parameters: { Authorization: tok, SchwabClientChannel: schwab.info.ch, SchwabClientFunctionId: schwab.info.fn } }] })));
      ws.on('message', raw => {
        let m; try { m = JSON.parse(String(raw)); } catch (e) { return; }
        (m.response || []).forEach(x => { const c = x.content || {};
          if (x.service === 'ADMIN' && x.command === 'LOGIN') { clearTimeout(t); if (+c.code === 0) res(); else rej(new Error('Schwab streamer login: ' + (c.msg || c.code))); }
          else if (+c.code && c.code !== 0) schwab.err = (x.service || '') + ': ' + (c.msg || c.code); });
        (m.data || []).forEach(x => { if (!/_BOOK$/.test(x.service || '')) return; (x.content || []).forEach(b => {
          const prev = schwab.books.get(b.key) || {}, row = l => [+l['0'], +l['1'], l['2'] ? l['2'] + ' MM' : ''];
          schwab.books.set(b.key, { t: +b['1'] || Date.now(), svc: x.service, bids: Array.isArray(b['2']) ? b['2'].map(row) : prev.bids || [], asks: Array.isArray(b['3']) ? b['3'].map(row) : prev.asks || [] }); }); });
      });
    });
  })();
  schwab.wsReady.catch(() => { schwabClose(); });
  return schwab.wsReady;
}
const NYSE_LISTED = new Set(['NYQ', 'NYSE']);
schwab.book = async (sym, s, o = {}) => {
  usOnly(sym, 'Schwab'); const { base, sfx } = parts(sym); if (sfx) throw new Error('Schwab book data covers US stocks only');
  const key = base.replace(/-/g, '/'), svc = NYSE_LISTED.has(o.exch) ? 'NYSE_BOOK' : 'NASDAQ_BOOK';
  await schStream(s);
  if (!schwab.subs.has(svc + ':' + key)) {
    const cmd = [...schwab.subs].some(x => x.startsWith(svc + ':')) ? 'ADD' : 'SUBS';
    schwab.ws.send(JSON.stringify({ requests: [{ service: svc, command: cmd, requestid: String(++schwab.req), SchwabClientCustomerId: schwab.info.cid, SchwabClientCorrelId: schwab.info.corr, parameters: { keys: key, fields: '0,1,2,3' } }] }));
    schwab.subs.add(svc + ':' + key); schwab.err = '';
    for (let i = 0; i < 40 && !schwab.books.has(key) && !schwab.err; i++) await wait(100);
  }
  const b = schwab.books.get(key);
  if (!b) throw new Error('Schwab: no ' + svc.replace('_', ' ').toLowerCase() + ' data for ' + key + (schwab.err ? ' (' + schwab.err + ')' : ' yet. Book data needs a funded Schwab account and only updates while the market is open.'));
  return { bids: b.bids.filter(r => r[0] > 0), asks: b.asks.filter(r => r[0] > 0), time: b.t, label: 'Schwab ' + (b.svc === 'NYSE_BOOK' ? 'NYSE book' : 'Nasdaq book') };
};
schwab.test = async s => { schwab.access = ''; await schAccess(s); return 'signed in, token valid for 30 minutes (renewed automatically)'; };
schwab.signOut = () => { schwab.access = ''; schwab.exp = 0; schwabClose(); };

const BROKERS = { futu, longbridge, tiger, schwab };
module.exports = { BROKERS, futuSec, lbSym, tgSym };
