const express = require('express');
const router  = express.Router();
const { listFolders, createFolder, deleteFolder, moveDoc } = require('../services/fileService');

// GET /api/folders?process=SWE3
router.get('/', (req, res) => {
  try {
    res.json(listFolders(req.query.process || null));
  } catch (e) {
    if (e.code === 'NO_WORKSPACE') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/folders  { process, name }
router.post('/', (req, res) => {
  try {
    const { process, name } = req.body;
    if (!process || !name) return res.status(400).json({ error: 'process and name required' });
    createFolder(process, name);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/folders  { process, name }
router.delete('/', (req, res) => {
  try {
    const { process, name } = req.body;
    if (!process || !name) return res.status(400).json({ error: 'process and name required' });
    const ok = deleteFolder(process, name);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/folders/move  { docId, folder }
router.put('/move', (req, res) => {
  try {
    const { docId, folder } = req.body;
    if (!docId) return res.status(400).json({ error: 'docId required' });
    const doc = moveDoc(docId, folder || '');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
