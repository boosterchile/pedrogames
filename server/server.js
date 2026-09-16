// Servidor de Náufrago 3D: sirve el cliente y gestiona salas privadas por WebSocket.
// Sin chat libre: los clientes solo envían identificadores de frases predefinidas.
// Las respuestas a los acertijos se validan aquí; el cliente nunca recibe las soluciones.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRoom, addPlayer, removePlayer, handleMessage, makeCode } from '../shared/room.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const ROUTES = [
  ['/vendor/three.module.min.js', path.join(ROOT, 'node_modules/three/build/three.module.min.js')],
  ['/shared/', path.join(ROOT, 'shared')],
  ['/', path.join(ROOT, 'web3d')],
];
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;   // salas inactivas se eliminan a las 2 h
const MAX_MSG_BYTES = 2048;
const RATE_PER_SEC = 40;

export function resolveStatic(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean.includes('..')) return null;
  for (const [prefix, base] of ROUTES) {
    if (clean === prefix || clean.startsWith(prefix)) {
      if (prefix === '/vendor/three.module.min.js') return base;
      let rel = clean.slice(prefix.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const abs = path.join(base, rel);
      if (!abs.startsWith(base)) return null;
      return abs;
    }
  }
  return null;
}

export function createServer() {
  const rooms = new Map();
  const server = http.createServer((req, res) => {
    const file = resolveStatic(req.url || '/');
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  const wss = new WebSocketServer({ server, maxPayload: MAX_MSG_BYTES });
  let nextId = 1;

  function send(ws, msg) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); }
  function dispatch(room, fromId, outs) {
    for (const { to, msg } of outs) for (const [pid, sock] of room.sockets) {
      if (to === 'all' || (to === 'self' && pid === fromId) || (to === 'others' && pid !== fromId)) send(sock, msg);
    }
  }
  function leave(ws) {
    const room = ws.room; if (!room) return;
    room.sockets.delete(ws.pid); dispatch(room, ws.pid, removePlayer(room, ws.pid)); ws.room = null;
    if (room.players.size === 0) rooms.delete(room.code);
  }

  wss.on('connection', ws => {
    ws.pid = 'p' + (nextId++); ws.room = null; ws.bucket = RATE_PER_SEC; ws.bucketAt = Date.now();
    ws.on('message', raw => {
      const now = Date.now(); ws.bucket = Math.min(RATE_PER_SEC, ws.bucket + (now - ws.bucketAt) * RATE_PER_SEC / 1000); ws.bucketAt = now;
      if (ws.bucket < 1) return; ws.bucket -= 1;
      let m; try { m = JSON.parse(raw.toString()); } catch { return send(ws, { t: 'error', msg: 'Mensaje inválido.' }); }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'create' || m.t === 'join') {
        if (ws.room) leave(ws);
        let room;
        if (m.t === 'create') { let code; do code = makeCode(); while (rooms.has(code)); room = createRoom(code); room.sockets = new Map(); rooms.set(code, room); }
        else { room = rooms.get(String(m.code || '').toUpperCase().trim()); if (!room) return send(ws, { t: 'error', msg: 'No existe una sala con ese código.' }); }
        const r = addPlayer(room, ws.pid, m.name, m.color);
        if (!r.ok) { if (room.players.size === 0) rooms.delete(room.code); return send(ws, { t: 'error', msg: r.error }); }
        ws.room = room; room.sockets.set(ws.pid, ws); dispatch(room, ws.pid, r.out); return;
      }
      if (m.t === 'leave') return leave(ws);
      if (!ws.room) return send(ws, { t: 'error', msg: 'Primero crea o únete a una sala.' });
      dispatch(ws.room, ws.pid, handleMessage(ws.room, ws.pid, m));
    });
    ws.on('close', () => leave(ws));
    ws.on('error', () => leave(ws));
  });

  const sweeper = setInterval(() => { const now = Date.now(); for (const [code, room] of rooms) if (now - room.lastActivity > ROOM_TTL_MS) { for (const s of room.sockets.values()) s.close(); rooms.delete(code); } }, 60 * 1000);
  sweeper.unref();
  return { server, wss, rooms, close: () => new Promise(r => { clearInterval(sweeper); wss.close(); server.close(r); }) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  const { server } = createServer();
  server.listen(port, () => console.log(`Náufrago 3D en http://localhost:${port}  (salas privadas por WebSocket en el mismo puerto)`));
}
