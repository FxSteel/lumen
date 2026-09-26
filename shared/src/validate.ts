/**
 * NOVA · Validadores de runtime para el protocolo PLANO (sin dependencias externas)
 * ────────────────────────────────────────────────────────────────────────────────
 * Estos guards permiten que el servidor WebSocket valide EN LA FRONTERA lo que llega
 * del cable (JSON ya parseado) sin lanzar excepciones. Si algo está malformado,
 * `parse*` devuelve null y el llamador descarta el mensaje.
 *
 * Regla: se guardan `type` y los campos REQUERIDOS de cada variante. Los campos
 * opcionales se dejan pasar tal cual (el motor de fidelidad ya sanea tipografía, etc.).
 */

import type { ClientMessage, ServerMessage } from './protocol';
import type {
  OutputRole, SlideData, SlideType, NdiOutput, DisplayScreen,
  BackgroundType, MediaType,
} from './contract';

// ─── Helpers primitivos ────────────────────────────────────────────────────────

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function isString(x: unknown): x is string {
  return typeof x === 'string';
}
function isNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}
function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}

const OUTPUT_ROLES: readonly OutputRole[] = ['main', 'stage', 'ndi'];
function isOutputRole(x: unknown): x is OutputRole {
  return isString(x) && (OUTPUT_ROLES as readonly string[]).includes(x);
}

const SLIDE_TYPES: readonly SlideType[] = [
  'verse', 'chorus', 'bridge', 'prechorus', 'tag',
  'intro', 'outro', 'ending', 'other', 'bible_verse',
];
function isSlideType(x: unknown): x is SlideType {
  return isString(x) && (SLIDE_TYPES as readonly string[]).includes(x);
}

const BACKGROUND_TYPES: readonly BackgroundType[] = ['none', 'image', 'video'];
function isBackgroundType(x: unknown): x is BackgroundType {
  return isString(x) && (BACKGROUND_TYPES as readonly string[]).includes(x);
}

const MEDIA_TYPES: readonly MediaType[] = ['image', 'video'];
function isMediaType(x: unknown): x is MediaType {
  return isString(x) && (MEDIA_TYPES as readonly string[]).includes(x);
}

/**
 * SlideData mínima: solo se exige un `type` válido; el resto de campos son
 * opcionales y los sanea el motor de tipografía en el renderer.
 */
function isSlideData(x: unknown): x is SlideData {
  return isObject(x) && isSlideType(x.type);
}

function isNdiOutput(x: unknown): x is NdiOutput {
  return isObject(x)
    && isString(x.id)
    && isString(x.name)
    && isBoolean(x.sendLyrics)
    && isBoolean(x.sendBackground)
    && isBoolean(x.sendLogo);
}

function isDisplayScreen(x: unknown): x is DisplayScreen {
  return isObject(x)
    && isString(x.id)
    && isString(x.name)
    && isNumber(x.width)
    && isNumber(x.height)
    && isBoolean(x.isPrimary);
}

// ─── ClientMessage ───────────────────────────────────────────────────────────

const DISPLAY_MODES: readonly string[] = ['slide', 'clear', 'logo', 'announcement'];

/** Narrows a parsed value to the FLAT ClientMessage union. No lanza. */
export function isClientMessage(x: unknown): x is ClientMessage {
  if (!isObject(x) || !isString(x.type)) return false;
  switch (x.type) {
    case 'hello':
      return isNumber(x.protocolVersion);
    case 'get-screens':
      return true;
    case 'display-slide':
      return isOutputRole(x.screen) && isSlideData(x.slide);
    case 'display-mode':
      return isString(x.mode) && DISPLAY_MODES.includes(x.mode)
        && (x.logoUrl === undefined || isString(x.logoUrl))
        && (x.announcementUrl === undefined || isString(x.announcementUrl));
    case 'song-background':
      return isBackgroundType(x.backgroundType)
        && (x.backgroundUrl === null || isString(x.backgroundUrl));
    case 'display-media':
      return isMediaType(x.mediaType) && isString(x.url);
    case 'preload-media':
      return isMediaType(x.mediaType) && isString(x.url);
    case 'stage-time':
      return isString(x.time);
    case 'stage-message':
      return isString(x.message);
    case 'stage-config':
      return isBoolean(x.showTime) && isBoolean(x.showMessage);
    case 'ndi-config':
      return Array.isArray(x.outputs) && x.outputs.every(isNdiOutput);
    case 'assign-screen':
      return isString(x.screenId) && isOutputRole(x.role);
    case 'close-screen':
      return isString(x.screenId);
    case 'ping':
      return isNumber(x.t);
    case 'pong':
      return isNumber(x.t);
    default:
      return false;
  }
}

/** Devuelve el mensaje si es válido, o null ante cualquier cosa malformada. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  return isClientMessage(raw) ? raw : null;
}

// ─── ServerMessage ───────────────────────────────────────────────────────────

function isServerCapabilities(x: unknown): boolean {
  return isObject(x) && isString(x.version) && isBoolean(x.ndiAvailable);
}

function isNativeState(x: unknown): boolean {
  return isServerCapabilities(x)
    && isObject(x)
    && Array.isArray((x as Record<string, unknown>).screens)
    && ((x as Record<string, unknown>).screens as unknown[]).every(isDisplayScreen);
}

/** Narrows a parsed value to the ServerMessage union. No lanza. */
export function isServerMessage(x: unknown): x is ServerMessage {
  if (!isObject(x) || !isString(x.type)) return false;
  switch (x.type) {
    case 'hello-ack':
      return isNumber(x.protocolVersion) && isServerCapabilities(x.capabilities);
    case 'screens-detected':
      return isObject(x.payload)
        && Array.isArray(x.payload.screens)
        && (x.payload.screens as unknown[]).every(isDisplayScreen);
    case 'screen-assignment-confirmed':
      return isString(x.screenId) && isOutputRole(x.role);
    case 'state':
      return isNativeState(x.payload);
    case 'pong':
      return isNumber(x.t);
    default:
      return false;
  }
}

/** Devuelve el mensaje si es válido, o null ante cualquier cosa malformada. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  return isServerMessage(raw) ? raw : null;
}
