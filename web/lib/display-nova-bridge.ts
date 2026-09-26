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
  private _isConnected = false
  private destroyed = false

  onConnectionChange?: (connected: boolean) => void
  onScreensDetected?: (screens: DisplayNovaScreen[]) => void

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
        this.requestScreens()
      }

      this.socket.onclose = () => {
        console.log('[Display-Nova] Disconnected')
        this._isConnected = false
        this.onConnectionChange?.(false)
        this.scheduleReconnect()
      }

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
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

  private handleMessage(message: any) {
    switch (message.type) {
      case 'screens-detected':
        this.onScreensDetected?.(message.payload?.screens ?? [])
        break
      case 'screen-assignment-confirmed':
        console.log('[Display-Nova] Screen assignment confirmed')
        break
      case 'pong':
        break
      default:
        console.log('[Display-Nova] Unknown message type:', message.type)
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
