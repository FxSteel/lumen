'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Song, SongSlide } from '@/lib/store'
import { useAppStore } from '@/lib/store'
import { Settings, X, Check } from 'lucide-react'
import { parseBibleVerseSlideContent, getBibleVerseSlideText } from '@/lib/bible-slides'
import { useWorkspace } from '@/lib/workspace-provider'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { LiveOutputBroadcaster } from '@/lib/broadcast'
import { LumenBridge, LumenScreen, getGlobalBridge } from '@/lib/lumen-bridge'
import { resolveTypography } from '@lumen/shared'
import type { Typography, NativeState } from '@lumen/shared'
import type { SongTypography } from '@/lib/typography'
import ScreenSelector from './ScreenSelector'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface LiveOutputPanelProps {
  song: Song | null
  slides: SongSlide[]
}

interface StageConfig {
  show_time: boolean
  show_message: boolean
  element_order: string[]
}

type OutputMode = 'slide' | 'logo' | 'announcement' | 'clear' | 'media'
type SongBackgroundType = 'none' | 'image' | 'video'
type TransitionType = 'none' | 'fade' | 'fade-slow'

interface SongBackground {
  backgroundType: SongBackgroundType
  backgroundUrl: string | null
}

function resolveSongBackground(song: Song | null): { backgroundType: SongBackgroundType; backgroundUrl: string | null } {
  const songWithBackground = song as (Song & { background_type?: SongBackgroundType | null; background_url?: string | null }) | null
  const backgroundType = songWithBackground?.background_type
  const backgroundUrl = songWithBackground?.background_url || null

  if (backgroundType === 'image' || backgroundType === 'video') {
    return { backgroundType, backgroundUrl }
  }

  return { backgroundType: 'none', backgroundUrl: null }
}

function toCssWeight(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(Math.max(Math.round(value), 100), 900)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) {
      return Math.min(Math.max(Math.round(numeric), 100), 900)
    }
    if (trimmed === 'normal' || trimmed === 'bold' || trimmed === 'bolder' || trimmed === 'lighter') {
      return trimmed
    }
  }
  return null
}

function resolveSlideFontWeight(slide: any): number | string {
  const candidates = [
    slide?.font_weight,
    slide?.fontWeight,
    slide?.songTypography?.weight,
    slide?.songTypography?.font_weight,
  ]
  for (const candidate of candidates) {
    const resolved = toCssWeight(candidate)
    if (resolved !== null) return resolved
  }
  return 500
}

// Maps the web's snake_case SongTypography onto the shared camelCase Typography
// contract, then lets per-slide numeric overrides win, so the fully-resolved
// typography (color, fontFamily, textShadow, textTransform, …) can be sent to native.
function buildResolvedTypography(
  songTypography: SongTypography | null | undefined,
  overrides: {
    fontSize?: number
    lineHeight?: number
    letterSpacing?: number
    fontWeight?: number | string
  },
): Typography {
  const input: Partial<Typography> = {}
  const st = songTypography
  if (st) {
    if (typeof st.font_family === 'string') input.fontFamily = st.font_family
    const songWeight = typeof st.font_weight === 'number' ? st.font_weight : (typeof st.weight === 'number' ? st.weight : undefined)
    if (typeof songWeight === 'number') input.fontWeight = songWeight
    if (typeof st.font_size === 'number') input.fontSize = st.font_size
    if (typeof st.line_height === 'number') input.lineHeight = st.line_height
    if (typeof st.letter_spacing === 'number') input.letterSpacing = st.letter_spacing
    if (typeof st.color === 'string') input.color = st.color
    if (typeof st.shadow === 'string') input.textShadow = st.shadow
    if (st.text_transform) input.textTransform = st.text_transform
  }
  // Per-slide overrides take precedence over song-level defaults.
  if (typeof overrides.fontSize === 'number') input.fontSize = overrides.fontSize
  if (typeof overrides.lineHeight === 'number') input.lineHeight = overrides.lineHeight
  if (typeof overrides.letterSpacing === 'number') input.letterSpacing = overrides.letterSpacing
  if (typeof overrides.fontWeight === 'number') input.fontWeight = overrides.fontWeight
  return resolveTypography(input)
}

function getOutputModeLabel(mode: OutputMode): string {
  switch (mode) {
    case 'logo':
      return 'Logo'
    case 'announcement':
      return 'Anuncio'
    case 'clear':
      return 'Limpiar'
    default:
      return 'Slide'
  }
}

function readInitialBackground(): SongBackground {
  if (typeof window === 'undefined') return { backgroundType: 'none', backgroundUrl: null }
  const stored = localStorage.getItem('current-song-background')
  if (!stored) return { backgroundType: 'none', backgroundUrl: null }
  try {
    const parsed = JSON.parse(stored) as SongBackground
    if (parsed.backgroundType === 'image' || parsed.backgroundType === 'video') {
      return {
        backgroundType: parsed.backgroundType,
        backgroundUrl: parsed.backgroundUrl || null,
      }
    }
    return { backgroundType: 'none', backgroundUrl: null }
  } catch {
    return { backgroundType: 'none', backgroundUrl: null }
  }
}


function getPreviewBibleFontSizePx(bibleFontSize: number): number {
  return Math.max(10, Math.round(bibleFontSize / 6))
}

function normalizeProjectedLabel(label: string): string {
  const normalized = label
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const deduped = normalized.filter((line, index) => index === 0 || line !== normalized[index - 1])
  return deduped.join(' ')
}

export default function LiveOutputPanel({ song, slides }: LiveOutputPanelProps) {
  const { activeWorkspaceId } = useWorkspace()
  const { currentSlideId } = useAppStore()
  const broadcasterRef = useRef<LiveOutputBroadcaster | null>(null)
  const bridgeRef = useRef<LumenBridge | null>(null)
  const outputModeRef = useRef<OutputMode>('clear')
  const previousSlideIdRef = useRef<string | null>(currentSlideId ?? null)
  const lastSlideForBridgeRef = useRef<{ main: any; stage: any } | null>(null)
  const lastBroadcastSlideRef = useRef<any | null>(null)
  const lastVerseTextRef = useRef<string>('')
  const lastBackgroundRef = useRef<{ backgroundType: 'none' | 'image' | 'video'; backgroundUrl: string | null }>({ backgroundType: 'none', backgroundUrl: null })
  const transitionTypeRef = useRef<TransitionType>((() => {
    if (typeof window === 'undefined') return 'none'
    const stored = localStorage.getItem('transition-type')
    return stored === 'fade' || stored === 'fade-slow' ? stored : 'none'
  })())
  const previewVisibleRef = useRef(true)

  const [displayLumenConnected, setDisplayLumenConnected] = useState(false)
  const [displayLumenScreens, setLumenScreens] = useState<LumenScreen[]>([])
  // Latest native health reported by Lumen via `state` message.
  // null = state not yet received (unknown → UI degrades gracefully).
  const [displayLumenState, setDisplayLumenState] = useState<NativeState | null>(null)
  
  // Pantalla Principal state
  const [outputMode, setOutputMode] = useState<OutputMode>('clear')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [announcementUrl, setAnnouncementUrl] = useState<string | null>(null)
  
  // Preview state - for sidebar previews to match what's showing on external screens
  const [previewCurrentSlide, setPreviewCurrentSlide] = useState<any>(null)
  const [previewSongBackground, setPreviewSongBackground] = useState<SongBackground>(readInitialBackground)
  const [bibleFontSize, setBibleFontSize] = useState<number>(80)
  
  // Pantalla Escenario state
  const [stageMessage, setStageMessage] = useState('')
  const [stageMessageDisplay, setStageMessageDisplay] = useState<string>('')
  const [stageConfig, setStageConfig] = useState<StageConfig>({
    show_time: true,
    show_message: true,
    element_order: ['time', 'message', 'content'],
  })
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showMainConfigModal, setShowMainConfigModal] = useState(false)
  const [transitionType, setTransitionType] = useState<TransitionType>(() => {
    if (typeof window === 'undefined') return 'none'
    const stored = localStorage.getItem('transition-type')
    return stored === 'fade' || stored === 'fade-slow' ? stored : 'none'
  })
  const [previewVisible, setPreviewVisible] = useState(true)

  function setTransitionTypeSync(t: TransitionType) {
    transitionTypeRef.current = t
    setTransitionType(t)
    localStorage.setItem('transition-type', t)
  }
  function setPreviewVisibleSync(v: boolean) {
    previewVisibleRef.current = v
    setPreviewVisible(v)
  }
  function getPreviewFadeDuration() {
    const t = transitionTypeRef.current
    return t === 'fade' ? 400 : t === 'fade-slow' ? 800 : 0
  }
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString())
  const [isStageCleared, setIsStageCleared] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('output-mode') === 'clear'
  })
  
  // Media projection
  const [currentMedia, setCurrentMedia] = useState<{ mediaType: 'image' | 'video'; url: string } | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem('current-media')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  // Bible verse text loading
  const [verseLoading, setVerseLoading] = useState(false)

  const songWithBackground = song as (Song & {
    background_type?: SongBackgroundType | null
    background_url?: string | null
  }) | null

  const currentSlide = currentSlideId ? slides.find(s => s.id === currentSlideId) : null


  useEffect(() => {
    if (!activeWorkspaceId) return

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('bible_font_size, transition_type')
        .eq('workspace_id', activeWorkspaceId)
        .maybeSingle()

      if (error) {
        console.error('[PREVIEW] Error loading workspace settings:', error)
        return
      }

      if (typeof data?.bible_font_size === 'number') {
        setBibleFontSize(data.bible_font_size)
      }

      const t = data?.transition_type
      if (t === 'none' || t === 'fade' || t === 'fade-slow') {
        setTransitionTypeSync(t)
      }
    }

    loadSettings()
  }, [activeWorkspaceId])

  // Initialize Lumen bridge (singleton shared across components)
  useEffect(() => {
    const bridge = getGlobalBridge()
    if (!bridge) return

    bridge.onConnectionChange = (connected) => {
      setDisplayLumenConnected(connected)
      // Drop stale native health on disconnect so NDI status reverts to "unknown".
      if (!connected) setDisplayLumenState(null)
      if (connected) {
        // Sync current state to Lumen on connect
        bridge.sendBackground(lastBackgroundRef.current.backgroundType, lastBackgroundRef.current.backgroundUrl)
        if (outputModeRef.current === 'media') {
          // Resync media to native app on reconnect
          try {
            const stored = localStorage.getItem('current-media')
            if (stored) {
              const { mediaType, url } = JSON.parse(stored)
              bridge.sendMedia(mediaType, url)
            }
          } catch { /* ignore */ }
        } else {
          bridge.sendDisplayMode(outputModeRef.current)
        }
        if (outputModeRef.current === 'slide') {
          if (lastSlideForBridgeRef.current) {
            bridge.sendSlide('main', lastSlideForBridgeRef.current.main)
            bridge.sendSlide('stage', lastSlideForBridgeRef.current.stage)
          } else {
            // Fallback: restore from localStorage when component remounted (tab switch)
            try {
              const stored = localStorage.getItem('current-slide')
              if (stored) {
                const slideData = JSON.parse(stored)
                const resolvedTypography = buildResolvedTypography(slideData.songTypography, {
                  fontSize: typeof slideData.fontSize === 'number' ? slideData.fontSize : undefined,
                  lineHeight: typeof slideData.lineHeight === 'number' ? slideData.lineHeight : undefined,
                  letterSpacing: typeof slideData.letterSpacing === 'number' ? slideData.letterSpacing : undefined,
                  fontWeight: typeof slideData.fontWeight === 'number' ? slideData.fontWeight : undefined,
                })
                const transition = transitionTypeRef.current
                bridge.sendSlide('main', { ...slideData, type: slideData.slideType, typography: resolvedTypography, textAlign: 'center', transitionType: transition, transition })
                bridge.sendSlide('stage', { reference: slideData.label, type: slideData.slideType, typography: resolvedTypography, textAlign: 'center', transitionType: transition, transition })
              }
            } catch { /* ignore */ }
          }
        }
        // Sync stage state on connect
        bridge.sendStageTime(new Date().toLocaleTimeString())
        bridge.sendStageConfig(stageConfig.show_time, stageConfig.show_message)
        const savedMessage = localStorage.getItem('stage-current-message')
        if (savedMessage) bridge.sendStageMessage(savedMessage)
      }
    }
    bridge.onScreensDetected = (screens) => setLumenScreens(screens)
    // Surface real native health (version + whether NDI is actually available).
    bridge.onState = (state) => setDisplayLumenState(state)
    bridgeRef.current = bridge

    // Sync initial connection state
    setDisplayLumenConnected(bridge.isConnected)
    // If already connected (e.g. tab switch), request screens again since onopen won't fire
    if (bridge.isConnected) {
      bridge.requestScreens()
    }

    return () => {
      // Clear callbacks but keep singleton alive (BibleBrowser may still use it)
      bridge.onConnectionChange = undefined
      bridge.onScreensDetected = undefined
      bridge.onState = undefined
      bridgeRef.current = null
    }
  }, [])

  // Initialize broadcaster and listen to broadcasts for preview updates
  useEffect(() => {
    broadcasterRef.current = new LiveOutputBroadcaster()
    const storedMode = localStorage.getItem('output-mode')
    if (storedMode === 'slide' || storedMode === 'logo' || storedMode === 'announcement' || storedMode === 'clear') {
      setOutputMode(storedMode)
      outputModeRef.current = storedMode
    }
    
    // Create a listener channel for preview updates
    const previewChannel = new BroadcastChannel('live-output-sync')
    
    previewChannel.addEventListener('message', (event) => {
      const data = event.data
      console.log('[PREVIEW] Received broadcast for preview update:', data)
      
      switch (data.type) {
        case 'slide-change':
          console.log('[PREVIEW] Updating preview with slide:', data.payload)
          {
            // Always switch to slide mode in the preview
            outputModeRef.current = 'slide'
            setOutputMode('slide')
            setIsStageCleared(false)

            const duration = getPreviewFadeDuration()
            if (duration > 0) {
              if (previewVisibleRef.current) {
                setPreviewVisibleSync(false)
                setTimeout(() => {
                  setPreviewCurrentSlide(data.payload)
                  setPreviewVisibleSync(true)
                }, duration)
              } else {
                // Already faded out (e.g. after clear), just set and fade in
                setPreviewCurrentSlide(data.payload)
                setPreviewVisibleSync(true)
              }
            } else {
              setPreviewCurrentSlide(data.payload)
              setPreviewVisibleSync(true) // ensure visible in case it was faded out
            }
          }
          break

        case 'display-mode':
          console.log('[PREVIEW] Updating preview display mode:', data.payload.mode)
          {
            const mode = data.payload.mode as OutputMode
            outputModeRef.current = mode

            if (mode === 'clear') {
              setIsStageCleared(true)
              const duration = getPreviewFadeDuration()
              if (duration > 0) {
                setPreviewVisibleSync(false)
                setTimeout(() => {
                  setOutputMode('clear')
                  // previewVisible stays false — slide-change will fade back in
                }, duration)
              } else {
                setOutputMode('clear')
              }
            } else {
              setOutputMode(mode)
              setPreviewVisibleSync(true)
              if (mode === 'slide') setIsStageCleared(false)
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
            setPreviewSongBackground({
              backgroundType: data.payload.backgroundType,
              backgroundUrl: data.payload.backgroundUrl || null,
            })
          } else {
            setPreviewSongBackground({ backgroundType: 'none', backgroundUrl: null })
          }
          localStorage.setItem('current-song-background', JSON.stringify(data.payload))
          break

        case 'stage-message':
          console.log('[STAGE PREVIEW] Received stage-message:', data.payload?.message)
          setStageMessageDisplay(data.payload?.message || '')
          break

        case 'stage-time':
          console.log('[STAGE PREVIEW] Received stage-time:', data.payload?.time)
          setCurrentTime(data.payload?.time || '')
          break

        case 'display-media':
          if (data.payload?.url) {
            const media = { mediaType: data.payload.mediaType as 'image' | 'video', url: data.payload.url }
            setCurrentMedia(media)
            outputModeRef.current = 'media'
            setOutputMode('media')
            setIsStageCleared(false)
            setPreviewVisibleSync(true)
            localStorage.setItem('current-media', JSON.stringify(media))
            localStorage.setItem('output-mode', 'media')
          }
          break

        case 'stage-config':
          if (typeof data.payload?.show_time === 'boolean' || typeof data.payload?.show_message === 'boolean') {
            setStageConfig((prev) => ({
              ...prev,
              show_time: typeof data.payload?.show_time === 'boolean' ? data.payload.show_time : prev.show_time,
              show_message: typeof data.payload?.show_message === 'boolean' ? data.payload.show_message : prev.show_message,
            }))
          }
          break
      }
    })
    
    return () => {
      if (broadcasterRef.current) {
        broadcasterRef.current.close()
      }
      previewChannel.close()
    }
  }, [])

  useEffect(() => {
    outputModeRef.current = outputMode
    localStorage.setItem('output-mode', outputMode)
  }, [outputMode])

  // Broadcast slide changes to live output windows
  useEffect(() => {
    if (!broadcasterRef.current) return

    const { backgroundType, backgroundUrl } = resolveSongBackground(song)
    broadcasterRef.current.sendSongBackground(backgroundType, backgroundUrl)
    lastBackgroundRef.current = { backgroundType, backgroundUrl }
    bridgeRef.current?.sendBackground(backgroundType, backgroundUrl)
    localStorage.setItem(
      'current-song-background',
      JSON.stringify({ backgroundType, backgroundUrl })
    )
  }, [song?.id, songWithBackground?.background_type, songWithBackground?.background_url])

  useEffect(() => {
    if (currentSlide && broadcasterRef.current) {
      // Use per-slide typography from DB with safe fallbacks.
      const fontSize = typeof currentSlide.font_size === 'number' ? currentSlide.font_size : 100
      const lineHeight = typeof currentSlide.line_height === 'number' ? currentSlide.line_height : 1.2
      const letterSpacing = typeof currentSlide.letter_spacing === 'number' ? currentSlide.letter_spacing : 0
      const fontWeight = resolveSlideFontWeight({
        ...currentSlide,
        songTypography: song?.typography || null,
      })
      // Full, resolved typography for the native bridge payloads (both song and bible verse).
      const resolvedTypography = buildResolvedTypography(song?.typography, {
        fontSize,
        lineHeight,
        letterSpacing,
        fontWeight,
      })
      const bibleTypography = buildResolvedTypography(song?.typography, {
        fontSize: bibleFontSize,
      })
      const slideData = {
        slideId: currentSlide.id,
        songId: song?.id || null,
        content: currentSlide.content,
        fontSize: fontSize, // Use font_size from database
        lineHeight,
        letterSpacing,
        fontWeight,
        slideType: currentSlide.type,
        label: currentSlide.label,
        songTypography: song?.typography || null,
      }
      
      console.log('[BROADCAST] Slide:', currentSlide.id)
      console.log('[BROADCAST] font_size from DB:', currentSlide.font_size, '(type:', typeof currentSlide.font_size + ')')
      console.log('[BROADCAST] fontSize to use:', fontSize)
      
      // Store in localStorage for output window initial state
      localStorage.setItem('current-slide', JSON.stringify(slideData))

      // Only switch from clear/media to slide when the user explicitly changed the slide selection.
      // Re-renders due to typography or other dep changes must NOT override a manual clear.
      const slideChanged = currentSlideId !== previousSlideIdRef.current
      if (slideChanged && (outputModeRef.current === 'clear' || outputModeRef.current === 'media')) {
        outputModeRef.current = 'slide'
        setOutputMode('slide')
        setIsStageCleared(false)
        setCurrentMedia(null)
        localStorage.removeItem('current-media')
      }
      if (outputModeRef.current === 'slide' && slideChanged) {
        const broadcastPayload = {
          ...currentSlide,
          songId: song?.id || null,
          songTypography: song?.typography || null,
          lineHeight,
          letterSpacing,
          fontWeight,
          transitionType,
        }
        lastBroadcastSlideRef.current = broadcastPayload
        localStorage.setItem('last-broadcast-slide', JSON.stringify(broadcastPayload))
        broadcasterRef.current.sendSlideChange(broadcastPayload)
        console.log('[BROADCAST] ✅ Slide broadcasted with fontSize:', fontSize)

        // Track last slide for bridge sync on reconnect
        if (currentSlide.type === 'bible_verse') {
          const verseContent = parseBibleVerseSlideContent(currentSlide)
          lastVerseTextRef.current = '' // will be filled by loadVerseText effect
          lastSlideForBridgeRef.current = {
            main: {
              typography: bibleTypography,
              type: 'bible_verse',
              verseText: '',
              displayReference: verseContent?.displayReference || currentSlide.label,
              bibleVersionName: verseContent?.bibleVersionName || '',
              fontSize: bibleFontSize,
              textAlign: 'center',
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
            stage: {
              typography: bibleTypography,
              type: 'bible_verse',
              verseText: '',
              displayReference: verseContent?.displayReference || currentSlide.label,
              bibleVersionName: verseContent?.bibleVersionName || '',
              fontSize: bibleFontSize,
              textAlign: 'center',
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
          }
        } else {
          lastSlideForBridgeRef.current = {
            main: {
              typography: resolvedTypography,
              content: currentSlide.content,
              reference: currentSlide.label,
              type: currentSlide.type,
              fontSize,
              lineHeight,
              letterSpacing,
              fontWeight,
              textAlign: 'center',
              songTypography: song?.typography || null,
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
            stage: {
              typography: resolvedTypography,
              content: currentSlide.content,
              reference: currentSlide.label,
              type: currentSlide.type,
              fontSize,
              lineHeight,
              letterSpacing,
              fontWeight,
              textAlign: 'center',
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
          }
        }

        // Forward to Lumen if connected (bible verses will resend once verseText loads)
        if (bridgeRef.current?.isConnected) {
          bridgeRef.current.sendSlide('main', lastSlideForBridgeRef.current.main)
          bridgeRef.current.sendSlide('stage', lastSlideForBridgeRef.current.stage)
        }
      } else {
        // Logo/announcement active: don't broadcast, but update refs so that
        // deactivating logo/announcement restores the most recently selected slide.
        const broadcastPayload = {
          ...currentSlide,
          songId: song?.id || null,
          songTypography: song?.typography || null,
          lineHeight,
          letterSpacing,
          fontWeight,
        }
        lastBroadcastSlideRef.current = broadcastPayload
        localStorage.setItem('last-broadcast-slide', JSON.stringify(broadcastPayload))

        if (currentSlide.type === 'bible_verse') {
          const verseContent = parseBibleVerseSlideContent(currentSlide)
          lastSlideForBridgeRef.current = {
            main: {
              typography: bibleTypography,
              type: 'bible_verse',
              verseText: '',
              displayReference: verseContent?.displayReference || currentSlide.label,
              bibleVersionName: verseContent?.bibleVersionName || '',
              fontSize: bibleFontSize,
              textAlign: 'center',
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
            stage: {
              typography: bibleTypography,
              type: 'bible_verse',
              verseText: '',
              displayReference: verseContent?.displayReference || currentSlide.label,
              bibleVersionName: verseContent?.bibleVersionName || '',
              fontSize: bibleFontSize,
              textAlign: 'center',
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
          }
        } else {
          lastSlideForBridgeRef.current = {
            main: {
              typography: resolvedTypography,
              content: currentSlide.content,
              reference: currentSlide.label,
              type: currentSlide.type,
              fontSize,
              lineHeight,
              letterSpacing,
              fontWeight,
              textAlign: 'center',
              songTypography: song?.typography || null,
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
            stage: {
              typography: resolvedTypography,
              content: currentSlide.content,
              reference: currentSlide.label,
              type: currentSlide.type,
              fontSize,
              lineHeight,
              letterSpacing,
              fontWeight,
              textAlign: 'center',
              contentPadding: 80,
              transitionType,
              transition: transitionType,
            },
          }
        }

        const mode = getOutputModeLabel(outputModeRef.current)
        if (currentSlideId !== previousSlideIdRef.current) {
          toast.info(`Slide seleccionado, pero no está visible porque está activo: ${mode}`)
        }
      }
    }
    previousSlideIdRef.current = currentSlideId ?? null
  }, [currentSlideId, song?.id, song?.typography, currentSlide])

  // Broadcast clear when song is deselected (null) or slide is cleared
  useEffect(() => {
    if (!song && broadcasterRef.current) {
      console.log('[BROADCAST] Song deselected - clearing live output')
      broadcasterRef.current.sendDisplayMode('clear')
      broadcasterRef.current.sendSongBackground('none', null)
      localStorage.removeItem('current-slide')
      localStorage.removeItem('current-song-background')
    }
  }, [song])

  // Load workspace logo and announcement URLs
  useEffect(() => {
    if (!activeWorkspaceId) return

    const loadAssets = async () => {
      try {
        const { data } = await supabase
          .from('workspace_settings')
          .select('logo_url, announcement_url, stage_show_time, stage_show_message, stage_element_order')
          .eq('workspace_id', activeWorkspaceId)
          .single()

        if (data) {
          setLogoUrl(data.logo_url)
          setAnnouncementUrl(data.announcement_url)
          if (data.stage_show_time !== null) setStageConfig(prev => ({ ...prev, show_time: data.stage_show_time }))
          if (data.stage_show_message !== null) setStageConfig(prev => ({ ...prev, show_message: data.stage_show_message }))
          if (data.stage_element_order) setStageConfig(prev => ({ ...prev, element_order: data.stage_element_order }))
        }
      } catch (err) {
        console.error('[LiveOutputPanel] Failed to load assets:', err)
      }
    }

    loadAssets()
  }, [activeWorkspaceId])

  // Load bible verse text and push to Lumen bridge once available
  useEffect(() => {
    const loadVerseText = async () => {
      if (!currentSlide || currentSlide.type !== 'bible_verse') {
        lastVerseTextRef.current = ''
        return
      }

      setVerseLoading(true)
      try {
        const text = await getBibleVerseSlideText(currentSlide)
        lastVerseTextRef.current = text

        // Update cached slide payload with actual verse text
        if (lastSlideForBridgeRef.current) {
          lastSlideForBridgeRef.current.main.verseText = text
          lastSlideForBridgeRef.current.stage.verseText = text
        }

        // Re-send to bridge now that we have the verse text
        if (bridgeRef.current?.isConnected && outputModeRef.current === 'slide' && lastSlideForBridgeRef.current) {
          bridgeRef.current.sendSlide('main', lastSlideForBridgeRef.current.main)
          bridgeRef.current.sendSlide('stage', lastSlideForBridgeRef.current.stage)
        }
      } catch (err) {
        console.error('[LiveOutputPanel] Failed to load verse text:', err)
      } finally {
        setVerseLoading(false)
      }
    }

    loadVerseText()
  }, [currentSlide])

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      const formattedTime = new Date().toLocaleTimeString()
      setCurrentTime(formattedTime)
      localStorage.setItem('stage-current-time', formattedTime)
      console.log('[STAGE TIME] Broadcasting:', formattedTime)
      broadcasterRef.current?.sendStageTime(formattedTime)
      bridgeRef.current?.sendStageTime(formattedTime)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-disappear stage message after 10 seconds
  useEffect(() => {
    if (!stageMessageDisplay) return
    const timer = setTimeout(() => setStageMessageDisplay(''), 10000)
    return () => clearTimeout(timer)
  }, [stageMessageDisplay])

  useEffect(() => {
    broadcasterRef.current?.sendStageConfig(stageConfig.show_time, stageConfig.show_message)
    bridgeRef.current?.sendStageConfig?.(stageConfig.show_time, stageConfig.show_message)
  }, [stageConfig.show_time, stageConfig.show_message])



  const broadcastLogoClick = async () => {
    if (!broadcasterRef.current) return
    try {
      broadcasterRef.current.sendDisplayMode('logo', { logoUrl })
      bridgeRef.current?.sendDisplayMode('logo', { logoUrl })
      console.log('[BROADCAST] Logo click')
    } catch (err) {
      console.error('[BROADCAST] Failed to broadcast logo:', err)
    }
  }

  const broadcastAnnouncementClick = async () => {
    if (!broadcasterRef.current) return
    try {
      broadcasterRef.current.sendDisplayMode('announcement', { announcementUrl })
      bridgeRef.current?.sendDisplayMode('announcement', { announcementUrl })
      console.log('[BROADCAST] Announcement click')
    } catch (err) {
      console.error('[BROADCAST] Failed to broadcast announcement:', err)
    }
  }

  const broadcastClearClick = async () => {
    if (!broadcasterRef.current) return
    try {
      broadcasterRef.current.sendDisplayMode('clear')
      bridgeRef.current?.sendDisplayMode('clear')
      outputModeRef.current = 'clear'
      setOutputMode('clear')
      // Clear the last slide so deactivating logo/announcement doesn't restore it
      lastBroadcastSlideRef.current = null
      lastSlideForBridgeRef.current = null
      console.log('[BROADCAST] Clear click')
    } catch (err) {
      console.error('[BROADCAST] Failed to broadcast clear:', err)
    }
  }

  const handlePrincipalButton = async (button: 'logo' | 'announcement' | 'clear') => {
    if (!broadcasterRef.current) return

    if (outputModeRef.current === button) {
      setOutputMode('slide')
      broadcasterRef.current.sendDisplayMode('slide')
      bridgeRef.current?.sendDisplayMode('slide')

      // Only restore a slide if one was actually projected during this session.
      // lastBroadcastSlideRef is only set when the user explicitly selects a slide,
      // so it's null if no slide was ever activated. Avoid reading from localStorage
      // to prevent projecting stale slides from a previous session.
      if (lastBroadcastSlideRef.current) {
        broadcasterRef.current.sendSlideChange(lastBroadcastSlideRef.current)

        if (bridgeRef.current?.isConnected && lastSlideForBridgeRef.current) {
          bridgeRef.current.sendSlide('main', lastSlideForBridgeRef.current.main)
          bridgeRef.current.sendSlide('stage', lastSlideForBridgeRef.current.stage)
        }
      }
      return
    }

    setOutputMode(button)
    if (button === 'logo') {
      await broadcastLogoClick()
    } else if (button === 'announcement') {
      await broadcastAnnouncementClick()
    } else {
      await broadcastClearClick()
    }
  }

  const handleSendMessage = async () => {
    if (!stageMessage.trim()) return
    if (!stageConfig.show_message) {
      toast.warning('Espacio de mensaje oculto en configuración')
      return
    }
    setStageMessageDisplay(stageMessage)
    localStorage.setItem('stage-current-message', stageMessage)
    
    // Broadcast message to stage window
    if (broadcasterRef.current) {
      try {
        console.log('[STAGE MESSAGE] Broadcasting:', stageMessage)
        broadcasterRef.current.sendStageMessage(stageMessage)
        bridgeRef.current?.sendStageMessage(stageMessage)
      } catch (err) {
        console.error('[BROADCAST] Failed to broadcast message:', err)
      }
    }
    
    setStageMessage('')
  }

  const saveStageConfig = async () => {
    if (!activeWorkspaceId) return

    try {
      await supabase
        .from('workspace_settings')
        .update({
          stage_show_time: stageConfig.show_time,
          stage_show_message: stageConfig.show_message,
          stage_element_order: stageConfig.element_order,
        })
        .eq('workspace_id', activeWorkspaceId)

      broadcasterRef.current?.sendStageConfig(stageConfig.show_time, stageConfig.show_message)

      toast.success('Configuración guardada')
      setShowConfigModal(false)
    } catch (err: any) {
      console.error('[LiveOutputPanel] Failed to save config:', err)
      toast.error('Error guardando configuración')
    }
  }

  // Get current display content for preview
  const getPrincipalContent = () => {
    const shouldShowBackground =
      outputMode !== 'announcement' &&
      previewSongBackground.backgroundType !== 'none' &&
      Boolean(previewSongBackground.backgroundUrl)

    if (outputMode === 'clear') {
      return { type: 'clear', content: null, songBackground: shouldShowBackground ? previewSongBackground : null }
    }
    if (outputMode === 'logo' && logoUrl) {
      return { type: 'logo', content: logoUrl, songBackground: shouldShowBackground ? previewSongBackground : null }
    }
    if (outputMode === 'announcement' && announcementUrl) {
      return { type: 'anuncio', content: announcementUrl, songBackground: null }
    }
    if (outputMode === 'media' && currentMedia) {
      return { type: 'media', content: currentMedia, songBackground: null }
    }
    if (outputMode === 'slide' && previewCurrentSlide) {
      return { type: 'slide', content: previewCurrentSlide, songBackground: shouldShowBackground ? previewSongBackground : null }
    }
    if (shouldShowBackground) {
      return { type: 'clear', content: null, songBackground: previewSongBackground }
    }
    return { type: 'blank', content: null, songBackground: null }
  }

  const getStageContent = () => {
    if (isStageCleared && outputMode !== 'media') return null
    return previewCurrentSlide
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-4 p-4">
      {/* SECTION 1: PANTALLA PRINCIPAL */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Pantalla Principal</h3>
          <button
            onClick={() => setShowMainConfigModal(true)}
            className="p-2 bg-[#2a2a2a] rounded hover:bg-[#333] text-gray-300 hover:text-white transition-colors"
            title="Configuración de pantalla principal"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className="bg-black aspect-video rounded-lg border border-[#333] flex items-center justify-center overflow-hidden">
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              opacity: previewVisible ? 1 : 0,
              transition: transitionType !== 'none' ? `opacity ${transitionType === 'fade-slow' ? 800 : 400}ms ease-in-out` : 'none',
            }}
          >
            <PantallaContent content={getPrincipalContent()} bibleFontSize={bibleFontSize} />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handlePrincipalButton('logo')}
            disabled={!logoUrl}
            className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
              outputMode === 'logo'
                ? 'bg-[#7C6FD8] text-white'
                : logoUrl
                ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                : 'bg-[#1a1a1a] text-gray-500 cursor-not-allowed'
            }`}
          >
            Logo
          </button>
          <button
            onClick={() => handlePrincipalButton('announcement')}
            disabled={!announcementUrl}
            className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
              outputMode === 'announcement'
                ? 'bg-[#7C6FD8] text-white'
                : announcementUrl
                ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                : 'bg-[#1a1a1a] text-gray-500 cursor-not-allowed'
            }`}
          >
            Anuncio
          </button>
          <button
            onClick={broadcastClearClick}
            className="py-2 px-3 rounded text-sm font-medium transition-colors bg-[#2a2a2a] text-gray-300 hover:bg-[#333]"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* SEPARATOR */}
      <div className="border-t border-[#333] my-2"></div>

      {/* SECTION 3: PANTALLA ESCENARIO */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Pantalla Escenario</h3>
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 bg-[#2a2a2a] rounded hover:bg-[#333] text-gray-300 hover:text-white transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* Stage Preview */}
        <StagePreview
          content={getStageContent()}
          media={outputMode === 'media' ? currentMedia : null}
          verseLoading={verseLoading}
          bibleFontSize={bibleFontSize}
          stageMessage={stageMessageDisplay}
          stageTime={currentTime}
          showMessage={stageConfig.show_message}
          showTime={stageConfig.show_time}
        />
      </div>

      {/* SECTION 4: SEND MESSAGE */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={60}
            placeholder="Escribe un mensaje..."
            value={stageMessage}
            onChange={(e) => {
              if (e.target.value.length <= 60) {
                setStageMessage(e.target.value)
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent"
          />
          <button
            onClick={handleSendMessage}
            className="px-3 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white rounded transition-colors"
          >
            Enviar
          </button>
        </div>
        <div className="text-xs text-gray-400">
          {stageMessage.length}/60 caracteres
        </div>
      </div>

      {/* SEPARATOR */}
      <div className="border-t border-[#333] my-2"></div>

      {/* SECTION 4: PANTALLAS CONECTADAS */}
      <ScreenSelector
        displayLumenConnected={displayLumenConnected}
        displayLumenScreens={displayLumenScreens}
        ndiAvailable={displayLumenState?.ndiAvailable}
        nativeVersion={displayLumenState?.version}
        onDisplayLumenAssignScreen={(screenId, role) => {
          if (role !== 'none') {
            bridgeRef.current?.assignScreen(screenId, role)
          }
        }}
        onSendNdiConfig={(outputs) => {
          bridgeRef.current?.sendNdiConfig(outputs)
        }}
      />

      {/* Configuration Modal */}
      {showConfigModal && (
        <StageConfigModal
          config={stageConfig}
          onConfigChange={setStageConfig}
          onSave={saveStageConfig}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {/* Main Screen Config Modal */}
      <MainScreenConfigModal
        open={showMainConfigModal}
        onOpenChange={setShowMainConfigModal}
        workspaceId={activeWorkspaceId}
        transitionType={transitionType}
        onTransitionTypeChange={setTransitionTypeSync}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function PantallaContent({ content, bibleFontSize }: { content: any; bibleFontSize: number }) {
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const previewTextRef = useRef<HTMLParagraphElement>(null)
  const previewRefRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = previewContainerRef.current
    const textEl = previewTextRef.current
    const refEl = previewRefRef.current
    if (!container || !textEl || !refEl) return

    const startSize = getPreviewBibleFontSizePx(bibleFontSize)
    const maxHeight = container.clientHeight

    textEl.style.fontSize = `${startSize}px`
    refEl.style.fontSize = `${Math.max(6, Math.round(startSize * 0.4))}px`

    if (container.scrollHeight <= maxHeight) return

    let lo = 4, hi = startSize
    for (let i = 0; i < 15; i++) {
      const mid = (lo + hi) / 2
      textEl.style.fontSize = `${mid}px`
      refEl.style.fontSize = `${Math.max(6, Math.round(mid * 0.4))}px`
      if (container.scrollHeight <= maxHeight) {
        lo = mid
      } else {
        hi = mid
      }
    }
    textEl.style.fontSize = `${lo}px`
    refEl.style.fontSize = `${Math.max(6, Math.round(lo * 0.4))}px`
  })

  if (!content) return <div className="text-gray-400">Sin contenido</div>

  const { type, content: data, songBackground } = content

  const backgroundLayer =
    songBackground && songBackground.backgroundType !== 'none' && songBackground.backgroundUrl ? (
      <>
        {songBackground.backgroundType === 'image' ? (
          <img
            src={songBackground.backgroundUrl}
            alt="Fondo canción"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <video
            src={songBackground.backgroundUrl}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        )}
        <div className="absolute inset-0 bg-black/30" />
      </>
    ) : null

  if (type === 'media' && data) {
    const { mediaType, url } = data as { mediaType: 'image' | 'video'; url: string }
    return (
      <div className="h-full w-full flex items-center justify-center bg-black">
        {mediaType === 'image' ? (
          <img src={url} alt="Media" className="max-h-full max-w-full object-contain" />
        ) : (
          <video
            key={url}
            src={url}
            autoPlay
            muted
            loop
            playsInline
            className="max-h-full max-w-full object-contain"
            onEnded={(e) => { e.currentTarget.currentTime = 0; void e.currentTarget.play() }}
          />
        )}
      </div>
    )
  }

  if (type === 'logo' && data) {
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        {backgroundLayer}
        <img
          src={data}
          alt="Logo"
          className="max-w-full max-h-full object-contain relative z-10"
        />
      </div>
    )
  }

  if (type === 'anuncio' && data) {
    return (
      <img
        src={data}
        alt="Anuncio"
        className="max-w-full max-h-full object-contain"
      />
    )
  }

  if (type === 'blank') {
    return <div className="text-gray-500 text-sm">Pantalla limpia</div>
  }

  if (type === 'clear') {
    if (backgroundLayer) {
      return <div className="relative h-full w-full">{backgroundLayer}</div>
    }
    return <div className="text-gray-500 text-sm">Pantalla limpia</div>
  }

  if (type === 'slide' && data) {
    const previewStyle = {
      fontWeight: resolveSlideFontWeight(data),
      lineHeight: `${data?.lineHeight ?? 1.2}`,
      letterSpacing: `${data?.letterSpacing ?? 0}px`,
    }

    // Check if it's a bible verse by explicit type
    const isBibleVerse = data.slideType === 'bible_verse' || data.type === 'bible_verse'

    if (isBibleVerse) {
      // Use direct properties from broadcast (no JSON parsing needed)
      return (
        <div className="relative h-full w-full">
          {backgroundLayer}
          <div ref={previewContainerRef} className="relative z-10 text-center px-6 py-4 h-full flex flex-col justify-center overflow-hidden">
            <p
              ref={previewTextRef}
              className="text-white whitespace-pre-wrap break-words"
              style={{ ...previewStyle, lineHeight: '1.4' }}
            >
              {data.verseText || data.content || 'Contenido no disponible'}
            </p>
            <div ref={previewRefRef} className="mt-1 text-gray-300">
              {normalizeProjectedLabel(
                data.projectedReferenceLabel ||
                  `${data.displayReference || 'Referencia'} - ${data.bibleVersionAbbreviation || 'NVI'} (${data.bibleVersionName || 'Nueva Versión Internacional'})`
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative h-full w-full">
        {backgroundLayer}
        <div className="relative z-10 text-center space-y-2 p-6 overflow-auto max-h-full h-full flex items-center justify-center">
          <p className="text-white text-base font-mono whitespace-pre-wrap word-wrap break-word" style={previewStyle}>
            {data.content}
          </p>
        </div>
      </div>
    )
  }

  return <div className="text-gray-400">Sin contenido</div>
}

function StagePreview({
  content,
  media,
  verseLoading,
  bibleFontSize,
  stageMessage,
  stageTime,
  showMessage,
  showTime,
}: {
  content: SongSlide | null
  media: { mediaType: 'image' | 'video'; url: string } | null
  verseLoading: boolean
  bibleFontSize: number
  stageMessage: string
  stageTime: string
  showMessage: boolean
  showTime: boolean
}) {
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const stageTextRef = useRef<HTMLParagraphElement>(null)
  const stageRefLabelRef = useRef<HTMLDivElement>(null)

  const isBibleVerse = content && (content.type === 'bible_verse' || (content as any).slideType === 'bible_verse')

  let verseData: any = {}
  if (isBibleVerse && content) {
    if (typeof content.content === 'string' && content.content.trim().startsWith('{')) {
      try {
        verseData = JSON.parse(content.content)
      } catch {
        verseData = {}
      }
    } else if (typeof content.content === 'object' && content.content) {
      verseData = content.content
    }
  }

  useLayoutEffect(() => {
    const container = stageContainerRef.current
    const textEl = stageTextRef.current
    const refEl = stageRefLabelRef.current
    if (!container || !textEl || !refEl) return

    const startSize = getPreviewBibleFontSizePx(bibleFontSize)
    const maxHeight = container.clientHeight

    textEl.style.fontSize = `${startSize}px`
    refEl.style.fontSize = `${Math.max(6, Math.round(startSize * 0.4))}px`

    if (container.scrollHeight <= maxHeight) return

    let lo = 4, hi = startSize
    for (let i = 0; i < 15; i++) {
      const mid = (lo + hi) / 2
      textEl.style.fontSize = `${mid}px`
      refEl.style.fontSize = `${Math.max(6, Math.round(mid * 0.4))}px`
      if (container.scrollHeight <= maxHeight) {
        lo = mid
      } else {
        hi = mid
      }
    }
    textEl.style.fontSize = `${lo}px`
    refEl.style.fontSize = `${Math.max(6, Math.round(lo * 0.4))}px`
  })

  return (
    <div className="bg-black border border-[#333] rounded-lg overflow-hidden flex flex-col aspect-video">
      <div className="px-3 pt-3 space-y-2">
        {showTime && stageTime && (
          <div className="text-xs font-semibold text-white/95 bg-white/15 inline-block px-2.5 py-1.5 rounded-md tracking-wide">
            {stageTime}
          </div>
        )}
        {showMessage && stageMessage && (
          <div className="text-[10px] text-yellow-100 bg-yellow-500/30 border border-yellow-500/70 px-2 py-1 rounded">
            {stageMessage}
          </div>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {media ? (
          <div className="h-full w-full flex items-center justify-center">
            {media.mediaType === 'image' ? (
              <img src={media.url} alt="Media" className="max-h-full max-w-full object-contain" />
            ) : (
              <video
                key={media.url}
                src={media.url}
                autoPlay
                muted
                loop
                playsInline
                className="max-h-full max-w-full object-contain"
                onEnded={(e) => { e.currentTarget.currentTime = 0; void e.currentTarget.play() }}
              />
            )}
          </div>
        ) : content ? (
          <div ref={stageContainerRef} className="text-center max-w-full h-full flex flex-col justify-center overflow-hidden">
            {isBibleVerse ? (
              <>
                <p
                  ref={stageTextRef}
                  className="text-white whitespace-pre-wrap break-words"
                  style={{
                    fontWeight: resolveSlideFontWeight(content),
                    lineHeight: '1.4',
                    letterSpacing: `${(content as any)?.letterSpacing ?? 0}px`,
                  }}
                >
                  {verseLoading ? 'Cargando...' : (verseData.verseText || (content as any).verseText || content.content || 'Contenido no disponible')}
                </p>
                <div ref={stageRefLabelRef} className="mt-1 text-gray-300">
                  {normalizeProjectedLabel(
                    verseData.projectedReferenceLabel ||
                      (content as any).projectedReferenceLabel ||
                      `${verseData.displayReference || (content as any).displayReference || content.label || 'Referencia'} - ${(verseData.bibleVersionAbbreviation || (content as any).bibleVersionAbbreviation || 'NVI')} (${verseData.bibleVersionName || (content as any).bibleVersionName || 'Nueva Versión Internacional'})`
                  )}
                </div>
              </>
            ) : (
              <p
                className="text-white font-mono whitespace-pre-wrap word-wrap break-word"
                style={{ fontWeight: resolveSlideFontWeight(content) }}
              >
                {content.content}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sin contenido</p>
        )}
      </div>
    </div>
  )
}

function StageConfigModal({
  config,
  onConfigChange,
  onSave,
  onClose,
}: {
  config: StageConfig
  onConfigChange: (config: StageConfig) => void
  onSave: () => void
  onClose: () => void
}) {
  const [localConfig, setLocalConfig] = useState(config)

  const moveElement = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...localConfig.element_order]
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }
    setLocalConfig({ ...localConfig, element_order: newOrder })
  }

  const toggleVisibility = (type: string) => {
    if (type === 'time') {
      setLocalConfig({ ...localConfig, show_time: !localConfig.show_time })
    } else if (type === 'message') {
      setLocalConfig({ ...localConfig, show_message: !localConfig.show_message })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white">Configurar Pantalla Escenario</h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Visibility Toggles */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">Elementos visibles:</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.show_time}
                onChange={() => toggleVisibility('time')}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">Mostrar hora</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.show_message}
                onChange={() => toggleVisibility('message')}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">Mostrar espacio de mensaje</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">Letras/Biblia (siempre activo)</span>
            </label>
          </div>
        </div>

        {/* Element Order */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300 block">Orden de elementos:</label>
          <div className="space-y-2">
            {localConfig.element_order.map((type, index) => {
              const label =
                type === 'time' ? 'Hora' : type === 'message' ? 'Mensaje' : 'Letras/Biblia'
              return (
                <div key={type} className="flex items-center justify-between bg-[#2a2a2a] p-2 rounded">
                  <span className="text-sm text-gray-300">
                    {index + 1}. {label}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveElement(index, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 text-xs bg-[#333] hover:bg-[#444] disabled:opacity-50 rounded"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveElement(index, 'down')}
                      disabled={index === localConfig.element_order.length - 1}
                      className="px-2 py-1 text-xs bg-[#333] hover:bg-[#444] disabled:opacity-50 rounded"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/5 text-red-300 hover:text-red-200 border border-red-400/30 rounded transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfigChange(localConfig)
              onSave()
            }}
            className="flex-1 px-3 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white rounded transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCREEN CONFIG MODAL
// ═══════════════════════════════════════════════════════════════════

const TRANSITION_OPTIONS: { value: TransitionType; label: string; description: string }[] = [
  { value: 'none', label: 'Sin transición', description: 'El slide cambia de forma instantánea' },
  { value: 'fade', label: 'Fade', description: 'El slide aparece con un fundido suave' },
  { value: 'fade-slow', label: 'Fade lento', description: 'El slide aparece con un fundido más pausado' },
]

function MainScreenConfigModal({
  open,
  onOpenChange,
  workspaceId,
  transitionType,
  onTransitionTypeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string | null
  transitionType: TransitionType
  onTransitionTypeChange: (t: TransitionType) => void
}) {
  const [saving, setSaving] = useState<TransitionType | null>(null)
  const [savedRecently, setSavedRecently] = useState<TransitionType | null>(null)

  const handleSelect = async (value: TransitionType) => {
    if (!workspaceId || saving) return
    const previous = transitionType
    onTransitionTypeChange(value)
    setSaving(value)

    const { error } = await supabase
      .from('workspace_settings')
      .update({ transition_type: value })
      .eq('workspace_id', workspaceId)

    setSaving(null)

    if (error) {
      console.error('[MainScreenConfig] Failed to save transition_type:', error)
      onTransitionTypeChange(previous)
      toast.error('Error al guardar la configuración')
    } else {
      setSavedRecently(value)
      setTimeout(() => setSavedRecently(null), 1500)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border-[#333] text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Configuración de Pantalla Principal</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <p className="text-sm text-gray-400">Transición entre slides</p>
          <div className="space-y-2">
            {TRANSITION_OPTIONS.map((opt) => {
              const isSelected = transitionType === opt.value
              const isSaving = saving === opt.value
              const wasSaved = savedRecently === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  disabled={!!saving}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-[#7C6FD8] bg-[#7C6FD8]/15'
                      : 'border-[#333] bg-[#2a2a2a] hover:bg-[#333]'
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {opt.label}
                    </span>
                    {wasSaved && <Check size={14} className="text-green-400 shrink-0" />}
                    {isSaving && (
                      <div className="w-3.5 h-3.5 border-2 border-[#7C6FD8] border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
