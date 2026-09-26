# NOVA — Monorepo

Un solo repositorio para el sistema de proyección Nova. Objetivo: **un solo motor de
render y un solo contrato**, para que color, fuente, tamaño y transición se respeten
igual en todas las salidas y no vuelva a haber "drift" entre proyectos separados.

## Estructura

```
nova/
├─ web/       Next.js — consola del operador + vistas de salida (/live-output/main, /stage, /ndi).
│             ES EL ÚNICO renderer. Aquí se decide cómo se ve todo.
├─ desktop/   Electron — SHELL (sin FE de operador). Sus únicos trabajos:
│               · abrir ventanas kiosk REALES (kiosk:true, sin cromo) en los monitores
│               · recibir la info por WebSocket (puerto 9877)
│               · emitir NDI capturando offscreen la vista /ndi de web/ (un solo renderer)
└─ shared/    Contrato ÚNICO: tipos, protocolo WS versionado y motor de tipografía.
              Lo importan web/ y desktop/. Ninguno redefine estas primitivas.
```

## Por qué existe el shell nativo (y no basta el navegador)

Un navegador **no puede**: (1) hacer kiosk real —una pestaña a fullscreen sigue mostrando
la barra y no bloquea la pantalla—, ni (2) emitir NDI. Ambas cosas requieren un runtime
nativo. Por eso `desktop/` es una app instalable, pero **sin interfaz de operador**: solo
muestra las vistas que sirve `web/`.

## Estado de la migración

Este monorepo se está armando de forma **no destructiva**. Los repos originales
(`mandarin` y `display-nova`) siguen intactos como respaldo hasta que `nova/` sea la
fuente de verdad. Primera pieza lista: `shared/` (contrato).

## Contrato compartido (`shared/`)

- `contract.ts` — tipos de datos: `Typography` (con color, fontFamily, textShadow, textTransform),
  `SlideData`, roles (`main`/`stage`/`ndi`), modos, fondos, media, NDI, pantallas.
- `protocol.ts` — mensajes WS tipados y `PROTOCOL_VERSION`; handshake `hello`.
- `typography.ts` — `resolveTypography()` (defaults + saneo) y la fórmula única de escala.
  Es lo que arregla de raíz que "el color/la fuente se perdían".
