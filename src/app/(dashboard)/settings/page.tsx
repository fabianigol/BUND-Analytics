'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'lucide-react'

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Configuración"
        subtitle="Gestiona las preferencias de tu cuenta"
      />

      <div className="flex-1 p-6">
        <Tabs defaultValue="profile" className="space-y-6">
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
                <div className="flex items-center gap-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                    JF
                  </div>
                  <div>
                    <Button variant="outline" size="sm">
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
                    <Input defaultValue="Juan Fabián" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input defaultValue="juan@bundcompany.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Input defaultValue="Administrador" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Select defaultValue="marketing">
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
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar cambios
                  </Button>
                </div>
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

