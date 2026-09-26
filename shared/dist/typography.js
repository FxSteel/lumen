"use strict";
/**
 * NOVA · Motor de resolución tipográfica (fidelidad compartida)
 * ─────────────────────────────────────────────────────────────
 * UNA sola función resuelve la tipografía: web y shell nativo la usan igual.
 * Aquí se arreglan de raíz las quejas: color, fuente y transición que "se perdían".
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TYPOGRAPHY = exports.SUPPORTED_FONTS = exports.NOVA_REFERENCE_WIDTH = void 0;
exports.resolveTypography = resolveTypography;
exports.novaSizeToVw = novaSizeToVw;
exports.transitionDurationMs = transitionDurationMs;
const contract_1 = require("./contract");
/** Ancho de referencia (px) en el que se expresan las "unidades Nova". */
exports.NOVA_REFERENCE_WIDTH = 1920;
/** Familias soportadas → fuentes que DEBEN estar empaquetadas en ambos lados. */
exports.SUPPORTED_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Roboto Flex', 'Open Sans'];
/** Look base MVP — se usa cuando el slide no trae un valor. */
exports.DEFAULT_TYPOGRAPHY = {
    fontFamily: 'Inter',
    fontSize: 100,
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: 0,
    color: '#FFFFFF',
    textShadow: null,
    textTransform: 'none',
    textAlign: 'center',
};
function clamp(n, lo, hi) {
    return Math.min(Math.max(n, lo), hi);
}
function normalizeFontFamily(family) {
    if (!family)
        return exports.DEFAULT_TYPOGRAPHY.fontFamily;
    const match = exports.SUPPORTED_FONTS.find((f) => f.toLowerCase() === family.trim().toLowerCase());
    return match ?? exports.DEFAULT_TYPOGRAPHY.fontFamily;
}
/**
 * Fusiona la tipografía del slide sobre los defaults y sanea/limita cada valor.
 * Devuelve SIEMPRE un Typography completo — nada queda sin definir, así que
 * ningún renderer tiene excusa para "olvidar" el color o la fuente.
 */
function resolveTypography(input) {
    const t = input ?? {};
    return {
        fontFamily: normalizeFontFamily(t.fontFamily),
        fontSize: typeof t.fontSize === 'number' && isFinite(t.fontSize) ? clamp(t.fontSize, 12, 400) : exports.DEFAULT_TYPOGRAPHY.fontSize,
        fontWeight: typeof t.fontWeight === 'number' && isFinite(t.fontWeight) ? clamp(Math.round(t.fontWeight), 100, 900) : exports.DEFAULT_TYPOGRAPHY.fontWeight,
        lineHeight: typeof t.lineHeight === 'number' && isFinite(t.lineHeight) ? clamp(t.lineHeight, 0.8, 3) : exports.DEFAULT_TYPOGRAPHY.lineHeight,
        letterSpacing: typeof t.letterSpacing === 'number' && isFinite(t.letterSpacing) ? clamp(t.letterSpacing, -10, 30) : exports.DEFAULT_TYPOGRAPHY.letterSpacing,
        color: typeof t.color === 'string' && t.color.trim() ? t.color.trim() : exports.DEFAULT_TYPOGRAPHY.color,
        textShadow: t.textShadow === undefined ? exports.DEFAULT_TYPOGRAPHY.textShadow : t.textShadow,
        textTransform: t.textTransform ?? exports.DEFAULT_TYPOGRAPHY.textTransform,
        textAlign: t.textAlign ?? exports.DEFAULT_TYPOGRAPHY.textAlign,
    };
}
/**
 * Convierte "unidades Nova" (px de referencia a 1920 de ancho) a vw.
 * Única fórmula de escala — web y nativo deben usar ESTA, no una propia.
 */
function novaSizeToVw(sizeNovaPx) {
    return sizeNovaPx / (exports.NOVA_REFERENCE_WIDTH / 100);
}
/** ms de una transición — lee la tabla única (no la duplica). */
function transitionDurationMs(t) {
    return contract_1.TRANSITION_MS[t ?? 'none'];
}
