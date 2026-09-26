import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  SlideData,
  DisplayMode,
  SongBackground,
  DisplayMedia,
  Typography,
} from "@shared/display";
import { resolveTypography, lumenSizeToVw, transitionDurationMs } from "@shared/display";

/**
 * LATENCY: resuelve una URL remota a su ruta local cacheada (file://) a través
 * del cache de disco del proceso main (window.lumen.resolveAsset). Si el asset
 * ya fue calentado en preload, la resolución es instantánea. Ante cualquier
 * fallo (o si el bridge no expone resolveAsset) devuelve la URL original para
 * conservar el comportamiento previo (fallback remoto).
 */
async function resolveAsset(url: string): Promise<string> {
  if (!url) return url;
  // En dev el renderer corre en http://localhost; Chromium bloquea sub-recursos
  // file:// desde un origen http, así que ahí usamos la URL remota (sin cache).
  // En producción el renderer es file://, donde el cache local sí carga.
  if (typeof location !== "undefined" && location.protocol !== "file:") return url;
  try {
    const fn = (window.lumen as unknown as {
      resolveAsset?: (u: string) => Promise<string>;
    }).resolveAsset;
    if (!fn) return url;
    const resolved = await fn(url);
    return resolved || url;
  } catch {
    return url;
  }
}

// Fuentes empaquetadas (ver @font-face en styles.css) + fallbacks del sistema.
function fontStack(family: string): string {
  return `"${family}", "Segoe UI", system-ui, sans-serif`;
}

/**
 * Convierte el Typography resuelto (completo, sin undefined) en estilos inline.
 * Aquí está el arreglo del bug: color / fontFamily / textShadow / textTransform
 * se APLICAN, en vez de perderse. Un solo motor (`resolveTypography`) decide.
 */
function typographyStyle(typo: Typography): React.CSSProperties {
  return {
    color: typo.color,
    fontFamily: fontStack(typo.fontFamily ?? "Inter"),
    fontWeight: typo.fontWeight,
    lineHeight: typo.lineHeight,
    letterSpacing: `${typo.letterSpacing}px`,
    textShadow: typo.textShadow ?? undefined,
    textTransform: typo.textTransform,
    textAlign: typo.textAlign,
  };
}

/**
 * Fade compartido con la web (/live-output/main): al cambiar de diapositiva,
 * se hace fade-out del contenido actual, se intercambia, y fade-in del nuevo,
 * con la duración de `slide.transition` (none=0 → intercambio instantáneo).
 */
function useSlideFade(slide: SlideData | null) {
  const [rendered, setRendered] = useState<SlideData | null>(slide);
  const [opacity, setOpacity] = useState(1);
  const [durationMs, setDurationMs] = useState(0);
  const prevRef = useRef<SlideData | null>(slide);

  useEffect(() => {
    if (slide === prevRef.current) return;
    prevRef.current = slide;

    const dur = transitionDurationMs(slide?.transition);

    // Sin transición (o sin slide): intercambio instantáneo, opacidad plena.
    if (dur <= 0 || !slide) {
      setDurationMs(0);
      setRendered(slide);
      setOpacity(1);
      return;
    }

    // Fade-out del contenido actual…
    setDurationMs(dur);
    setOpacity(0);
    // …y tras la duración, intercambio + fade-in del nuevo.
    const t = window.setTimeout(() => {
      setRendered(slide);
      setOpacity(1);
    }, dur);
    return () => window.clearTimeout(t);
  }, [slide]);

  return { rendered, opacity, durationMs };
}

function BibleVerseSlide({ slide }: { slide: SlideData }) {
  const typo = resolveTypography(slide.typography);
  const baseStyle = typographyStyle(typo);
  const targetVw = lumenSizeToVw(typo.fontSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Render at target size, then shrink via DOM if the full content block
  // (verse + reference label) overflows 90% of viewport height.
  // Measuring the container (not just the <p>) ensures the reference label
  // is included in the overflow check. Runs before paint — no visible flash.
  useLayoutEffect(() => {
    const el = textRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const maxH = window.innerHeight * 0.90;
    el.style.fontSize = `${targetVw}vw`;
    if (container.scrollHeight <= maxH) return;
    let lo = 1, hi = targetVw;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}vw`;
      if (container.scrollHeight <= maxH) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = `${lo}vw`;
  }, [slide.verseText, targetVw]);

  if (!slide.verseText) return null;

  const referenceLabel =
    slide.projectedReferenceLabel ??
    (slide.displayReference
      ? `${slide.displayReference}${slide.bibleVersionAbbreviation ? ` - ${slide.bibleVersionAbbreviation}` : ""}`
      : null);

  return (
    <div
      ref={containerRef}
      className="slide-content"
      style={{ textAlign: typo.textAlign, paddingLeft: "8vw", paddingRight: "8vw" }}
    >
      <p ref={textRef} className="slide-text" style={{ ...baseStyle, fontSize: `${targetVw}vw` }}>
        {slide.verseText}
      </p>
      {referenceLabel && (
        <p
          className="bible-reference"
          style={{ fontSize: `${targetVw * 0.4}vw`, fontFamily: baseStyle.fontFamily }}
        >
          {referenceLabel}
        </p>
      )}
    </div>
  );
}

function SongSlide({ slide }: { slide: SlideData }) {
  const typo = resolveTypography(slide.typography);
  const baseStyle = typographyStyle(typo);
  const fontSizeVw = lumenSizeToVw(typo.fontSize);
  // Formato nuevo: `label`. Backward-compat: `reference`.
  const label = slide.label ?? slide.reference;

  return (
    <div className="slide-content" style={{ textAlign: typo.textAlign }}>
      {label && <p className="slide-reference">{label}</p>}
      <p className="slide-text" style={{ ...baseStyle, fontSize: `${fontSizeVw}vw` }}>
        {slide.content}
      </p>
    </div>
  );
}

export default function OutputScreen() {
  const [slide, setSlide] = useState<SlideData | null>(null);
  const [mode, setMode] = useState<DisplayMode>({ mode: "slide" });
  const [background, setBackground] = useState<SongBackground | null>(null);
  const [media, setMedia] = useState<DisplayMedia | null>(null);

  // Fade compartido: `renderedSlide` es lo que se pinta; `opacity`/`durationMs`
  // animan la transición. Hook llamado siempre (antes de cualquier early return).
  const { rendered: renderedSlide, opacity, durationMs } = useSlideFade(slide);

  useEffect(() => {
    window.lumen.onSlide((data) => {
      // Ignorar bible_verse con verseText vacío (primera entrega)
      if (data.type === "bible_verse" && !data.verseText) return;
      setSlide(data);
      setMedia(null);
      setMode({ mode: "slide" });
    });
    window.lumen.onDisplayMode((m) => { setMode(m); setMedia(null); });
    window.lumen.onSongBackground(async (bg) => {
      // Resolver el fondo a su ruta local cacheada antes de pintarlo.
      if (bg.backgroundType !== "none" && bg.backgroundUrl) {
        const url = await resolveAsset(bg.backgroundUrl);
        setBackground({ ...bg, backgroundUrl: url });
      } else {
        setBackground(bg);
      }
    });
    window.lumen.onPreloadMedia((m) => {
      // Calentar el cache (el main ya prefetchea; esto lo refuerza desde el renderer).
      void resolveAsset(m.url);
    });
    window.lumen.onDisplayMedia(async (m) => {
      setSlide(null);
      setMode({ mode: "slide" });
      const url = await resolveAsset(m.url);
      setMedia({ ...m, url });
    });
    // Avisar al main process que los listeners están listos → recibir estado cacheado
    window.lumen.signalReady();
  }, []);

  const hasBg = background && background.backgroundType !== "none" && background.backgroundUrl;

  const bgLayer = hasBg ? (
    background.backgroundType === "video" ? (
      <video
        key={background.backgroundUrl!}
        className="bg-layer"
        src={background.backgroundUrl!}
        autoPlay
        loop
        muted
        playsInline
      />
    ) : (
      <img key={background.backgroundUrl!} className="bg-layer" src={background.backgroundUrl!} alt="" />
    )
  ) : null;

  if (mode.mode === "clear") {
    return <main className="output-screen" />;
  }

  if (mode.mode === "logo") {
    return (
      <main className="output-screen output-media">
        <img src={mode.logoUrl} alt="" draggable={false} />
      </main>
    );
  }

  if (mode.mode === "announcement") {
    return (
      <main className="output-screen output-media">
        <img src={mode.announcementUrl} alt="" draggable={false} />
      </main>
    );
  }

  if (media) {
    return (
      <main className="output-screen output-media">
        {media.mediaType === "video"
          ? <video key={media.url} src={media.url} autoPlay loop playsInline />
          : <img key={media.url} src={media.url} alt="" draggable={false} />
        }
      </main>
    );
  }

  if (!renderedSlide) {
    return (
      <main className="output-screen">
        {bgLayer}
        {hasBg && <div className="bg-overlay" />}
      </main>
    );
  }

  const isBible = renderedSlide.type === "bible_verse";

  return (
    <main className="output-screen output-slide">
      {!isBible && bgLayer}
      {!isBible && hasBg && <div className="bg-overlay" />}

      <div
        className="slide-fade"
        style={{
          opacity,
          transition: durationMs > 0 ? `opacity ${durationMs}ms ease-in-out` : "none",
        }}
      >
        {isBible
          ? <BibleVerseSlide slide={renderedSlide} />
          : <SongSlide slide={renderedSlide} />
        }
      </div>
    </main>
  );
}
