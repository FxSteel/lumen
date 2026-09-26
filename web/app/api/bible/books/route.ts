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

  if (!bibleId) {
    return createErrorResponse('BIBLE_ID_REQUIRED', 'El parámetro bibleId es obligatorio.', undefined, 400)
  }

  try {
    const response = await fetch(`${BASE_URL}/v1/bibles/${bibleId}/books`, {
      headers: {
        'X-YVP-App-Key': API_KEY,
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[YouVersion] books error:', error)
      return createErrorResponse('YOUVERSION_BOOKS_ERROR', 'No se pudieron obtener los libros de la Biblia.', error, response.status)
    }

    const data = await response.json()
    
    const books = (data.data || []).map((book: any) => ({
      id: book.id,
      name: book.name || book.title,
      abbreviation: book.abbreviation,
      chapters: book.chapters?.length || book.chapter_count || 0
    }))

    return NextResponse.json(books)
  } catch (err) {
    console.error('[YouVersion] books error:', err)
    const details = err instanceof Error ? err.message : String(err)
    return createErrorResponse('SERVER_ERROR', 'Error interno del servidor al obtener libros.', details, 500)
  }
}
