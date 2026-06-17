let schemas = {};
let allDocs = [];
let currentDoc = null;
let currentSchema = null;
const undo = new UndoManager();

// ライブラリ: { category: [{ id, name, description, tags }] }
let libraryData = {};

// undoのデバウンスタイマー
let _undoTimer = null;

window.addEventListener('workspace-needed', openWsModal);
window.addEventListener('undo-state-changed', e => {
  document.getElementById('undoBtn').disabled = !e.detail.canUndo;
  document.getElementById('redoBtn').disabled = !e.detail.canRedo;
});
document.addEventListener('keydown', e => {
  if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); doUndo(); }
  if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); doRedo(); }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDoc(); }
});
document.addEventListener('click', e => {
  if (!e.target.classList.contains('help-icon')) {
    document.querySelectorAll('.help-popup').forEach(p => p.remove());
  }
});

async function init() {
  schemas = await fetch('/schemas/document_types.json').then(r => r.json());
  await Promise.all([loadSidebar(), loadLibrary()]);

  const p = new URLSearchParams(location.search);
  if (p.get('id')) {
    openDocument(p.get('id'));
  } else if (p.get('process')) {
    filterSidebar('', p.get('process'));
  }
}

async function loadLibrary() {
  try {
    const cats = await API.getLibraryCategories();
    const results = await Promise.all(cats.map(c =>
      API.getLibraryItems(c.id).then(r => ({ id: c.id, items: r.items }))
    ));
    libraryData = {};
    for (const r of results) libraryData[r.id] = r.items;
    injectDataLists();
  } catch { /* ライブラリ未設定時は無視 */ }
}

function injectDataLists() {
  document.querySelectorAll('datalist[id^="lib-"]').forEach(el => el.remove());
  for (const [cat, items] of Object.entries(libraryData)) {
    const dl = document.createElement('datalist');
    dl.id = `lib-${cat}`;
    dl.innerHTML = items.map(it => `<option value="${Utils.escapeHtml(it.name)}">${Utils.escapeHtml(it.description || '')}</option>`).join('');
    document.body.appendChild(dl);
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
        <span class="process-label-left">
          <span class="arrow">▾</span> ${proc}
        </span>
        <button class="proc-new-btn" title="${proc} の新規ドキュメント作成"
          onclick="event.stopPropagation();openNewDocModalFor('${proc}')">+</button>
        <span class="badge badge-draft" style="margin-left:4px">${pd.length}</span>
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
  el.nextElementSibling.style.display = el.classList.contains('collapsed') ? 'none' : '';
}

async function openDocument(id) {
  try {
    currentDoc = await API.getDocument(id);
    currentSchema = findSchema(currentDoc.type, currentDoc.process);
    undo.clear();
    undo.push(JSON.parse(JSON.stringify(currentDoc.content)));
    renderEditor();
    updateHeader();
    history.replaceState(null,'',`/editor?id=${id}`);
  } catch (e) {
    Utils.toast('読み込みエラー: ' + e.message, 'error');
    console.error('openDocument error:', e);
  }
}

function findSchema(type, process) {
  return schemas[`${process}_${type}`] || null;
}

function updateHeader() {
  if (!currentDoc) {
    document.getElementById('docId').textContent = '';
    document.getElementById('docTitle').textContent = 'ドキュメントを選択してください';
    document.getElementById('docBadge').className = 'badge';
    document.getElementById('docBadge').textContent = '';
    document.getElementById('deleteBtn').style.display = 'none';
    return;
  }
  document.getElementById('docId').textContent = currentDoc.id;
  document.getElementById('docTitle').textContent = currentDoc.title || currentDoc.id;
  const badge = document.getElementById('docBadge');
  badge.className = 'badge ' + Utils.statusClass(currentDoc.status);
  badge.textContent = Utils.statusLabel(currentDoc.status);
  document.getElementById('deleteBtn').style.display = '';
  document.querySelectorAll('.doc-item').forEach(el => {
    el.classList.toggle('active', el.querySelector('.doc-title')?.textContent === (currentDoc.title || currentDoc.id));
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
  injectDataLists();
  attachDrag();
  initDiagramPreviews();
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
  const helpHtml = sec.help ? `<span class="help-icon" onclick="showHelp(event,this,'${escAttr(sec.help)}')">?</span>` : '';
  return `<div class="form-section">
    <div class="form-section-title">
      <span class="field-label-row">${Utils.escapeHtml(sec.title)}${helpHtml}</span>
    </div>
    <div class="form-row">
      ${sec.fields.map(f => renderField(f, c[f.id] || '')).join('')}
    </div>
  </div>`;
}

function renderField(f, value) {
  const domId = `f_${f.id}`;
  const helpHtml = f.help ? `<span class="help-icon" onclick="showHelp(event,this,'${escAttr(f.help)}')">?</span>` : '';
  const labelHtml = `<span class="field-label-row"><label for="${domId}">${Utils.escapeHtml(f.label)}</label>${helpHtml}</span>`;
  const onInput = `oninput="onFieldChange('${f.id}',this.value)"`;

  if (f.type === 'select') {
    const opts = f.options.map(o => `<option value="${o}"${value===o?' selected':''}>${o}</option>`).join('');
    return `<div class="form-field">${labelHtml}<select id="${domId}" onchange="onFieldChange('${f.id}',this.value)">${opts}</select></div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="form-field" style="grid-column:1/-1">${labelHtml}<textarea id="${domId}" ${onInput} rows="3">${Utils.escapeHtml(value)}</textarea></div>`;
  }
  if (f.type === 'diagram') {
    const previewId = `diagramPreview_${f.id}`;
    return `<div class="form-field diagram-field" style="grid-column:1/-1">
      ${labelHtml}
      <div class="diagram-editor-wrap">
        <textarea id="${domId}" class="diagram-textarea" rows="8"
          placeholder="Mermaid記法でダイアグラムを入力…\n例:\ngraph TD\n  A[コンポーネントA] --> B[コンポーネントB]"
          ${onInput}>${Utils.escapeHtml(value)}</textarea>
        <div class="diagram-preview-panel">
          <div class="diagram-preview-label">プレビュー
            <button class="btn btn-sm btn-ghost" onclick="refreshDiagramPreview('${domId}','${previewId}')">↻ 更新</button>
          </div>
          <div id="${previewId}" class="diagram-preview"></div>
        </div>
      </div>
    </div>`;
  }
  if (f.type === 'partRef') {
    const listId = `lib-${f.partCategory || ''}`;
    return `<div class="form-field">
      ${labelHtml}
      <div class="partref-wrapper">
        <input type="text" id="${domId}" list="${listId}" value="${Utils.escapeHtml(value)}"
          placeholder="${Utils.escapeHtml(f.placeholder || 'ライブラリから選択または入力')}"
          ${onInput}>
        <a class="lib-link" href="/library" target="_blank" title="ライブラリを開く">⊞</a>
      </div>
    </div>`;
  }
  return `<div class="form-field">${labelHtml}<input type="text" id="${domId}" value="${Utils.escapeHtml(value)}" placeholder="${Utils.escapeHtml(f.placeholder||'')}" ${onInput}></div>`;
}

function renderItemListSection(sec) {
  const items = currentDoc.content[sec.id] || [];
  const helpHtml = sec.help ? `<span class="help-icon" onclick="showHelp(event,this,'${escAttr(sec.help)}')">?</span>` : '';
  return `<div class="form-section" id="sec_${sec.id}">
    <div class="form-section-title">
      <span class="field-label-row">${Utils.escapeHtml(sec.title)}${helpHtml}</span>
    </div>
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

// ── Mermaidダイアグラム ──
function initDiagramPreviews() {
  document.querySelectorAll('.diagram-textarea').forEach(ta => {
    const previewId = 'diagramPreview_' + ta.id.replace('f_', '');
    if (ta.value.trim()) refreshDiagramPreview(ta.id, previewId);
  });
}

async function refreshDiagramPreview(inputId, previewId) {
  const code = document.getElementById(inputId)?.value?.trim();
  const panel = document.getElementById(previewId);
  if (!panel) return;
  if (!code) { panel.innerHTML = '<span style="color:var(--text-dim);font-size:12px">（コードを入力するとプレビューが表示されます）</span>'; return; }
  try {
    panel.innerHTML = '';
    const { svg } = await mermaid.render('mermaid_' + previewId, code);
    panel.innerHTML = svg;
    panel.onclick = () => Utils.openDiagramModal(svg);
  } catch (e) {
    panel.innerHTML = `<span style="color:var(--red);font-size:12px">構文エラー: ${Utils.escapeHtml(e.message || String(e))}</span>`;
  }
}

// ── ヘルプポップアップ ──
function showHelp(evt, iconEl, helpText) {
  evt.stopPropagation();
  document.querySelectorAll('.help-popup').forEach(p => p.remove());
  const popup = document.createElement('div');
  popup.className = 'help-popup';
  popup.textContent = helpText.replace(/\\n/g, '\n');
  iconEl.style.position = 'relative';
  iconEl.appendChild(popup);
  const rect = iconEl.getBoundingClientRect();
  popup.className = 'help-popup ' + (rect.bottom + 200 > window.innerHeight ? 'above' : 'below');
}

function escAttr(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/\n/g, '\\n');
}

// ── フィールド変更ハンドラ ──
function onFieldChange(fieldId, value) {
  const match = fieldId.match(/^(.+?)_(\d+)_(.+)$/);
  if (match) {
    const [, secId, idxStr, fid] = match;
    const idx = parseInt(idxStr);
    if (!currentDoc.content[secId]) currentDoc.content[secId] = [];
    if (!currentDoc.content[secId][idx]) currentDoc.content[secId][idx] = {};
    currentDoc.content[secId][idx][fid] = value;
  } else {
    currentDoc.content[fieldId] = value;
    if (fieldId === 'title')    currentDoc.title    = value;
    if (fieldId === 'status')   currentDoc.status   = value;
    if (fieldId === 'version')  currentDoc.version  = value;
    if (fieldId === 'author')   currentDoc.author   = value;
    if (fieldId === 'approver') currentDoc.approver = value;
    updateHeader();
  }
  // undo はデバウンスして頻繁な push を抑制
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => undo.push(JSON.parse(JSON.stringify(currentDoc.content))), 600);
}

function addItem(secId) {
  if (!currentDoc.content[secId]) currentDoc.content[secId] = [];
  currentDoc.content[secId].push({});
  undo.push(JSON.parse(JSON.stringify(currentDoc.content)));
  reRenderSection(secId);
}

function removeItem(secId, index) {
  currentDoc.content[secId].splice(index, 1);
  undo.push(JSON.parse(JSON.stringify(currentDoc.content)));
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
    row.addEventListener('dragstart', () => { dragSrc = row; row.classList.add('dragging'); });
    row.addEventListener('dragend',   () => { dragSrc = null; row.classList.remove('dragging'); });
    row.addEventListener('dragover',  e => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (!dragSrc || dragSrc === row) return;
      const secId   = row.dataset.sec;
      const fromIdx = parseInt(dragSrc.dataset.idx);
      const toIdx   = parseInt(row.dataset.idx);
      const arr = currentDoc.content[secId];
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      undo.push(JSON.parse(JSON.stringify(currentDoc.content)));
      reRenderSection(secId);
    });
  });
}

// ── アンドゥ/リドゥ ──
function doUndo() {
  const prev = undo.undo();
  if (prev !== null) { currentDoc.content = JSON.parse(JSON.stringify(prev)); renderEditor(); updateHeader(); }
}
function doRedo() {
  const next = undo.redo();
  if (next !== null) { currentDoc.content = JSON.parse(JSON.stringify(next)); renderEditor(); updateHeader(); }
}

// ── 保存・削除 ──
async function saveDoc() {
  if (!currentDoc) return;
  try {
    await API.updateDocument(currentDoc.id, currentDoc);
    Utils.toast('保存しました', 'success');
    await loadSidebar();
  } catch (e) {
    Utils.toast('保存エラー: ' + e.message, 'error');
    console.error('saveDoc error:', e);
  }
}

async function deleteDoc() {
  if (!currentDoc) return;
  try {
    await API.deleteDocument(currentDoc.id);
    Utils.toast('削除しました。IDを自動で整列します...');
    currentDoc = null;
    currentSchema = null;
    document.getElementById('editorMain').innerHTML = '<div class="empty-state"><div class="icon">📄</div><p>削除されました</p></div>';
    updateHeader();
    await loadSidebar();
  } catch (e) {
    Utils.toast('削除エラー: ' + e.message, 'error');
    console.error('deleteDoc error:', e);
  }
}

// ── 新規作成 ──
function openNewDocModalFor(filterProc) {
  const entries = Object.entries(schemas).filter(([, s]) => !filterProc || s.process === filterProc);
  if (entries.length === 0) return;
  if (entries.length === 1) { createNewDoc(entries[0][0]); return; }
  const grid = document.getElementById('doctypeGrid');
  grid.innerHTML = entries.map(([key, s]) => `
    <button class="doctype-btn" onclick="createNewDoc('${key}')">
      <div class="doctype-proc">${s.process}</div>
      <div class="doctype-name">${s.label}</div>
    </button>`).join('');
  document.getElementById('newDocModal').style.display = 'flex';
}

function openNewDocModal() { openNewDocModalFor(null); }
function closeNewDocModal() { document.getElementById('newDocModal').style.display = 'none'; }

async function createNewDoc(typeKey) {
  closeNewDocModal();
  try {
    const s = schemas[typeKey];
    const { documents } = await API.listDocuments().catch(() => ({ documents: [] }));
    const existingIds = documents.filter(d => d.type === s.idPrefix).map(d => d.id);
    const id = Utils.generateId(s.idPrefix, existingIds);
    // サーバーに即時保存してからエディターで開く
    const doc = {
      id, type: s.idPrefix, process: s.process,
      title: s.label, version: '1.0', status: 'Draft',
      created: new Date().toISOString().slice(0, 10),
      upstream: [], downstream: [],
      content: { title: s.label, version: '1.0', status: 'Draft' },
      changelog: []
    };
    await API.createDocument(doc);
    await loadSidebar();
    await openDocument(id);
    history.replaceState(null, '', `/editor?id=${id}`);
  } catch (e) {
    Utils.toast('作成エラー: ' + e.message, 'error');
    console.error('createNewDoc error:', e);
  }
}

// ── ワークスペース設定モーダル（editor にも設置） ──
function openWsModal()  {
  const modal = document.getElementById('wsModal');
  if (modal) modal.style.display = 'flex';
}
function closeWsModal() {
  const modal = document.getElementById('wsModal');
  if (modal) modal.style.display = 'none';
}

async function pickFolderPath() {
  const btn = document.getElementById('wsPickBtn');
  btn.disabled = true;
  btn.textContent = '選択中…';
  try {
    const { path } = await API.pickFolder();
    if (path) document.getElementById('wsPathInput').value = path;
  } catch (e) {
    Utils.toast('フォルダ選択に失敗しました: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '参照...';
  }
}

async function saveWorkspace() {
  const p  = document.getElementById('wsPathInput').value.trim();
  const id = document.getElementById('wsProjectId').value.trim();
  if (!p) return;
  await API.setWorkspace(p, id);
  closeWsModal();
  Utils.toast('ワークスペースを保存しました', 'success');
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

init();
