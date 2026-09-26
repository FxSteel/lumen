import { NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/api-utils'

const BASE_URL = process.env.NEXT_PUBLIC_YOUVERSION_API_URL || 'https://api.youversion.com'
const API_KEY = process.env.YOUVERSION_API_TOKEN

export async function GET() {
  if (!API_KEY) {
    return createErrorResponse('YOUVERSION_CONFIG_MISSING', 'La API key de YouVersion no está configurada.', undefined, 500)
  }

  try {
    // Fetch Spanish and English versions separately and combine
    const [esResponse, enResponse] = await Promise.all([
      fetch(`${BASE_URL}/v1/bibles?language_ranges[]=es`, {
        headers: {
          'X-YVP-App-Key': API_KEY,
          'Accept': 'application/json',
        }
      }),
      fetch(`${BASE_URL}/v1/bibles?language_ranges[]=en`, {
        headers: {
          'X-YVP-App-Key': API_KEY,
          'Accept': 'application/json',
        }
      })
    ])

    if (!esResponse.ok || !enResponse.ok) {
      console.error('[YouVersion] versions error')
      return createErrorResponse('YOUVERSION_VERSIONS_ERROR', 'No se pudieron obtener las versiones de la Biblia.', undefined, 500)
    }

    const [esData, enData] = await Promise.all([
      esResponse.json(),
      enResponse.json()
    ])
    
    // Combine and deduplicate by id
    const allBibles = [...(esData.data || []), ...(enData.data || [])]
    const uniqueBibles = Array.from(
      new Map(allBibles.map((b: any) => [b.id, b])).values()
    )
    
    const versions = uniqueBibles.map((bible: any) => ({
      id: String(bible.id),
      name: bible.localized_title || bible.title,
      abbreviation: bible.localized_abbreviation || bible.abbreviation,
      language: {
        id: bible.language_tag,
        name: bible.language_tag
      }
    }))

    // Sort: Spanish first, then English, alphabetically within each
    versions.sort((a: any, b: any) => {
      const aIsSpanish = a.language.id?.startsWith('es')
      const bIsSpanish = b.language.id?.startsWith('es')
      if (aIsSpanish && !bIsSpanish) return -1
      if (!aIsSpanish && bIsSpanish) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json(versions)
  } catch (err) {
    console.error('[YouVersion] versions error:', err)
    const details = err instanceof Error ? err.message : String(err)
    return createErrorResponse('SERVER_ERROR', 'Error interno del servidor al obtener versiones.', details, 500)
  }
}
