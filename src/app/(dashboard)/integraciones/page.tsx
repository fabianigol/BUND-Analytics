'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Calendar,
  ShoppingBag,
  BarChart3,
  Database,
  Megaphone,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  ExternalLink,
  Key,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/format'

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ElementType
  iconColor: string
  connected: boolean
  lastSync?: string
  status: 'connected' | 'disconnected' | 'error'
  docsUrl: string
}

const integrations: Integration[] = [
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Sincroniza citas y eventos del calendario',
    icon: Calendar,
    iconColor: 'bg-blue-100 text-blue-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://developer.calendly.com/',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Importa ventas, pedidos y datos de productos',
    icon: ShoppingBag,
    iconColor: 'bg-green-100 text-green-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://shopify.dev/docs/api',
  },
  {
    id: 'meta',
    name: 'Meta Marketing',
    description: 'Conecta campañas de Facebook e Instagram Ads',
    icon: Megaphone,
    iconColor: 'bg-indigo-100 text-indigo-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
  },
  {
    id: 'analytics',
    name: 'Google Analytics 4',
    description: 'Importa datos de tráfico y comportamiento web',
    icon: BarChart3,
    iconColor: 'bg-amber-100 text-amber-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://developers.google.com/analytics',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Sincroniza bases de datos y registros',
    icon: Database,
    iconColor: 'bg-rose-100 text-rose-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://airtable.com/developers/web/api',
  },
]

export default function IntegracionesPage() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)

  return (
    <div className="flex flex-col">
      <Header
        title="Integraciones"
        subtitle="Conecta tus herramientas de marketing"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Status Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-emerald-100 p-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {integrations.filter((i) => i.connected).length}
                </p>
                <p className="text-sm text-muted-foreground">Conectadas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-gray-100 p-2">
                <XCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {integrations.filter((i) => !i.connected).length}
                </p>
                <p className="text-sm text-muted-foreground">Pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-blue-100 p-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{integrations.length}</p>
                <p className="text-sm text-muted-foreground">Disponibles</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integrations Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <Card key={integration.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${integration.iconColor}`}>
                      <integration.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {integration.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={integration.connected ? 'default' : 'outline'}
                    className={
                      integration.connected
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                        : ''
                    }
                  >
                    {integration.connected ? 'Conectada' : 'No conectada'}
                  </Badge>
                  {integration.lastSync && (
                    <span className="text-xs text-muted-foreground">
                      Última sync: {formatRelativeTime(integration.lastSync)}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        className="flex-1"
                        variant={integration.connected ? 'outline' : 'default'}
                        onClick={() => setSelectedIntegration(integration)}
                      >
                        {integration.connected ? (
                          <>
                            <Settings className="mr-2 h-4 w-4" />
                            Configurar
                          </>
                        ) : (
                          <>
                            <Key className="mr-2 h-4 w-4" />
                            Conectar
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Conectar {integration.name}</DialogTitle>
                        <DialogDescription>
                          Introduce las credenciales de API para conectar {integration.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {integration.id === 'calendly' && (
                          <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input type="password" placeholder="Tu API Key de Calendly" />
                            <p className="text-xs text-muted-foreground">
                              Encuentra tu API key en Calendly → Integrations → API & Webhooks
                            </p>
                          </div>
                        )}
                        {integration.id === 'shopify' && (
                          <>
                            <div className="space-y-2">
                              <Label>Shop Domain</Label>
                              <Input placeholder="tu-tienda.myshopify.com" />
                            </div>
                            <div className="space-y-2">
                              <Label>Access Token</Label>
                              <Input type="password" placeholder="shpat_..." />
                              <p className="text-xs text-muted-foreground">
                                Crea una app privada en Shopify Admin → Apps → Develop apps
                              </p>
                            </div>
                          </>
                        )}
                        {integration.id === 'meta' && (
                          <>
                            <div className="space-y-2">
                              <Label>Access Token</Label>
                              <Input type="password" placeholder="Tu access token de Meta" />
                            </div>
                            <div className="space-y-2">
                              <Label>Ad Account ID</Label>
                              <Input placeholder="act_123456789" />
                              <p className="text-xs text-muted-foreground">
                                Obtén las credenciales desde Meta Business Suite → Settings
                              </p>
                            </div>
                          </>
                        )}
                        {integration.id === 'analytics' && (
                          <>
                            <div className="space-y-2">
                              <Label>Property ID</Label>
                              <Input placeholder="123456789" />
                            </div>
                            <div className="space-y-2">
                              <Label>Service Account JSON</Label>
                              <Input type="file" accept=".json" />
                              <p className="text-xs text-muted-foreground">
                                Sube el archivo JSON de la cuenta de servicio de Google Cloud
                              </p>
                            </div>
                          </>
                        )}
                        {integration.id === 'airtable' && (
                          <>
                            <div className="space-y-2">
                              <Label>API Key</Label>
                              <Input type="password" placeholder="Tu API key de Airtable" />
                            </div>
                            <div className="space-y-2">
                              <Label>Base ID</Label>
                              <Input placeholder="appXXXXXXXXXXXXXX" />
                              <p className="text-xs text-muted-foreground">
                                Encuentra estos datos en Airtable → Help → API documentation
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" asChild>
                          <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Documentación
                          </a>
                        </Button>
                        <Button>Conectar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {integration.connected && (
                    <Button variant="outline" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿Necesitas ayuda?</CardTitle>
            <CardDescription>
              Recursos para configurar tus integraciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium">Guía de inicio</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aprende a conectar tus primeras integraciones paso a paso.
                </p>
                <Button variant="link" className="mt-2 h-auto p-0">
                  Ver guía →
                </Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium">Preguntas frecuentes</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Respuestas a las dudas más comunes sobre las APIs.
                </p>
                <Button variant="link" className="mt-2 h-auto p-0">
                  Ver FAQ →
                </Button>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="font-medium">Soporte técnico</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contacta con nuestro equipo para ayuda personalizada.
                </p>
                <Button variant="link" className="mt-2 h-auto p-0">
                  Contactar →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

