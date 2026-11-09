let S = vsLoad();
const $ = (id) => document.getElementById(id);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function save() {
  return chrome.storage.local.set({ [VS_KEY]: S });
}

function render() {
  document.body.classList.toggle('discreet', !!S.discreet);
  document.body.classList.toggle('dark', !!S.dark);
  $('discreet').checked = !!S.discreet;
  $('dark').checked = !!S.dark;
  $('showHidden').checked = !!S.showHidden;

  const hidden = S.hidden;
  $('unhideAll').hidden = hidden.length === 0;
  $('hiddenList').innerHTML = hidden.length
    ? hidden.map((id) => `<li><span class="ptitle" title="${esc(S.titles[id] || id)}">${esc(S.titles[id] || 'Untitled project')}</span><button type="button" class="show" data-show="${esc(id)}">Show</button></li>`).join('')
    : '<li class="empty">No hidden projects.</li>';

  const counts = {};
  Object.values(S.assign).forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  $('cats').innerHTML = S.cats.map((c) => `
    <li>
      <button type="button" class="dot" data-color="${esc(c.id)}" style="background:${esc(vsColor(c.color, S.dark))}" title="Change colour" aria-label="Change colour of ${esc(c.name)}"></button>
      <input class="name" data-name="${esc(c.id)}" value="${esc(c.name)}" maxlength="28" aria-label="Field name">
      <span class="count">${counts[c.id] || 0}</span>
      <button type="button" class="del" data-del="${esc(c.id)}">Delete</button>
    </li>`).join('') || '<li class="empty">No fields yet.</li>';
}

chrome.storage.local.get(VS_KEY, (r) => {
  S = vsLoad(r[VS_KEY]);
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[VS_KEY]) return;
  const active = document.activeElement;
  S = vsLoad(changes[VS_KEY].newValue);
  if (active && active.classList.contains('name')) return;
  render();
});

chrome.commands.getAll((cmds) => {
  const c = (cmds || []).find((x) => x.name === 'toggle-discreet');
  if (c && c.shortcut) $('shortcut').textContent = c.shortcut;
  else if (c) $('shortcut').textContent = 'no shortcut';
});

$('discreet').addEventListener('change', (e) => { S.discreet = e.target.checked; save(); render(); });
$('dark').addEventListener('change', (e) => { S.dark = e.target.checked; save(); render(); });
$('showHidden').addEventListener('change', (e) => { S.showHidden = e.target.checked; save(); });
$('unhideAll').addEventListener('click', () => { S.hidden = []; save(); render(); });
$('open').addEventListener('click', () => chrome.tabs.create({ url: 'https://www.overleaf.com/project' }));

document.addEventListener('click', (e) => {
  const show = e.target.closest('[data-show]');
  if (show) {
    S.hidden = S.hidden.filter((x) => x !== show.dataset.show);
    save();
    render();
    return;
  }
  const dot = e.target.closest('[data-color]');
  if (dot) {
    const c = S.cats.find((x) => x.id === dot.dataset.color);
    if (!c) return;
    const i = VS_PALETTE.indexOf(c.color);
    c.color = VS_PALETTE[(i + 1) % VS_PALETTE.length];
    save();
    render();
    return;
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    if (!del.classList.contains('confirm')) {
      document.querySelectorAll('.del.confirm').forEach((b) => { b.classList.remove('confirm'); b.textContent = 'Delete'; });
      del.classList.add('confirm');
      del.textContent = 'Confirm';
      return;
    }
    const id = del.dataset.del;
    S.cats = S.cats.filter((c) => c.id !== id);
    Object.keys(S.assign).forEach((p) => { if (S.assign[p] === id) delete S.assign[p]; });
    delete S.groupsClosed[id];
    save();
    render();
    return;
  }
  document.querySelectorAll('.del.confirm').forEach((b) => { b.classList.remove('confirm'); b.textContent = 'Delete'; });
});

document.addEventListener('change', (e) => {
  const input = e.target.closest('[data-name]');
  if (!input) return;
  const c = S.cats.find((x) => x.id === input.dataset.name);
  const name = input.value.trim();
  if (!c) return;
  if (!name) { input.value = c.name; return; }
  c.name = name;
  save();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('name')) e.target.blur();
});

$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('newCat').value.trim();
  if (!name) return;
  S.cats.push({ id: 'c' + Date.now().toString(36), name, color: VS_PALETTE[S.cats.length % VS_PALETTE.length] });
  $('newCat').value = '';
  save();
  render();
});

$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vanoshelf-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $('msg').textContent = 'Backup exported.';
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.cats)) throw new Error('bad');
    S = vsLoad(data);
    await save();
    render();
    $('msg').textContent = 'Backup imported.';
  } catch (err) {
    $('msg').textContent = 'This file is not a VanoShelf backup.';
  }
  e.target.value = '';
});
