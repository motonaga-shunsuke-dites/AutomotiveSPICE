// 共通ユーティリティ
const Utils = {
  statusClass(status) {
    return { 'Draft': 'badge-draft', 'Under Review': 'badge-review', 'Approved': 'badge-approved' }[status] || 'badge-draft';
  },

  statusLabel(status) {
    return { 'Draft': 'ドラフト', 'Under Review': 'レビュー中', 'Approved': '承認済' }[status] || status;
  },

  processLabel(proc) {
    const map = { SWE1: 'SWE.1 要件分析', SWE2: 'SWE.2 アーキテクチャ設計',
      SWE3: 'SWE.3 詳細設計', SWE4: 'SWE.4 ユニット検証',
      SWE5: 'SWE.5 統合テスト', SWE6: 'SWE.6 適格性確認' };
    return map[proc] || proc;
  },

  toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
  },

  generateId(prefix, existing) {
    const nums = existing
      .map(id => { const m = id.match(/_(\d+)$/); return m ? parseInt(m[1]) : 0; })
      .filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}_${String(next).padStart(3, '0')}`;
  },

  debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  },

  escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};
