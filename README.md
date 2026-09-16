# Náufrago: Supervivencia en la Selva

Juego de supervivencia en el navegador, en español y sin dependencias: un solo archivo `index.html` con HTML5 Canvas y JavaScript.

Tu avión falla sobre el océano y se estrella en una isla cubierta de selva. Eres el único superviviente. Sobrevive con lo que la isla te ofrece y construye una balsa para escapar.

## Cómo jugar

Abre `index.html` en cualquier navegador moderno (o sírvelo con GitHub Pages). Funciona en escritorio y en móvil (controles táctiles en pantalla).

| Tecla | Acción |
|---|---|
| WASD / Flechas | Moverse |
| E / Espacio | Interactuar con lo que tienes delante (o clic en el mundo) |
| C | Abrir el panel de creación |
| H | Ayuda |
| Esc | Cerrar paneles |
| M | Silenciar sonido |
| L (inicio) | Continuar partida guardada |

`?seed=1234` en la URL genera siempre la misma isla.

## Mecánicas

- **Necesidades**: salud, hambre, sed y energía. Si el hambre o la sed llegan a cero, pierdes salud.
- **Recursos**: palos y madera (árboles, madera solo con hacha), cocos y hojas (palmeras), bayas (arbustos), piedras (rocas), cuerda (lianas de la selva) y chatarra, cuerda, vendas y botella en los restos del avión. Los recursos se regeneran con el tiempo.
- **Agua**: bebe en el lago. El mar no se bebe, pero con lanza puedes pescar.
- **Fauna**: los jabalíes te embisten. Con lanza puedes cazarlos y asar la carne.
- **Día y noche**: de noche hace frío; una fogata te da calor y permite asar comida, y en el refugio puedes dormir hasta el amanecer.
- **Creación**: hacha de piedra, lanza, fogata, refugio y balsa. Las construcciones se colocan delante del personaje.
- **Fauna**: además de jabalíes, en la selva hay serpientes que muerden si te acercas. Un golpe de lanza acaba con ellas.
- **Dos vías de escape**: construye la balsa (12 madera, 5 cuerda, 3 hojas, 2 chatarra) desde la playa mirando al mar y súbete, o levanta una hoguera de señales (8 madera, 3 hojas, 2 piedras) en la playa y mantenla encendida de día hasta que un barco vea el humo.
- **Guardado**: la partida se guarda sola cada 15 segundos y al dormir. En la pantalla de inicio, pulsa `L` para continuar.
- **Sonido**: efectos sintetizados con WebAudio, sin archivos. `M` silencia.
