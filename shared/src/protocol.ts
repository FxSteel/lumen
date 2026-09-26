/**
 * NOVA · Protocolo WebSocket web ↔ shell nativo (puerto 9877)
 * ───────────────────────────────────────────────────────────
 * Mensajes tipados y versionados. Un cambio incompatible sube PROTOCOL_VERSION.
 * El handshake `hello` deja que ambos lados negocien versión y capacidades.
 */

import type {
  OutputRole, SlideData, DisplayMode, SongBackground, DisplayMedia,
  StageTime, StageMessage, StageConfig, NdiOutput, DisplayScreen, ScreenAssignment,
} from './contract';

/** Sube este número ante cualquier cambio incompatible del protocolo. */
export const PROTOCOL_VERSION = 1;

/** Puerto del servidor WebSocket local que expone el shell nativo. */
export const WS_PORT = 9877;

// ─── Mensajes web → nativo ─────────────────────────────────────────────────────
export type ClientMessage =
  | { type: 'hello'; protocolVersion: number }
  | { type: 'get-screens' }
  | { type: 'display-slide'; role: OutputRole; slide: SlideData }
  | { type: 'display-mode'; payload: DisplayMode }
  | { type: 'song-background'; payload: SongBackground }
  | { type: 'display-media'; payload: DisplayMedia }
  | { type: 'preload-media'; payload: DisplayMedia }
  | { type: 'stage-time'; payload: StageTime }
  | { type: 'stage-message'; payload: StageMessage }
  | { type: 'stage-config'; payload: StageConfig }
  | { type: 'ndi-config'; outputs: NdiOutput[] }
  | { type: 'assign-screen'; payload: ScreenAssignment }
  | { type: 'close-screen'; screenId: string }
  | { type: 'ping'; t: number };

// ─── Mensajes nativo → web ─────────────────────────────────────────────────────
export type ServerMessage =
  | { type: 'hello-ack'; protocolVersion: number; capabilities: ServerCapabilities }
  | { type: 'screens-detected'; payload: { screens: DisplayScreen[] } }
  | { type: 'screen-assignment-confirmed'; screenId: string; role: OutputRole }
  | { type: 'state'; payload: NativeState }
  | { type: 'pong'; t: number };

/** Lo que el nativo reporta de sí mismo (para que el operador vea salud real en su UI). */
export interface ServerCapabilities {
  version: string;
  ndiAvailable: boolean;
}

export interface NativeState extends ServerCapabilities {
  screens: DisplayScreen[];
}

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
