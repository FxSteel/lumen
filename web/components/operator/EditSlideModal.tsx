'use client'

import { useState } from 'react'
import { SongSlide } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { X, ChevronDown, AlertTriangle } from 'lucide-react'
import { getSlideTypeDisplayName, getSlideTypeColor } from '@/lib/bible-slides'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface EditSlideModalProps {
  slide: SongSlide
  onClose: () => void
  onSave: (slide: SongSlide) => void
}

const slideTypes = ['verse', 'chorus', 'bridge', 'prechorus', 'tag', 'intro', 'outro', 'ending', 'other'] as const

export default function EditSlideModal({
  slide,
  onClose,
  onSave,
}: EditSlideModalProps) {
  const [formData, setFormData] = useState({
    type: slide.type,
    label: slide.label || '',
    content: slide.content,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { data, error } = await supabase
        .from('song_slides')
        .update({
          type: formData.type,
          label: formData.label || null,
          content: formData.content,
        })
        .eq('id', slide.id)
        .select()
        .single()

      if (error) throw error
      onSave(data)
      onClose()
    } catch (err: any) {
      console.error('Error updating slide:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg border border-[#333] w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333]">
          <h3 className="font-semibold text-white">Editar Diapositiva #{slide.position + 1}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Diapositiva
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full h-10 justify-between bg-[#2a2a2a] border-[#333] text-white hover:bg-[#2a2a2a] hover:text-white hover:border-[#333]"
                  >
                    <span style={{ color: getSlideTypeColor(formData.type) }}>{getSlideTypeDisplayName(formData.type)}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  {slideTypes.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => setFormData({ ...formData, type: type as SongSlide['type'] })}
                      className={formData.type === type ? "bg-[#7C6FD8] text-white" : ""}
                    >
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getSlideTypeColor(type) }} />
                      {getSlideTypeDisplayName(type)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Etiqueta (Opcional)
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Ej: Estribillo #1"
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contenido
            </label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              className="w-full h-64 p-3 bg-[#2a2a2a] border border-[#333] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent font-mono text-sm"
              placeholder="Escribe el contenido de la diapositiva aquí..."
            />
            
            {/* Line counter */}
            <div className="flex items-center justify-between text-sm text-gray-400 mt-2 px-1">
              <span>{formData.content.split('\n').length}/6 líneas</span>
            </div>

            {/* Warning for too many lines */}
            {formData.content.split('\n').length > 6 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md mt-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  Esta diapositiva tiene demasiado texto. Considera dividirla en múltiples diapositivas para mejor legibilidad.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-[#333]">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/5 text-red-400 hover:text-red-300 rounded transition-colors text-sm border border-red-400/20 hover:border-red-300/20"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
