// YouVersion Bible API Integration
// Client-side functions that call our API routes (which use server-side env vars)

// Types - match what BibleBrowser.tsx expects
export interface BibleVersion {
  id: string
  name: string
  abbreviation: string
  language: {
    id: string
    name: string
  }
}

export interface Book {
  id: string
  name: string
  abbreviation: string
  chapters: number
}

export interface ChapterData {
  bookId: string
  chapter: number
  verses: Array<{
    number: number
    text: string
    passage_id: string
  }>
  reference: string
}

// VerseRange for creating slides - matches BibleVerseSlideContent + verseText
export interface VerseRange {
  bibleId: string
  bibleVersionName: string
  bookId: string
  bookName: string
  chapter: number
  verses: string
  reference: string
  displayReference: string
  verseText: string
}

export async function getBibleVersions(): Promise<BibleVersion[]> {
  const res = await fetch('/api/bible/versions')
  if (!res.ok) throw new Error('Failed to fetch versions')
  return res.json()
}

export async function getBibleBooks(bibleId: string): Promise<Book[]> {
  const res = await fetch(`/api/bible/books?bibleId=${bibleId}`)
  if (!res.ok) throw new Error('Failed to fetch books')
  return res.json()
}

export async function getChapter(
  bibleId: string,
  bookId: string,
  chapter: number
): Promise<ChapterData> {
  const res = await fetch(`/api/bible/chapter?bibleId=${bibleId}&bookId=${bookId}&chapter=${chapter}`)
  if (!res.ok) throw new Error('Failed to fetch chapter')
  return res.json()
}

export async function getVerseRange(
  bibleId: string,
  bookId: string,
  chapter: number,
  verses: string
): Promise<{ verseText: string; reference: string }> {
  const res = await fetch(`/api/bible/verses?bibleId=${bibleId}&bookId=${bookId}&chapter=${chapter}&verses=${verses}`)
  if (!res.ok) throw new Error('Failed to fetch verses')
  return res.json()
}
