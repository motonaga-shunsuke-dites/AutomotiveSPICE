const fs = require('fs');
const path = require('path');
const { getWorkspacePath } = require('./fileService');

const CATEGORIES = {
  stakeholders: { label: 'ステークホルダー',      prefix: 'STK', help: '要件の発生元となる関係者・組織・システム' },
  components:   { label: 'コンポーネント',          prefix: 'CMP', help: 'アーキテクチャを構成するソフトウェアモジュール' },
  units:        { label: 'ソフトウェアユニット',    prefix: 'UNT', help: '実装単位（クラス・関数・ファイル等）' },
  interfaces:   { label: 'インターフェース',         prefix: 'IFC', help: 'コンポーネント間の接続仕様' },
  glossary:     { label: '用語集',                   prefix: 'GLS', help: 'プロジェクト固有の専門用語と定義' },
};

function getLibDir() {
  const wsPath = getWorkspacePath();
  const dir = path.join(wsPath, 'library');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listItems(category) {
  const fp = path.join(getLibDir(), `${category}.json`);
  if (!fs.existsSync(fp)) return [];
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); }
  catch { return []; }
}

function saveItems(category, items) {
  fs.writeFileSync(
    path.join(getLibDir(), `${category}.json`),
    JSON.stringify(items, null, 2), 'utf-8'
  );
}

function nextId(category) {
  const items = listItems(category);
  const prefix = (CATEGORIES[category] || { prefix: 'LIB' }).prefix;
  const max = items.reduce((m, i) => {
    const n = parseInt((i.id.match(/_(\d+)$/) || [, 0])[1]);
    return n > m ? n : m;
  }, 0);
  return `${prefix}_${String(max + 1).padStart(3, '0')}`;
}

function addItem(category, item) {
  if (!item.name || !item.name.trim()) throw new Error('name is required');
  if (!item.id) item.id = nextId(category);
  const items = listItems(category);
  if (items.find(i => i.id === item.id)) throw new Error(`ID ${item.id} already exists`);
  items.push({ id: item.id, name: item.name.trim(), description: item.description || '', tags: item.tags || [] });
  saveItems(category, items);
  return items[items.length - 1];
}

function updateItem(category, id, data) {
  const items = listItems(category);
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return null;
  items[idx] = { ...items[idx], ...data, id };
  saveItems(category, items);
  return items[idx];
}

function deleteItem(category, id) {
  const items = listItems(category);
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return false;
  saveItems(category, filtered);
  return true;
}

module.exports = { CATEGORIES, listItems, addItem, updateItem, deleteItem };
