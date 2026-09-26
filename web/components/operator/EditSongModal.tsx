'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Song, SongSlide } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { X } from 'lucide-react'
import { SongTypography, sanitizeSongTypography } from '@/lib/typography'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface EditSongModalProps {
  song: Song
  onClose: () => void
  onSave: (song: Song) => void
  onSlidesUpdated?: (slides: SongSlide[]) => void
}

type SongBackgroundType = 'none' | 'image' | 'video'

const BACKGROUND_BUCKET = 'song-backgrounds'
const BACKGROUND_BUCKET_FALLBACK = 'workspace-assets'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 300 * 1024 * 1024

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm']

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function getStorageLocationFromPublicUrl(
  url: string | null | undefined
): { bucket: string; path: string } | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/'
  const markerIndex = url.indexOf(marker)
  if (markerIndex === -1) return null
  const location = url.slice(markerIndex + marker.length).split('?')[0]
  const [bucket, ...pathParts] = location.split('/')
  const path = pathParts.join('/')
  if (!bucket || !path) return null
  return { bucket, path }
}

function isMissingBackgroundColumnsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code || '') : ''
  const message = 'message' in error ? String((error as { message?: string }).message || '') : ''
  return code === 'PGRST204' && message.includes('background_')
}

export default function EditSongModal({
  song,
  onClose,
  onSave,
  onSlidesUpdated,
}: EditSongModalProps) {
  const songWithBackground = song as Song & {
    background_type?: SongBackgroundType | null
    background_url?: string | null
  }
  const initialTypography = sanitizeSongTypography(song.typography)
  const [formData, setFormData] = useState({
    title: song.title,
    author: song.author || '',
    tonality: song.tonality || '',
  })
  const [typography, setTypography] = useState({
    font_family: initialTypography?.font_family || '',
    font_size: initialTypography?.font_size?.toString() || '',
    font_weight: initialTypography?.font_weight?.toString() || '',
    line_height: initialTypography?.line_height?.toString() || '',
    letter_spacing: initialTypography?.letter_spacing?.toString() || '',
    color: initialTypography?.color || '',
    shadow: initialTypography?.shadow || '',
  })
  const [saving, setSaving] = useState(false)
  const [backgroundEnabled, setBackgroundEnabled] = useState(
    songWithBackground.background_type === 'image' || songWithBackground.background_type === 'video'
  )
  const [backgroundType, setBackgroundType] = useState<SongBackgroundType>(
    songWithBackground.background_type === 'image' || songWithBackground.background_type === 'video'
      ? songWithBackground.background_type
      : 'image'
  )
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(songWithBackground.background_url || null)
  const initialStorageLocation = getStorageLocationFromPublicUrl(songWithBackground.background_url)
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string | null>(initialStorageLocation?.path || null)
  const [uploadedStorageBucket, setUploadedStorageBucket] = useState<string>(
    initialStorageLocation?.bucket || BACKGROUND_BUCKET
  )
  const [backgroundUploading, setBackgroundUploading] = useState(false)
  const backgroundUploadInFlightRef = useRef(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [backgroundMeta, setBackgroundMeta] = useState<string>('')
  const [backgroundSchemaMissing, setBackgroundSchemaMissing] = useState(false)

  const acceptedFileTypes = useMemo(
    () => (backgroundType === 'image' ? '.jpg,.jpeg,.png,.webp' : '.mp4,.webm'),
    [backgroundType]
  )

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const readImageDimensions = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.onload = () => {
        resolve(`${image.width}x${image.height}px`)
        URL.revokeObjectURL(objectUrl)
      }
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('No se pudo leer dimensiones de imagen'))
      }
      image.src = objectUrl
    })

  const updateBackgroundFile = async (file: File) => {
    if (backgroundSchemaMissing) {
      toast.error('Falta migración en la tabla songs: background_type/background_url')
      return
    }

    const isImageType = IMAGE_MIME_TYPES.includes(file.type)
    const isVideoType = VIDEO_MIME_TYPES.includes(file.type)

    if (backgroundType === 'image' && !isImageType) {
      toast.error('Formato inválido. Usa JPG, PNG o WEBP')
      return
    }

    if (backgroundType === 'video' && !isVideoType) {
      toast.error('Formato inválido. Usa MP4 o WEBM')
      return
    }

    const maxSize = backgroundType === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
    if (file.size > maxSize) {
      toast.error('Archivo muy grande')
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension) {
      toast.error('No se pudo determinar la extensión del archivo')
      return
    }

    backgroundUploadInFlightRef.current = true
    setBackgroundUploading(true)

    try {
      const previousStoragePath = uploadedStoragePath
      const previousStorageBucket = uploadedStorageBucket
      const nextStoragePath = `${song.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`
      const candidateBuckets = Array.from(
        new Set([BACKGROUND_BUCKET, previousStorageBucket, BACKGROUND_BUCKET_FALLBACK])
      )

      let successfulBucket: string | null = null
      let lastUploadError: unknown = null

      for (const bucket of candidateBuckets) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(nextStoragePath, file, { upsert: false, contentType: file.type })

        if (!uploadError) {
          successfulBucket = bucket
          break
        }

        lastUploadError = uploadError
      }

      if (!successfulBucket) {
        throw lastUploadError || new Error('Error subiendo fondo')
      }

      if (previousStoragePath && previousStoragePath !== nextStoragePath) {
        const { error: removeError } = await supabase.storage
          .from(previousStorageBucket)
          .remove([previousStoragePath])
        if (removeError) {
          console.warn('Could not delete previous song background:', removeError)
        }
      }

      const { data: publicUrlData } = supabase.storage.from(successfulBucket).getPublicUrl(nextStoragePath)
      const uploadedUrl = publicUrlData.publicUrl

      setUploadedStorageBucket(successfulBucket)
      setUploadedStoragePath(nextStoragePath)
      setBackgroundUrl(uploadedUrl)

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(URL.createObjectURL(file))

      if (backgroundType === 'image') {
        const dimensions = await readImageDimensions(file)
        setBackgroundMeta(`${formatBytes(file.size)} · ${dimensions}`)
      } else {
        setBackgroundMeta(`${formatBytes(file.size)}`)
      }

      toast.success('Fondo subido correctamente')
    } catch (err) {
      console.error('Error uploading song background:', err)
      const message = err instanceof Error ? err.message : 'Error subiendo fondo'
      toast.error(message || 'Error subiendo fondo')
    } finally {
      backgroundUploadInFlightRef.current = false
      setBackgroundUploading(false)
    }
  }

  const handleDeleteBackground = async () => {
    if (!window.confirm('¿Eliminar fondo?')) return
    setBackgroundUploading(true)

    try {
      const storageLocation = backgroundUrl ? getStorageLocationFromPublicUrl(backgroundUrl) : null
      const storagePath = uploadedStoragePath || storageLocation?.path || null
      const storageBucket = uploadedStorageBucket || storageLocation?.bucket || BACKGROUND_BUCKET
      if (storagePath) {
        await supabase.storage.from(storageBucket).remove([storagePath])
      }

      const { error } = await supabase
        .from('songs')
        .update({ background_type: 'none', background_url: null })
        .eq('id', song.id)

      if (error) {
        if (isMissingBackgroundColumnsError(error)) {
          setBackgroundSchemaMissing(true)
          setBackgroundEnabled(false)
          toast.error('La BD no tiene background_type/background_url. Ejecuta la migración.')
        } else {
          throw error
        }
      }

      setBackgroundEnabled(false)
      setBackgroundType('image')
      setBackgroundUrl(null)
      setUploadedStoragePath(null)
      setUploadedStorageBucket(BACKGROUND_BUCKET)
      setBackgroundMeta('')
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      onSave({ ...song, background_type: 'none', background_url: null } as Song)
      toast.success('Fondo eliminado')
    } catch (err) {
      console.error('Error deleting song background:', err)
      toast.error('Error eliminando fondo')
    } finally {
      setBackgroundUploading(false)
    }
  }

  const validateTypography = (): { valid: boolean; value: SongTypography | null } => {
    const nextTypography: SongTypography = {}

    if (typography.font_family.trim()) {
      nextTypography.font_family = typography.font_family.trim()
    }

    if (typography.font_size.trim()) {
        const value = Number(typography.font_size)
        if (!Number.isFinite(value) || value < 48 || value > 200) {
          toast.error('Tamaño: debe estar entre 48 y 200')
          return { valid: false, value: null }
        }
      nextTypography.font_size = value
    }

    if (typography.font_weight.trim()) {
      const value = Number(typography.font_weight)
      if (![400, 500, 600, 700, 800].includes(value)) {
        toast.error('Weight: usa 400, 500, 600, 700 o 800')
        return { valid: false, value: null }
      }
      nextTypography.font_weight = value
      nextTypography.weight = value
    }

    if (typography.line_height.trim()) {
      const value = Number(typography.line_height)
      if (!Number.isFinite(value) || value < 0.8 || value > 3) {
        toast.error('Line height: debe estar entre 0.8 y 3.0')
        return { valid: false, value: null }
      }
      nextTypography.line_height = value
    }

    if (typography.letter_spacing.trim()) {
      const value = Number(typography.letter_spacing)
      if (!Number.isFinite(value) || value < -5 || value > 20) {
        toast.error('Letter spacing: debe estar entre -5 y 20')
        return { valid: false, value: null }
      }
      nextTypography.letter_spacing = value
    }

    if (typography.color.trim()) {
      nextTypography.color = typography.color.trim()
    }

    if (typography.shadow.trim()) {
      nextTypography.shadow = typography.shadow.trim()
    }

    return { valid: true, value: Object.keys(nextTypography).length > 0 ? nextTypography : null }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (backgroundUploadInFlightRef.current || backgroundUploading) {
      toast.error('Espera a que termine la subida del fondo antes de guardar')
      return
    }

    setSaving(true)

    try {
      const validation = validateTypography()
      if (!validation.valid) {
        setSaving(false)
        return
      }

      const songPayload = {
        title: formData.title || 'Untitled',
        author: formData.author || null,
        tonality: formData.tonality || null,
        typography: validation.value,
      }

      let { data, error } = await supabase
        .from('songs')
        .update({
          ...songPayload,
          background_type: backgroundEnabled ? backgroundType : 'none',
          background_url: backgroundEnabled ? backgroundUrl : null,
        })
        .eq('id', song.id)
        .select()
        .single()

      if (error && isMissingBackgroundColumnsError(error)) {
        setBackgroundSchemaMissing(true)
        setBackgroundEnabled(false)
        toast.error('La BD no tiene background_type/background_url. Ejecuta la migración.')

        const fallbackResult = await supabase
          .from('songs')
          .update(songPayload)
          .eq('id', song.id)
          .select()
          .single()

        data = fallbackResult.data
        error = fallbackResult.error
      }

      if (error) throw error

      const slideTypographyUpdate: Record<string, number> = {}
      if (validation.value?.font_size !== undefined) {
        slideTypographyUpdate.font_size = validation.value.font_size
      }
      if (validation.value?.line_height !== undefined) {
        slideTypographyUpdate.line_height = validation.value.line_height
      }
      if (validation.value?.letter_spacing !== undefined) {
        slideTypographyUpdate.letter_spacing = validation.value.letter_spacing
      }

      if (Object.keys(slideTypographyUpdate).length > 0) {
        const { data: updatedSlides, error: slidesError } = await supabase
          .from('song_slides')
          .update(slideTypographyUpdate)
          .eq('song_id', song.id)
          .select('*')

        if (slidesError) throw slidesError
        if (updatedSlides && onSlidesUpdated) {
          onSlidesUpdated(updatedSlides as SongSlide[])
        }
      }

      onSave(data)
      onClose()
    } catch (err) {
      console.error('Error updating song:', err)
      toast.error('Error actualizando canción')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg border border-[#333] w-full max-w-md h-[85vh] max-h-[760px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333]">
          <h3 className="font-semibold text-white">Editar Canción</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 flex-1 flex flex-col min-h-0">
          <div className="space-y-4 overflow-y-auto pr-1">
          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Título
            </Label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              className="w-full bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
            />
          </div>

          <div className="border border-[#333] rounded-lg p-3 space-y-3">
            <h4 className="text-sm font-semibold text-white">Fondo por canción</h4>
            {backgroundSchemaMissing && (
              <p className="text-xs text-amber-400">
                Tu base de datos no tiene columnas de fondo. Ejecuta la migración de Supabase para habilitar esta sección.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={backgroundEnabled}
                disabled={backgroundSchemaMissing}
                onChange={(event) => setBackgroundEnabled(event.target.checked)}
              />
              Usar fondo personalizado
            </label>

            {backgroundEnabled && !backgroundSchemaMissing && (
              <>
                <div className="flex gap-4 text-sm text-gray-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="backgroundType"
                      value="image"
                      checked={backgroundType === 'image'}
                      onChange={() => setBackgroundType('image')}
                    />
                    Imagen
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="backgroundType"
                      value="video"
                      checked={backgroundType === 'video'}
                      onChange={() => setBackgroundType('video')}
                    />
                    Video
                  </label>
                </div>

                <div className="space-y-2">
                  <Label className="block text-sm text-gray-300">Subir fondo</Label>
                  <Input
                    type="file"
                    accept={acceptedFileTypes}
                    disabled={backgroundUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      updateBackgroundFile(file)
                      event.currentTarget.value = ''
                    }}
                    className="bg-[#2a2a2a] border-[#333] text-white"
                  />
                  <p className="text-xs text-gray-500">
                    {backgroundType === 'image'
                      ? 'Formatos: JPG, PNG, WEBP · Máximo 10MB'
                      : 'Formatos: MP4, WEBM · Máximo 300MB'}
                  </p>
                </div>

                {(previewUrl || backgroundUrl) && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Vista previa</p>
                    {backgroundType === 'image' ? (
                      <img
                        src={previewUrl || backgroundUrl || ''}
                        alt="Preview fondo"
                        className="w-full h-28 object-cover rounded border border-[#333]"
                      />
                    ) : (
                      <video
                        src={previewUrl || backgroundUrl || ''}
                        className="w-full h-28 object-cover rounded border border-[#333]"
                        muted
                        loop
                        autoPlay
                      />
                    )}
                    {backgroundMeta && <p className="text-xs text-gray-400">{backgroundMeta}</p>}
                  </div>
                )}

                {(backgroundUrl || uploadedStoragePath) && (
                  <Button
                    type="button"
                    onClick={handleDeleteBackground}
                    disabled={backgroundUploading}
                    variant="outline"
                    className="border-red-400/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-300/40"
                  >
                    Eliminar fondo
                  </Button>
                )}
              </>
            )}
          </div>

          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Autor
            </Label>
            <Input
              type="text"
              value={formData.author}
              onChange={(e) =>
                setFormData({ ...formData, author: e.target.value })
              }
              className="w-full bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
            />
          </div>

          <div>
            <Label className="block text-sm font-medium text-gray-300 mb-2">
              Tonalidad
            </Label>
            <Input
              type="text"
              value={formData.tonality}
              onChange={(e) =>
                setFormData({ ...formData, tonality: e.target.value })
              }
              className="w-full bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
            />
          </div>

          <div className="border border-[#333] rounded-lg p-3 space-y-3">
            <h4 className="text-sm font-semibold text-white">Tipografía (por canción)</h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="block text-sm text-gray-300 mb-2">Font Family</Label>
                <select
                  value={typography.font_family}
                  onChange={(e) =>
                    setTypography((prev) => ({ ...prev, font_family: e.target.value }))
                  }
                  className="w-full h-10 rounded-md border border-[#333] bg-[#2a2a2a] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">(Fallback global)</option>
                  <option value="Inter">Inter</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                </select>
              </div>

              <div>
                <Label className="block text-sm text-gray-300 mb-2">Weight</Label>
                <select
                  value={typography.font_weight}
                  onChange={(e) =>
                    setTypography((prev) => ({ ...prev, font_weight: e.target.value }))
                  }
                  className="w-full h-10 rounded-md border border-[#333] bg-[#2a2a2a] px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Auto</option>
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                  <option value="700">700</option>
                  <option value="800">800</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="block text-sm text-gray-300 mb-2">Tamaño</Label>
                <Input
                  type="number"
                  min={48}
                  max={200}
                  placeholder="64"
                  value={typography.font_size}
                  onChange={(e) =>
                    setTypography((prev) => ({ ...prev, font_size: e.target.value }))
                  }
                  className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
                />
              </div>
              <div>
                <Label className="block text-sm text-gray-300 mb-2">Line height</Label>
                <Input
                  type="number"
                  min={0.8}
                  max={3}
                  step="0.05"
                  placeholder="1.2"
                  value={typography.line_height}
                  onChange={(e) =>
                    setTypography((prev) => ({ ...prev, line_height: e.target.value }))
                  }
                  className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
                />
              </div>
              <div>
                <Label className="block text-sm text-gray-300 mb-2">Letter spacing</Label>
                <Input
                  type="number"
                  min={-5}
                  max={20}
                  step="0.1"
                  placeholder="0"
                  value={typography.letter_spacing}
                  onChange={(e) =>
                    setTypography((prev) => ({ ...prev, letter_spacing: e.target.value }))
                  }
                  className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-sm text-gray-300 mb-2">Color</Label>
                <Input
                  type="text"
                  placeholder="#FFFFFF"
                  value={typography.color}
                  onChange={(e) =>
                    setTypography((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
                />
              </div>
              <div>
                <Label className="block text-sm text-gray-300 mb-2">Shadow</Label>
                <Input
                  type="text"
                  placeholder="0 2px 10px rgba(0,0,0,.35)"
                  value={typography.shadow}
                  onChange={(e) =>
                    setTypography((prev) => ({ ...prev, shadow: e.target.value }))
                  }
                  className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 mt-4 border-t border-[#333] shrink-0">
            <Button
              type="submit"
              disabled={saving || backgroundUploading}
              className="flex-1 bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white"
            >
              {saving ? 'Guardando...' : backgroundUploading ? 'Subiendo fondo...' : 'Guardar cambios'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-red-400/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-300/40"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
