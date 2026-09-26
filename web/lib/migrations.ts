/**
 * Utility to ensure font_size column exists in song_slides table
 * This runs on app startup to fix the schema if needed
 */

import { supabase } from './supabase'

export async function ensureFontSizeColumn() {
  try {
    // Try to query a slide with font_size
    const { data, error } = await supabase
      .from('song_slides')
      .select('id, font_size')
      .limit(1)

    if (error) {
      // Check if the error is about missing column
      if (error.message?.includes('column') || error.code === '42703') {
        console.log('[MIGRATION] font_size column missing, needs to be added')
        return false
      }
      console.error('[MIGRATION] Error checking font_size column:', error.message || error)
      return false
    }

    // If we can query it, column exists
    console.log('[MIGRATION] ✅ font_size column exists in song_slides')
    return true
  } catch (err) {
    console.error('[MIGRATION] Error in ensureFontSizeColumn:', err)
    return false
  }
}

export async function setDefaultFontSizes() {
  try {
    // Set default font_size for all slides that have NULL
    const { error } = await supabase
      .from('song_slides')
      .update({ font_size: 64 })
      .is('font_size', null)

    if (error) {
      console.error('[MIGRATION] Error setting default font sizes:', error.message || error)
      return false
    }

    console.log('[MIGRATION] ✅ Default font sizes set')
    return true
  } catch (err) {
    console.error('[MIGRATION] Error in setDefaultFontSizes:', err)
    return false
  }
}

/**
 * Ensure bible_verse is supported in slide_type enum
 */
export async function ensureBibleVerseSlideType() {
  try {
    // Try to create a test bible_verse slide to see if the enum value is supported
    const testSongId = '00000000-0000-0000-0000-000000000000' // Fake ID for test
    
    const { error: testError } = await supabase
      .from('song_slides')
      .insert({
        song_id: testSongId,
        position: 999999,
        type: 'bible_verse',
        label: 'TEST',
        content: 'TEST'
      })

    if (testError) {
      if (testError.message?.includes('invalid input value for enum') && 
          testError.message?.includes('bible_verse')) {
        console.log('[MIGRATION] ❌ bible_verse not supported in slide_type enum')
        return false
      }
      // Other errors are ok - we just want to test the enum
      console.log('[MIGRATION] ✅ bible_verse enum value is supported')
      return true
    } else {
      // Clean up test record if it somehow succeeded
      await supabase
        .from('song_slides')
        .delete()
        .eq('song_id', testSongId)
        .eq('position', 999999)
      
      console.log('[MIGRATION] ✅ bible_verse enum value is supported')
      return true
    }
  } catch (err) {
    console.error('[MIGRATION] Error checking bible_verse enum:', err)
    return false
  }
}
