import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/api-utils'

const BASE_URL = process.env.NEXT_PUBLIC_YOUVERSION_API_URL || 'https://api.youversion.com'
const API_KEY = process.env.YOUVERSION_API_TOKEN

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return createErrorResponse('YOUVERSION_CONFIG_MISSING', 'La API key de YouVersion no está configurada.', undefined, 500)
  }

  const { searchParams } = new URL(request.url)
  const bibleId = searchParams.get('bibleId')
  const bookId = searchParams.get('bookId')
  const chapter = searchParams.get('chapter')
  const verses = searchParams.get('verses')

  if (!bibleId || !bookId || !chapter || !verses) {
    return createErrorResponse(
      'VERSE_PARAMS_REQUIRED',
      'Los parámetros bibleId, bookId, chapter y verses son obligatorios.',
      undefined,
      400
    )
  }

  try {
    const passageId = `${bookId}.${chapter}.${verses}`
    const response = await fetch(
      `${BASE_URL}/v1/bibles/${bibleId}/passages/${passageId}`,
      {
        headers: {
          'X-YVP-App-Key': API_KEY,
          'Accept': 'application/json',
        }
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('[YouVersion] verses error:', error)
      return createErrorResponse(
        'YOUVERSION_VERSES_ERROR',
        'No se pudieron obtener los versículos solicitados.',
        error,
        response.status
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      verseText: data.content || '',
      reference: data.reference || `${bookId} ${chapter}:${verses}`
    })
  } catch (err) {
    console.error('[YouVersion] verses error:', err)
    const details = err instanceof Error ? err.message : String(err)
    return createErrorResponse('SERVER_ERROR', 'Error interno del servidor al obtener versículos.', details, 500)
  }
}
