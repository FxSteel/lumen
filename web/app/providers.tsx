'use client'

import React, { ReactNode, useEffect } from 'react'
import { AuthProvider } from '@/lib/auth-provider'
import { WorkspaceProvider } from '@/lib/workspace-provider'
import { ThemeProvider } from '@/lib/theme-provider'
import { ensureFontSizeColumn, setDefaultFontSizes, ensureBibleVerseSlideType } from '@/lib/migrations'

export { AuthProvider, useAuth } from '@/lib/auth-provider'
export { useWorkspace, useActiveWorkspace } from '@/lib/workspace-provider'
export { useTheme } from '@/lib/theme-provider'

/**
 * Root provider component that wraps the entire app.
 * Includes AuthProvider, WorkspaceProvider, and ThemeProvider.
 */
interface RootProvidersProps {
  children: ReactNode
}

function MigrationInitializer() {
  useEffect(() => {
    const initializeMigrations = async () => {
      try {
        // Skip migrations if we're not authenticated to avoid interference with login
        console.log('[MIGRATIONS] Skipping migrations on initial load')
        // Migrations will run after successful login instead
      } catch (error) {
        console.error('[MIGRATIONS] Failed to run migrations:', error)
      }
    }
    // Don't run migrations immediately
    // initializeMigrations()
  }, [])

  return null
}

export function RootProviders({ children }: RootProvidersProps) {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ThemeProvider>
          <MigrationInitializer />
          {children}
        </ThemeProvider>
      </WorkspaceProvider>
    </AuthProvider>
  )
}
