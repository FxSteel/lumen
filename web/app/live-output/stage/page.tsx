'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('current-slide')
  if (!stored) return null
  try {
    return JSON.parse(stored) as SlideContent
  } catch {
    return null
  }
}

function readInitialStageCleared(): boolean {
  if (typeof window === 'undefined') return true
  const mode = localStorage.getItem('output-mode')
  return mode === 'clear' || mode === null
}

function readInitialMedia(): { mediaType: 'image' | 'video'; url: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('current-media')
    return stored ? JSON.parse(stored) : null
  } catch { return null }
}

function normalizeProjectedLabel(label: string): string {
  const normalized = label
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const deduped = normalized.filter((line, index) => index === 0 || line !== normalized[index - 1])
  return deduped.join(' ')
}

export default function LiveOutputStagePage() {
  const { activeWorkspaceId } = useWorkspace()
  const [currentSlide, setCurrentSlide] = useState<SlideContent | null>(readInitialSlide)
  const [isStageCleared, setIsStageCleared] = useState(readInitialStageCleared)
  const [message, setMessage] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('stage-current-message') || ''
  })
  const [showTime, setShowTime] = useState(true)
  const [showMessage, setShowMessage] = useState(true)
  const [currentTime, setCurrentTime] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('stage-current-time') || ''
  })
  const [bibleFontSize, setBibleFontSize] = useState<number>(80)
  const [currentMedia, setCurrentMedia] = useState<{ mediaType: 'image' | 'video'; url: string } | null>(readInitialMedia)
  const bibleContainerRef = useRef<HTMLDivElement>(null)
  const bibleTextRef = useRef<HTMLDivElement>(null)
  const bibleRefRef = useRef<HTMLDivElement>(null)
  const stageContentRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    if (!activeWorkspaceId) return

    const loadBibleFontSize = async () => {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('bible_font_size, stage_show_time, stage_show_message')
        .eq('workspace_id', activeWorkspaceId)
        .maybeSingle()

      if (error) {
        console.error('[LIVE-STAGE] Error loading bible font size:', error)
        return
      }

      if (typeof data?.bible_font_size === 'number') {
        setBibleFontSize(data.bible_font_size)
      }

      if (typeof data?.stage_show_time === 'boolean') {
        setShowTime(data.stage_show_time)
      }

      if (typeof data?.stage_show_message === 'boolean') {
        setShowMessage(data.stage_show_message)
      }
    }

    loadBibleFontSize()
  }, [activeWorkspaceId])

  const pxToVw = (px: number) => `${(px / 19.2).toFixed(3)}vw`

  // Bible verse style — fontSize set by auto-scale useLayoutEffect
  const bibleVerseStyle = {
    lineHeight: '1.4',
    letterSpacing: `${currentSlide?.letterSpacing ?? 0}px`,
    fontWeight: resolveFontWeight(currentSlide),
  }

  // Auto-scale bible verse: binary search for largest font that fits available area
  useLayoutEffect(() => {
    const container = bibleContainerRef.current
    const textEl = bibleTextRef.current
    const refEl = bibleRefRef.current
    const contentArea = stageContentRef.current
    if (!container || !textEl || !refEl || !contentArea) return
    if (isStageCleared || !currentSlide || currentSlide.slideType !== 'bible_verse') return

    const targetVw = (bibleFontSize * 1.333) / 19.2
    const maxHeight = contentArea.clientHeight * 0.90

    textEl.style.fontSize = `${targetVw}vw`
    refEl.style.fontSize = `${targetVw * 0.4}vw`

    if (container.scrollHeight <= maxHeight) return

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
  }, [isStageCleared, currentSlide, bibleFontSize])

  const slideStyle = {
    fontSize: pxToVw(currentSlide?.fontSize ?? 100),
    lineHeight: `${currentSlide?.lineHeight ?? 1.2}`,
    letterSpacing: `${currentSlide?.letterSpacing ?? 0}px`,
    fontWeight: resolveFontWeight(currentSlide),
  }

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && currentSlide) {
      console.debug('[TYPOGRAPHY] Stage resolved fontWeight:', resolveFontWeight(currentSlide))
    }
  }, [currentSlide])

  // Auto-hide message after 10 seconds
  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => setMessage(''), 10000)
      return () => clearTimeout(timeout)
    }
  }, [message])

  // Initialize broadcaster and listen for messages
  useEffect(() => {
    console.log('[LIVE-STAGE] Component mounting, setting up BroadcastChannel listener')
    const broadcaster = new BroadcastChannel('live-output-sync')

    broadcaster.addEventListener('message', (event) => {
      const data = event.data
      console.log('🔥 [LIVE-STAGE] RECEIVED BROADCAST:', data)
      console.log('🔥 [LIVE-STAGE] Message type:', data.type)
      console.log('🔥 [LIVE-STAGE] Payload:', data.payload)

      switch (data.type) {
        case 'slide-change':
          console.log('🎯 [LIVE-STAGE] Processing slide-change')
          console.log('🎯 [LIVE-STAGE] Setting slide:', data.payload)
          setCurrentSlide(data.payload)
          console.log('✅ [LIVE-STAGE] State updated - currentSlide set')
          break

        case 'display-mode':
          if (data.payload.mode === 'clear') {
            setIsStageCleared(true)
            setCurrentMedia(null)
            localStorage.setItem('output-mode', 'clear')
            localStorage.removeItem('current-media')
            break
          }
          if (data.payload.mode === 'slide') {
            setIsStageCleared(false)
            setCurrentMedia(null)
            localStorage.setItem('output-mode', 'slide')
            localStorage.removeItem('current-media')
            break
          }
          // Stage screen must ignore logo/announcement display mode changes.
          console.log('[LIVE-STAGE] Ignoring display-mode for stage screen:', data.payload.mode)
          break

        case 'bible-font-size':
          if (typeof data.payload?.fontSize === 'number') {
            setBibleFontSize(data.payload.fontSize)
          }
          break

        case 'stage-message':
          console.log('[STAGE MESSAGE] Setting message to:', data.payload?.message)
          setMessage(data.payload.message)
          localStorage.setItem('stage-current-message', data.payload.message || '')
          break

        case 'stage-time':
          console.log('[STAGE TIME] Setting time to:', data.payload?.time)
          setCurrentTime(data.payload?.time || '')
          localStorage.setItem('stage-current-time', data.payload?.time || '')
          break

        case 'stage-config':
          if (typeof data.payload?.show_time === 'boolean') {
            setShowTime(data.payload.show_time)
          }
          if (typeof data.payload?.show_message === 'boolean') {
            setShowMessage(data.payload.show_message)
          }
          break

        case 'display-media':
          if (data.payload?.url) {
            const media = { mediaType: data.payload.mediaType as 'image' | 'video', url: data.payload.url }
            setCurrentMedia(media)
            setIsStageCleared(false)
            localStorage.setItem('current-media', JSON.stringify(media))
            localStorage.setItem('output-mode', 'media')
          }
          break

        case 'preload-media':
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

        case 'song-background':
          // Intentionally ignored: stage output must remain on solid black background.
          break
      }
    })

    return () => broadcaster.close()
  }, [])

  return (
    <div className="h-screen w-screen bg-black text-white p-8 flex flex-col">
      {/* Top section: Time and Message */}
      <div className="flex gap-4 mb-6">
        {showTime && (
          <div className="text-5xl font-extrabold bg-white/15 px-7 py-4 rounded-lg tracking-wide leading-none">
            {currentTime}
          </div>
        )}

        {showMessage && message && (
          <div className="flex-1 text-2xl bg-yellow-500/20 px-6 py-3 rounded border-2 border-yellow-500">
            {message}
          </div>
        )}
      </div>

      {/* Main content: Media / Lyrics / Verses */}
      <div ref={stageContentRef} className="flex-1 flex items-center justify-center">

        {currentMedia && (
          currentMedia.mediaType === 'image' ? (
            <img src={currentMedia.url} alt="Media" className="max-h-full max-w-full object-contain" />
          ) : (
            <video
              key={currentMedia.url}
              src={currentMedia.url}
              className="max-h-full max-w-full object-contain"
              autoPlay
              loop
              playsInline
              onEnded={(e) => { e.currentTarget.currentTime = 0; void e.currentTarget.play() }}
            />
          )
        )}

        {!currentMedia && !isStageCleared && currentSlide && (
          <div
            className="text-center w-screen"
          >
            {(() => {
              console.log('🖥️ [LIVE-STAGE] RENDERING SLIDE:', {
                slideType: currentSlide.slideType,
                hasContent: !!currentSlide.content,
                contentType: typeof currentSlide.content
              })
              
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
              
              // Handle regular slides
              console.log('📝 [LIVE-STAGE] RENDERING REGULAR SLIDE')
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

        {!currentMedia && isStageCleared && <div className="text-gray-600 text-4xl">Pantalla limpia</div>}
        {!currentMedia && !isStageCleared && !currentSlide && <div className="text-gray-600 text-4xl">Esperando contenido...</div>}
      </div>
    </div>
  )
}
