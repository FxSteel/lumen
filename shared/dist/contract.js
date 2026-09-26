"use strict";
/**
 * Lumen · Contrato compartido web ↔ shell nativo
 * ─────────────────────────────────────────────
 * Fuente ÚNICA de verdad de qué se envía y cómo se debe pintar.
 * Lo importan tanto la web (mandarin → web/) como el shell nativo (display-lumen → desktop/).
 *
 * Regla: las "primitivas de fidelidad" (color, fuente, tamaño, peso, tracking,
 * sombra, transform, transición) viven AQUÍ y se aplican con UN solo motor.
 * Cada rol (main/stage/ndi) compone su propia vista, pero NO reinterpreta estas primitivas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSITION_MS = void 0;
/** Duración en ms de cada transición. Única tabla, compartida por todos los renderers. */
exports.TRANSITION_MS = {
    'none': 0,
    'fade': 400,
    'fade-slow': 800,
};
