'use strict';
// Live headlines from public RSS / Atom feeds of credible sources. Runs in the main process (no CORS); the page only gets plain text and http(s) links.
// Feeds are free public endpoints and can change without notice; a failing source is reported, the others still load.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EquityDesk/1.4 (research app)';
const SEC_UA = 'EquityDesk research app (contact: user@localhost)';   // SEC asks for a descriptive User-Agent

// [id, name, market-wide feeds, per-ticker feed (sym, zhName) => url | null, language]
// English sources are listed first; the Chinese ones (lang 'zh') come first instead when the display language is 繁體中文.
const gq = (q, zh) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` + (zh ? '&hl=zh-HK&gl=HK&ceid=HK:zh-Hant' : '&hl=en-US&gl=US&ceid=US:en');
const SOURCES = [
  ['bloomberg', 'Bloomberg', ['https://feeds.bloomberg.com/markets/news.rss', 'https://feeds.bloomberg.com/economics/news.rss', 'https://feeds.bloomberg.com/technology/news.rss'], null, 'en'],
  ['yahoo', 'Yahoo Finance', ['https://finance.yahoo.com/news/rssindex'], s => `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(s)}&region=US&lang=en-US`, 'en'],
  ['cnbc', 'CNBC', ['https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258'], null, 'en'],
  ['marketwatch', 'MarketWatch', ['https://feeds.content.dowjones.io/public/rss/mw_topstories', 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse'], null, 'en'],
  ['wsj', 'WSJ Markets', ['https://feeds.a.dj.com/rss/RSSMarketsMain.xml'], null, 'en'],
  ['ft', 'Financial Times', ['https://www.ft.com/markets?format=rss'], null, 'en'],
  ['nasdaq', 'Nasdaq', ['https://www.nasdaq.com/feed/rssoutbound?category=Markets'], s => `https://www.nasdaq.com/feed/rssoutbound?symbol=${encodeURIComponent(s)}`, 'en'],
  ['google', 'Google News', [gq('stock market')], s => gq(s + ' stock'), 'en'],
  ['sec', 'SEC filings', [], s => /^[A-Z.\-]{1,6}$/.test(s) ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(s)}&type=&dateb=&owner=include&count=20&output=atom` : null, 'en'],
  // Chinese-language sources (free public feeds, no key)
  ['yahoohk', 'Yahoo 財經', ['https://hk.news.yahoo.com/rss/business'], s => `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(s)}&region=HK&lang=zh-Hant-HK`, 'zh'],
  ['rthk', '香港電台', ['https://rthk.hk/rthk/news/rss/c_expressnews_cfinance.xml'], null, 'zh'],
  ['mingpao', '明報財經', ['https://news.mingpao.com/rss/pns/s00004.xml'], null, 'zh'],
  ['googlehk', 'Google 新聞', [gq('港股 OR 股市 OR 恒指', true)], (s, n) => gq((n ? `"${n}"` : s) + ' 股價 OR 股票 OR 業績', true), 'zh'],
  // Chinese editions of Western outlets. FT 中文網 publishes in Simplified Chinese and is converted to Traditional (6th field 's2t').
  // NYT 中文網 has no reachable feed of its own, so its headlines come through Google News limited to cn.nytimes.com.
  ['wsjzh', '華爾街日報', ['https://cn.wsj.com/zh-hant/rss'], null, 'zh'],
  ['nytzh', '紐約時報中文網', [gq('site:cn.nytimes.com', true)], (s, n) => n ? gq(`site:cn.nytimes.com "${n}"`, true) : null, 'zh'],
  ['bbczh', 'BBC 中文', ['https://feeds.bbci.co.uk/zhongwen/trad/rss.xml'], null, 'zh'],
  ['ftzh', 'FT中文網', ['https://www.ftchinese.com/rss/news'], null, 'zh', 's2t']
];
let s2tConv = null;   // Simplified -> Traditional (Hong Kong) with OpenCC, loaded on first use
function s2t(x) { if (!x) return x; try { if (!s2tConv) s2tConv = require('opencc-js/cn2t').Converter({ from: 'cn', to: 'hk' }); return s2tConv(x); } catch (e) { return x; } }
const GN = new Set(['google', 'googlehk', 'nytzh']);   // Google News titles end with " - Publisher"; that part is dropped (the publisher is shown separately)
const CJK = /[\u3400-\u9fff]/;
// "騰訊控股" -> ["騰訊控股", "騰訊"]: the short form is what headlines usually say
function zhKeys(n) {
  if (!n) return []; const out = [n], b = n.replace(/[-－](W|SW|S|B)$/i, '').replace(/(控股|集團|股份|有限公司|公司|國際|科技)+$/, '');
  if (b && b !== n && b.length >= 2) out.push(b); return out;
}
// 0700.HK -> ["0700", "00700", "700"] so "騰訊(00700)" style mentions match
function hkCodes(sym) { const m = sym.match(/^0*(\d{1,5})\.HK$/); if (!m) return []; return [...new Set([m[1].padStart(4, '0'), m[1].padStart(5, '0')])]; }

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
    let t2 = title; if (via && GN.has(src[0])) { const m = t2.match(/^(.{6,}?)\s+-\s+[^-]{1,40}$/); if (m) t2 = m[1]; }
    if (src[5] === 's2t') t2 = s2t(t2);
    out.push({ title: t2.slice(0, 300), url, time: Number.isFinite(when) ? when : null, src: src[1], srcId: src[0], via: via && via !== src[1] && src[0] !== 'nytzh' ? via.slice(0, 60) : '', summary: (src[5] === 's2t' ? s2t : String)(decode(decode(tagv(b, 'description') || tagv(b, 'summary'))).slice(0, 400)) });
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
  const Z = ['業績勝預期 數據中心需求強勁', '公布指引後股價回落', '分析師上調目標價', '董事會變動公告', '業績前期權交投活躍'];
  return srcs.flatMap((s, k) => [0, 1, 2].map(i => s[4] === 'zh'
    ? { title: `${sym || '港股'}：${Z[(k + i) % Z.length]}（${s[1]}）`, url: 'https://example.com/' + s[0] + '/' + i, time: now - (k * 3 + i) * 9 * 60e3, src: s[1], srcId: s[0], via: '', summary: '示範模式的樣本標題。', lang: 'zh' }
    : { title: `${sym || 'Stocks'}: ${T[(k + i) % T.length]} (${s[1]})`, url: 'https://example.com/' + s[0] + '/' + i, time: now - (k * 3 + i) * 7 * 60e3, src: s[1], srcId: s[0], via: '', summary: 'Sample headline in mock mode.', lang: 'en' }));
}

// opts: { sym: 'NVDA' | '' (market-wide), sources: [ids] | null, off: [ids] (switched off), zh: true when the display language is Chinese, zhName: '騰訊控股' }
// Chinese mode: Chinese sources are fetched as well and their headlines come first (newest first), then the English ones,
// so there is always something to read when a symbol has no Chinese coverage. Each item carries lang 'zh' or 'en'.
async function headlines(opts = {}) {
  const sym = String(opts.sym || '').toUpperCase().replace(/[^A-Z0-9.\-^=]/g, '').slice(0, 15), zh = !!opts.zh;
  const avail = zh ? [...SOURCES.filter(s => s[4] === 'zh'), ...SOURCES.filter(s => s[4] !== 'zh')] : SOURCES.filter(s => s[4] !== 'zh');
  const off = Array.isArray(opts.off) ? opts.off : [];
  const want = Array.isArray(opts.sources) && opts.sources.length ? opts.sources : avail.map(s => s[0]);
  const srcs = avail.filter(s => want.includes(s[0]) && !off.includes(s[0]));
  const list = avail.map(s => ({ id: s[0], name: s[1], lang: s[4] }));
  if (process.env.EQUITY_MOCK) return order({ items: mock(sym, srcs), errors: [], sources: list }, zh);
  const plain = sym.replace(/^\^/, ''), zn = zh && CJK.test(opts.zhName || '') ? String(opts.zhName).slice(0, 40) : '';
  const jobs = [];
  srcs.forEach(s => { const urls = sym ? (s[3] ? [s[3](plain, zn)].filter(Boolean) : s[2]) : s[2]; urls.forEach(u => jobs.push([s, u])); });
  const errors = [], all = [];
  await Promise.all(jobs.map(async ([s, u]) => { try { all.push(...(await getFeed(u, s, s[0] === 'sec' ? 60e3 : 12e3)).map(i => Object.assign({}, i, { lang: s[4] === 'zh' && CJK.test(i.title) ? 'zh' : 'en' }))); } catch (e) { errors.push(s[1] + ': ' + (e.name === 'AbortError' ? 'timed out' : String(e.message || e))); } }));
  let items = all;
  // market-wide feeds of sources without a ticker feed: keep only headlines that mention the ticker (or, in Chinese, the company's Chinese name or HK code)
  if (sym) { const keys = [...zhKeys(zn), ...hkCodes(plain)], re = new RegExp(`\\b${plain.replace(/[.\-]/g, '\\$&')}\\b`, 'i');
    items = items.filter(i => { if (i.srcId === 'sec' || SOURCES.find(s => s[0] === i.srcId)[3]) return true; const t = i.title + ' ' + i.summary; return re.test(t) || keys.some(k => t.includes(k)); }); }
  const seen = new Set(); items = items.filter(i => { const k = i.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 80); if (!k || seen.has(k) || seen.has(i.url)) return false; seen.add(k); seen.add(i.url); return true; });
  return order({ items, errors: [...new Set(errors)], sources: list }, zh);
}
function order(r, zh) {
  const t = (a, b) => (b.time || 0) - (a.time || 0);
  r.items = zh ? [...r.items.filter(i => i.lang === 'zh').sort(t), ...r.items.filter(i => i.lang !== 'zh').sort(t)] : r.items.sort(t);
  r.items = r.items.slice(0, 200); r.zh = zh; return r;
}

module.exports = { headlines, parse, SOURCES, zhKeys, hkCodes };
