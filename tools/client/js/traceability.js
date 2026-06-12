window.addEventListener('workspace-needed', () => Utils.toast('ワークスペースを設定してください','error'));

async function init() { await loadMatrix(); }

async function loadMatrix() {
  const container = document.getElementById('matrixContainer');
  try {
    const matrix = await API.getTraceability();
    const allDocs = Object.values(matrix).flat();
    if (allDocs.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🕸</div><p>ドキュメントがまだありません</p></div>';
      return;
    }
    container.innerHTML = renderMatrix(matrix, allDocs);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>${Utils.escapeHtml(e.message)}</p></div>`;
  }
}

function renderMatrix(matrix, allDocs) {
  const procs = ['SWE1','SWE2','SWE3','SWE4','SWE5','SWE6'];

  // 縦方向 (行): SWE1/SWE2 の上位ドキュメント
  // 横方向 (列): SWE3〜SWE6 の下位ドキュメント
  const upstreamDocs   = procs.slice(0,3).flatMap(p => matrix[p] || []);
  const downstreamDocs = procs.slice(2).flatMap(p => matrix[p] || []);

  if (upstreamDocs.length === 0 && downstreamDocs.length === 0) {
    return '<div class="empty-state"><div class="icon">🕸</div><p>ドキュメントがまだありません</p></div>';
  }

  const headerRow = `<tr>
    <th style="position:sticky;left:0;z-index:2;min-width:200px">ドキュメント</th>
    <th>プロセス</th>
    <th>ステータス</th>
    ${downstreamDocs.map(d => `<th style="writing-mode:vertical-lr;padding:10px 6px;min-width:40px" title="${Utils.escapeHtml(d.title||d.id)}">${Utils.escapeHtml(d.id)}</th>`).join('')}
  </tr>`;

  const rows = upstreamDocs.map(row => {
    const cells = downstreamDocs.map(col => {
      const linked = (col.upstream || []).includes(row.id) || (row.downstream || []).includes(col.id);
      return `<td class="${linked?'match':''}">${linked ? '✓' : ''}</td>`;
    }).join('');
    return `<tr>
      <td style="position:sticky;left:0;background:var(--surface);border-right:1px solid var(--border)">
        <a href="/viewer?id=${row.id}" style="color:var(--accent);text-decoration:none">${Utils.escapeHtml(row.title||row.id)}</a>
      </td>
      <td><span class="badge badge-draft">${row.id.split('_')[0]||''}</span></td>
      <td><span class="badge ${Utils.statusClass(row.status)}">${Utils.statusLabel(row.status)}</span></td>
      ${cells}
    </tr>`;
  }).join('');

  // 全ドキュメント一覧 (影響範囲用)
  const allRows = allDocs.map(d => `<tr onclick="showImpact('${d.id}','${Utils.escapeHtml(d.title||d.id)}')" style="cursor:pointer">
    <td style="position:sticky;left:0;background:var(--surface)" id="row_${d.id}">
      <a href="/viewer?id=${d.id}" style="color:var(--accent);text-decoration:none" onclick="event.stopPropagation()">${Utils.escapeHtml(d.title||d.id)}</a>
    </td>
    <td>${d.id}</td>
    <td><span class="badge ${Utils.statusClass(d.status)}">${Utils.statusLabel(d.status)}</span></td>
    <td colspan="${downstreamDocs.length}" style="color:var(--text-dim);font-size:12px">クリックして影響範囲を表示</td>
  </tr>`).join('');

  let html = `
    <h2 style="margin-bottom:16px">トレーサビリティマトリクス</h2>
    <div style="overflow:auto;margin-bottom:32px">
      <table class="trace-table">
        <thead>${headerRow}</thead>
        <tbody>${upstreamDocs.length>0 ? rows : '<tr><td colspan="100" style="text-align:center;color:var(--text-dim)">SWE.1〜3 のドキュメントがありません</td></tr>'}</tbody>
      </table>
    </div>
    <h2 style="margin-bottom:16px">全ドキュメント一覧 (影響範囲確認)</h2>
    <div style="overflow:auto">
      <table class="trace-table">
        <thead><tr>
          <th style="position:sticky;left:0;z-index:2">タイトル</th>
          <th>ID</th>
          <th>ステータス</th>
          <th>操作</th>
        </tr></thead>
        <tbody>${allRows}</tbody>
      </table>
    </div>`;
  return html;
}

async function showImpact(id, title) {
  const panel = document.getElementById('impactPanel');
  const list  = document.getElementById('impactList');
  const empty = document.getElementById('impactEmpty');
  document.getElementById('impactSource').textContent = `変更対象: ${title} (${id})`;
  document.getElementById('closeImpact').style.display = '';

  // 前回のハイライトをクリア
  document.querySelectorAll('.trace-table tr').forEach(r => r.classList.remove('impact'));
  document.querySelectorAll('#matrixContainer td').forEach(c => c.classList.remove('impact'));

  try {
    const { affected } = await API.getImpact(id);
    if (affected.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
    } else {
      empty.style.display = 'none';
      list.innerHTML = affected.map(aid => `
        <div class="impact-item" onclick="window.location='/viewer?id=${aid}'">
          <span class="badge badge-impact" style="margin-right:8px">影響</span>
          ${Utils.escapeHtml(aid)}
        </div>`).join('');
      // マトリクスの該当行をハイライト
      affected.forEach(aid => {
        const row = document.getElementById('row_' + aid);
        if (row) row.closest('tr').classList.add('impact');
      });
    }
  } catch (e) { list.innerHTML = `<p style="color:var(--red)">${Utils.escapeHtml(e.message)}</p>`; }

  panel.classList.add('open');
}

function closeImpactPanel() {
  document.getElementById('impactPanel').classList.remove('open');
  document.getElementById('closeImpact').style.display = 'none';
  document.querySelectorAll('.trace-table tr').forEach(r => r.classList.remove('impact'));
}

init();
