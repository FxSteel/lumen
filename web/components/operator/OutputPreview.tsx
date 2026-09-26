'use client'

import { useState, useEffect } from 'react'
import { Song, SongSlide } from '@/lib/store'
import { useAppStore } from '@/lib/store'
import { Play, Pause } from 'lucide-react'
import { parseBibleVerseSlideContent, getBibleVerseSlideText, getSlideTypeDisplayName } from '@/lib/bible-slides'

interface OutputPreviewProps {
  song: Song
  slides: SongSlide[]
}

export default function OutputPreview({ song, slides }: OutputPreviewProps) {
  const { logoMode, setLogoMode, currentSlideId, setCurrentSlideId } = useAppStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [verseText, setVerseText] = useState<string>('')
  const [verseLoading, setVerseLoading] = useState(false)

  // Reset to first slide when slides change or song changes
  useEffect(() => {
    if (slides.length > 0 && !currentSlideId && slides[0]) {
      setCurrentSlideId(slides[0].id)
    }
  }, [slides.length, currentSlideId, setCurrentSlideId, slides])

  const currentSlide = currentSlideId ? slides.find(s => s.id === currentSlideId) : null

  // Load bible verse text when needed
  useEffect(() => {
    const loadVerseText = async () => {
      if (!currentSlide || currentSlide.type !== 'bible_verse') {
        setVerseText('')
        return
      }

      setVerseLoading(true)
      try {
        const text = await getBibleVerseSlideText(currentSlide)
        setVerseText(text)
      } catch (err) {
        console.error('[OutputPreview] Failed to load verse text:', err)
        setVerseText('[Error cargando versículo]')
      } finally {
        setVerseLoading(false)
      }
    }

    loadVerseText()
  }, [currentSlide])

  const handleNextSlide = () => {
    if (!currentSlide) return
    const currentIndex = slides.findIndex(s => s.id === currentSlide.id)
    if (currentIndex < slides.length - 1) {
      setCurrentSlideId(slides[currentIndex + 1].id)
    }
  }

  const handlePrevSlide = () => {
    if (!currentSlide) return
    const currentIndex = slides.findIndex(s => s.id === currentSlide.id)
    if (currentIndex > 0) {
      setCurrentSlideId(slides[currentIndex - 1].id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="p-3 border-b border-[#333] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Salida en Vivo</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-secondary btn-sm flex items-center gap-2"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pausar' : 'Reproducir'}
            </button>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-gray-400">Logo:</span>
              <button
                onClick={() => setLogoMode(logoMode === 'ON' ? 'OFF' : 'ON')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  logoMode === 'ON'
                    ? 'bg-[#7C6FD8] text-white'
                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                }`}
              >
                {logoMode}
              </button>
            </div>
          </div>
        </div>

        {/* Slide counter */}
        {slides.length > 0 && (
          <div className="text-xs text-gray-400">
            Diapositiva {currentSlide ? slides.findIndex(s => s.id === currentSlide.id) + 1 : 0} de {slides.length}
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-black/50 relative">
        {slides.length === 0 ? (
          <div className="text-center text-gray-400">
            <p>No hay diapositivas</p>
          </div>
        ) : logoMode === 'ON' ? (
          <div className="text-center">
            <div className="text-4xl text-[#7C6FD8]">🎵</div>
            <p className="text-gray-300 mt-4">{song.title}</p>
          </div>
        ) : (
          <div className="w-full h-full p-6 overflow-auto">
            <div className="mb-4">
              {currentSlide?.type === 'bible_verse' ? (
                <BibleVerseDisplay 
                  slide={currentSlide}
                  verseText={verseText}
                  loading={verseLoading}
                />
              ) : (
                <LyricsDisplay slide={currentSlide ?? null} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {slides.length > 0 && (
        <div className="p-3 border-t border-[#333] flex gap-2">
          <button
            onClick={handlePrevSlide}
            disabled={!currentSlide || slides.findIndex(s => s.id === currentSlide.id) === 0}
            className="flex-1 btn-secondary btn-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            onClick={handleNextSlide}
            disabled={!currentSlide || slides.findIndex(s => s.id === currentSlide.id) === slides.length - 1}
            className="flex-1 btn-secondary btn-sm disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

// Helper component for bible verse display
function BibleVerseDisplay({ 
  slide, 
  verseText, 
  loading 
}: { 
  slide: SongSlide
  verseText: string
  loading: boolean 
}) {
  const verseContent = parseBibleVerseSlideContent(slide)
  
  return (
    <div className="text-center space-y-6">
      {/* Reference */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-blue-300">
          {verseContent?.displayReference || 'Versículo bíblico'}
        </h3>
        <p className="text-xs text-gray-400">
          {verseContent?.bibleVersionName}
        </p>
      </div>

      {/* Verse Text */}
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
          </div>
        ) : (
          <p className="text-white text-lg leading-relaxed">
            {verseText}
          </p>
        )}
      </div>
    </div>
  )
}

// Helper component for lyrics display
function LyricsDisplay({ slide }: { slide: SongSlide | null }) {
  if (!slide) return null

  return (
    <>
      <p className="text-xs text-gray-400 mb-2">
        {getSlideTypeDisplayName(slide.type)} {slide.label && `- ${slide.label}`}
      </p>
      <div className="text-white whitespace-pre-wrap font-mono text-sm leading-relaxed">
        {slide.content || ''}
      </div>
    </>
  )
}
