import { contextBridge, ipcRenderer } from "electron";
import type { DisplayInfo, SlideData, DisplayMode, SongBackground, DisplayMedia, StageTime, StageMessage, StageConfig } from "../shared/display";

contextBridge.exposeInMainWorld("lumen", {
  getDisplays: async (): Promise<DisplayInfo[]> => {
    return ipcRenderer.invoke("lumen:getDisplays");
  },
  openOutput: async (displayId: number): Promise<boolean> => {
    return ipcRenderer.invoke("lumen:openOutput", displayId);
  },
  onSlide: (callback: (slide: SlideData) => void) => {
    ipcRenderer.on("lumen:slide", (_event, slide: SlideData) => callback(slide));
  },
  onDisplayMode: (callback: (mode: DisplayMode) => void) => {
    ipcRenderer.on("lumen:displayMode", (_event, mode: DisplayMode) => callback(mode));
  },
  onSongBackground: (callback: (bg: SongBackground) => void) => {
    ipcRenderer.on("lumen:songBackground", (_event, bg: SongBackground) => callback(bg));
  },
  onDisplayMedia: (callback: (media: DisplayMedia) => void) => {
    ipcRenderer.on("lumen:displayMedia", (_event, media: DisplayMedia) => callback(media));
  },
  onPreloadMedia: (callback: (media: DisplayMedia) => void) => {
    ipcRenderer.on("lumen:preloadMedia", (_event, media: DisplayMedia) => callback(media));
  },
  signalReady: () => {
    ipcRenderer.send("lumen:outputReady");
  },
  onStageTime: (callback: (data: StageTime) => void) => {
    ipcRenderer.on("lumen:stageTime", (_event, data: StageTime) => callback(data));
  },
  onStageMessage: (callback: (data: StageMessage) => void) => {
    ipcRenderer.on("lumen:stageMessage", (_event, data: StageMessage) => callback(data));
  },
  onStageConfig: (callback: (data: StageConfig) => void) => {
    ipcRenderer.on("lumen:stageConfig", (_event, data: StageConfig) => callback(data));
  },
  // LATENCY: resuelve una URL remota a su ruta local cacheada (file://) vía el
  // cache de disco del main. Ante cualquier fallo devuelve la URL original.
  resolveAsset: async (url: string): Promise<string> => {
    try {
      const resolved = await ipcRenderer.invoke("lumen:resolveAsset", url);
      return typeof resolved === "string" && resolved ? resolved : url;
    } catch {
      return url;
    }
  },
});
