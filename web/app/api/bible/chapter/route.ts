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

  if (!bibleId || !bookId || !chapter) {
    return createErrorResponse(
      'CHAPTER_PARAMS_REQUIRED',
      'Los parámetros bibleId, bookId y chapter son obligatorios.',
      undefined,
      400
    )
  }

  try {
    // First get the list of verses in this chapter
    const versesResponse = await fetch(
      `${BASE_URL}/v1/bibles/${bibleId}/books/${bookId}/chapters/${chapter}/verses`,
      {
        headers: {
          'X-YVP-App-Key': API_KEY,
          'Accept': 'application/json',
        }
      }
    )

    if (!versesResponse.ok) {
      const error = await versesResponse.text()
      console.error('[YouVersion] chapter verses error:', error)
      return createErrorResponse(
        'YOUVERSION_CHAPTER_ERROR',
        'No se pudo obtener el capítulo solicitado.',
        error,
        versesResponse.status
      )
    }

    const versesData = await versesResponse.json()
    const versesList = versesData.data || []

    // Fetch text for each verse in parallel
    const verseTexts = await Promise.all(
      versesList.map(async (v: any) => {
        try {
          const passageRes = await fetch(
            `${BASE_URL}/v1/bibles/${bibleId}/passages/${v.passage_id}`,
            {
              headers: {
                'X-YVP-App-Key': API_KEY,
                'Accept': 'application/json',
              }
            }
          )
          if (passageRes.ok) {
            const passageData = await passageRes.json()
            return {
              number: parseInt(v.id),
              text: passageData.content || '',
              passage_id: v.passage_id
            }
          }
        } catch (err) {
          console.error(`[YouVersion] Failed to fetch verse ${v.passage_id}:`, err)
        }
        return {
          number: parseInt(v.id),
          text: '',
          passage_id: v.passage_id
        }
      })
    )

    return NextResponse.json({
      bookId,
      chapter: parseInt(chapter),
      verses: verseTexts,
      reference: `${bookId} ${chapter}`
    })
  } catch (err) {
    console.error('[YouVersion] chapter error:', err)
    const details = err instanceof Error ? err.message : String(err)
    return createErrorResponse('SERVER_ERROR', 'Error interno del servidor al obtener el capítulo.', details, 500)
  }
}
