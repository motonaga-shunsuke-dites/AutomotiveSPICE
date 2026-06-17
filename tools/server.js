const express = require('express');
const path    = require('path');
const fs      = require('fs');
const cors    = require('cors');

const workspaceRouter   = require('./routes/workspace');
const documentsRouter   = require('./routes/documents');
const foldersRouter     = require('./routes/folders');
const traceabilityRouter = require('./routes/traceability');
const libraryRouter     = require('./routes/library');
const requestsRouter    = require('./routes/requests');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'client')));
app.use('/schemas', express.static(path.join(__dirname, 'schemas')));

app.use('/api/workspace',    workspaceRouter);
app.use('/api/documents',   documentsRouter);
app.use('/api/folders',     foldersRouter);
app.use('/api/traceability', traceabilityRouter);
app.use('/api/library',     libraryRouter);
app.use('/api/requests',    requestsRouter);

// ─── AI 方針ファイル API ──────────────────────────────────────────────────────
const AI_POLICY_DIR = path.join(__dirname, '..', 'docs', 'AI-prompts');

function safePolicyPath(name) {
  if (!name || typeof name !== 'string') return null;
  const p = path.resolve(AI_POLICY_DIR, name);
  if (!p.startsWith(AI_POLICY_DIR + path.sep) && p !== AI_POLICY_DIR) return null;
  if (!p.endsWith('.md')) return null;
  return p;
}

// ファイル一覧
app.get('/api/ai-policy/files', (req, res) => {
  if (!fs.existsSync(AI_POLICY_DIR)) return res.json({ files: [] });
  const files = fs.readdirSync(AI_POLICY_DIR).filter(f => f.endsWith('.md'));
  res.json({ files });
});

// ファイル取得
app.get('/api/ai-policy/file', (req, res) => {
  const p = safePolicyPath(req.query.name);
  if (!p) return res.status(400).json({ error: 'invalid name' });
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
  res.json({ content: fs.readFileSync(p, 'utf-8'), name: req.query.name });
});

// ファイル保存
app.put('/api/ai-policy/file', (req, res) => {
  const { name, content } = req.body;
  const p = safePolicyPath(name);
  if (!p) return res.status(400).json({ error: 'invalid name' });
  fs.writeFileSync(p, content || '', 'utf-8');
  res.json({ ok: true });
});

// SPA fallback: named routes → appropriate HTML
app.get('/ai-policy',     (req, res) => res.sendFile(path.join(__dirname, 'client', 'ai-policy.html')));
app.get('/overview',      (req, res) => res.sendFile(path.join(__dirname, 'client', 'overview.html')));
app.get('/editor',        (req, res) => res.sendFile(path.join(__dirname, 'client', 'editor.html')));
app.get('/viewer',        (req, res) => res.sendFile(path.join(__dirname, 'client', 'viewer.html')));
app.get('/traceability',  (req, res) => res.sendFile(path.join(__dirname, 'client', 'traceability.html')));
app.get('/library',       (req, res) => res.sendFile(path.join(__dirname, 'client', 'library.html')));
app.get('/requests',      (req, res) => res.sendFile(path.join(__dirname, 'client', 'requests.html')));
app.get('/',              (req, res) => res.sendFile(path.join(__dirname, 'client', 'portal.html')));

const server = app.listen(PORT, () => {
  console.log(`ASPICE Doc Tool running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Server may already be running.`);
    console.error(`Open http://localhost:${PORT} in your browser.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
