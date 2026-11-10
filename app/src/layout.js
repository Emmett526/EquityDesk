'use strict';
// Panel layout that works like Blender's areas: a tree of splits whose leaves are areas (tab groups).
//  - Drag an area's corner inward to split it; drag it into a neighbouring area to join (the neighbour is absorbed as tabs).
//  - Ctrl-drag a corner onto any area to swap the two. Drag an edge to resize; right-click an edge or header for area options.
//  - Each area's header has an editor-type menu, like Blender. Tabs can also be dragged onto another area's edge or middle.
window.Layout = (() => {
  function create(root, o) {
    let tree = null, active = null, maxed = null;
    const gid = () => 'g' + Math.random().toString(36).slice(2, 8);
    const groups = () => { const out = []; (function walk(n) { if (!n) return; if (n.k === 'group') out.push(n); else n.ch.forEach(walk); })(tree); return out; };
    const groupOf = id => groups().find(g => g.tabs.includes(id));
    function parentOf(node, n = tree, p = null) { if (n === node) return p; if (n && n.k === 'split') for (const c of n.ch) { const r = parentOf(node, c, n); if (r !== undefined) return r; } return undefined; }
    function replace(oldN, newN) { const p = parentOf(oldN); if (!p) tree = newN; else p.ch[p.ch.indexOf(oldN)] = newN; }
    function detachNode(node) {
      const p = parentOf(node); if (!p) { tree = null; return; }
      const i = p.ch.indexOf(node), s = p.sizes.splice(i, 1)[0]; p.ch.splice(i, 1);
      if (p.sizes.length) p.sizes[Math.max(0, i - 1)] += s;
      if (p.ch.length === 1) replace(p, p.ch[0]);
    }
    function take(id) { const g = groupOf(id); if (!g) return; g.tabs = g.tabs.filter(t => t !== id); if (g.active === id) g.active = g.tabs[g.tabs.length - 1]; if (!g.tabs.length) detachNode(g); }
    // put node `ng` beside `target`; `first` = ng goes left/top; f = share of the space for the first child
    function besides(target, ng, dir, first, f = 0.5) {
      const p = parentOf(target);
      if (p && p.dir === dir) { const i = p.ch.indexOf(target), s = p.sizes[i]; const a = s * f, b = s * (1 - f); p.ch.splice(first ? i : i + 1, 0, ng); p.sizes.splice(i, 1, ...(first ? [a, b] : [a, b])); }
      else replace(target, { k: 'split', dir, sizes: [f, 1 - f], ch: first ? [ng, target] : [target, ng] });
    }
    function place(id, target, zone) {
      if (!target) { if (!tree) tree = { k: 'group', id: gid(), tabs: [id], active: id }; else place(id, groups()[0], 'center'); return; }
      if (zone === 'center') { target.tabs.push(id); target.active = id; return; }
      besides(target, { k: 'group', id: gid(), tabs: [id], active: id }, zone === 'left' || zone === 'right' ? 'row' : 'col', zone === 'left' || zone === 'top');
    }
    function siblings(a, b) { const p = parentOf(a); if (!p || p !== parentOf(b)) return false; return Math.abs(p.ch.indexOf(a) - p.ch.indexOf(b)) === 1; }
    function join(keep, gone) {       // keep absorbs gone: its space and its panels (as tabs)
      const p = parentOf(keep), i = p.ch.indexOf(keep), j = p.ch.indexOf(gone);
      p.sizes[i] += p.sizes[j]; p.sizes.splice(j, 1); p.ch.splice(j, 1); keep.tabs.push(...gone.tabs);
      if (p.ch.length === 1) replace(p, p.ch[0]);
    }
    function swap(a, b) { [a.tabs, b.tabs] = [b.tabs, a.tabs]; [a.active, b.active] = [b.active, a.active]; }
    function splitArea(g, dir, f, first) { const nid = o.clone(g.active); if (!nid) return; besides(g, { k: 'group', id: gid(), tabs: [nid], active: nid }, dir, first, f); maxed = null; activate(nid); }

    // ---- rendering ----
    function render() {
      root.textContent = '';
      if (maxed && !groupOf(maxed)) maxed = null;
      if (!tree) { const e = document.createElement('div'); e.className = 'lg-empty'; e.textContent = 'No areas. Use Add above to create a chart, order book, monitor or AI assistant.'; root.appendChild(e); return; }
      root.appendChild(maxed ? groupEl(groupOf(maxed), true) : nodeEl(tree));
      o.onChange && o.onChange();
    }
    function nodeEl(n) {
      if (n.k === 'group') return groupEl(n);
      const el = document.createElement('div'); el.className = 'lg-split ' + n.dir;
      n.ch.forEach((c, i) => {
        if (i) { const g = document.createElement('div'); g.className = 'lg-gutter'; g.title = 'Drag to resize · right-click for area options';
          g.onmousedown = e => { if (e.button === 0) resize(e, n, i - 1, el); }; g.oncontextmenu = e => { e.preventDefault(); edgeMenu(e, n, i - 1); }; el.appendChild(g); }
        const ce = nodeEl(c); ce.style.flex = n.sizes[i] + ' 1 0'; el.appendChild(ce);
      });
      return el;
    }
    function groupEl(g, isMax) {
      const el = document.createElement('div'); el.className = 'lg-group' + (g.tabs.includes(active) ? ' act' : ''); el._g = g;
      const hd = document.createElement('div'); hd.className = 'lg-tabs';
      const kind = document.createElement('select'); kind.className = 'lg-kind'; kind.title = 'Editor type';
      kind.innerHTML = o.kinds.map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); kind.value = o.kindOf(g.active);
      kind.onmousedown = e => e.stopPropagation(); kind.onchange = () => { const nid = o.changeKind(g.active, kind.value); if (nid) { g.tabs[g.tabs.indexOf(g.active)] = nid; g.active = nid; activate(nid); } };
      hd.appendChild(kind);
      g.tabs.forEach(id => {
        const t = document.createElement('div'); t.className = 'lg-tab' + (id === g.active ? ' on' : ''); t.innerHTML = '<span></span><b title="Close">×</b>';
        t.firstChild.textContent = o.title(id);
        t.onmousedown = e => { if (e.button !== 0 || e.target.tagName === 'B') return; g.active = id; activate(id); dragTab(e, id); };
        t.lastChild.onclick = e => { e.stopPropagation(); close(id); };
        hd.appendChild(t);
      });
      const sp = document.createElement('div'); sp.className = 'lg-sp'; hd.appendChild(sp);
      hd.oncontextmenu = e => { e.preventDefault(); areaMenu(e, g); };
      [['◫', 'Split vertically', () => splitArea(g, 'row', 0.5, false)], ['⊟', 'Split horizontally', () => splitArea(g, 'col', 0.5, false)], [isMax ? '⤡' : '⤢', isMax ? 'Restore (Ctrl+Space)' : 'Maximise (Ctrl+Space)', () => toggleMax(g.active)]]
        .forEach(([s, ttl, f]) => { const b = document.createElement('button'); b.textContent = s; b.title = ttl; b.onclick = f; hd.appendChild(b); });
      const body = document.createElement('div'); body.className = 'lg-body';
      g.tabs.forEach(id => { const p = o.mount(id); p.style.display = id === g.active ? '' : 'none'; body.appendChild(p); });
      el.addEventListener('mousedown', () => { if (g.active !== active) focusArea(g); });   // no re-render here: rebuilding the DOM mid-click would swallow the click
      if (!isMax) ['tl', 'tr', 'bl', 'br'].forEach(c => { const k = document.createElement('div'); k.className = 'lg-corner ' + c; k.title = 'Drag inward to split · into a neighbour to join · Ctrl-drag to swap';
        k.onmousedown = e => { if (e.button === 0) { e.stopPropagation(); e.preventDefault(); cornerDrag(e, g, c); } }; el.appendChild(k); });
      el.append(hd, body); return el;
    }
    function resize(e, n, i, el) {
      e.preventDefault(); const kids = [...el.children].filter(c => !c.classList.contains('lg-gutter')), row = n.dir === 'row';
      const total = kids.reduce((a, k) => a + (row ? k.offsetWidth : k.offsetHeight), 0), sum = n.sizes[i] + n.sizes[i + 1], start = row ? e.clientX : e.clientY, s0 = n.sizes[i];
      document.body.classList.add(row ? 'lg-resizing-x' : 'lg-resizing-y');
      const mv = ev => { const d = ((row ? ev.clientX : ev.clientY) - start) / total * n.sizes.reduce((a, b) => a + b, 0);
        n.sizes[i] = Math.min(sum - 0.06 * sum, Math.max(0.06 * sum, s0 + d)); n.sizes[i + 1] = sum - n.sizes[i]; kids[i].style.flex = n.sizes[i] + ' 1 0'; kids[i + 1].style.flex = n.sizes[i + 1] + ' 1 0'; };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); document.body.classList.remove('lg-resizing-x', 'lg-resizing-y'); o.onChange && o.onChange(); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    }
    const overlay = cls => { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); return d; };
    const place2 = (d, r) => Object.assign(d.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    function groupAt(x, y) { const els = [...root.querySelectorAll('.lg-group')]; return els.find(e => { const r = e.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }); }
    // Blender-style corner action zone
    function cornerDrag(e, g, corner) {
      const x0 = e.clientX, y0 = e.clientY, src = [...root.querySelectorAll('.lg-group')].find(x => x._g === g), sr = src.getBoundingClientRect();
      const line = overlay('lg-splitline'), shade = overlay('lg-joinshade'), tip = overlay('lg-ghost'); let act = null;
      document.body.classList.add('lg-cornering');
      const mv = ev => {
        line.style.display = shade.style.display = 'none'; tip.style.display = 'block'; tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY + 10 + 'px'; act = null;
        const dx = ev.clientX - x0, dy = ev.clientY - y0; if (Math.hypot(dx, dy) < 8) { tip.textContent = 'Split / join / Ctrl swap'; return; }
        const te = groupAt(ev.clientX, ev.clientY), t = te && te._g;
        if (ev.ctrlKey && t && t !== g) { act = { k: 'swap', t }; place2(shade, te.getBoundingClientRect()); shade.className = 'lg-joinshade swap'; tip.textContent = 'SWAP areas'; return; }
        if (t === g) {
          const dir = Math.abs(dx) > Math.abs(dy) ? 'row' : 'col', f = dir === 'row' ? (ev.clientX - sr.left) / sr.width : (ev.clientY - sr.top) / sr.height;
          const ff = Math.min(0.9, Math.max(0.1, f)), first = dir === 'row' ? corner.includes('l') : corner.includes('t');
          act = { k: 'split', dir, f: ff, first };
          place2(line, dir === 'row' ? { left: sr.left + sr.width * ff - 1, top: sr.top, width: 2, height: sr.height } : { left: sr.left, top: sr.top + sr.height * ff - 1, width: sr.width, height: 2 });
          tip.textContent = dir === 'row' ? 'SPLIT vertically' : 'SPLIT horizontally'; return;
        }
        if (t) { shade.className = 'lg-joinshade' + (siblings(g, t) ? '' : ' no'); place2(shade, te.getBoundingClientRect());
          if (siblings(g, t)) { act = { k: 'join', t }; tip.textContent = 'JOIN: this area takes over'; } else tip.textContent = 'Can only join areas that share a full edge'; }
      };
      const up = () => {
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); line.remove(); shade.remove(); tip.remove(); document.body.classList.remove('lg-cornering');
        if (!act) return; maxed = null;
        if (act.k === 'split') splitArea(g, act.dir, act.f, act.first);
        if (act.k === 'join') { join(g, act.t); activate(g.active); }
        if (act.k === 'swap') { swap(g, act.t); activate(act.t.active); }
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    }
    function menu(e, items) {
      document.querySelectorAll('.lg-menu').forEach(m => m.remove());
      const m = overlay('lg-menu'); m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
      items.forEach(it => { if (!it) { m.appendChild(document.createElement('hr')); return; } const b = document.createElement('button'); b.textContent = it[0]; b.disabled = !it[1]; b.onclick = () => { m.remove(); it[1] && it[1](); }; m.appendChild(b); });
      setTimeout(() => window.addEventListener('mousedown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); window.removeEventListener('mousedown', off); } }), 0);
    }
    function edgeMenu(e, n, i) {
      const a = n.ch[i], b = n.ch[i + 1], ga = a.k === 'group', gb = b.k === 'group', h = n.dir === 'row';
      menu(e, [[`Join: ${h ? 'left' : 'top'} takes ${h ? 'right' : 'bottom'}`, ga && gb && (() => { join(a, b); render(); })], [`Join: ${h ? 'right' : 'bottom'} takes ${h ? 'left' : 'top'}`, ga && gb && (() => { join(b, a); render(); })],
        ['Swap areas', () => { [n.ch[i], n.ch[i + 1]] = [b, a]; [n.sizes[i], n.sizes[i + 1]] = [n.sizes[i + 1], n.sizes[i]]; render(); }], null,
        ['Even out sizes', () => { const s = n.sizes.reduce((x, y) => x + y, 0) / n.sizes.length; n.sizes = n.sizes.map(() => s); render(); }]]);
    }
    function areaMenu(e, g) {
      menu(e, [['Vertical split', () => splitArea(g, 'row', 0.5, false)], ['Horizontal split', () => splitArea(g, 'col', 0.5, false)], null,
        [maxed ? 'Restore area (Ctrl+Space)' : 'Maximise area (Ctrl+Space)', () => toggleMax(g.active)], ['Close area', () => { [...g.tabs].forEach(id => close(id)); }]]);
    }
    function dragTab(e, id) {
      const x0 = e.clientX, y0 = e.clientY; let on = false, ghost, hl, drop = null;
      const mv = ev => {
        if (!on && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        if (!on) { on = true; ghost = overlay('lg-ghost'); ghost.textContent = o.title(id); ghost.style.display = 'block'; hl = overlay('lg-drop'); }
        ghost.style.left = ev.clientX + 12 + 'px'; ghost.style.top = ev.clientY + 8 + 'px'; hl.style.display = 'none'; drop = null;
        const ge = groupAt(ev.clientX, ev.clientY); if (!ge) return;
        const r = ge.getBoundingClientRect(), fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
        const edges = [['left', fx], ['right', 1 - fx], ['top', fy], ['bottom', 1 - fy]].sort((a, b) => a[1] - b[1]);
        const zone = edges[0][1] < 0.25 ? edges[0][0] : 'center', g = ge._g;
        if (g.tabs.length === 1 && g.tabs[0] === id) return;
        if (zone === 'center' && g.tabs.includes(id)) return;
        drop = { g, zone };
        const box = { left: r.left, top: r.top, width: r.width, height: r.height };
        if (zone === 'left' || zone === 'right') { box.width = r.width / 2; if (zone === 'right') box.left += r.width / 2; }
        if (zone === 'top' || zone === 'bottom') { box.height = r.height / 2; if (zone === 'bottom') box.top += r.height / 2; }
        place2(hl, box);
      };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); if (ghost) { ghost.remove(); hl.remove(); }
        if (on && drop) { take(id); place(id, drop.g, drop.zone); maxed = null; activate(id); } };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    }
    function focusArea(g) { active = g.active; root.querySelectorAll('.lg-group').forEach(e => e.classList.toggle('act', e._g === g)); o.onActive && o.onActive(active); }
    function activate(id) { active = id; const g = groupOf(id); if (g) g.active = id; render(); o.onActive && o.onActive(id); }
    function close(id) { take(id); if (active === id) { const g = groups()[0]; active = g ? g.active : null; } render(); o.onClose && o.onClose(id); if (active) o.onActive && o.onActive(active); }
    function toggleMax(id) { maxed = maxed ? null : id; render(); }
    return {
      get: () => ({ tree, active }),
      set(s) { tree = s && s.tree || null; active = s && s.active; if (!groupOf(active)) { const g = groups()[0]; active = g ? g.active : null; } maxed = null; render(); },
      add(id, nextTo, zone = 'center') { const g = nextTo ? groupOf(nextTo) : groupOf(active); place(id, g || null, zone); activate(id); },
      split(id, dir) { const g = groupOf(id); if (g) splitArea(g, dir, 0.5, false); },
      joinNext(id) {   // keyboard join: the active area absorbs its next (else previous) neighbour area
        const g = groupOf(id), p = g && parentOf(g); if (!p) return false; const i = p.ch.indexOf(g), t = [p.ch[i + 1], p.ch[i - 1]].find(n => n && n.k === 'group');
        if (!t) return false; maxed = null; join(g, t); activate(g.active); return true; },
      close, activate, toggleMax, ids: () => groups().flatMap(g => g.tabs), active: () => active, rerender: render,
      visible: id => { const g = groupOf(id); return !!g && g.active === id && (!maxed || groupOf(maxed) === g); },
      next(step = 1) { const ids = groups().map(g => g.active); if (!ids.length) return; const i = ids.indexOf(active); activate(ids[(i + step + ids.length) % ids.length]); }
    };
  }
  return { create };
})();
