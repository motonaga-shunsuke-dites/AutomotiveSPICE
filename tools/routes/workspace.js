const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { getWorkspace, setWorkspace } = require('../services/fileService');

// Windows ネイティブのフォルダ選択ダイアログを開き、選択パスを返す
router.get('/pick-folder', (req, res) => {
  const ps = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    '$f = New-Object System.Windows.Forms.FolderBrowserDialog;',
    '$f.RootFolder = [System.Environment+SpecialFolder]::MyComputer;',
    'if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK)',
    '{ $f.SelectedPath } else { "" }',
  ].join(' ');
  const encoded = Buffer.from(ps, 'utf16le').toString('base64');
  exec(
    `powershell -NonInteractive -EncodedCommand ${encoded}`,
    { encoding: 'utf8', timeout: 120000 },
    (err, stdout) => {
      if (err) return res.status(500).json({ error: err.message });
      const selected = stdout.trim();
      res.json({ path: selected || null });
    }
  );
});

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
