const { listDocs, readDoc } = require('./fileService');

// Build adjacency map: id → [downstream ids]
function buildGraph() {
  const docs = listDocs();
  const graph = {};
  for (const meta of docs) {
    if (!graph[meta.id]) graph[meta.id] = { meta, downstream: [], upstream: [] };
  }
  for (const meta of docs) {
    for (const upId of (meta.upstream || [])) {
      if (graph[upId]) graph[upId].downstream.push(meta.id);
      if (graph[meta.id]) graph[meta.id].upstream.push(upId);
    }
  }
  return graph;
}

// Return all documents transitively affected downstream of id
function getImpact(id) {
  const graph = buildGraph();
  const affected = new Set();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift();
    const node = graph[cur];
    if (!node) continue;
    for (const down of node.downstream) {
      if (!affected.has(down)) {
        affected.add(down);
        queue.push(down);
      }
    }
  }
  return Array.from(affected);
}

// Return full traceability matrix grouped by process
function getMatrix() {
  const graph = buildGraph();
  const matrix = {};
  for (const [id, node] of Object.entries(graph)) {
    const proc = node.meta.process;
    if (!matrix[proc]) matrix[proc] = [];
    matrix[proc].push({ id, title: node.meta.title, status: node.meta.status, upstream: node.upstream, downstream: node.downstream });
  }
  return matrix;
}

module.exports = { getImpact, getMatrix };
