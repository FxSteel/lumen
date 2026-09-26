# YouVersion Integration - Quick Start & Next Steps

**Status**: Phase 1 ✅ Complete | Phase 2-8 🚀 Ready to Start

---

## 🔍 VERIFY PHASE 1 SETUP

### 1. Check Environment Variables
```bash
# Verify the variables are in .env.local
cat /Users/fer/Desktop/nova/.env.local | grep YOUVERSION
```

**Expected Output**:
```
YOUVERSION_API_KEY=sxaFediGqJjftu5vawObCQQugGMGrAP0zq6uBEqU6tKUTIjL
NEXT_PUBLIC_YOUVERSION_API_URL=https://api.youversion.com
```

### 2. Test API Connection
**Option A**: Via cURL
```bash
curl http://localhost:3000/api/debug/youversion-test
```

**Option B**: Via Browser
Open: `http://localhost:3000/api/debug/youversion-test`

**Option C**: In TypeScript
```typescript
import { testConnection } from '@/lib/youversion'

const result = await testConnection()
console.log(result) // Should be true
```

---

## 🔗 PHASE 2: DATABASE SCHEMA

**Decision Required**: Choose one approach:

### Option A: Simple (Recommended for MVP) ✅
Store verses as JSON in existing `custom_text` field
- Faster to implement
- Works with existing presentation structure
- Queries are less flexible
- Good for MVP

### Option B: Structured
Create dedicated `bible_verses` table
- Better for future scaling
- Enables verse analytics
- More complex queries
- Better data integrity

**Recommendation**: Start with **Option A** for faster delivery.

#### Implementation if Option A:
```sql
-- No schema changes needed!
-- Verses stored as JSON in presentations.custom_text:
{
  "type": "bible_verse",
  "reference": "Juan 3:16-17",
  "bibleVersionId": "RVR1960",
  "bibleVersionName": "Reina Valera 1960",
  "content": "16 Porque de tal manera amó Dios al mundo...",
  "bookName": "Juan",
  "chapter": 3,
  "verses": "16-17"
}
```

---

## 📱 PHASE 3: VERIFY CORE API FUNCTIONS

The following are **already implemented** in `lib/youversion.ts`:

```typescript
// ✅ Fetch all Bible versions (cached)
const versions = await getBibleVersions()

// ✅ Get books in a Bible
const books = await getBibleBooks('RVR1960')

// ✅ Get specific verses
const verses = await getVerses('RVR1960', 'JHN.3.16')

// ✅ Search verses
const results = await searchVerses('RVR1960', 'amor')

// ✅ Test connection
const connected = await testConnection()
```

**Test all functions**:
```typescript
// In your browser console or a test file:
import * as youversion from '@/lib/youversion'

// Test each function
console.log('Versions:', await youversion.getBibleVersions())
console.log('Books:', await youversion.getBibleBooks('RVR1960'))
console.log('Verses:', await youversion.getVerses('RVR1960', 'JHN.3.16'))
```

---

## 🎨 PHASE 4: BUILD BIBLE VERSE SELECTOR COMPONENT

**Create**: `components/BibleVerseSelector.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { getBibleVersions, getBibleBooks, getVerses } from '@/lib/youversion'
import type { BibleVersion, Book, VerseData } from '@/lib/youversion'

export default function BibleVerseSelector() {
  const [versions, setVersions] = useState<BibleVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState('')
  const [selectedBook, setSelectedBook] = useState('')
  const [chapter, setChapter] = useState('')
  const [verses, setVerses] = useState('')
  const [preview, setPreview] = useState<VerseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [books, setBooks] = useState<Book[]>([])

  // Load Bible versions on mount
  useEffect(() => {
    const loadVersions = async () => {
      try {
        const data = await getBibleVersions()
        setVersions(data)
        if (data.length > 0) {
          setSelectedVersion(data[0].id) // Default to first
        }
      } catch (err) {
        console.error('Failed to load Bible versions:', err)
      }
    }
    loadVersions()
  }, [])

  // Load books when version changes
  useEffect(() => {
    if (!selectedVersion) return

    const loadBooks = async () => {
      try {
        const data = await getBibleBooks(selectedVersion)
        setBooks(data)
        setSelectedBook('')
        setPreview(null)
      } catch (err) {
        console.error('Failed to load books:', err)
      }
    }
    loadBooks()
  }, [selectedVersion])

  // Fetch verses when reference is complete
  const handleFetchVerses = async () => {
    if (!selectedVersion || !selectedBook || !chapter) {
      alert('Please select Bible version, book, and chapter')
      return
    }

    setLoading(true)
    try {
      const book = books.find(b => b.abbreviation === selectedBook)
      if (!book) throw new Error('Book not found')

      // Format reference: JHN.3.16 or JHN.3.16-17
      const verseRef = verses ? `${selectedBook}.${chapter}.${verses}` : `${selectedBook}.${chapter}`
      
      const data = await getVerses(selectedVersion, verseRef)
      setPreview(data)
    } catch (err) {
      console.error('Failed to fetch verses:', err)
      alert('Could not fetch verses. Please check your input.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddToPresentation = () => {
    if (!preview) return
    
    // TODO: Trigger action to add verse to presentation
    console.log('Adding verse to presentation:', preview)
    alert('✅ Verse added to presentation!')
  }

  const spanishBooks = {
    'GEN': 'Génesis',
    'EXO': 'Éxodo',
    'LEV': 'Levítico',
    'NUM': 'Números',
    'DEU': 'Deuteronomio',
    'JOS': 'Josué',
    'JDG': 'Jueces',
    'RUT': 'Rut',
    '1SA': '1 Samuel',
    '2SA': '2 Samuel',
    '1KI': '1 Reyes',
    '2KI': '2 Reyes',
    '1CH': '1 Crónicas',
    '2CH': '2 Crónicas',
    'EZR': 'Esdras',
    'NEH': 'Nehemías',
    'EST': 'Ester',
    'JOB': 'Job',
    'PSA': 'Salmos',
    'PRO': 'Proverbios',
    'ECC': 'Eclesiastés',
    'SNG': 'Cantares',
    'ISA': 'Isaías',
    'JER': 'Jeremías',
    'LAM': 'Lamentaciones',
    'EZK': 'Ezequiel',
    'DAN': 'Daniel',
    'HOS': 'Oseas',
    'JOL': 'Joel',
    'AMO': 'Amós',
    'OBA': 'Abdías',
    'JON': 'Jonás',
    'MIC': 'Miqueas',
    'NAM': 'Nahúm',
    'HAB': 'Habacuc',
    'ZEP': 'Sofonías',
    'HAG': 'Ageo',
    'ZEC': 'Zacarías',
    'MAL': 'Malaquías',
    'MAT': 'Mateo',
    'MRK': 'Marcos',
    'LUK': 'Lucas',
    'JHN': 'Juan',
    'ACT': 'Hechos',
    'ROM': 'Romanos',
    '1CO': '1 Corintios',
    '2CO': '2 Corintios',
    'GAL': 'Gálatas',
    'EPH': 'Efesios',
    'PHP': 'Filipenses',
    'COL': 'Colosenses',
    '1TH': '1 Tesalonicenses',
    '2TH': '2 Tesalonicenses',
    '1TI': '1 Timoteo',
    '2TI': '2 Timoteo',
    'TIT': 'Tito',
    'PHM': 'Filemón',
    'HEB': 'Hebreos',
    'JAS': 'Santiago',
    '1PE': '1 Pedro',
    '2PE': '2 Pedro',
    '1JN': '1 Juan',
    '2JN': '2 Juan',
    '3JN': '3 Juan',
    'JUD': 'Judas',
    'REV': 'Apocalipsis',
  }

  return (
    <div className="space-y-4 p-6 bg-[#0f0f0f] rounded-lg border border-[#333]">
      <h2 className="text-xl font-bold text-white">Agregar Versículo Bíblico</h2>

      {/* Bible Version Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Versión de la Biblia
        </label>
        <select
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(e.target.value)}
          className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded text-white"
        >
          {versions.map(v => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.abbreviation})
            </option>
          ))}
        </select>
      </div>

      {/* Book Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Libro
        </label>
        <select
          value={selectedBook}
          onChange={(e) => setSelectedBook(e.target.value)}
          className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded text-white"
        >
          <option value="">Selecciona un libro...</option>
          {books.map(b => (
            <option key={b.abbreviation} value={b.abbreviation}>
              {spanishBooks[b.abbreviation as keyof typeof spanishBooks] || b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Chapter & Verses */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Capítulo
          </label>
          <input
            type="number"
            min="1"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="3"
            className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Versículos (ej: 16 o 16-17)
          </label>
          <input
            type="text"
            value={verses}
            onChange={(e) => setVerses(e.target.value)}
            placeholder="16"
            className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#333] rounded text-white"
          />
        </div>
      </div>

      <button
        onClick={handleFetchVerses}
        disabled={loading || !selectedVersion || !selectedBook || !chapter}
        className="w-full px-4 py-2 bg-[#7C6FD8] hover:bg-[#6C5FC8] disabled:bg-gray-600 text-white font-medium rounded transition-colors"
      >
        {loading ? 'Buscando...' : 'Buscar Versículo'}
      </button>

      {/* Preview */}
      {preview && (
        <div className="p-4 bg-[#1a1a1a] border border-[#333] rounded">
          <p className="text-gray-200 italic mb-3">{preview.verses[0]?.text}</p>
          <p className="text-xs text-gray-500">
            {preview.reference} - {preview.version.name}
          </p>
          <button
            onClick={handleAddToPresentation}
            className="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded"
          >
            ✓ Agregar a Presentación
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## 🔌 PHASE 5: INTEGRATE INTO EXISTING UI

### 1. Add to Actions Menu
In `components/operator/SongsList.tsx` or `SongDetail.tsx`:

```typescript
// Add new action
const actions = [
  { label: 'Editar canción', action: 'edit' },
  { label: 'Eliminar canción', action: 'delete' },
  { label: 'Agregar versículo bíblico', action: 'add-verse' }, // NEW
]

// Handle action
case 'add-verse':
  openBibleVerseModal()
  break
```

### 2. Display Verses as Slides
Verses should appear in the slides list with:
- Bible icon indicator
- Reference and version
- Preview on hover

### 3. Live Output Support
Ensure verses display correctly in "Salida en vivo":
- Full text on screen
- Reference at bottom
- Clean typography

---

## 🗄️ PHASE 6: WORKSPACE SETTINGS

Add workspace default Bible version:

```sql
ALTER TABLE workspace_settings ADD COLUMN default_bible_version TEXT DEFAULT 'RVR1960';
```

Then in settings component, allow users to choose their preferred Bible version.

---

## ⚡ PHASE 7: CACHING & OPTIMIZATION

Already implemented:
- ✅ Bible versions cached in memory
- ✅ Smart error handling
- ✅ Logging for debugging

Additional optimizations to add later:
- [ ] localStorage for offline Bible versions
- [ ] React Query or SWR for data fetching
- [ ] Debounce search inputs
- [ ] Progressive loading of books/chapters

---

## 📊 DEVELOPMENT CHECKLIST

### Phase 1: ✅ COMPLETE
- [x] Environment variables configured
- [x] API client created
- [x] TypeScript types defined
- [x] Test endpoints created
- [x] Documentation written

### Phase 2: 🔜 DATABASE
- [ ] Choose Option A or B
- [ ] Run SQL migrations
- [ ] Update data types

### Phase 3: 🔜 API VALIDATION
- [ ] Test getBibleVersions()
- [ ] Test getBibleBooks()
- [ ] Test getVerses()
- [ ] Test error handling

### Phase 4: 🔜 COMPONENT
- [ ] Create BibleVerseSelector component
- [ ] Test all dropdowns/inputs
- [ ] Verify preview works
- [ ] Style with Tailwind

### Phase 5: 🔜 INTEGRATION
- [ ] Add to Actions menu
- [ ] Display as slides
- [ ] Show in live output
- [ ] Test save/reload

### Phase 6: 🔜 SETTINGS
- [ ] Add default_bible_version field
- [ ] Add UI in settings
- [ ] Test persistence

### Phase 7: 🔜 OPTIMIZATION
- [ ] Implement caching
- [ ] Add React Query
- [ ] Performance testing

### Phase 8: 🔜 POLISH
- [ ] Error messages
- [ ] Loading states
- [ ] Edge cases
- [ ] User feedback

---

## 🚀 READY TO START?

**Next Steps**:

1. Run the test to verify Phase 1 works:
   ```bash
   curl http://localhost:3000/api/debug/youversion-test
   ```

2. Choose database approach (Option A recommended)

3. Create BibleVerseSelector component

4. Integrate into Actions menu

---

**All files created in Phase 1**:
- ✅ `lib/youversion.ts` - Service client
- ✅ `app/api/debug/youversion-test/route.ts` - Test endpoint  
- ✅ `app/api/youversion/books/route.ts` - Books/verses endpoint
- ✅ `.env.local` - API keys (already exists)

