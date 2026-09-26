/**
 * Lumen · Motor de resolución tipográfica (fidelidad compartida)
 * ─────────────────────────────────────────────────────────────
 * UNA sola función resuelve la tipografía: web y shell nativo la usan igual.
 * Aquí se arreglan de raíz las quejas: color, fuente y transición que "se perdían".
 */
import type { Typography, TransitionType } from './contract';
/** Ancho de referencia (px) en el que se expresan las "unidades Lumen". */
export declare const LUMEN_REFERENCE_WIDTH = 1920;
/** Familias soportadas → fuentes que DEBEN estar empaquetadas en ambos lados. */
export declare const SUPPORTED_FONTS: readonly ["Inter", "Poppins", "Montserrat", "Roboto Flex", "Open Sans"];
export type SupportedFont = typeof SUPPORTED_FONTS[number];
/** Look base MVP — se usa cuando el slide no trae un valor. */
export declare const DEFAULT_TYPOGRAPHY: Typography;
/**
 * Fusiona la tipografía del slide sobre los defaults y sanea/limita cada valor.
 * Devuelve SIEMPRE un Typography completo — nada queda sin definir, así que
 * ningún renderer tiene excusa para "olvidar" el color o la fuente.
 */
export declare function resolveTypography(input?: Partial<Typography> | null): Typography;
/**
 * Convierte "unidades Lumen" (px de referencia a 1920 de ancho) a vw.
 * Única fórmula de escala — web y nativo deben usar ESTA, no una propia.
 */
export declare function lumenSizeToVw(sizeLumenPx: number): number;
/** ms de una transición — lee la tabla única (no la duplica). */
export declare function transitionDurationMs(t: TransitionType | undefined): number;
