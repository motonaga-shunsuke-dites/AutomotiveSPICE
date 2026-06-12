let allDocs = [];
let schemas = {};

const PROCESSES = ['SWE1','SWE2','SWE3','SWE4','SWE5','SWE6'];
const REQUIRED_DOCS = {
  SWE1: ['SWE1_SRS'],
  SWE2: ['SWE2_SAD'],
  SWE3: ['SWE3_SDD'],
  SWE4: ['SWE4_UTS','SWE4_UTR'],
  SWE5: ['SWE5_ITS','SWE5_ITR'],
  SWE6: ['SWE6_QTS','SWE6_QTR'],
};

window.addEventListener('workspace-needed', openWsModal);

async function init() {
  schemas = await fetch('/schemas/document_types.json').then(r => r.json());
  try {
    const ws = await API.getWorkspace();
    document.getElementById('wsLabel').textContent = ws.path.split(/[\\/]/).pop() + ' (' + ws.projectId + ')';
    await loadDocs();
  } catch {
    renderGrid([]);
  }
}

async function loadDocs() {
  const { documents } = await API.listDocuments();
  allDocs = documents;
  renderGrid(allDocs);
}

function filterDocs(q) {
  const filtered = q ? allDocs.filter(d =>
    (d.title || '').toLowerCase().includes(q.toLowerCase()) ||
    (d.id || '').toLowerCase().includes(q.toLowerCase())
  ) : allDocs;
  renderGrid(filtered);
}

function renderGrid(docs) {
  const grid = document.getElementById('portalGrid');
  grid.innerHTML = PROCESSES.map(proc => {
    const procDocs = docs.filter(d => d.process === proc);
    const required = REQUIRED_DOCS[proc] || [];
    const presentTypes = new Set(procDocs.map(d => d.process + '_' + d.type));
    const fulfilled = required.filter(r => presentTypes.has(r)).length;
    const pct = required.length ? Math.round(fulfilled / required.length * 100) : 0;

    return `<div class="process-card" onclick="window.location='/editor?process=${proc}'">
      <div class="process-card-header">
        <span class="process-card-id">${proc}</span>
        <span class="process-card-title">${Utils.processLabel(proc)}</span>
        <button class="proc-new-btn" title="${proc} の新規ドキュメント作成"
          onclick="event.stopPropagation();openNewDocModal('${proc}')">+</button>
        <span class="badge ${pct===100?'badge-approved':'badge-draft'}" style="margin-left:auto">${pct}%</span>
      </div>
      <div class="process-progress"><div class="process-progress-bar" style="width:${pct}%"></div></div>
      <div class="doc-list-mini">
        ${procDocs.slice(0,5).map(d => `
          <div class="doc-list-mini-item" onclick="event.stopPropagation();openDoc('${d.id}')">
            <span class="badge ${Utils.statusClass(d.status)}">${Utils.statusLabel(d.status)}</span>
            <span>${Utils.escapeHtml(d.title || d.id)}</span>
          </div>`).join('')}
        ${procDocs.length > 5 ? `<div class="doc-list-mini-item" style="color:var(--text-dim)">…他 ${procDocs.length-5} 件</div>` : ''}
        ${procDocs.length === 0 ? `<div style="color:var(--text-dim);font-size:12px;padding:4px 6px">ドキュメントなし</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openDoc(id) { window.location = '/viewer?id=' + id; }

// ── ワークスペース設定 ──
function openWsModal()  { document.getElementById('wsModal').style.display = 'flex'; }
function closeWsModal() { document.getElementById('wsModal').style.display = 'none'; }

async function saveWorkspace() {
  const p  = document.getElementById('wsPathInput').value.trim();
  const id = document.getElementById('wsProjectId').value.trim();
  if (!p) return;
  await API.setWorkspace(p, id);
  document.getElementById('wsLabel').textContent = p.split(/[\\/]/).pop() + ' (' + id + ')';
  closeWsModal();
  Utils.toast('ワークスペースを保存しました', 'success');
  await loadDocs();
}

// ── 新規作成 ──
function openNewDocModal(filterProc) {
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

function closeNewDocModal() { document.getElementById('newDocModal').style.display = 'none'; }

async function createNewDoc(typeKey) {
  closeNewDocModal();
  try {
    const s = schemas[typeKey];
    const existingIds = allDocs.filter(d => d.type === s.idPrefix).map(d => d.id);
    const id = Utils.generateId(s.idPrefix, existingIds);
    // サーバーに即時保存してからエディターへ遷移
    const doc = {
      id, type: s.idPrefix, process: s.process,
      title: s.label, version: '1.0', status: 'Draft',
      created: new Date().toISOString().slice(0, 10),
      upstream: [], downstream: [],
      content: { title: s.label, version: '1.0', status: 'Draft' },
      changelog: []
    };
    await API.createDocument(doc);
    window.location = `/editor?id=${id}`;
  } catch (e) {
    Utils.toast('作成エラー: ' + e.message, 'error');
  }
}

init();
