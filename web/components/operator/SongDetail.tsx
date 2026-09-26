'use client'

import { CSS } from '@dnd-kit/utilities'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { useEffect, useMemo, useState } from 'react'
import { Trash2, Edit2, Plus, MoreVertical, Book, Menu } from 'lucide-react'
import { Song, SongSlide, useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useWorkspace } from '@/lib/workspace-provider'
import { toast } from 'sonner'
import EditSongModal from './EditSongModal'
import EditSlideModal from './EditSlideModal'
import SlidesLoadingSkeleton from './SlidesLoadingSkeleton'
import BibleVerseSelector from '@/components/BibleVerseSelector'
import { 
  createBibleVerseSlide, 
  parseBibleVerseSlideContent,
  getSlideIconName,
  getSlideTypeDisplayName,
  getSlideTypeColor
} from '@/lib/bible-slides'
import { type VerseRange } from '@/lib/youversion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface SortableSlideProps {
  slide: SongSlide
  isActiveSlide: boolean
  isEditingMode: boolean
  onClick: () => void
  onDelete: () => void
}

function SortableSlide({
  slide,
  isActiveSlide,
  isEditingMode,
  onClick,
  onDelete,
}: SortableSlideProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
    disabled: !isEditingMode,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    boxShadow: isDragging ? '0 18px 30px rgba(0, 0, 0, 0.35)' : undefined,
    cursor: isEditingMode ? 'default' : 'pointer',
    zIndex: isDragging ? 10 : 1,
  }

  const iconName = getSlideIconName(slide.type)
  const verseContent = slide.type === 'bible_verse' ? parseBibleVerseSlideContent(slide) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card border-2 ${
        isEditingMode
          ? 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5'
          : isActiveSlide
            ? 'border-[#7C6FD8] bg-[#7C6FD8]/10'
            : 'border-[#333] hover:border-[#7C6FD8]'
      } transition-colors group relative`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex gap-2 items-center">
          <span className="badge">#{slide.position}</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded font-medium"
            style={{ backgroundColor: `${getSlideTypeColor(slide.type)}20`, color: getSlideTypeColor(slide.type) }}
          >
            {iconName === 'Book' && <Book size={12} />}
            {getSlideTypeDisplayName(slide.type)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => e.stopPropagation()}
            className={`transition-opacity ${
              isEditingMode
                ? 'opacity-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-200 touch-none'
                : 'opacity-0 pointer-events-none'
            }`}
            {...attributes}
            {...listeners}
            aria-label="Arrastrar slide"
            title="Arrastrar slide"
          >
            <Menu size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className={`transition-opacity ${
              isEditingMode
                ? 'opacity-0 group-hover:opacity-100'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <Trash2 size={14} className="text-red-400 hover:text-red-300" />
          </button>
        </div>
      </div>

      {slide.type === 'bible_verse' && verseContent ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-300">{verseContent.displayReference}</p>
          <p className="text-xs text-gray-400">{verseContent.bibleVersionName}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-300 line-clamp-3">{slide.content || '(vacío)'}</p>
      )}
    </div>
  )
}

interface SongDetailProps {
  song: Song
  slides: SongSlide[]
  slidesLoading?: boolean
  onSongUpdated: (song: Song) => void
  onSongDeleted: (songId: string) => void
  onSlideCreated: (slide: SongSlide) => void
  onSlideUpdated: (slide: SongSlide) => void
  onSlidesReordered: (slides: SongSlide[]) => void
  onSlideDeleted: (slideId: string) => void
}

export default function SongDetail({
  song,
  slides,
  slidesLoading = false,
  onSongUpdated,
  onSongDeleted,
  onSlideCreated,
  onSlideUpdated,
  onSlidesReordered,
  onSlideDeleted,
}: SongDetailProps) {
  const { setCurrentSlideId, currentSlideId } = useAppStore()
  const { activeWorkspaceId } = useWorkspace()
  const [showEditSong, setShowEditSong] = useState(false)
  const [showEditSlide, setShowEditSlide] = useState(false)
  const [showBibleVerseSelector, setShowBibleVerseSelector] = useState(false)
  const [editingSlide, setEditingSlide] = useState<SongSlide | null>(null)
  const [isEditingMode, setIsEditingMode] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [creatingSlide, setCreatingSlide] = useState(false)
  const [showDeleteSongDialog, setShowDeleteSongDialog] = useState(false)
  const [showDeleteSlideDialog, setShowDeleteSlideDialog] = useState(false)
  const [slideToDelete, setSlideToDelete] = useState<string | null>(null)
  const [orderedSlides, setOrderedSlides] = useState<SongSlide[]>([])
  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  )

  const sortedSlides = useMemo(
    () => [...slides].sort((a, b) => a.position - b.position),
    [slides]
  )

  useEffect(() => {
    setOrderedSlides((previousOrderedSlides) => {
      if (previousOrderedSlides.length === 0) {
        return sortedSlides
      }

      if (previousOrderedSlides.length !== sortedSlides.length) {
        return sortedSlides
      }

      const latestSlideById = new Map(sortedSlides.map((slide) => [slide.id, slide]))

      const hasSameSlideSet = previousOrderedSlides.every((slide) => latestSlideById.has(slide.id))

      if (!hasSameSlideSet) {
        return sortedSlides
      }

      return previousOrderedSlides.map((slide) => {
        const latestSlide = latestSlideById.get(slide.id)

        if (!latestSlide) {
          return slide
        }

        // Preserve optimistic order/position locally while syncing latest content changes.
        return {
          ...latestSlide,
          position: slide.position,
        }
      })
    })
  }, [sortedSlides])

  const handleDeleteSong = async () => {
    // Validación de workspace
    if (!activeWorkspaceId) {
      console.error('[SONGS] No active workspace for deleting song')
      toast.error('Error: No hay workspace activo')
      return
    }

    // Validación adicional: la canción debe pertenecer al workspace actual
    if (song.workspace_id !== activeWorkspaceId) {
      console.error('[SONGS] Song does not belong to current workspace')
      toast.error('Error: La canción no pertenece al workspace actual')
      return
    }

    setDeleting(true)
    
    try {
      console.log('[SONGS] Deleting song (HARD DELETE):', song.id, song.title)
      
      // PASO 1: Eliminar todas las slides asociadas primero
      console.log('[SONGS] Step 1: Deleting associated slides...')
      const { error: slidesError } = await supabase
        .from('song_slides')
        .delete()
        .eq('song_id', song.id)

      if (slidesError) {
        console.error('[SONGS] Error deleting slides:', slidesError)
        throw new Error(`Error eliminando slides: ${slidesError.message}`)
      }

      console.log('[SONGS] ✅ Associated slides deleted successfully')

      // PASO 2: Eliminar la canción (HARD DELETE)
      console.log('[SONGS] Step 2: Deleting song...')
      const { error: songError } = await supabase
        .from('songs')
        .delete()
        .eq('id', song.id)

      if (songError) {
        console.error('[SONGS] Error deleting song:', songError)
        throw new Error(`Error eliminando canción: ${songError.message}`)
      }

      console.log('[SONGS] ✅ Song HARD DELETED successfully:', song.title)
      
      // Solo actualizar UI si la DB respondió OK
      onSongDeleted(song.id)
      toast.success(`Canción "${song.title}" eliminada permanentemente`)
      setShowDeleteSongDialog(false)
      
    } catch (err: any) {
      const message = err?.message || 'Error desconocido'
      console.error('[SONGS] Error deleting song:', message, err)
      toast.error(`Error eliminando canción: ${message}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleAddSlide = async () => {
    if (!activeWorkspaceId) {
      console.error('[SLIDES] No active workspace for adding slide')
      return
    }
    
    setCreatingSlide(true)
    try {
      const position = Math.max(...slides.map(s => s.position), 0) + 1
      const { data, error } = await supabase
        .from('song_slides')
        .insert([
          {
            song_id: song.id,
            position,
            type: 'verse',
            label: null,
            content: '',
          },
        ])
        .select()
        .single()

      if (error) {
        console.error('[SongDetail] Error from Supabase:', error)
        throw error
      }
      
      if (!data) {
        throw new Error('No data returned from insert')
      }
      
      onSlideCreated(data)
      toast.success('Slide agregado correctamente')
    } catch (err: any) {
      const errorMsg = err?.message || err || 'Error desconocido'
      console.error('[SongDetail] Error creating slide:', errorMsg)
      toast.error(`Error al crear slide: ${errorMsg}`)
    } finally {
      setCreatingSlide(false)
    }
  }

  const getErrorMessage = (error: unknown) => {
    if (typeof error === 'object' && error !== null) {
      const maybeError = error as {
        message?: unknown
        details?: unknown
        hint?: unknown
        code?: unknown
      }
      const parts = [
        typeof maybeError.message === 'string' ? maybeError.message : null,
        typeof maybeError.details === 'string' ? maybeError.details : null,
        typeof maybeError.hint === 'string' ? `Sugerencia: ${maybeError.hint}` : null,
        typeof maybeError.code === 'string' ? `Código: ${maybeError.code}` : null,
      ].filter(Boolean)

      if (parts.length > 0) {
        return parts.join(' · ')
      }
    }

    if (error instanceof Error) return error.message
    return 'Error desconocido'
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    console.log('=== DRAG START ===');
    console.log('[DRAG] Active:', active?.id);
    console.log('[DRAG] Over:', over?.id);
    console.log('[DRAG] isEditingMode:', isEditingMode);
    console.log('[DRAG] showEditSlide:', showEditSlide);

    if (!over || active.id === over.id || !isEditingMode || showEditSlide) {
      console.log('[DRAG] ❌ Drag cancelled - conditions not met');
      return;
    }

    const oldIndex = orderedSlides.findIndex((slide) => slide.id === active.id);
    const newIndex = orderedSlides.findIndex((slide) => slide.id === over.id);

    console.log('[DRAG] Indices:', { oldIndex, newIndex, totalSlides: orderedSlides.length });

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      console.log('[DRAG] ❌ Drag cancelled - invalid indices');
      return;
    }

    const previousSlides = orderedSlides;
    const reorderedSlides = arrayMove(orderedSlides, oldIndex, newIndex).map((slide, index) => ({
      ...slide,
      position: index + 1,
    }));

    console.log('[DRAG] 📋 New order:', reorderedSlides.map(s => ({ 
      id: s.id.substring(0, 8), 
      position: s.position 
    })));

    // Optimistic update
    setOrderedSlides(reorderedSlides);
    onSlidesReordered(reorderedSlides)

    console.log('[DRAG] ✅ Optimistic UI update complete');
    console.log('[DRAG] 🔄 Starting database update...');
    console.log('[DRAG] Song ID:', song.id);

    setIsReordering(true)

    try {
      const previousPositions = previousSlides.map((slide) => ({
        id: slide.id,
        position: slide.position,
      }))
      const reorderedPositions = reorderedSlides.map((slide) => ({
        id: slide.id,
        position: slide.position,
      }))

      const applyPositionsSafely = async (
        positions: { id: string; position: number }[],
        phaseLabel: string
      ) => {
        if (positions.length === 0) return

        const targetPositions = positions.map((item) => item.position)
        const lowestTargetPosition = Math.min(...targetPositions)
        const tempBase = lowestTargetPosition - positions.length - 1000

        console.log(`[DRAG] ${phaseLabel} - phase 1/2: moving rows to temporary positions...`)
        for (const [index, item] of positions.entries()) {
          const temporaryPosition = tempBase - index
          const { error } = await supabase
            .from('song_slides')
            .update({ position: temporaryPosition })
            .eq('id', item.id)
            .eq('song_id', song.id)

          if (error) {
            throw error
          }
        }

        console.log(`[DRAG] ${phaseLabel} - phase 2/2: writing final positions...`)
        for (const [index, item] of positions.entries()) {
          console.log(
            `[DRAG]   Slide ${index + 1}/${positions.length}: ${item.id.substring(0, 8)} → position ${item.position}`
          )

          const { error } = await supabase
            .from('song_slides')
            .update({ position: item.position })
            .eq('id', item.id)
            .eq('song_id', song.id)

          if (error) {
            throw error
          }
        }
      }

      console.log('[DRAG] 📝 Persisting reordered positions...')

      try {
        await applyPositionsSafely(reorderedPositions, 'Persist reorder')
      } catch (persistError) {
        console.error('[DRAG] ❌ Failed to persist reordered positions. Attempting rollback...', persistError)

        try {
          await applyPositionsSafely(previousPositions, 'Rollback reorder')
          console.log('[DRAG] ✅ Rollback writes completed')
        } catch (rollbackError) {
          console.error('[DRAG] ❌ Rollback writes failed:', rollbackError)
          throw new Error(
            `No se pudo guardar ni restaurar el orden en la base de datos: ${getErrorMessage(
              rollbackError
            )}`
          )
        }

        throw persistError
      }

      console.log('[DRAG] ✅✅✅ DATABASE UPDATE COMPLETE ✅✅✅');
      toast.success('Orden actualizado correctamente');

      // Refetch slides from database to confirm new order
      console.log('[DRAG] 🔄 Refetching slides from database...');
      const { data: refreshedSlides, error: fetchError } = await supabase
        .from('song_slides')
        .select('*')
        .eq('song_id', song.id)
        .order('position', { ascending: true });

      if (fetchError) {
        console.error('[DRAG] Error fetching updated slides:', fetchError);
      } else if (refreshedSlides) {
        console.log('[DRAG] ✅ Slides refetched, updating UI with', refreshedSlides.length, 'slides');

        // Update the parent component's slides state
        onSlidesReordered(refreshedSlides)

        // Update local ordered slides
        setOrderedSlides(refreshedSlides);

        console.log('[DRAG] ✅ UI updated with confirmed database order');
      }

    } catch (error: unknown) {
      console.error('[DRAG] ❌❌❌ DATABASE UPDATE FAILED ❌❌❌');
      console.error('[DRAG] Error details:', error);
      
      const errorMessage = getErrorMessage(error);
      toast.error(`Error guardando: ${errorMessage}`);

      // Revert
      console.log('[DRAG] 🔄 Reverting to original order...');
      setOrderedSlides(previousSlides);
      onSlidesReordered(previousSlides)
    } finally {
      setIsReordering(false)
    }

    console.log('=== DRAG END ===\n\n');
  };


  const handleAddBibleVerse = async (verse: VerseRange) => {
    if (!activeWorkspaceId) {
      console.error('[BIBLE_VERSE] No active workspace for adding verse')
      toast.error('No hay workspace activo')
      return
    }

    try {
      console.log('[BIBLE_VERSE] Adding verse to song:', song.id, verse.displayReference)
      
      const slide = await createBibleVerseSlide(song.id, verse)
      onSlideCreated(slide)
      
      toast.success(`Versículo agregado: ${verse.displayReference}`)
      setShowBibleVerseSelector(false)
      
    } catch (err: any) {
      console.error('[BIBLE_VERSE] Error adding verse:', err)
      toast.error(`Error agregando versículo: ${err.message}`)
    }
  }

  const handleDeleteSlide = async (slideId: string) => {
    try {
      console.log('[SLIDES] Deleting slide (hard delete):', slideId)
      
      // Get the position of the slide being deleted
      const slideToDeleteObj = slides.find(s => s.id === slideId)
      if (!slideToDeleteObj) {
        throw new Error('Slide not found')
      }
      const deletedPosition = slideToDeleteObj.position
      
      // PASO 1: Delete the slide
      const { error: deleteError } = await supabase
        .from('song_slides')
        .delete()
        .eq('id', slideId)

      if (deleteError) throw deleteError
      
      console.log('[SLIDES] ✅ Slide deleted successfully, position was:', deletedPosition)
      
      // PASO 2: Reindex positions of all subsequent slides
      console.log('[SLIDES] Reindexing positions of subsequent slides...')
      const { data: slidesToReindex, error: fetchError } = await supabase
        .from('song_slides')
        .select('id, position')
        .eq('song_id', song.id)
        .gt('position', deletedPosition)

      if (fetchError) throw fetchError

      // Update each slide's position
      if (slidesToReindex && slidesToReindex.length > 0) {
        for (const slide of slidesToReindex) {
          const { error } = await supabase
            .from('song_slides')
            .update({ position: slide.position - 1 })
            .eq('id', slide.id)
          if (error) throw error
        }
      }
      
      console.log('[SLIDES] ✅ Positions reindexed successfully')
      onSlideDeleted(slideId)
      
      // Clear preview if deleted slide was selected
      if (currentSlideId === slideId) {
        setCurrentSlideId(null)
      }
      
      toast.success('Diapositiva eliminada exitosamente')
      
    } catch (err: any) {
      const message = err?.message || 'Error desconocido'
      console.error('[SLIDES] Error deleting slide:', message, err)
      toast.error(`Error eliminando diapositiva: ${message}`)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-[#333] flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{song.title}</h2>
          <div className="flex gap-4 text-sm text-gray-400">
            {song.author && <span>Autor: {song.author.replace(/\s+/g, '')}</span>}
            {song.tonality && <span>Tonalidad: {song.tonality}</span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="bg-[#7C6FD8] hover:bg-[#6C5FC8] border border-[#7C6FD8] hover:border-[#6C5FC8] text-white transition-all duration-200">
              <MoreVertical size={16} />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setShowEditSong(true)}>
                <Edit2 />
                Editar canción
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleAddSlide} disabled={creatingSlide}>
                <Plus />
                Agregar slide
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setIsEditingMode(true)} 
                disabled={slides.length === 0 || isEditingMode}
              >
                <Edit2 />
                Editar slide
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem 
                variant="destructive" 
                onClick={() => setShowDeleteSongDialog(true)}
                disabled={deleting}
              >
                <Trash2 />
                Eliminar canción
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {isEditingMode && (
          <button
            onClick={() => setIsEditingMode(false)}
            className="px-3 py-1.5 text-sm font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-500 rounded transition-colors"
          >
            Terminar edición
          </button>
        )}
      </div>

      {/* Slides Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {slidesLoading || isReordering ? (
          <SlidesLoadingSkeleton />
        ) : slides.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center space-y-6">
              <p className="text-gray-400">No hay diapositivas</p>
              <button
                onClick={handleAddSlide}
                disabled={creatingSlide}
                className="card border-2 border-dashed border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center px-8 py-12 group"
              >
                <Plus size={24} className="text-gray-400 group-hover:text-gray-300 mb-2 transition-colors" />
                <span className="text-sm text-gray-400 group-hover:text-gray-300 font-medium transition-colors">
                  Agregar diapositiva
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {isEditingMode && (
              <>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-center justify-between">
                  <p className="text-sm text-amber-400 font-medium">Modo edición: Arrastra el slide desde el icono de menú para cambiarlo de posición, haz click en un slide para editarlo o haz click en el icono de basurero para eliminarlo</p>
                </div>
              </>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Diapositivas ({slides.length})</h3>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedSlides.map((slide) => slide.id)}
                strategy={rectSortingStrategy}
              >
            <div className="grid grid-cols-3 gap-3">
              {orderedSlides.map((slide) => {
                const isActiveSlide = currentSlideId === slide.id
                
                return (
                  <SortableSlide
                    key={slide.id}
                    slide={slide}
                    isActiveSlide={isActiveSlide}
                    isEditingMode={isEditingMode && !showEditSlide}
                    onClick={() => {
                      if (isEditingMode) {
                        // In edit mode: clicking a slide opens the editor (only for lyrics/verses)
                        if (['verse', 'chorus', 'bridge', 'prechorus', 'tag', 'intro', 'outro', 'ending', 'other'].includes(slide.type)) {
                          setEditingSlide(slide)
                          setShowEditSlide(true)
                        }
                      } else {
                        // Normal mode: clicking a slide makes it active in live output
                        setCurrentSlideId(slide.id)
                      }
                    }}
                    onDelete={() => {
                      setSlideToDelete(slide.id)
                      setShowDeleteSlideDialog(true)
                    }}
                  />
                )
              })}

              {/* Quick Add Slide Card - Only visible in edit mode */}
              {isEditingMode && (
                <button
                  onClick={handleAddSlide}
                  disabled={creatingSlide}
                  className="card border-2 border-dashed border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center min-h-[120px] group"
                >
                  <Plus size={24} className="text-gray-400 group-hover:text-gray-300 mb-2 transition-colors" />
                  <span className="text-sm text-gray-400 group-hover:text-gray-300 font-medium transition-colors">
                    Agregar diapositiva
                  </span>
                </button>
              )}
            </div>
            </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditSong && (
        <EditSongModal
          song={song}
          onClose={() => setShowEditSong(false)}
          onSave={onSongUpdated}
          onSlidesUpdated={(updatedSlides) => {
            updatedSlides.forEach((slide) => onSlideUpdated(slide))
          }}
        />
      )}

      {showEditSlide && editingSlide && (
        <EditSlideModal
          slide={editingSlide}
          onClose={() => {
            setShowEditSlide(false)
            setEditingSlide(null)
          }}
          onSave={onSlideUpdated}
        />
      )}

      {showBibleVerseSelector && (
        <BibleVerseSelector
          onCancel={() => setShowBibleVerseSelector(false)}
          onAddVerse={handleAddBibleVerse}
        />
      )}

      {/* Delete Song Dialog */}
      <AlertDialog open={showDeleteSongDialog} onOpenChange={setShowDeleteSongDialog}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 className="h-6 w-6 text-red-500" />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Eliminar esta canción?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la canción y todas sus diapositivas. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSong} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Slide Dialog */}
      <AlertDialog open={showDeleteSlideDialog} onOpenChange={setShowDeleteSlideDialog}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 className="h-6 w-6 text-red-500" />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Eliminar esta diapositiva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la diapositiva. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (slideToDelete) {
                  handleDeleteSlide(slideToDelete)
                  setShowDeleteSlideDialog(false)
                  setSlideToDelete(null)
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
