import { PROTOCOL_VERSION } from '@nova/shared'
import type { NativeState, ServerMessage } from '@nova/shared'

let _globalBridge: DisplayNovaBridge | null = null

export function getGlobalBridge(): DisplayNovaBridge | null {
  if (typeof window === 'undefined') return null
  if (!_globalBridge) _globalBridge = new DisplayNovaBridge()
  return _globalBridge
}

export function destroyGlobalBridge() {
  if (_globalBridge) {
    _globalBridge.disconnect()
    _globalBridge = null
  }
}

export interface NdiOutput {
  id: string
  name: string
  sendLyrics: boolean
  sendBackground: boolean
  sendLogo: boolean
}

export interface DisplayNovaScreen {
  id: string
  name: string
  width: number
  height: number
  isPrimary: boolean
}

export class DisplayNovaBridge {
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private livenessTimeout: ReturnType<typeof setTimeout> | null = null
  private _isConnected = false
  private destroyed = false

  private readonly HEARTBEAT_MS = 10000
  private readonly LIVENESS_MS = 25000

  onConnectionChange?: (connected: boolean) => void
  onScreensDetected?: (screens: DisplayNovaScreen[]) => void
  onState?: (state: NativeState) => void

  constructor() {
    this.connect()
  }

  get isConnected(): boolean {
    return this._isConnected
  }

  connect() {
    if (this.destroyed) return

    try {
      this.socket = new WebSocket('ws://localhost:9877')

      this.socket.onopen = () => {
        if (this.destroyed) {
          this.socket?.close()
          return
        }
        console.log('[Display-Nova] Connected')
        this._isConnected = true
        this.onConnectionChange?.(true)
        // Handshake: announce our protocol version right after opening.
        this.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION })
        this.requestScreens()
        this.startHeartbeat()
      }

      this.socket.onclose = () => {
        console.log('[Display-Nova] Disconnected')
        this._isConnected = false
        this.stopHeartbeat()
        this.onConnectionChange?.(false)
        this.scheduleReconnect()
      }

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          // Any inbound traffic proves the server is alive: reset the silence watchdog.
          this.resetLiveness()
          this.handleMessage(message)
        } catch (err) {
          console.error('[Display-Nova] Failed to parse message:', err)
        }
      }

      this.socket.onerror = () => {
        // onerror fires before onclose; let onclose handle reconnect
      }
    } catch (error) {
      console.error('[Display-Nova] Failed to connect:', error)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 5000)
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    if (this.destroyed) return
    // Arm the silence watchdog immediately so a server that never talks still triggers reconnect.
    this.resetLiveness()
    // Proactively poke the server so a stalled connection surfaces as a missing reply.
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping', t: Date.now() })
    }, this.HEARTBEAT_MS)
  }

  private resetLiveness() {
    if (this.destroyed) return
    if (this.livenessTimeout) clearTimeout(this.livenessTimeout)
    this.livenessTimeout = setTimeout(() => {
      this.livenessTimeout = null
      console.warn('[Display-Nova] Server silent; closing socket to force reconnect')
      // Closing lets the existing onclose → scheduleReconnect path run.
      this.socket?.close()
    }, this.LIVENESS_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.livenessTimeout) {
      clearTimeout(this.livenessTimeout)
      this.livenessTimeout = null
    }
  }

  private handleMessage(message: ServerMessage | { type: 'ping'; t: number }) {
    switch (message.type) {
      case 'hello-ack':
        console.log('[Display-Nova] Handshake ack, protocol', message.protocolVersion)
        break
      case 'screens-detected':
        this.onScreensDetected?.(message.payload?.screens ?? [])
        break
      case 'screen-assignment-confirmed':
        console.log('[Display-Nova] Screen assignment confirmed')
        break
      case 'state':
        this.onState?.(message.payload)
        break
      case 'ping':
        // Server-initiated heartbeat: echo the timestamp back.
        this.send({ type: 'pong', t: message.t })
        break
      case 'pong':
        // Liveness already refreshed by resetLiveness() on receipt.
        break
      default:
        console.log('[Display-Nova] Unknown message type:', (message as { type?: string }).type)
    }
  }

  sendSlide(screen: 'main' | 'stage', slide: any) {
    this.send({ type: 'display-slide', screen, slide })
  }

  sendDisplayMode(mode: 'slide' | 'logo' | 'announcement' | 'clear', data?: any) {
    this.send({ type: 'display-mode', mode, ...data })
  }

  sendBackground(backgroundType: 'none' | 'image' | 'video', backgroundUrl: string | null) {
    this.send({ type: 'song-background', backgroundType, backgroundUrl })
  }

  assignScreen(screenId: string, role: 'main' | 'stage') {
    this.send({ type: 'assign-screen', screenId, role })
  }

  closeScreen(screenId: string) {
    this.send({ type: 'close-screen', screenId })
  }

  sendStageTime(time: string) {
    this.send({ type: 'stage-time', time })
  }

  sendStageMessage(message: string) {
    this.send({ type: 'stage-message', message })
  }

  sendStageConfig(showTime: boolean, showMessage: boolean) {
    this.send({ type: 'stage-config', showTime, showMessage })
  }

  sendMedia(mediaType: 'image' | 'video', url: string) {
    this.send({ type: 'display-media', mediaType, url })
  }

  preloadMedia(mediaType: 'image' | 'video', url: string) {
    this.send({ type: 'preload-media', mediaType, url })
  }

  sendNdiConfig(outputs: NdiOutput[]) {
    this.send({ type: 'ndi-config', outputs })
  }

  requestScreens() {
    this.send({ type: 'get-screens' })
  }

  private send(data: object) {
    if (!this._isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return
    try {
      this.socket.send(JSON.stringify(data))
    } catch (err) {
      console.error('[Display-Nova] Failed to send:', err)
    }
  }

  disconnect() {
    this.destroyed = true

    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }
}
