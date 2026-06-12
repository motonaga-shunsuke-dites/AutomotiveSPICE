const express = require('express');
const router = express.Router();
const { CATEGORIES, listItems, addItem, updateItem, deleteItem } = require('../services/libraryService');

router.get('/categories', (req, res) => {
  res.json(Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label, help: c.help })));
});

router.get('/:category', (req, res) => {
  try { res.json({ items: listItems(req.params.category) }); }
  catch (e) {
    if (e.code === 'NO_WORKSPACE') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.post('/:category', (req, res) => {
  try { res.status(201).json(addItem(req.params.category, req.body)); }
  catch (e) {
    if (e.code === 'NO_WORKSPACE') return res.status(409).json({ error: e.message });
    res.status(400).json({ error: e.message });
  }
});

router.put('/:category/:id', (req, res) => {
  try {
    const item = updateItem(req.params.category, req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:category/:id', (req, res) => {
  try {
    const ok = deleteItem(req.params.category, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
