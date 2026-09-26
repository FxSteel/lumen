import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Use anon key for auth verification, service key for admin operations
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
})

export async function GET(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      console.log('[API/WORKSPACES/ACTIVE] No auth header')
      return createErrorResponse('UNAUTHORIZED', 'Falta el encabezado de autorización.', undefined, 401)
    }

    // Extract and verify token using anon client
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token)

    if (userError || !user) {
      console.log('[API/WORKSPACES/ACTIVE] Invalid token:', userError?.message || 'No user found')
      const details = userError?.message || 'No user found'
      return createErrorResponse('INVALID_TOKEN', 'Token inválido.', details, 401)
    }

    console.log('[AUTH] session ok - user:', user.id)
    console.log('[WS] fetching active workspace')

    const startTime = Date.now()

    // Step 1: Get workspace memberships for this user (use admin client for database queries)
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .limit(1)

    if (membershipError) {
      console.error('[WS] error', { code: 'QUERY_ERROR', message: membershipError.message })
      return createErrorResponse('QUERY_ERROR', 'No se pudo obtener la membresía de workspace.', membershipError.message, 500)
    }

    // Check if user has any workspaces
    if (!memberships || memberships.length === 0) {
      console.log('[WS] error', { code: 'NO_WORKSPACE', message: 'User has no workspaces' })
      return createErrorResponse('NO_WORKSPACE', 'El usuario no tiene workspaces asociados.', undefined, 404)
    }

    const membership = memberships[0]
    
    // Step 2: Get workspace details separately (use admin client)
    const { data: workspaceData, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, slug, owner_id')
      .eq('id', membership.workspace_id)
      .single()

    if (workspaceError || !workspaceData) {
      console.error('[WS] error', { code: 'WORKSPACE_NOT_FOUND', message: workspaceError?.message })
      return createErrorResponse('WORKSPACE_NOT_FOUND', 'Workspace no encontrado.', workspaceError?.message, 404)
    }

    const workspace = {
      id: workspaceData.id,
      name: workspaceData.name,
      slug: workspaceData.slug,
      role: membership.role,
      owner_id: workspaceData.owner_id,
    }

    const elapsed = Date.now() - startTime
    console.log('[WS] active workspace loaded', { id: workspace.id, elapsedMs: elapsed })

    return NextResponse.json(
      { workspace },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API/WORKSPACES/ACTIVE] Error:', errorMessage)
    return createErrorResponse('SERVER_ERROR', 'Error interno del servidor.', errorMessage, 500)
  }
}
