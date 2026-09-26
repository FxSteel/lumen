import { CSSProperties } from 'react'

export type SongTypography = {
  font_family?: string
  font_size?: number
  weight?: number
  font_weight?: number
  line_height?: number
  letter_spacing?: number
  color?: string
  shadow?: string
  text_transform?: 'none' | 'uppercase' | 'lowercase'
}

export type TypographyDefaults = {
  font_family?: string
  font_size: number
  font_weight: number
  line_height: number
  letter_spacing: number
  color: string
  shadow: string
  text_transform: 'none' | 'uppercase' | 'lowercase'
}

const SUPPORTED_FONT_VARIABLES: Record<string, string> = {
  Inter: 'var(--font-inter)',
  Poppins: 'var(--font-poppins)',
  Montserrat: 'var(--font-montserrat)',
  Roboto: 'var(--font-roboto)',
  'Open Sans': 'var(--font-open-sans)',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeFontFamily(fontFamily: string | undefined, fallbackToInter = false) {
  if (!fontFamily) return undefined
  const normalized = fontFamily.trim()
  if (!normalized) return undefined
  if (SUPPORTED_FONT_VARIABLES[normalized]) {
    return SUPPORTED_FONT_VARIABLES[normalized]
  }
  return fallbackToInter ? SUPPORTED_FONT_VARIABLES.Inter : undefined
}

export function sanitizeSongTypography(input: unknown): SongTypography | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const raw = input as Record<string, unknown>

  const fontSize = asNumber(raw.font_size)
  const lineHeight = asNumber(raw.line_height)
  const letterSpacing = asNumber(raw.letter_spacing)
  const fontWeight = asNumber(raw.font_weight)
  const weight = asNumber(raw.weight)
  const textTransform = asString(raw.text_transform)

  return {
    font_family: asString(raw.font_family),
    font_size: fontSize !== undefined ? clamp(fontSize, 12, 200) : undefined,
    font_weight:
      fontWeight !== undefined
        ? clamp(Math.round(fontWeight), 100, 900)
        : weight !== undefined
        ? clamp(Math.round(weight), 100, 900)
        : undefined,
    weight:
      weight !== undefined
        ? clamp(Math.round(weight), 100, 900)
        : fontWeight !== undefined
        ? clamp(Math.round(fontWeight), 100, 900)
        : undefined,
    line_height: lineHeight !== undefined ? clamp(lineHeight, 0.8, 2) : undefined,
    letter_spacing: letterSpacing !== undefined ? clamp(letterSpacing, -10, 20) : undefined,
    color: asString(raw.color),
    shadow: asString(raw.shadow),
    text_transform:
      textTransform === 'uppercase' || textTransform === 'lowercase' || textTransform === 'none'
        ? textTransform
        : undefined,
  }
}

export function buildTypographyDefaults(fontSize: number): TypographyDefaults {
  return {
    font_size: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 64,
    font_weight: 400,
    line_height: 1.2,
    letter_spacing: 0,
    color: '#FFFFFF',
    shadow: 'none',
    text_transform: 'none',
  }
}

export function resolveTypography(
  songTypography: SongTypography | null | undefined,
  globalDefaults: TypographyDefaults
): CSSProperties {
  const safe = sanitizeSongTypography(songTypography)

  const fontSize = safe?.font_size ?? globalDefaults.font_size
  const fontWeight = safe?.font_weight ?? globalDefaults.font_weight
  const lineHeight = safe?.line_height ?? globalDefaults.line_height
  const letterSpacing = safe?.letter_spacing ?? globalDefaults.letter_spacing
  const color = safe?.color ?? globalDefaults.color
  const shadow = safe?.shadow ?? globalDefaults.shadow
  const textTransform = safe?.text_transform ?? globalDefaults.text_transform

  // Preserve current MVP look when no font is configured.
  const fontFamily =
    safe?.font_family !== undefined
      ? normalizeFontFamily(safe.font_family, true)
      : normalizeFontFamily(globalDefaults.font_family, false)

  return {
    fontFamily: fontFamily || 'inherit',
    fontSize: `${fontSize}pt`,
    fontWeight,
    lineHeight,
    letterSpacing: `${letterSpacing}px`,
    color,
    textShadow: shadow,
    textTransform,
  }
}
