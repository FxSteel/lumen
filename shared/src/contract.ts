/**
 * NOVA · Contrato compartido web ↔ shell nativo
 * ─────────────────────────────────────────────
 * Fuente ÚNICA de verdad de qué se envía y cómo se debe pintar.
 * Lo importan tanto la web (mandarin → web/) como el shell nativo (display-nova → desktop/).
 *
 * Regla: las "primitivas de fidelidad" (color, fuente, tamaño, peso, tracking,
 * sombra, transform, transición) viven AQUÍ y se aplican con UN solo motor.
 * Cada rol (main/stage/ndi) compone su propia vista, pero NO reinterpreta estas primitivas.
 */

// ─── Roles de salida ──────────────────────────────────────────────────────────
/** A qué destino va una vista. Cada uno compone distinto, misma fidelidad. */
export type OutputRole = 'main' | 'stage' | 'ndi';

// ─── Tipos de diapositiva ───────────────────────────────────────────────────────
export type SlideType =
  | 'verse' | 'chorus' | 'bridge' | 'prechorus' | 'tag'
  | 'intro' | 'outro' | 'ending' | 'other'
  | 'bible_verse';

// ─── Transiciones ────────────────────────────────────────────────────────────
export type TransitionType = 'none' | 'fade' | 'fade-slow';

/** Duración en ms de cada transición. Única tabla, compartida por todos los renderers. */
export const TRANSITION_MS: Record<TransitionType, number> = {
  'none': 0,
  'fade': 400,
  'fade-slow': 800,
};

export type TextAlign = 'left' | 'center' | 'right';
export type TextTransform = 'none' | 'uppercase' | 'lowercase';

// ─── Tipografía (las primitivas de fidelidad) ─────────────────────────────────
/**
 * Todos los campos que definen CÓMO se ve el texto. Lo que antes se perdía
 * (color, fontFamily, textShadow, textTransform) ahora es parte explícita del contrato.
 */
export interface Typography {
  /** Familia lógica (ej. "Inter", "Poppins"). El renderer la resuelve a una fuente empaquetada. */
  fontFamily?: string;
  /** Tamaño base en "unidades Nova" (px de referencia a 1920 de ancho). */
  fontSize: number;
  /** 100–900. */
  fontWeight: number;
  lineHeight: number;
  /** px. */
  letterSpacing: number;
  /** Color CSS del texto (ej. "#FFFFFF"). */
  color: string;
  /** Sombra CSS del texto, o null. */
  textShadow?: string | null;
  textTransform?: TextTransform;
  textAlign?: TextAlign;
}

// ─── Diapositiva ─────────────────────────────────────────────────────────────
export interface SlideData {
  type: SlideType;
  /** Contenido de letra (líneas separadas por \n). */
  content?: string;
  /** Etiqueta corta (ej. "Coro", o la referencia bíblica). */
  label?: string;
  /** Tipografía completa. Si falta, el renderer aplica DEFAULT_TYPOGRAPHY. */
  typography?: Partial<Typography> | null;
  /** Transición con la que debe entrar esta diapositiva. */
  transition?: TransitionType;
  /** Padding de contenido en unidades Nova. */
  contentPadding?: number;

  // Campos específicos de versículo bíblico
  verseText?: string;
  displayReference?: string;
  bibleVersionName?: string;
  bibleVersionAbbreviation?: string;
  projectedReferenceLabel?: string;
}

// ─── Modo de salida ────────────────────────────────────────────────────────────
export type DisplayMode =
  | { mode: 'slide' }
  | { mode: 'clear' }
  | { mode: 'logo'; logoUrl: string }
  | { mode: 'announcement'; announcementUrl: string };

// ─── Fondo / media ─────────────────────────────────────────────────────────────
export type BackgroundType = 'none' | 'image' | 'video';

export interface SongBackground {
  backgroundType: BackgroundType;
  backgroundUrl: string | null;
}

export type MediaType = 'image' | 'video';

export interface DisplayMedia {
  mediaType: MediaType;
  url: string;
}

// ─── Escenario ───────────────────────────────────────────────────────────────
export interface StageTime { time: string; }
export interface StageMessage { message: string; }
export interface StageConfig { showTime: boolean; showMessage: boolean; }

// ─── NDI ─────────────────────────────────────────────────────────────────────
export interface NdiOutput {
  id: string;
  name: string;
  sendLyrics: boolean;
  sendBackground: boolean;
  sendLogo: boolean;
}

// ─── Pantallas ─────────────────────────────────────────────────────────────────
export interface DisplayScreen {
  id: string;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface ScreenAssignment {
  screenId: string;
  role: OutputRole;
}
