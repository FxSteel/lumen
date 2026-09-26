/**
 * Lumen · Validadores de runtime para el protocolo PLANO (sin dependencias externas)
 * ────────────────────────────────────────────────────────────────────────────────
 * Estos guards permiten que el servidor WebSocket valide EN LA FRONTERA lo que llega
 * del cable (JSON ya parseado) sin lanzar excepciones. Si algo está malformado,
 * `parse*` devuelve null y el llamador descarta el mensaje.
 *
 * Regla: se guardan `type` y los campos REQUERIDOS de cada variante. Los campos
 * opcionales se dejan pasar tal cual (el motor de fidelidad ya sanea tipografía, etc.).
 */
import type { ClientMessage, ServerMessage } from './protocol';
/** Narrows a parsed value to the FLAT ClientMessage union. No lanza. */
export declare function isClientMessage(x: unknown): x is ClientMessage;
/** Devuelve el mensaje si es válido, o null ante cualquier cosa malformada. */
export declare function parseClientMessage(raw: unknown): ClientMessage | null;
/** Narrows a parsed value to the ServerMessage union. No lanza. */
export declare function isServerMessage(x: unknown): x is ServerMessage;
/** Devuelve el mensaje si es válido, o null ante cualquier cosa malformada. */
export declare function parseServerMessage(raw: unknown): ServerMessage | null;
