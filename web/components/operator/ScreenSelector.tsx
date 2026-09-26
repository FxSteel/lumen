'use client'

import { useState, useEffect, useRef } from 'react'
import { Monitor, AlertCircle, Plus, Trash2, Radio } from 'lucide-react'
import { toast } from 'sonner'
import type { LumenScreen, NdiOutput } from '@/lib/lumen-bridge'

interface Screen {
  id: number
  label: string
  width: number
  height: number
  isPrimary: boolean
  isInternal: boolean
  availLeft: number
  availTop: number
}

interface ScreenAssignment {
  [key: number]: 'main' | 'stage' | 'none'
}

interface ScreenSelectorProps {
  displayLumenConnected?: boolean
  displayLumenScreens?: LumenScreen[]
  onDisplayLumenAssignScreen?: (screenId: string, role: 'main' | 'stage' | 'none') => void
  onSendNdiConfig?: (outputs: NdiOutput[]) => void
  /** Whether the native app reports NDI as actually usable. `undefined` = state not yet received (unknown). */
  ndiAvailable?: boolean
  /** Native (Lumen) app version reported via the `state` message. */
  nativeVersion?: string
}

export default function ScreenSelector({
  displayLumenConnected,
  displayLumenScreens = [],
  onDisplayLumenAssignScreen,
  onSendNdiConfig,
  ndiAvailable,
  nativeVersion,
}: ScreenSelectorProps) {
  const [screens, setScreens] = useState<Screen[]>([])
  const [screenAssignments, setScreenAssignments] = useState<ScreenAssignment>({})
  const [currentScreenId, setCurrentScreenId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiSupported, setApiSupported] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)

  // Detect screens on mount
  useEffect(() => {
    detectScreens()
    // Load saved assignments from localStorage
    const saved = localStorage.getItem('screenAssignments')
    if (saved) {
      setScreenAssignments(JSON.parse(saved))
    }
  }, [])

  const detectScreens = async () => {
    setLoading(true)
    try {
      // Check if Window Management API is available
      if (!('getScreenDetails' in window)) {
        console.warn('Window Management API not available')
        setApiSupported(false)
        setLoading(false)
        return
      }

      // Request permission
      const permission = await navigator.permissions.query({ name: 'window-management' as any })
      
      if (permission.state === 'denied') {
        setPermissionDenied(true)
        setLoading(false)
        return
      }

      // Get screen details
      const screenDetails = await (window as any).getScreenDetails()
      
      const screenList: Screen[] = screenDetails.screens.map((screen: any, index: number) => ({
        id: index,
        label: screen.label || `Pantalla ${index + 1}`,
        width: Math.round(screen.width),
        height: Math.round(screen.height),
        isPrimary: screen.isPrimary,
        isInternal: screen.isInternal,
        availLeft: Math.round(screen.availLeft),
        availTop: Math.round(screen.availTop),
      }))

      setScreens(screenList)
      
      // Set current screen as the primary or first one
      const primaryScreen = screenList.find(s => s.isPrimary) || screenList[0]
      if (primaryScreen) {
        setCurrentScreenId(primaryScreen.id)
      }

      console.log('[SCREENS] Detected screens:', screenList)
    } catch (error: any) {
      console.error('[SCREENS] Error detecting screens:', error)
      if (error.name === 'NotAllowedError') {
        setPermissionDenied(true)
      } else {
        setApiSupported(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAssignmentChange = (screenId: number, value: 'main' | 'stage' | 'none') => {
    const updated = { ...screenAssignments, [screenId]: value }
    setScreenAssignments(updated)
    localStorage.setItem('screenAssignments', JSON.stringify(updated))
  }

  const handleOpenScreens = async () => {
    try {
      const openWindows: any[] = []

      for (const [screenIdStr, assignment] of Object.entries(screenAssignments)) {
        if (assignment === 'none') continue

        const screenId = Number(screenIdStr)
        const screen = screens.find(s => s.id === screenId)
        if (!screen) continue

        const url = assignment === 'main' ? '/live-output/main' : '/live-output/stage'
        const windowName = `LiveOutput_${assignment}_${screenId}`
        const windowFeatures = `left=${screen.availLeft},top=${screen.availTop},width=${screen.width},height=${screen.height},fullscreen=yes`

        console.log(`[SCREENS] Opening ${assignment} window on screen ${screenId}:`, windowFeatures)

        const newWindow = window.open(url, windowName, windowFeatures)
        if (newWindow) {
          openWindows.push(newWindow)
          // Try to request fullscreen after window loads
          newWindow.addEventListener('load', () => {
            try {
              newWindow.document.documentElement.requestFullscreen().catch((err: any) => {
                console.warn('[SCREENS] Fullscreen request denied:', err)
              })
            } catch (err) {
              console.warn('[SCREENS] Fullscreen not available:', err)
            }
          })
        }
      }

      if (openWindows.length > 0) {
        toast.success(`Se abrieron ${openWindows.length} pantalla(s)`)
      } else {
        toast.warning('No se asignó ninguna pantalla para abrir')
      }
    } catch (error: any) {
      console.error('[SCREENS] Error opening screens:', error)
      toast.error('Error abriendo pantallas: ' + error.message)
    }
  }

  const requestScreenAccess = async () => {
    try {
      console.log('[SCREENS] Requesting screen access...')
      if ('getScreenDetails' in window) {
        const screenDetails = await (window as any).getScreenDetails()
        console.log('[SCREENS] Screen access granted')
        setPermissionDenied(false)
        await detectScreens()
        toast.success('Permisos de pantalla otorgados')
      } else {
        console.error('[SCREENS] Window Management API not supported')
        toast.error('API de gestión de ventanas no soportada')
      }
    } catch (error: any) {
      console.error('[SCREENS] Permission denied:', error)
      setPermissionDenied(true)
      toast.error('Permiso de pantallas denegado')
    }
  }

  const displayLumenStatus = (
    <div className={`flex items-center gap-2 ${displayLumenConnected ? 'text-green-400' : 'text-gray-500'}`}>
      <div className={`w-2 h-2 rounded-full ${displayLumenConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
      <span className="text-xs">{displayLumenConnected ? 'Lumen Connected' : 'Lumen Offline'}</span>
      {displayLumenConnected && nativeVersion && (
        <span className="text-[10px] text-gray-500 font-mono">v{nativeVersion}</span>
      )}
    </div>
  )

  // If Lumen is connected, show only its screens
  if (displayLumenConnected) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Monitor size={20} />
          Pantallas Conectadas
        </h3>
        {displayLumenStatus}
        {displayLumenScreens.length === 0 ? (
          <div className="text-sm text-gray-400">Detectando pantallas de Lumen...</div>
        ) : (
          <LumenScreenSection screens={displayLumenScreens} onAssign={onDisplayLumenAssignScreen} connected={displayLumenConnected} />
        )}
        <NdiSection onSendConfig={onSendNdiConfig} ndiAvailable={ndiAvailable} />
      </div>
    )
  }

  // If API not supported
  if (!apiSupported) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Monitor size={20} />
          Pantallas Conectadas
        </h3>
        {displayLumenStatus}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              Window Management API no disponible
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              Esta función requiere Chrome/Edge 100+ o un navegador compatible con la API de gestión de ventanas.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // If permission denied
  if (permissionDenied) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Monitor size={20} />
          Pantallas Conectadas
        </h3>
        {displayLumenStatus}
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              Permiso de pantallas denegado
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
              Por favor, permitir acceso a pantallas en los permisos del navegador.
            </p>
            <button
              onClick={() => requestScreenAccess()}
              className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              Solicitar permisos nuevamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Monitor size={20} />
          Pantallas Conectadas
        </h3>
        {displayLumenStatus}
        <div className="text-sm text-gray-400">Detectando pantallas...</div>
      </div>
    )
  }

  // No screens
  if (screens.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Monitor size={20} />
          Pantallas Conectadas
        </h3>
        {displayLumenStatus}
        <div className="text-sm text-gray-400">No se detectaron pantallas adicionales</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Monitor size={20} />
        Pantallas Conectadas
      </h3>
      {displayLumenStatus}

      {/* Screen Cards */}
      <div className="space-y-2">
        {screens.map((screen) => {
          const isCurrentScreen = currentScreenId === screen.id
          const assignment = screenAssignments[screen.id] || 'none'

          return (
            <div
              key={screen.id}
              className={`p-3 rounded-md border ${
                isCurrentScreen
                  ? 'bg-[#7C6FD8]/10 border-[#7C6FD8]'
                  : 'bg-[#2a2a2a] border-[#333] hover:border-[#444]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    {screen.label}
                    {screen.isPrimary && <span className="text-xs text-gray-400 ml-2">(Principal)</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {screen.width} × {screen.height}
                  </div>
                </div>

                {isCurrentScreen ? (
                  <div className="px-3 py-2 bg-[#7C6FD8] text-white text-sm rounded font-medium">
                    Pantalla operador
                  </div>
                ) : (
                  <select
                    value={assignment}
                    onChange={(e) =>
                      handleAssignmentChange(screen.id, e.target.value as 'main' | 'stage' | 'none')
                    }
                    className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent cursor-pointer"
                  >
                    <option value="none">Seleccionar...</option>
                    <option value="main">Pantalla Principal</option>
                    <option value="stage">Pantalla Escenario</option>
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Open Screens Button */}
      <button
        onClick={handleOpenScreens}
        className="w-full py-2 px-4 bg-[#7C6FD8] hover:bg-[#6C5FC8] text-white rounded font-medium transition-colors mt-2"
      >
        Abrir Pantallas
      </button>

      {/* Help text */}
      <p className="text-xs text-gray-400 mt-2">
        💡 Selecciona qué mostrar en cada pantalla conectada, luego haz clic en "Abrir Pantallas" para
        proyectar.
      </p>
    </div>
  )
}

const DN_ASSIGNMENTS_KEY = 'displayLumen-screenAssignments'

function LumenScreenSection({
  screens,
  onAssign,
  connected,
}: {
  screens: LumenScreen[]
  onAssign?: (screenId: string, role: 'main' | 'stage' | 'none') => void
  connected?: boolean
}) {
  const [assignments, setAssignments] = useState<Record<string, 'main' | 'stage' | 'none'>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = localStorage.getItem(DN_ASSIGNMENTS_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const wasConnectedRef = useRef(!!connected)

  // Clear assignments only on genuine disconnect → reconnect (not on tab switch remount)
  useEffect(() => {
    if (connected && !wasConnectedRef.current) {
      setAssignments({})
      localStorage.removeItem(DN_ASSIGNMENTS_KEY)
    }
    wasConnectedRef.current = !!connected
  }, [connected])

  const handleChange = (screenId: string, role: 'main' | 'stage' | 'none') => {
    setAssignments((prev) => {
      const updated = { ...prev, [screenId]: role }
      localStorage.setItem(DN_ASSIGNMENTS_KEY, JSON.stringify(updated))
      return updated
    })
    onAssign?.(screenId, role)
    if (role !== 'none') {
      toast.success(`Pantalla asignada: ${role === 'main' ? 'Principal' : 'Escenario'}`)
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t border-[#333]">
      <h4 className="text-sm font-medium text-gray-300">Pantallas detectadas por Lumen</h4>
      {screens.map((screen) => (
        <div key={screen.id} className="p-3 bg-[#2a2a2a] border border-[#333] rounded-md flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white">{screen.name}</p>
            <p className="text-xs text-gray-400">
              {screen.width} × {screen.height}
              {screen.isPrimary && ' (Principal)'}
            </p>
          </div>
          {screen.isPrimary ? (
            <div className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-gray-500 cursor-not-allowed select-none">
              Esta pantalla
            </div>
          ) : (
            <select
              value={assignments[screen.id] || 'none'}
              onChange={(e) => handleChange(screen.id, e.target.value as 'main' | 'stage' | 'none')}
              className="px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7C6FD8] focus:border-transparent cursor-pointer"
            >
              <option value="none">Seleccionar...</option>
              <option value="main">Pantalla principal</option>
              <option value="stage">Pantalla de escenario</option>
            </select>
          )}
        </div>
      ))}
    </div>
  )
}

// ── NDI Section ──────────────────────────────────────────────────────────────

const NDI_STORAGE_KEY = 'lumen-ndiOutputs'

function NdiSection({
  onSendConfig,
  ndiAvailable,
}: {
  onSendConfig?: (outputs: NdiOutput[]) => void
  /** undefined = native state not yet received (unknown); false = NDI SDK missing on the display machine. */
  ndiAvailable?: boolean
}) {
  // NDI outputs won't emit unless the native app reports NDI as available.
  const ndiUnavailable = ndiAvailable === false
  const ndiUnknown = ndiAvailable === undefined
  const [outputs, setOutputs] = useState<NdiOutput[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(NDI_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  const persist = (next: NdiOutput[]) => {
    setOutputs(next)
    localStorage.setItem(NDI_STORAGE_KEY, JSON.stringify(next))
    onSendConfig?.(next)
  }

  const addOutput = () => {
    const next: NdiOutput = {
      id: crypto.randomUUID(),
      name: `Lumen-NDI-${outputs.length + 1}`,
      sendLyrics: true,
      sendBackground: false,
      sendLogo: false,
    }
    persist([...outputs, next])
  }

  const removeOutput = (id: string) => {
    persist(outputs.filter((o) => o.id !== id))
    toast.success('Salida NDI eliminada')
  }

  const updateOutput = (id: string, patch: Partial<NdiOutput>) => {
    const next = outputs.map((o) => (o.id === id ? { ...o, ...patch } : o))
    persist(next)
  }

  return (
    <div className="pt-3 border-t border-[#333] space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Radio size={14} className="text-[#7C6FD8]" />
          Salidas NDI
        </h4>
        <button
          onClick={addOutput}
          className="flex items-center gap-1 px-2 py-1 text-xs text-[#A8A5FF] hover:text-white bg-[#7C6FD8]/10 hover:bg-[#7C6FD8]/20 border border-[#7C6FD8]/30 rounded transition-colors"
        >
          <Plus size={12} />
          Agregar
        </button>
      </div>

      {/* NDI availability status from the native `state` message */}
      {ndiUnavailable ? (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-400 font-medium">NDI no disponible</p>
            <p className="text-xs text-amber-400/80 mt-1">
              Instala NDI Tools en el equipo de pantallas. Las salidas NDI configuradas no se emitirán hasta que esté disponible.
            </p>
          </div>
        </div>
      ) : ndiUnknown ? (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs">Estado de NDI desconocido — esperando al equipo de pantallas…</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-400">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs">NDI disponible</span>
        </div>
      )}

      {outputs.length === 0 && (
        <p className="text-xs text-gray-500">
          Sin salidas NDI configuradas. Agrega una para enviar contenido a OBS u otras plataformas en la red.
        </p>
      )}

      {outputs.map((output) => (
        <div
          key={output.id}
          className={`bg-[#1a1a1a] border rounded-md p-3 space-y-3 ${
            ndiUnavailable ? 'border-amber-500/30 opacity-60' : 'border-[#333]'
          }`}
        >
          {/* Name */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={output.name}
              onChange={(e) => updateOutput(output.id, { name: e.target.value })}
              placeholder="Nombre del stream NDI"
              className="flex-1 px-2 py-1.5 bg-[#2a2a2a] border border-[#333] rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#7C6FD8] transition-colors"
            />
            <button
              onClick={() => removeOutput(output.id)}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
              title="Eliminar salida NDI"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Content toggles */}
          <div className="flex gap-2">
            {(
              [
                { key: 'sendLyrics', label: 'Letras' },
                { key: 'sendBackground', label: 'Fondos' },
                { key: 'sendLogo', label: 'Logo' },
              ] as { key: keyof NdiOutput; label: string }[]
            ).map(({ key, label }) => {
              const active = output[key] as boolean
              return (
                <button
                  key={key}
                  onClick={() => updateOutput(output.id, { [key]: !active })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors ${
                    active
                      ? 'bg-[#7C6FD8] border-[#7C6FD8] text-white'
                      : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:border-[#444]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Status hint */}
          <p className="text-xs text-gray-600">
            Stream: <span className="text-gray-400 font-mono">{output.name || '—'}</span>
            {ndiUnavailable && (
              <span className="text-amber-400 ml-2">· no se emitirá (NDI no disponible)</span>
            )}
          </p>
        </div>
      ))}
    </div>
  )
}
