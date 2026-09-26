import { WebSocketServer, WebSocket } from "ws";
import { screen as electronScreen } from "electron";
import type { SlideData, DisplayMode, SongBackground, DisplayMedia, StageTime, StageMessage, StageConfig } from "../shared/display";
import { PROTOCOL_VERSION } from "@lumen/shared";
import type { ServerCapabilities, NativeState, DisplayScreen } from "@lumen/shared";

export interface ScreenAssignment {
  screenId: string;
  role: string;
}

/** Socket con la marca del heartbeat (patrón isAlive/pong de `ws`). */
type HeartbeatSocket = WebSocket & { isAlive?: boolean };

/** Cada cuánto se hace ping a los clientes conectados. */
const HEARTBEAT_INTERVAL_MS = 15_000;

let wss: WebSocketServer | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

let onSlideCallback: ((slide: SlideData, role: string) => void) | null = null;
let onAssignScreenCallback: ((assignment: ScreenAssignment, respond: () => void) => void) | null = null;
let onDisplayModeCallback: ((mode: DisplayMode) => void) | null = null;
let onSongBackgroundCallback: ((bg: SongBackground) => void) | null = null;
let onNdiConfigCallback: ((outputs: unknown[]) => void) | null = null;
let onStageTimeCallback: ((data: StageTime) => void) | null = null;
let onStageMessageCallback: ((data: StageMessage) => void) | null = null;
let onDisplayMediaCallback: ((media: DisplayMedia) => void) | null = null;
let onPreloadMediaCallback: ((media: DisplayMedia) => void) | null = null;
let onStageConfigCallback: ((data: StageConfig) => void) | null = null;
let onCloseScreenCallback: ((screenId: string) => void) | null = null;
let getCapabilitiesCallback: (() => ServerCapabilities) | null = null;
let onErrorCallback: ((err: NodeJS.ErrnoException) => void) | null = null;

function buildScreens(): DisplayScreen[] {
  const primaryId = electronScreen.getPrimaryDisplay().id;
  return electronScreen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    name: `Display ${i + 1}${d.id === primaryId ? " (Primary)" : ""}`,
    width: d.size.width,
    height: d.size.height,
    isPrimary: d.id === primaryId
  }));
}

function buildScreensMessage() {
  return JSON.stringify({ type: "screens-detected", payload: { screens: buildScreens() } });
}

/** Estado nativo completo: capacidades reportadas por main.ts + pantallas actuales. */
function buildStateMessage(): string | null {
  if (!getCapabilitiesCallback) return null;
  const caps = getCapabilitiesCallback();
  const state: NativeState = { ...caps, screens: buildScreens() };
  return JSON.stringify({ type: "state", payload: state });
}

function broadcast(msg: string) {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

/** Difunde el estado nativo a todos los clientes (si hay capacidades disponibles). */
function broadcastState() {
  const msg = buildStateMessage();
  if (msg) broadcast(msg);
}

/** Guarda de forma: objeto con `type` string. Todo lo demás se ignora. */
function isValidMessage(msg: unknown): msg is Record<string, unknown> & { type: string } {
  return typeof msg === "object" && msg !== null && typeof (msg as Record<string, unknown>).type === "string";
}

export function startWsServer(
  onSlide: (slide: SlideData, role: string) => void,
  onAssignScreen: (assignment: ScreenAssignment, respond: () => void) => void,
  onDisplayMode: (mode: DisplayMode) => void,
  onSongBackground: (bg: SongBackground) => void,
  onNdiConfig: (outputs: unknown[]) => void,
  onStageTime: (data: StageTime) => void,
  onStageMessage: (data: StageMessage) => void,
  onStageConfig: (data: StageConfig) => void,
  onDisplayMedia: (media: DisplayMedia) => void,
  onPreloadMedia: (media: DisplayMedia) => void,
  onCloseScreen: (screenId: string) => void,
  getCapabilities: () => ServerCapabilities,
  onError: (err: NodeJS.ErrnoException) => void
) {
  onSlideCallback = onSlide;
  onAssignScreenCallback = onAssignScreen;
  onDisplayModeCallback = onDisplayMode;
  onSongBackgroundCallback = onSongBackground;
  onNdiConfigCallback = onNdiConfig;
  onStageTimeCallback = onStageTime;
  onStageMessageCallback = onStageMessage;
  onStageConfigCallback = onStageConfig;
  onDisplayMediaCallback = onDisplayMedia;
  onPreloadMediaCallback = onPreloadMedia;
  onCloseScreenCallback = onCloseScreen;
  getCapabilitiesCallback = getCapabilities;
  onErrorCallback = onError;

  wss = new WebSocketServer({ host: "127.0.0.1", port: 9877 });

  wss.on("connection", (ws) => {
    console.log("[WS] Client connected");

    // ── Heartbeat: marcar vivo y refrescar en cada pong del cliente ──
    const socket = ws as HeartbeatSocket;
    socket.isAlive = true;
    ws.on("pong", () => { socket.isAlive = true; });

    ws.send(buildScreensMessage());
    const stateMsg = buildStateMessage();
    if (stateMsg) ws.send(stateMsg);

    ws.on("message", (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch (err) {
        console.warn("[WS] Ignoring non-JSON message:", (err as Error).message);
        return;
      }

      if (!isValidMessage(parsed)) {
        console.warn("[WS] Ignoring malformed message (missing string `type`)");
        return;
      }

      const msg = parsed;

      try {
        console.log("[WS] Received:", msg.type, JSON.stringify(msg));

        if (msg.type === "hello") {
          const caps = getCapabilitiesCallback?.() ?? { version: "unknown", ndiAvailable: false };
          ws.send(JSON.stringify({ type: "hello-ack", protocolVersion: PROTOCOL_VERSION, capabilities: caps }));

        } else if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", t: typeof msg.t === "number" ? msg.t : Date.now() }));

        } else if (msg.type === "get-screens") {
          ws.send(buildScreensMessage());
          const s = buildStateMessage();
          if (s) ws.send(s);

        } else if (msg.type === "display-slide") {
          const slide = msg.slide as SlideData;
          const role = (msg.screen as string) ?? "main";
          console.log(`[WS] display-slide → role="${role}" content="${slide?.content?.slice(0, 50)}"`);
          onSlideCallback?.(slide, role);

        } else if (msg.type === "display-mode") {
          console.log(`[WS] display-mode → mode="${msg.mode as string}"`);
          onDisplayModeCallback?.(msg as unknown as DisplayMode);

        } else if (msg.type === "song-background") {
          console.log(`[WS] song-background → type="${msg.backgroundType as string}"`);
          onSongBackgroundCallback?.(msg as unknown as SongBackground);

        } else if (msg.type === "ndi-config") {
          const outputs = (msg.outputs as unknown[]) ?? [];
          console.log(`[WS] ndi-config → ${outputs.length} output(s)`);
          onNdiConfigCallback?.(outputs);

        } else if (msg.type === "stage-time") {
          onStageTimeCallback?.({ time: msg.time as string });

        } else if (msg.type === "stage-message") {
          onStageMessageCallback?.({ message: msg.message as string });

        } else if (msg.type === "stage-config") {
          onStageConfigCallback?.({
            showTime:    msg.showTime    as boolean,
            showMessage: msg.showMessage as boolean,
          });

        } else if (msg.type === "preload-media") {
          const mediaType = msg.mediaType as "image" | "video";
          const url = msg.url as string;
          console.log(`[WS] preload-media → mediaType="${mediaType}" url="${url}"`);
          onPreloadMediaCallback?.({ mediaType, url });

        } else if (msg.type === "display-media") {
          const mediaType = msg.mediaType as "image" | "video";
          const url = msg.url as string;
          console.log(`[WS] display-media → mediaType="${mediaType}" url="${url}"`);
          onDisplayMediaCallback?.({ mediaType, url });

        } else if (msg.type === "assign-screen") {
          const screenId = msg.screenId as string;
          const role = msg.role as string;
          console.log(`[WS] assign-screen → screenId="${screenId}" role="${role}"`);
          onAssignScreenCallback?.({ screenId, role }, () => {
            ws.send(JSON.stringify({ type: "screen-assignment-confirmed", screenId, role }));
          });

        } else if (msg.type === "close-screen") {
          const screenId = msg.screenId as string;
          console.log(`[WS] close-screen → screenId="${screenId}"`);
          onCloseScreenCallback?.(screenId);

        } else {
          console.warn(`[WS] Unknown message type — ignored: "${msg.type}"`);
        }
      } catch (err) {
        // Nunca propagar: un mensaje malo no debe tumbar la conexión ni el proceso.
        console.error("[WS] Error handling message:", (err as Error).message);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Client disconnected — kiosk state preserved");
      // No resetear estado: el renderer mantiene el último slide visible
    });

    ws.on("error", (err) => {
      console.error("[WS] Client error:", err.message);
      // No crashear — la conexión se cerrará sola
    });
  });

  // ── Heartbeat global: pingear clientes y terminar los que no responden ──
  heartbeatTimer = setInterval(() => {
    wss?.clients.forEach((client) => {
      const socket = client as HeartbeatSocket;
      if (socket.isAlive === false) {
        console.warn("[WS] Terminating unresponsive client (no pong)");
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch {
        // ignore — un fallo de ping no debe romper el ciclo
      }
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  wss.on("error", (err: NodeJS.ErrnoException) => {
    console.error("[WS] Server error:", err.message);
    onErrorCallback?.(err);
  });

  electronScreen.on("display-added", () => { broadcast(buildScreensMessage()); broadcastState(); });
  electronScreen.on("display-removed", () => { broadcast(buildScreensMessage()); broadcastState(); });
  electronScreen.on("display-metrics-changed", () => { broadcast(buildScreensMessage()); broadcastState(); });

  console.log("[WS] Server started on ws://127.0.0.1:9877");
}

export function stopWsServer() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (wss) {
    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {
        // ignore
      }
    });
    wss.close();
  }
  wss = null;
}
