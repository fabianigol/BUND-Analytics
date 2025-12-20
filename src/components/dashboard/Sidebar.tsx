'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/lib/supabase/client'
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
}

const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    emoji: '📊',
  },
  {
    title: 'Citas',
    href: '/citas',
    iconImage: '/Logo Acuity Scheduling.png',
  },
  {
    title: 'Ventas',
    href: '/ventas',
    iconImage: '/Logo Shopify.svg',
  },
  {
    title: 'Paid Media',
    href: '/ads',
    iconImage: '/Logo Meta.png',
  },
  {
    title: 'Analytics',
    href: '/analytics',
    iconImage: '/Logo Google Analytics 4.png',
  },
  {
    title: 'Reportes',
    href: '/reportes',
    emoji: '📄',
  },
  {
    title: 'Recursos',
    href: '/recursos',
    emoji: '📚',
  },
]

const adminNavItems: NavItem[] = [
  {
    title: 'Usuarios',
    href: '/usuarios',
    emoji: '👥',
  },
  {
    title: 'Integraciones',
    href: '/integraciones',
    emoji: '🔌',
  },
  {
    title: 'Configuración',
    href: '/settings',
    emoji: '⚙️',
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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
          <nav className="flex flex-col gap-1">
            {!collapsed && (
              <span className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Principal
              </span>
            )}
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href}
                collapsed={collapsed}
              />
            ))}

            <Separator className="my-4 bg-sidebar-border" />

            {!collapsed && (
              <span className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Administración
              </span>
            )}
            {adminNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={pathname === item.href}
                collapsed={collapsed}
              />
            ))}
          </nav>
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

