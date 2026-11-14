'use strict';
// Display language. English is the source text everywhere; another language is a layer on top that swaps
// what is shown on screen (text, tooltips, placeholders, confirm boxes) using the tables in i18n-zh.js.
// It never changes values, data, commands or behaviour, and does nothing at all while English is selected.
(function () {
  const TABLES = { 'zh-HK': { dict: window.I18N_ZH || {}, pats: window.I18N_ZH_PAT || [] } };
  const LANGS = [['en', 'English'], ['zh-HK', '繁體中文（香港）']];
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  const SKIP = 'script,style,textarea,code,pre,.msg > div,.nH,[data-noi18n]';   // never touch code samples, AI messages or headlines
  const SKIP_ATTR = '.msg > div,.nH,[data-noi18n]';
  let lang = 'en', tb = null, mo = null;
  const txt = new WeakMap(), att = new WeakMap(), seen = new Set();
  const norm = s => s.replace(/\s+/g, ' ').trim();

  function tr(s) {   // English -> translation, or null when there is none
    const k = norm(s);
    if (!tb || !k || !/[A-Za-z]/.test(k)) return null;
    if (Object.prototype.hasOwnProperty.call(tb.dict, k)) return tb.dict[k];
    for (const [re, f] of tb.pats) { const m = k.match(re); if (m) return typeof f === 'function' ? f(m, T) : k.replace(re, f); }
    if (k.includes(' · ')) {   // "Chart · updated 10:42" style labels: translate the parts that are known
      let hit = false; const out = k.split(' · ').map(p => { const t = tr1(p); if (t != null) { hit = true; return t; } return p; });
      if (hit) return out.join(' · ');
    }
    return null;
  }
  function tr1(p) { if (Object.prototype.hasOwnProperty.call(tb.dict, p)) return tb.dict[p]; for (const [re, f] of tb.pats) { const m = p.match(re); if (m) return typeof f === 'function' ? f(m, T) : p.replace(re, f); } return null; }
  function T(s) { const t = tr(s); return t == null ? s : t; }
  const keep = (s, t) => s.match(/^\s*/)[0] + t + s.match(/\s*$/)[0];
  const skip = el => !el || !!el.closest(SKIP);

  function doText(n) {
    const cur = n.nodeValue, r = txt.get(n);
    if (r && cur === r.t) return;                          // still showing our translation
    if (skip(n.parentElement)) return;
    const t = tr(cur);
    if (t == null) { txt.delete(n); return; }
    const out = keep(cur, t); txt.set(n, { v: cur, t: out }); n.nodeValue = out;
  }
  function doAttr(el, a) {
    const cur = el.getAttribute(a); if (cur == null) return;
    const m = att.get(el) || {}; const r = m[a];
    if (r && cur === r.t) return;
    if (el.closest(SKIP_ATTR)) return;
    const t = tr(cur);
    if (t == null) { delete m[a]; return; }
    m[a] = { v: cur, t }; att.set(el, m); el.setAttribute(a, t); seen.add(el);
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    ATTRS.forEach(a => root.hasAttribute(a) && doAttr(root, a));
    if (root.matches(SKIP)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: x => { if (x.nodeType === 1 && x.matches(SKIP)) { ATTRS.forEach(a => x.hasAttribute(a) && doAttr(x, a)); return NodeFilter.FILTER_REJECT; } return NodeFilter.FILTER_ACCEPT; } });
    let x; while ((x = w.nextNode())) { if (x.nodeType === 3) doText(x); else ATTRS.forEach(a => x.hasAttribute(a) && doAttr(x, a)); }
  }
  function restore() {   // back to the English source text
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const r = txt.get(n); if (r && n.nodeValue === r.t) n.nodeValue = r.v; txt.delete(n); }
    seen.forEach(el => { const m = att.get(el) || {}; for (const a in m) if (el.getAttribute(a) === m[a].t) el.setAttribute(a, m[a].v); att.delete(el); });
    seen.clear();
  }
  function apply(l) {
    l = TABLES[l] ? l : 'en';
    if (mo) { mo.disconnect(); mo = null; }
    if (lang !== 'en') restore();
    lang = l; tb = TABLES[l] || null;
    document.documentElement.lang = l === 'en' ? 'en' : l;
    document.body.classList.toggle('lang-zh', l !== 'en');
    if (!tb) return;
    walk(document.body);
    mo = new MutationObserver(ms => { for (const m of ms) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
      else m.addedNodes.forEach(walk);
    } });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.querySelectorAll('select.langSel').forEach(s => { s.value = l; });
  }
  // pop-ups the app opens with confirm() / alert() / prompt()
  const oc = window.confirm.bind(window), oa = window.alert.bind(window), op = window.prompt.bind(window);
  window.confirm = m => oc(lang === 'en' ? m : T(String(m)));
  window.alert = m => oa(lang === 'en' ? m : T(String(m)));
  window.prompt = (m, d) => op(lang === 'en' ? m : T(String(m)), d);

  function set(l) {
    apply(l);
    try { localStorage.setItem('lang', lang); } catch (e) {}
    try { window.api && window.api.set('lang', { lang }); } catch (e) {}
    document.querySelectorAll('select.langSel').forEach(s => { s.value = lang; });
    setTimeout(() => window.dispatchEvent(new CustomEvent('eqlang', { detail: lang })), 50);   // after lang.json is written: news, names and FIN reload in the new language
  }
  function fillSelects() {
    document.querySelectorAll('select.langSel').forEach(s => {
      if (!s.options.length) s.innerHTML = LANGS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
      s.value = lang; s.onchange = () => set(s.value);
    });
  }
  window.I18N = { set, get lang() { return lang; }, t: s => (lang === 'en' ? s : T(s)), LANGS };

  let first = 'en'; try { first = localStorage.getItem('lang') || 'en'; } catch (e) {}
  fillSelects(); apply(first); fillSelects();
  // the saved choice in lang.json wins (localStorage can be cleared); applied once the app has loaded
  if (window.api) window.api.get('lang').then(v => { const l = v && v.lang; if (l && l !== lang) set(l); }).catch(() => {});
})();
