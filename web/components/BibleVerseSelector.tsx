'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Book, Search, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getBibleVersions,
  getBibleBooks,
  getVerseRange,
  type BibleVersion,
  type Book as BibleBook,
  type VerseRange
} from '@/lib/youversion'

interface BibleVerseSelectorProps {
  onAddVerse?: (verse: VerseRange) => void
  onCancel?: () => void
  defaultBibleId?: string
  isOpen?: boolean
}

export default function BibleVerseSelector({
  onAddVerse,
  onCancel,
  defaultBibleId = 'RVR1960',
  isOpen = true
}: BibleVerseSelectorProps) {
  // State
  const [bibleVersions, setBibleVersions] = useState<BibleVersion[]>([])
  const [books, setBooks] = useState<BibleBook[]>([])
  const [selectedBibleId, setSelectedBibleId] = useState(defaultBibleId)
  const [selectedBookId, setSelectedBookId] = useState('')
  const [chapter, setChapter] = useState('')
  const [verses, setVerses] = useState('')
  const [preview, setPreview] = useState<VerseRange | null>(null)
  
  // Loading states
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [loadingBooks, setLoadingBooks] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  
  // Errors
  const [error, setError] = useState('')

  // Load Bible versions on mount
  useEffect(() => {
    const loadVersions = async () => {
      setLoadingVersions(true)
      setError('')
      
      try {
        const versions = await getBibleVersions()
        setBibleVersions(versions)
        console.log(`[BibleSelector] Loaded ${versions.length} Bible versions`)
      } catch (err: any) {
        const errorMsg = 'Error al cargar versiones de la Biblia'
        setError(errorMsg)
        toast.error(errorMsg)
        console.error('[BibleSelector] Failed to load versions:', err)
      } finally {
        setLoadingVersions(false)
      }
    }
    
    loadVersions()
  }, [])

  // Load books when Bible version changes
  useEffect(() => {
    if (!selectedBibleId) return
    
    const loadBooks = async () => {
      setLoadingBooks(true)
      setError('')
      setSelectedBookId('')
      setChapter('')
      setVerses('')
      setPreview(null)
      
      try {
        const bibleBooks = await getBibleBooks(selectedBibleId)
        setBooks(bibleBooks)
        console.log(`[BibleSelector] Loaded ${bibleBooks.length} books for ${selectedBibleId}`)
      } catch (err: any) {
        const errorMsg = 'Error al cargar libros de la Biblia'
        setError(errorMsg)
        toast.error(errorMsg)
        console.error('[BibleSelector] Failed to load books:', err)
      } finally {
        setLoadingBooks(false)
      }
    }
    
    loadBooks()
  }, [selectedBibleId])

  // Debounced preview loading
  const loadPreview = useCallback(
    async (bibleId: string, bookId: string, chapterNum: string, versesRange: string) => {
      if (!bibleId || !bookId || !chapterNum || !versesRange) {
        setPreview(null)
        return
      }

      const chapterNumber = parseInt(chapterNum, 10)
      if (isNaN(chapterNumber) || chapterNumber < 1) {
        setPreview(null)
        return
      }

      setLoadingPreview(true)
      setError('')

      try {
        const verseData = await getVerseRange(bibleId, bookId, chapterNumber, versesRange)
        
        // Find the selected bible version name
        const selectedVersion = bibleVersions.find(v => v.id === bibleId)
        const selectedBook = books.find(b => b.id === bookId)
        
        // Create complete VerseRange object
        const completeVerse: VerseRange = {
          bibleId,
          bibleVersionName: selectedVersion?.name || 'Unknown',
          bookId,
          bookName: selectedBook?.name || 'Unknown',
          chapter: chapterNumber,
          verses: versesRange,
          reference: verseData.reference,
          displayReference: `${selectedBook?.name || bookId} ${chapterNumber}:${versesRange}`,
          verseText: verseData.verseText
        }
        
        setPreview(completeVerse)
        console.log(`[BibleSelector] Preview loaded: ${completeVerse.displayReference}`)
      } catch (err: any) {
        setError(err.message || 'Error al cargar versículo')
        setPreview(null)
        console.error('[BibleSelector] Preview error:', err)
      } finally {
        setLoadingPreview(false)
      }
    }, []
  )

  // Auto-load preview when inputs change (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPreview(selectedBibleId, selectedBookId, chapter, verses)
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [selectedBibleId, selectedBookId, chapter, verses, loadPreview])

  // Handle add to presentation
  const handleAddToPresentation = () => {
    if (!preview) {
      toast.error('No hay versículo para agregar')
      return
    }

    if (onAddVerse) {
      onAddVerse(preview)
      toast.success(`✅ Agregado: ${preview.displayReference}`)
    }

    // Reset form
    setSelectedBookId('')
    setChapter('')
    setVerses('')
    setPreview(null)
  }

  // Get book info for validation
  const selectedBook = books.find(b => b.id === selectedBookId)
  const maxChapter = selectedBook?.chapters || 0

  // Organize books by testament (simplified categorization)
  const oldTestamentBooks = books.slice(0, 39) // First 39 books are typically OT
  const newTestamentBooks = books.slice(39)    // Remaining are NT

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f0f0f] border border-[#333] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Book className="w-6 h-6 text-[#7C6FD8]" />
              <h2 className="text-xl font-bold text-white">Agregar Versículo Bíblico</h2>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Bible Version Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Versión de la Biblia
              </label>
              <div className="relative">
                <select
                  value={selectedBibleId}
                  onChange={(e) => setSelectedBibleId(e.target.value)}
                  disabled={loadingVersions}
                  className="w-full px-4 py-2.5 pr-10 bg-[#2a2a2a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#7C6FD8] appearance-none"
                >
                  {bibleVersions.map(version => (
                    <option key={version.id} value={version.id}>
                      {version.name} ({version.abbreviation})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                {loadingVersions && (
                  <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C6FD8] animate-spin" />
                )}
              </div>
            </div>

            {/* Book Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Libro
              </label>
              <div className="relative">
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  disabled={loadingBooks || books.length === 0}
                  className="w-full px-4 py-2.5 pr-10 bg-[#2a2a2a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#7C6FD8] appearance-none"
                >
                  <option value="">Selecciona un libro...</option>
                  
                  {/* Old Testament */}
                  {oldTestamentBooks.length > 0 && (
                    <optgroup label="Antiguo Testamento">
                      {oldTestamentBooks.map(book => (
                        <option key={book.id} value={book.id}>
                          {book.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  
                  {/* New Testament */}
                  {newTestamentBooks.length > 0 && (
                    <optgroup label="Nuevo Testamento">
                      {newTestamentBooks.map(book => (
                        <option key={book.id} value={book.id}>
                          {book.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                {loadingBooks && (
                  <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C6FD8] animate-spin" />
                )}
              </div>
            </div>

            {/* Chapter and Verses */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Capítulo
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxChapter || undefined}
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  disabled={!selectedBookId}
                  placeholder="ej: 3"
                  className="w-full px-4 py-2.5 bg-[#2a2a2a] border border-[#333] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#7C6FD8]"
                />
                {selectedBook && (
                  <p className="text-xs text-gray-500 mt-1">
                    1-{selectedBook.chapters} capítulos
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Versículo(s)
                </label>
                <input
                  type="text"
                  value={verses}
                  onChange={(e) => setVerses(e.target.value)}
                  disabled={!chapter}
                  placeholder="ej: 16 o 16-17"
                  className="w-full px-4 py-2.5 bg-[#2a2a2a] border border-[#333] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#7C6FD8]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formatos: 1, 1-3, 5-10
                </p>
              </div>
            </div>

            {/* Preview Area */}
            {(loadingPreview || preview) && (
              <div className="p-4 bg-[#1a1a1a] border border-[#333] rounded-lg">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Vista previa</h3>
                
                {loadingPreview ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Cargando versículo...</span>
                  </div>
                ) : preview ? (
                  <div>
                    <blockquote className="text-gray-200 italic text-lg leading-relaxed mb-3">
                      "{preview.verseText}"
                    </blockquote>
                    <p className="text-sm text-gray-500">
                      {preview.displayReference} - {preview.bibleVersionName}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleAddToPresentation}
                disabled={!preview || loadingPreview}
                className="flex-1 px-6 py-2.5 bg-[#7C6FD8] hover:bg-[#6C5FC8] disabled:bg-[#7C6FD8]/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loadingPreview ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Book className="w-4 h-4" />
                )}
                Agregar a Presentación
              </button>
              
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/5 border border-red-400/30 text-red-300 hover:text-red-200 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>

            {/* Helpful Tips */}
            <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
              <h4 className="text-sm font-medium text-blue-400 mb-2">💡 Consejos</h4>
              <ul className="text-xs text-blue-300 space-y-1">
                <li>• Escribe el número del capítulo y versículo para ver una vista previa automática</li>
                <li>• Usa rangos como "16-17" para múltiples versículos consecutivos</li>
                <li>• Los versículos se agregan como diapositivas individuales a tu presentación</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SIMPLE USAGE EXAMPLE COMPONENT
// ============================================================================

export function BibleVerseSelectorExample() {
  const [isOpen, setIsOpen] = useState(false)

  const handleAddVerse = (verse: VerseRange) => {
    console.log('Verse added to presentation:', verse)
    
    // Here you would integrate with your presentation system
    // For example:
    // addSlideToPresentation({
    //   type: 'bible_verse',
    //   custom_text: JSON.stringify({
    //     bibleId: verse.bibleId,
    //     bookId: verse.bookId,
    //     bookName: verse.bookName,
    //     chapter: verse.chapter,
    //     verses: verse.verses,
    //     reference: verse.reference,
    //     displayReference: verse.displayReference,
    //     bibleVersionName: verse.bibleVersionName
    //   })
    // })
  }

  return (
    <div className="p-8">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white rounded-lg flex items-center gap-2"
      >
        <Book className="w-4 h-4" />
        Agregar Versículo Bíblico
      </button>

      {isOpen && (
        <BibleVerseSelector
          onAddVerse={handleAddVerse}
          onCancel={() => setIsOpen(false)}
          isOpen={isOpen}
        />
      )}
    </div>
  )
}