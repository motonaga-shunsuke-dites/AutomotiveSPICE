const express = require('express');
const router = express.Router();
const { getImpact, getMatrix } = require('../services/traceService');

router.get('/', (req, res) => {
  try {
    res.json(getMatrix());
  } catch (e) {
    if (e.code === 'NO_WORKSPACE') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.get('/impact/:id', (req, res) => {
  try {
    res.json({ id: req.params.id, affected: getImpact(req.params.id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
