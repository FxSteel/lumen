export class LiveOutputBroadcaster {
  private channel: BroadcastChannel | null

  constructor() {
    this.channel = null
    try {
      this.channel = new BroadcastChannel('live-output-sync')
      console.log('[BROADCASTER] Channel created')
    } catch (err) {
      console.error('[BROADCASTER] BroadcastChannel not available:', err)
    }
  }

  sendSlideChange(slide: any) {
    try {
      if (!this.channel) {
        console.error('[BROADCASTER] No channel available')
        return
      }
      // Extract per-slide typography fields with legacy fallbacks.
      const fontSize = slide.fontSize || slide.font_size || 100
      const lineHeight = slide.lineHeight || slide.line_height || 1.2
      const letterSpacing = slide.letterSpacing || slide.letter_spacing || 0
      const fontWeight =
        slide.fontWeight ||
        slide.font_weight ||
        slide.songTypography?.weight ||
        slide.songTypography?.font_weight ||
        500
      console.log('[BROADCASTER] sendSlideChange - slide:', {
        id: slide.id,
        type: slide.type,
        content: slide.content,
        fontSize: fontSize
      })
      
      const payload = {
        slideId: slide.id,
        songId: slide.songId || slide.song_id || null,
        content: slide.content,
        fontSize: fontSize,
        lineHeight: lineHeight,
        letterSpacing: letterSpacing,
        fontWeight: fontWeight,
        slideType: slide.type, // This is what the receivers expect
        label: slide.label,
        songTypography: slide.songTypography || slide.song_typography || null,
        // Pass through all additional fields for bible verses
        displayReference: slide.displayReference,
        verseText: slide.verseText,
        bibleVersionName: slide.bibleVersionName,
        bibleVersionAbbreviation: slide.bibleVersionAbbreviation,
        projectedReferenceLabel: slide.projectedReferenceLabel,
        reference: slide.reference,
        transitionType: slide.transitionType || 'none',
      }
      
      this.channel.postMessage({
        type: 'slide-change',
        timestamp: Date.now(),
        payload,
      })
      console.log('[BROADCASTER] Sent slide-change payload:', payload)
    } catch (err) {
      console.error('[BROADCASTER] Failed to send slide-change:', err)
    }
  }

  sendDisplayMode(mode: 'slide' | 'logo' | 'announcement' | 'clear', data?: any) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'display-mode',
        timestamp: Date.now(),
        payload: { mode, ...data },
      })
      console.log('[BROADCASTER] Sent display-mode:', mode)
    } catch (err) {
      console.error('[BROADCASTER] Failed to send display-mode:', err)
    }
  }

  sendMessage(message: string) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'stage-message',
        timestamp: Date.now(),
        payload: { message },
      })
      console.log('[BROADCASTER] Sent stage-message')
    } catch (err) {
      console.error('[BROADCASTER] Failed to send stage-message:', err)
    }
  }

  sendStageMessage(message: string) {
    this.sendMessage(message)
  }

  sendStageTime(time: string) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'stage-time',
        timestamp: Date.now(),
        payload: { time },
      })
      console.log('[BROADCASTER] Sent stage-time:', time)
    } catch (err) {
      console.error('[BROADCASTER] Failed to send stage-time:', err)
    }
  }

  sendStageConfig(showTime: boolean, showMessage: boolean) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'stage-config',
        timestamp: Date.now(),
        payload: { show_time: showTime, show_message: showMessage },
      })
      console.log('[BROADCASTER] Sent stage-config:', { showTime, showMessage })
    } catch (err) {
      console.error('[BROADCASTER] Failed to send stage-config:', err)
    }
  }

  sendSongBackground(backgroundType: 'none' | 'image' | 'video', backgroundUrl: string | null) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'song-background',
        timestamp: Date.now(),
        payload: {
          backgroundType,
          backgroundUrl,
        },
      })
      console.log('[BROADCASTER] Sent song-background:', { backgroundType, backgroundUrl })
    } catch (err) {
      console.error('[BROADCASTER] Failed to send song-background:', err)
    }
  }

  sendMediaProjection(mediaType: 'image' | 'video', url: string) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'display-media',
        timestamp: Date.now(),
        payload: { mediaType, url },
      })
    } catch (err) {
      console.error('[BROADCASTER] Failed to send display-media:', err)
    }
  }

  sendMediaPreload(mediaType: 'image' | 'video', url: string) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'preload-media',
        timestamp: Date.now(),
        payload: { mediaType, url },
      })
    } catch (err) {
      console.error('[BROADCASTER] Failed to send preload-media:', err)
    }
  }

  sendBibleFontSize(fontSize: number) {
    try {
      if (!this.channel) return
      this.channel.postMessage({
        type: 'bible-font-size',
        timestamp: Date.now(),
        payload: { fontSize },
      })
      console.log('[BROADCASTER] Sent bible-font-size:', fontSize)
    } catch (err) {
      console.error('[BROADCASTER] Failed to send bible-font-size:', err)
    }
  }

  onMessage(callback: (data: any) => void) {
    if (!this.channel) return
    this.channel.onmessage = (event) => {
      console.log('[BROADCASTER] Received message:', event.data.type)
      callback(event.data)
    }
  }

  close() {
    if (!this.channel) return
    this.channel.close()
    console.log('[BROADCASTER] Channel closed')
  }
}
