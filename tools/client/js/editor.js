let schemas = {};
let allDocs = [];
let currentDoc = null;
let currentSchema = null;
const undo = new UndoManager();

window.addEventListener('workspace-needed', () => { Utils.toast('ワークスペースを設定してください', 'error'); });
window.addEventListener('undo-state-changed', e => {
  document.getElementById('undoBtn').disabled = !e.detail.canUndo;
  document.getElementById('redoBtn').disabled = !e.detail.canRedo;
});
document.addEventListener('keydown', e => {
  if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); doUndo(); }
  if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); doRedo(); }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDoc(); }
});

async function init() {
  schemas = await fetch('/schemas/document_types.json').then(r => r.json());
  await loadSidebar();

  const p = new URLSearchParams(location.search);
  if (p.get('id') && p.get('type')) {
    // 新規作成モード
    const typeKey = p.get('type');
    const id = p.get('id');
    const s = schemas[typeKey];
    if (s) createNewDocument(id, typeKey);
  } else if (p.get('id')) {
    openDocument(p.get('id'));
  } else if (p.get('process')) {
    // プロセスでフィルタ
    filterSidebar('', p.get('process'));
  }
}

async function loadSidebar() {
  try {
    const { documents } = await API.listDocuments();
    allDocs = documents;
    renderSidebar(allDocs);
  } catch { renderSidebar([]); }
}

function renderSidebar(docs) {
  const body = document.getElementById('sidebarBody');
  const byProc = {};
  for (const d of docs) {
    if (!byProc[d.process]) byProc[d.process] = [];
    byProc[d.process].push(d);
  }
  body.innerHTML = ['SWE1','SWE2','SWE3','SWE4','SWE5','SWE6'].map(proc => {
    const pd = byProc[proc] || [];
    return `<div class="process-group">
      <div class="process-label" onclick="toggleGroup(this)">
        <span class="arrow">▾</span> ${proc}
        <span class="badge badge-draft" style="margin-left:auto">${pd.length}</span>
      </div>
      <div class="process-docs">
        ${pd.map(d => `
          <div class="doc-item${currentDoc && currentDoc.id===d.id?' active':''}" onclick="openDocument('${d.id}')">
            <span class="badge ${Utils.statusClass(d.status)}" style="font-size:10px">${Utils.statusLabel(d.status).slice(0,2)}</span>
            <span class="doc-title">${Utils.escapeHtml(d.title || d.id)}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function filterSidebar(q, procFilter) {
  let filtered = allDocs;
  if (q) filtered = filtered.filter(d => (d.title||'').toLowerCase().includes(q.toLowerCase()) || d.id.toLowerCase().includes(q.toLowerCase()));
  if (procFilter) filtered = filtered.filter(d => d.process === procFilter);
  renderSidebar(filtered);
}

function toggleGroup(el) {
  el.classList.toggle('collapsed');
  const docs = el.nextElementSibling;
  docs.style.display = el.classList.contains('collapsed') ? 'none' : '';
}

async function openDocument(id) {
  try {
    currentDoc = await API.getDocument(id);
    currentSchema = findSchema(currentDoc.type, currentDoc.process);
    undo.clear();
    undo.push(currentDoc.content);
    renderEditor();
    updateHeader();
    history.replaceState(null,'',`/editor?id=${id}`);
  } catch (e) { Utils.toast('読み込みエラー: ' + e.message, 'error'); }
}

function findSchema(type, process) {
  const key = `${process}_${type}`;
  return schemas[key] || null;
}

function createNewDocument(id, typeKey) {
  const s = schemas[typeKey];
  currentDoc = {
    id, type: s.idPrefix, process: s.process, title: s.label,
    version: '1.0', status: 'Draft',
    created: new Date().toISOString().slice(0,10),
    author: '', approver: '', upstream: [], downstream: [],
    content: { title: s.label, version: '1.0', status: 'Draft' },
    changelog: []
  };
  currentSchema = s;
  undo.clear();
  undo.push(currentDoc.content);
  renderEditor();
  updateHeader();
  document.getElementById('deleteBtn').style.display = 'none';
}

function updateHeader() {
  if (!currentDoc) return;
  document.getElementById('docId').textContent = currentDoc.id;
  document.getElementById('docTitle').textContent = currentDoc.title || currentDoc.id;
  const badge = document.getElementById('docBadge');
  badge.className = 'badge ' + Utils.statusClass(currentDoc.status);
  badge.textContent = Utils.statusLabel(currentDoc.status);
  document.getElementById('deleteBtn').style.display = currentDoc.changelog && currentDoc.changelog.length > 0 ? '' : 'none';
  // サイドバー更新
  const items = document.querySelectorAll('.doc-item');
  items.forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.doc-item').forEach(el => {
    if (el.textContent.includes(currentDoc.title || currentDoc.id)) el.classList.add('active');
  });
}

function renderEditor() {
  if (!currentDoc || !currentSchema) return;
  const main = document.getElementById('editorMain');
  main.innerHTML = `
    <div class="editor-tabs">
      <div class="editor-tab active" onclick="switchTab(this,'form')">フォーム</div>
      <div class="editor-tab" onclick="switchTab(this,'raw')">Markdown</div>
    </div>
    <div id="paneForm" class="editor-pane active">${renderForm()}</div>
    <div id="paneRaw"  class="editor-pane">
      <div class="editor-split">
        <textarea id="mdEditor" class="markdown-editor" oninput="syncFromMarkdown(this.value)">${docToMarkdown()}</textarea>
        <div id="mdPreview" class="card" style="padding:16px;overflow-y:auto">${renderMarkdown(docToMarkdown())}</div>
      </div>
    </div>`;
  attachDrag();
}

function switchTab(el, tab) {
  document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.editor-pane').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('pane' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  if (tab === 'raw') {
    document.getElementById('mdEditor').value = docToMarkdown();
    document.getElementById('mdPreview').innerHTML = renderMarkdown(docToMarkdown());
  }
}

function renderForm() {
  if (!currentSchema) return '';
  return currentSchema.sections.map(sec => {
    if (sec.type === 'itemList') return renderItemListSection(sec);
    return renderFieldSection(sec);
  }).join('');
}

function renderFieldSection(sec) {
  const c = currentDoc.content;
  return `<div class="form-section">
    <div class="form-section-title">${Utils.escapeHtml(sec.title)}</div>
    <div class="form-row">
      ${sec.fields.map(f => renderField(f, c[f.id] || '')).join('')}
    </div>
  </div>`;
}

function renderField(f, value) {
  const base = `id="f_${f.id}" onchange="onFieldChange('${f.id}',this.value)"`;
  if (f.type === 'select') {
    const opts = f.options.map(o => `<option value="${o}"${value===o?' selected':''}>${o}</option>`).join('');
    return `<div class="form-field"><label>${Utils.escapeHtml(f.label)}</label><select ${base}>${opts}</select></div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="form-field" style="grid-column:1/-1"><label>${Utils.escapeHtml(f.label)}</label><textarea ${base} rows="3">${Utils.escapeHtml(value)}</textarea></div>`;
  }
  return `<div class="form-field"><label>${Utils.escapeHtml(f.label)}</label><input type="text" ${base} value="${Utils.escapeHtml(value)}" placeholder="${Utils.escapeHtml(f.placeholder||'')}"></div>`;
}

function renderItemListSection(sec) {
  const items = currentDoc.content[sec.id] || [];
  return `<div class="form-section" id="sec_${sec.id}">
    <div class="form-section-title">${Utils.escapeHtml(sec.title)}</div>
    <div class="item-list" id="list_${sec.id}">
      ${items.map((item, i) => renderItemRow(sec, item, i)).join('')}
    </div>
    <button class="add-item-btn" onclick="addItem('${sec.id}')">＋ 項目を追加</button>
  </div>`;
}

function renderItemRow(sec, item, index) {
  return `<div class="item-row" draggable="true" data-sec="${sec.id}" data-idx="${index}">
    <div class="item-row-header">
      <span class="drag-handle" title="ドラッグして並び替え">⠿</span>
      <span class="item-number">#${index+1}</span>
      <button class="btn btn-ghost btn-icon btn-sm" style="margin-left:auto;color:var(--red)" onclick="removeItem('${sec.id}',${index})" title="削除">✕</button>
    </div>
    <div class="item-row-fields">
      ${sec.itemFields.map(f => renderField({...f, id:`${sec.id}_${index}_${f.id}`}, item[f.id] || '')).join('')}
    </div>
  </div>`;
}

function onFieldChange(fieldId, value) {
  // fieldId パターン: 単純フィールド → "title", アイテムフィールド → "requirements_0_description"
  const parts = fieldId.split('_');
  if (parts.length === 1) {
    // ヘッダーフィールド or 非リストセクション
    currentDoc.content[fieldId] = value;
    if (fieldId === 'title') currentDoc.title = value;
    if (fieldId === 'status') currentDoc.status = value;
    if (fieldId === 'version') currentDoc.version = value;
    if (fieldId === 'author') currentDoc.author = value;
    if (fieldId === 'approver') currentDoc.approver = value;
  } else {
    // アイテムリストフィールド: secId_index_fieldId
    const secId = parts[0];
    const idx = parseInt(parts[1]);
    const fid = parts.slice(2).join('_');
    if (!currentDoc.content[secId]) currentDoc.content[secId] = [];
    if (!currentDoc.content[secId][idx]) currentDoc.content[secId][idx] = {};
    currentDoc.content[secId][idx][fid] = value;
  }
  updateHeader();
  undo.push(currentDoc.content);
}

function addItem(secId) {
  if (!currentDoc.content[secId]) currentDoc.content[secId] = [];
  currentDoc.content[secId].push({});
  undo.push(currentDoc.content);
  reRenderSection(secId);
}

function removeItem(secId, index) {
  currentDoc.content[secId].splice(index, 1);
  undo.push(currentDoc.content);
  reRenderSection(secId);
}

function reRenderSection(secId) {
  const sec = currentSchema.sections.find(s => s.id === secId);
  if (!sec) return;
  const container = document.getElementById('sec_' + secId);
  if (container) container.outerHTML = renderItemListSection(sec);
  attachDrag();
}

// ── ドラッグ並び替え ──
function attachDrag() {
  let dragSrc = null;
  document.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('dragstart', e => { dragSrc = row; row.classList.add('dragging'); });
    row.addEventListener('dragend',   () => { dragSrc = null; row.classList.remove('dragging'); });
    row.addEventListener('dragover',  e => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (!dragSrc || dragSrc === row) return;
      const secId = row.dataset.sec;
      const fromIdx = parseInt(dragSrc.dataset.idx);
      const toIdx   = parseInt(row.dataset.idx);
      const arr = currentDoc.content[secId];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      undo.push(currentDoc.content);
      reRenderSection(secId);
    });
  });
}

// ── アンドゥ/リドゥ ──
function doUndo() {
  const prev = undo.undo();
  if (prev !== null) { currentDoc.content = prev; renderEditor(); updateHeader(); }
}
function doRedo() {
  const next = undo.redo();
  if (next !== null) { currentDoc.content = next; renderEditor(); updateHeader(); }
}

// ── 保存・削除 ──
async function saveDoc() {
  if (!currentDoc) return;
  try {
    const existing = await API.getDocument(currentDoc.id).catch(() => null);
    if (existing) await API.updateDocument(currentDoc.id, currentDoc);
    else          await API.createDocument(currentDoc);
    Utils.toast('保存しました', 'success');
    await loadSidebar();
  } catch (e) { Utils.toast('保存エラー: ' + e.message, 'error'); }
}

async function deleteDoc() {
  if (!currentDoc) return;
  await API.deleteDocument(currentDoc.id);
  Utils.toast('削除しました');
  currentDoc = null;
  document.getElementById('editorMain').innerHTML = '<div class="empty-state"><div class="icon">📄</div><p>削除されました</p></div>';
  updateHeader();
  await loadSidebar();
}

// ── Markdown 変換 ──
function docToMarkdown() {
  if (!currentDoc || !currentSchema) return '';
  let md = `# ${currentDoc.title || currentDoc.id}\n\n`;
  md += `| 項目 | 内容 |\n|------|------|\n`;
  md += `| ID | ${currentDoc.id} |\n`;
  md += `| バージョン | ${currentDoc.version} |\n`;
  md += `| ステータス | ${currentDoc.status} |\n`;
  md += `| 作成者 | ${currentDoc.author || ''} |\n\n`;

  for (const sec of currentSchema.sections) {
    md += `## ${sec.title}\n\n`;
    if (sec.type === 'itemList') {
      const items = currentDoc.content[sec.id] || [];
      if (items.length === 0) { md += '_（項目なし）_\n\n'; continue; }
      const headers = sec.itemFields.map(f => f.label).join(' | ');
      const sep     = sec.itemFields.map(() => '---').join(' | ');
      md += `| ${headers} |\n| ${sep} |\n`;
      for (const item of items) {
        const row = sec.itemFields.map(f => (item[f.id] || '').replace(/\n/g,' ')).join(' | ');
        md += `| ${row} |\n`;
      }
      md += '\n';
    } else {
      for (const f of sec.fields) {
        const v = currentDoc.content[f.id] || '';
        md += `**${f.label}**: ${v}\n\n`;
      }
    }
  }
  return md;
}

function syncFromMarkdown(md) {
  document.getElementById('mdPreview').innerHTML = renderMarkdown(md);
}

function renderMarkdown(md) {
  // シンプルな Markdown レンダラ (marked.js CDN なしでも動作)
  return md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n)*)/g, (m, header, rows) => {
      const ths = header.split('|').filter(Boolean).map(h => `<th>${h.trim()}</th>`).join('');
      const trs = rows.trim().split('\n').map(r =>
        '<tr>' + r.split('|').filter(Boolean).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
      ).join('');
      return `<table class="viewer-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    })
    .replace(/^_(.+)_$/gm, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// ── 新規作成 ──
function openNewDocModal() {
  const grid = document.getElementById('doctypeGrid');
  grid.innerHTML = Object.entries(schemas).map(([key, s]) => `
    <button class="doctype-btn" onclick="createNewDoc('${key}')">
      <div class="doctype-proc">${s.process}</div>
      <div class="doctype-name">${s.label}</div>
    </button>`).join('');
  document.getElementById('newDocModal').style.display = 'flex';
}
function closeNewDocModal() { document.getElementById('newDocModal').style.display = 'none'; }

async function createNewDoc(typeKey) {
  closeNewDocModal();
  const s = schemas[typeKey];
  const { documents } = await API.listDocuments().catch(() => ({ documents: [] }));
  const existingIds = documents.filter(d => d.type === s.idPrefix).map(d => d.id);
  const id = Utils.generateId(s.idPrefix, existingIds);
  createNewDocument(id, typeKey);
  history.replaceState(null, '', `/editor?id=${id}&type=${typeKey}`);
}

init();
