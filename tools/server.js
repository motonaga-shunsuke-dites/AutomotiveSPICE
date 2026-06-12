const express = require('express');
const path = require('path');
const cors = require('cors');

const workspaceRouter = require('./routes/workspace');
const documentsRouter = require('./routes/documents');
const traceabilityRouter = require('./routes/traceability');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

app.use('/api/workspace', workspaceRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/traceability', traceabilityRouter);

// SPA fallback: named routes → appropriate HTML
app.get('/editor', (req, res) => res.sendFile(path.join(__dirname, 'client', 'editor.html')));
app.get('/viewer', (req, res) => res.sendFile(path.join(__dirname, 'client', 'viewer.html')));
app.get('/traceability', (req, res) => res.sendFile(path.join(__dirname, 'client', 'traceability.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client', 'portal.html')));

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
