let categories = [];
let currentCat = null;
let allItems   = [];
let editingId  = null; // インライン編集中のアイテムID

window.addEventListener('workspace-needed', () => {
  Utils.toast('ワークスペースを設定してください', 'error');
});

async function init() {
  try {
    categories = await API.getLibraryCategories();
    renderCatList();
    // デフォルトで最初のカテゴリを選択
    if (categories.length > 0) selectCat(categories[0].id);
  } catch (e) {
    document.getElementById('itemsArea').innerHTML =
      `<div class="empty-state"><div class="icon">⚠</div><p>ライブラリの読み込みに失敗しました: ${Utils.escapeHtml(e.message)}</p></div>`;
  }
}

function renderCatList() {
  const list = document.getElementById('catList');
  list.innerHTML = categories.map(c => `
    <div class="library-cat-item${currentCat===c.id?' active':''}" onclick="selectCat('${c.id}')">
      <span class="cat-prefix">${c.id.toUpperCase()}</span>
      <span>${Utils.escapeHtml(c.label)}</span>
    </div>`).join('');
}

async function selectCat(catId) {
  currentCat = catId;
  editingId  = null;
  renderCatList();
  const cat = categories.find(c => c.id === catId);
  document.getElementById('catTitle').textContent = cat ? cat.label : catId;
  document.getElementById('libSearch').style.display = '';
  document.getElementById('libSearch').value = '';
  document.getElementById('refreshBtn').style.display = '';
  if (cat && cat.help) {
    const helpEl = document.getElementById('catHelp');
    helpEl.textContent = cat.help;
    helpEl.style.display = '';
  } else {
    document.getElementById('catHelp').style.display = 'none';
  }
  await loadItems();
}

async function loadItems() {
  if (!currentCat) return;
  try {
    const { items } = await API.getLibraryItems(currentCat);
    allItems = items;
    renderItems(items);
  } catch (e) { Utils.toast('読み込みエラー: ' + e.message, 'error'); }
}

function filterItems(q) {
  if (!q.trim()) { renderItems(allItems); return; }
  const qL = q.toLowerCase();
  renderItems(allItems.filter(it =>
    it.name.toLowerCase().includes(qL) ||
    (it.description || '').toLowerCase().includes(qL) ||
    (it.tags || []).some(t => t.toLowerCase().includes(qL))
  ));
}

function renderItems(items) {
  const area = document.getElementById('itemsArea');
  if (items.length === 0) {
    area.innerHTML = `
      <div class="empty-state" style="height:auto;padding:32px">
        <div class="icon">📦</div>
        <p>このカテゴリにアイテムはありません</p>
      </div>
      ${renderAddRow()}`;
    return;
  }
  area.innerHTML = `
    <table class="library-table">
      <thead>
        <tr>
          <th style="width:100px">ID</th>
          <th style="width:200px">名前</th>
          <th>説明</th>
          <th style="width:160px">タグ</th>
          <th style="width:80px">操作</th>
        </tr>
      </thead>
      <tbody id="itemsTbody">
        ${items.map(it => renderItemRow(it)).join('')}
      </tbody>
    </table>
    ${renderAddRow()}`;
}

function renderItemRow(it) {
  if (editingId === it.id) return renderEditRow(it);
  const tagsHtml = (it.tags || []).map(t => `<span class="lib-tag">${Utils.escapeHtml(t)}</span>`).join('');
  return `<tr id="row-${it.id}">
    <td style="font-family:monospace;font-size:12px;color:var(--text-dim)">${Utils.escapeHtml(it.id)}</td>
    <td style="font-weight:500">${Utils.escapeHtml(it.name)}</td>
    <td>${Utils.escapeHtml(it.description || '')}</td>
    <td>${tagsHtml}</td>
    <td>
      <div class="lib-actions">
        <button class="btn btn-ghost btn-sm" onclick="startEdit('${it.id}')" title="編集">✏</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteItem('${it.id}')" title="削除">✕</button>
      </div>
    </td>
  </tr>`;
}

function renderEditRow(it) {
  return `<tr id="row-${it.id}" style="background:var(--surface2)">
    <td style="font-family:monospace;font-size:12px;color:var(--text-dim)">${Utils.escapeHtml(it.id)}</td>
    <td><input id="edit-name" type="text" value="${Utils.escapeHtml(it.name)}" style="width:100%;padding:4px 6px;background:var(--bg);border:1px solid var(--accent);border-radius:4px;color:var(--text)"></td>
    <td><input id="edit-desc" type="text" value="${Utils.escapeHtml(it.description || '')}" style="width:100%;padding:4px 6px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text)"></td>
    <td><input id="edit-tags" type="text" value="${Utils.escapeHtml((it.tags||[]).join(', '))}" placeholder="タグ1, タグ2" style="width:100%;padding:4px 6px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text)"></td>
    <td>
      <div class="lib-actions">
        <button class="btn btn-primary btn-sm" onclick="saveEdit('${it.id}')">保存</button>
        <button class="btn btn-ghost btn-sm" onclick="cancelEdit()">✕</button>
      </div>
    </td>
  </tr>`;
}

function renderAddRow() {
  return `<div class="lib-add-row" style="margin-top:16px">
    <input id="add-name" type="text" placeholder="名前（必須）" onkeydown="if(event.key==='Enter')addItem()">
    <input id="add-desc" type="text" placeholder="説明" onkeydown="if(event.key==='Enter')addItem()">
    <input id="add-tags" type="text" placeholder="タグ（カンマ区切り）" onkeydown="if(event.key==='Enter')addItem()">
    <button class="btn btn-primary" onclick="addItem()">＋ 追加</button>
  </div>`;
}

function startEdit(id) {
  editingId = id;
  const it = allItems.find(i => i.id === id);
  if (!it) return;
  const row = document.getElementById(`row-${id}`);
  if (row) row.outerHTML = renderEditRow(it);
  document.getElementById('edit-name').focus();
}

function cancelEdit() {
  editingId = null;
  renderItems(allItems);
}

async function saveEdit(id) {
  const name = document.getElementById('edit-name').value.trim();
  const desc = document.getElementById('edit-desc').value.trim();
  const tags = document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  if (!name) { Utils.toast('名前は必須です', 'error'); return; }
  try {
    const updated = await API.updateLibraryItem(currentCat, id, { name, description: desc, tags });
    const idx = allItems.findIndex(i => i.id === id);
    if (idx >= 0) allItems[idx] = updated;
    editingId = null;
    renderItems(allItems);
    Utils.toast('更新しました', 'success');
  } catch (e) { Utils.toast('更新エラー: ' + e.message, 'error'); }
}

async function addItem() {
  const name = (document.getElementById('add-name').value || '').trim();
  const desc = (document.getElementById('add-desc').value || '').trim();
  const tags = (document.getElementById('add-tags').value || '').split(',').map(t => t.trim()).filter(Boolean);
  if (!name) { Utils.toast('名前は必須です', 'error'); return; }
  try {
    const item = await API.addLibraryItem(currentCat, { name, description: desc, tags });
    allItems.push(item);
    renderItems(allItems);
    Utils.toast('追加しました', 'success');
  } catch (e) { Utils.toast('追加エラー: ' + e.message, 'error'); }
}

async function deleteItem(id) {
  try {
    await API.deleteLibraryItem(currentCat, id);
    allItems = allItems.filter(i => i.id !== id);
    if (editingId === id) editingId = null;
    renderItems(allItems);
    Utils.toast('削除しました');
  } catch (e) { Utils.toast('削除エラー: ' + e.message, 'error'); }
}

init();
