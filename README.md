# Náufrago: supervivencia con acertijos

Tu avión falla sobre el océano y cae en una isla cubierta de selva. Para escapar hay que sobrevivir con lo que la isla ofrece y superar pruebas de lógica. Pensado para jugadores de 10 a 13 años, solos o en salas privadas.

El repositorio tiene dos versiones:

| Carpeta | Qué es | Estado |
|---|---|---|
| `web3d/` + `server/` + `shared/` | **Náufrago 3D**: Three.js, salas privadas por WebSocket, acertijos de progresión | Corte vertical jugable |
| `index.html` | Prototipo 2D original (canvas) con supervivencia clásica | Completo, se mantiene como referencia |

## Náufrago 3D

### Ejecutar

```bash
npm install
npm start          # http://localhost:8080
npm test           # tests del servidor y de los acertijos
```

`PORT=3000 npm start` cambia el puerto. El mismo proceso sirve el cliente y las salas.

### Cómo se juega

- **Moverse**: WASD o flechas; en móvil, la palanca. **Cámara**: arrastrar con el ratón o el dedo; rueda para acercar.
- **E** (o el botón E en móvil): interactuar con árboles, rocas, palmeras, lianas y estaciones.
- **Progresión**: cinco estaciones en orden, cada una con materiales y un acertijo. Los iconos de arriba muestran cuál está disponible.
- **Hablar**: solo frases predefinidas (💬 o tecla T). No hay chat libre a propósito.
- **Necesidades**: hambre y sed bajan con el tiempo; cocos, bayas y el manantial las reponen. Si llegan a cero pierdes salud y despiertas junto al avión, sin perder progreso.

### Acertijos

Definidos en `shared/puzzles.mjs` como datos: enunciado, tipo (`number`, `choice`, `text`, `order`), pistas, materiales, recompensa, ayuda tras dos fallos y explicación al acertar. Añadir uno nuevo es añadir un objeto a la lista y una estación en el cliente.

| Estación | Tipo | Habilidad |
|---|---|---|
| 🧳 La caja del piloto | secuencia numérica | patrones |
| 🌉 El puente de lianas | lógica de orden | deducción |
| 💧 El manantial | aritmética aplicada | proporciones |
| 📡 La torre de señales | cifrado César | codificación |
| ⛵ La balsa | ordenar por comparaciones | razonamiento transitivo |

En una sala, las pistas de cada acertijo se reparten entre los jugadores; el botón "Compartir mi pista" la envía al grupo. Con un solo jugador se reciben todas.

### Salas privadas y protección de menores

- No hay salas públicas ni emparejamiento: quien crea la sala recibe un código de 5 letras y lo comparte. Máximo 6 jugadores.
- Sin chat libre ni voz: el cliente solo puede enviar el identificador de una frase de la lista; el servidor rechaza cualquier otra cosa.
- Alias generados (animal + adjetivo) en lugar de nombres reales. No se recoge ningún dato personal.
- El servidor es autoritativo: valida las respuestas y nunca envía las soluciones al cliente.
- Las salas viven solo en memoria mientras hay jugadores, con límite de tamaño de mensaje y de frecuencia.

### Estructura

```
web3d/index.html      interfaz (HUD, panel de acertijo, pantallas)
web3d/game.mjs        mundo 3D, personaje, interacción, transporte local y WebSocket
shared/puzzles.mjs    acertijos, frases y alias
shared/room.mjs       lógica de sala (la usan el servidor y el modo local)
server/server.js      HTTP estático + WebSocket de salas
test/                 tests con node:test
```

## Prototipo 2D

Abre `index.html` en el navegador. Controles: WASD/flechas, E interactuar, C crear, H ayuda, M silencio, L continuar partida guardada. Incluye hambre, sed, energía, día y noche, jabalíes y serpientes, y dos vías de escape (balsa u hoguera de señales).
