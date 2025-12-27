'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  Search,
  Sun,
  Moon,
  RefreshCw,
  User,
  Settings,
  LogOut,
} from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
}

interface UserProfile {
  full_name: string | null
  email: string
  avatar_url: string | null
}

export function Header({ title, subtitle }: HeaderProps) {
  const [isDark, setIsDark] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Obtener el perfil del usuario desde la tabla users
          const { data: profile, error } = await supabase
            .from('users')
            .select('full_name, email, avatar_url')
            .eq('id', user.id)
            .maybeSingle<{
              full_name: string | null
              email: string | null
              avatar_url: string | null
            }>()

          // Ignorar errores vacíos {} completamente
          // Solo loguear si hay un mensaje real de error
          const shouldLog = error && 
                           typeof error === 'object' && 
                           Object.keys(error).length > 0 &&
                           (error.message?.trim() || 
                            (error.code?.trim() && error.code !== 'PGRST116') ||
                            error.details?.trim() ||
                            error.hint?.trim())
          
          // Solo loguear si hay un mensaje real
          if (shouldLog && error.message?.trim()) {
            console.error('Error fetching user profile:', error.message)
          }
          // Si no cumple las condiciones, ignorar completamente (objeto vacío o sin información útil)
          
          if (profile) {
            setUserProfile({
              full_name: profile.full_name,
              email: profile.email || user.email || '',
              avatar_url: profile.avatar_url,
            })
          } else {
            // Fallback a datos del auth
            setUserProfile({
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
              email: user.email || '',
              avatar_url: user.user_metadata?.avatar_url || null,
            })
          }
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setIsLoadingUser(false)
      }
    }

    fetchUserProfile()
  }, [supabase])

  // Función para obtener las iniciales del nombre
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    // Si no hay nombre, usar las primeras dos letras del email
    return email.substring(0, 2).toUpperCase()
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  const handleSync = () => {
    setIsSyncing(true)
    // Simulate sync
    setTimeout(() => setIsSyncing(false), 2000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar..."
            className="w-64 bg-muted/50 pl-9"
          />
        </div>

        {/* Sync Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="hidden sm:flex"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px]">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Nueva venta registrada</span>
              <span className="text-xs text-muted-foreground">
                Pedido #1234 por €299.99
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Cita completada</span>
              <span className="text-xs text-muted-foreground">
                Consulta con María García
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Campaña Meta actualizada</span>
              <span className="text-xs text-muted-foreground">
                ROAS aumentó a 3.45
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary">
              Ver todas las notificaciones
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full" disabled={isLoadingUser}>
              <Avatar className="h-9 w-9">
                <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.full_name || 'Usuario'} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {isLoadingUser ? '...' : userProfile ? getInitials(userProfile.full_name, userProfile.email) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {isLoadingUser ? 'Cargando...' : userProfile?.full_name || 'Usuario'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isLoadingUser ? '...' : userProfile?.email || ''}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings?tab=profile')}>
              <User className="mr-2 h-4 w-4" />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

