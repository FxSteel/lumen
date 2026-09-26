import { create } from 'zustand'
import { SongTypography } from '@/lib/typography'

const SETLIST_IDS_KEY = 'nova:setlistSongIds'
const SETLIST_FILTER_KEY = 'nova:isSetlistFilterOn'

function readSessionSetlistSongIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SETLIST_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function readSessionSetlistFilter(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(SETLIST_FILTER_KEY) === 'true'
  } catch {
    return false
  }
}

function writeSessionSetlistSongIds(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SETLIST_IDS_KEY, JSON.stringify(ids))
  } catch {
    // Ignore sessionStorage failures.
  }
}

function writeSessionSetlistFilter(isOn: boolean) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SETLIST_FILTER_KEY, String(isOn))
  } catch {
    // Ignore sessionStorage failures.
  }
}

export interface User {
  id: string
  email: string
  full_name: string | null
  role: string | null
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: string
  created_at: string
}

export interface WorkspaceSettings {
  workspace_id: string
  theme?: string
  language?: string
  logo_url?: string
}

export interface Song {
  id: string
  workspace_id: string
  created_by: string | null
  title: string
  author: string | null
  tonality: string | null
  is_archived: boolean
  typography?: SongTypography | null
  created_at: string
  updated_at: string
}

export interface SongSlide {
  id: string
  song_id: string
  position: number
  type: 'verse' | 'chorus' | 'bridge' | 'prechorus' | 'tag' | 'intro' | 'outro' | 'ending' | 'other' | 'bible_verse'
  label: string | null
  content: string
  font_size?: number
  line_height?: number
  letter_spacing?: number
  created_at: string
  updated_at: string
}

// Helper interface for bible verse slide content
export interface BibleVerseSlideContent {
  bibleId: string
  bookId: string
  bookName: string
  chapter: number
  verses: string // e.g., "1" or "1-3"
  reference: string // e.g., "JHN.3.16"
  displayReference: string // e.g., "Juan 3:16"
  bibleVersionName: string
}

interface AppState {
  user: User | null
  setUser: (user: User | null) => void
  activeWorkspace: Workspace | null
  setActiveWorkspace: (workspace: Workspace | null) => void
  selectedSong: Song | null
  setSelectedSong: (song: Song | null) => void
  currentSlideId: string | null
  setCurrentSlideId: (id: string | null) => void
  logoMode: 'ON' | 'OFF'
  setLogoMode: (mode: 'ON' | 'OFF') => void
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  setlistSongIds: string[]
  isSetlistFilterOn: boolean
  toggleSongInSetlist: (songId: string) => void
  setSetlistFilterOn: (isOn: boolean) => void
  toggleSetlistFilter: () => void
  clearSetlist: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  activeWorkspace: null,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  selectedSong: null,
  setSelectedSong: (song) => set({ selectedSong: song, currentSlideId: null }),
  currentSlideId: null,
  setCurrentSlideId: (id) => set({ currentSlideId: id }),
  logoMode: 'OFF',
  setLogoMode: (mode) => set({ logoMode: mode }),
  theme: 'system',
  setTheme: (theme) => set({ theme }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  setlistSongIds: readSessionSetlistSongIds(),
  isSetlistFilterOn: readSessionSetlistFilter(),
  toggleSongInSetlist: (songId) =>
    set((state) => {
      const nextIds = state.setlistSongIds.includes(songId)
        ? state.setlistSongIds.filter((id) => id !== songId)
        : [...state.setlistSongIds, songId]
      writeSessionSetlistSongIds(nextIds)
      return { setlistSongIds: nextIds }
    }),
  setSetlistFilterOn: (isOn) =>
    set(() => {
      writeSessionSetlistFilter(isOn)
      return { isSetlistFilterOn: isOn }
    }),
  toggleSetlistFilter: () =>
    set((state) => {
      const nextIsOn = !state.isSetlistFilterOn
      writeSessionSetlistFilter(nextIsOn)
      return { isSetlistFilterOn: nextIsOn }
    }),
  clearSetlist: () =>
    set(() => {
      writeSessionSetlistSongIds([])
      writeSessionSetlistFilter(false)
      return { setlistSongIds: [], isSetlistFilterOn: false }
    }),
}))
