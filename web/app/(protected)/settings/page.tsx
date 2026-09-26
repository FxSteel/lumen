'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-provider'
import { supabase } from '@/lib/supabase'
import { useWorkspace } from '@/lib/workspace-provider'
import { ChevronDown, Upload, X, CreditCard, User, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Tab = 'workspace' | 'profile' | 'billing'

export default function SettingsPage() {
  const { workspace: activeWorkspace } = useWorkspace()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = (searchParams.get('tab') as Tab) || 'workspace'

  // Workspace state
  const [workspaceName, setWorkspaceName] = useState('')
  const [language, setLanguage] = useState('es')
  const [logoUrl, setLogoUrl] = useState('')
  const [announcementUrl, setAnnouncementUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [announcementUploading, setAnnouncementUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Profile state
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (!activeWorkspace) return

    setWorkspaceName(activeWorkspace.name || '')

    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('workspace_settings')
          .select('*')
          .eq('workspace_id', activeWorkspace.id)
          .single()

        if (data) {
          if (data.language) setLanguage(data.language)
          if (data.logo_url) setLogoUrl(data.logo_url)
          if (data.announcement_url) setAnnouncementUrl(data.announcement_url)
        }
      } catch {
        // No settings yet, use defaults
      }
    }

    fetchSettings()
  }, [activeWorkspace])

  useEffect(() => {
    if (!user) return

    setEmail(user.email || '')

    const fetchProfile = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single()

      if (data?.display_name) setDisplayName(data.display_name)
    }

    fetchProfile()
  }, [user])

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  // ── Workspace handlers ──────────────────────────────────────────────────────

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeWorkspace || !e.target.files?.[0]) return
    const file = e.target.files[0]
    setUploading(true)
    try {
      const MAX_FILE_SIZE = 5 * 1024 * 1024
      if (file.size > MAX_FILE_SIZE) throw new Error('El archivo no debe superar 5MB')

      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) throw new Error('Solo se permiten archivos PNG, JPG, GIF o WebP')

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${activeWorkspace.id}/logo-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('workspace-assets')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw new Error(`Error al subir: ${uploadError.message}`)

      const { data: urlData } = supabase.storage.from('workspace-assets').getPublicUrl(fileName)
      if (!urlData?.publicUrl) throw new Error('No se pudo generar URL pública del logo')

      const { error: updateError } = await supabase
        .from('workspace_settings')
        .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('workspace_id', activeWorkspace.id)

      if (updateError) throw new Error(`Error al guardar configuración: ${updateError.message}`)

      setLogoUrl(urlData.publicUrl)
      toast.success('Logo actualizado correctamente')
    } catch (err: any) {
      toast.error(err.message || 'Error desconocido al subir el logo')
      setLogoUrl('')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteLogo = async () => {
    if (!activeWorkspace || !logoUrl) return
    setUploading(true)
    try {
      const urlParts = logoUrl.split('/workspace-assets/')
      if (!urlParts[1]) throw new Error('No se puede determinar la ruta del archivo')

      const { error: deleteError } = await supabase.storage
        .from('workspace-assets')
        .remove([urlParts[1]])
      if (deleteError) throw deleteError

      const { error: updateError } = await supabase
        .from('workspace_settings')
        .update({ logo_url: null, updated_at: new Date().toISOString() })
        .eq('workspace_id', activeWorkspace.id)
      if (updateError) throw updateError

      setLogoUrl('')
      toast.success('Logo eliminado correctamente')
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar el logo')
    } finally {
      setUploading(false)
    }
  }

  const handleAnnouncementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeWorkspace || !e.target.files?.[0]) return
    const file = e.target.files[0]
    setAnnouncementUploading(true)
    try {
      const MAX_FILE_SIZE = 5 * 1024 * 1024
      if (file.size > MAX_FILE_SIZE) throw new Error('El archivo no debe superar 5MB')

      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) throw new Error('Solo se permiten archivos PNG, JPG, GIF o WebP')

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${activeWorkspace.id}/announcement-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('workspace-assets')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw new Error(`Error al subir: ${uploadError.message}`)

      const { data: urlData } = supabase.storage.from('workspace-assets').getPublicUrl(fileName)
      if (!urlData?.publicUrl) throw new Error('No se pudo generar URL pública del anuncio')

      const { error: updateError } = await supabase
        .from('workspace_settings')
        .update({ announcement_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('workspace_id', activeWorkspace.id)

      if (updateError) throw new Error(`Error al guardar configuración: ${updateError.message}`)

      setAnnouncementUrl(urlData.publicUrl)
      toast.success('Anuncio actualizado correctamente')
    } catch (err: any) {
      toast.error(err.message || 'Error desconocido al subir el anuncio')
      setAnnouncementUrl('')
    } finally {
      setAnnouncementUploading(false)
    }
  }

  const handleDeleteAnnouncement = async () => {
    if (!activeWorkspace || !announcementUrl) return
    setAnnouncementUploading(true)
    try {
      const urlParts = announcementUrl.split('/workspace-assets/')
      if (!urlParts[1]) throw new Error('No se puede determinar la ruta del archivo')

      const { error: deleteError } = await supabase.storage
        .from('workspace-assets')
        .remove([urlParts[1]])
      if (deleteError) throw deleteError

      const { error: updateError } = await supabase
        .from('workspace_settings')
        .update({ announcement_url: null, updated_at: new Date().toISOString() })
        .eq('workspace_id', activeWorkspace.id)
      if (updateError) throw updateError

      setAnnouncementUrl('')
      toast.success('Anuncio eliminado correctamente')
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar el anuncio')
    } finally {
      setAnnouncementUploading(false)
    }
  }

  const handleSaveWorkspace = async () => {
    if (!activeWorkspace) return

    if (!workspaceName.trim()) {
      toast.error('El nombre del workspace es obligatorio')
      return
    }

    setSaving(true)
    try {
      if (workspaceName.trim() !== activeWorkspace.name) {
        const { error: workspaceError } = await supabase
          .from('workspaces')
          .update({ name: workspaceName.trim() })
          .eq('id', activeWorkspace.id)
        if (workspaceError) throw workspaceError
      }

      const { error } = await supabase
        .from('workspace_settings')
        .update({ language })
        .eq('workspace_id', activeWorkspace.id)

      if (error && error.code !== 'PGRST116') throw error

      toast.success('Configuración del workspace guardada')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  // ── Profile handlers ────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!user) return

    if (!displayName.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('El email no es válido')
      return
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    if (newPassword && newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setSavingProfile(true)
    try {
      // Save display name to user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({ user_id: user.id, display_name: displayName.trim() })

      if (profileError) throw profileError

      // Update email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email })
        if (emailError) throw emailError
        toast.success('Email de verificación enviado a la nueva dirección')
      }

      // Update password if provided
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword })
        if (passwordError) throw passwordError
        setNewPassword('')
        setConfirmPassword('')
        toast.success('Contraseña actualizada correctamente')
      }

      if (!newPassword && email === user.email) {
        toast.success('Perfil actualizado correctamente')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar perfil')
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Tab content ─────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'workspace', label: 'Workspace', icon: <Settings size={16} /> },
    { id: 'profile', label: 'Perfil', icon: <User size={16} /> },
    { id: 'billing', label: 'Facturación', icon: <CreditCard size={16} /> },
  ]

  return (
    <div className="w-full h-full overflow-auto bg-[#0f0f0f]">
      <div className="min-h-full flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Configuración</h1>
            <p className="text-gray-400 text-sm">Administra los ajustes de tu cuenta y workspace</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mb-8 bg-[#1a1a1a] border border-[#333] rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center ${
                  activeTab === tab.id
                    ? 'bg-[#7C6FD8] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Workspace Tab ─────────────────────────────────────────── */}
          {activeTab === 'workspace' && (
            <div className="space-y-6">
              {/* Workspace Name */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Nombre del Workspace</h2>
                  <p className="text-xs text-gray-500 mt-1">Personaliza el nombre de tu espacio de trabajo</p>
                </div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Nombre</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  maxLength={50}
                  placeholder="Mi Workspace"
                  className="w-full px-4 py-2.5 bg-[#2a2a2a] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#7C6FD8] transition-colors"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">{workspaceName.length}/50 caracteres</p>
                  {workspaceName.trim() && workspaceName.trim() !== activeWorkspace?.name && (
                    <p className="text-xs text-green-400">✓ Cambios sin guardar</p>
                  )}
                </div>
              </div>

              {/* Language */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Idioma</h2>
                  <p className="text-xs text-gray-500 mt-1">Selecciona el idioma de la interfaz</p>
                </div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Idioma preferido</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled>
                    <Button
                      disabled
                      variant="outline"
                      className="w-full justify-between bg-[#2a2a2a] border-[#333] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-500 hover:border-[#333] cursor-not-allowed opacity-50"
                    >
                      <span>Español</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                </DropdownMenu>
              </div>

              {/* Theme */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Tema</h2>
                  <p className="text-xs text-gray-500 mt-1">Personaliza la apariencia de la aplicación</p>
                </div>
                <div className="p-4 bg-[#2a2a2a]/30 border border-[#333] rounded-lg text-gray-400 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">🔜</span>
                    <div>
                      <p className="font-medium mb-1">Próximamente</p>
                      <p className="text-xs text-gray-500">El selector de tema estará disponible pronto. Actualmente usando tema oscuro.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Logo del Workspace</h2>
                  <p className="text-xs text-gray-500 mt-1">Personaliza la identidad visual de tu workspace</p>
                </div>
                <div className="space-y-4">
                  {logoUrl && (
                    <div className="p-4 bg-[#2a2a2a] rounded-lg border border-[#333] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-[#1a1a1a] rounded border border-[#333] flex items-center justify-center overflow-hidden">
                          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-300 font-medium">Logo actual</p>
                          <p className="text-xs text-gray-500 mt-1">Haz clic en × para eliminar</p>
                        </div>
                      </div>
                      <button
                        onClick={handleDeleteLogo}
                        disabled={uploading}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  )}
                  <label className="flex flex-col items-center justify-center w-full py-8 px-4 border-2 border-dashed border-[#333] rounded-lg cursor-pointer bg-[#2a2a2a]/20 hover:bg-[#2a2a2a]/40 transition-colors group">
                    <Upload size={36} className="text-gray-500 mb-3 group-hover:text-gray-400 transition-colors" />
                    <p className="text-sm text-gray-300 font-medium">Arrastra o selecciona una imagen</p>
                    <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF · Máx. 5MB</p>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} className="hidden" />
                  </label>
                  {uploading && (
                    <div className="p-3 bg-[#2a2a2a]/50 rounded-lg flex items-center gap-2 text-gray-400 text-sm">
                      <div className="w-4 h-4 border-2 border-[#7C6FD8] border-t-transparent rounded-full animate-spin" />
                      Subiendo...
                    </div>
                  )}
                </div>
              </div>

              {/* Announcement */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Anuncio</h2>
                  <p className="text-xs text-gray-500 mt-1">Imagen para mostrar anuncios en presentaciones</p>
                </div>
                <div className="space-y-4">
                  {announcementUrl && (
                    <div className="p-4 bg-[#2a2a2a] rounded-lg border border-[#333] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-[#1a1a1a] rounded border border-[#333] flex items-center justify-center overflow-hidden">
                          <img src={announcementUrl} alt="Announcement" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-300 font-medium">Anuncio actual</p>
                          <p className="text-xs text-gray-500 mt-1">Haz clic en × para eliminar</p>
                        </div>
                      </div>
                      <button
                        onClick={handleDeleteAnnouncement}
                        disabled={announcementUploading}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  )}
                  <label className="flex flex-col items-center justify-center w-full py-8 px-4 border-2 border-dashed border-[#333] rounded-lg cursor-pointer bg-[#2a2a2a]/20 hover:bg-[#2a2a2a]/40 transition-colors group">
                    <Upload size={36} className="text-gray-500 mb-3 group-hover:text-gray-400 transition-colors" />
                    <p className="text-sm text-gray-300 font-medium">Arrastra o selecciona una imagen</p>
                    <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF · Máx. 5MB</p>
                    <input type="file" accept="image/*" onChange={handleAnnouncementUpload} disabled={announcementUploading} className="hidden" />
                  </label>
                  {announcementUploading && (
                    <div className="p-3 bg-[#2a2a2a]/50 rounded-lg flex items-center gap-2 text-gray-400 text-sm">
                      <div className="w-4 h-4 border-2 border-[#7C6FD8] border-t-transparent rounded-full animate-spin" />
                      Subiendo...
                    </div>
                  )}
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveWorkspace}
                  disabled={saving}
                  className="px-6 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] disabled:bg-[#7C6FD8]/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Profile Tab ───────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Display Name */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Información personal</h2>
                  <p className="text-xs text-gray-500 mt-1">Tu nombre visible en la plataforma</p>
                </div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nombre</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  placeholder="Tu nombre"
                  className="w-full px-4 py-2.5 bg-[#2a2a2a] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#7C6FD8] transition-colors"
                />
              </div>

              {/* Email */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Email</h2>
                  <p className="text-xs text-gray-500 mt-1">Cambiar el email requiere verificación</p>
                </div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Dirección de email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-2.5 bg-[#2a2a2a] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#7C6FD8] transition-colors"
                />
                {email !== user?.email && (
                  <p className="text-xs text-amber-400 mt-2">Se enviará un email de verificación a la nueva dirección</p>
                )}
              </div>

              {/* Password */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 transition-colors hover:border-[#444]">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Contraseña</h2>
                  <p className="text-xs text-gray-500 mt-1">Deja los campos en blanco para no cambiarla</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full px-4 py-2.5 bg-[#2a2a2a] border border-[#333] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#7C6FD8] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Confirmar contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      className={`w-full px-4 py-2.5 bg-[#2a2a2a] border rounded-lg text-white placeholder-gray-600 focus:outline-none transition-colors ${
                        confirmPassword && newPassword !== confirmPassword
                          ? 'border-red-500 focus:border-red-400'
                          : 'border-[#333] focus:border-[#7C6FD8]'
                      }`}
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-400 mt-1">Las contraseñas no coinciden</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-6 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] disabled:bg-[#7C6FD8]/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {savingProfile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Billing Tab ───────────────────────────────────────────── */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Coming Soon Card */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6">
                <div className="flex flex-col items-center text-center py-8">
                  <div className="text-5xl mb-4">💳</div>
                  <h2 className="text-2xl font-bold text-white mb-2">Aloha Pay</h2>
                  <div className="inline-flex items-center gap-2 bg-[#7C6FD8]/20 border border-[#7C6FD8]/40 text-[#A8A5FF] px-3 py-1 rounded-full text-xs font-medium mb-4">
                    Próximamente
                  </div>
                  <p className="text-gray-400 max-w-md mb-2">
                    La gestión de pagos y suscripciones estará disponible pronto.
                  </p>
                  <p className="text-xs text-gray-600">Powered by Aloha Pay</p>
                </div>
              </div>

              {/* Future Features */}
              <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6">
                <h3 className="text-base font-semibold text-white mb-4">Funciones próximas</h3>
                <ul className="space-y-3">
                  {[
                    'Ver tu suscripción actual',
                    'Gestionar métodos de pago',
                    'Ver facturas y recibos',
                    'Cambiar o cancelar tu plan',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-gray-400">
                      <div className="w-5 h-5 rounded-full bg-[#7C6FD8]/20 border border-[#7C6FD8]/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#A8A5FF] text-xs">✓</span>
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
