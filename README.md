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

`?seed=1234` en la URL genera siempre la misma isla.

## Mecánicas

- **Necesidades**: salud, hambre, sed y energía. Si el hambre o la sed llegan a cero, pierdes salud.
- **Recursos**: palos y madera (árboles, madera solo con hacha), cocos y hojas (palmeras), bayas (arbustos), piedras (rocas), cuerda (lianas de la selva) y chatarra, cuerda, vendas y botella en los restos del avión. Los recursos se regeneran con el tiempo.
- **Agua**: bebe en el lago. El mar no se bebe, pero con lanza puedes pescar.
- **Fauna**: los jabalíes te embisten. Con lanza puedes cazarlos y asar la carne.
- **Día y noche**: de noche hace frío; una fogata te da calor y permite asar comida, y en el refugio puedes dormir hasta el amanecer.
- **Creación**: hacha de piedra, lanza, fogata, refugio y balsa. Las construcciones se colocan delante del personaje.
- **Objetivo**: reúne 12 madera, 5 cuerda, 3 hojas y 2 de chatarra, construye la balsa desde la playa mirando al mar y súbete para escapar.
