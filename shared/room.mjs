// Lógica de sala privada, independiente del transporte. La usan el servidor (ws) y el modo local del cliente.
import { PUZZLES, PHRASES, puzzleById, publicPuzzle, checkAnswer, cluesFor } from './puzzles.mjs';

export const MAX_PLAYERS = 6;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I

export function makeCode(rand = Math.random) {
  let s = ''; for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]; return s;
}

export function createRoom(code) {
  return { code, players: new Map(), solved: new Set(), fails: new Map(), createdAt: Date.now(), lastActivity: Date.now() };
}

function playerIndex(room, id) { return [...room.players.keys()].indexOf(id); }

export function roomSnapshot(room) {
  return {
    code: room.code,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, ry: p.ry })),
    solved: [...room.solved],
  };
}

function clampNum(v, a, b) { return v < a ? a : v > b ? b : v; }

// Añade un jugador. Devuelve mensajes a emitir: [{to:'self'|'others'|'all', msg}]
export function addPlayer(room, id, name, color) {
  if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'La sala está llena (máximo 6 jugadores).' };
  const safeName = String(name || 'Explorador').slice(0, 24);
  const p = { id, name: safeName, color: String(color || '#e0703a').slice(0, 9), x: 0, z: 0, ry: 0, moving: false };
  room.players.set(id, p); room.lastActivity = Date.now();
  return { ok: true, out: [
    { to: 'self', msg: { t: 'welcome', id, ...roomSnapshot(room), puzzles: PUZZLES.map(publicPuzzle), phrases: PHRASES } },
    { to: 'others', msg: { t: 'joined', player: { id, name: p.name, color: p.color, x: 0, z: 0, ry: 0 } } },
  ] };
}

export function removePlayer(room, id) {
  if (!room.players.delete(id)) return [];
  room.lastActivity = Date.now();
  return [{ to: 'all', msg: { t: 'left', id } }];
}

// Procesa un mensaje del jugador `id`. Devuelve lista de salidas.
export function handleMessage(room, id, m) {
  const p = room.players.get(id);
  if (!p || !m || typeof m !== 'object') return [];
  room.lastActivity = Date.now();
  switch (m.t) {
    case 'move': {
      p.x = clampNum(Number(m.x) || 0, -200, 200); p.z = clampNum(Number(m.z) || 0, -200, 200); p.ry = Number(m.ry) || 0; p.moving = !!m.moving;
      return [{ to: 'others', msg: { t: 'move', id, x: p.x, z: p.z, ry: p.ry, moving: p.moving } }];
    }
    case 'phrase': {
      const i = Number(m.id);
      if (!Number.isInteger(i) || i < 0 || i >= PHRASES.length) return [{ to: 'self', msg: { t: 'error', msg: 'Frase no permitida.' } }];
      return [{ to: 'all', msg: { t: 'phrase', id, phrase: i } }];
    }
    case 'puzzle': {
      const pz = puzzleById(m.id);
      if (!pz) return [{ to: 'self', msg: { t: 'error', msg: 'Acertijo desconocido.' } }];
      const prev = PUZZLES.find(q => q.order === pz.order - 1);
      if (prev && !room.solved.has(prev.id)) return [{ to: 'self', msg: { t: 'error', msg: `Primero resuelvan "${prev.title}".` } }];
      const idx = cluesFor(pz, playerIndex(room, id), room.players.size);
      const fails = room.fails.get(pz.id) || 0;
      return [{ to: 'self', msg: { t: 'puzzle', data: { ...publicPuzzle(pz), myClues: idx.map(i => ({ i, text: pz.clues[i] })), coop: room.players.size > 1, solved: room.solved.has(pz.id), hint: fails >= 2 ? pz.hint : null, explain: room.solved.has(pz.id) ? pz.explain : null } } }];
    }
    case 'clue': {
      const pz = puzzleById(m.id);
      if (!pz) return [];
      const idx = cluesFor(pz, playerIndex(room, id), room.players.size);
      return idx.map(i => ({ to: 'all', msg: { t: 'clue', from: id, puzzle: pz.id, i, text: pz.clues[i] } }));
    }
    case 'answer': {
      const pz = puzzleById(m.id);
      if (!pz) return [{ to: 'self', msg: { t: 'error', msg: 'Acertijo desconocido.' } }];
      if (room.solved.has(pz.id)) return [{ to: 'self', msg: { t: 'result', puzzle: pz.id, ok: true, already: true, explain: pz.explain } }];
      const prev = PUZZLES.find(q => q.order === pz.order - 1);
      if (prev && !room.solved.has(prev.id)) return [{ to: 'self', msg: { t: 'error', msg: `Primero resuelvan "${prev.title}".` } }];
      if (checkAnswer(pz, m.value)) {
        room.solved.add(pz.id);
        return [
          { to: 'self', msg: { t: 'result', puzzle: pz.id, ok: true, explain: pz.explain, reward: pz.reward } },
          { to: 'all', msg: { t: 'solved', puzzle: pz.id, by: id, byName: p.name } },
        ];
      }
      const fails = (room.fails.get(pz.id) || 0) + 1; room.fails.set(pz.id, fails);
      return [{ to: 'self', msg: { t: 'result', puzzle: pz.id, ok: false, fails, hint: fails >= 2 ? pz.hint : null } }];
    }
    default:
      return [{ to: 'self', msg: { t: 'error', msg: 'Mensaje no reconocido.' } }];
  }
}
