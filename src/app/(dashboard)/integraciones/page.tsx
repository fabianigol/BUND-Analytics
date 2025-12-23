'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
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
  Loader2,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/format'

interface Integration {
  id: string
  name: string
  description: string
  icon?: React.ElementType
  iconImage?: string
  iconColor: string
  connected: boolean
  lastSync?: string
  status: 'connected' | 'disconnected' | 'error'
  docsUrl: string
}

interface MetaCredentials {
  accessToken: string
  adAccountId: string
}

const integrations: Integration[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Importa ventas, pedidos y datos de productos',
    iconImage: '/Logo Shopify.svg',
    iconColor: 'bg-green-100 text-green-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://shopify.dev/docs/api',
  },
  {
    id: 'meta',
    name: 'Meta Marketing',
    description: 'Conecta campañas de Facebook e Instagram Ads',
    iconImage: '/Logo Meta.png',
    iconColor: 'bg-indigo-100 text-indigo-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
  },
  {
    id: 'analytics',
    name: 'Google Analytics 4',
    description: 'Importa datos de tráfico y comportamiento web',
    iconImage: '/Logo Google Analytics 4.png',
    iconColor: 'bg-amber-100 text-amber-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://developers.google.com/analytics',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Sincroniza bases de datos y registros',
    iconImage: '/Logo Airtable.webp',
    iconColor: 'bg-rose-100 text-rose-600',
    connected: false,
    status: 'disconnected',
    docsUrl: 'https://airtable.com/developers/web/api',
  },
]

export default function IntegracionesPage() {
  const searchParams = useSearchParams()
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  // Estado inicial: todas las integraciones desconectadas
  // Esto asegura que el estado inicial sea siempre desconectado hasta que loadIntegrations() actualice
  const [integrations, setIntegrations] = useState<Integration[]>(() => {
    const initialIntegrations: Integration[] = [
      {
        id: 'shopify',
        name: 'Shopify',
        description: 'Importa ventas, pedidos y datos de productos',
        iconImage: '/Logo Shopify.svg',
        iconColor: 'bg-green-100 text-green-600',
        connected: false,
        status: 'disconnected',
        docsUrl: 'https://shopify.dev/docs/api',
      },
      {
        id: 'meta',
        name: 'Meta Marketing',
        description: 'Conecta campañas de Facebook e Instagram Ads',
        iconImage: '/Logo Meta.png',
        iconColor: 'bg-indigo-100 text-indigo-600',
        connected: false,
        status: 'disconnected',
        docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
      },
      {
        id: 'analytics',
        name: 'Google Analytics 4',
        description: 'Importa datos de tráfico y comportamiento web',
        iconImage: '/Logo Google Analytics 4.png',
        iconColor: 'bg-amber-100 text-amber-600',
        connected: false,
        status: 'disconnected',
        docsUrl: 'https://developers.google.com/analytics',
      },
      {
        id: 'airtable',
        name: 'Airtable',
        description: 'Sincroniza bases de datos y registros',
        iconImage: '/Logo Airtable.webp',
        iconColor: 'bg-rose-100 text-rose-600',
        connected: false,
        status: 'disconnected',
        docsUrl: 'https://airtable.com/developers/web/api',
      },
    ]
    return initialIntegrations
  })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [metaCredentials, setMetaCredentials] = useState<MetaCredentials>({
    accessToken: '',
    adAccountId: '',
  })
  const [analyticsPropertyId, setAnalyticsPropertyId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [openDialog, setOpenDialog] = useState<string | null>(null)

  // Cargar estado de integraciones
  useEffect(() => {
    loadIntegrations()
    
    // Manejar parámetros de URL para mostrar mensajes
    const connected = searchParams?.get('connected')
    const error = searchParams?.get('error')
    
    if (connected === 'analytics') {
      alert('Google Analytics conectado correctamente')
      // Limpiar URL
      window.history.replaceState({}, '', '/integraciones')
      loadIntegrations()
    } else if (error === 'oauth_cancelled') {
      alert('Autorización cancelada. Por favor, intenta de nuevo.')
      window.history.replaceState({}, '', '/integraciones')
    } else if (error === 'oauth_failed') {
      // Puede ser para Analytics
      alert('Error al conectar. Por favor, intenta de nuevo.')
      window.history.replaceState({}, '', '/integraciones')
    }
  }, [searchParams])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      
      // Cargar estado de Meta y Analytics
      // Agregar timestamp único y cache: 'no-store' para evitar caché del navegador
      const timestamp = Date.now()
      const fetchOptions = { cache: 'no-store' as RequestCache }
      
      const fetchWithErrorHandling = async (url: string) => {
        try {
          const response = await fetch(url, fetchOptions)
          if (!response.ok) {
            console.error(`Error fetching ${url}:`, response.status, response.statusText)
            return { connected: false }
          }
          const contentType = response.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            console.error(`Response from ${url} is not JSON:`, contentType)
            return { connected: false }
          }
          return await response.json()
        } catch (error) {
          console.error(`Error fetching ${url}:`, error)
          return { connected: false }
        }
      }
      
      const [metaData, analyticsData] = await Promise.all([
        fetchWithErrorHandling(`/api/integrations/meta?t=${timestamp}&_=${Math.random()}`),
        fetchWithErrorHandling(`/api/integrations/analytics?t=${timestamp}&_=${Math.random()}`),
      ])

      const baseIntegrations: Integration[] = [
        {
          id: 'shopify',
          name: 'Shopify',
          description: 'Importa ventas, pedidos y datos de productos',
          iconImage: '/Logo Shopify.svg',
          iconColor: 'bg-green-100 text-green-600',
          connected: false,
          status: 'disconnected',
          docsUrl: 'https://shopify.dev/docs/api',
        },
        {
          id: 'meta',
          name: 'Meta Marketing',
          description: 'Conecta campañas de Facebook e Instagram Ads',
          iconImage: '/Logo Meta.png',
          iconColor: 'bg-indigo-100 text-indigo-600',
          connected: metaData.connected || false,
          lastSync: metaData.lastSync || undefined,
          status: metaData.connected ? 'connected' : 'disconnected',
          docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
        },
        {
          id: 'analytics',
          name: 'Google Analytics 4',
          description: 'Importa datos de tráfico y comportamiento web',
          iconImage: '/Logo Google Analytics 4.png',
          iconColor: 'bg-amber-100 text-amber-600',
          connected: analyticsData.connected || false,
          lastSync: analyticsData.lastSync || undefined,
          status: analyticsData.connected ? 'connected' : 'disconnected',
          docsUrl: 'https://developers.google.com/analytics',
        },
        {
          id: 'airtable',
          name: 'Airtable',
          description: 'Sincroniza bases de datos y registros',
          iconImage: '/Logo Airtable.webp',
          iconColor: 'bg-rose-100 text-rose-600',
          connected: false,
          status: 'disconnected',
          docsUrl: 'https://airtable.com/developers/web/api',
        },
      ]
      
      setIntegrations(baseIntegrations)
      
      // Si Analytics está conectado, cargar Property ID si existe
      if (analyticsData.connected && analyticsData.property_id) {
        setAnalyticsPropertyId(analyticsData.property_id)
      }
    } catch (error) {
      console.error('Error loading integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectMeta = async () => {
    if (!metaCredentials.accessToken || !metaCredentials.adAccountId) {
      alert('Por favor, completa todos los campos')
      return
    }

    try {
      setConnecting(true)
      const response = await fetch('/api/integrations/meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaCredentials),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error ${response.status}: ${errorText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('La respuesta no es JSON válido')
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar Meta')
      }

      // Recargar integraciones
      await loadIntegrations()
      setOpenDialog(null)
      setMetaCredentials({ accessToken: '', adAccountId: '' })
      alert('Meta conectado correctamente')
    } catch (error) {
      console.error('Error connecting Meta:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setConnecting(false)
    }
  }

  const handleConnectAnalytics = async () => {
    try {
      // Si hay Property ID, guardarlo primero
      if (analyticsPropertyId) {
        const response = await fetch('/api/integrations/analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ propertyId: analyticsPropertyId }),
        })
        
        if (!response.ok) {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json()
            throw new Error(data.error || 'Error al guardar Property ID')
          } else {
            const errorText = await response.text()
            throw new Error(`Error ${response.status}: ${errorText}`)
          }
        }
      }
      
      // Redirigir a OAuth
      window.location.href = '/api/integrations/analytics/auth'
    } catch (error) {
      console.error('Error connecting Analytics:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  const handleSyncMeta = async () => {
    try {
      setSyncing('meta')
      const response = await fetch('/api/sync/meta', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error ${response.status}: ${errorText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('La respuesta no es JSON válido')
      }

      const data = await response.json()

      if (!response.ok) {
        // Mostrar error más detallado
        const errorMsg = data.details 
          ? `${data.error}\n\nDetalles: ${data.details}` 
          : data.error || 'Error al sincronizar'
        throw new Error(errorMsg)
      }

      // Recargar integraciones para actualizar lastSync
      await loadIntegrations()
      
      // Mostrar mensaje detallado
      let message = `Sincronización completada:\n\n`
      message += `✅ ${data.records_synced} campañas sincronizadas`
      if (data.total_campaigns) {
        message += ` de ${data.total_campaigns} totales`
        if (data.pages_processed) {
          message += ` (${data.pages_processed} páginas procesadas)`
        }
      }
      if (data.failed_count > 0) {
        message += `\n⚠️ ${data.failed_count} campañas fallaron`
      }
      if (data.skipped_count > 0) {
        message += `\n⏭️ ${data.skipped_count} campañas sin datos`
      }
      
      alert(message)
    } catch (error) {
      console.error('Error syncing Meta:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al sincronizar:\n\n${errorMessage}`)
    } finally {
      setSyncing(null)
    }
  }

  const handleSyncAnalytics = async () => {
    try {
      setSyncing('analytics')
      console.log('[UI] Starting Analytics sync...')
      
      const response = await fetch('/api/sync/analytics', {
        method: 'POST',
      })

      console.log('[UI] Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[UI] Error response:', errorText)
        throw new Error(`Error ${response.status}: ${errorText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text()
        console.error('[UI] Response is not JSON:', contentType, errorText)
        throw new Error('La respuesta no es JSON válido')
      }

      const data = await response.json()
      console.log('[UI] Response data:', data)

      if (!response.ok) {
        let errorMsg = data.error || 'Error al sincronizar'
        
        if (data.details) {
          // Handle different types of details
          if (typeof data.details === 'string') {
            errorMsg = `${errorMsg}\n\nDetalles: ${data.details}`
          } else if (typeof data.details === 'object') {
            // Try to extract meaningful error message from object
            const detailsStr = data.details.message || JSON.stringify(data.details)
            errorMsg = `${errorMsg}\n\nDetalles: ${detailsStr}`
          } else {
            errorMsg = `${errorMsg}\n\nDetalles: ${String(data.details)}`
          }
        }
        
        console.error('[UI] Sync error:', errorMsg)
        throw new Error(errorMsg)
      }

      // Recargar integraciones para actualizar lastSync
      await loadIntegrations()
      
      alert(`Sincronización completada:\n\n✅ ${data.records_synced} registro(s) sincronizado(s)`)
    } catch (error) {
      console.error('Error syncing Analytics:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al sincronizar:\n\n${errorMessage}`)
    } finally {
      setSyncing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header
          title="Integraciones"
          subtitle="Conecta tus herramientas de marketing"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

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
                    <div className={`rounded-lg p-2 ${integration.iconColor} flex items-center justify-center`}>
                      {integration.iconImage ? (
                        <div className="relative h-5 w-5">
                          <Image
                            src={integration.iconImage}
                            alt={integration.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                      ) : integration.icon ? (
                        <integration.icon className="h-5 w-5" />
                      ) : null}
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
                  <Dialog open={openDialog === integration.id} onOpenChange={(open) => setOpenDialog(open ? integration.id : null)}>
                    <DialogTrigger asChild>
                      <Button
                        className="flex-1"
                        variant={integration.connected ? 'outline' : 'default'}
                        onClick={() => {
                          setSelectedIntegration(integration)
                          if (integration.id === 'meta' && integration.connected) {
                            // Si ya está conectado, solo abrir para ver configuración
                          }
                        }}
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
                        <DialogTitle>
                          {integration.connected ? 'Configurar' : 'Conectar'} {integration.name}
                        </DialogTitle>
                        <DialogDescription>
                          {integration.connected
                            ? `Gestiona la configuración de ${integration.name}`
                            : `Introduce las credenciales de API para conectar ${integration.name}`}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
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
                              <Input
                                type="password"
                                placeholder="Tu access token de Meta"
                                value={metaCredentials.accessToken}
                                onChange={(e) =>
                                  setMetaCredentials({
                                    ...metaCredentials,
                                    accessToken: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Ad Account ID</Label>
                              <Input
                                placeholder="act_123456789"
                                value={metaCredentials.adAccountId}
                                onChange={(e) =>
                                  setMetaCredentials({
                                    ...metaCredentials,
                                    adAccountId: e.target.value,
                                  })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Tu Ad Account ID: 756949758484112 (puedes usar con o sin prefijo "act_")
                                <br />
                                <strong>⚠️ Importante:</strong> El token debe tener permisos <code>ads_read</code> y <code>ads_management</code>
                                <br />
                                Obtén el Access Token desde developers.facebook.com → Tools → Graph API Explorer
                                <br />
                                Asegúrate de seleccionar los permisos correctos antes de generar el token.
                              </p>
                            </div>
                          </>
                        )}
                        {integration.id === 'analytics' && (
                          <>
                            <div className="space-y-2">
                              <Label>Property ID (Opcional)</Label>
                              <Input 
                                placeholder="123456789" 
                                value={analyticsPropertyId}
                                onChange={(e) => setAnalyticsPropertyId(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                Tu Property ID de Google Analytics 4. Si no lo proporcionas aquí, puedes configurarlo después de conectar.
                                <br />
                                <strong>⚠️ Importante:</strong> Necesitarás autorizar la aplicación con tu cuenta de Google.
                                <br />
                                La aplicación solicitará permisos de solo lectura para acceder a tus datos de Analytics.
                              </p>
                            </div>
                            {integration.connected && (
                              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                                <strong>✓ Conectado</strong>
                                <br />
                                Google Analytics está conectado y listo para sincronizar datos.
                              </div>
                            )}
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
                        {integration.id === 'meta' ? (
                          <Button
                            onClick={handleConnectMeta}
                            disabled={connecting}
                          >
                            {connecting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Conectando...
                              </>
                            ) : (
                              integration.connected ? 'Actualizar' : 'Conectar'
                            )}
                          </Button>
                        ) : integration.id === 'analytics' ? (
                          <Button
                            onClick={handleConnectAnalytics}
                            disabled={connecting}
                          >
                            {connecting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Conectando...
                              </>
                            ) : (
                              integration.connected ? 'Reconectar' : 'Conectar con Google'
                            )}
                          </Button>
                        ) : (
                          <Button disabled>Conectar</Button>
                        )}
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {integration.connected && integration.id === 'meta' && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSyncMeta}
                      disabled={syncing === 'meta'}
                    >
                      {syncing === 'meta' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {integration.connected && integration.id === 'analytics' && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSyncAnalytics}
                      disabled={syncing === 'analytics'}
                    >
                      {syncing === 'analytics' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
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

