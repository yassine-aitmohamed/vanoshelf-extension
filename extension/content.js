(() => {
  'use strict';
  if (!/^\/project\/?$/.test(location.pathname)) return;

  const ID_RE = /^\/project\/([0-9a-f]{24})\/?$/;
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16M4 12h16M4 19h10"/></svg>';
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  let S = vsLoad();
  let ready = false;
  let readyAt = 0;
  let filter = 'all';
  let timer = 0;
  let panel = null;
  let toolbar = null;
  let groupsEl = null;
  let groupsSig = '';
  let panelSig = '';
  let toolbarSig = '';
  let pop = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const catOf = (id) => S.cats.find((c) => c.id === id);
  const col = (c) => vsColor(c.color, S.dark);
  const isHidden = (id) => S.hidden.includes(id);
  const shown = (id) => !isHidden(id) || (S.showHidden && !S.discreet);
  const catKey = (id) => (S.assign[id] && catOf(S.assign[id]) ? S.assign[id] : 'none');
  const passFilter = (id) => filter === 'all' || catKey(id) === filter;
  const setCls = (el, name, on) => { if (el.classList.contains(name) !== on) el.classList.toggle(name, on); };
  const inUi = (el) => !!(el && el.closest && el.closest('.vs-ui'));

  function save() {
    chrome.storage.local.set({ [VS_KEY]: S });
  }

  chrome.storage.local.get(VS_KEY, (r) => {
    S = vsLoad(r && r[VS_KEY]);
    ready = true;
    readyAt = Date.now();
    schedule();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[VS_KEY]) return;
    S = vsLoad(changes[VS_KEY].newValue);
    groupsSig = '';
    panelSig = '';
    toolbarSig = '';
    schedule();
  });

  function schedule() {
    if (timer) return;
    timer = setTimeout(run, 60);
  }

  /* ---------- dark page ---------- */

  function parseColor(str) {
    const m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  function toHsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function withAlpha(hex, a) {
    if (a >= 0.999) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  }

  function darkBg(c) {
    if (!c || c.a < 0.04) return null;
    const { h, s, l } = toHsl(c);
    if (l < 0.55) return null;
    if (s < 0.14 || l > 0.97) {
      let hex = '#2b322e';
      if (l >= 0.985) hex = '#1a1f1c';
      else if (l >= 0.94) hex = '#121614';
      else if (l >= 0.86) hex = '#242a26';
      return withAlpha(hex, c.a);
    }
    if (l < 0.82) return null;
    return `hsla(${Math.round(h)},${Math.round(Math.min(s, 0.4) * 100)}%,16%,${c.a})`;
  }

  function darkFg(c) {
    if (!c || c.a < 0.04) return null;
    const { h, s, l } = toHsl(c);
    if (l >= 0.6) return null;
    if (s < 0.2) {
      let hex = '#8a948e';
      if (l < 0.3) hex = '#e4e9e6';
      else if (l < 0.45) hex = '#a3ada7';
      return withAlpha(hex, c.a);
    }
    return `hsla(${Math.round(h)},${Math.round(Math.min(s, 0.75) * 100)}%,70%,${c.a})`;
  }

  function lift(str) {
    const c = parseColor(str);
    if (!c) return str;
    const { h, s, l } = toHsl(c);
    if (l >= 0.6 || s < 0.15) return str;
    return `hsl(${Math.round(h)},${Math.round(Math.min(s, 0.9) * 100)}%,70%)`;
  }

  const HOVERABLE = /^(TR|LI|A|BUTTON|LABEL|SUMMARY)$/;
  const DK_ATTRS = ['data-vsdk', 'data-vsdk-bg', 'data-vsdk-fg', 'data-vsdk-bd', 'data-vsdk-t', 'data-vsdk-c'];

  function unmark(root) {
    const list = [root, ...root.querySelectorAll('[data-vsdk]')];
    list.forEach((el) => {
      DK_ATTRS.forEach((a) => el.removeAttribute(a));
      el.style.removeProperty('--vsdk-bg');
      el.style.removeProperty('--vsdk-fg');
    });
  }

  function darkPass() {
    if (!S.dark) return;
    const els = [document.body, ...document.body.querySelectorAll('*:not([data-vsdk])')]
      .filter((el) => !el.hasAttribute('data-vsdk') && !inUi(el));
    const plans = els.map((el) => {
      const cs = getComputedStyle(el);
      const bgc = parseColor(cs.backgroundColor);
      const bg = darkBg(bgc);
      const fg = darkFg(parseColor(cs.color));
      let bd = false;
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(cs['border' + side + 'Width']) > 0) {
          const bc = parseColor(cs['border' + side + 'Color']);
          if (bc && bc.a > 0.04) {
            const t = toHsl(bc);
            if (t.l > 0.7 && t.s < 0.25) { bd = true; break; }
          }
        }
      }
      const tr = (!bgc || bgc.a < 0.04) && (HOVERABLE.test(el.tagName) || /^(row|menuitem|option|button|tab)$/.test(el.getAttribute('role') || ''));
      const cell = (!bgc || bgc.a < 0.04) && /^(TD|TH)$/.test(el.tagName);
      return { el, bg, fg, bd, tr, cell };
    });
    plans.forEach(({ el, bg, fg, bd, tr, cell }) => {
      el.setAttribute('data-vsdk', '');
      if (bg) { el.style.setProperty('--vsdk-bg', bg); el.setAttribute('data-vsdk-bg', ''); }
      if (fg) { el.style.setProperty('--vsdk-fg', fg); el.setAttribute('data-vsdk-fg', ''); }
      if (bd) el.setAttribute('data-vsdk-bd', '');
      if (tr) el.setAttribute('data-vsdk-t', '');
      if (cell) el.setAttribute('data-vsdk-c', '');
    });
  }

  /* ---------- project rows ---------- */

  function scan() {
    const out = [];
    const ids = new Set();
    document.querySelectorAll('a[href*="/project/"]').forEach((a) => {
      if (inUi(a)) return;
      let url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      const m = url.pathname.match(ID_RE);
      if (!m || ids.has(m[1])) return;
      const row = a.closest('tr, [role="row"]');
      const title = (a.textContent || '').trim();
      if (!row || !title) return;
      ids.add(m[1]);
      const cell = a.closest('td, [role="cell"], [role="gridcell"]') || a.parentElement;
      out.push({ id: m[1], a, row, cell, title });
    });
    return out;
  }

  const ICON_TEXT = /^(close|clear|cancel|×|✕|x|more_vert|more_horiz|label|sell|check)$/i;

  const ICON_SEL = '[aria-hidden="true"], [class*="material"], [class*="icon"], .sr-only, .visually-hidden';

  function labelText(root) {
    let out = '';
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t || ICON_TEXT.test(t)) continue;
      const el = n.parentElement;
      if (!el || inUi(el) || el.closest(ICON_SEL)) continue;
      out += (out ? ' ' : '') + t;
    }
    return out;
  }

  function dotColor(branch) {
    const els = [branch, ...branch.querySelectorAll('*')];
    for (const el of els) {
      if (inUi(el)) continue;
      const cs = getComputedStyle(el);
      const tag = el.tagName.toLowerCase();
      if (tag === 'circle' || tag === 'svg' || tag === 'path') {
        const f = parseColor(cs.fill);
        if (f && f.a > 0.2 && toHsl(f).s > 0.15) return cs.fill;
        continue;
      }
      if ((el.textContent || '').trim()) continue;
      const own = el.style && el.style.backgroundColor;
      const raw = own || (el.hasAttribute('data-vsdk-bg') ? '' : cs.backgroundColor);
      const bg = parseColor(raw);
      if (bg && bg.a > 0.2) return raw;
    }
    return '';
  }

  function tagsOf(p) {
    const groups = new Map();
    const walker = document.createTreeWalker(p.cell, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const txt = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!txt || ICON_TEXT.test(txt)) continue;
      const el = n.parentElement;
      if (!el || p.a.contains(el) || inUi(el) || el.closest(ICON_SEL)) continue;
      let b = el;
      while (b.parentElement && b.parentElement !== p.cell && !b.parentElement.contains(p.a)
        && labelText(b.parentElement) === labelText(b)) b = b.parentElement;
      if (b.contains(p.a)) continue;
      const g = groups.get(b) || [];
      g.push(txt);
      groups.set(b, g);
    }
    const out = [];
    const seen = new Set();
    groups.forEach((parts, b) => {
      const txt = parts.join(' ').trim();
      if (!txt || seen.has(txt)) return;
      seen.add(txt);
      out.push({ txt, color: dotColor(b) });
    });
    return out;
  }

  function tagsHtml(tags) {
    return tags.map((t) => {
      const c = t.color || '#8b958f';
      return `<span class="vs-tag"><b style="background:${esc(S.dark ? lift(c) : c)}"></b>${esc(t.txt)}</span>`;
    }).join('');
  }

  function cellHtml(id, title, tags) {
    return `<a class="vs-title" href="/project/${id}">${esc(title)}</a>` +
      `<span class="vs-tags">${tagsHtml(tags)}</span>` +
      `<span class="vs-fieldcol">${chipHtml(id)}</span>` +
      eyeHtml(id);
  }

  function metaOf(p) {
    const cells = Array.from(p.row.children).filter((c) => c === p.cell || (c.matches('td, th, [role="cell"], [role="gridcell"]') && getComputedStyle(c).display !== 'none'));
    const i = cells.indexOf(p.cell);
    const texts = (i >= 0 ? cells.slice(i + 1) : [])
      .map((c) => (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return { owner: texts[0] || '', modified: texts[1] || '' };
  }

  function chipHtml(id) {
    const c = catOf(catKey(id));
    if (c) {
      return `<button type="button" class="vs-chip" data-act="chip" data-id="${id}" style="color:${esc(col(c))}" title="Change field"><span class="vs-sw"></span>${esc(c.name)}</button>`;
    }
    return `<button type="button" class="vs-chip vs-chip-none" data-act="chip" data-id="${id}" title="Choose a field">+ field</button>`;
  }

  function eyeHtml(id) {
    const h = isHidden(id);
    const label = h ? 'Show this project' : 'Hide this project';
    return `<button type="button" class="vs-eye" data-act="eye" data-id="${id}" title="${label}" aria-label="${label}">${h ? EYE_OFF : EYE}</button>`;
  }

  function applyRow(p) {
    setCls(p.row, 'vs-row', true);
    setCls(p.a, 'vs-title', true);
    setCls(p.row, 'vs-is-hidden', isHidden(p.id));
    setCls(p.row, 'vs-gone', !(shown(p.id) && passFilter(p.id)));
    setCls(p.cell, 'vs-cell', true);
    let ctl = p.cell.querySelector(':scope > .vs-ctl');
    if (ctl && ctl.dataset.id !== p.id) { ctl.remove(); ctl = null; }
    if (!ctl) {
      ctl = document.createElement('div');
      ctl.className = 'vs-ui vs-ctl vs-grid';
      ctl.dataset.id = p.id;
      p.cell.appendChild(ctl);
    }
    const tags = tagsOf(p);
    const c = catOf(catKey(p.id));
    const sig = JSON.stringify([p.title, tags, catKey(p.id), c ? c.name + col(c) : '', isHidden(p.id), S.dark]);
    if (ctl.dataset.sig !== sig) {
      ctl.dataset.sig = sig;
      ctl.innerHTML = cellHtml(p.id, p.title, tags);
    }
  }

  /* ---------- sidebar panel ---------- */

  function findMount() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/organi[sz]e\s+tags/i.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
    });
    const t = walker.nextNode();
    if (!t || !t.parentElement || inUi(t.parentElement)) return null;
    let sec = t.parentElement;
    for (let i = 0; i < 6 && sec.parentElement && sec.parentElement !== document.body; i++) {
      if (sec.querySelector('ul, ol, [role="list"]') || /uncategori[sz]ed/i.test(sec.textContent)) break;
      sec = sec.parentElement;
    }
    const r = sec.getBoundingClientRect();
    if (r.width > 460 || r.left > window.innerWidth / 2) return null;
    return sec;
  }

  function buildPanel() {
    const el = document.createElement('div');
    el.className = 'vs-ui vs-panel';
    el.innerHTML = `
      <div class="vs-head">
        <strong>${ICON}VanoShelf <span class="vs-ver">v${esc(chrome.runtime.getManifest().version)}</span></strong>
        <button type="button" class="vs-min" data-act="min" title="Collapse" aria-label="Collapse">–</button>
      </div>
      <div class="vs-body">
        <div class="vs-lbl">Fields</div>
        <div class="vs-cats"></div>
        <form class="vs-add vs-nod">
          <input type="text" placeholder="New category" maxlength="28" aria-label="New category">
          <button type="submit">Add</button>
        </form>
        <button type="button" class="vs-switch vs-nod" role="switch" aria-checked="false" data-act="toggle" data-k="showHidden"><span>Show hidden projects</span><span class="vs-track"></span></button>
        <button type="button" class="vs-switch" role="switch" aria-checked="false" data-act="toggle" data-k="discreet"><span>Discreet mode</span><span class="vs-track"></span></button>
        <div class="vs-hint">In discreet mode, hidden projects disappear and titles stay blurred except under your cursor. Shortcut: Alt+Shift+D.</div>
      </div>`;
    el.querySelector('.vs-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.currentTarget.querySelector('input');
      const name = input.value.trim();
      if (!name) return;
      S.cats.push({ id: 'c' + Date.now().toString(36), name, color: VS_PALETTE[S.cats.length % VS_PALETTE.length] });
      input.value = '';
      save();
    });
    el.addEventListener('keydown', (e) => e.stopPropagation());
    return el;
  }

  function mountPanel(rows) {
    if (!panel) panel = buildPanel();
    const host = panel.parentElement && panel.parentElement.classList.contains('vs-li') ? panel.parentElement : panel;
    if (!host.isConnected || panel.classList.contains('vs-float')) {
      const sec = findMount();
      if (sec) {
        panel.classList.remove('vs-float');
        if (sec.parentElement && /^(UL|OL)$/.test(sec.parentElement.tagName)) {
          const li = document.createElement('li');
          li.className = 'vs-ui vs-li';
          li.appendChild(panel);
          sec.after(li);
        } else {
          sec.after(panel);
        }
      } else if (!host.isConnected && Date.now() - readyAt > 2500) {
        panel.classList.add('vs-float');
        document.body.appendChild(panel);
      }
    }
    renderPanel(rows);
  }

  function renderPanel(rows) {
    const base = rows.filter((p) => shown(p.id));
    const counts = { all: base.length, none: 0 };
    S.cats.forEach((c) => { counts[c.id] = 0; });
    base.forEach((p) => { counts[catKey(p.id)] = (counts[catKey(p.id)] || 0) + 1; });
    const items = [{ id: 'all', name: 'All projects', color: '' }]
      .concat(S.cats.map((c) => ({ id: c.id, name: c.name, color: col(c) })))
      .concat([{ id: 'none', name: 'Uncategorized', color: 'var(--vs-soft)' }]);
    const sig = JSON.stringify([items, counts, filter]);
    if (sig !== panelSig) {
      panelSig = sig;
      panel.querySelector('.vs-cats').innerHTML = items.map((it) => `
        <button type="button" class="vs-cat${filter === it.id ? ' vs-on' : ''}" data-act="filter" data-f="${esc(it.id)}">
          <span class="vs-sw${it.id === 'all' ? ' vs-sw-all' : ''}" style="background:${it.id === 'all' ? 'transparent' : esc(it.color)}"></span>
          <span class="vs-cname">${esc(it.name)}</span><span class="vs-n">${counts[it.id] || 0}</span>
        </button>`).join('');
    }
    setCls(panel, 'vs-collapsed', !!S.collapsed);
    panel.querySelectorAll('[data-act="toggle"]').forEach((b) => {
      const v = String(!!S[b.dataset.k]);
      if (b.getAttribute('aria-checked') !== v) b.setAttribute('aria-checked', v);
    });
  }

  /* ---------- toolbar above the list ---------- */

  function mountToolbar(table) {
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'vs-ui vs-toolbar';
      toolbar.innerHTML = `
        <div class="vs-seg" role="group" aria-label="View">
          <button type="button" data-act="view" data-view="list">List</button>
          <button type="button" data-act="view" data-view="group">By field</button>
        </div>
        <div class="vs-status"></div>
        <div class="vs-banner">Discreet mode on · hover over a title to read it</div>`;
      toolbarSig = '';
    }
    if (!table) { toolbar.remove(); return; }
    const anchor = groupsEl && groupsEl.isConnected ? groupsEl : table;
    if (!toolbar.isConnected || toolbar.nextElementSibling !== anchor) anchor.before(toolbar);
    const nh = S.hidden.length;
    const sig = JSON.stringify([S.view, nh, S.showHidden, S.discreet]);
    if (sig === toolbarSig) return;
    toolbarSig = sig;
    toolbar.querySelectorAll('[data-view]').forEach((b) => setCls(b, 'vs-on', b.dataset.view === S.view));
    toolbar.querySelector('.vs-status').innerHTML = nh && !S.discreet
      ? `<span class="vs-pill">${nh} hidden</span><span>${S.showHidden ? 'shown hatched' : 'removed from this page'}</span>`
      : '';
  }

  /* ---------- grouped view ---------- */

  function itemHtml(p, meta, tags) {
    return `<div class="vs-gitem${isHidden(p.id) ? ' vs-is-hidden' : ''}">
      <span class="vs-cbx" aria-hidden="true"></span>
      <div class="vs-grid">${cellHtml(p.id, p.title, tags)}</div>
      <div class="vs-gmeta">${esc(meta.owner)}</div>
      <div class="vs-gmeta">${esc(meta.modified)}</div>
    </div>`;
  }

  function tableOf(rows) {
    return rows.length ? (rows[0].row.closest('table') || rows[0].row.parentElement) : null;
  }

  function renderGroups(rows, table) {
    if (S.view !== 'group' || !table) {
      document.querySelectorAll('.vs-table-off').forEach((t) => t.classList.remove('vs-table-off'));
      if (groupsEl) { groupsEl.remove(); groupsEl = null; groupsSig = ''; }
      return;
    }
    document.querySelectorAll('.vs-table-off').forEach((t) => { if (t !== table) t.classList.remove('vs-table-off'); });
    setCls(table, 'vs-table-off', true);
    if (!groupsEl) {
      groupsEl = document.createElement('div');
      groupsEl.className = 'vs-ui vs-groups';
      groupsSig = '';
    }
    if (!groupsEl.isConnected || groupsEl.nextElementSibling !== table) table.before(groupsEl);

    const list = rows.filter((p) => shown(p.id) && passFilter(p.id)).map((p) => ({ p, meta: metaOf(p), tags: tagsOf(p) }));
    const groups = S.cats.map((c) => ({ c: { id: c.id, name: c.name, color: col(c) }, items: list.filter((x) => catKey(x.p.id) === c.id) })).filter((g) => g.items.length);
    const rest = list.filter((x) => catKey(x.p.id) === 'none');
    if (rest.length) groups.push({ c: { id: 'none', name: 'Uncategorized', color: 'var(--vs-soft)' }, items: rest });

    const sig = JSON.stringify([S.dark, S.groupsClosed, S.hidden, groups.map((g) => [g.c, g.items.map((x) => [x.p.id, x.p.title, x.meta, x.tags])])]);
    if (sig === groupsSig) return;
    groupsSig = sig;

    let html = '<div class="vs-ghead-row"><span class="vs-cbx" aria-hidden="true"></span><span>Title</span><span>Owner</span><span>Last modified</span></div>';
    if (!groups.length) html += '<div class="vs-empty">No projects in this view.</div>';
    groups.forEach((g) => {
      const closed = !!S.groupsClosed[g.c.id];
      html += `<button type="button" class="vs-ghead${closed ? ' vs-closed' : ''}" data-act="group" data-g="${esc(g.c.id)}" style="--vs-gc:${esc(g.c.color)}" aria-expanded="${!closed}">
        <span>${esc(g.c.name)}</span><span class="vs-n">${g.items.length}</span><span class="vs-car">▾</span></button>`;
      if (!closed) html += g.items.map((x) => itemHtml(x.p, x.meta, x.tags)).join('');
    });
    groupsEl.innerHTML = html;
  }

  /* ---------- field picker ---------- */

  function closePop() {
    if (pop) { pop.remove(); pop = null; }
  }

  function openPop(btn, id) {
    closePop();
    pop = document.createElement('div');
    pop.className = 'vs-ui vs-pop';
    pop.innerHTML = S.cats.map((c) => `
      <button type="button" class="vs-cat${catKey(id) === c.id ? ' vs-on' : ''}" data-act="set" data-id="${id}" data-cat="${esc(c.id)}">
        <span class="vs-sw" style="background:${esc(col(c))}"></span><span class="vs-cname">${esc(c.name)}</span></button>`).join('') +
      `<button type="button" class="vs-cat" data-act="set" data-id="${id}" data-cat=""><span class="vs-sw" style="background:var(--vs-soft)"></span><span class="vs-cname">Remove field</span></button>`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth;
    const left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - w - 8));
    pop.style.left = (left + window.scrollX) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    const first = pop.querySelector('button');
    if (first) first.focus();
  }

  document.addEventListener('click', (e) => {
    if (!inUi(e.target)) { closePop(); return; }
    e.stopPropagation();
    const b = e.target.closest('[data-act]');
    if (!b) return;
    e.preventDefault();
    const act = b.dataset.act;
    if (act === 'filter') { filter = b.dataset.f; panelSig = ''; groupsSig = ''; run(); return; }
    if (act === 'view') { S.view = b.dataset.view; save(); return; }
    if (act === 'min') { S.collapsed = !S.collapsed; save(); return; }
    if (act === 'toggle') { S[b.dataset.k] = !S[b.dataset.k]; save(); return; }
    if (act === 'chip') { openPop(b, b.dataset.id); return; }
    if (act === 'eye') {
      const id = b.dataset.id;
      S.hidden = isHidden(id) ? S.hidden.filter((x) => x !== id) : S.hidden.concat(id);
      save();
      return;
    }
    if (act === 'set') {
      if (b.dataset.cat) S.assign[b.dataset.id] = b.dataset.cat;
      else delete S.assign[b.dataset.id];
      closePop();
      save();
      return;
    }
    if (act === 'group') {
      const g = b.dataset.g;
      if (S.groupsClosed[g]) delete S.groupsClosed[g]; else S.groupsClosed[g] = true;
      save();
    }
  }, true);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('resize', closePop);

  /* ---------- column alignment ---------- */

  let alignSig = '';
  function textWidth(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().width;
  }

  function align() {
    const grids = [...document.querySelectorAll('.vs-grid')].filter((g) => g.offsetParent);
    if (!grids.length) return;
    let maxT = 0, maxG = 0, maxC = 0, width = Infinity;
    grids.forEach((g) => {
      const t = g.querySelector('.vs-title');
      const tg = g.querySelector('.vs-tags');
      const ch = g.querySelector('.vs-chip');
      if (t) maxT = Math.max(maxT, textWidth(t));
      if (tg && tg.firstElementChild) {
        const a = tg.firstElementChild.getBoundingClientRect();
        const b = tg.lastElementChild.getBoundingClientRect();
        maxG = Math.max(maxG, b.right - a.left);
      }
      if (ch) maxC = Math.max(maxC, textWidth(ch) + 26);
      width = Math.min(width, g.clientWidth);
    });
    const gap = 14;
    const room = width - maxG - maxC - 28 - gap * 3;
    const tw = Math.max(140, Math.min(Math.ceil(maxT) + 2, Math.floor(room)));
    const gw = Math.ceil(maxG);
    const cw = Math.ceil(maxC);
    const sig = tw + '|' + gw + '|' + cw;
    if (sig === alignSig) return;
    alignSig = sig;
    const root = document.documentElement.style;
    root.setProperty('--vs-tw', tw + 'px');
    root.setProperty('--vs-gw', gw + 'px');
    root.setProperty('--vs-cw', cw + 'px');
  }

  window.addEventListener('resize', () => { alignSig = ''; schedule(); });

  /* ---------- main loop ---------- */

  function run() {
    timer = 0;
    if (!ready) return;
    const root = document.documentElement;
    setCls(root, 'vs-discreet', !!S.discreet);
    setCls(root, 'vs-dark', !!S.dark);
    if (filter !== 'all' && filter !== 'none' && !catOf(filter)) filter = 'all';
    const rows = scan();
    let dirty = false;
    const seen = new Set(S.seen);
    rows.forEach((p) => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        S.seen.push(p.id);
        dirty = true;
        if (!S.assign[p.id]) {
          const k = VS_KNOWN[vsNorm(p.title)];
          if (k && catOf(k)) S.assign[p.id] = k;
        }
      }
      if (S.titles[p.id] !== p.title) { S.titles[p.id] = p.title; dirty = true; }
    });
    darkPass();
    rows.forEach(applyRow);
    mountPanel(rows);
    const table = tableOf(rows);
    renderGroups(rows, table);
    mountToolbar(table);
    align();
    if (dirty) save();
  }

  const isOurs = (n) => n.nodeType === 1 && n.classList && n.classList.contains('vs-ui');
  const foreignTokens = (v) => String(v || '').split(/\s+/).filter((t) => t && !t.startsWith('vs-')).sort().join(' ');

  new MutationObserver((muts) => {
    let relevant = false;
    for (const m of muts) {
      if (m.type === 'attributes') {
        const t = m.target;
        if (inUi(t)) continue;
        if (foreignTokens(m.oldValue) === foreignTokens(t.getAttribute('class'))) continue;
        if (t.hasAttribute && (t.hasAttribute('data-vsdk') || t.querySelector('[data-vsdk]'))) unmark(t);
        relevant = true;
        continue;
      }
      if (m.target.nodeType === 1 && inUi(m.target)) continue;
      const nodes = [...m.addedNodes, ...m.removedNodes];
      if (nodes.length && nodes.every(isOurs)) continue;
      relevant = true;
    }
    if (relevant) schedule();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });

  setTimeout(schedule, 2700);
})();
