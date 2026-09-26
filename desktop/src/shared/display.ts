/**
 * Lumen · Contrato de display del shell nativo (desktop/).
 * ───────────────────────────────────────────────────────
 * Fuente ÚNICA de verdad: se re-exporta desde `@lumen/shared` para que la web
 * (mandarin → web/) y el shell nativo (desktop/) compartan EXACTAMENTE las
 * mismas primitivas de fidelidad (color, fuente, tamaño, peso, tracking,
 * sombra, transform, transición) y la misma tabla de transiciones.
 *
 * Backward-compat: se conservan los nombres que el resto de la app ya
 * importaba desde "@shared/display".
 *   • Los que existen en @lumen/shared se re-exportan tal cual.
 *   • Los que NO existen allí (DisplayInfo/DisplayBounds/DisplaySize —
 *     específicos de Electron.screen) se mantienen definidos aquí.
 *   • SlideData se re-exporta AMPLIADO con campos legacy opcionales para no
 *     romper consumidores que todavía leen `songTypography`/`fontSize`/etc.
 *     (p. ej. el render NDI). El formato canónico es `typography` + `transition`.
 */

// ─── Re-export de tipos del contrato compartido ────────────────────────────────
export type {
  Typography,
  TransitionType,
  SlideType,
  TextAlign,
  TextTransform,
  OutputRole,
  DisplayMode,
  BackgroundType,
  SongBackground,
  MediaType,
  DisplayMedia,
  StageTime,
  StageMessage,
  StageConfig,
  NdiOutput,
  DisplayScreen,
  ScreenAssignment,
  SupportedFont,
} from "@lumen/shared";

// ─── Re-export de valores/funciones del motor compartido ────────────────────────
export {
  resolveTypography,
  lumenSizeToVw,
  transitionDurationMs,
  DEFAULT_TYPOGRAPHY,
  SUPPORTED_FONTS,
  LUMEN_REFERENCE_WIDTH,
  TRANSITION_MS,
} from "@lumen/shared";

import type { SlideData as SharedSlideData, Typography } from "@lumen/shared";

/**
 * Tipografía legacy del slide (formato previo a @lumen/shared). Se mantiene sólo
 * por backward-compat con consumidores que aún leen `slide.songTypography`.
 * El formato canónico es `typography: Partial<Typography>` (ver SlideData).
 */
export interface SlideTypography {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: number;
}

/**
 * SlideData canónico = el de @lumen/shared (type, content, label, typography,
 * transition, contentPadding, campos de versículo…) AMPLIADO con campos legacy
 * opcionales. Los campos legacy no afectan a quien lee el formato nuevo, y
 * permiten que ficheros aún no migrados (NDI) sigan compilando.
 */
export interface SlideData extends SharedSlideData {
  // ── Legacy opcionales (pre-@lumen/shared) ──
  reference?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  songTypography?: Partial<SlideTypography> | null;
}

// ─── Tipos específicos de Electron.screen (NO existen en @lumen/shared) ──────────
export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplaySize {
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  bounds: DisplayBounds;
  size: DisplaySize;
  scaleFactor: number;
  isPrimary: boolean;
}
