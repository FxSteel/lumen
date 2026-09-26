import path from "path";
import { app, BrowserWindow, Tray, Menu, nativeImage, screen as electronScreen, ipcMain } from "electron";
import { createSetupWindow, initWindowManager, openOutputWindowForRole, sendToOutputWindow, getRoleForWebContents, closeOutputWindowForScreen } from "./main/windowManager";
import { registerIpcHandlers } from "./main/ipc";
import { startWsServer, stopWsServer } from "./main/wsServer";
import * as assetCache from "./main/assetCache";
import type { SlideData, DisplayMode, SongBackground, DisplayMedia, StageTime, StageMessage, StageConfig } from "./shared/display";
import type { ScreenAssignment } from "./main/wsServer";
import type { ServerCapabilities } from "@lumen/shared";
import {
  handleNdiConfig,
  ndiHandleSlide,
  ndiHandleDisplayMode,
  ndiHandleBackground,
  destroyAllNdiSenders,
  isNdiAvailable,
} from "./main/ndiManager";
import type { NdiOutput } from "./main/ndiManager";

// Permitir autoplay con audio en todas las ventanas (requerido para multimedia)
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const isDev = !app.isPackaged;
const rendererDevServer = "http://localhost:5173";

let tray: Tray | null = null;

// Cache del último estado por rol
const lastSlide = new Map<string, SlideData>();
let lastBackground: SongBackground | null = null;
let lastMode: DisplayMode = { mode: "slide" };
let lastMedia: DisplayMedia | null = null;

function rendererUrl(screen?: "setup" | "output") {
  const base = isDev ? rendererDevServer : `file://${path.join(__dirname, "../renderer/index.html")}`;
  return screen === "output" ? `${base}?screen=output` : base;
}

function preloadUrl() {
  return path.join(__dirname, "./preload/preload.js");
}

function trayIconPath() {
  return isDev
    ? path.join(__dirname, "../../assets/lumen.png")
    : path.join(process.resourcesPath, "assets/lumen.png");
}

function createTray(preloadPath: string) {
  let icon: ReturnType<typeof nativeImage.createFromPath>;
  try {
    icon = nativeImage.createFromPath(trayIconPath()).resize({ width: 16, height: 16 });
  } catch {
    icon = nativeImage.createFromNamedImage("NSImageNameComputer", [16, 16]).resize({ width: 16, height: 16 });
  }
  tray = new Tray(icon);
  tray.setToolTip("Lumen Display");

  const menu = Menu.buildFromTemplate([
    { label: "Lumen Display", enabled: false },
    { type: "separator" },
    { label: "Abrir Setup", click: () => createSetupWindow(rendererUrl("setup"), preloadUrl()) },
    { type: "separator" },
    { label: "Salir", click: () => app.quit() }
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => createSetupWindow(rendererUrl("setup"), preloadUrl()));
}

function onSlide(slide: SlideData, role: string) {
  console.log(`[Main] Forwarding slide to role="${role}"`);
  lastSlide.set(role, slide);
  sendToOutputWindow(role, "lumen:slide", slide);
  ndiHandleSlide(slide);
}

function onAssignScreen(assignment: ScreenAssignment, respond: () => void) {
  const { screenId, role } = assignment;
  const display = electronScreen.getAllDisplays().find((d) => String(d.id) === screenId);

  if (!display) {
    console.warn(`[Main] Display "${screenId}" not found`);
    return;
  }

  const displayInfo = {
    id: display.id,
    bounds: display.bounds,
    size: display.size,
    scaleFactor: display.scaleFactor,
    isPrimary: display.id === electronScreen.getPrimaryDisplay().id
  };

  openOutputWindowForRole(displayInfo, role);
  respond();
}

function onSongBackground(bg: SongBackground) {
  console.log(`[Main] song-background → ${bg.backgroundType}`);
  lastBackground = bg;
  // LATENCY: calentar el fondo en disco antes de proyectar (fire-and-forget).
  if (bg.backgroundUrl) assetCache.prefetch(bg.backgroundUrl);
  sendToOutputWindow("main", "lumen:songBackground", bg);
  sendToOutputWindow("stage", "lumen:songBackground", bg);
  ndiHandleBackground(bg);
}

function onDisplayMode(displayMode: DisplayMode) {
  console.log(`[Main] display-mode → ${displayMode.mode}`);
  lastMode = displayMode;
  sendToOutputWindow("main", "lumen:displayMode", displayMode);
  sendToOutputWindow("stage", "lumen:displayMode", displayMode);
  ndiHandleDisplayMode(displayMode);
}

function onNdiConfig(outputs: unknown[]) {
  handleNdiConfig(outputs as NdiOutput[]);
}

function onStageTime(data: StageTime) {
  sendToOutputWindow("stage", "lumen:stageTime", data);
}

function onStageMessage(data: StageMessage) {
  sendToOutputWindow("stage", "lumen:stageMessage", data);
}

function onStageConfig(data: StageConfig) {
  sendToOutputWindow("stage", "lumen:stageConfig", data);
}

function onDisplayMedia(media: DisplayMedia) {
  console.log(`[Main] display-media → ${media.mediaType} ${media.url}`);
  lastMedia = media;
  sendToOutputWindow("main", "lumen:displayMedia", media);
}

function onPreloadMedia(media: DisplayMedia) {
  console.log(`[Main] preload-media → ${media.mediaType} ${media.url}`);
  // LATENCY: calentar la media en disco antes de proyectar (fire-and-forget).
  if (media.url) assetCache.prefetch(media.url);
  sendToOutputWindow("main", "lumen:preloadMedia", media);
}

function onCloseScreen(screenId: string) {
  console.log(`[Main] close-screen → screenId="${screenId}"`);
  const closed = closeOutputWindowForScreen(screenId);
  if (!closed) {
    console.warn(`[Main] close-screen: no output window mapped to screenId="${screenId}"`);
  }
}

// Capacidades que el nativo reporta a la web (para que el operador vea salud real).
function getCapabilities(): ServerCapabilities {
  return { version: app.getVersion(), ndiAvailable: isNdiAvailable() };
}

// Errores del servidor WS. EADDRINUSE = otra instancia (o proceso zombie) tiene el 9877.
function onWsError(err: NodeJS.ErrnoException) {
  if (err.code === "EADDRINUSE") {
    const notice =
      "[Main] El puerto 9877 ya está en uso — otra instancia de Lumen (o un proceso previo) " +
      "sigue escuchando. El servidor WebSocket NO arrancó. Cierra la otra instancia y reinicia.";
    console.error(notice);
    if (tray) {
      tray.setToolTip("Lumen Display — ERROR: puerto 9877 en uso (WS no disponible)");
    }
    // No crashear: la app sigue viva en el tray para que el usuario pueda reaccionar.
    return;
  }
  console.error(`[Main] WS server error: ${err.message}`);
}

// El renderer avisa cuando ya registró sus listeners — reenviar el último estado
ipcMain.on("lumen:outputReady", (event) => {
  const role = getRoleForWebContents(event.sender.id);
  if (!role) return;
  console.log(`[Main] Output window ready for role="${role}" — replaying cached state`);

  if (lastBackground) event.sender.send("lumen:songBackground", lastBackground);
  if (lastMedia) event.sender.send("lumen:displayMedia", lastMedia);
  event.sender.send("lumen:displayMode", lastMode);
  const slide = lastSlide.get(role);
  if (slide) event.sender.send("lumen:slide", slide);
});

async function bootstrap() {
  app.setActivationPolicy("accessory");

  const preloadPath = preloadUrl();
  // LATENCY: resolver de assets → cache de disco del main. ensureCached nunca
  // lanza; devuelve una ruta file:// local o la URL original como fallback.
  ipcMain.handle("lumen:resolveAsset", async (_event, url: string) => {
    return assetCache.ensureCached(url);
  });
  initWindowManager(rendererUrl("output"), preloadPath);
  createSetupWindow(rendererUrl("setup"), preloadPath);
  registerIpcHandlers(rendererUrl("output"), preloadPath);
  startWsServer(onSlide, onAssignScreen, onDisplayMode, onSongBackground, onNdiConfig, onStageTime, onStageMessage, onStageConfig, onDisplayMedia, onPreloadMedia, onCloseScreen, getCapabilities, onWsError);
  createTray(preloadPath);
}

// ── Single-instance lock ──────────────────────────────────────────────────────
// Solo puede correr UNA instancia: la segunda cede el lock y se cierra. Así
// evitamos dos servidores WS peleando por el puerto 9877 (EADDRINUSE) y dos
// tray icons.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  // Si se intenta abrir una segunda instancia, traemos el Setup al frente.
  app.on("second-instance", () => {
    createSetupWindow(rendererUrl("setup"), preloadUrl());
  });

  app.whenReady().then(bootstrap);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSetupWindow(rendererUrl("setup"), preloadUrl());
    }
  });

  app.on("window-all-closed", () => {
    // no-op: el Tray mantiene la app viva
  });

  app.on("before-quit", () => {
    // Cerrar el servidor WS (heartbeat + sockets) además de destruir NDI.
    stopWsServer();
    destroyAllNdiSenders();
  });
}
