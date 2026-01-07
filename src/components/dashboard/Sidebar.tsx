'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
import { checkIsAdmin } from '@/lib/utils/user'
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'

interface NavItem {
  title: string
  href: string
  icon?: React.ElementType
  iconImage?: string
  emoji?: string
  badge?: number
  sectionName?: string // Nombre de la sección para verificar permisos
}

const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    emoji: '📊',
    sectionName: 'dashboard',
  },
  {
    title: 'Calendario',
    href: '/calendario',
    emoji: '📅',
    sectionName: 'calendario',
  },
  {
    title: 'Citas',
    href: '/citas',
    iconImage: '/Logo Acuity Scheduling.png',
    sectionName: 'citas',
  },
  {
    title: 'Ventas',
    href: '/ventas',
    iconImage: '/Logo Shopify.svg',
    sectionName: 'ventas',
  },
  {
    title: 'Paid Media',
    href: '/ads',
    iconImage: '/Logo Meta.png',
    sectionName: 'paid-media',
  },
  {
    title: 'Analytics',
    href: '/analytics',
    iconImage: '/Logo Google Analytics 4.png',
    sectionName: 'analytics',
  },
  {
    title: 'Reportes',
    href: '/reportes',
    emoji: '📄',
    sectionName: 'reportes',
  },
  {
    title: 'Recursos',
    href: '/recursos',
    emoji: '📚',
    sectionName: 'recursos',
  },
]

const adminNavItems: NavItem[] = [
  {
    title: 'Usuarios',
    href: '/usuarios',
    emoji: '👥',
    sectionName: 'usuarios',
  },
  {
    title: 'Integraciones',
    href: '/integraciones',
    emoji: '🔌',
    sectionName: 'integraciones',
  },
  {
    title: 'Configuración',
    href: '/settings',
    emoji: '⚙️',
    sectionName: 'configuracion',
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const adminCheck = await checkIsAdmin()
        setIsAdmin(adminCheck)

        if (!adminCheck) {
          // Cargar permisos del usuario
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: permissions } = await (supabase as any)
              .from('user_sidebar_permissions')
              .select('section_name')
              .eq('user_id', user.id)

            if (permissions) {
              setUserPermissions((permissions as any[]).map((p: any) => p.section_name))
            }
          }
        }
      } catch (error) {
        console.error('Error loading permissions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPermissions()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Función para verificar si el usuario tiene acceso a una sección
  const hasAccess = (item: NavItem): boolean => {
    // Los administradores tienen acceso a todo
    if (isAdmin) return true
    
    // Si no tiene sectionName, siempre permitir (casos especiales)
    if (!item.sectionName) return true
    
    // Verificar si tiene permiso para esta sección
    return userPermissions.includes(item.sectionName)
  }

  // Filtrar items según permisos
  const filteredMainItems = mainNavItems.filter(hasAccess)
  const filteredAdminItems = isAdmin ? adminNavItems : adminNavItems.filter(hasAccess)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[260px]'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            {collapsed ? (
              <div className="relative h-9 w-9">
                <Image
                  src="/BURDEOS.png"
                  alt="BUND Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="relative h-8 w-auto max-w-[120px]">
                <Image
                  src="/BURDEOS.png"
                  alt="BUND"
                  width={120}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <nav className="flex flex-col gap-1">
              {filteredMainItems.length > 0 && (
                <>
                  {!collapsed && (
                    <span className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Principal
                    </span>
                  )}
                  {filteredMainItems.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={pathname === item.href}
                      collapsed={collapsed}
                    />
                  ))}
                </>
              )}

              {filteredAdminItems.length > 0 && (
                <>
                  <Separator className="my-4 bg-sidebar-border" />
                  {!collapsed && (
                    <span className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Administración
                    </span>
                  )}
                  {filteredAdminItems.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={pathname === item.href}
                      collapsed={collapsed}
                    />
                  ))}
                </>
              )}
            </nav>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className={cn(
                  'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent',
                  collapsed && 'justify-center px-0'
                )}
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>Cerrar sesión</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Cerrar sesión</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const content = (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          collapsed && 'justify-center px-0'
        )}
      >
        {item.iconImage ? (
          <div className="relative h-4 w-4 flex-shrink-0">
            <Image
              src={item.iconImage}
              alt={item.title}
              fill
              className="object-contain"
            />
          </div>
        ) : item.emoji ? (
          <span className="text-base flex-shrink-0">{item.emoji}</span>
        ) : item.icon ? (
          <item.icon className="h-4 w-4 flex-shrink-0" />
        ) : null}
        {!collapsed && (
          <>
            <span className="flex-1">{item.title}</span>
            {item.badge !== undefined && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.title}
          {item.badge !== undefined && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
              {item.badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

