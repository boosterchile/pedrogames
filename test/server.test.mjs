import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createServer } from '../server/server.js';
import { PUZZLES, PHRASES, checkAnswer, cluesFor, normalizeText } from '../shared/puzzles.mjs';

let srv, port;
before(async () => { srv = createServer(); await new Promise(r => srv.server.listen(0, r)); port = srv.server.address().port; });
after(async () => { await srv.close(); });

function client() {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const queue = []; const waiters = [];
  ws.on('message', d => { const m = JSON.parse(d.toString()); if (waiters.length) waiters.shift()(m); else queue.push(m); });
  const next = (type) => new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('timeout esperando ' + (type || 'mensaje'))), 3000);
    const take = m => { if (type && m.t !== type) { waiters.unshift(take); return; } clearTimeout(timer); res(m); };
    const i = type ? queue.findIndex(m => m.t === type) : 0;
    if (i >= 0 && queue.length) res(queue.splice(i, 1)[0]), clearTimeout(timer); else waiters.push(take);
  });
  const send = m => ws.send(JSON.stringify(m));
  return new Promise(res => ws.on('open', () => res({ ws, send, next, close: () => ws.close() })));
}

test('acertijos: validación y normalización', () => {
  const caja = PUZZLES.find(p => p.id === 'caja');
  assert.equal(checkAnswer(caja, '42'), true); assert.equal(checkAnswer(caja, 41), false);
  const senal = PUZZLES.find(p => p.id === 'senal');
  assert.equal(checkAnswer(senal, '  SOS en la PLAYA '), true); assert.equal(checkAnswer(senal, 'sos en la casa'), false);
  const balsa = PUZZLES.find(p => p.id === 'balsa');
  assert.equal(checkAnswer(balsa, ['hoja', 'coco', 'piedra', 'tronco']), true); assert.equal(checkAnswer(balsa, ['coco', 'hoja', 'piedra', 'tronco']), false);
  assert.equal(normalizeText('Cámi!'), 'cami');
  assert.deepEqual(cluesFor(caja, 0, 1), [0, 1]); assert.deepEqual(cluesFor(caja, 0, 2), [0]); assert.deepEqual(cluesFor(caja, 1, 2), [1]); assert.deepEqual(cluesFor(caja, 2, 3), [0]);
});

test('estáticos: cliente, shared y vendor; sin path traversal', async () => {
  const get = async p => { const r = await fetch(`http://localhost:${port}${p}`); return [r.status, await r.text()]; };
  const [s1, html] = await get('/'); assert.equal(s1, 200); assert.match(html, /<title>/);
  const [s2] = await get('/shared/puzzles.mjs'); assert.equal(s2, 200);
  const [s3, js] = await get('/vendor/three.module.min.js'); assert.equal(s3, 200); assert.ok(js.length > 100000);
  const [s4] = await get('/../package.json'); assert.equal(s4, 404);
  const [s5] = await get('/shared/../server/server.js'); assert.equal(s5, 404);
});

test('crear sala, unirse por código, límite de jugadores y código inválido', async () => {
  const a = await client(); a.send({ t: 'create', name: 'Tucán Valiente', color: '#e0703a' });
  const w = await a.next('welcome'); assert.match(w.code, /^[A-HJ-NP-Z2-9]{5}$/); assert.equal(w.players.length, 1); assert.equal(w.puzzles.length, 5);
  assert.equal(w.puzzles[0].answer, undefined, 'el cliente no debe recibir respuestas');
  const bad = await client(); bad.send({ t: 'join', code: 'ZZZZZ', name: 'X' }); const e = await bad.next('error'); assert.match(e.msg, /No existe/); bad.close();
  const others = [];
  for (let i = 0; i < 5; i++) { const c = await client(); c.send({ t: 'join', code: w.code.toLowerCase(), name: 'J' + i }); const ww = await c.next('welcome'); assert.equal(ww.players.length, i + 2); others.push(c); }
  const j = await a.next('joined'); assert.equal(j.player.name, 'J0');
  const full = await client(); full.send({ t: 'join', code: w.code, name: 'Sobra' }); const ef = await full.next('error'); assert.match(ef.msg, /llena/); full.close();
  for (const c of others) c.close(); a.close();
});

test('frases: solo identificadores válidos; movimiento se retransmite a los demás', async () => {
  const a = await client(); a.send({ t: 'create', name: 'A' }); const w = await a.next('welcome');
  const b = await client(); b.send({ t: 'join', code: w.code, name: 'B' }); await b.next('welcome'); await a.next('joined');
  a.send({ t: 'phrase', id: 2 }); const pa = await a.next('phrase'); assert.equal(pa.phrase, 2); assert.equal(PHRASES[pa.phrase], 'Necesito ayuda');
  const pb = await b.next('phrase'); assert.equal(pb.id, pa.id);
  a.send({ t: 'phrase', id: 999 }); const e = await a.next('error'); assert.match(e.msg, /Frase/);
  a.send({ t: 'phrase', id: 'hola libre' }); const e2 = await a.next('error'); assert.match(e2.msg, /Frase/);
  a.send({ t: 'move', x: 3.5, z: -2, ry: 1.2, moving: true }); const mv = await b.next('move'); assert.equal(mv.x, 3.5); assert.equal(mv.moving, true);
  a.close(); b.close();
});

test('acertijos en sala: orden obligatorio, pistas repartidas, pista tras 2 fallos, resolución compartida', async () => {
  const a = await client(); a.send({ t: 'create', name: 'A' }); const w = await a.next('welcome');
  const b = await client(); b.send({ t: 'join', code: w.code, name: 'B' }); await b.next('welcome'); await a.next('joined');
  a.send({ t: 'puzzle', id: 'puente' }); const locked = await a.next('error'); assert.match(locked.msg, /Primero/);
  a.send({ t: 'puzzle', id: 'caja' }); const pa = await a.next('puzzle'); assert.equal(pa.data.coop, true); assert.deepEqual(pa.data.myClues.map(c => c.i), [0]); assert.equal(pa.data.hint, null);
  b.send({ t: 'puzzle', id: 'caja' }); const pb = await b.next('puzzle'); assert.deepEqual(pb.data.myClues.map(c => c.i), [1]);
  b.send({ t: 'clue', id: 'caja' }); const ca = await a.next('clue'); assert.equal(ca.i, 1); assert.match(ca.text, /dos cifras/); await b.next('clue');
  a.send({ t: 'answer', id: 'caja', value: 40 }); let r = await a.next('result'); assert.equal(r.ok, false); assert.equal(r.hint, null);
  a.send({ t: 'answer', id: 'caja', value: 41 }); r = await a.next('result'); assert.equal(r.ok, false); assert.match(r.hint, /12/);
  a.send({ t: 'answer', id: 'caja', value: '42' }); r = await a.next('result'); assert.equal(r.ok, true); assert.match(r.explain, /42/); assert.equal(r.reward.items.metal, 2);
  const sa = await a.next('solved'); assert.equal(sa.puzzle, 'caja'); const sb = await b.next('solved'); assert.equal(sb.byName, 'A');
  b.send({ t: 'puzzle', id: 'puente' }); const pp = await b.next('puzzle'); assert.equal(pp.data.type, 'choice');
  b.send({ t: 'answer', id: 'caja', value: 42 }); const again = await b.next('result'); assert.equal(again.already, true);
  a.close(); b.close();
});

test('mensaje sin sala y JSON inválido devuelven error sin caer', async () => {
  const a = await client(); a.send({ t: 'move', x: 1 }); const e = await a.next('error'); assert.match(e.msg, /Primero crea/);
  a.ws.send('{no json'); const e2 = await a.next('error'); assert.match(e2.msg, /inválido/);
  a.close();
});
