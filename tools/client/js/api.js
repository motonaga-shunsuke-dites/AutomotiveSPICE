// REST API クライアント
const API = (() => {
  const BASE = '/api';

  async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    if (res.status === 409) {
      // ワークスペース未設定
      window.dispatchEvent(new CustomEvent('workspace-needed'));
      throw new Error('workspace-needed');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }

  return {
    getWorkspace:      ()       => req('GET',    '/workspace'),
    setWorkspace:      (p, id)  => req('POST',   '/workspace', { path: p, projectId: id }),
    pickFolder:        ()       => req('GET',    '/workspace/pick-folder'),
    listDocuments:     (proc)   => req('GET',    `/documents${proc ? '?process=' + proc : ''}`),
    getDocument:       (id)     => req('GET',    `/documents/${id}`),
    createDocument:    (doc)    => req('POST',   '/documents', doc),
    updateDocument:    (id, d)  => req('PUT',    `/documents/${id}`, d),
    deleteDocument:    (id)     => req('DELETE', `/documents/${id}`),
    getTraceability:        ()            => req('GET',    '/traceability'),
    getImpact:              (id)          => req('GET',    `/traceability/impact/${id}`),
    getLibraryCategories:   ()            => req('GET',    '/library/categories'),
    getLibraryItems:        (cat)         => req('GET',    `/library/${cat}`),
    addLibraryItem:         (cat, item)   => req('POST',   `/library/${cat}`, item),
    updateLibraryItem:      (cat, id, d)  => req('PUT',    `/library/${cat}/${id}`, d),
    deleteLibraryItem:      (cat, id)     => req('DELETE', `/library/${cat}/${id}`),
  };
})();
