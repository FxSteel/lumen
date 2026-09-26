import type { DisplayInfo, SlideData, DisplayMode, SongBackground, DisplayMedia, StageTime, StageMessage, StageConfig } from "@shared/display";

declare global {
  interface Window {
    lumen: {
      getDisplays: () => Promise<DisplayInfo[]>;
      openOutput: (displayId: number) => Promise<boolean>;
      onSlide: (callback: (slide: SlideData) => void) => void;
      onDisplayMode: (callback: (mode: DisplayMode) => void) => void;
      onSongBackground: (callback: (bg: SongBackground) => void) => void;
      onDisplayMedia: (callback: (media: DisplayMedia) => void) => void;
      onPreloadMedia: (callback: (media: DisplayMedia) => void) => void;
      resolveAsset: (url: string) => Promise<string>;
      signalReady: () => void;
      onStageTime: (callback: (data: StageTime) => void) => void;
      onStageMessage: (callback: (data: StageMessage) => void) => void;
      onStageConfig: (callback: (data: StageConfig) => void) => void;
    };
  }
}

export {};
