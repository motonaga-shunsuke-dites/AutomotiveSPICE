const fs   = require('fs');
const path = require('path');

const WORKSPACE_CONFIG = path.join(__dirname, '..', '.workspace.json');
const PROCESSES = ['SWE1', 'SWE2', 'SWE3', 'SWE4', 'SWE5', 'SWE6'];

// ─── workspace ────────────────────────────────────────────────────────────────

function getWorkspace() {
  if (!fs.existsSync(WORKSPACE_CONFIG)) return null;
  try { return JSON.parse(fs.readFileSync(WORKSPACE_CONFIG, 'utf-8')); } catch { return null; }
}
function setWorkspace(config) {
  fs.writeFileSync(WORKSPACE_CONFIG, JSON.stringify(config, null, 2), 'utf-8');
}
function getWorkspacePath() {
  const ws = getWorkspace();
  if (!ws || !ws.path) throw { code: 'NO_WORKSPACE', message: 'ワークスペースが設定されていません' };
  return ws.path;
}

// ─── low-level helpers ────────────────────────────────────────────────────────

/** dir 以下の .json を再帰収集。{ doc, filePath }[] を返す */
function scanJsonFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory())         out.push(...scanJsonFiles(full));
    else if (e.name.endsWith('.json')) {
      try { out.push({ doc: JSON.parse(fs.readFileSync(full, 'utf-8')), filePath: full }); }
      catch { /* skip corrupt */ }
    }
  }
  return out;
}

/** dir 以下で id.json を再帰検索。見つかればパス、なければ null */
function findDocFile(dir, id) {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findDocFile(full, id); if (r) return r; }
    else if (e.name === `${id}.json`) return full;
  }
  return null;
}

/**
 * ネストされたフォルダパスを考慮したドキュメント保存先を返す。
 * folder は "/" 区切りの相対パス（例: "認証/ログイン"）。
 */
function docPath(wsPath, id, process, folder) {
  const parts = (folder || '').trim().split('/').filter(Boolean);
  const dir   = parts.length ? path.join(wsPath, process, ...parts) : path.join(wsPath, process);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${id}.json`);
}

// ─── documents ────────────────────────────────────────────────────────────────

function listDocs(filterProcess) {
  const wsPath = getWorkspacePath();
  const docs = [];
  for (const proc of PROCESSES) {
    if (filterProcess && proc !== filterProcess) continue;
    for (const { doc, filePath } of scanJsonFiles(path.join(wsPath, proc))) {
      const relDir = path.relative(path.join(wsPath, proc), path.dirname(filePath));
      // doc.folder を正規ソースとし、なければファイルパスから推定
      const folder = (doc.folder !== undefined && doc.folder !== null)
        ? doc.folder
        : (relDir === '.' ? '' : relDir.replace(/\\/g, '/'));
      docs.push({
        id: doc.id, type: doc.type, process: doc.process,
        title: doc.title, version: doc.version, status: doc.status,
        modified: doc.modified, folder: folder || '',
        upstream: doc.upstream || [], downstream: doc.downstream || [],
      });
    }
  }
  return docs;
}

function readDoc(id) {
  const wsPath = getWorkspacePath();
  for (const proc of PROCESSES) {
    const p = findDocFile(path.join(wsPath, proc), id);
    if (p) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  return null;
}

function writeDoc(doc) {
  const wsPath = getWorkspacePath();
  doc.modified = new Date().toISOString().slice(0, 10);

  // 既存ファイルを探し、場所が変わっていれば古いファイルを削除
  const existing = findDocFile(path.join(wsPath, doc.process), doc.id);
  const newPath  = docPath(wsPath, doc.id, doc.process, doc.folder || '');
  if (existing && existing !== newPath) fs.unlinkSync(existing);

  if (!doc.changelog) doc.changelog = [];
  if (doc.changelog.length >= 50) doc.changelog.shift();
  doc.changelog.push({
    date: doc.modified, version: doc.version, summary: 'auto-save',
    snapshot: JSON.parse(JSON.stringify(doc.content || {})),
  });
  fs.writeFileSync(newPath, JSON.stringify(doc, null, 2), 'utf-8');
  return doc;
}

function deleteDoc(id) {
  const wsPath = getWorkspacePath();
  for (const proc of PROCESSES) {
    const p = findDocFile(path.join(wsPath, proc), id);
    if (!p) continue;
    fs.unlinkSync(p);
    // 空になったサブディレクトリを再帰的に除去（プロセスルートは保護）
    let dir = path.dirname(p);
    const root = path.join(wsPath, proc);
    while (dir !== root && dir.startsWith(root)) {
      if (!fs.existsSync(dir) || fs.readdirSync(dir).length > 0) break;
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    }
    return proc;
  }
  return null;
}

function moveDoc(id, newFolder) {
  const doc = readDoc(id);
  if (!doc) return null;
  doc.folder = (newFolder || '').trim();
  return writeDoc(doc);
}

// ─── renumber ────────────────────────────────────────────────────────────────

function renumberProcess(process) {
  const wsPath = getWorkspacePath();
  const dir    = path.join(wsPath, process);
  if (!fs.existsSync(dir)) return;

  const allFiles = scanJsonFiles(dir);
  const byPrefix = {};
  for (const { doc } of allFiles) {
    const prefix = doc.id.replace(/_\d+$/, '');
    if (!byPrefix[prefix]) byPrefix[prefix] = [];
    byPrefix[prefix].push(doc);
  }

  const idMap = {};
  for (const [prefix, docs] of Object.entries(byPrefix)) {
    docs.sort((a, b) => {
      const nA = parseInt((a.id.match(/_(\d+)$/) || [, 0])[1]);
      const nB = parseInt((b.id.match(/_(\d+)$/) || [, 0])[1]);
      return nA - nB;
    });
    docs.forEach((doc, i) => {
      const newId = `${prefix}_${String(i + 1).padStart(3, '0')}`;
      if (doc.id !== newId) idMap[doc.id] = newId;
    });
  }
  if (!Object.keys(idMap).length) return;

  for (const { filePath } of allFiles) fs.unlinkSync(filePath);

  for (const { doc } of allFiles) {
    doc.id = idMap[doc.id] || doc.id;
    fs.writeFileSync(docPath(wsPath, doc.id, doc.process, doc.folder || ''),
      JSON.stringify(doc, null, 2), 'utf-8');
  }

  for (const proc of PROCESSES) {
    if (proc === process) continue;
    for (const { doc, filePath } of scanJsonFiles(path.join(wsPath, proc))) {
      let changed = false;
      const remap = arr => Array.isArray(arr)
        ? arr.map(id => { const n = idMap[id]; if (n) { changed = true; return n; } return id; })
        : arr;
      doc.upstream   = remap(doc.upstream);
      doc.downstream = remap(doc.downstream);
      if (changed) fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');
    }
  }
}

// ─── folders（ツリー構造）────────────────────────────────────────────────────

/**
 * dir 以下のディレクトリをツリー構造に変換して返す。
 * 各ノード: { name: string, path: string (baseDir からの相対 "/" 区切り), children: [...] }
 */
function buildFolderTree(dir, baseDir) {
  if (!fs.existsSync(dir)) return [];
  const nodes = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full    = path.join(dir, e.name);
    const relPath = path.relative(baseDir, full).replace(/\\/g, '/');
    nodes.push({ name: e.name, path: relPath, children: buildFolderTree(full, baseDir) });
  }
  return nodes.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

/**
 * 全工程（または指定工程）のフォルダをツリー形式で返す。
 * 返却値: { SWE1: [...nodes], SWE2: [...], ... }
 */
function listFolders(filterProcess) {
  const wsPath = getWorkspacePath();
  const result = {};
  for (const proc of PROCESSES) {
    if (filterProcess && proc !== filterProcess) continue;
    result[proc] = buildFolderTree(path.join(wsPath, proc), path.join(wsPath, proc));
  }
  return result;
}

function createFolder(process, folderPath) {
  const wsPath = getWorkspacePath();
  const parts  = (folderPath || '').split('/').filter(Boolean);
  if (!parts.length) throw new Error('フォルダ名が空です');
  const dir = path.join(wsPath, process, ...parts);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function deleteFolder(process, folderPath) {
  const wsPath = getWorkspacePath();
  const parts  = (folderPath || '').split('/').filter(Boolean);
  if (!parts.length) return false;
  const dir = path.join(wsPath, process, ...parts);
  if (!fs.existsSync(dir)) return false;
  const items = fs.readdirSync(dir);
  if (items.length > 0) throw new Error('フォルダが空ではありません（先にドキュメントを移動してください）');
  fs.rmdirSync(dir);
  return true;
}

module.exports = {
  getWorkspace, setWorkspace, getWorkspacePath,
  listDocs, readDoc, writeDoc, deleteDoc, moveDoc,
  renumberProcess,
  listFolders, createFolder, deleteFolder,
};
