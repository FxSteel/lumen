/**
 * Lumen · Protocolo WebSocket web ↔ shell nativo (puerto 9877)
 * ───────────────────────────────────────────────────────────
 * Mensajes tipados y versionados. Un cambio incompatible sube PROTOCOL_VERSION.
 * El handshake `hello` deja que ambos lados negocien versión y capacidades.
 */
import type { OutputRole, SlideData, NdiOutput, DisplayScreen, BackgroundType, MediaType } from './contract';
/** Sube este número ante cualquier cambio incompatible del protocolo. */
export declare const PROTOCOL_VERSION = 1;
/** Puerto del servidor WebSocket local que expone el shell nativo. */
export declare const WS_PORT = 9877;
export type ClientMessage = {
    type: 'hello';
    protocolVersion: number;
} | {
    type: 'get-screens';
} | {
    type: 'display-slide';
    screen: OutputRole;
    slide: SlideData;
} | {
    type: 'display-mode';
    mode: 'slide' | 'clear' | 'logo' | 'announcement';
    logoUrl?: string;
    announcementUrl?: string;
} | {
    type: 'song-background';
    backgroundType: BackgroundType;
    backgroundUrl: string | null;
} | {
    type: 'display-media';
    mediaType: MediaType;
    url: string;
} | {
    type: 'preload-media';
    mediaType: MediaType;
    url: string;
} | {
    type: 'stage-time';
    time: string;
} | {
    type: 'stage-message';
    message: string;
} | {
    type: 'stage-config';
    showTime: boolean;
    showMessage: boolean;
} | {
    type: 'ndi-config';
    outputs: NdiOutput[];
} | {
    type: 'assign-screen';
    screenId: string;
    role: OutputRole;
} | {
    type: 'close-screen';
    screenId: string;
} | {
    type: 'ping';
    t: number;
} | {
    type: 'pong';
    t: number;
};
export type ServerMessage = {
    type: 'hello-ack';
    protocolVersion: number;
    capabilities: ServerCapabilities;
} | {
    type: 'screens-detected';
    payload: {
        screens: DisplayScreen[];
    };
} | {
    type: 'screen-assignment-confirmed';
    screenId: string;
    role: OutputRole;
} | {
    type: 'state';
    payload: NativeState;
} | {
    type: 'pong';
    t: number;
};
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
