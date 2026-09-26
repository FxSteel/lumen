'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useWorkspace } from '@/lib/workspace-provider'
import { supabase } from '@/lib/supabase'

interface SlideContent {
  slideId: string
  songId?: string | null
  content: string
  fontSize: number
  lineHeight?: number
  letterSpacing?: number
  fontWeight?: number | string
  slideType: string
  label?: string
  songTypography?: unknown
  // Bible verse specific fields
  displayReference?: string
  verseText?: string
  bibleVersionName?: string
  bibleVersionAbbreviation?: string
  projectedReferenceLabel?: string
}

type SongBackgroundType = 'none' | 'image' | 'video'

interface SongBackground {
  backgroundType: SongBackgroundType
  backgroundUrl: string | null
}

function resolveFontWeight(slide: SlideContent | null): number | string {
  if (!slide) return 500
  const candidates = [
    (slide as any).font_weight,
    slide.fontWeight,
    (slide as any).songTypography?.weight,
    (slide as any).songTypography?.font_weight,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.min(Math.max(Math.round(candidate), 100), 900)
    }
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (!trimmed) continue
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric)) {
        return Math.min(Math.max(Math.round(numeric), 100), 900)
      }
      if (trimmed === 'normal' || trimmed === 'bold' || trimmed === 'bolder' || trimmed === 'lighter') {
        return trimmed
      }
    }
  }
  return 500
}

function readInitialSlide(): SlideContent | null {
  return null
}

function readInitialOutputMode(): 'slide' | 'logo' | 'announcement' | 'clear' | 'media' {
  if (typeof window === 'undefined') return 'clear'
  const stored = localStorage.getItem('output-mode')
  if (stored === 'slide' || stored === 'logo' || stored === 'announcement' || stored === 'clear' || stored === 'media') return stored
  return 'clear'
}

function readInitialMedia(): { mediaType: 'image' | 'video'; url: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('current-media')
    return stored ? JSON.parse(stored) : null
  } catch { return null }
}


function readInitialTransitionType(): 'none' | 'fade' | 'fade-slow' {
  if (typeof window === 'undefined') return 'none'
  const stored = localStorage.getItem('transition-type')
  if (stored === 'none' || stored === 'fade' || stored === 'fade-slow') return stored
  return 'none'
}

function readInitialBackground(): SongBackground {
  return { backgroundType: 'none', backgroundUrl: null }
}

function normalizeProjectedLabel(label: string): string {
  const normalized = label
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const deduped = normalized.filter((line, index) => index === 0 || line !== normalized[index - 1])
  return deduped.join(' ')
}

export default function LiveOutputMainPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [displayMode, setDisplayMode] = useState<'slide' | 'logo' | 'announcement' | 'clear' | 'media'>(readInitialOutputMode)
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(readInitialSlide)
  const [songBackground, setSongBackground] = useState<SongBackground>(readInitialBackground)
  const [currentMedia, setCurrentMedia] = useState<{ mediaType: 'image' | 'video'; url: string } | null>(readInitialMedia)
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('logo-url') || ''
  })
  const [announcementUrl, setAnnouncementUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('announcement-url') || ''
  })
  const [backgroundLoading, setBackgroundLoading] = useState(false)
  const [bibleFontSize, setBibleFontSize] = useState<number>(80)
  const bibleContainerRef = useRef<HTMLDivElement>(null)
  const bibleTextRef = useRef<HTMLDivElement>(null)
  const bibleRefRef = useRef<HTMLDivElement>(null)
  const [transitionType, setTransitionType] = useState<'none' | 'fade' | 'fade-slow'>(readInitialTransitionType)
  const transitionTypeRef = useRef<'none' | 'fade' | 'fade-slow'>(readInitialTransitionType())
  const [contentVisible, setContentVisible] = useState(true)
  const contentVisibleRef = useRef(true)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionDurationMs = transitionType === 'fade' ? 400 : transitionType === 'fade-slow' ? 800 : 0

  function setContentVisibleSync(v: boolean) {
    contentVisibleRef.current = v
    setContentVisible(v)
  }

  function clearPendingFade() {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = null
    }
  }

  useEffect(() => {
    if (!activeWorkspaceId) return

    const loadBibleFontSize = async () => {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('bible_font_size')
        .eq('workspace_id', activeWorkspaceId)
        .maybeSingle()

      if (error) {
        console.error('[LIVE-MAIN] Error loading bible font size:', error)
        return
      }

      if (typeof data?.bible_font_size === 'number') {
        setBibleFontSize(data.bible_font_size)
      }
    }

    loadBibleFontSize()
  }, [activeWorkspaceId])

  // Initialize broadcaster and listen for messages
  useEffect(() => {
    const broadcaster = new BroadcastChannel('live-output-sync')

    broadcaster.addEventListener('message', (event) => {
      const data = event.data

      switch (data.type) {
        case 'slide-change':
          {
            const t = data.payload?.transitionType
            const resolved: 'none' | 'fade' | 'fade-slow' =
              t === 'fade' || t === 'fade-slow' ? t : 'none'
            const duration = resolved === 'fade' ? 400 : resolved === 'fade-slow' ? 800 : 0

            // Update transition CSS first (state + ref)
            setTransitionType(resolved)
            transitionTypeRef.current = resolved
            clearPendingFade()

            if (duration > 0) {
              // Defer opacity change so the browser paints the CSS transition
              // property before opacity starts changing — ensures the animation fires.
              fadeTimeoutRef.current = setTimeout(() => {
                if (contentVisibleRef.current) {
                  // Fade out current content, then swap and fade in
                  setContentVisibleSync(false)
                  fadeTimeoutRef.current = setTimeout(() => {
                    fadeTimeoutRef.current = null
                    setDisplayMode('slide')
                    localStorage.setItem('output-mode', 'slide')
                    setCurrentSlide(data.payload)
                    setContentVisibleSync(true)
                  }, duration)
                } else {
                  // Already faded out (e.g. after clear): swap and fade in
                  fadeTimeoutRef.current = null
                  setDisplayMode('slide')
                  localStorage.setItem('output-mode', 'slide')
                  setCurrentSlide(data.payload)
                  setContentVisibleSync(true)
                }
              }, 0)
            } else {
              setDisplayMode('slide')
              localStorage.setItem('output-mode', 'slide')
              setCurrentSlide(data.payload)
            }
          }

          break

        case 'display-mode':
          if (data.payload.logoUrl) {
            setLogoUrl(data.payload.logoUrl)
            localStorage.setItem('logo-url', data.payload.logoUrl)
          }
          if (data.payload.announcementUrl) {
            setAnnouncementUrl(data.payload.announcementUrl)
            localStorage.setItem('announcement-url', data.payload.announcementUrl)
          }

          if (data.payload.mode === 'clear') {
            // Fade out current content, stay faded out (slide-change will fade back in)
            clearPendingFade()
            localStorage.setItem('output-mode', 'clear')
            const t = transitionTypeRef.current
            const duration = t === 'fade' ? 400 : t === 'fade-slow' ? 800 : 0
            if (duration > 0) {
              setContentVisibleSync(false)
              fadeTimeoutRef.current = setTimeout(() => {
                fadeTimeoutRef.current = null
                setDisplayMode('clear')
              }, duration)
            } else {
              setDisplayMode('clear')
            }
          } else if (
            data.payload.mode === 'slide' ||
            data.payload.mode === 'logo' ||
            data.payload.mode === 'announcement'
          ) {
            // Cancel any pending fade timeout and ensure content is visible
            clearPendingFade()
            setContentVisibleSync(true)
            setDisplayMode(data.payload.mode)
            localStorage.setItem('output-mode', data.payload.mode)
          }
          break

        case 'display-media':
          if (data.payload?.url) {
            const media = { mediaType: data.payload.mediaType as 'image' | 'video', url: data.payload.url }
            setCurrentMedia(media)
            setDisplayMode('media')
            setContentVisibleSync(true)
            localStorage.setItem('current-media', JSON.stringify(media))
            localStorage.setItem('output-mode', 'media')
          }
          break

        case 'preload-media':
          // Preload media into browser cache so projection is instant
          if (data.payload?.url) {
            if (data.payload.mediaType === 'video') {
              const link = document.createElement('link')
              link.rel = 'preload'
              link.as = 'video'
              link.href = data.payload.url
              link.crossOrigin = 'anonymous'
              document.head.appendChild(link)
            } else {
              const img = new Image()
              img.src = data.payload.url
            }
          }
          break

        case 'bible-font-size':
          if (typeof data.payload?.fontSize === 'number') {
            setBibleFontSize(data.payload.fontSize)
          }
          break

        case 'song-background':
          if (data.payload?.backgroundType === 'image' || data.payload?.backgroundType === 'video') {
            setSongBackground({
              backgroundType: data.payload.backgroundType,
              backgroundUrl: data.payload.backgroundUrl || null,
            })
            localStorage.setItem('current-song-background', JSON.stringify(data.payload))
          } else {
            setSongBackground({ backgroundType: 'none', backgroundUrl: null })
            localStorage.removeItem('current-song-background')
          }
          break
      }
    })

    return () => broadcaster.close()
  }, [])

  // Convert px → vw using 1920px as reference so text scales with any viewport width.
  // At 1920px wide: Xpx === X/19.2 vw. This matches the vw-based container padding/width.
  const pxToVw = (px: number) => `${(px / 19.2).toFixed(3)}vw`

  // Bible verse style — fontSize is set by auto-scale useLayoutEffect, not inline
  const bibleVerseStyle: React.CSSProperties = {
    lineHeight: '1.4',
    letterSpacing: `${currentSlide?.letterSpacing ?? 0}px`,
    fontWeight: resolveFontWeight(currentSlide),
  }

  // Auto-scale bible verse: binary search for largest font that fits 90vh
  useLayoutEffect(() => {
    const container = bibleContainerRef.current
    const textEl = bibleTextRef.current
    const refEl = bibleRefRef.current
    if (!container || !textEl || !refEl) return
    if (displayMode !== 'slide' || currentSlide?.slideType !== 'bible_verse') return

    const targetVw = (bibleFontSize * 1.333) / 19.2
    const maxHeight = window.innerHeight * 0.90

    // Set target size
    textEl.style.fontSize = `${targetVw}vw`
    refEl.style.fontSize = `${targetVw * 0.4}vw`

    if (container.scrollHeight <= maxHeight) return

    // Binary search between 1vw and targetVw
    let lo = 1, hi = targetVw
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      textEl.style.fontSize = `${mid}vw`
      refEl.style.fontSize = `${mid * 0.4}vw`
      if (container.scrollHeight <= maxHeight) {
        lo = mid
      } else {
        hi = mid
      }
    }
    textEl.style.fontSize = `${lo}vw`
    refEl.style.fontSize = `${lo * 0.4}vw`
  }, [displayMode, currentSlide, bibleFontSize])

  const slideStyle = {
    fontSize: pxToVw(currentSlide?.fontSize ?? 100),
    lineHeight: `${currentSlide?.lineHeight ?? 1.2}`,
    letterSpacing: `${currentSlide?.letterSpacing ?? 0}px`,
    fontWeight: resolveFontWeight(currentSlide),
  }

  useEffect(() => {
    setBackgroundLoading(songBackground.backgroundType === 'video')
  }, [songBackground.backgroundType, songBackground.backgroundUrl])

  const shouldShowSongBackground =
    displayMode !== 'announcement' &&
    songBackground.backgroundType !== 'none' &&
    Boolean(songBackground.backgroundUrl)
  const activeSongBackgroundUrl = shouldShowSongBackground ? songBackground.backgroundUrl : null

  const contentTransitionStyle: React.CSSProperties = {
    opacity: contentVisible ? 1 : 0,
    transition: transitionDurationMs > 0 ? `opacity ${transitionDurationMs}ms ease-in-out` : 'none',
  }

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden">
      {shouldShowSongBackground && activeSongBackgroundUrl && (
        <>
          {songBackground.backgroundType === 'image' ? (
            <img
              src={activeSongBackgroundUrl}
              alt="Fondo canción"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <video
              key={activeSongBackgroundUrl}
              src={activeSongBackgroundUrl}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              onCanPlay={() => setBackgroundLoading(false)}
              onError={() => setBackgroundLoading(false)}
            />
          )}
          <div className="absolute inset-0 bg-black/30" />
          {backgroundLoading && (
            <div className="absolute top-6 right-6 z-20 rounded bg-black/40 px-3 py-1 text-sm text-gray-200">
              Cargando fondo...
            </div>
          )}
        </>
      )}

      {/* Priority: ANNOUNCEMENT > LOGO > MEDIA > SLIDE/CLEAR */}
      <div className="absolute inset-0 flex items-center justify-center" style={contentTransitionStyle}>
        {displayMode === 'media' && currentMedia && (
          currentMedia.mediaType === 'image' ? (
            <img src={currentMedia.url} alt="Media" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <video
              key={currentMedia.url}
              src={currentMedia.url}
              className="absolute inset-0 h-full w-full object-contain"
              autoPlay
              loop
              playsInline
              onEnded={(e) => { e.currentTarget.currentTime = 0; void e.currentTarget.play() }}
            />
          )
        )}

        {displayMode === 'clear' && !shouldShowSongBackground && <div className="h-screen w-screen bg-black" />}

        {displayMode === 'logo' && logoUrl && (
          <img src={logoUrl} alt="Logo" className="max-h-[90vh] max-w-[90vw] object-contain relative z-10" />
        )}

        {displayMode === 'announcement' && announcementUrl && (
          <img
            src={announcementUrl}
            alt="Anuncio"
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        )}

        {displayMode === 'slide' && currentSlide && (
          <div
            className="text-center w-screen py-[6vh] relative z-10"
          >
            {(() => {
              // Handle bible verses
              if (currentSlide.slideType === 'bible_verse') {
                return (
                  <div ref={bibleContainerRef} className="text-center px-[8vw]">
                    <div
                      ref={bibleTextRef}
                      className="whitespace-pre-wrap break-words text-white"
                      style={bibleVerseStyle}
                    >
                      {currentSlide.verseText || currentSlide.content || 'NO VERSE TEXT FOUND'}
                    </div>

                    <div ref={bibleRefRef} className="mt-6 text-gray-300">
                      {normalizeProjectedLabel(
                        currentSlide.projectedReferenceLabel ||
                          `${currentSlide.displayReference || 'Referencia'} - ${currentSlide.bibleVersionAbbreviation || 'NVI'} (${currentSlide.bibleVersionName || 'Nueva Versión Internacional'})`
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div className="text-white" style={slideStyle}>
                  {(currentSlide.content || '').split('\n').map((line, i) => (
                    <div key={i} className="whitespace-nowrap">{line || '\u00A0'}</div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Waiting state */}
        {displayMode === 'slide' && !currentSlide && (
          <div className="text-gray-600 text-4xl">Esperando contenido...</div>
        )}
      </div>
    </div>
  )
}
