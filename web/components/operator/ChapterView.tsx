'use client'

import { useState, useEffect } from 'react'
import { Book as BookIcon } from 'lucide-react'
import { getBibleVerseSlideText, parseBibleVerseSlideContent } from '@/lib/bible-slides'
import { SongSlide } from '@/lib/store'

interface ChapterViewProps {
  selectedVersion: string | null
  selectedBook: string | null  
  selectedChapter: number | null
  slides: SongSlide[]
}

export default function ChapterView({ 
  selectedVersion,
  selectedBook, 
  selectedChapter,
  slides 
}: ChapterViewProps) {
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({})
  const [loadingVerses, setLoadingVerses] = useState<Set<string>>(new Set())

  // Filter Bible verse slides
  const bibleSlides = slides.filter(slide => slide.type === 'bible_verse')

  useEffect(() => {
    // Load verse texts for Bible slides
    const loadVerseTexts = async () => {
      const textsToLoad = bibleSlides.filter(slide => {
        const slideId = slide.id
        return !verseTexts[slideId] && !loadingVerses.has(slideId)
      })

      if (textsToLoad.length === 0) return

      const newLoadingVerses = new Set(loadingVerses)
      textsToLoad.forEach(slide => newLoadingVerses.add(slide.id))
      setLoadingVerses(newLoadingVerses)

      const newTexts: Record<string, string> = {}
      
      await Promise.all(
        textsToLoad.map(async (slide) => {
          try {
            const text = await getBibleVerseSlideText(slide)
            newTexts[slide.id] = text
          } catch (err) {
            console.error(`[ChapterView] Failed to load verse text for ${slide.id}:`, err)
            newTexts[slide.id] = '[Error cargando versículo]'
          }
        })
      )

      setVerseTexts(prev => ({ ...prev, ...newTexts }))
      
      // Remove from loading set
      setLoadingVerses(prev => {
        const next = new Set(prev)
        textsToLoad.forEach(slide => next.delete(slide.id))
        return next
      })
    }

    loadVerseTexts()
  }, [bibleSlides, verseTexts, loadingVerses])

  if (bibleSlides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <BookIcon size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No hay versículos agregados</p>
          <p className="text-sm text-gray-500">
            Usa el navegador de biblias para agregar versículos como diapositivas
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#333]">
        <h2 className="text-lg font-semibold text-white">Versículos Agregados</h2>
        <p className="text-sm text-gray-400 mt-1">
          {bibleSlides.length} versículo{bibleSlides.length !== 1 ? 's' : ''} en la presentación
        </p>
      </div>

      {/* Slides List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {bibleSlides.map(slide => {
            const verseContent = parseBibleVerseSlideContent(slide)
            const verseText = verseTexts[slide.id]
            const isLoading = loadingVerses.has(slide.id)

            return (
              <div
                key={slide.id}
                className="p-4 bg-[#1a1a1a] border border-[#333] rounded-lg"
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <BookIcon size={16} className="text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">
                    {verseContent?.displayReference || 'Versículo bíblico'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {verseContent?.bibleVersionName}
                  </span>
                </div>

                {/* Content */}
                {isLoading ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Cargando versículo...</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {verseText || '[Sin texto disponible]'}
                  </p>
                )}

                {/* Position indicator */}
                <div className="mt-3 text-xs text-gray-500">
                  Diapositiva #{slide.position + 1}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}