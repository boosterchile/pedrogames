import * as THREE from 'three';
// @inline-start (el script de publicación sustituye estas importaciones por el código de los módulos)
import { PUZZLES, PHRASES, ALIAS_A, ALIAS_B, COLORS } from '/shared/puzzles.mjs';
import { createRoom, addPlayer, handleMessage } from '/shared/room.mjs';
// @inline-end

// ============================================================
//  Utilidades
// ============================================================
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const SEED = 1337;
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + SEED; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return lerp(lerp(hash2(x0, y0), hash2(x0 + 1, y0), sx), lerp(hash2(x0, y0 + 1), hash2(x0 + 1, y0 + 1), sx), sy);
}
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ============================================================
//  Terreno
// ============================================================
const SIZE = 180, RX = 75, RZ = 64, SEG = 150;
const riverX = z => -6 + 7 * Math.sin(z * 0.045);
const TOWER = { x: 42, z: -28 };
function baseHeight(x, z) {
  const r2 = (x / RX) ** 2 + (z / RZ) ** 2;
  let h = 7 * (1 - r2) + 2.2 * noise(x * 0.05 + 10, z * 0.05 + 10) + 0.8 * noise(x * 0.15, z * 0.15) - 1.2;
  h += 6 * Math.exp(-(((x - TOWER.x) ** 2 + (z - TOWER.z) ** 2)) / (2 * 14 * 14));
  const d = Math.abs(x - riverX(z)), w = 5;
  if (d < w) h = Math.min(h, -1.2 + (d / w) ** 2 * 2.2);
  return h;
}
function shoreline(angle, target = 0.35) { // punto donde la altura cruza `target` desde el centro hacia fuera
  let lo = 0, hi = 120;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (baseHeight(Math.cos(angle) * mid, Math.sin(angle) * mid) > target) lo = mid; else hi = mid; }
  return { x: Math.cos(angle) * lo, z: Math.sin(angle) * lo };
}

// ============================================================
//  Estado
// ============================================================
const ITEMS = {
  madera: { n: 'Madera', i: '🪵' }, piedra: { n: 'Piedra', i: '🪨' }, cuerda: { n: 'Cuerda', i: '🪢' }, metal: { n: 'Chatarra', i: '⚙️' },
  coco: { n: 'Coco', i: '🥥', eat: [18, 22] }, bayas: { n: 'Bayas', i: '🫐', eat: [12, 4] }, agua: { n: 'Agua', i: '🧴', eat: [0, 40] },
};
const state = {
  phase: 'start', me: null, name: '', color: COLORS[0], transport: null, code: 'LOCAL',
  players: new Map(), solved: new Set(), puzzles: [], phrases: PHRASES,
  hp: 100, hunger: 100, thirst: 100, inv: {}, time: 240 * 0.08, dayLen: 240, invDirty: true, openPuzzle: null, orderPick: [], won: false,
};
const keys = {}; const joy = { x: 0, y: 0, active: false };
const log = $('#log');
function msg(text, cls) { const d = document.createElement('div'); d.textContent = text; if (cls) d.className = cls; log.appendChild(d); while (log.children.length > 5) log.removeChild(log.firstChild); setTimeout(() => d.classList.add('fade'), 5500); setTimeout(() => d.remove(), 6400); }
const count = it => state.inv[it] || 0;
function give(it, n = 1, quiet) { state.inv[it] = count(it) + n; state.invDirty = true; if (!quiet) msg(`+${n} ${ITEMS[it].n}`, 'get'); }
function take(it, n = 1) { state.inv[it] = Math.max(0, count(it) - n); if (!state.inv[it]) delete state.inv[it]; state.invDirty = true; }
const hasMaterials = req => Object.entries(req || {}).every(([k, n]) => count(k) >= n);
const matText = req => Object.entries(req || {}).map(([k, n]) => `${ITEMS[k].i} ${count(k)}/${n}`).join('  ') || 'ninguno';

// ============================================================
//  Transportes: local (en memoria) y WebSocket (servidor)
// ============================================================
class LocalTransport {
  constructor() { this.room = createRoom('LOCAL'); this.id = 'yo'; this.onmessage = () => {}; }
  connect(name, color) { const r = addPlayer(this.room, this.id, name, color); this.deliver(r.out); }
  send(m) { this.deliver(handleMessage(this.room, this.id, m)); }
  deliver(outs) { for (const o of outs) if (o.to !== 'others') queueMicrotask(() => this.onmessage(o.msg)); }
  close() {}
}
class WsTransport {
  constructor(url) { this.url = url; this.onmessage = () => {}; this.onerror = () => {}; }
  connect(first) { return new Promise((res, rej) => {
    let ws; try { ws = new WebSocket(this.url); } catch (e) { return rej(e); }
    this.ws = ws; const timer = setTimeout(() => { ws.close(); rej(new Error('timeout')); }, 6000);
    ws.onopen = () => { clearTimeout(timer); ws.send(JSON.stringify(first)); res(); };
    ws.onerror = () => { clearTimeout(timer); rej(new Error('sin conexión')); };
    ws.onmessage = e => { try { this.onmessage(JSON.parse(e.data)); } catch {} };
    ws.onclose = () => this.onerror(new Error('Conexión cerrada'));
  }); }
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  close() { if (this.ws) { this.ws.onclose = null; this.ws.close(); } }
}

// ============================================================
//  Escena
// ============================================================
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fc4f0);
scene.fog = new THREE.Fog(0x7fc4f0, 60, 150);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x4a6a2a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.4); sun.position.set(40, 60, 20); scene.add(sun);

// Terreno con colores por vértice
const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); terrainGeo.rotateX(-Math.PI / 2);
{
  const pos = terrainGeo.attributes.position, col = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xe6d391), grass = new THREE.Color(0x5fa63a), jungle = new THREE.Color(0x2f7a2a), rock = new THREE.Color(0x8a8a80), bed = new THREE.Color(0xc9b98a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = baseHeight(x, z); pos.setY(i, h);
    const n = noise(x * 0.08 + 50, z * 0.08 + 50), v = 0.92 + hash2(i, 3) * 0.16;
    if (Math.abs(x - riverX(z)) < 5 && h < 0.9) c.copy(bed);
    else if (h < 0.45) c.copy(sand);
    else if (h < 1.1) c.copy(sand).lerp(grass, (h - 0.45) / 0.65);
    else if (h > 8.2) c.copy(rock);
    else c.copy(n > 0.55 ? jungle : grass);
    c.multiplyScalar(v); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); terrainGeo.computeVertexNormals();
}
scene.add(new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ vertexColors: true })));
const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshPhongMaterial({ color: 0x1b6fa8, transparent: true, opacity: 0.82, shininess: 80 }));
water.rotation.x = -Math.PI / 2; water.position.y = 0; scene.add(water);

// Puntos clave
const WRECK = shoreline(Math.PI, 0.6); WRECK.x += 5;
const RAFT = shoreline(0.12, -0.6);
const BRIDGE = { x: riverX(6), z: 6 };
const SPRING = { x: 24, z: 22 };
const STATIONS = { wreck: { x: WRECK.x + 4, z: WRECK.z + 5 }, bridge: { x: BRIDGE.x - 7, z: BRIDGE.z }, spring: SPRING, tower: { x: TOWER.x, z: TOWER.z + 4 }, raft: { x: RAFT.x - 4, z: RAFT.z } };
const bridgeZone = { x1: BRIDGE.x - 6.5, x2: BRIDGE.x + 6.5, z1: BRIDGE.z - 1.6, z2: BRIDGE.z + 1.6 };
function heightAt(x, z) { if (state.solved.has('puente') && x > bridgeZone.x1 && x < bridgeZone.x2 && z > bridgeZone.z1 && z < bridgeZone.z2) return 0.75; return baseHeight(x, z); }
function walkable(x, z) { if (Math.hypot(x, z) > 110) return false; return heightAt(x, z) > 0.2; }

// Recursos instanciados
const resources = [];
const rng = mulberry32(SEED);
function nearAny(x, z, pts, d) { return pts.some(p => Math.hypot(p.x - x, p.z - z) < d); }
const reserved = [WRECK, RAFT, BRIDGE, SPRING, TOWER, ...Object.values(STATIONS)];
function scatter(n, ok) { const out = []; let tries = 0; while (out.length < n && tries++ < n * 40) { const x = (rng() - 0.5) * SIZE * 0.95, z = (rng() - 0.5) * SIZE * 0.95; const h = baseHeight(x, z); if (ok(x, z, h) && !nearAny(x, z, reserved, 7) && !nearAny(x, z, out, 2.6)) out.push({ x, z, h, s: 0.8 + rng() * 0.5, r: rng() * Math.PI * 2 }); } return out; }
const trees = scatter(260, (x, z, h) => h > 1.0 && h < 8 && Math.abs(x - riverX(z)) > 6.5);
const palms = scatter(60, (x, z, h) => h > 0.35 && h < 1.0 && Math.abs(x - riverX(z)) > 7);
const rocks = scatter(90, (x, z, h) => h > 0.4 && h < 9 && Math.abs(x - riverX(z)) > 6);
const bushes = scatter(90, (x, z, h) => h > 0.9 && h < 7 && Math.abs(x - riverX(z)) > 6.5);
function instanced(geo, mat, list, place) { const m = new THREE.InstancedMesh(geo, mat, list.length); const o = new THREE.Object3D(); list.forEach((p, i) => { place(o, p); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.instanceMatrix.needsUpdate = true; scene.add(m); return m; }
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4a25 }), leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8a2f }), leafMat2 = new THREE.MeshLambertMaterial({ color: 0x3fa03a });
instanced(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 6), trunkMat, trees, (o, p) => { o.position.set(p.x, p.h + 1.1 * p.s, p.z); o.scale.setScalar(p.s); o.rotation.set(0, p.r, 0); });
instanced(new THREE.ConeGeometry(1.7, 3.4, 7), leafMat, trees, (o, p) => { o.position.set(p.x, p.h + 3.4 * p.s, p.z); o.scale.setScalar(p.s); o.rotation.set(0, p.r, 0); });
instanced(new THREE.ConeGeometry(1.2, 2.4, 7), leafMat2, trees, (o, p) => { o.position.set(p.x, p.h + 5.0 * p.s, p.z); o.scale.setScalar(p.s); o.rotation.set(0, p.r + 0.4, 0); });
instanced(new THREE.CylinderGeometry(0.16, 0.26, 4.2, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a3a }), palms, (o, p) => { o.position.set(p.x, p.h + 2.0 * p.s, p.z); o.scale.setScalar(p.s); o.rotation.set(0.18 * Math.cos(p.r), p.r, 0.18 * Math.sin(p.r)); });
instanced(new THREE.ConeGeometry(2.2, 0.9, 6, 1, true), new THREE.MeshLambertMaterial({ color: 0x3d9a3a, side: THREE.DoubleSide }), palms, (o, p) => { o.position.set(p.x + 0.7 * Math.sin(p.r) * p.s, p.h + 4.35 * p.s, p.z + 0.7 * Math.cos(p.r) * p.s); o.scale.setScalar(p.s); o.rotation.set(Math.PI, p.r, 0); });
instanced(new THREE.DodecahedronGeometry(0.8, 0), new THREE.MeshLambertMaterial({ color: 0x8d8d8d, flatShading: true }), rocks, (o, p) => { o.position.set(p.x, p.h + 0.35 * p.s, p.z); o.scale.set(p.s * 1.2, p.s * 0.8, p.s); o.rotation.set(0, p.r, 0); });
instanced(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshLambertMaterial({ color: 0x2e8b3a, flatShading: true }), bushes, (o, p) => { o.position.set(p.x, p.h + 0.5 * p.s, p.z); o.scale.setScalar(p.s); o.rotation.set(0, p.r, 0); });
for (const [list, type, item, stock, verb] of [[trees, 'arbol', 'madera', 3, 'Talar árbol'], [palms, 'palmera', 'coco', 2, 'Recoger coco'], [rocks, 'roca', 'piedra', 2, 'Picar roca'], [bushes, 'arbusto', 'bayas', 2, 'Recoger bayas']])
  for (const p of list) resources.push({ type, item, stock, max: stock, regrow: 0, verb, x: p.x, z: p.z, h: p.h });
// Lianas: cuerda en la selva (arbustos altos), sin malla propia: usamos algunos arbustos como lianas
for (let i = 0; i < bushes.length; i += 4) { const r = resources.find(r => r.type === 'arbusto' && r.x === bushes[i].x); if (r) { r.type = 'liana'; r.item = 'cuerda'; r.verb = 'Cortar liana'; r.stock = r.max = 2; } }

// Restos del avión
const wreckGroup = new THREE.Group();
{
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 9, 12), new THREE.MeshLambertMaterial({ color: 0xcfd4da }));
  fus.rotation.z = Math.PI / 2; fus.rotation.y = 0.2; wreckGroup.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 7), new THREE.MeshLambertMaterial({ color: 0xb9c1c9 })); wing.position.set(0.5, -0.2, 0); wing.rotation.x = 0.35; wreckGroup.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.2), new THREE.MeshLambertMaterial({ color: 0xc0392b })); tail.position.set(-4.2, 1.3, 0); wreckGroup.add(tail);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshLambertMaterial({ color: 0x2b3a55 })); nose.position.set(4.6, 0, 0); wreckGroup.add(nose);
  wreckGroup.position.set(WRECK.x, baseHeight(WRECK.x, WRECK.z) + 0.6, WRECK.z); wreckGroup.rotation.set(0.12, 0.5, -0.25); scene.add(wreckGroup);
}

// Estaciones
function labelSprite(text, sub) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const c = cv.getContext('2d');
  c.font = '96px serif'; c.textAlign = 'center'; c.fillText(text, 256, 96);
  c.font = '800 40px Nunito, system-ui, sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 8; c.strokeText(sub, 256, 165); c.fillText(sub, 256, 165);
  const tex = new THREE.CanvasTexture(cv); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); sp.scale.set(6, 2.25, 1); return sp;
}
const stations = {};
function makeStation(id, icon, title, pos, builder) {
  const g = new THREE.Group(); const h = id === 'raft' ? 0.15 : baseHeight(pos.x, pos.z); g.position.set(pos.x, h, pos.z);
  const built = new THREE.Group(); built.visible = false; g.add(built); builder(g, built);
  const sp = labelSprite(icon, title); sp.position.y = 4.2; sp.scale.set(3.2, 1.2, 1); g.add(sp);
  scene.add(g); stations[id] = { id, group: g, built, sprite: sp, x: pos.x, z: pos.z, h };
}
const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a }), stoneMat = new THREE.MeshLambertMaterial({ color: 0x7d7d7d, flatShading: true });
makeStation('wreck', '🧳', 'La caja del piloto', STATIONS.wreck, (g, b) => { const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0x6e4a25 })); box.position.y = 0.45; g.add(box); const band = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.2, 0.95), new THREE.MeshLambertMaterial({ color: 0x999 })); band.position.y = 0.55; g.add(band); const lid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.9), new THREE.MeshLambertMaterial({ color: 0x5a3a1a })); lid.position.set(0, 1.1, -0.45); lid.rotation.x = -1.2; b.add(lid); });
makeStation('bridge', '🌉', 'El puente de lianas', STATIONS.bridge, (g, b) => {
  for (const sx of [-6.5, 6.5]) for (const sz of [-1.4, 1.4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 6), woodMat); const wx = BRIDGE.x + sx - STATIONS.bridge.x; post.position.set(wx, baseHeight(BRIDGE.x + sx, BRIDGE.z + sz) - g.position.y + 1.1, sz); g.add(post); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.16, 2.6), woodMat); deck.position.set(BRIDGE.x - STATIONS.bridge.x, 0.68 - g.position.y, 0); b.add(deck);
  for (const sz of [-1.3, 1.3]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 13.5, 4), new THREE.MeshLambertMaterial({ color: 0xd9c89a })); rope.rotation.z = Math.PI / 2; rope.position.set(BRIDGE.x - STATIONS.bridge.x, 1.7 - g.position.y, sz); b.add(rope); }
});
makeStation('spring', '💧', 'El manantial', STATIONS.spring, (g, b) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.35, 6, 10), stoneMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring); const w = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.3, 14), new THREE.MeshPhongMaterial({ color: 0x4fb2e6, emissive: 0x1a6fa8, transparent: true, opacity: 0.9 })); w.position.y = 0.42; b.add(w); const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 1.6, 8), new THREE.MeshPhongMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.7 })); jet.position.y = 1.2; b.add(jet); });
makeStation('tower', '📡', 'La torre de señales', STATIONS.tower, (g, b) => { for (let i = 0; i < 4; i++) { const s = 2.2 - i * 0.45; const seg = new THREE.Mesh(new THREE.BoxGeometry(s, 1.6, s), new THREE.MeshLambertMaterial({ color: i % 2 ? 0xc0392b : 0xe8ecf0, wireframe: false })); seg.position.y = 0.8 + i * 1.6; g.add(seg); } const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.4, 6), stoneMat); ant.position.y = 7.4; g.add(ant); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3030 })); lamp.position.y = 8.7; b.add(lamp); const light = new THREE.PointLight(0xff4040, 2, 30); light.position.y = 8.7; b.add(light); });
makeStation('raft', '⛵', 'La balsa', STATIONS.raft, (g, b) => { const deck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 2.6), woodMat); deck.position.y = 0.15; g.add(deck); for (let i = 0; i < 5; i++) { const logm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3.6, 6), new THREE.MeshLambertMaterial({ color: 0xa3784a })); logm.rotation.z = Math.PI / 2; logm.position.set(0, 0.15, -1.0 + i * 0.5); g.add(logm); } const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), woodMat); mast.position.y = 1.9; g.add(mast); const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), new THREE.MeshLambertMaterial({ color: 0xf3ecd8, side: THREE.DoubleSide })); sail.position.set(0, 2.3, 0.05); b.add(sail); const cargo = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: 0x6e4a25 })); cargo.position.set(1, 0.6, 0.6); b.add(cargo); });

// Personajes
function makeAvatar(color, name) {
  const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 4, 8), new THREE.MeshLambertMaterial({ color })); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshLambertMaterial({ color: 0xe9b98c })); head.position.y = 1.85; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4a2f1a })); hair.position.y = 1.9; g.add(hair);
  const legs = new THREE.Group(); for (const sx of [-0.15, 0.15]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 6), new THREE.MeshLambertMaterial({ color: 0x3b4a6b })); l.position.set(sx, 0.3, 0); legs.add(l); } g.add(legs);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0xd9a57c })); nose.position.set(0, 1.85, 0.3); g.add(nose);
  g.userData = { legs, body, head, bob: 0 };
  if (name) { const sp = labelSprite('', name); sp.scale.set(2.2, 0.82, 1); sp.position.y = 2.7; g.add(sp); g.userData.tag = sp; }
  scene.add(g); return g;
}
const me = { x: WRECK.x - 2, z: WRECK.z + 8, ry: 0, moving: false, mesh: null };
if (!walkable(me.x, me.z)) { for (let r = 2; r < 20; r += 1) { let done = false; for (let a = 0; a < Math.PI * 2 && !done; a += 0.4) { const x = WRECK.x + Math.cos(a) * r, z = WRECK.z + Math.sin(a) * r; if (walkable(x, z)) { me.x = x; me.z = z; done = true; } } if (done) break; } }
const remotes = new Map();
const cam = { yaw: Math.PI * 0.75, pitch: 0.42, dist: 9 };
function bubble(group, text) { if (group.userData.bubble) { group.remove(group.userData.bubble); } const sp = labelSprite('', text); sp.scale.set(3.6, 1.35, 1); sp.position.y = group.userData.tag ? 3.4 : 2.9; group.add(sp); group.userData.bubble = sp; clearTimeout(group.userData.bubbleT); group.userData.bubbleT = setTimeout(() => { group.remove(sp); group.userData.bubble = null; }, 4000); }

// ============================================================
//  HUD
// ============================================================
function renderInv() {
  const el = $('#inv'); el.innerHTML = '';
  for (const it of Object.keys(ITEMS)) { if (!state.inv[it]) continue; const s = document.createElement('div'); s.className = 'slot'; s.title = ITEMS[it].n + (ITEMS[it].eat ? ' · clic para comer/beber' : ''); s.innerHTML = `${ITEMS[it].i}<b>${state.inv[it] > 1 ? state.inv[it] : ''}</b>`; s.addEventListener('click', () => useItem(it)); el.appendChild(s); }
  state.invDirty = false;
}
function useItem(it) { const e = ITEMS[it].eat; if (!e) { msg(`${ITEMS[it].n}: material para las estaciones.`, 'dim'); return; } take(it); state.hunger = clamp(state.hunger + e[0], 0, 100); state.thirst = clamp(state.thirst + e[1], 0, 100); msg(it === 'agua' ? 'Bebes agua.' : `Comes ${ITEMS[it].n.toLowerCase()}.`, 'good'); }
function renderProgress() {
  const el = $('#progress'); el.innerHTML = '';
  const order = [...state.puzzles].sort((a, b) => a.order - b.order);
  order.forEach((p, i) => { const d = document.createElement('div'); d.className = 'step' + (state.solved.has(p.id) ? ' solved' : (i === 0 || state.solved.has(order[i - 1].id)) ? ' available' : ''); d.textContent = p.icon; d.title = p.title; el.appendChild(d); });
  for (const p of order) { const st = stations[p.station]; if (!st) continue; const solved = state.solved.has(p.id); st.built.visible = solved; const avail = solved || p.order === 0 || state.solved.has(order[p.order - 1].id); st.sprite.material.opacity = avail ? 1 : 0.35; }
}
function renderPlayers() {
  const el = $('#players'); el.innerHTML = '';
  for (const p of state.players.values()) { const li = document.createElement('li'); li.innerHTML = `<i style="background:${p.color}"></i>${p.name}${p.id === state.me ? ' (tú)' : ''}`; el.appendChild(li); }
  $('#roomCode').textContent = state.code;
}
function renderPhrases() { const el = $('#phrases'); el.innerHTML = ''; state.phrases.forEach((t, i) => { const b = document.createElement('button'); b.textContent = t; b.addEventListener('click', () => { state.transport.send({ t: 'phrase', id: i }); el.classList.add('hidden'); }); el.appendChild(b); }); }
function updateHud() {
  $('.bar.hp i').style.width = state.hp + '%'; $('.bar.hunger i').style.width = state.hunger + '%'; $('.bar.thirst i').style.width = state.thirst + '%';
  const t = (state.time % state.dayLen) / state.dayLen, hour = (6 + t * 24) % 24, day = Math.floor(state.time / state.dayLen) + 1;
  $('#clock').textContent = `${t > 0.7 ? '🌙' : t > 0.6 ? '🌇' : '☀️'} Día ${day} · ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor(hour % 1 * 60)).padStart(2, '0')}`;
  if (state.invDirty) renderInv();
}

// ============================================================
//  Acertijos (panel)
// ============================================================
function openPuzzle(id) { state.transport.send({ t: 'puzzle', id }); }
function showPuzzle(d) {
  state.openPuzzle = d; state.orderPick = []; const el = $('#puzzle'); el.classList.remove('hidden');
  const clues = d.myClues.map(c => `<div class="clue">🔎 ${c.text}</div>`).join('');
  const missing = d.coop && d.myClues.length < d.clueCount ? `<div class="clue missing">Hay ${d.clueCount - d.myClues.length} pista(s) más en manos de tus compañeros. Pídeles que la compartan.</div>` : '';
  let widget = '';
  if (d.type === 'number') widget = `<input id="ansIn" type="number" inputmode="numeric" placeholder="Escribe el número">`;
  else if (d.type === 'text') widget = `<input id="ansIn" type="text" placeholder="Escribe la respuesta" autocomplete="off">`;
  else if (d.type === 'choice') widget = d.choices.map(c => `<button class="chip" data-v="${c}">${c}</button>`).join('');
  else if (d.type === 'order') widget = `<div id="orderOut"></div>` + d.items.map(c => `<button class="chip" data-o="${c}">${c}</button>`).join('') + `<button class="btn small" id="orderReset">↺ Reiniciar</button>`;
  el.innerHTML = `<h2>${d.icon} ${d.title}</h2><p class="intro">${d.intro}</p><p class="prompt">${d.prompt}</p>
    <h4>Materiales</h4><div style="font-size:14px">${matText(d.materials)}</div>
    <h4>${d.coop ? 'Tus pistas' : 'Pistas'}</h4>${clues}${missing}<div id="sharedClues"></div>
    ${d.solved ? '' : `<h4>Respuesta</h4><div id="answer">${widget}</div>`}
    <div id="feedback"></div>${d.hint ? `<div class="hint">💡 ${d.hint}</div>` : ''}${d.explain ? `<div class="explain">✅ ${d.explain}</div>` : ''}
    <div class="actions">${d.coop ? '<button class="btn" id="bShare">📣 Compartir mi pista con el grupo</button>' : ''}${d.solved ? '' : '<button class="btn primary" id="bAnswer">Responder</button>'}<button class="btn" id="bClose">Cerrar</button></div>`;
  $('#bClose').addEventListener('click', closePuzzle);
  if ($('#bShare')) $('#bShare').addEventListener('click', () => state.transport.send({ t: 'clue', id: d.id }));
  if ($('#bAnswer')) $('#bAnswer').addEventListener('click', submitAnswer);
  if ($('#ansIn')) { $('#ansIn').focus(); $('#ansIn').addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(); e.stopPropagation(); }); $('#ansIn').addEventListener('keyup', e => e.stopPropagation()); }
  el.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { el.querySelectorAll('[data-v]').forEach(x => x.classList.remove('picked')); b.classList.add('picked'); }));
  el.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => { if (state.orderPick.includes(b.dataset.o)) return; state.orderPick.push(b.dataset.o); b.classList.add('picked'); $('#orderOut').innerHTML = state.orderPick.map((v, i) => `<span class="chip picked">${i + 1}. ${v}</span>`).join(''); }));
  if ($('#orderReset')) $('#orderReset').addEventListener('click', () => { state.orderPick = []; el.querySelectorAll('[data-o]').forEach(x => x.classList.remove('picked')); $('#orderOut').innerHTML = ''; });
  for (const c of (d.sharedClues || [])) addSharedClue(c);
}
function addSharedClue(c) { const box = $('#sharedClues'); if (!box || !state.openPuzzle || state.openPuzzle.id !== c.puzzle) return; if (box.querySelector(`[data-i="${c.i}"]`)) return; if (state.openPuzzle.myClues.some(m => m.i === c.i)) return; const d = document.createElement('div'); d.className = 'clue other'; d.dataset.i = c.i; d.textContent = `🤝 ${c.fromName}: ${c.text}`; box.appendChild(d); }
function closePuzzle() { $('#puzzle').classList.add('hidden'); state.openPuzzle = null; }
function submitAnswer() {
  const d = state.openPuzzle; if (!d) return; let value;
  if (d.type === 'number' || d.type === 'text') value = $('#ansIn').value.trim();
  else if (d.type === 'choice') { const p = $('#puzzle .chip.picked'); value = p ? p.dataset.v : ''; }
  else if (d.type === 'order') value = state.orderPick.slice();
  if (value === '' || (Array.isArray(value) && value.length < d.items.length)) { feedback('Completa tu respuesta antes de enviar.', 'bad'); return; }
  if (!hasMaterials(d.materials)) { feedback('Te faltan materiales. Vuelve cuando los tengas.', 'bad'); return; }
  state.transport.send({ t: 'answer', id: d.id, value });
}
function feedback(text, cls) { const f = $('#feedback'); if (f) { f.textContent = text; f.className = cls; } }

// ============================================================
//  Mensajes de la sala
// ============================================================
const sharedClueCache = {};
function onRoomMessage(m) {
  switch (m.t) {
    case 'welcome':
      state.me = m.id; state.code = m.code; state.puzzles = m.puzzles; state.phrases = m.phrases; state.solved = new Set(m.solved);
      state.players.clear(); for (const p of m.players) { state.players.set(p.id, p); if (p.id !== state.me) addRemote(p); }
      renderPlayers(); renderProgress(); renderPhrases(); beginPlay(); break;
    case 'joined': state.players.set(m.player.id, m.player); addRemote(m.player); renderPlayers(); msg(`${m.player.name} se unió a la sala.`, 'good'); break;
    case 'left': { const p = state.players.get(m.id); state.players.delete(m.id); const r = remotes.get(m.id); if (r) { scene.remove(r.mesh); remotes.delete(m.id); } renderPlayers(); if (p) msg(`${p.name} salió de la sala.`, 'dim'); break; }
    case 'move': { const r = remotes.get(m.id); if (r) { r.tx = m.x; r.tz = m.z; r.try = m.ry; r.moving = m.moving; } break; }
    case 'phrase': { const p = state.players.get(m.id); const text = state.phrases[m.phrase]; if (!p) break; msg(`${p.name}: ${text}`, 'say'); const g = m.id === state.me ? me.mesh : remotes.get(m.id)?.mesh; if (g) bubble(g, text); break; }
    case 'clue': { const p = state.players.get(m.from); const c = { puzzle: m.puzzle, i: m.i, text: m.text, fromName: p ? p.name : '?' }; (sharedClueCache[m.puzzle] ||= []).push(c); if (m.from !== state.me) msg(`${c.fromName} compartió una pista de "${m.puzzle}".`, 'say'); addSharedClue(c); break; }
    case 'puzzle': m.data.sharedClues = sharedClueCache[m.data.id] || []; showPuzzle(m.data); break;
    case 'result':
      if (m.ok) { const d = state.openPuzzle; if (d && !m.already) { for (const [k, n] of Object.entries(d.materials || {})) take(k, n); for (const [k, n] of Object.entries(m.reward?.items || {})) give(k, n, true); if (m.reward?.text) msg(m.reward.text, 'good'); } feedback('¡Correcto!', 'ok'); if (d) { d.solved = true; d.explain = m.explain; showPuzzle(d); feedback('¡Correcto!', 'ok'); } }
      else { feedback(`No es correcto (${m.fails} ${m.fails === 1 ? 'intento' : 'intentos'}). Piensa con las pistas y prueba de nuevo.`, 'bad'); if (m.hint && !$('#puzzle .hint')) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = '💡 ' + m.hint; $('#feedback').after(h); } }
      break;
    case 'solved': state.solved.add(m.puzzle); renderProgress(); if (m.by !== state.me) msg(`${m.byName} resolvió "${state.puzzles.find(p => p.id === m.puzzle)?.title}". ¡Sigan!`, 'good'); if (m.puzzle === 'puente') msg('El puente está listo: ya pueden cruzar el río.', 'good'); if (m.puzzle === 'balsa') msg('La balsa está lista. ¡Suban con E para zarpar!', 'good'); break;
    case 'error': if (state.phase === 'connecting') { showStartError(m.msg); } else { msg(m.msg, 'warn'); feedback(m.msg, 'bad'); } break;
  }
}
function addRemote(p) { if (p.id === state.me || remotes.has(p.id)) return; const mesh = makeAvatar(p.color, p.name); mesh.position.set(p.x, heightAt(p.x, p.z), p.z); remotes.set(p.id, { mesh, tx: p.x, tz: p.z, try: p.ry || 0, moving: false }); }

// ============================================================
//  Inicio, conexión y fin
// ============================================================
function randomAlias() { return `${ALIAS_A[Math.floor(Math.random() * ALIAS_A.length)]} ${ALIAS_B[Math.floor(Math.random() * ALIAS_B.length)]}`; }
function showStartError(t) { $('#err').textContent = t; state.phase = 'start'; $('#start').classList.remove('hidden'); if (state.transport) { state.transport.close(); state.transport = null; } }
async function start(mode) {
  $('#err').textContent = ''; state.name = $('#alias').textContent; state.phase = 'connecting';
  if (mode === 'local') { const t = new LocalTransport(); t.onmessage = onRoomMessage; state.transport = t; t.connect(state.name, state.color); return; }
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  if (!location.host || location.protocol === 'file:' || /claude\.ai|anthropic/.test(location.host)) { showStartError('Las salas privadas necesitan el servidor del juego (npm start). En esta demo puedes jugar solo.'); return; }
  const t = new WsTransport(url); t.onmessage = onRoomMessage; t.onerror = () => { if (state.phase === 'play') msg('Se perdió la conexión con la sala.', 'warn'); };
  state.transport = t;
  const first = mode === 'create' ? { t: 'create', name: state.name, color: state.color } : { t: 'join', code: $('#joinCode').value.trim().toUpperCase(), name: state.name, color: state.color };
  if (mode === 'join' && first.code.length !== 5) { showStartError('El código tiene 5 letras.'); return; }
  try { await t.connect(first); } catch (e) { showStartError('No se pudo conectar con el servidor de salas. ¿Está en marcha (npm start)?'); }
}
function beginPlay() {
  state.phase = 'play'; $('#start').classList.add('hidden'); $('#hud').classList.remove('hidden');
  if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) $('#touch').classList.remove('hidden');
  if (!me.mesh) { me.mesh = makeAvatar(state.color, ''); }
  msg('Sobreviviste al accidente. Sigue los iconos de arriba: empieza por la caja del piloto (🧳), junto al avión.', 'good');
  msg('Recoge madera, piedras, cuerda y cocos con E. Los necesitarás en cada estación.', 'dim');
}
function endGame() { state.won = true; state.phase = 'end'; const days = Math.floor(state.time / state.dayLen) + 1; $('#endTitle').textContent = '¡Zarparon!'; $('#endText').textContent = `Resolvieron las cinco pruebas y dejaron la isla en la balsa tras ${days} ${days === 1 ? 'día' : 'días'}. ${state.players.size > 1 ? 'Lo lograron en equipo.' : 'Lo lograste con ingenio.'}`; $('#end').classList.remove('hidden'); }

// Pantalla de inicio
$('#alias').textContent = randomAlias(); $('#bAlias').addEventListener('click', () => { $('#alias').textContent = randomAlias(); });
COLORS.forEach((c, i) => { const s = document.createElement('div'); s.className = 'swatch' + (i === 0 ? ' picked' : ''); s.style.background = c; s.addEventListener('click', () => { state.color = c; document.querySelectorAll('.swatch').forEach(x => x.classList.remove('picked')); s.classList.add('picked'); }); $('#colors').appendChild(s); });
$('#bLocal').addEventListener('click', () => start('local')); $('#bCreate').addEventListener('click', () => start('create')); $('#bJoin').addEventListener('click', () => start('join'));
$('#joinCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') start('join'); }); $('#joinCode').addEventListener('keyup', e => e.stopPropagation());
$('#bAgain').addEventListener('click', () => location.reload());
$('#bPhrases').addEventListener('click', () => $('#phrases').classList.toggle('hidden'));
$('#bHelp').addEventListener('click', () => $('#help').classList.remove('hidden')); $('#bHelpClose').addEventListener('click', () => $('#help').classList.add('hidden'));

// ============================================================
//  Entrada
// ============================================================
addEventListener('keydown', e => { keys[e.code] = true; if (state.phase !== 'play') return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (e.repeat) return; if (e.code === 'KeyE' || e.code === 'Space') interact(); if (e.code === 'Escape') { closePuzzle(); $('#phrases').classList.add('hidden'); $('#help').classList.add('hidden'); } if (e.code === 'KeyT') $('#phrases').classList.toggle('hidden'); });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; cam.yaw -= (e.clientX - drag.x) * 0.005; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.004, 0.12, 1.25); drag.x = e.clientX; drag.y = e.clientY; });
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { drag = null; });
canvas.addEventListener('wheel', e => { cam.dist = clamp(cam.dist + e.deltaY * 0.01, 4, 16); }, { passive: true });
{ const j = $('#joy'), knob = j.querySelector('i'); let jid = null;
  j.addEventListener('pointerdown', e => { jid = e.pointerId; j.setPointerCapture(jid); joy.active = true; moveJoy(e); });
  j.addEventListener('pointermove', e => { if (e.pointerId === jid) moveJoy(e); });
  for (const ev of ['pointerup', 'pointercancel']) j.addEventListener(ev, () => { jid = null; joy.active = false; joy.x = joy.y = 0; knob.style.transform = ''; });
  function moveJoy(e) { const r = j.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 35}px,${dy * 35}px)`; }
  $('#tE').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
}

// ============================================================
//  Interacción
// ============================================================
function nearest() {
  let best = null, bd = 3.4;
  for (const r of resources) { if (r.stock <= 0) continue; const d = Math.hypot(r.x - me.x, r.z - me.z); if (d < bd) { bd = d; best = { kind: 'res', r }; } }
  for (const p of state.puzzles) { const st = stations[p.station]; const d = Math.hypot(st.x - me.x, st.z - me.z); if (d < bd + 1.2) { bd = d; best = { kind: 'station', p, st }; } }
  return best;
}
function promptFor(n) {
  if (!n) return null;
  if (n.kind === 'res') return `E · ${n.r.verb} (${ITEMS[n.r.item].i} ${n.r.stock})`;
  const solved = state.solved.has(n.p.id);
  if (solved) return n.p.id === 'balsa' ? 'E · ¡Zarpar!' : n.p.id === 'manantial' ? 'E · Beber y llenar agua' : `${n.p.icon} ${n.p.title} (resuelto) · E para repasar`;
  const prev = state.puzzles.find(q => q.order === n.p.order - 1);
  if (prev && !state.solved.has(prev.id)) return `🔒 ${n.p.title}: primero ${prev.icon} ${prev.title}`;
  return `E · ${n.p.icon} ${n.p.title} · materiales: ${matText(n.p.materials)}`;
}
let interactCd = 0;
function interact() {
  if (state.phase !== 'play' || interactCd > 0 || state.openPuzzle) return; interactCd = 0.35;
  const n = nearest(); if (!n) { msg('No hay nada cerca. Explora la isla.', 'dim'); return; }
  if (n.kind === 'res') { n.r.stock--; if (n.r.stock <= 0) n.r.regrow = 120; give(n.r.item, 1); me.mesh.userData.swing = 0.3; return; }
  const p = n.p, solved = state.solved.has(p.id);
  if (solved && p.id === 'balsa') { endGame(); return; }
  if (solved && p.id === 'manantial') { state.thirst = 100; if (count('agua') < 3) give('agua', 1, true); msg('Bebes agua fresca y llenas la botella.', 'good'); return; }
  openPuzzle(p.id);
}

// ============================================================
//  Bucle
// ============================================================
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let last = performance.now(), sendAcc = 0, lastSent = null, hintDay = 0;
function update(dt) {
  state.time += dt; interactCd = Math.max(0, interactCd - dt);
  // movimiento
  let ix = 0, iz = 0;
  if (!state.openPuzzle) { if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; if (joy.active) { ix += joy.x; iz += joy.y; } }
  const l = Math.hypot(ix, iz); me.moving = l > 0.1;
  if (me.moving) {
    ix /= Math.max(1, l); iz /= Math.max(1, l);
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    const dx = (ix * c - iz * s), dz = (ix * s + iz * c);
    const sp = 7 * dt; const nx = me.x + dx * sp, nz = me.z + dz * sp;
    const h0 = heightAt(me.x, me.z);
    if (walkable(nx, nz) && heightAt(nx, nz) - h0 < 0.9) { me.x = nx; me.z = nz; }
    else if (walkable(nx, me.z) && heightAt(nx, me.z) - h0 < 0.9) me.x = nx;
    else if (walkable(me.x, nz) && heightAt(me.x, nz) - h0 < 0.9) me.z = nz;
    me.ry = Math.atan2(dx, dz);
  }
  const mh = heightAt(me.x, me.z);
  me.mesh.position.set(me.x, mh, me.z); me.mesh.rotation.y = lerp(me.mesh.rotation.y, me.ry, 0.2);
  animateAvatar(me.mesh, me.moving, dt);
  // red: enviar posición 10 veces por segundo si cambió
  sendAcc += dt; if (sendAcc > 0.1) { sendAcc = 0; const key = `${me.x.toFixed(2)},${me.z.toFixed(2)},${me.ry.toFixed(2)},${me.moving}`; if (key !== lastSent) { lastSent = key; state.transport.send({ t: 'move', x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), moving: me.moving }); } }
  for (const r of remotes.values()) { const m = r.mesh; m.position.x = lerp(m.position.x, r.tx, 0.15); m.position.z = lerp(m.position.z, r.tz, 0.15); m.position.y = heightAt(m.position.x, m.position.z); m.rotation.y = lerp(m.rotation.y, r.try, 0.15); animateAvatar(m, r.moving, dt); }
  // necesidades
  state.hunger = clamp(state.hunger - 0.25 * dt, 0, 100); state.thirst = clamp(state.thirst - 0.32 * dt, 0, 100);
  if (state.hunger <= 0 || state.thirst <= 0) state.hp = clamp(state.hp - 1.5 * dt, 0, 100); else if (state.hunger > 50 && state.thirst > 50) state.hp = clamp(state.hp + 0.8 * dt, 0, 100);
  if (state.hp <= 0) { state.hp = 60; state.hunger = 60; state.thirst = 60; me.x = WRECK.x - 2; me.z = WRECK.z + 8; msg('Te desmayaste por hambre o sed. Despiertas junto al avión. Come cocos o bayas y bebe agua.', 'warn'); }
  if (state.thirst < 25 && hintDay !== Math.floor(state.time / 30)) { hintDay = Math.floor(state.time / 30); msg('Tienes sed: come un coco o busca el manantial.', 'warn'); }
  for (const r of resources) if (r.stock <= 0) { r.regrow -= dt; if (r.regrow <= 0) r.stock = r.max; }
  // día y noche
  const t = (state.time % state.dayLen) / state.dayLen; const ang = t < 0.7 ? (t / 0.7) * Math.PI : Math.PI + ((t - 0.7) / 0.3) * Math.PI;
  sun.position.set(Math.cos(ang) * 80, Math.sin(ang) * 80, 30); const dayF = clamp(Math.sin(ang) * 1.6 + 0.25, 0, 1);
  sun.intensity = 0.2 + 1.3 * dayF; hemi.intensity = 0.25 + 0.7 * dayF;
  const sky = new THREE.Color(0x0b1636).lerp(new THREE.Color(0x7fc4f0), dayF); if (t > 0.58 && t < 0.72) sky.lerp(new THREE.Color(0xf2a15a), Math.sin((t - 0.58) / 0.14 * Math.PI) * 0.5); if (t < 0.06) sky.lerp(new THREE.Color(0xf2b07a), Math.sin(t / 0.06 * Math.PI) * 0.35);
  scene.background.copy(sky); scene.fog.color.copy(sky);
  // cámara
  const tx = me.x, ty = mh + 1.5, tz = me.z;
  let cx = tx + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cz = tz + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cy = ty + Math.sin(cam.pitch) * cam.dist;
  cy = Math.max(cy, baseHeight(cx, cz) + 1.0, 0.8);
  camera.position.set(cx, cy, cz); camera.lookAt(tx, ty, tz);
  // estaciones: flotar iconos
  for (const st of Object.values(stations)) { const sp = st.sprite; sp.position.y = (st.id === 'tower' ? 10.2 : 4.2) + Math.sin(state.time * 2 + st.x) * 0.2; const d = camera.position.distanceTo(st.group.position); const k = clamp(d * 0.11, 0.4, 6); sp.scale.set(k * 2.4, k * 0.9, 1); }
  for (const r of remotes.values()) { const tag = r.mesh.userData.tag; if (tag) { const k = clamp(camera.position.distanceTo(r.mesh.position) * 0.1, 0.5, 4); tag.scale.set(k * 2.2, k * 0.82, 1); } }
  // prompt
  const n = nearest(); const p = promptFor(n); const pe = $('#prompt'); if (p) { pe.textContent = p; pe.classList.remove('hidden'); } else pe.classList.add('hidden');
}
function animateAvatar(g, moving, dt) { const u = g.userData; u.bob = moving ? u.bob + dt * 10 : 0; const k = moving ? Math.sin(u.bob) : 0; u.legs.children[0].rotation.x = k * 0.7; u.legs.children[1].rotation.x = -k * 0.7; u.body.position.y = 1.05 + Math.abs(k) * 0.06; if (u.swing > 0) { u.swing -= dt; u.body.rotation.x = Math.sin(u.swing / 0.3 * Math.PI) * 0.35; } else u.body.rotation.x = 0; }
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.phase === 'play') { update(dt); updateHud(); }
  else { cam.yaw += dt * 0.05; const cx = Math.sin(cam.yaw) * 60, cz = Math.cos(cam.yaw) * 60; camera.position.set(cx, 28, cz); camera.lookAt(0, 2, 0); }
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = { state, me, stations, resources, remotes, interact, openPuzzle, submitAnswer, give, heightAt, walkable, WRECK, RAFT, BRIDGE, start, cam, resetCd: () => { interactCd = 0; } };
