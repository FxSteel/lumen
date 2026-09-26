'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-provider'
import { useRouter, usePathname } from 'next/navigation'
import { CircleUser, ChevronDown, Home, Users, Zap, Lightbulb, LogOut, Building2, Settings, Plus } from 'lucide-react'
import Link from 'next/link'
import { useActiveWorkspace, useWorkspace } from '@/lib/workspace-provider'

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)
  
  const activeWorkspace = useActiveWorkspace()
  const { clearWorkspace } = useWorkspace()

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setShowUserMenu(false)
    clearWorkspace() // Limpiar workspace state y localStorage
    await signOut()
    router.replace('/auth/login')
  }

  const navItems = [
    { href: '/operator', label: 'Home', icon: Home, disabled: true },
    { href: '/operator', label: 'Operador', icon: Zap, disabled: false },
    { href: '#', label: 'Usuarios', icon: Users, disabled: true },
    { href: '#', label: 'Integraciones', icon: Lightbulb, disabled: true },
    { href: '#', label: 'AI builder', icon: Lightbulb, disabled: true },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <div className="w-64 bg-[#1a1a1a] border-r border-[#333] flex flex-col overflow-hidden">
      {/* Workspace Display */}
      <div className="p-3 border-b border-[#333]">
        <div className="relative" ref={workspaceMenuRef}>
          <button
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className="w-full flex items-center justify-between p-2 bg-[#2a2a2a] hover:bg-[#333] rounded-md transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-[#7C6FD8] rounded-md flex items-center justify-center flex-shrink-0">
                <Building2 size={16} className="text-white" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-gray-200 text-xs font-medium truncate">
                  {activeWorkspace?.name || 'Sin workspace'}
                </p>
              </div>
            </div>
            <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${
              showWorkspaceMenu ? 'rotate-180' : ''
            }`} />
          </button>

          {showWorkspaceMenu && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-[#333] rounded shadow-lg z-10 w-full">
              {/* Current workspace with edit button */}
              <div className="flex items-center justify-between p-3 border-b border-[#333]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 bg-[#7C6FD8] rounded flex items-center justify-center flex-shrink-0">
                    <Building2 size={12} className="text-white" />
                  </div>
                  <p className="text-sm text-gray-200 truncate">
                    {activeWorkspace?.name || 'Sin workspace'}
                  </p>
                </div>
                <Link href="/settings?tab=workspace">
                  <button
                    onClick={() => setShowWorkspaceMenu(false)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title="Configuración del workspace"
                  >
                    <Settings size={14} />
                  </button>
                </Link>
              </div>

              {/* Create workspace button (disabled) */}
              <button
                disabled
                className="w-full text-left px-3 py-2 text-sm text-gray-600 cursor-not-allowed opacity-50 flex items-center gap-2 hover:bg-[#2a2a2a]"
              >
                <Plus size={14} />
                Crear nuevo workspace
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navItems.map((item, index) => {
          const Icon = item.icon
          return (
            <Link key={`nav-item-${index}`} href={item.disabled ? '#' : item.href}>
              <button
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded transition-colors text-sm ${
                  item.disabled
                    ? 'text-gray-600 cursor-not-allowed opacity-50'
                    : isActive(item.href)
                      ? 'bg-[#7C6FD8] text-white'
                      : 'text-gray-300 hover:bg-[#2a2a2a]'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            </Link>
          )
        })}
      </nav>

      {/* User Profile Box */}
      <div className="p-4 border-t border-[#333]">
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 p-3 bg-[#2a2a2a] hover:bg-[#333] rounded transition-colors"
          >
            <CircleUser size={20} className="text-[#7C6FD8]" />
            <div className="flex-1 text-left min-w-0">
              <div className="font-medium text-white text-sm truncate">{user?.user_metadata?.full_name || user?.email}</div>
              <div className="text-xs text-gray-400 capitalize truncate">{activeWorkspace?.role || ''}</div>
            </div>
            <ChevronDown size={16} />
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#2a2a2a] border border-[#333] rounded shadow-lg z-10 w-full">
              <Link href="/settings?tab=profile" className="block">
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#333] transition-colors"
                >
                  Perfil
                </button>
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-2 border-t border-[#333]"
              >
                <LogOut size={16} />
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
