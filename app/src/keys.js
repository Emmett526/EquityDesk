'use strict';
// Keyboard map. Defaults follow the Bloomberg keyboard as emulated on a normal PC keyboard
// (F1 HELP, F2-F11 yellow sector keys, Enter = GO, Esc = CANCEL, PgUp/PgDn = page). Every binding can be changed in HELP.
window.Keys = (() => {
  const A = [
    // [id, group, label, default]
    ['help', 'Bloomberg', 'HELP', 'F1'], ['govt', 'Bloomberg', 'GOVT sector key', 'F2'], ['corp', 'Bloomberg', 'CORP sector key', 'F3'], ['mtge', 'Bloomberg', 'MTGE sector key', 'F4'],
    ['mmkt', 'Bloomberg', 'M-MKT sector key', 'F5'], ['muni', 'Bloomberg', 'MUNI sector key', 'F6'], ['pfd', 'Bloomberg', 'PFD sector key', 'F7'], ['equity', 'Bloomberg', 'EQUITY sector key', 'F8'],
    ['cmdty', 'Bloomberg', 'CMDTY sector key', 'F9'], ['index', 'Bloomberg', 'INDEX sector key', 'F10'], ['crncy', 'Bloomberg', 'CRNCY sector key', 'F11'], ['client', 'Bloomberg', 'CLIENT key (DESK)', 'F12'],
    ['cancel', 'Bloomberg', 'CANCEL (clear command, stop tool, deselect)', 'Escape'], ['menu', 'Bloomberg', 'MENU (back to previous screen)', 'Alt+ArrowLeft'],
    ['pageFwd', 'Bloomberg', 'PAGE FWD (next panel)', 'PageDown'], ['pageBack', 'Bloomberg', 'PAGE BACK (previous panel)', 'PageUp'], ['cmd', 'Bloomberg', 'Focus the command line', 'Ctrl+L'],
    ['vDesk', 'Screens', 'DESK research desk', 'Ctrl+1'], ['vMon', 'Screens', 'MON monitor', 'Ctrl+2'], ['vGp', 'Screens', 'GP launchpad', 'Ctrl+3'], ['vFin', 'Screens', 'FIN company financials', 'Ctrl+4'],
    ['vNews', 'Screens', 'NEWS live headlines', 'Ctrl+5'], ['vInd', 'Screens', 'CUSTOM customization (indicators, UI)', 'Ctrl+6'], ['vLab', 'Screens', 'Tab 7 (coming soon)', 'Ctrl+7'], ['vSet', 'Screens', 'SET settings', 'Ctrl+8'], ['vHelp', 'Screens', 'HELP keys & commands', 'Ctrl+9'], ['theme', 'Screens', 'Switch dark / light mode', 'Ctrl+Alt+T'], ['helpSearch', 'Screens', 'Search HELP (on the HELP screen)', 'Ctrl+F'],
    ['addChart', 'Panels', 'New chart panel', 'Ctrl+Alt+C'], ['addBook', 'Panels', 'New order book panel', 'Ctrl+Alt+B'], ['addMon', 'Panels', 'New monitor panel', 'Ctrl+Alt+M'], ['addAi', 'Panels', 'New AI assistant panel', 'Ctrl+Alt+A'], ['addWl', 'Panels', 'New watchlist panel', 'Ctrl+Alt+W'],
    ['splitRight', 'Panels', 'Split active area vertically', 'Ctrl+Alt+ArrowRight'], ['splitDown', 'Panels', 'Split active area horizontally', 'Ctrl+Alt+ArrowDown'],
    ['joinArea', 'Panels', 'Join active area with its neighbour', 'Ctrl+Alt+J'], ['closePanel', 'Panels', 'Close active panel', 'Ctrl+W'], ['maxPanel', 'Panels', 'Maximise / restore active area', 'Ctrl+Space'],
    ['tCursor', 'Drawing', 'Cursor', 'Alt+X'], ['tTrend', 'Drawing', 'Trend line', 'Alt+T'], ['tRay', 'Drawing', 'Ray', 'Alt+Y'], ['tHline', 'Drawing', 'Horizontal line', 'Alt+H'],
    ['tVline', 'Drawing', 'Vertical line', 'Alt+V'], ['tChannel', 'Drawing', 'Parallel channel', 'Alt+C'], ['tRect', 'Drawing', 'Rectangle', 'Alt+R'], ['tFib', 'Drawing', 'Fibonacci retracement', 'Alt+F'],
    ['tMeasure', 'Drawing', 'Date and price range', 'Alt+M'], ['tLong', 'Drawing', 'Long position', 'Alt+L'], ['tShort', 'Drawing', 'Short position', 'Alt+S'], ['tPitchfork', 'Drawing', 'Pitchfork', 'Alt+P'], ['tEraser', 'Drawing', 'Eraser', 'Alt+E'], ['tAvwap', 'Drawing', 'Anchored VWAP', 'Alt+W'], ['tVp', 'Drawing', 'Fixed range volume profile', 'Alt+K'], ['tArrow', 'Drawing', 'Arrow', 'Alt+A'], ['tText', 'Drawing', 'Text note', 'Alt+N'], ['tBrush', 'Drawing', 'Brush', 'Alt+B'],
    ['delDrawing', 'Drawing', 'Delete selected drawing', 'Delete'], ['undo', 'Drawing', 'Undo drawing change', 'Ctrl+Z'],
    ['indicators', 'Chart', 'Indicators dialog (active chart)', '/'], ['r1D', 'Chart', 'Range 1D', 'Alt+1'], ['r5D', 'Chart', 'Range 5D', 'Alt+2'], ['r1M', 'Chart', 'Range 1M', 'Alt+3'], ['r3M', 'Chart', 'Range 3M', 'Alt+4'], ['r6M', 'Chart', 'Range 6M', 'Alt+5'], ['r1Y', 'Chart', 'Range 1Y', 'Alt+6'], ['r5Y', 'Chart', 'Range 5Y', 'Alt+7']
  ];
  const DEF = Object.fromEntries(A.map(a => [a[0], a[3]]));
  let map = { ...DEF }, handlers = {}, capture = null;
  const MOD = new Set(['Control', 'Shift', 'Alt', 'Meta']);
  function combo(e) {
    if (MOD.has(e.key)) return null;
    let k = e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.code && /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.key;
    if (k === ' ') k = 'Space'; if (k.length === 1) k = k.toUpperCase();
    return [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : '', k].filter(Boolean).join('+');
  }
  const pretty = c => c ? c.replace(/Arrow/g, '').replace(/\+/g, ' + ').replace('Escape', 'Esc') : '(none)';
  function onKey(e) {
    const c = combo(e); if (!c) return false;
    if (capture) { e.preventDefault(); e.stopPropagation(); const cb = capture; capture = null; cb(c === 'Escape' ? null : c); return true; }
    const el = document.activeElement, tag = el && el.tagName, typing = /INPUT|TEXTAREA|SELECT/.test(tag);
    // While typing, only keys that cannot be text fire (F-keys, Esc, PgUp/PgDn, Ctrl/Alt combos); Delete and plain keys stay with the field.
    const nonText = /^F\d+$/.test(c) || /(^|\+)(Escape|PageUp|PageDown)$/.test(c) || /^(Ctrl|Alt)\+/.test(c);
    if (typing && (!nonText || /^Ctrl\+[ZYXCVA]$/.test(c))) return false;     // keep normal text editing in fields
    const id = Object.keys(map).find(k => map[k] === c); if (!id || !handlers[id]) return false;
    if (handlers[id](e) === false) return false;
    e.preventDefault(); return true;
  }
  return {
    actions: A, defaults: DEF, pretty, combo,
    load(over) { map = { ...DEF, ...(over || {}) }; },
    overrides() { const o = {}; for (const k in map) if (map[k] !== DEF[k]) o[k] = map[k]; return o; },
    get: id => map[id], all: () => ({ ...map }),
    set(id, c) { const clash = c && Object.keys(map).find(k => k !== id && map[k] === c); if (clash) map[clash] = ''; map[id] = c || ''; return clash; },
    reset() { map = { ...DEF }; },
    on(h) { Object.assign(handlers, h); },
    capture(cb) { capture = cb; },
    attach() { document.addEventListener('keydown', onKey, true); }
  };
})();
