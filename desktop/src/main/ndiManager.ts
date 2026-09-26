/**
 * NDI output manager for NOVA Display.
 *
 * Uses koffi (FFI) to call the NDI SDK C library directly — no native
 * compilation required. NDI is silently disabled if the SDK is not installed.
 *
 * macOS SDK path (install NDI Tools from ndi.video):
 *   /usr/local/lib/libndi.dylib
 *   or /Library/NDI SDK for Apple/lib/macOS/libndi.dylib
 *
 * Windows SDK path (DLL shipped with NDI Tools):
 *   C:\Program Files\NDI\NDI 5 Tools\Processing.NDI.Lib.x64.dll
 */

import path from "path";
import fs from "fs";
import { app } from "electron";
import type { SlideData, SongBackground, DisplayMode, NdiOutput } from "@nova/shared";
import { resolveTypography } from "@nova/shared";

// Re-export the shared NdiOutput type so existing importers (e.g. main.ts,
// which does `import type { NdiOutput } from "./main/ndiManager"`) keep working
// without a code change on their side.
export type { NdiOutput };

// ─── Types ──────────────────────────────────────────────────────────────────

interface NdiSenderEntry {
  /** Opaque NDI sender pointer (held as BigInt) */
  ptr: bigint;
  config: NdiOutput;
  canvas: any;
  ctx: any;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NDI_WIDTH  = 1920;
const NDI_HEIGHT = 1080;
const FOURCC_BGRA = 0x41524742; // 'B','G','R','A' little-endian

/** Locations to probe for the NDI shared library */
const NDI_LIB_PATHS = [
  // macOS (NDI Tools installer)
  "/usr/local/lib/libndi.dylib",
  "/Library/NDI SDK for Apple/lib/macOS/libndi.dylib",
  // macOS Apple Silicon (Homebrew — `brew install ndi` links here)
  "/opt/homebrew/lib/libndi.dylib",
  "/opt/homebrew/lib/libndi.4.dylib",
  // Windows
  "C:\\Program Files\\NDI\\NDI 5 Tools\\Processing.NDI.Lib.x64.dll",
  "Processing.NDI.Lib.x64.dll",
];

// ─── Lazy-loaded state ───────────────────────────────────────────────────────

let ndi: {
  send_create: (desc: object) => bigint;
  send_destroy: (ptr: bigint) => void;
  send_video_v2: (ptr: bigint, frame: object) => void;
} | null = null;

let createCanvas: ((w: number, h: number) => any) | null = null;

let fontsRegistered = false;

const senders = new Map<string, NdiSenderEntry>();

// ─── Packaged fonts ────────────────────────────────────────────────────────
//
// The family names below MUST match exactly what resolveTypography() emits
// (SUPPORTED_FONTS in @nova/shared: "Inter", "Poppins", "Montserrat",
// "Roboto Flex", "Open Sans") and what the renderer's @font-face declares,
// otherwise node-canvas silently falls back to the system default.
//
// Weights used by NOVA slides: 400 (Regular), 500 (Medium), 600 (SemiBold),
// 700 (Bold). Drop the matching files into desktop/assets/fonts/ — see the
// README there for the exact filename → family/weight mapping.
interface FontFace {
  family: string;
  weight: number;
  file: string;
}

const PACKAGED_FONTS: readonly FontFace[] = [
  { family: "Inter",       weight: 400, file: "Inter-Regular.ttf" },
  { family: "Inter",       weight: 500, file: "Inter-Medium.ttf" },
  { family: "Inter",       weight: 600, file: "Inter-SemiBold.ttf" },
  { family: "Inter",       weight: 700, file: "Inter-Bold.ttf" },

  { family: "Poppins",     weight: 400, file: "Poppins-Regular.ttf" },
  { family: "Poppins",     weight: 500, file: "Poppins-Medium.ttf" },
  { family: "Poppins",     weight: 600, file: "Poppins-SemiBold.ttf" },
  { family: "Poppins",     weight: 700, file: "Poppins-Bold.ttf" },

  { family: "Montserrat",  weight: 400, file: "Montserrat-Regular.ttf" },
  { family: "Montserrat",  weight: 500, file: "Montserrat-Medium.ttf" },
  { family: "Montserrat",  weight: 600, file: "Montserrat-SemiBold.ttf" },
  { family: "Montserrat",  weight: 700, file: "Montserrat-Bold.ttf" },

  { family: "Roboto Flex", weight: 400, file: "RobotoFlex-Regular.ttf" },
  { family: "Roboto Flex", weight: 500, file: "RobotoFlex-Medium.ttf" },
  { family: "Roboto Flex", weight: 600, file: "RobotoFlex-SemiBold.ttf" },
  { family: "Roboto Flex", weight: 700, file: "RobotoFlex-Bold.ttf" },

  { family: "Open Sans",   weight: 400, file: "OpenSans-Regular.ttf" },
  { family: "Open Sans",   weight: 500, file: "OpenSans-Medium.ttf" },
  { family: "Open Sans",   weight: 600, file: "OpenSans-SemiBold.ttf" },
  { family: "Open Sans",   weight: 700, file: "OpenSans-Bold.ttf" },
];

/** Directory that holds the packaged font files.
 *  Resolved the same way as the tray icon (see main.ts): in dev the repo
 *  `assets/` dir, when packaged the `assets/` copied under resourcesPath.
 *  Uses app.getAppPath() rather than __dirname so the deeper nesting of this
 *  module's compiled output (dist/main/main/) doesn't break the path. */
function fontsDir(): string {
  try {
    return app.isPackaged
      ? path.join(process.resourcesPath, "assets", "fonts")
      : path.join(app.getAppPath(), "assets", "fonts");
  } catch {
    // `app` unavailable (e.g. running outside Electron) — best-effort fallback.
    return path.join(process.cwd(), "assets", "fonts");
  }
}

/** Register the packaged fonts with node-canvas. Every file is guarded:
 *  a missing file logs a warning and is skipped, and never throws — so the
 *  NDI pipeline degrades gracefully (falls back to the system sans-serif)
 *  when the real binaries haven't been dropped in yet. */
function registerPackagedFonts(canvasModule: any) {
  if (fontsRegistered) return;
  fontsRegistered = true; // only attempt once, whatever the outcome

  const registerFont = canvasModule?.registerFont;
  if (typeof registerFont !== "function") {
    console.warn("[NDI] canvas.registerFont unavailable — using system fonts");
    return;
  }

  const dir = fontsDir();
  let ok = 0;
  let missing = 0;
  for (const { family, weight, file } of PACKAGED_FONTS) {
    const full = path.join(dir, file);
    try {
      if (!fs.existsSync(full)) {
        missing++;
        console.warn(`[NDI] font missing (skipped): ${file} → "${family}" ${weight}`);
        continue;
      }
      registerFont(full, { family, weight: String(weight) });
      ok++;
    } catch (err) {
      console.warn(`[NDI] failed to register font ${file}:`, err);
    }
  }
  console.log(`[NDI] fonts registered: ${ok}/${PACKAGED_FONTS.length} (missing: ${missing}) from ${dir}`);
}

// ─── Initialisation ──────────────────────────────────────────────────────────

function tryLoadNdi(): boolean {
  if (ndi) return true;

  let koffi: any;
  try {
    koffi = require("koffi");
  } catch {
    console.warn("[NDI] koffi not available");
    return false;
  }

  let lib: any = null;
  for (const libPath of NDI_LIB_PATHS) {
    try {
      lib = koffi.load(libPath);
      console.log(`[NDI] Loaded NDI library from: ${libPath}`);
      break;
    } catch {
      // try next path
    }
  }

  if (!lib) {
    console.warn("[NDI] NDI SDK library not found — NDI disabled");
    console.warn("[NDI] Install NDI Tools from https://ndi.video/tools/ndi-tools/");
    return false;
  }

  try {
    // NDIlib_send_create_t struct
    const SendCreateT = koffi.struct("NDIlib_send_create_t", {
      p_ndi_name:  "const char *",
      p_groups:    "const char *",
      clock_video: "bool",
      clock_audio: "bool",
    });

    // NDIlib_video_frame_v2_t struct
    const VideoFrameT = koffi.struct("NDIlib_video_frame_v2_t", {
      xres:                  "int",
      yres:                  "int",
      FourCC:                "int",
      frame_rate_N:          "int",
      frame_rate_D:          "int",
      picture_aspect_ratio:  "float",
      frame_format_type:     "int",  // 1 = progressive
      timecode:              "int64",
      p_data:                "uint8_t *",
      line_stride_in_bytes:  "int",
      p_metadata:            "const char *",
      timestamp:             "int64",
    });

    const initFn         = lib.func("NDIlib_initialize", "bool", []);
    const sendCreateFn   = lib.func("NDIlib_send_create", "void *", [koffi.pointer(SendCreateT)]);
    const sendDestroyFn  = lib.func("NDIlib_send_destroy", "void", ["void *"]);
    const sendVideoFn    = lib.func("NDIlib_send_send_video_v2", "void", ["void *", koffi.pointer(VideoFrameT)]);

    if (!initFn()) {
      console.error("[NDI] NDIlib_initialize() returned false");
      return false;
    }

    ndi = {
      send_create:  (desc) => sendCreateFn(desc),
      send_destroy: (ptr)  => sendDestroyFn(ptr),
      send_video_v2: (ptr, frame) => sendVideoFn(ptr, frame),
    };

    console.log("[NDI] NDI SDK initialized");
    return true;
  } catch (err) {
    console.error("[NDI] Failed to bind NDI functions:", err);
    return false;
  }
}

function tryLoadCanvas(): boolean {
  if (createCanvas) return true;
  try {
    const canvasModule = require("canvas");
    // Register packaged fonts BEFORE any canvas/context is created, otherwise
    // node-canvas won't pick them up. Guarded so missing files never crash.
    registerPackagedFonts(canvasModule);
    createCanvas = canvasModule.createCanvas;
    return true;
  } catch {
    console.warn("[NDI] canvas module not available — NDI disabled");
    return false;
  }
}

function ensureReady(): boolean {
  return tryLoadCanvas() && tryLoadNdi();
}

/** Whether the NDI SDK is loaded and initialized. Reflects the real state so
 *  the main process can report NDI availability in the `state` message.
 *  Actively probes (idempotently) if not yet loaded. Never imports from main. */
export function isNdiAvailable(): boolean {
  return tryLoadNdi();
}

// ─── Frame sending ───────────────────────────────────────────────────────────

function sendFrameFromCanvas(ptr: bigint, canvas: any) {
  if (!ndi) return;
  // node-canvas toBuffer('raw') returns BGRA via Cairo (little-endian)
  const buf: Buffer = canvas.toBuffer("raw");
  ndi.send_video_v2(ptr, {
    xres:                 NDI_WIDTH,
    yres:                 NDI_HEIGHT,
    FourCC:               FOURCC_BGRA,
    frame_rate_N:         30000,
    frame_rate_D:         1001,
    picture_aspect_ratio: NDI_WIDTH / NDI_HEIGHT,
    frame_format_type:    1,      // progressive
    timecode:             BigInt(0),
    p_data:               buf,
    line_stride_in_bytes: NDI_WIDTH * 4,
    p_metadata:           null,
    timestamp:            BigInt(0),
  });
}

function paintBlack(ctx: any) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, NDI_WIDTH, NDI_HEIGHT);
}

/** Clear to fully transparent while keeping a 1920×1080 anchor so OBS
 *  doesn't auto-crop the NDI source to the text bounding box. */
function paintTransparent(ctx: any) {
  ctx.clearRect(0, 0, NDI_WIDTH, NDI_HEIGHT);
  // Alpha = 1/255 ≈ 0.004 — invisible to the eye, but tells OBS the
  // frame is 1920×1080 and prevents auto-cropping to text bounds.
  ctx.fillStyle = "rgba(0,0,0,0.004)";
  ctx.fillRect(0, 0, NDI_WIDTH, NDI_HEIGHT);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function handleNdiConfig(outputs: NdiOutput[]) {
  if (!ensureReady()) return;

  // Destroy senders that were removed
  for (const [id, entry] of senders) {
    if (!outputs.find((o) => o.id === id)) {
      try { ndi!.send_destroy(entry.ptr); } catch {}
      senders.delete(id);
      console.log(`[NDI] Destroyed sender: ${entry.config.name}`);
    }
  }

  // Create or update
  for (const output of outputs) {
    if (senders.has(output.id)) {
      senders.get(output.id)!.config = output;
    } else {
      try {
        const ptr = ndi!.send_create({
          p_ndi_name:  output.name,
          p_groups:    null,
          clock_video: true,
          clock_audio: false,
        });
        if (!ptr) throw new Error("send_create returned null");
        const canvas = createCanvas!(NDI_WIDTH, NDI_HEIGHT);
        const ctx    = canvas.getContext("2d");
        senders.set(output.id, { ptr, config: output, canvas, ctx });
        console.log(`[NDI] Created sender: ${output.name}`);
      } catch (err) {
        console.error(`[NDI] Failed to create sender "${output.name}":`, err);
      }
    }
  }
}

export function ndiHandleSlide(slide: SlideData) {
  if (!ndi || senders.size === 0) return;

  for (const entry of senders.values()) {
    if (!entry.config.sendLyrics) continue;

    const { ctx, canvas, ptr } = entry;
    paintTransparent(ctx);

    const isBible  = slide.type === "bible_verse";
    const text     = isBible ? (slide.verseText ?? "") : (slide.content ?? "");
    if (!text) continue;

    // Resolve the slide's COMPLETE typography via the single shared engine so
    // the NDI frame matches the web renderer (color/font are never guessed
    // here anymore). color & fontFamily are guaranteed defined.
    const typo      = resolveTypography(slide.typography);
    const fsScale   = typo.fontSize;
    const lh        = typo.lineHeight;
    const fw        = typo.fontWeight;
    const align     = (typo.textAlign ?? "center") as CanvasTextAlign;
    const fontSizePx = Math.round((fsScale / 100) * 5 * NDI_WIDTH / 100);
    // Quote the family (some — "Open Sans", "Roboto Flex" — contain spaces);
    // sans-serif fallback keeps text visible if the font isn't packaged yet.
    const fontStack = `"${typo.fontFamily}", sans-serif`;

    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = typo.color;
    ctx.font        = `${fw} ${fontSizePx}px ${fontStack}`;
    ctx.textAlign   = align;
    ctx.textBaseline = "middle";

    const lines  = text.split("\n");
    const lineH  = fontSizePx * lh;
    const startY = NDI_HEIGHT / 2 - ((lines.length - 1) * lineH) / 2;
    const x      = align === "left" ? 80 : align === "right" ? NDI_WIDTH - 80 : NDI_WIDTH / 2;

    // Mini fondo semitransparente detrás del texto
    const padH = fontSizePx * 0.6;
    const padV = fontSizePx * 0.4;
    const blockTop    = startY - fontSizePx / 2 - padV;
    const blockBottom = startY + (lines.length - 1) * lineH + fontSizePx / 2 + padV;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    const r = 16; // border-radius
    const bx = padH;
    const bw = NDI_WIDTH - padH * 2;
    const bh = blockBottom - blockTop;
    ctx.roundRect(bx, blockTop, bw, bh, r);
    ctx.fill();

    ctx.fillStyle = typo.color;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineH);
    });

    // Bible reference — same family for fidelity, dimmed relative to the text.
    if (isBible && slide.displayReference) {
      const refSize = Math.round(fontSizePx * 0.4);
      ctx.shadowBlur = 4;
      ctx.font       = `400 ${refSize}px ${fontStack}`;
      ctx.fillStyle  = "#CCCCCC";
      ctx.textAlign  = "center";
      ctx.fillText(slide.displayReference, NDI_WIDTH / 2, NDI_HEIGHT - refSize * 2);
    }

    // Reset shadow so it doesn't bleed into subsequent draws
    ctx.shadowColor = "transparent";
    ctx.shadowBlur  = 0;

    try { sendFrameFromCanvas(ptr, canvas); } catch (err) {
      console.error("[NDI] video send error:", err);
    }
  }
}

export function ndiHandleDisplayMode(mode: DisplayMode) {
  if (!ndi || senders.size === 0) return;

  if (mode.mode === "clear") {
    for (const entry of senders.values()) {
      paintTransparent(entry.ctx);
      try { sendFrameFromCanvas(entry.ptr, entry.canvas); } catch {}
    }
    return;
  }

  if (mode.mode === "logo") {
    for (const entry of senders.values()) {
      if (!entry.config.sendLogo) continue;
      paintBlack(entry.ctx);
      // TODO: load logoUrl via canvas loadImage when NDI logo is needed
      try { sendFrameFromCanvas(entry.ptr, entry.canvas); } catch {}
    }
  }
}

export function ndiHandleBackground(_bg: SongBackground) {
  if (!ndi || senders.size === 0) return;
  // Background frames are sent independently from slide frames.
  // For senders with sendBackground=true, we'd render the bg image here.
  // Currently a no-op; background is composited in the renderer instead.
}

export function destroyAllNdiSenders() {
  if (!ndi) return;
  for (const entry of senders.values()) {
    try { ndi.send_destroy(entry.ptr); } catch {}
  }
  senders.clear();
  console.log("[NDI] All senders destroyed");
}
