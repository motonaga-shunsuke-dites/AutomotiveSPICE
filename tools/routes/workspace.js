const express = require('express');
const router = express.Router();
const { getWorkspace, setWorkspace } = require('../services/fileService');

router.get('/', (req, res) => {
  const ws = getWorkspace();
  if (!ws) return res.status(404).json({ error: 'Not configured' });
  res.json(ws);
});

router.post('/', (req, res) => {
  const { path, projectId } = req.body;
  if (!path) return res.status(400).json({ error: 'path is required' });
  setWorkspace({ path, projectId: projectId || 'PRJ001' });
  res.json({ ok: true });
});

module.exports = router;
