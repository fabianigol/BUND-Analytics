'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Save,
  Moon,
  Sun,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { checkIsAdmin, uploadAvatar, getUserRole } from '@/lib/utils/user'

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [userData, setUserData] = useState({
    full_name: '',
    email: '',
    department: '',
    avatar_url: null as string | null,
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const searchParams = useSearchParams()

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  // Cargar datos del usuario
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          showMessage('error', 'No se pudo cargar la información del usuario')
          return
        }

        // Verificar si es admin
        const adminCheck = await checkIsAdmin()
        setIsAdmin(adminCheck)

        // Obtener rol
        const role = await getUserRole()
        setUserRole(role)

        // Cargar perfil del usuario
        const { data: profile, error } = await supabase
          .from('users')
          .select('full_name, email, department, avatar_url')
          .eq('id', user.id)
          .maybeSingle()

        // Ignorar errores vacíos {} completamente
        // Solo loguear si hay un mensaje real de error
        const shouldLog = error && 
                         typeof error === 'object' && 
                         Object.keys(error).length > 0 &&
                         (error.message?.trim() || 
                          (error.code?.trim() && error.code !== 'PGRST116') ||
                          error.details?.trim() ||
                          error.hint?.trim())
        
        if (shouldLog) {
          console.error('Error fetching user profile:', error)
        }
        // Si no cumple las condiciones, ignorar completamente (objeto vacío o sin información útil)

        if (profile) {
          const profileData = profile as { full_name: string | null; email: string | null; department: string | null; avatar_url: string | null }
          setUserData({
            full_name: profileData.full_name || '',
            email: profileData.email || user.email || '',
            department: profileData.department || '',
            avatar_url: profileData.avatar_url,
          })
          setAvatarPreview(profileData.avatar_url)
        } else {
          // Fallback a datos del auth - esto es normal si el usuario acaba de registrarse
          setUserData({
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
            email: user.email || '',
            department: '',
            avatar_url: null,
          })
          // Crear el perfil en la tabla users si no existe
          try {
            await supabase
              .from('users')
              .upsert({
                id: user.id,
                email: user.email || '',
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
                department: null,
                avatar_url: null,
              } as any)
          } catch (upsertError) {
            // Si falla el upsert, no es crítico - el usuario puede seguir usando la app
            console.warn('Could not create user profile:', upsertError)
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
        showMessage('error', 'Error al cargar los datos del usuario')
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [supabase])

  // Obtener iniciales para el avatar
  const getInitials = (name: string, email: string) => {
    if (name) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    return email.substring(0, 2).toUpperCase()
  }

  // Manejar selección de archivo
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      showMessage('error', 'Tipo de archivo no válido. Solo se permiten JPG, PNG o GIF.')
      return
    }

    // Validar tamaño (2MB)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      showMessage('error', 'El archivo es demasiado grande. El tamaño máximo es 2MB.')
      return
    }

    setAvatarFile(file)

    // Crear preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Guardar cambios
  const handleSave = async () => {
    try {
      setIsSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        showMessage('error', 'No se pudo obtener el usuario actual')
        return
      }

      let newAvatarUrl = userData.avatar_url

      // Subir avatar si hay uno nuevo
      if (avatarFile) {
        try {
          newAvatarUrl = await uploadAvatar(avatarFile, user.id)
          if (!newAvatarUrl) {
            throw new Error('No se pudo subir el avatar')
          }
        } catch (error: any) {
          showMessage('error', error.message || 'Error al subir el avatar')
          return
        }
      }

      // Actualizar perfil en la base de datos
      const updatePayload = {
        full_name: userData.full_name,
        email: userData.email,
        department: userData.department || null,
        avatar_url: newAvatarUrl,
        updated_at: new Date().toISOString(),
      }
      const { data: updateData, error: updateError } = await (supabase as any)
        .from('users')
        .update(updatePayload)
        .eq('id', user.id)
        .select()

      // Verificar si realmente hubo un error
      if (updateError) {
        const hasMessage = updateError.message && updateError.message.length > 0
        const hasCode = updateError.code && updateError.code.length > 0
        const hasDetails = updateError.details && updateError.details.length > 0
        const hasRealError = hasMessage || hasCode || hasDetails
        
        if (hasRealError) {
          // Hay un error real con información útil, lanzarlo
          throw updateError
        }
        // Si no hay información útil pero tampoco hay data, puede ser un problema de permisos
        if (!updateData || updateData.length === 0) {
          throw new Error('No se pudo actualizar el perfil. Verifica que tengas permisos.')
        }
        // Si hay data, la actualización fue exitosa a pesar del error vacío
      }

      // Si no hay data y tampoco hay error, algo salió mal
      if (!updateData || updateData.length === 0) {
        throw new Error('No se pudo actualizar el perfil. Intenta de nuevo.')
      }

      // Actualizar estado local
      setUserData(prev => ({ ...prev, avatar_url: newAvatarUrl }))
      setAvatarFile(null)

      showMessage('success', 'Perfil actualizado correctamente')
    } catch (error: any) {
      // Ignorar errores vacíos {} completamente
      // Solo mostrar error si hay un mensaje real
      const shouldShowError = error && 
                             typeof error === 'object' && 
                             Object.keys(error).length > 0 &&
                             (error.message?.trim() || 
                              error.code?.trim() ||
                              error.details?.trim() ||
                              error.hint?.trim())
      
      if (shouldShowError) {
        console.error('Error saving profile:', error)
        const errorMessage = error.message || error.code || error.details || 'Error al guardar los cambios'
        showMessage('error', errorMessage)
      }
      // Si no cumple las condiciones, ignorar completamente (objeto vacío o sin información útil)
    } finally {
      setIsSaving(false)
    }
  }

  // Obtener el tab activo desde la URL
  const activeTab = searchParams.get('tab') || 'profile'

  return (
    <div className="flex flex-col">
      <Header
        title="Configuración"
        subtitle="Gestiona las preferencias de tu cuenta"
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue={activeTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              Apariencia
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Seguridad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Información del Perfil</CardTitle>
                <CardDescription>
                  Actualiza tu información personal y de contacto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {message && (
                  <div className={`rounded-lg border p-4 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {message.text}
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-6">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={avatarPreview || undefined} alt={userData.full_name} />
                        <AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">
                          {getInitials(userData.full_name, userData.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif"
                          onChange={handleAvatarSelect}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Cambiar foto
                        </Button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          JPG, PNG o GIF. Máximo 2MB.
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nombre completo</Label>
                        <Input
                          value={userData.full_name}
                          onChange={(e) => setUserData(prev => ({ ...prev, full_name: e.target.value }))}
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={userData.email}
                          onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                          type="email"
                          placeholder="email@ejemplo.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rol</Label>
                        <Input
                          value={
                            userRole === 'admin' ? 'Administrador' :
                            userRole === 'marketing_manager' ? 'Marketing Manager' :
                            userRole === 'CEO' ? 'CEO' :
                            userRole === 'CBDO' ? 'CBDO' :
                            userRole === 'CFO' ? 'CFO' :
                            userRole === 'art_director' ? 'Art Director' :
                            userRole === 'content' ? 'Content' :
                            userRole === 'support' ? 'Support' :
                            userRole === 'agency' ? 'Agency' :
                            'Viewer'
                          }
                          disabled
                          className="bg-muted"
                        />
                        {!isAdmin && (
                          <p className="text-xs text-muted-foreground">
                            Solo los administradores pueden cambiar roles
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Departamento</Label>
                        <Select
                          value={userData.department || 'marketing'}
                          onValueChange={(value) => setUserData(prev => ({ ...prev, department: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="sales">Ventas</SelectItem>
                            <SelectItem value="operations">Operaciones</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Guardar cambios
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Preferencias de Notificaciones</CardTitle>
                <CardDescription>
                  Configura cómo y cuándo recibir notificaciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <NotificationOption
                    title="Nuevas ventas"
                    description="Recibe notificaciones cuando se registre una nueva venta"
                    defaultChecked
                  />
                  <NotificationOption
                    title="Citas programadas"
                    description="Alertas sobre nuevas citas y cancelaciones"
                    defaultChecked
                  />
                  <NotificationOption
                    title="Alertas de rendimiento"
                    description="Notificaciones cuando las métricas cambien significativamente"
                    defaultChecked
                  />
                  <NotificationOption
                    title="Informes programados"
                    description="Recibe los informes automáticos por email"
                    defaultChecked
                  />
                  <NotificationOption
                    title="Sincronización fallida"
                    description="Alertas cuando una integración falle"
                    defaultChecked
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Canal de notificaciones</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="cursor-pointer border-2 border-primary p-4">
                      <div className="text-center">
                        <Bell className="mx-auto h-6 w-6 text-primary" />
                        <p className="mt-2 text-sm font-medium">In-App</p>
                      </div>
                    </Card>
                    <Card className="cursor-pointer p-4 hover:border-primary/50">
                      <div className="text-center">
                        <Globe className="mx-auto h-6 w-6 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium">Email</p>
                      </div>
                    </Card>
                    <Card className="cursor-pointer p-4 hover:border-primary/50">
                      <div className="text-center">
                        <Bell className="mx-auto h-6 w-6 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium">Push</p>
                      </div>
                    </Card>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar preferencias
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Apariencia</CardTitle>
                <CardDescription>
                  Personaliza el aspecto visual del dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Tema</h4>
                  <div className="flex gap-4">
                    <Button
                      variant={!isDark ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => {
                        if (isDark) toggleTheme()
                      }}
                    >
                      <Sun className="mr-2 h-4 w-4" />
                      Claro
                    </Button>
                    <Button
                      variant={isDark ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => {
                        if (!isDark) toggleTheme()
                      }}
                    >
                      <Moon className="mr-2 h-4 w-4" />
                      Oscuro
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Idioma</h4>
                  <Select defaultValue="es">
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Zona horaria</h4>
                  <Select defaultValue="europe-madrid">
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="europe-madrid">Europa/Madrid (GMT+1)</SelectItem>
                      <SelectItem value="america-mexico">América/México (GMT-6)</SelectItem>
                      <SelectItem value="america-bogota">América/Bogotá (GMT-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Seguridad</CardTitle>
                <CardDescription>
                  Gestiona la seguridad de tu cuenta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Cambiar contraseña</h4>
                  <div className="grid gap-4 max-w-md">
                    <div className="space-y-2">
                      <Label>Contraseña actual</Label>
                      <Input type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nueva contraseña</Label>
                      <Input type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar nueva contraseña</Label>
                      <Input type="password" />
                    </div>
                    <Button className="w-fit">Actualizar contraseña</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Autenticación de dos factores</h4>
                      <p className="text-sm text-muted-foreground">
                        Añade una capa extra de seguridad a tu cuenta
                      </p>
                    </div>
                    <Badge variant="outline">Desactivado</Badge>
                  </div>
                  <Button variant="outline">Activar 2FA</Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Sesiones activas</h4>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">MacBook Pro - Chrome</p>
                        <p className="text-sm text-muted-foreground">
                          Madrid, España • Activa ahora
                        </p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700">Actual</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function NotificationOption({
  title,
  description,
  defaultChecked = false,
}: {
  title: string
  description: string
  defaultChecked?: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        variant={checked ? 'default' : 'outline'}
        size="sm"
        onClick={() => setChecked(!checked)}
      >
        {checked ? 'Activado' : 'Desactivado'}
      </Button>
    </div>
  )
}

