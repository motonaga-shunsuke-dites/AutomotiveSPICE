let allRequests = []
let allDocs = []
let currentId = null
let isNew = false

async function init() {
  await loadDocs()
  await loadRequests()
}

async function loadDocs() {
  try {
    const res = await API.listDocuments()
    allDocs = (res.documents || [])
  } catch (_) { allDocs = [] }
}

async function loadRequests() {
  try {
    const res = await fetch('/api/requests').then(r => r.json())
    allRequests = res.requests || []
    renderList()
    if (currentId) {
      const still = allRequests.find(r => r.id === currentId)
      if (still) showDetail(still)
    }
  } catch (e) { Utils.toast('要望の読み込みに失敗しました', 'error') }
}

function renderList() {
  const el = document.getElementById('reqItems')
  if (!allRequests.length) {
    el.innerHTML = '<div style="padding:24px;color:var(--text-dim);font-size:13px;">要望がありません</div>'
    return
  }
  el.innerHTML = allRequests.map(r => `
    <div class="req-item ${r.id === currentId ? 'active' : ''}" onclick="selectItem('${r.id}')">
      <div class="req-item-top">
        <span class="req-item-id">${Utils.escapeHtml(r.id)}</span>
        <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
        <span class="badge badge-${r.priority}">${priorityLabel(r.priority)}</span>
      </div>
      <div class="req-item-title">${Utils.escapeHtml(r.title)}</div>
      <div class="req-item-desc">${Utils.escapeHtml(r.description || '')}</div>
    </div>
  `).join('')
}

function selectItem(id) {
  isNew = false
  currentId = id
  renderList()
  const req = allRequests.find(r => r.id === id)
  if (req) showDetail(req)
}

function openNew() {
  isNew = true
  currentId = null
  renderList()
  showForm({ id: '', title: '', description: '', priority: 'medium', status: 'open', relatedDocs: [], notes: '' }, true)
}

function showDetail(req) {
  const pane = document.getElementById('detailPane')
  pane.innerHTML = `
    <div class="req-form">
      <div class="req-detail-header">
        <span class="req-detail-id">${Utils.escapeHtml(req.id)}</span>
        <span class="badge badge-${req.status}">${statusLabel(req.status)}</span>
        <span class="badge badge-${req.priority}">${priorityLabel(req.priority)}</span>
        <span style="font-size:12px;color:var(--text-dim);margin-left:auto">${req.created || ''}</span>
      </div>
      <div class="form-row">
        <label>タイトル</label>
        <input type="text" id="fTitle" value="${Utils.escapeHtml(req.title)}">
      </div>
      <div class="form-row">
        <label>詳細説明</label>
        <textarea id="fDesc">${Utils.escapeHtml(req.description || '')}</textarea>
      </div>
      <div class="form-row" style="display:flex;gap:16px">
        <div style="flex:1">
          <label>優先度</label>
          <select id="fPriority">
            <option value="high" ${req.priority==='high'?'selected':''}>高</option>
            <option value="medium" ${req.priority==='medium'?'selected':''}>中</option>
            <option value="low" ${req.priority==='low'?'selected':''}>低</option>
          </select>
        </div>
        <div style="flex:1">
          <label>ステータス</label>
          <select id="fStatus">
            <option value="open" ${req.status==='open'?'selected':''}>未対応</option>
            <option value="in-review" ${req.status==='in-review'?'selected':''}>検討中</option>
            <option value="resolved" ${req.status==='resolved'?'selected':''}>対応済</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <label>関連ドキュメント（複数選択可）</label>
        <select id="fDocs" multiple size="6" style="font-size:12px">
          ${allDocs.map(d => `<option value="${d.id}" ${(req.relatedDocs||[]).includes(d.id)?'selected':''}>${Utils.escapeHtml(d.id)} — ${Utils.escapeHtml(d.type || '')}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>対応メモ</label>
        <textarea id="fNotes">${Utils.escapeHtml(req.notes || '')}</textarea>
      </div>
      <div class="req-actions">
        <button class="btn btn-primary" onclick="saveItem('${req.id}')">保存</button>
        <button class="btn btn-danger" onclick="deleteItem('${req.id}')">削除</button>
      </div>
    </div>
  `
}

function showForm(req) {
  const pane = document.getElementById('detailPane')
  pane.innerHTML = `
    <div class="req-form">
      <div class="req-detail-header">
        <span class="req-detail-id">新規要望</span>
      </div>
      <div class="form-row">
        <label>タイトル</label>
        <input type="text" id="fTitle" placeholder="要望のタイトルを入力">
      </div>
      <div class="form-row">
        <label>詳細説明</label>
        <textarea id="fDesc" placeholder="具体的な要望内容を記述"></textarea>
      </div>
      <div class="form-row" style="display:flex;gap:16px">
        <div style="flex:1">
          <label>優先度</label>
          <select id="fPriority">
            <option value="high">高</option>
            <option value="medium" selected>中</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <label>関連ドキュメント（複数選択可）</label>
        <select id="fDocs" multiple size="6" style="font-size:12px">
          ${allDocs.map(d => `<option value="${d.id}">${Utils.escapeHtml(d.id)} — ${Utils.escapeHtml(d.type || '')}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>対応メモ</label>
        <textarea id="fNotes" placeholder="追加メモ（任意）"></textarea>
      </div>
      <div class="req-actions">
        <button class="btn btn-primary" onclick="createItem()">追加</button>
        <button class="btn btn-secondary" onclick="cancelNew()">キャンセル</button>
      </div>
    </div>
  `
}

function collectForm() {
  const sel = document.getElementById('fDocs')
  const relatedDocs = sel ? Array.from(sel.selectedOptions).map(o => o.value) : []
  return {
    title: document.getElementById('fTitle')?.value.trim() || '（無題）',
    description: document.getElementById('fDesc')?.value.trim() || '',
    priority: document.getElementById('fPriority')?.value || 'medium',
    status: document.getElementById('fStatus')?.value || 'open',
    relatedDocs,
    notes: document.getElementById('fNotes')?.value.trim() || '',
  }
}

async function createItem() {
  const body = collectForm()
  try {
    const created = await fetch('/api/requests', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }).then(r => r.json())
    currentId = created.id
    isNew = false
    await loadRequests()
    Utils.toast('要望を追加しました')
  } catch (e) { Utils.toast('保存に失敗しました', 'error') }
}

async function saveItem(id) {
  const body = collectForm()
  try {
    await fetch('/api/requests/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }).then(r => r.json())
    await loadRequests()
    Utils.toast('保存しました')
  } catch (e) { Utils.toast('保存に失敗しました', 'error') }
}

async function deleteItem(id) {
  if (!confirm(id + ' を削除しますか？')) return
  try {
    await fetch('/api/requests/' + id, { method:'DELETE' })
    currentId = null
    document.getElementById('detailPane').innerHTML = '<div class="empty">要望を選択するか、「＋ 追加」で新規作成してください</div>'
    await loadRequests()
    Utils.toast('削除しました')
  } catch (e) { Utils.toast('削除に失敗しました', 'error') }
}

function cancelNew() {
  isNew = false
  currentId = null
  renderList()
  document.getElementById('detailPane').innerHTML = '<div class="empty">要望を選択するか、「＋ 追加」で新規作成してください</div>'
}

function statusLabel(s) {
  return { open:'未対応', 'in-review':'検討中', resolved:'対応済' }[s] || s
}
function priorityLabel(p) {
  return { high:'高', medium:'中', low:'低' }[p] || p
}

document.addEventListener('DOMContentLoaded', init)
