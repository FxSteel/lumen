/**
 * NOVA · Motor de resolución tipográfica (fidelidad compartida)
 * ─────────────────────────────────────────────────────────────
 * UNA sola función resuelve la tipografía: web y shell nativo la usan igual.
 * Aquí se arreglan de raíz las quejas: color, fuente y transición que "se perdían".
 */

import type { Typography, TransitionType } from './contract';

/** Familias soportadas → fuentes que DEBEN estar empaquetadas en ambos lados. */
export const SUPPORTED_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Roboto Flex', 'Open Sans'] as const;
export type SupportedFont = typeof SUPPORTED_FONTS[number];

/** Look base MVP — se usa cuando el slide no trae un valor. */
export const DEFAULT_TYPOGRAPHY: Typography = {
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function normalizeFontFamily(family?: string): string {
  if (!family) return DEFAULT_TYPOGRAPHY.fontFamily!;
  const match = SUPPORTED_FONTS.find((f) => f.toLowerCase() === family.trim().toLowerCase());
  return match ?? DEFAULT_TYPOGRAPHY.fontFamily!;
}

/**
 * Fusiona la tipografía del slide sobre los defaults y sanea/limita cada valor.
 * Devuelve SIEMPRE un Typography completo — nada queda sin definir, así que
 * ningún renderer tiene excusa para "olvidar" el color o la fuente.
 */
export function resolveTypography(input?: Partial<Typography> | null): Typography {
  const t = input ?? {};
  return {
    fontFamily: normalizeFontFamily(t.fontFamily),
    fontSize: typeof t.fontSize === 'number' && isFinite(t.fontSize) ? clamp(t.fontSize, 12, 400) : DEFAULT_TYPOGRAPHY.fontSize,
    fontWeight: typeof t.fontWeight === 'number' && isFinite(t.fontWeight) ? clamp(Math.round(t.fontWeight), 100, 900) : DEFAULT_TYPOGRAPHY.fontWeight,
    lineHeight: typeof t.lineHeight === 'number' && isFinite(t.lineHeight) ? clamp(t.lineHeight, 0.8, 3) : DEFAULT_TYPOGRAPHY.lineHeight,
    letterSpacing: typeof t.letterSpacing === 'number' && isFinite(t.letterSpacing) ? clamp(t.letterSpacing, -10, 30) : DEFAULT_TYPOGRAPHY.letterSpacing,
    color: typeof t.color === 'string' && t.color.trim() ? t.color.trim() : DEFAULT_TYPOGRAPHY.color,
    textShadow: t.textShadow === undefined ? DEFAULT_TYPOGRAPHY.textShadow : t.textShadow,
    textTransform: t.textTransform ?? DEFAULT_TYPOGRAPHY.textTransform,
    textAlign: t.textAlign ?? DEFAULT_TYPOGRAPHY.textAlign,
  };
}

/**
 * Convierte "unidades Nova" (px de referencia a 1920 de ancho) a vw.
 * Única fórmula de escala — web y nativo deben usar ESTA, no una propia.
 */
export function novaSizeToVw(sizeNovaPx: number): number {
  return sizeNovaPx / 19.2;
}

/** ms de una transición, sin repetir la tabla en cada lado. */
export function transitionDurationMs(t: TransitionType | undefined): number {
  if (t === 'fade') return 400;
  if (t === 'fade-slow') return 800;
  return 0;
}
