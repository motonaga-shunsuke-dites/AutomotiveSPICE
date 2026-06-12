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
  },

  openDiagramModal(svgHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'diagram-modal-overlay';

    // ── ツールバー ──
    const toolbar = document.createElement('div');
    toolbar.className = 'diagram-modal-toolbar';

    const makeBtn = txt => {
      const b = document.createElement('button');
      b.className = 'diagram-modal-btn'; b.textContent = txt; return b;
    };
    const zoomOut   = makeBtn('−');
    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'diagram-modal-zoom-label';
    const zoomIn    = makeBtn('＋');
    const zoomReset = makeBtn('リセット');
    const closeBtn  = makeBtn('✕ 閉じる');

    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'diagram-modal-zoom-group';
    zoomGroup.append(zoomOut, zoomLabel, zoomIn, zoomReset);
    toolbar.append(zoomGroup, closeBtn);

    // ── ビューポート ──
    const viewport = document.createElement('div');
    viewport.className = 'diagram-modal-viewport';

    const container = document.createElement('div');
    container.className = 'diagram-modal-svg-container';
    container.innerHTML = svgHtml;

    // SVG サイズを px で確定
    const svg = container.querySelector('svg');
    let svgW = 800, svgH = 600;
    if (svg) {
      const vb = svg.getAttribute('viewBox');
      if (vb) {
        const p = vb.trim().split(/[\s,]+/).map(parseFloat);
        if (p.length === 4) { svgW = p[2]; svgH = p[3]; }
      }
      svg.setAttribute('width',  svgW + 'px');
      svg.setAttribute('height', svgH + 'px');
      svg.style.removeProperty('max-width');
      svg.style.display = 'block';
    }

    viewport.appendChild(container);
    overlay.appendChild(toolbar);
    overlay.appendChild(viewport);
    document.body.appendChild(overlay);

    // ── 初期スケール: ビューポートに収まるよう中央配置 ──
    const vpW = viewport.clientWidth  || (window.innerWidth  - 24);
    const vpH = viewport.clientHeight || (window.innerHeight - 60);
    let scale = Math.min(vpW / svgW, vpH / svgH, 1);
    let tx = (vpW - svgW * scale) / 2;
    let ty = (vpH - svgH * scale) / 2;

    const applyTransform = () => {
      container.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    };
    applyTransform();

    // ── ホイールズーム (カーソル位置を固定点として) ──
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const rect  = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const ns = Math.max(0.05, Math.min(20, scale * factor));
      tx = mx - (mx - tx) * (ns / scale);
      ty = my - (my - ty) * (ns / scale);
      scale = ns;
      applyTransform();
    }, { passive: false });

    // ── ドラッグパン ──
    let dragging = false, sx, sy, stx, sty;
    viewport.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
      viewport.classList.add('dragging');
      e.preventDefault();
    });
    const onMove = e => {
      if (!dragging) return;
      tx = stx + e.clientX - sx;
      ty = sty + e.clientY - sy;
      applyTransform();
    };
    const onUp = () => { dragging = false; viewport.classList.remove('dragging'); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // ── ズームボタン (ビューポート中心を固定点として) ──
    const zoomBy = factor => {
      const cx = vpW / 2, cy = vpH / 2;
      const ns = Math.max(0.05, Math.min(20, scale * factor));
      tx = cx - (cx - tx) * (ns / scale);
      ty = cy - (cy - ty) * (ns / scale);
      scale = ns; applyTransform();
    };
    zoomIn.addEventListener('click',    () => zoomBy(1.25));
    zoomOut.addEventListener('click',   () => zoomBy(1 / 1.25));
    zoomReset.addEventListener('click', () => {
      scale = Math.min(vpW / svgW, vpH / svgH, 1);
      tx = (vpW - svgW * scale) / 2;
      ty = (vpH - svgH * scale) / 2;
      applyTransform();
    });

    // ── 閉じる ──
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
  }
};
