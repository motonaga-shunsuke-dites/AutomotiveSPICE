let schemas = {};
let allDocs = [];
let currentDocId = null;

window.addEventListener('workspace-needed', () => Utils.toast('ワークスペースを設定してください','error'));

async function init() {
  schemas = await fetch('/schemas/document_types.json').then(r => r.json());
  await loadSidebar();
  const id = new URLSearchParams(location.search).get('id');
  if (id) openDocument(id);
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
      <div class="process-label" onclick="this.classList.toggle('collapsed');this.nextElementSibling.style.display=this.classList.contains('collapsed')?'none':''">
        <span class="arrow">▾</span> ${proc}
      </div>
      <div>
        ${pd.map(d => `
          <div class="doc-item${d.id===currentDocId?' active':''}" onclick="openDocument('${d.id}')">
            <span class="badge ${Utils.statusClass(d.status)}" style="font-size:10px">${Utils.statusLabel(d.status).slice(0,2)}</span>
            <span class="doc-title">${Utils.escapeHtml(d.title || d.id)}</span>
          </div>`).join('')}
        ${pd.length===0?'<div style="padding:4px 20px;color:var(--text-dim);font-size:12px">なし</div>':''}
      </div>
    </div>`;
  }).join('');
}

function filterSidebar(q) {
  renderSidebar(q ? allDocs.filter(d => (d.title||'').toLowerCase().includes(q.toLowerCase()) || d.id.toLowerCase().includes(q.toLowerCase())) : allDocs);
}

async function openDocument(id) {
  currentDocId = id;
  history.replaceState(null, '', `/viewer?id=${id}`);
  try {
    const doc = await API.getDocument(id);
    const schemaKey = `${doc.process}_${doc.type}`;
    const schema = schemas[schemaKey];

    document.getElementById('viewerHeader').style.display = '';
    document.getElementById('vDocId').textContent = doc.id;
    document.getElementById('vDocTitle').textContent = doc.title || doc.id;
    const badge = document.getElementById('vDocBadge');
    badge.className = 'badge ' + Utils.statusClass(doc.status);
    badge.textContent = Utils.statusLabel(doc.status);
    document.getElementById('vDocMeta').textContent = `v${doc.version} · ${doc.modified || doc.created} · ${doc.author || '—'}`;
    document.getElementById('editBtn').style.display = '';

    document.getElementById('viewerContent').innerHTML = renderDocView(doc, schema);
    renderSidebar(allDocs);
    renderViewerDiagrams();
  } catch (e) { Utils.toast('読み込みエラー: ' + e.message, 'error'); }
}

function renderDocView(doc, schema) {
  if (!schema) return `<pre>${Utils.escapeHtml(JSON.stringify(doc.content, null, 2))}</pre>`;
  let html = '';
  for (const sec of schema.sections) {
    html += `<h2>${Utils.escapeHtml(sec.title)}</h2>`;
    if (sec.type === 'itemList') {
      const items = doc.content[sec.id] || [];
      if (items.length === 0) { html += '<p style="color:var(--text-dim)"><em>（項目なし）</em></p>'; continue; }
      const ths = sec.itemFields.map(f => `<th>${Utils.escapeHtml(f.label)}</th>`).join('');
      const trs = items.map(item =>
        '<tr>' + sec.itemFields.map(f => `<td>${Utils.escapeHtml(item[f.id] || '')}</td>`).join('') + '</tr>'
      ).join('');
      html += `<table class="viewer-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    } else {
      html += '<table class="viewer-table"><tbody>';
      for (const f of sec.fields) {
        const v = doc.content[f.id] || '';
        if (f.type === 'diagram') {
          const b64 = v ? btoa(unescape(encodeURIComponent(v))) : '';
          html += `<tr><th style="width:160px;vertical-align:top">${Utils.escapeHtml(f.label)}</th><td><div class="diagram-view" data-b64="${b64}"></div></td></tr>`;
        } else {
          html += `<tr><th style="width:160px">${Utils.escapeHtml(f.label)}</th><td>${Utils.escapeHtml(v)}</td></tr>`;
        }
      }
      html += '</tbody></table>';
    }
  }
  if (doc.upstream && doc.upstream.length) {
    html += `<h2>上位ドキュメント</h2><ul>${doc.upstream.map(id => `<li><a href="/viewer?id=${id}" style="color:var(--accent)">${Utils.escapeHtml(id)}</a></li>`).join('')}</ul>`;
  }
  if (doc.downstream && doc.downstream.length) {
    html += `<h2>下位ドキュメント</h2><ul>${doc.downstream.map(id => `<li><a href="/viewer?id=${id}" style="color:var(--accent)">${Utils.escapeHtml(id)}</a></li>`).join('')}</ul>`;
  }
  if (doc.changelog && doc.changelog.length) {
    html += '<h2>変更履歴</h2><table class="viewer-table"><thead><tr><th>バージョン</th><th>日付</th><th>概要</th></tr></thead><tbody>';
    for (const c of [...doc.changelog].reverse().slice(0, 10)) {
      html += `<tr><td>${Utils.escapeHtml(c.version||'')}</td><td>${Utils.escapeHtml(c.date||'')}</td><td>${Utils.escapeHtml(c.summary||'')}</td></tr>`;
    }
    html += '</tbody></table>';
  }
  return html;
}

async function renderViewerDiagrams() {
  const nodes = document.querySelectorAll('.diagram-view');
  for (const el of nodes) {
    const b64 = el.dataset.b64;
    const code = b64 ? decodeURIComponent(escape(atob(b64))) : '';
    if (!code?.trim()) { el.innerHTML = '<span style="color:var(--text-dim);font-size:12px">（ダイアグラムなし）</span>'; continue; }
    try {
      const id = 'vdiagram_' + Math.random().toString(36).slice(2);
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.onclick = () => Utils.openDiagramModal(svg);
    } catch (e) {
      el.innerHTML = `<span style="color:var(--red);font-size:12px">構文エラー: ${Utils.escapeHtml(e.message || String(e))}</span>`;
    }
  }
}

function openEditor() {
  if (currentDocId) window.location = '/editor?id=' + currentDocId;
}

init();
