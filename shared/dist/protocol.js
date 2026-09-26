"use strict";
/**
 * NOVA · Protocolo WebSocket web ↔ shell nativo (puerto 9877)
 * ───────────────────────────────────────────────────────────
 * Mensajes tipados y versionados. Un cambio incompatible sube PROTOCOL_VERSION.
 * El handshake `hello` deja que ambos lados negocien versión y capacidades.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WS_PORT = exports.PROTOCOL_VERSION = void 0;
/** Sube este número ante cualquier cambio incompatible del protocolo. */
exports.PROTOCOL_VERSION = 1;
/** Puerto del servidor WebSocket local que expone el shell nativo. */
exports.WS_PORT = 9877;
