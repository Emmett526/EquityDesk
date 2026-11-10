'use strict';
// Live headlines from public RSS / Atom feeds of credible sources. Runs in the main process (no CORS); the page only gets plain text and http(s) links.
// Feeds are free public endpoints and can change without notice; a failing source is reported, the others still load.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EquityDesk/1.4 (research app)';
const SEC_UA = 'EquityDesk research app (contact: user@localhost)';   // SEC asks for a descriptive User-Agent

// [id, name, market-wide feeds, per-ticker feed (sym) => url | null]
const SOURCES = [
  ['bloomberg', 'Bloomberg', ['https://feeds.bloomberg.com/markets/news.rss', 'https://feeds.bloomberg.com/economics/news.rss', 'https://feeds.bloomberg.com/technology/news.rss'], null],
  ['yahoo', 'Yahoo Finance', ['https://finance.yahoo.com/news/rssindex'], s => `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(s)}&region=US&lang=en-US`],
  ['cnbc', 'CNBC', ['https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258'], null],
  ['marketwatch', 'MarketWatch', ['https://feeds.content.dowjones.io/public/rss/mw_topstories', 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse'], null],
  ['wsj', 'WSJ Markets', ['https://feeds.a.dj.com/rss/RSSMarketsMain.xml'], null],
  ['ft', 'Financial Times', ['https://www.ft.com/markets?format=rss'], null],
  ['nasdaq', 'Nasdaq', ['https://www.nasdaq.com/feed/rssoutbound?category=Markets'], s => `https://www.nasdaq.com/feed/rssoutbound?symbol=${encodeURIComponent(s)}`],
  ['google', 'Google News', ['https://news.google.com/rss/search?q=stock+market&hl=en-US&gl=US&ceid=US:en'], s => `https://news.google.com/rss/search?q=${encodeURIComponent(s + ' stock')}&hl=en-US&gl=US&ceid=US:en`],
  ['sec', 'SEC filings', [], s => /^[A-Z.\-]{1,6}$/.test(s) ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(s)}&type=&dateb=&owner=include&count=20&output=atom` : null]
];

const cache = new Map();   // url -> {t, items}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
  .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m)
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tagv = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; };
const safeUrl = u => { u = decode(u); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null; };

// RSS 2.0 <item> and Atom <entry>
function parse(xml, src) {
  const out = [], blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks.slice(0, 60)) {
    let link = tagv(b, 'link'); if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ''; }
    const title = decode(tagv(b, 'title')), url = safeUrl(link), when = Date.parse(decode(tagv(b, 'pubDate') || tagv(b, 'updated') || tagv(b, 'published') || tagv(b, 'dc:date')));
    if (!title || !url) continue;
    const via = decode(tagv(b, 'source'));   // Google News names the original publisher here
    out.push({ title: title.slice(0, 300), url, time: Number.isFinite(when) ? when : null, src: src[1], srcId: src[0], via: via && via !== src[1] ? via.slice(0, 60) : '', summary: decode(tagv(b, 'description') || tagv(b, 'summary')).slice(0, 400) });
  }
  return out;
}

async function getFeed(url, src, maxAgeMs) {
  const c = cache.get(url); if (c && Date.now() - c.t < maxAgeMs) return c.items;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  try {
    const h = { 'User-Agent': src[0] === 'sec' ? SEC_UA : UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' };
    if (c && c.etag) h['If-None-Match'] = c.etag; if (c && c.lm) h['If-Modified-Since'] = c.lm;   // conditional GET: cheap to poll often
    const r = await fetch(url, { headers: h, signal: ctl.signal });
    if (r.status === 304 && c) { c.t = Date.now(); return c.items; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const items = parse((await r.text()).slice(0, 3e6), src); cache.set(url, { t: Date.now(), items, etag: r.headers.get('etag'), lm: r.headers.get('last-modified') }); return items;
  } finally { clearTimeout(t); }
}

function mock(sym, srcs) {   // EQUITY_MOCK=1: synthetic headlines so the panel can be tested offline
  const now = Date.now(), T = ['beats estimates as data-center demand stays strong', 'shares slip after guidance', 'analysts raise price target', 'files 8-K on board change', 'options activity jumps ahead of earnings'];
  return srcs.flatMap((s, k) => [0, 1, 2].map(i => ({ title: `${sym || 'Stocks'}: ${T[(k + i) % T.length]} (${s[1]})`, url: 'https://example.com/' + s[0] + '/' + i, time: now - (k * 3 + i) * 7 * 60e3, src: s[1], srcId: s[0], via: '', summary: 'Sample headline in mock mode.' })));
}

// opts: { sym: 'NVDA' | '' (market-wide), sources: [ids] }
async function headlines(opts = {}) {
  const sym = String(opts.sym || '').toUpperCase().replace(/[^A-Z0-9.\-^=]/g, '').slice(0, 15), want = Array.isArray(opts.sources) && opts.sources.length ? opts.sources : SOURCES.map(s => s[0]);
  const srcs = SOURCES.filter(s => want.includes(s[0]));
  if (process.env.EQUITY_MOCK) return { items: mock(sym, srcs), errors: [], sources: SOURCES.map(s => ({ id: s[0], name: s[1] })) };
  const plain = sym.replace(/^\^/, '');
  const jobs = [];
  srcs.forEach(s => { const urls = sym ? (s[3] ? [s[3](plain)].filter(Boolean) : s[2]) : s[2]; urls.forEach(u => jobs.push([s, u])); });
  const errors = [], all = [];
  await Promise.all(jobs.map(async ([s, u]) => { try { all.push(...await getFeed(u, s, s[0] === 'sec' ? 60e3 : 12e3)); } catch (e) { errors.push(s[1] + ': ' + (e.name === 'AbortError' ? 'timed out' : String(e.message || e))); } }));
  let items = all;
  // market-wide feeds of sources without a ticker feed: keep only headlines that mention the ticker
  if (sym) items = items.filter(i => i.srcId === 'sec' || SOURCES.find(s => s[0] === i.srcId)[3] || new RegExp(`\\b${plain.replace(/[.\-]/g, '\\$&')}\\b`, 'i').test(i.title + ' ' + i.summary));
  const seen = new Set(); items = items.filter(i => { const k = i.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80); if (seen.has(k) || seen.has(i.url)) return false; seen.add(k); seen.add(i.url); return true; });
  items.sort((a, b) => (b.time || 0) - (a.time || 0));
  return { items: items.slice(0, 200), errors: [...new Set(errors)], sources: SOURCES.map(s => ({ id: s[0], name: s[1] })) };
}

module.exports = { headlines, parse, SOURCES };
