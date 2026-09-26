/**
 * Helper functions for Bible verse slides
 */

import { getVerseRange, type VerseRange } from './youversion'
import type { SongSlide, BibleVerseSlideContent } from './store'
import { supabase } from './supabase'

/**
 * Create a bible verse slide from YouVersion verse data
 */
export function createBibleVerseSlideContent(verse: VerseRange): BibleVerseSlideContent {
  return {
    bibleId: verse.bibleId,
    bookId: verse.bookId,
    bookName: verse.bookName,
    chapter: verse.chapter,
    verses: verse.verses,
    reference: verse.reference,
    displayReference: verse.displayReference,
    bibleVersionName: verse.bibleVersionName
  }
}

/**
 * Parse bible verse content from slide JSON
 */
export function parseBibleVerseSlideContent(slide: SongSlide): BibleVerseSlideContent | null {
  if (slide.type !== 'bible_verse') {
    return null
  }

  try {
    const parsed = JSON.parse(slide.content) as BibleVerseSlideContent
    // Validate it has required bible verse properties
    if (parsed.bibleId && parsed.bookId && parsed.chapter) {
      return parsed
    }
    return null
  } catch (err) {
    console.error('[BibleSlide] Failed to parse bible verse content:', err)
    return null
  }
}

/**
 * Get the actual verse text for a bible verse slide
 * This fetches from YouVersion API and caches the result
 */
export async function getBibleVerseSlideText(slide: SongSlide): Promise<string> {
  const verseContent = parseBibleVerseSlideContent(slide)
  if (!verseContent) {
    throw new Error('Not a bible verse slide')
  }

  try {
    const verse = await getVerseRange(
      verseContent.bibleId,
      verseContent.bookId,
      verseContent.chapter,
      verseContent.verses
    )
    
    return verse.verseText
  } catch (err) {
    console.error('[BibleSlide] Failed to fetch verse text:', err)
    return `[Error loading ${verseContent.displayReference}]`
  }
}

/**
 * Create a new bible verse slide in the database
 */
export async function createBibleVerseSlide(
  songId: string,
  verse: VerseRange,
  position?: number
): Promise<SongSlide> {
  const slideContent = createBibleVerseSlideContent(verse)
  
  // Get the next position if not specified
  if (position === undefined) {
    const { data: maxSlide, error } = await supabase
      .from('song_slides')
      .select('position')
      .eq('song_id', songId)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    position = maxSlide ? maxSlide.position + 1 : 1
  }

  const { data: slide, error } = await supabase
    .from('song_slides')
    .insert({
      song_id: songId,
      position,
      type: 'bible_verse',
      label: verse.displayReference,
      content: JSON.stringify(slideContent)
    })
    .select()
    .single()

  if (error) {
    console.error('[BibleSlide] Failed to create bible verse slide:', error)
    throw new Error(`Failed to create bible verse slide: ${error.message}`)
  }

  console.log(`[BibleSlide] ✅ Created slide: ${verse.displayReference}`)
  return slide
}

/**
 * Check if a slide is a bible verse slide
 */
export function isBibleVerseSlide(slide: SongSlide): boolean {
  return slide.type === 'bible_verse'
}

/**
 * Get a formatted label for any slide type
 */
export function getSlideLabel(slide: SongSlide): string {
  if (slide.label) {
    return slide.label
  }

  switch (slide.type) {
    case 'bible_verse':
      const verseContent = parseBibleVerseSlideContent(slide)
      return verseContent?.displayReference || 'Versículo bíblico'
      
    case 'verse':
    case 'chorus':
    case 'bridge':
    case 'prechorus':
    case 'tag':
    case 'intro':
    case 'outro':
    case 'ending':
    case 'other':
      // Extract first line of content as fallback
      const firstLine = slide.content.split('\n')[0]
      return firstLine.length > 30 ? `${firstLine.substring(0, 30)}...` : firstLine
      
    default:
      return `Slide ${slide.position}`
  }
}

/**
 * Get slide type display name
 */
export function getSlideTypeDisplayName(type: string): string {
  switch (type) {
    case 'bible_verse':
      return 'Versículo bíblico'
    case 'verse':
      return 'Verso'
    case 'chorus':
      return 'Coro'
    case 'bridge':
      return 'Puente'
    case 'prechorus':
      return 'Pre-coro'
    case 'tag':
      return 'Tag'
    case 'intro':
      return 'Intro'
    case 'outro':
      return 'Outro'
    case 'ending':
      return 'Final'
    case 'other':
      return 'Otro'
    default:
      return 'Desconocido'
  }
}

/**
 * Get slide type pill color
 */
export function getSlideTypeColor(type: string): string {
  switch (type) {
    case 'verse': return '#4A9AE5'
    case 'chorus': return '#36B389'
    case 'bridge': return '#8B82E0'
    case 'prechorus': return '#E5A830'
    case 'tag': return '#E06060'
    case 'intro': return '#6FAE2E'
    case 'outro': return '#E08540'
    case 'ending': return '#D9618A'
    case 'bible_verse': return '#4A9AE5'
    case 'other':
    default: return '#918F85'
  }
}

/**
 * Get slide icon name (for Lucide icons)
 */
export function getSlideIconName(type: string): string {
  switch (type) {
    case 'bible_verse':
      return 'Book'
    case 'verse':
    case 'chorus':
    case 'bridge':
    case 'prechorus':
    case 'tag':
    case 'intro':
    case 'outro':
    case 'ending':
    case 'other':
      return 'Music'
    default:
      return 'FileText'
  }
}

/**
 * Batch create bible verse slides for multiple verses
 */
export async function createMultipleBibleVerseSlides(
  songId: string,
  verses: VerseRange[]
): Promise<SongSlide[]> {
  console.log(`[BibleSlide] Creating ${verses.length} bible verse slides...`)
  
  const slides: SongSlide[] = []
  
  // Get starting position
  const { data: maxSlide } = await supabase
    .from('song_slides')
    .select('position')
    .eq('song_id', songId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  let position = maxSlide ? maxSlide.position + 1 : 1

  // Create slides one by one to maintain order
  for (const verse of verses) {
    try {
      const slide = await createBibleVerseSlide(songId, verse, position)
      slides.push(slide)
      position++
    } catch (err) {
      console.error(`[BibleSlide] Failed to create slide for ${verse.displayReference}:`, err)
      // Continue with other slides
    }
  }

  console.log(`[BibleSlide] ✅ Created ${slides.length}/${verses.length} bible verse slides`)
  return slides
}