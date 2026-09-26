'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Film, ImageIcon, Trash2, Plus, TvMinimalPlay, Cast } from 'lucide-react'
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
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { LiveOutputBroadcaster } from '@/lib/broadcast'
import { getGlobalBridge } from '@/lib/display-nova-bridge'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB
const BUCKET = 'workspace-media'

interface MediaItem {
  id: string
  name: string
  file_path: string
  file_type: 'image' | 'video'
  mime_type: string
  size_bytes: number
  created_at: string
}

interface MultimediaPanelProps {
  workspaceId: string
}

export default function MultimediaPanel({ workspaceId }: MultimediaPanelProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [itemToDelete, setItemToDelete] = useState<MediaItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const broadcasterRef = useRef<LiveOutputBroadcaster | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => {
    broadcasterRef.current = new LiveOutputBroadcaster()
    return () => { broadcasterRef.current?.close() }
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('workspace_media')
        .select('id, name, file_path, file_type, mime_type, size_bytes, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
    } catch (err: any) {
      toast.error('Error cargando multimedia: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ''
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('El archivo supera el límite de 500 MB')
      return
    }

    const fileType: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image'
    const ext = file.name.split('.').pop() || ''
    const uuid = crypto.randomUUID()
    const filePath = `${workspaceId}/${uuid}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    setUploading(true)
    setUploadProgress(0)
    try {
      // Get a signed upload URL for direct XHR upload with progress
      const { data: signedData, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(filePath)

      if (signedError || !signedData) throw signedError || new Error('No se pudo crear URL de subida')

      // Upload with XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          xhrRef.current = null
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          xhrRef.current = null
          reject(new Error('Error de red durante la subida'))
        })

        xhr.open('PUT', signedData.signedUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      const { data: { user } } = await supabase.auth.getUser()

      const { data: inserted, error: dbError } = await supabase
        .from('workspace_media')
        .insert({
          workspace_id: workspaceId,
          uploaded_by: user?.id,
          name: file.name,
          file_path: filePath,
          file_type: fileType,
          mime_type: file.type,
          size_bytes: file.size,
        })
        .select('id, name, file_path, file_type, mime_type, size_bytes, created_at')
        .single()

      if (dbError) {
        await supabase.storage.from(BUCKET).remove([filePath])
        throw dbError
      }

      setItems((prev) => [inserted, ...prev])
      toast.success('Archivo subido correctamente')
    } catch (err: any) {
      toast.error('Error al subir: ' + err.message)
    } finally {
      setUploading(false)
      setUploadProgress(0)
      xhrRef.current = null
    }
  }

  const getPublicUrl = (filePath: string) =>
    supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl

  const handleSelectItem = (item: MediaItem) => {
    setSelectedItem(item)
    // Preload media in live-output windows and native app so projection is instant
    const url = getPublicUrl(item.file_path)
    broadcasterRef.current?.sendMediaPreload(item.file_type, url)
    getGlobalBridge()?.preloadMedia(item.file_type, url)
  }

  const handleProject = () => {
    if (!selectedItem) return
    const url = getPublicUrl(selectedItem.file_path)
    const mediaType = selectedItem.file_type

    localStorage.setItem('output-mode', 'media')
    localStorage.setItem('current-media', JSON.stringify({ mediaType, url }))

    broadcasterRef.current?.sendMediaProjection(mediaType, url)
    getGlobalBridge()?.sendMedia(mediaType, url)
    toast.success('Proyectando en pantallas')
  }

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([itemToDelete.file_path])
      if (storageError) throw storageError

      const { error: dbError } = await supabase.from('workspace_media').delete().eq('id', itemToDelete.id)
      if (dbError) throw dbError

      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id))
      if (selectedItem?.id === itemToDelete.id) setSelectedItem(null)
      toast.success('Archivo eliminado')
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message)
    } finally {
      setItemToDelete(null)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      {/* Column A: Media list */}
      <div className="w-72 bg-[#1a1a1a] rounded-lg border border-[#333] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[#333]">
          <div className="flex items-center gap-2 text-white mb-3">
            <TvMinimalPlay className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Multimedia</h2>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] disabled:opacity-50 text-white rounded text-sm transition-all duration-200 relative overflow-hidden"
          >
            {uploading && (
              <div
                className="absolute inset-0 bg-[#6C5FC8] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Plus size={16} />
              {uploading
                ? uploadProgress >= 100
                  ? 'Procesando...'
                  : `Subiendo... ${uploadProgress}%`
                : 'Agregar multimedia'}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
              Cargando...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-500 px-4 text-center">
              <ImageIcon size={24} className="opacity-40" />
              <p className="text-xs">Sin archivos multimedia. Agrega imágenes o videos para proyectar.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 border-b border-[#222] transition-colors cursor-pointer ${
                  selectedItem?.id === item.id
                    ? 'bg-[#7C6FD8]/20 border-l-2 border-l-[#7C6FD8]'
                    : 'hover:bg-[#2a2a2a]'
                }`}
              >
                {item.file_type === 'video' ? (
                  <Film size={16} className="text-blue-400 shrink-0" />
                ) : (
                  <ImageIcon size={16} className="text-green-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-500">{formatSize(item.size_bytes)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setItemToDelete(item) }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-all shrink-0"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column B: Preview */}
      <div className="flex-1 bg-[#1a1a1a] rounded-lg border border-[#333] flex flex-col overflow-hidden">
        {selectedItem ? (
          <>
            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
              {selectedItem.file_type === 'image' ? (
                <img
                  src={getPublicUrl(selectedItem.file_path)}
                  alt={selectedItem.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <VideoPreview url={getPublicUrl(selectedItem.file_path)} />
              )}
            </div>
            <div className="p-3 border-t border-[#333] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{selectedItem.name}</p>
                <p className="text-xs text-gray-400">{formatSize(selectedItem.size_bytes)} · {selectedItem.mime_type}</p>
              </div>
              <button
                onClick={handleProject}
                className="flex items-center gap-2 px-4 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white text-sm font-medium rounded transition-colors shrink-0"
              >
                <Cast size={14} />
                Proyectar
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
            <ImageIcon size={40} className="opacity-20" />
            <p className="text-sm">Selecciona un archivo para previsualizar</p>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => { if (!open) setItemToDelete(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 className="h-6 w-6 text-red-500" />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente <span className="text-white font-medium">{itemToDelete?.name}</span> del almacenamiento. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Video preview with audio level bar ───────────────────────────────────────

function VideoPreview({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const [hasAudio, setHasAudio] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let ctx: AudioContext | null = null

    const setup = () => {
      try {
        ctx = new AudioContext()
        const source = ctx.createMediaElementSource(video)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyser.connect(ctx.destination)
        analyserRef.current = analyser
        setHasAudio(true)
        drawLoop()
      } catch {
        // No audio track or context blocked — hide bar silently
      }
    }

    const drawLoop = () => {
      const analyser = analyserRef.current
      const canvas = canvasRef.current
      if (!analyser || !canvas) return

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(dataArray)

      const avg = dataArray.reduce((s, v) => s + v, 0) / bufferLength
      const level = avg / 255

      const ctx2d = canvas.getContext('2d')
      if (ctx2d) {
        ctx2d.clearRect(0, 0, canvas.width, canvas.height)
        const gradient = ctx2d.createLinearGradient(0, 0, canvas.width * level, 0)
        gradient.addColorStop(0, '#7C6FD8')
        gradient.addColorStop(1, '#A8A5FF')
        ctx2d.fillStyle = '#2a2a2a'
        ctx2d.fillRect(0, 0, canvas.width, canvas.height)
        ctx2d.fillStyle = gradient
        ctx2d.fillRect(0, 0, canvas.width * level, canvas.height)
      }

      rafRef.current = requestAnimationFrame(drawLoop)
    }

    video.addEventListener('play', setup, { once: true })

    return () => {
      cancelAnimationFrame(rafRef.current)
      ctx?.close()
    }
  }, [url])

  return (
    <div className="flex flex-col w-full h-full">
      <video
        ref={videoRef}
        key={url}
        src={url}
        controls
        className="flex-1 w-full object-contain bg-black"
      />
      {hasAudio && (
        <div className="px-3 py-2 bg-[#111]">
          <p className="text-[10px] text-gray-500 mb-1">Nivel de audio</p>
          <canvas ref={canvasRef} width={400} height={6} className="w-full h-1.5 rounded-full" />
        </div>
      )}
    </div>
  )
}
