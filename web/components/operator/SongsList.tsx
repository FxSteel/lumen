'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { FileMusic, Plus, ListFilter, ListVideo, ListPlus, ListX } from 'lucide-react'
import { Song, useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-provider'
import { useWorkspace } from '@/lib/workspace-provider'
import { toast } from 'sonner'
import SongsListLoadingSkeleton from './SongsListLoadingSkeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface SongsListProps {
  songs: Song[]
  selectedSong: Song | null
  onSelectSong: (song: Song) => void
  onSongCreated: (song: Song) => void
  loading: boolean
}

export default function SongsList({
  songs,
  selectedSong,
  onSelectSong,
  onSongCreated,
  loading,
}: SongsListProps) {
  const { session } = useAuth()
  const { activeWorkspaceId } = useWorkspace()
  const [modalOpen, setModalOpen] = useState(false)
  const [newSongData, setNewSongData] = useState({
    title: '',
    author: '',
    tonality: '',
  })
  const [creatingNewSong, setCreatingNewSong] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const setlistSongIds = useAppStore((state) => state.setlistSongIds)
  const isSetlistFilterOn = useAppStore((state) => state.isSetlistFilterOn)
  const toggleSongInSetlist = useAppStore((state) => state.toggleSongInSetlist)
  const toggleSetlistFilter = useAppStore((state) => state.toggleSetlistFilter)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [slideContentCache, setSlideContentCache] = useState<Map<string, string>>(new Map())
  const slideCacheSongIdsRef = useRef<string>('')

  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const searchNormalized = normalize(search.trim())

  // Load all slide content once when search opens (for client-side content search)
  useEffect(() => {
    if (!isSearchOpen || songs.length === 0) return

    const songIds = songs.map((s) => s.id).sort().join(',')
    if (songIds === slideCacheSongIdsRef.current) return
    slideCacheSongIdsRef.current = songIds

    const loadSlideContent = async () => {
      const { data } = await supabase
        .from('song_slides')
        .select('song_id, content')
        .in('song_id', songs.map((s) => s.id))

      if (data) {
        const cache = new Map<string, string>()
        for (const row of data) {
          const prev = cache.get(row.song_id) || ''
          // Join all slide content with spaces, replace newlines
          cache.set(row.song_id, prev + ' ' + row.content.replace(/\n/g, ' '))
        }
        setSlideContentCache(cache)
      }
    }

    loadSlideContent()
  }, [isSearchOpen, songs])

  const searchedSongs = songs.filter((song) => {
    if (!searchNormalized) return true
    const searchable = normalize(`${song.title || ''} ${song.author || ''}`)
    if (searchable.includes(searchNormalized)) return true
    // Also search in slide content (accent-insensitive, newline-insensitive)
    const slideText = slideContentCache.get(song.id)
    if (slideText) return normalize(slideText).includes(searchNormalized)
    return false
  })
  const filteredSongs = isSetlistFilterOn
    ? searchedSongs.filter((song) => setlistSongIds.includes(song.id))
    : searchedSongs

  const toggleSetlistSong = (songId: string) => {
    try {
      const isInSetlist = setlistSongIds.includes(songId)
      toggleSongInSetlist(songId)

      if (isInSetlist) {
        toast.success('Canción removida del setlist correctamente')
      } else {
        toast.success('Canción agregada al setlist correctamente')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`No se pudo completar esta acción por el siguiente motivo: ${message}`)
    }
  }

  const handleCreateSong = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validación robusta del workspace
    if (!activeWorkspaceId) {
      console.error('[SONGS] Error creating song: No active workspace')
      toast.error('Error: No hay workspace activo')
      return
    }

    if (!session?.user?.id) {
      console.error('[SONGS] Error creating song: No authenticated user')
      toast.error('Error: Usuario no autenticado')
      return
    }

    if (!newSongData.title.trim()) {
      toast.error('El título es requerido')
      return
    }

    setCreatingNewSong(true)

    try {
      console.log('[SONGS] Creating song with workspace_id:', activeWorkspaceId)
      
      // Crear canción con workspace_id del provider y created_by
      const songData = {
        workspace_id: activeWorkspaceId, // Siempre usar activeWorkspaceId del provider
        created_by: session.user.id,    // Agregar created_by con session.user.id
        title: newSongData.title.trim(),
        author: newSongData.author.trim() || null,
        tonality: newSongData.tonality.trim() || null,
        is_archived: false,
      }

      const { data, error } = await supabase
        .from('songs')
        .insert([songData])
        .select()
        .single()

      if (error) throw error

      console.log('[SONGS] ✅ Song created successfully:', data.title)
      
      // Éxito: cerrar modal, toast éxito y actualizar lista
      onSongCreated(data)
      setNewSongData({ title: '', author: '', tonality: '' })
      setModalOpen(false)
      toast.success(`Canción "${data.title}" creada exitosamente`)
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[SONGS] Error creating song:', message)
      toast.error(`Error creando canción: ${message}`)
    } finally {
      setCreatingNewSong(false)
    }
  }, [activeWorkspaceId, session?.user?.id, newSongData, onSongCreated])

  const handleCloseModal = () => {
    setModalOpen(false)
    setNewSongData({ title: '', author: '', tonality: '' })
  }

  return (
    <>
      <div className="flex flex-col overflow-hidden h-full">
        {/* Header */}
        <div className="p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <FileMusic className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Canciones</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleSetlistFilter}
                className={`text-[#7c6fd8] hover:text-[#7c6fd8] hover:bg-[#2a2a2a] ${
                  isSetlistFilterOn ? 'bg-[#2a2a2a]' : ''
                }`}
                aria-label="Alternar modo setlist"
                title={`Setlist (${setlistSongIds.length})`}
              >
                <ListVideo className="h-5 w-5" />
                {setlistSongIds.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#7C6FD8] text-white text-[10px] leading-4 text-center">
                    {setlistSongIds.length}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsSearchOpen((prev) => {
                    if (prev) setSearch('')
                    return !prev
                  })
                }}
                className={`text-[#7c6fd8] hover:text-[#7c6fd8] hover:bg-[#2a2a2a] ${
                  isSearchOpen ? 'bg-[#2a2a2a]' : ''
                }`}
                aria-label="Mostrar buscador"
              >
                <ListFilter className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search + Nueva canción — fixed above scroll */}
        <div className="px-4 pb-3 space-y-3 border-b border-[#333]">
          {isSearchOpen && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título o autor..."
              className="w-full h-9 bg-[#2a2a2a] border border-[#7C6FD8] text-white placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-[#7C6FD8] focus-visible:ring-offset-0"
            />
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white rounded text-sm transition-all duration-200"
          >
            <Plus size={16} />
            Nueva canción
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
          {/* Songs List */}
          {loading ? (
            <SongsListLoadingSkeleton />
          ) : songs.length === 0 ? (
            <div className="text-center text-gray-400 text-sm">
              No hay canciones. Crea una nueva para empezar.
            </div>
          ) : isSetlistFilterOn && setlistSongIds.length === 0 ? (
            <div className="text-center text-gray-400 text-sm">
              No hay canciones en el setlist de hoy
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="text-center text-gray-400 text-sm">
              Sin resultados
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSongs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => onSelectSong(song)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectSong(song)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`group relative w-full text-left p-3 rounded-lg transition-colors text-sm ${
                    selectedSong?.id === song.id
                      ? 'bg-[#7C6FD8] text-white'
                      : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{song.title}</div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <div className="text-xs opacity-75 truncate min-w-0">
                          {[song.author, song.tonality]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                        {setlistSongIds.includes(song.id) && (
                          <span
                            className={`inline-flex flex-shrink-0 items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                              selectedSong?.id === song.id
                                ? 'border-white/40 bg-white/15 text-white'
                                : 'border-[#7C6FD8]/50 bg-[#7C6FD8]/20 text-[#CFC8FF]'
                            }`}
                          >
                            Setlist
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSetlistSong(song.id)
                      }}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
                        setlistSongIds.includes(song.id)
                          ? 'text-white hover:text-white'
                          : selectedSong?.id === song.id
                          ? 'text-white/80 hover:text-white'
                          : 'text-gray-400 hover:text-[#7C6FD8]'
                      }`}
                      aria-label={
                        setlistSongIds.includes(song.id)
                          ? 'Quitar del setlist'
                          : 'Agregar al setlist'
                      }
                    >
                      {setlistSongIds.includes(song.id) ? (
                        <ListX className="h-4 w-4" />
                      ) : (
                        <ListPlus className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Modal de Nueva Canción */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>Nueva canción</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateSong} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <input
                ref={titleInputRef}
                id="title"
                type="text"
                placeholder="Título de la canción"
                value={newSongData.title}
                onChange={(e) =>
                  setNewSongData({ ...newSongData, title: e.target.value })
                }
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="author">Autor</Label>
              <input
                id="author"
                type="text"
                placeholder="Autor de la canción"
                value={newSongData.author}
                onChange={(e) =>
                  setNewSongData({ ...newSongData, author: e.target.value })
                }
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tonality">Tonalidad</Label>
              <input
                id="tonality"
                type="text"
                placeholder="Ej: C, Am, G"
                value={newSongData.tonality}
                onChange={(e) =>
                  setNewSongData({ ...newSongData, tonality: e.target.value })
                }
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent"
              />
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                className="border-red-400/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-300/40"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creatingNewSong || !newSongData.title.trim()}
                className="bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white disabled:opacity-50 transition-all duration-200"
              >
                {creatingNewSong ? 'Creando...' : 'Crear canción'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
