const express = require('express');
const router = express.Router();
const { listDocs, readDoc, writeDoc, deleteDoc } = require('../services/fileService');

router.get('/', (req, res) => {
  try {
    res.json({ documents: listDocs(req.query.process) });
  } catch (e) {
    if (e.code === 'NO_WORKSPACE') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const doc = readDoc(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const doc = req.body;
    if (!doc.id || !doc.type || !doc.process) return res.status(400).json({ error: 'id, type, process required' });
    if (!doc.created) doc.created = new Date().toISOString().slice(0, 10);
    if (!doc.upstream) doc.upstream = [];
    if (!doc.downstream) doc.downstream = [];
    if (!doc.content) doc.content = {};
    res.status(201).json(writeDoc(doc));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = readDoc(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, id: req.params.id };
    res.json(writeDoc(updated));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const ok = deleteDoc(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
