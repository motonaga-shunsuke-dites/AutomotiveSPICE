const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getWorkspace } = require('../services/fileService');

function getRequestsPath() {
  const ws = getWorkspace();
  if (!ws || !ws.path) throw { code: 'NO_WORKSPACE', message: 'ワークスペースが設定されていません' };
  return path.join(ws.path, 'requests.json');
}

function loadRequests() {
  const p = getRequestsPath();
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveRequests(items) {
  fs.writeFileSync(getRequestsPath(), JSON.stringify(items, null, 2), 'utf-8');
}

function nextId(items) {
  const nums = items.map(r => parseInt(r.id.replace('CHG_', ''), 10)).filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'CHG_' + String(max + 1).padStart(3, '0');
}

router.get('/', (req, res) => {
  try { res.json({ requests: loadRequests() }); }
  catch (e) {
    if (e.code === 'NO_WORKSPACE') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const items = loadRequests();
    const item = {
      id: nextId(items),
      title: req.body.title || '（無題）',
      description: req.body.description || '',
      priority: req.body.priority || 'medium',
      status: 'open',
      relatedDocs: req.body.relatedDocs || [],
      notes: req.body.notes || '',
      created: new Date().toISOString().slice(0, 10),
    };
    items.push(item);
    saveRequests(items);
    res.status(201).json(item);
  } catch (e) {
    if (e.code === 'NO_WORKSPACE') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const items = loadRequests();
    const idx = items.findIndex(r => r.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    items[idx] = { ...items[idx], ...req.body, id: items[idx].id, created: items[idx].created };
    saveRequests(items);
    res.json(items[idx]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const items = loadRequests();
    const idx = items.findIndex(r => r.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    items.splice(idx, 1);
    saveRequests(items);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
