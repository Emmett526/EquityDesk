'use strict';
// Custom UI (IND > Custom UI): cosmetic themes from Python, C or HTML+CSS. Whatever a file produces is reduced to
// colours, fonts, corner radius, a few decorative properties and the order of the nine tabs. Nothing else reaches the page:
// no markup, no scripts, no layout or visibility changes, no URLs. The result is rebuilt from the parsed parts, never passed through as text.
const fs = require('fs'), path = require('path');

const TABS = ['desk', 'watch', 'gp', 'fin', 'news', 'ind', 'lab', 'set', 'help'];
const TAB_NAMES = { DESK: 'desk', MON: 'watch', WATCH: 'watch', GP: 'gp', FIN: 'fin', NEWS: 'news', IND: 'ind', CUSTOM: 'ind', CUSTOMIZATION: 'ind', NEW: 'lab', LAB: 'lab', SET: 'set', HELP: 'help' };
// colour tokens a theme may set (CSS custom properties in app.css)
const VARS = ['bg', 'panel', 'panel2', 'panel3', 'line', 'line0', 'line2', 'line3', 'ink', 'ink2', 'hi', 'mut', 'amb', 'amb2', 'yel', 'up', 'dn', 'blu', 'hdr', 'hdrInk', 'tint', 'tint2'];
// properties allowed in custom CSS rules: they change how things look, never what is shown or where
const PROPS = new Set(['color', 'background', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'caret-color', 'accent-color', 'text-decoration-color', 'scrollbar-color', 'font-family', 'font-weight', 'font-style', 'letter-spacing',
  'text-transform', 'text-shadow', 'box-shadow', 'border-radius', 'text-decoration', 'background-image']);
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[\d.%\s,/+-]+\)|[a-z]{3,20})$/i;
const BAD = /url\s*\(|expression|javascript:|@|\\|attr\s*\(|image-set|element\s*\(|<|>|;|\{|\}/i;
const FONT = /^[\w\s,"'.-]{1,120}$/;

function color(v) { v = String(v == null ? '' : v).trim(); return COLOR.test(v) && !/^(inherit|initial|unset|revert)$/i.test(v) ? v : null; }
function tabsFrom(list, dropped) {
  if (!list) return null;
  const arr = (Array.isArray(list) ? list : String(list).split(/[\s,]+/)).map(x => String(x).trim()).filter(Boolean);
  const out = [];
  for (const x of arr) { const id = TABS.includes(x.toLowerCase()) ? x.toLowerCase() : /^[1-9]$/.test(x) ? TABS[+x - 1] : TAB_NAMES[x.toUpperCase()];
    if (id && !out.includes(id)) out.push(id); else if (!id) dropped.push('tab "' + x.slice(0, 20) + '" (tabs can only be reordered)'); }
  return out.length ? [...out, ...TABS.filter(t => !out.includes(t))] : null;
}
function cleanCss(css, dropped, varsOut) {   // -> safe CSS text rebuilt from whitelisted declarations
  css = String(css || '').slice(0, 100000).replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@[a-z-]+/i.test(css)) { dropped.push('@-rules (@import, @font-face, @media…)'); css = css.replace(/@[a-z-]+[^{;]*(;|\{([^{}]*\{[^}]*\})*[^}]*\})/gi, ''); }
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || sel.length > 300 || !/^[\w\s.#:>+~\-[\]="',()*]+$/.test(sel)) { dropped.push('selector "' + sel.slice(0, 40) + '"'); continue; }
    const decls = [];
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':'); if (i < 0) continue;
      const prop = d.slice(0, i).trim().toLowerCase(); let val = d.slice(i + 1).trim(); if (!prop || !val) continue;
      const imp = /!important$/i.test(val); val = val.replace(/!important$/i, '').trim();
      const custom = prop.startsWith('--') && VARS.includes(prop.slice(2));
      if (!(PROPS.has(prop) || custom)) { dropped.push(prop + ' (not cosmetic)'); continue; }
      if (val.length > 200 || BAD.test(val)) { dropped.push(prop + ' value'); continue; }
      if (prop === 'background-image' && !/^(none|(repeating-)?(linear|radial|conic)-gradient\([^()]*(\([^()]*\)[^()]*)*\))$/i.test(val)) { dropped.push('background-image (only gradients)'); continue; }
      if (prop === 'background' && !color(val) && !/^(none|transparent|(repeating-)?(linear|radial|conic)-gradient\([^()]*(\([^()]*\)[^()]*)*\))$/i.test(val)) { dropped.push('background (colour or gradient only)'); continue; }
      if (/shadow|letter-spacing|radius/.test(prop) && [...val.replace(/#[0-9a-f]{3,8}\b/gi, '').replace(/(rgba?|hsla?)\([^)]*\)/gi, '').matchAll(/(-?[\d.]+)(px|em|rem|vw|vh|%)?/g)].some(([, n, u]) => Math.abs(+n) > (u === 'em' || u === 'rem' ? 2 : u === '%' ? 50 : u === 'vw' || u === 'vh' ? 0 : 30))) { dropped.push(prop + ' (too large; it could cover the screen)'); continue; }
      if (prop === 'color' && /^transparent$/i.test(val)) { dropped.push('color: transparent (would hide text)'); continue; }
      if (custom && !color(val)) { dropped.push(prop + ' (must be a colour)'); continue; }
      if (custom && varsOut && /^(:root|html|body)$/.test(sel)) { varsOut[prop.slice(2)] = val; continue; }   // page-wide colours become theme colours (work in dark and light mode)
      if (prop === 'font-family' && !FONT.test(val)) { dropped.push('font-family value'); continue; }
      decls.push(`${prop}:${val}${imp ? ' !important' : ''}`);
    }
    if (decls.length) out.push(`${sel}{${decls.join(';')}}`);
  }
  return out.join('\n');
}
// any object (from Python / C JSON, a CSS file, or the colour pickers) -> the stored theme
function sanitize(t, dropped = []) {
  t = t && typeof t === 'object' ? t : {};
  const vars = {}, src = Object.assign({}, t.colors || {}, t.vars || {});
  for (const [k, v] of Object.entries(src)) { const key = String(k).replace(/^--/, ''); if (!VARS.includes(key)) { dropped.push('colour "' + key.slice(0, 20) + '"'); continue; } const c = color(v); if (c) vars[key] = c; else dropped.push(key + ' colour value'); }
  const out = { vars, name: String(t.name || 'Custom theme').slice(0, 60) };
  if (t.font && FONT.test(String(t.font))) out.font = String(t.font); else if (t.font) dropped.push('font');
  if (t.fontSize != null) { const n = +t.fontSize; if (n >= 11 && n <= 16) out.fontSize = Math.round(n); else dropped.push('fontSize (11 to 16)'); }
  if (t.radius != null) { const n = +t.radius; if (n >= 0 && n <= 10) out.radius = Math.round(n); else dropped.push('radius (0 to 10)'); }
  if (t.css) { const cv = {}; out.css = cleanCss(t.css, dropped, cv); out.vars = Object.assign(cv, vars); if (!out.css) delete out.css; }
  const tabs = tabsFrom(t.tabs, dropped); if (tabs) out.tabs = tabs;
  if (t.source) out.source = String(t.source).slice(0, 500);
  return out;
}
// read a theme file: .css / .html (style blocks only; markup is ignored), .py or .c (run once; it prints the theme as JSON)
async function fromFile(file, settings, runner) {
  const ext = path.extname(file).toLowerCase(), dropped = [];
  if (fs.statSync(file).size > 1e6) throw new Error('Theme files must be under 1 MB');
  let t;
  if (ext === '.css' || ext === '.html' || ext === '.htm') {
    const txt = fs.readFileSync(file, 'utf8');
    const body = txt.replace(/<!--[\s\S]*?-->/g, ''), css = ext === '.css' ? txt : [...body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
    if (ext !== '.css' && /<(?!\/?(style|html|head|body|meta|title|!doctype)\b)[a-z]/i.test(body.replace(/<style[\s\S]*?<\/style>/gi, ''))) dropped.push('HTML elements (only the <style> part is used)');
    const tag = k => (txt.match(new RegExp('@' + k + '\\s+(.+?)(?=\\s+@\\w|\\s*-->|\\s*\\*/|\\r?\\n|$)')) || [])[1];
    const meta = tag('tabs'), nm = tag('name');
    t = { css, tabs: meta, name: nm ? nm.trim() : path.basename(file) };
  } else if (ext === '.py' || ext === '.c') {
    const out = await runner(file, ext, settings);
    try { t = JSON.parse(String(out).trim().split(/\r?\n/).filter(Boolean).pop()); } catch (e) { throw new Error('The program must print the theme as one line of JSON, for example {"colors": {"amb": "#00c2ff"}}'); }
    if (!t.name) t.name = path.basename(file);
  } else throw new Error('Use a .py, .c, .css or .html file');
  t.source = file;
  return { theme: sanitize(t, dropped), dropped: [...new Set(dropped)] };
}
module.exports = { sanitize, fromFile, TABS, VARS };
