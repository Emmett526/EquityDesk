const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  quotes: s => inv('quotes', s), bars: (s, r, iv) => inv('bars', s, r, iv), tick: s => inv('tick', s), book: (s, o) => inv('book', s, o),
  get: n => inv('store:get', n), set: (n, v) => inv('store:set', n, v),
  settings: () => inv('settings:get'), setSettings: p => inv('settings:set', p), testKey: k => inv('key:test', k), clearKeys: () => inv('keys:clearAll'), keysFolder: () => inv('keys:folder'), schwab: { login: () => inv('schwab:login'), code: u => inv('schwab:code', u), signOut: () => inv('schwab:signout') },
  news: o => inv('news', o), stats: s => inv('stats', s), fin: s => inv('fin', s), fx: p => inv('fx', p), wlImport: () => inv('wl:import'), wlOpenFile: () => inv('wl:openFile'), onWlChanged: f => ipcRenderer.on('wl:changed', () => f()), wlExport: d => inv('wl:export', d), openUrl: u => inv('open:url', u), openPicks: () => inv('picks:open'), loadPicks: () => inv('picks:load'), clearPicks: () => inv('picks:clear'), buildDesk: d => inv('desk:build', d),
  local: { status: () => inv('local:status'), installOllama: () => inv('local:installOllama'), pull: m => inv('local:pull', m), cancel: m => inv('local:cancel', m), remove: m => inv('local:remove', m),
    onProgress: f => { const h = (_e, p) => f(p); ipcRenderer.on('local:progress', h); return () => ipcRenderer.removeListener('local:progress', h); } },
  ai: { chat: (id, m) => inv('ai:chat', id, m), stop: id => inv('ai:stop', id), models: pv => inv('ai:models', pv),
    onDelta: f => { const h = (_e, id, t) => f(id, t); ipcRenderer.on('ai:delta', h); return () => ipcRenderer.removeListener('ai:delta', h); } },
  skin: { get: () => inv('skin:get'), set: t => inv('skin:set', t), reset: () => inv('skin:reset'), import: () => inv('skin:import'), reload: () => inv('skin:reload') },
  ind: { list: () => inv('ind:list'), import: () => inv('ind:import'), reload: id => inv('ind:reload', id), update: (id, p) => inv('ind:update', id, p), remove: id => inv('ind:remove', id), compute: (id, b, p) => inv('ind:compute', id, b, p) }
});
