'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, Book as BookIcon, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { SongSlide } from '@/lib/store'
import { getBibleVersions, getBibleBooks, getChapter, type BibleVersion, type Book, type ChapterData, type VerseRange } from '@/lib/youversion'
import { useAppStore } from '@/lib/store'
import { LiveOutputBroadcaster } from '@/lib/broadcast'
import { getGlobalBridge } from '@/lib/lumen-bridge'
import { useWorkspace } from '@/lib/workspace-provider'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface BibleBrowserProps {
  onVerseAdd: (slide: SongSlide) => void
}

export default function BibleBrowser({ onVerseAdd }: BibleBrowserProps) {
  const { activeWorkspaceId } = useWorkspace()
  const { selectedSong } = useAppStore()
  
  // Left panel state
  const [versions, setVersions] = useState<BibleVersion[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('128') // NVI 2022 - approved YouVersion license
  const [selectedBookId, setSelectedBookId] = useState('')
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [loadingBooks, setLoadingBooks] = useState(false)
  const [loadingChapter, setLoadingChapter] = useState(false)

  // Right panel state  
  const [chapterData, setChapterData] = useState<ChapterData | null>(null)
  const [selectedSlide, setSelectedSlide] = useState<SongSlide | null>(null) // Track selected verse

  // Search states
  const [versionSearchQuery, setVersionSearchQuery] = useState('')
  const [bookSearchQuery, setBookSearchQuery] = useState('')
  const [showVersionDropdown, setShowVersionDropdown] = useState(false)
  const [showBookDropdown, setShowBookDropdown] = useState(false)

  // Refs for dropdown click outside detection
  const versionDropdownRef = useRef<HTMLDivElement>(null)
  const bookDropdownRef = useRef<HTMLDivElement>(null)
  const fontSettingsRef = useRef<HTMLDivElement>(null)
  const broadcasterRef = useRef<LiveOutputBroadcaster | null>(null)
  const [bibleFontSize, setBibleFontSize] = useState(80)
  const [draftBibleFontSize, setDraftBibleFontSize] = useState(80)
  const [showFontSettingsPopover, setShowFontSettingsPopover] = useState(false)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
        setShowVersionDropdown(false)
      }
      if (bookDropdownRef.current && !bookDropdownRef.current.contains(event.target as Node)) {
        setShowBookDropdown(false)
      }
      if (fontSettingsRef.current && !fontSettingsRef.current.contains(event.target as Node)) {
        setShowFontSettingsPopover(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initialize broadcaster
  useEffect(() => {
    broadcasterRef.current = new LiveOutputBroadcaster()

    const syncChannel = new BroadcastChannel('live-output-sync')
    syncChannel.addEventListener('message', (event) => {
      const data = event.data
      if (data?.type === 'bible-font-size' && typeof data.payload?.fontSize === 'number') {
        setBibleFontSize(data.payload.fontSize)
      }
    })

    return () => {
      broadcasterRef.current = null
      syncChannel.close()
    }
  }, [])

  useEffect(() => {
    if (!activeWorkspaceId) return

    const loadBibleFontSize = async () => {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('bible_font_size')
        .eq('workspace_id', activeWorkspaceId)
        .maybeSingle()

      if (error) {
        console.error('[BIBLE] Error loading bible font size:', error)
        return
      }

      if (typeof data?.bible_font_size === 'number') {
        setBibleFontSize(data.bible_font_size)
        setDraftBibleFontSize(data.bible_font_size)
        broadcasterRef.current?.sendBibleFontSize(data.bible_font_size)
      }
    }

    loadBibleFontSize()
  }, [activeWorkspaceId])

  // Load Bible versions on mount
  useEffect(() => {
    const loadVersions = async () => {
      setLoadingVersions(true)
      try {
        const data = await getBibleVersions()
        setVersions(data)
      } catch (err) {
        console.error('[BIBLE] Failed to load versions:', err)
      } finally {
        setLoadingVersions(false)
      }
    }
    loadVersions()
  }, [])

  // Load books when version changes
  useEffect(() => {
    if (!selectedVersionId) return
    
    const loadBooks = async () => {
      setLoadingBooks(true)
      try {
        const data = await getBibleBooks(selectedVersionId)
        setBooks(data)
        // Reset book and chapter selection
        setSelectedBookId('')
        setSelectedChapter(null)
        setChapterData(null)
      } catch (err) {
        console.error('[BIBLE] Failed to load books:', err)
      } finally {
        setLoadingBooks(false)
      }
    }
    loadBooks()
  }, [selectedVersionId])

  // Load chapter when book or chapter changes
  useEffect(() => {
    if (!selectedVersionId || !selectedBookId || selectedChapter === null) {
      console.log('[BIBLE] useEffect: Skipping chapter load -', { selectedVersionId, selectedBookId, selectedChapter })
      setChapterData(null)
      return
    }

    const loadChapter = async () => {
      setLoadingChapter(true)
      console.log('[BIBLE] useEffect: Loading chapter...', { selectedVersionId, selectedBookId, selectedChapter })
      try {
        const data = await getChapter(selectedVersionId, selectedBookId, selectedChapter)
        console.log('[BIBLE] useEffect: Chapter loaded successfully -', { 
          bookId: data.bookId, 
          chapter: data.chapter, 
          versesCount: data.verses.length 
        })
        setChapterData(data)
      } catch (err) {
        console.error('[BIBLE] Failed to load chapter:', err)
        setChapterData(null)
      } finally {
        setLoadingChapter(false)
      }
    }
    loadChapter()
  }, [selectedVersionId, selectedBookId, selectedChapter])

  const selectedVersion = versions.find(v => v.id === selectedVersionId)
  const selectedBook = books.find(b => b.id === selectedBookId)

  const filteredVersions = versions.filter(v => {
    const query = versionSearchQuery.toLowerCase()
    return (
      v.name.toLowerCase().includes(query) ||
      v.abbreviation?.toLowerCase().includes(query) ||
      v.id.toLowerCase().includes(query) ||
      // Split query and match any word
      query.split(/\s+/).some(word =>
        v.name.toLowerCase().includes(word) ||
        v.abbreviation?.toLowerCase().includes(word)
      )
    )
  })

  const filteredBooks = books.filter(b => {
    const query = bookSearchQuery.toLowerCase()
    return (
      b.name.toLowerCase().includes(query) ||
      b.abbreviation?.toLowerCase().includes(query) ||
      b.id.toLowerCase().includes(query) ||
      // Split query and match any word
      query.split(/\s+/).some(word =>
        b.name.toLowerCase().includes(word) ||
        b.abbreviation?.toLowerCase().includes(word)
      )
    )
  })

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersionId(versionId)
    setVersionSearchQuery('')
    setShowVersionDropdown(false)
  }

  const handleBookSelect = (bookId: string) => {
    setSelectedBookId(bookId)
    setSelectedChapter(null) // Reset chapter when book changes
    setBookSearchQuery('')
    setShowBookDropdown(false)
  }

  const handleVersionDropdownToggle = () => {
    setShowVersionDropdown(!showVersionDropdown)
    if (!showVersionDropdown) {
      setShowBookDropdown(false) // Close book dropdown when version opens
    }
  }

  const handleBookDropdownToggle = () => {
    setShowBookDropdown(!showBookDropdown)
    if (!showBookDropdown) {
      setShowVersionDropdown(false) // Close version dropdown when book opens
    }
  }

  const handleChapterSelect = (chapterNum: number) => {
    console.log('[BIBLE] Chapter selected:', {
      chapter: chapterNum,
      bibleId: selectedVersionId,
      bookId: selectedBookId,
      bookName: selectedBook?.name
    })
    setSelectedChapter(chapterNum)
  }

  const handlePreviousChapter = () => {
    if (selectedChapter && selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1)
    }
  }

  const handleNextChapter = () => {
    if (selectedChapter && selectedBook && selectedChapter < selectedBook.chapters) {
      setSelectedChapter(selectedChapter + 1)
    }
  }

  const applyBibleFontSize = async () => {
    if (!activeWorkspaceId) {
      toast.error('No hay workspace activo')
      return
    }

    try {
      const { data, error } = await supabase
        .from('workspace_settings')
        .update({ bible_font_size: draftBibleFontSize })
        .eq('workspace_id', activeWorkspaceId)
        .select('workspace_id')

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error('No se encontró configuración del workspace para actualizar')
        return
      }

      setBibleFontSize(draftBibleFontSize)
      broadcasterRef.current?.sendBibleFontSize(draftBibleFontSize)
      toast.success('Tamaño guardado')
      setShowFontSettingsPopover(false)
    } catch (error) {
      console.error('Error saving font size:', error)
      toast.error('Error al guardar')
    }
  }

  const cancelBibleFontSize = () => {
    setDraftBibleFontSize(bibleFontSize)
    setShowFontSettingsPopover(false)
  }


  const handleVerseClick = async (verseNumber: number) => {
    console.log('[BIBLE] handleVerseClick DEBUG:', {
      chapterData: !!chapterData,
      selectedBook: selectedBook?.name,
      selectedVersion: selectedVersion?.name,
      selectedVersionId,
      selectedBookId,
      selectedChapter
    })
    
    if (!chapterData || !selectedBook || !selectedVersion) {
      console.error('[BIBLE] Missing data for verse click:', {
        chapterData: !!chapterData,
        selectedBook: selectedBook?.name,
        selectedVersion: selectedVersion?.name
      })
      return
    }

    const verse = chapterData.verses.find(v => v.number === verseNumber)
    if (!verse) return

    // Set as selected verse (for visual highlight) - NO SLIDE CREATION
    setSelectedSlide({
      id: `verse-${verse.passage_id}`,
      content: verse.text, // Just the text, not JSON
      type: 'bible_verse',
      label: `${selectedBook.name} ${selectedChapter}:${verseNumber}`,
      position: 0,
      song_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    // Broadcast to live output windows ONLY (no database save)
    if (broadcasterRef.current) {
      const versionAbbreviation = selectedVersion.abbreviation || 'NVI'
      const displayReference = `${selectedBook.name} ${selectedChapter}:${verseNumber}`

      const storedTransition = localStorage.getItem('transition-type')
      const transitionType = storedTransition === 'fade' || storedTransition === 'fade-slow' ? storedTransition : 'none'

      const broadcastSlide = {
        id: `verse-${verse.passage_id}`,
        content: verse.text,
        fontSize: 64,
        type: 'bible_verse',
        label: displayReference,
        transitionType,

        // Additional fields for display
        displayReference,
        verseText: verse.text,
        bibleVersionName: selectedVersion.name,
        bibleVersionAbbreviation: versionAbbreviation,
        projectedReferenceLabel: `${displayReference} - ${versionAbbreviation} (${selectedVersion.name})`,
        reference: `${selectedBookId}.${selectedChapter}.${verseNumber}`
      }
      
      console.log('[BIBLE] Broadcasting verse slide:', broadcastSlide)
      localStorage.setItem('last-broadcast-slide', JSON.stringify(broadcastSlide))
      broadcasterRef.current.sendSlideChange(broadcastSlide)
      console.log('[BIBLE] Broadcasting verse completed')

      // Also send to Lumen bridge (native app)
      const bridge = getGlobalBridge()
      if (bridge?.isConnected) {
        bridge.sendDisplayMode('slide')
        bridge.sendSlide('main', {
          type: 'bible_verse',
          verseText: verse.text,
          displayReference,
          bibleVersionName: selectedVersion.name,
          bibleVersionAbbreviation: versionAbbreviation,
          projectedReferenceLabel: broadcastSlide.projectedReferenceLabel,
          fontSize: bibleFontSize,
          textAlign: 'center',
          contentPadding: 80,
          transitionType,
        })
        bridge.sendSlide('stage', {
          type: 'bible_verse',
          reference: displayReference,
          textAlign: 'center',
          contentPadding: 80,
          transitionType,
        })
        console.log('[BIBLE] Sent verse to Lumen bridge')
      }
    } else {
      console.error('[BIBLE] Broadcaster ref is null!')
    }

    // ❌ REMOVED: Do NOT save bible verses to song slides
    // Bible verses are separate from songs
  }

  // Generate chapter grid for selected book
  const renderChapterGrid = () => {
    if (!selectedBook) return null

    const chapters = Array.from({ length: selectedBook.chapters }, (_, i) => i + 1)
    
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-white mb-3">Capítulos</h3>
        <div className="grid grid-cols-5 gap-2">
          {chapters.map(chapterNum => (
            <button
              key={chapterNum}
              onClick={() => handleChapterSelect(chapterNum)}
              className={`aspect-square flex items-center justify-center text-sm font-medium rounded border-2 transition-colors ${
                selectedChapter === chapterNum
                  ? 'border-[#7C6FD8] bg-[#7C6FD8]/20 text-[#7C6FD8]'
                  : 'border-[#333] bg-[#1a1a1a] text-gray-300 hover:border-[#444] hover:bg-[#2a2a2a]'
              }`}
            >
              {chapterNum}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Left Panel: Bible Selector */}
      <div className="w-80 bg-[#1a1a1a] rounded-lg border border-[#333] flex flex-col overflow-visible">
        {/* Header */}
        <div className="p-4 border-b border-[#333] relative">
          <div className="flex items-center justify-between gap-3 text-white" ref={fontSettingsRef}>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v8l3-3 3 3V2"/>
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>
              </svg>
              <h2 className="text-lg font-semibold">Biblias</h2>
            </div>

            <button
              onClick={() => {
                setDraftBibleFontSize(bibleFontSize)
                setShowFontSettingsPopover((current) => !current)
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors"
            >
              <Settings size={16} />
              <span className="text-sm">Tamaño: {bibleFontSize}pt</span>
              <ChevronDown size={14} className={`transition-transform ${showFontSettingsPopover ? 'rotate-180' : ''}`} />
            </button>

            {showFontSettingsPopover && (
              <div className="absolute top-16 right-0 w-80 z-30 p-4 bg-[#2a2a2a] border border-[#444] rounded-lg shadow-2xl space-y-4">
                <h4 className="text-sm font-semibold text-white">Tamaño de letra (Biblias)</h4>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>48pt</span>
                  <span>200pt</span>
                </div>
                <input
                  type="range"
                  min={48}
                  max={200}
                  step={4}
                  value={draftBibleFontSize}
                  onChange={(e) => setDraftBibleFontSize(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-white">Actual: {draftBibleFontSize}pt</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelBibleFontSize}
                    className="px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/5 text-red-300 hover:text-red-200 border border-red-400/30 hover:border-red-300/30 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={applyBibleFontSize}
                    className="px-3 py-1.5 rounded bg-[#7C6FD8] text-white hover:bg-[#6C5FC8]"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Bible Version Selector */}
          <div className="p-4 border-b border-[#333]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Versión Bíblica
            </label>
            <div className="relative" ref={versionDropdownRef}>
              <button
                onClick={handleVersionDropdownToggle}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded text-sm text-white hover:bg-[#333] transition-colors"
                disabled={loadingVersions}
              >
                <span className="truncate">
                  {selectedVersion ? selectedVersion.name : 'Seleccionar versión...'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${showVersionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showVersionDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-[#333] rounded shadow-lg z-10 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar versión..."
                        value={versionSearchQuery}
                        onChange={(e) => setVersionSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-[#7C6FD8]"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {filteredVersions.map(version => (
                      <button
                        key={version.id}
                        onClick={() => handleVersionSelect(version.id)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#333] transition-colors"
                      >
                        <div className="font-medium">{version.name}</div>
                        <div className="text-xs text-gray-400">{version.id}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Book Selector */}
          <div className="p-4 border-b border-[#333]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Libro
            </label>
            <div className="relative" ref={bookDropdownRef}>
              <button
                onClick={handleBookDropdownToggle}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded text-sm text-white hover:bg-[#333] transition-colors"
                disabled={loadingBooks || !selectedVersionId}
              >
                <span className="truncate">
                  {selectedBook ? selectedBook.name : 'Seleccionar libro...'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${showBookDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showBookDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2a2a2a] border border-[#333] rounded shadow-lg z-10 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar libro..."
                        value={bookSearchQuery}
                        onChange={(e) => setBookSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-white placeholder:text-gray-400 focus:outline-none focus:border-[#7C6FD8]"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {filteredBooks.map(book => (
                      <div
                        key={book.id}
                        className="w-full px-3 py-2 text-sm text-gray-200 hover:bg-[#333] transition-colors"
                      >
                        <button
                          onClick={() => handleBookSelect(book.id)}
                          className="text-left w-full"
                        >
                          <div className="font-medium truncate">{book.name}</div>
                          <div className="text-xs text-gray-400">{book.chapters} capítulos</div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chapter Grid */}
          {selectedBook && renderChapterGrid()}
        </div>
      </div>

      {/* Right Panel: Chapter View */}
      <div className="flex-1 bg-[#1a1a1a] rounded-lg border border-[#333] flex flex-col overflow-hidden">
        {chapterData && selectedBook && selectedChapter ? (
          <>
            {/* Chapter Header */}
            <div className="p-4 border-b border-[#333] relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {selectedBook.name} {selectedChapter}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedVersion?.name} • {chapterData.verses.length} versículos
                  </p>
                </div>
              </div>
            </div>

            {/* Verses List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingChapter ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C6FD8]"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {chapterData.verses.map(verse => {
                    const isSelected = selectedSlide?.id === `verse-${verse.passage_id}`
                    
                    return (
                      <button
                        key={verse.number}
                        onClick={() => handleVerseClick(verse.number)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-[#7C6FD8] bg-[#7C6FD8]/20 shadow-lg shadow-[#7C6FD8]/20'
                            : 'border-[#333] bg-[#1a1a1a] hover:border-[#7C6FD8] hover:bg-[#7C6FD8]/5 cursor-pointer'
                        }`}
                        title={isSelected ? 'Versículo seleccionado (en vivo)' : 'Click para mostrar en pantallas'}
                      >
                        <div className="flex gap-3 items-start">
                          <span className="text-sm font-medium text-[#7C6FD8] mt-0.5 min-w-[24px]">
                            {verse.number}
                          </span>
                          <span className="text-sm text-gray-200 leading-relaxed flex-1">
                            {verse.text}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Chapter Navigation */}
            <div className="p-4 border-t border-[#333]">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handlePreviousChapter}
                  disabled={!selectedChapter || selectedChapter <= 1}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] border border-[#333] rounded text-sm text-gray-300 hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                
                <span className="text-sm text-gray-400 font-medium">
                  {selectedBook.name} {selectedChapter}
                </span>
                
                <button
                  onClick={handleNextChapter}
                  disabled={!selectedChapter || !selectedBook || selectedChapter >= selectedBook.chapters}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] border border-[#333] rounded text-sm text-gray-300 hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookIcon size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">
                {!selectedSong 
                  ? 'Selecciona una canción para agregar versículos'
                  : !selectedVersionId
                  ? 'Selecciona una versión bíblica'
                  : !selectedBookId
                  ? 'Selecciona un libro'
                  : 'Selecciona un capítulo'
                }
              </p>
              {!selectedSong && (
                <p className="text-sm text-gray-500">
                  Los versículos se agregarán como diapositivas a la canción activa
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
