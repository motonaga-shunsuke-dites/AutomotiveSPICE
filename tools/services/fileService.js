const fs = require('fs');
const path = require('path');

const WORKSPACE_CONFIG = path.join(__dirname, '..', '.workspace.json');

function getWorkspace() {
  if (!fs.existsSync(WORKSPACE_CONFIG)) return null;
  try {
    return JSON.parse(fs.readFileSync(WORKSPACE_CONFIG, 'utf-8'));
  } catch {
    return null;
  }
}

function setWorkspace(config) {
  fs.writeFileSync(WORKSPACE_CONFIG, JSON.stringify(config, null, 2), 'utf-8');
}

function getWorkspacePath() {
  const ws = getWorkspace();
  if (!ws || !ws.path) throw { code: 'NO_WORKSPACE', message: 'ワークスペースが設定されていません' };
  return ws.path;
}

function docPath(wsPath, id, process) {
  const dir = path.join(wsPath, process || '');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${id}.json`);
}

function listDocs(filterProcess) {
  const wsPath = getWorkspacePath();
  const processes = ['SWE1', 'SWE2', 'SWE3', 'SWE4', 'SWE5', 'SWE6'];
  const docs = [];
  for (const proc of processes) {
    if (filterProcess && proc !== filterProcess) continue;
    const dir = path.join(wsPath, proc);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
        const doc = JSON.parse(raw);
        docs.push({
          id: doc.id, type: doc.type, process: doc.process,
          title: doc.title, version: doc.version, status: doc.status,
          modified: doc.modified, upstream: doc.upstream || [], downstream: doc.downstream || []
        });
      } catch { /* skip corrupt files */ }
    }
  }
  return docs;
}

function readDoc(id) {
  const wsPath = getWorkspacePath();
  for (const proc of ['SWE1', 'SWE2', 'SWE3', 'SWE4', 'SWE5', 'SWE6']) {
    const p = path.join(wsPath, proc, `${id}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  return null;
}

function writeDoc(doc) {
  const wsPath = getWorkspacePath();
  doc.modified = new Date().toISOString().slice(0, 10);
  const p = docPath(wsPath, doc.id, doc.process);
  // Append changelog snapshot (keep last 50)
  if (!doc.changelog) doc.changelog = [];
  if (doc.changelog.length >= 50) doc.changelog.shift();
  doc.changelog.push({ date: doc.modified, version: doc.version, summary: 'auto-save', snapshot: JSON.parse(JSON.stringify(doc.content || {})) });
  fs.writeFileSync(p, JSON.stringify(doc, null, 2), 'utf-8');
  return doc;
}

function deleteDoc(id) {
  const wsPath = getWorkspacePath();
  for (const proc of ['SWE1', 'SWE2', 'SWE3', 'SWE4', 'SWE5', 'SWE6']) {
    const p = path.join(wsPath, proc, `${id}.json`);
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  }
  return false;
}

module.exports = { getWorkspace, setWorkspace, listDocs, readDoc, writeDoc, deleteDoc };
