// Acertijos de progresión. Público: título, intro, enunciado, tipo, opciones y pistas.
// Privado (solo servidor / modo local): answer, hint, explain.
// Edad objetivo: 10 a 13 años. Cada acertijo tiene pistas repartibles entre jugadores.

export const PUZZLES = [
  {
    id: 'caja', order: 0, title: 'La caja del piloto', icon: '🧳', station: 'wreck',
    intro: 'Entre los restos del avión hay una caja fuerte con teclado numérico. En la tapa alguien escribió una secuencia.',
    prompt: 'La secuencia es 2, 6, 12, 20, 30, ... ¿Cuál es el número que sigue? Ese es el código.',
    type: 'number',
    clues: [
      'Mira cuánto crece cada vez: de 2 a 6 crece 4, de 6 a 12 crece 6, de 12 a 20 crece 8...',
      'El código tiene dos cifras y es un número par.',
    ],
    materials: {},
    reward: { items: { metal: 2, cuerda: 2 }, text: 'La caja se abre: hay chatarra y cuerda de los cinturones.' },
    answer: 42,
    hint: 'Las diferencias crecen de 2 en 2: 4, 6, 8, 10 y luego 12. Suma 12 al último número.',
    explain: 'Cada salto es 2 más grande que el anterior (4, 6, 8, 10, 12), así que 30 + 12 = 42. Es la secuencia n×(n+1).',
  },
  {
    id: 'puente', order: 1, title: 'El puente de lianas', icon: '🌉', station: 'bridge',
    intro: 'El río parte la isla en dos. Los postes de un viejo puente siguen en pie, pero el mecanismo tiene una placa con un problema.',
    prompt: 'Cuatro exploradores cruzaron el puente: Ana llegó antes que Beto pero después de Cami. Dani llegó al final. ¿Quién cruzó primero?',
    type: 'choice',
    choices: ['Ana', 'Beto', 'Cami', 'Dani'],
    clues: [
      'Ana cruzó después de Cami.',
      'Beto cruzó después de Ana, y Dani fue el último.',
    ],
    materials: { madera: 4, cuerda: 2 },
    reward: { items: {}, text: 'Con la madera y la cuerda reconstruyen el puente. ¡Ya pueden cruzar el río!' },
    answer: 'Cami',
    hint: 'Ordena a los cuatro de primero a último usando las dos pistas.',
    explain: 'Cami llegó antes que Ana, Ana antes que Beto, y Dani fue el último. El orden es Cami, Ana, Beto, Dani.',
  },
  {
    id: 'manantial', order: 2, title: 'El manantial', icon: '💧', station: 'spring',
    intro: 'Al otro lado del río hay un manantial tapado con piedras. Un cartel explica cómo funciona el filtro de agua.',
    prompt: 'El filtro purifica 3 litros cada 20 minutos. El grupo necesita 18 litros para el día. ¿Cuántos minutos tardará?',
    type: 'number',
    clues: [
      'El filtro purifica 3 litros cada 20 minutos.',
      'El grupo necesita 18 litros en total.',
    ],
    materials: { piedra: 2 },
    reward: { items: { agua: 3 }, text: 'Destapan el manantial. Aquí siempre podrán rellenar agua.' },
    answer: 120,
    hint: '¿Cuántas tandas de 3 litros hacen 18 litros? Multiplica esas tandas por 20 minutos.',
    explain: '18 ÷ 3 = 6 tandas, y 6 × 20 minutos = 120 minutos, es decir, dos horas.',
  },
  {
    id: 'senal', order: 3, title: 'La torre de señales', icon: '📡', station: 'tower',
    intro: 'En la colina hay una torre de radio abandonada. Sobre la mesa quedó un mensaje cifrado y una regla.',
    prompt: 'Regla: cada letra se cambió por la siguiente del abecedario (A→B, B→C, ... Z→A). Descifra: TPT FO MB QMBZB',
    type: 'text',
    clues: [
      'Para descifrar, cambia cada letra por la anterior del abecedario: B→A, C→B, D→C...',
      'El mensaje tiene tres palabras y la primera es una llamada de auxilio famosa.',
    ],
    materials: { madera: 3 },
    reward: { items: {}, text: 'Reparan la antena con la madera y la torre vuelve a emitir. ¡Alguien puede oírlos!' },
    answer: 'sos en la playa',
    hint: 'T→S, P→O, T→S. La primera palabra es SOS.',
    explain: 'Con cada letra retrocedida una posición, TPT FO MB QMBZB se convierte en SOS EN LA PLAYA. Es un cifrado César con desplazamiento 1.',
  },
  {
    id: 'balsa', order: 4, title: 'La balsa', icon: '⛵', station: 'raft',
    intro: 'La balsa está casi lista, pero hay que cargarla del objeto más liviano al más pesado para que no se vuelque.',
    prompt: 'Ordena los objetos del más liviano al más pesado.',
    type: 'order',
    items: ['Piedra', 'Coco', 'Hoja', 'Tronco'],
    clues: [
      'La piedra pesa más que el coco, y el coco pesa más que la hoja.',
      'El tronco pesa más que la piedra.',
    ],
    materials: { madera: 6, piedra: 2 },
    reward: { items: {}, text: 'La balsa está cargada y equilibrada. ¡Es hora de zarpar!' },
    answer: ['Hoja', 'Coco', 'Piedra', 'Tronco'],
    hint: 'Empieza por lo más liviano: la hoja. Luego usa las comparaciones una por una.',
    explain: 'Hoja < Coco < Piedra < Tronco. Encadenar comparaciones de dos en dos permite ordenar el conjunto completo.',
  },
];

export const PHRASES = [
  '¡Hola!', 'Vengan aquí', 'Necesito ayuda', 'Miren mi pista', '¡Lo tengo!',
  'Probemos otra cosa', 'Buen trabajo', 'Vamos al avión', 'Vamos al río', 'Vamos a la colina',
  'Vamos a la playa', 'Sí', 'No', 'Esperen', '😀', '👍', '😮', '🤔',
];

export const ALIAS_A = ['Tucán', 'Jaguar', 'Mono', 'Tortuga', 'Colibrí', 'Iguana', 'Delfín', 'Loro', 'Coatí', 'Rana'];
export const ALIAS_B = ['Valiente', 'Curioso', 'Veloz', 'Sabio', 'Alegre', 'Tranquilo', 'Astuto', 'Amable'];
export const COLORS = ['#e0703a', '#3a8fe0', '#3ac46a', '#e0c33a', '#b05ae0', '#e05a8a'];

const FIELDS_PUBLIC = ['id', 'order', 'title', 'icon', 'station', 'intro', 'prompt', 'type', 'choices', 'items', 'materials', 'reward'];

export function puzzleById(id) { return PUZZLES.find(p => p.id === id) || null; }

// Datos que puede ver un cliente (sin respuesta ni explicación).
export function publicPuzzle(p) {
  const o = {};
  for (const k of FIELDS_PUBLIC) if (p[k] !== undefined) o[k] = p[k];
  o.clueCount = p.clues.length;
  return o;
}

export function normalizeText(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function checkAnswer(p, value) {
  if (!p) return false;
  switch (p.type) {
    case 'number': return Number(value) === p.answer;
    case 'choice': return normalizeText(value) === normalizeText(p.answer);
    case 'text': return normalizeText(value) === normalizeText(p.answer);
    case 'order': return Array.isArray(value) && value.length === p.answer.length && value.every((v, i) => normalizeText(v) === normalizeText(p.answer[i]));
    default: return false;
  }
}

// Reparte las pistas entre los jugadores de una sala. Con un solo jugador, recibe todas.
export function cluesFor(p, playerIndex, playerCount) {
  if (playerCount <= 1) return p.clues.map((c, i) => i);
  const out = [];
  for (let i = playerIndex; i < p.clues.length; i += playerCount) out.push(i);
  if (!out.length) out.push(playerIndex % p.clues.length);
  return out;
}
