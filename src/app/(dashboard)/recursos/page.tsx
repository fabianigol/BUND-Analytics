'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Header } from '@/components/dashboard/Header'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Key,
  MessageSquare,
  Wrench,
  FileText,
  Code,
  Sparkles,
  Palette,
  Mail,
  Calendar,
  ShoppingCart,
  BarChart3,
  Megaphone,
  Image as ImageIcon,
  Video,
  Music,
  BookOpen,
  Link as LinkIcon,
  Cloud,
  Server,
  Smartphone,
  Monitor,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Upload as UploadIcon,
} from 'lucide-react'

interface ResourceItem {
  id: string
  title: string
  description?: string
  icon?: React.ElementType
  iconImage?: string
  imagePath?: string
  color?: string
  bgColor?: string
  hasMultipleAccounts?: boolean
}

interface Account {
  id: string
  username: string
  password: string
  isShared?: boolean
}

const passwordResources: ResourceItem[] = [
  {
    id: 'facebook',
    title: 'Facebook',
    imagePath: '/face.jpeg',
    hasMultipleAccounts: true,
  },
  {
    id: 'instagram',
    title: 'Instagram',
    imagePath: '/inst.jpeg',
    hasMultipleAccounts: true,
  },
  {
    id: 'linkedin',
    title: 'LinkedIn',
    imagePath: '/linke.jpeg',
    hasMultipleAccounts: false,
  },
  {
    id: 'spotify',
    title: 'Spotify',
    imagePath: '/spoti.jpeg',
    hasMultipleAccounts: false,
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    imagePath: '/tiktk.jpeg',
    hasMultipleAccounts: true,
  },
  {
    id: 'notion',
    title: 'Notion',
    imagePath: '/notion.png',
    hasMultipleAccounts: false,
  },
  {
    id: 'youtube',
    title: 'YouTube',
    imagePath: '/yout.jpeg',
    hasMultipleAccounts: false,
  },
  {
    id: 'pinterest',
    title: 'Pinterest',
    imagePath: '/PINTEREST.png',
    hasMultipleAccounts: false,
  },
  {
    id: 'higgsfield',
    title: 'Higgsfield',
    imagePath: '/higgsfield.png',
    hasMultipleAccounts: false,
  },
  {
    id: 'shopify',
    title: 'Shopify',
    imagePath: '/shoppi.png',
    hasMultipleAccounts: false,
  },
]

interface Prompt {
  id: string
  title: string
  promptText: string
  emoji?: string
  color?: string
  category?: string
  isShared?: boolean
  imageUrl?: string
}

interface Tool {
  id: string
  name: string
  url: string
  emoji: string
  description?: string
  isCustom?: boolean
}

const promptResources: Prompt[] = []

// Opciones predefinidas para el formulario
const emojiOptions = [
  { value: '📝', label: '📝 Texto' },
  { value: '✏️', label: '✏️ Edición' },
  { value: '📧', label: '📧 Email' },
  { value: '🖼️', label: '🖼️ Imagen' },
  { value: '💻', label: '💻 Código' },
  { value: '📢', label: '📢 Marketing' },
  { value: '📱', label: '📱 Redes Sociales' },
  { value: '🎬', label: '🎬 Video' },
  { value: '🎨', label: '🎨 Diseño' },
  { value: '📊', label: '📊 Analytics' },
  { value: '🔍', label: '🔍 Búsqueda' },
  { value: '💡', label: '💡 Ideas' },
  { value: '📚', label: '📚 Educación' },
  { value: '🤖', label: '🤖 IA' },
  { value: '⚡', label: '⚡ Automatización' },
]

const toolEmojiOptions = [
  { value: '📷', label: '📷 Instagram' },
  { value: '🎵', label: '🎵 TikTok' },
  { value: '📺', label: '📺 YouTube' },
  { value: '📌', label: '📌 Pinterest' },
  { value: '✂️', label: '✂️ CapCut' },
  { value: '🤖', label: '🤖 IA' },
  { value: '🎨', label: '🎨 Envato' },
  { value: '📝', label: '📝 Notion' },
  { value: '📊', label: '📊 Airtable' },
  { value: '📧', label: '📧 Klaviyo' },
  { value: '💻', label: '💻 Desarrollo' },
  { value: '🖼️', label: '🖼️ Imagen' },
  { value: '🎬', label: '🎬 Video' },
  { value: '📱', label: '📱 Móvil' },
  { value: '🌐', label: '🌐 Web' },
  { value: '☁️', label: '☁️ Cloud' },
  { value: '🔧', label: '🔧 Herramienta' },
  { value: '⚙️', label: '⚙️ Configuración' },
  { value: '📈', label: '📈 Analytics' },
  { value: '💳', label: '💳 Pago' },
  { value: '🔗', label: '🔗 Enlace' },
  { value: '📦', label: '📦 E-commerce' },
  { value: '🎯', label: '🎯 Marketing' },
  { value: '💬', label: '💬 Comunicación' },
  { value: '📚', label: '📚 Documentación' },
]

const categoryOptions = [
  { value: 'textos', label: 'Textos' },
  { value: 'emails', label: 'Emails' },
  { value: 'imagenes', label: 'Imágenes' },
  { value: 'codigo', label: 'Código' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'redes-sociales', label: 'Redes Sociales' },
  { value: 'videos', label: 'Videos' },
  { value: 'diseno', label: 'Diseño' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'soporte', label: 'Soporte' },
  { value: 'otro', label: 'Otro' },
]

const colorOptions = [
  { value: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Azul' },
  { value: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Morado' },
  { value: 'bg-green-100 text-green-700 border-green-200', label: 'Verde' },
  { value: 'bg-pink-100 text-pink-700 border-pink-200', label: 'Rosa' },
  { value: 'bg-indigo-100 text-indigo-700 border-indigo-200', label: 'Índigo' },
  { value: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Naranja' },
  { value: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: 'Cian' },
  { value: 'bg-red-100 text-red-700 border-red-200', label: 'Rojo' },
  { value: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Amarillo' },
  { value: 'bg-teal-100 text-teal-700 border-teal-200', label: 'Verde Azulado' },
  { value: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Rosa Oscuro' },
  { value: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Gris' },
]

// Herramientas predefinidas
const defaultTools: Tool[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com',
    emoji: '📷',
    description: 'Red social para compartir fotos y videos',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    url: 'https://www.tiktok.com',
    emoji: '🎵',
    description: 'Plataforma de videos cortos',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com',
    emoji: '📺',
    description: 'Plataforma de videos y streaming',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    url: 'https://www.pinterest.com',
    emoji: '📌',
    description: 'Red social para descubrir y guardar ideas',
  },
  {
    id: 'capcut',
    name: 'CapCut',
    url: 'https://www.capcut.com',
    emoji: '✂️',
    description: 'Editor de video profesional',
  },
  {
    id: 'higgsfield',
    name: 'Higgsfield AI',
    url: 'https://www.higgsfield.ai',
    emoji: '🤖',
    description: 'Plataforma de inteligencia artificial',
  },
  {
    id: 'envato',
    name: 'Envato',
    url: 'https://www.envato.com',
    emoji: '🎨',
    description: 'Marketplace de recursos creativos',
  },
  {
    id: 'notion',
    name: 'Notion',
    url: 'https://www.notion.so',
    emoji: '📝',
    description: 'Herramienta de productividad y organización',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    url: 'https://www.airtable.com',
    emoji: '📊',
    description: 'Base de datos y gestión de proyectos',
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    url: 'https://www.klaviyo.com',
    emoji: '📧',
    description: 'Plataforma de email marketing y automatización',
  },
  {
    id: 'slack',
    name: 'Slack',
    url: 'https://slack.com',
    emoji: '💬',
    description: 'Plataforma de comunicación y colaboración en equipo',
  },
  {
    id: 'business-meta',
    name: 'Business Meta',
    url: 'https://business.facebook.com',
    emoji: '📊',
    description: 'Meta Business Suite para gestionar anuncios y páginas',
  },
  {
    id: 'shots-so',
    name: 'Shots.so',
    url: 'https://shots.so',
    emoji: '📸',
    description: 'Herramienta para crear mockups de aplicaciones',
  },
  {
    id: 'suno',
    name: 'Suno',
    url: 'https://www.suno.ai',
    emoji: '🎵',
    description: 'IA para generar música',
  },
  {
    id: 'eleven-labs',
    name: 'Eleven Labs',
    url: 'https://elevenlabs.io',
    emoji: '🎙️',
    description: 'IA de síntesis de voz y audio',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    url: 'https://www.spotify.com',
    emoji: '🎶',
    description: 'Plataforma de streaming de música',
  },
  {
    id: 'metricool',
    name: 'Metricool',
    url: 'https://metricool.com',
    emoji: '📈',
    description: 'Herramienta de análisis y gestión de redes sociales',
  },
  {
    id: 'acuity-scheduling',
    name: 'Acuity Scheduling',
    url: 'https://www.acuityscheduling.com',
    emoji: '📅',
    description: 'Sistema de reservas y citas online',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    url: 'https://www.midjourney.com',
    emoji: '🎨',
    description: 'IA generativa de imágenes',
  },
  {
    id: 'cliply',
    name: 'Cliply',
    url: 'https://www.cliply.space',
    emoji: '✂️',
    description: 'Herramienta para descargar partes de videos',
  },
  {
    id: 'really-good-emails',
    name: 'Really Good Emails',
    url: 'https://reallygoodemails.com',
    emoji: '📧',
    description: 'Inspiración y plantillas de emails',
  },
  {
    id: 'mockly',
    name: 'Mockly',
    url: 'https://www.getmockly.com',
    emoji: '💬',
    description: 'Herramienta para crear mockups de conversaciones',
  },
]

export default function RecursosPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('contraseñas')
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({})
  const [loading, setLoading] = useState(false)
  const [accountCounts, setAccountCounts] = useState<{ [key: string]: number }>({})
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false)
  const [prompts, setPrompts] = useState<Prompt[]>(promptResources)
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [isPromptViewDialogOpen, setIsPromptViewDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('todas')
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [promptForm, setPromptForm] = useState({
    title: '',
    promptText: '',
    emoji: '',
    color: '',
    category: '',
    isShared: false,
    imageUrl: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    username: '',
    password: '',
    isShared: false,
  })
  const [tools, setTools] = useState<Tool[]>(defaultTools)
  const [loadingTools, setLoadingTools] = useState(false)
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [toolForm, setToolForm] = useState({
    name: '',
    url: '',
    emoji: '',
    description: '',
  })

  // Verificar si el usuario es administrador
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsAdmin(false)
          return
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role_id, roles!inner(name)')
          .eq('user_id', user.id)
          .single()

        if (error || !data) {
          setIsAdmin(false)
          return
        }

        // @ts-ignore
        setIsAdmin(data.roles?.name === 'admin')
      } catch (error) {
        console.error('Error checking admin:', error)
        setIsAdmin(false)
      }
    }

    checkAdmin()
  }, [supabase])

  // Cargar cuentas desde la base de datos (propias + compartidas)
  const loadAccountsForResource = async (platform: string): Promise<Account[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('passwords')
        .select('id, username, password, notes, is_shared')
        .or(`user_id.eq.${user.id},is_shared.eq.true`)
        .eq('platform', platform)
        .order('is_shared', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading passwords:', error)
        return []
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        username: item.username,
        password: item.password,
        isShared: item.is_shared || false,
      }))
    } catch (error) {
      console.error('Error loading passwords:', error)
      return []
    }
  }

  // Cargar conteo de cuentas para cada plataforma
  useEffect(() => {
    const loadAccountCounts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('passwords')
          .select('platform, is_shared')
          .or(`user_id.eq.${user.id},is_shared.eq.true`)

        if (error) {
          console.error('Error loading account counts:', error)
          return
        }

        const counts: { [key: string]: number } = {}
        data?.forEach((item: any) => {
          counts[item.platform] = (counts[item.platform] || 0) + 1
        })
        setAccountCounts(counts)
      } catch (error) {
        console.error('Error loading account counts:', error)
      }
    }

    loadAccountCounts()
  }, [supabase])

  // Guardar prompts por defecto en la base de datos (ya no hay prompts por defecto)
  const saveDefaultPrompts = async (userId: string) => {
    // Función vacía ya que no hay prompts por defecto
    return
  }

  // Cargar prompts desde la base de datos
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        setLoadingPrompts(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          // Si no hay usuario, usar los prompts por defecto
          setPrompts(promptResources)
          setLoadingPrompts(false)
          return
        }

        // Guardar prompts por defecto si no existen
        await saveDefaultPrompts(user.id)

        const { data, error } = await supabase
          .from('prompts')
          .select('id, title, prompt_text, emoji, color, category, is_shared, image_url')
          .or(`user_id.eq.${user.id},is_shared.eq.true`)
          .order('is_shared', { ascending: true })
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading prompts:', error)
          // Si hay error, usar los prompts por defecto
          setPrompts(promptResources)
        } else if (data && data.length > 0) {
          // Convertir datos de la BD al formato de Prompt
          const loadedPrompts: Prompt[] = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            promptText: item.prompt_text,
            emoji: item.emoji,
            color: item.color,
            category: item.category,
            isShared: item.is_shared || false,
            imageUrl: item.image_url || undefined,
          }))
          setPrompts(loadedPrompts)
        } else {
          // Si no hay prompts en la BD, usar los por defecto
          setPrompts(promptResources)
        }
      } catch (error) {
        console.error('Error loading prompts:', error)
        setPrompts(promptResources)
      } finally {
        setLoadingPrompts(false)
      }
    }

    loadPrompts()
  }, [supabase])

  // Cargar herramientas desde la base de datos
  useEffect(() => {
    const loadTools = async () => {
      try {
        setLoadingTools(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setTools(defaultTools)
          setLoadingTools(false)
          return
        }

        const { data, error } = await (supabase as any)
          .from('tools')
          .select('id, name, url, emoji, description')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading tools:', error)
          setTools(defaultTools)
        } else if (data && data.length > 0) {
          const loadedTools: Tool[] = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            url: item.url,
            emoji: item.emoji || '🔗',
            description: item.description || undefined,
            isCustom: true,
          }))
          setTools([...defaultTools, ...loadedTools])
        } else {
          setTools(defaultTools)
        }
      } catch (error) {
        console.error('Error loading tools:', error)
        setTools(defaultTools)
      } finally {
        setLoadingTools(false)
      }
    }

    loadTools()
  }, [supabase])

  const handleResourceClick = async (resource: ResourceItem) => {
    setSelectedResource(resource)
    setLoading(true)
    
    const resourceAccounts = await loadAccountsForResource(resource.id)
    setAccounts(resourceAccounts)
    
    // Inicializar estado de visibilidad de contraseñas
    const visibility: { [key: string]: boolean } = {}
    resourceAccounts.forEach((acc) => {
      visibility[acc.id] = false
    })
    setShowPasswords(visibility)
    setLoading(false)
  }

  const getAccountCount = (platform: string): number => {
    return accountCounts[platform] || 0
  }

  const togglePasswordVisibility = (accountId: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Aquí podrías agregar un toast de confirmación
  }

  // Funciones para gestionar contraseñas
  const handleAddPassword = () => {
    if (!selectedResource) return
    setEditingAccount(null)
    setPasswordForm({
      username: '',
      password: '',
      isShared: false,
    })
    setIsPasswordDialogOpen(true)
  }

  const handleEditPassword = (account: Account) => {
    setEditingAccount(account)
    setPasswordForm({
      username: account.username,
      password: account.password,
      isShared: account.isShared || false,
    })
    setIsPasswordDialogOpen(true)
  }

  const handleSavePassword = async () => {
    if (!selectedResource || !passwordForm.username || !passwordForm.password) {
      alert('Por favor, completa todos los campos')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Debes estar autenticado para guardar contraseñas')
        return
      }

      if (editingAccount) {
        // Actualizar contraseña existente
        const updateData = {
          username: passwordForm.username,
          password: passwordForm.password,
          is_shared: isAdmin ? passwordForm.isShared : false,
        }
        const { error } = await (supabase as any)
          .from('passwords')
          .update(updateData)
          .eq('id', editingAccount.id)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error updating password:', error)
          alert('Error al actualizar la contraseña')
          return
        }
      } else {
        // Crear nueva contraseña
        const { error } = await (supabase as any)
          .from('passwords')
          .insert({
            user_id: user.id,
            platform: selectedResource.id,
            username: passwordForm.username,
            password: passwordForm.password,
            is_shared: isAdmin ? passwordForm.isShared : false,
          })

        if (error) {
          console.error('Error creating password:', error)
          alert('Error al crear la contraseña')
          return
        }
      }

      setIsPasswordDialogOpen(false)
      setPasswordForm({
        username: '',
        password: '',
        isShared: false,
      })
      setEditingAccount(null)
      
      // Recargar cuentas
      if (selectedResource) {
        const resourceAccounts = await loadAccountsForResource(selectedResource.id)
        setAccounts(resourceAccounts)
        const visibility: { [key: string]: boolean } = {}
        resourceAccounts.forEach((acc) => {
          visibility[acc.id] = false
        })
        setShowPasswords(visibility)
      }
      
      // Recargar conteos
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const { data } = await supabase
          .from('passwords')
          .select('platform, is_shared')
          .or(`user_id.eq.${currentUser.id},is_shared.eq.true`)
        
        if (data) {
          const counts: { [key: string]: number } = {}
          data.forEach((item: any) => {
            counts[item.platform] = (counts[item.platform] || 0) + 1
          })
          setAccountCounts(counts)
        }
      }
    } catch (error) {
      console.error('Error saving password:', error)
      alert('Error al guardar la contraseña')
    }
  }

  const handleDeletePassword = async (accountId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta contraseña?')) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await (supabase as any)
        .from('passwords')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting password:', error)
        alert('Error al eliminar la contraseña')
        return
      }

      // Actualizar la lista de cuentas
      setAccounts(accounts.filter((acc) => acc.id !== accountId))
      
      // Recargar conteos
      const { data } = await supabase
        .from('passwords')
        .select('platform, is_shared')
        .or(`user_id.eq.${user.id},is_shared.eq.true`)
      
      if (data) {
        const counts: { [key: string]: number } = {}
        data.forEach((item: any) => {
          counts[item.platform] = (counts[item.platform] || 0) + 1
        })
        setAccountCounts(counts)
      }
    } catch (error) {
      console.error('Error deleting password:', error)
      alert('Error al eliminar la contraseña')
    }
  }

  // Funciones para gestionar prompts
  const handleAddPrompt = () => {
    setEditingPrompt(null)
    setPromptForm({
      title: '',
      promptText: '',
      emoji: '',
      color: '',
      category: '',
      isShared: false,
      imageUrl: '',
    })
    setImageFile(null)
    setImagePreview(null)
    setIsPromptDialogOpen(true)
  }

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setPromptForm({
      title: prompt.title,
      promptText: prompt.promptText,
      emoji: prompt.emoji || '',
      color: prompt.color || '',
      category: prompt.category || '',
      isShared: prompt.isShared || false,
      imageUrl: prompt.imageUrl || '',
    })
    setImageFile(null)
    setImagePreview(prompt.imageUrl || null)
    setIsPromptViewDialogOpen(false)
    setIsPromptDialogOpen(true)
  }

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este prompt?')) {
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', promptId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting prompt:', error)
        alert('Error al eliminar el prompt')
        return
      }

      // Actualizar la lista de prompts
      setPrompts(prompts.filter((p) => p.id !== promptId))
      setIsPromptViewDialogOpen(false)
      setSelectedPrompt(null)
    } catch (error) {
      console.error('Error deleting prompt:', error)
      alert('Error al eliminar el prompt')
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('prompts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        alert('Error al subir la imagen: ' + uploadError.message)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('prompts')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error al subir la imagen')
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSavePrompt = async () => {
    if (!promptForm.title || !promptForm.promptText) {
      alert('Por favor, completa el título y el texto del prompt')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Debes estar autenticado para guardar prompts')
        return
      }

      // Subir imagen si hay una nueva
      let imageUrl = promptForm.imageUrl
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile)
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        }
      }

      if (editingPrompt) {
        // Actualizar prompt existente
        const updateData = {
          title: promptForm.title,
          prompt_text: promptForm.promptText,
          emoji: promptForm.emoji || null,
          color: promptForm.color || null,
          category: promptForm.category || null,
          is_shared: isAdmin ? promptForm.isShared : false,
          image_url: imageUrl || null,
        }
        const { error } = await (supabase as any)
          .from('prompts')
          .update(updateData)
          .eq('id', editingPrompt.id)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error updating prompt:', error)
          alert('Error al actualizar el prompt')
          return
        }

        // Actualizar la lista de prompts
        setPrompts(
          prompts.map((p) =>
            p.id === editingPrompt.id
              ? {
                  ...p,
                  title: promptForm.title,
                  promptText: promptForm.promptText,
                  emoji: promptForm.emoji || undefined,
                  color: promptForm.color || undefined,
                  category: promptForm.category || undefined,
                  imageUrl: imageUrl || undefined,
                }
              : p
          )
        )
      } else {
        // Crear nuevo prompt
        const { data, error } = await supabase
          .from('prompts')
          .insert({
            user_id: user.id,
            title: promptForm.title,
            prompt_text: promptForm.promptText,
            emoji: promptForm.emoji || null,
            color: promptForm.color || null,
            category: promptForm.category || null,
            is_shared: isAdmin ? promptForm.isShared : false,
            image_url: imageUrl || null,
          } as any)
          .select()
          .single() as { data: any; error: any }

        if (error) {
          console.error('Error creating prompt:', error)
          alert('Error al crear el prompt')
          return
        }

        // Añadir el nuevo prompt a la lista
        if (data) {
          setPrompts([
            {
              id: (data as any).id,
              title: (data as any).title,
              promptText: (data as any).prompt_text,
              emoji: (data as any).emoji || undefined,
              color: (data as any).color || undefined,
              category: (data as any).category || undefined,
              isShared: (data as any).is_shared || false,
              imageUrl: (data as any).image_url || undefined,
            },
            ...prompts,
          ])
        }
      }

      setIsPromptDialogOpen(false)
      setPromptForm({
        title: '',
        promptText: '',
        emoji: '',
        color: '',
        category: '',
        isShared: false,
        imageUrl: '',
      })
      setImageFile(null)
      setImagePreview(null)
      setEditingPrompt(null)
      // Recargar prompts para mostrar los cambios
      const loadPromptsAgain = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const { data, error } = await supabase
            .from('prompts')
            .select('id, title, prompt_text, emoji, color, category, is_shared, image_url')
            .or(`user_id.eq.${user.id},is_shared.eq.true`)
            .order('is_shared', { ascending: true })
            .order('created_at', { ascending: false })

          if (!error && data) {
            const loadedPrompts: Prompt[] = data.map((item: any) => ({
              id: item.id,
              title: item.title,
              promptText: item.prompt_text,
              emoji: item.emoji,
              color: item.color,
              category: item.category,
              isShared: item.is_shared || false,
              imageUrl: item.image_url || undefined,
            }))
            setPrompts(loadedPrompts)
          }
        } catch (error) {
          console.error('Error reloading prompts:', error)
        }
      }
      loadPromptsAgain()
    } catch (error) {
      console.error('Error saving prompt:', error)
      alert('Error al guardar el prompt')
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Recursos"
        subtitle="Gestiona tus contraseñas, prompts y herramientas"
      />

      <div className="flex-1 space-y-6 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="contraseñas" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Contraseñas
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Prompts
            </TabsTrigger>
            <TabsTrigger value="herramientas" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Herramientas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contraseñas" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {passwordResources.map((resource) => {
                const accountCount = getAccountCount(resource.id)
                return (
                  <Card
                    key={resource.id}
                    className="group relative cursor-pointer overflow-hidden border-0 p-0 transition-all duration-300 hover:shadow-2xl hover:scale-105"
                    onClick={() => handleResourceClick(resource)}
                  >
                    <div className="relative aspect-square w-full">
                      {resource.imagePath && (
                        <Image
                          src={resource.imagePath}
                          alt={resource.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      )}
                      {/* Overlay oscuro para mejor legibilidad del texto */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                      
                      {/* Badge con número de cuentas */}
                      {accountCount > 0 && (
                        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-lg">
                          {accountCount}
                        </div>
                      )}
                      
                      {/* Título en la parte inferior */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <CardTitle className="text-base font-bold text-white drop-shadow-lg">
                          {resource.title}
                        </CardTitle>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="prompts" className="mt-6">
            {loadingPrompts ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Cargando prompts...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="category-filter" className="text-sm font-medium">
                      Filtrar por categoría:
                    </Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger id="category-filter" className="w-[200px]">
                        <SelectValue placeholder="Todas las categorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas las categorías</SelectItem>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddPrompt} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Añadir Prompt
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {prompts
                    .filter((prompt) => 
                      selectedCategory === 'todas' || prompt.category === selectedCategory
                    )
                    .map((prompt) => (
                    <div key={prompt.id} className="relative">
                      {prompt.imageUrl ? (
                        <button
                          onClick={() => {
                            setSelectedPrompt(prompt)
                            setIsPromptViewDialogOpen(true)
                          }}
                          className="flex flex-col w-[200px] rounded-md border border-border overflow-hidden transition-all hover:shadow-lg cursor-pointer bg-white dark:bg-slate-900"
                        >
                          <div className="relative w-full aspect-[3/4] overflow-hidden">
                            <Image
                              src={prompt.imageUrl}
                              alt={prompt.title}
                              fill
                              className="object-cover"
                              sizes="200px"
                            />
                          </div>
                          <div className={`p-3 ${prompt.color || 'bg-background border-border'}`}>
                            <div className="flex items-center gap-2">
                              {prompt.emoji && <span>{prompt.emoji}</span>}
                              <span className="font-mono text-sm font-medium truncate">
                                {prompt.title}
                              </span>
                            </div>
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedPrompt(prompt)
                            setIsPromptViewDialogOpen(true)
                          }}
                          className={`font-mono text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                            prompt.color || 'bg-background border-border hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          {prompt.emoji && <span className="mr-2">{prompt.emoji}</span>}
                          {prompt.title}
                        </button>
                      )}
                      {prompt.isShared && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-white z-10" title="Compartido con todos los usuarios" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="herramientas" className="mt-6">
            {loadingTools ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Cargando herramientas...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => {
                    setEditingTool(null)
                    setToolForm({
                      name: '',
                      url: '',
                      emoji: '',
                      description: '',
                    })
                    setIsToolDialogOpen(true)
                  }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Añadir Herramienta
                  </Button>
                </div>
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <div key={tool.id} className="relative group">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    >
                      <span className="text-lg">{tool.emoji}</span>
                      <span className="font-medium">{tool.name}</span>
                      {tool.description && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          - {tool.description}
                        </span>
                      )}
                    </a>
                    {tool.isCustom && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault()
                          if (confirm(`¿Estás seguro de que quieres eliminar ${tool.name}?`)) {
                            try {
                              const { data: { user } } = await supabase.auth.getUser()
                              if (!user) return

                              const { error } = await (supabase as any)
                                .from('tools')
                                .delete()
                                .eq('id', tool.id)
                                .eq('user_id', user.id)

                              if (error) {
                                console.error('Error deleting tool:', error)
                                alert('Error al eliminar la herramienta')
                                return
                              }

                              setTools(tools.filter((t) => t.id !== tool.id))
                            } catch (error) {
                              console.error('Error deleting tool:', error)
                              alert('Error al eliminar la herramienta')
                            }
                          }
                        }}
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Eliminar herramienta"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para mostrar cuentas */}
      <Dialog open={selectedResource !== null} onOpenChange={(open) => !open && setSelectedResource(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedResource?.title}</DialogTitle>
            <DialogDescription>
              {selectedResource?.hasMultipleAccounts
                ? 'Gestiona todas tus cuentas'
                : 'Usuario y contraseña'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="flex justify-end">
              <Button onClick={handleAddPassword} className="gap-2">
                <Plus className="h-4 w-4" />
                Añadir Cuenta
              </Button>
            </div>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Cargando cuentas...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay cuentas guardadas</p>
              </div>
            ) : (
              accounts.map((account) => (
                <Card key={account.id} className="p-4">
                  <div className="space-y-3">
                    {account.isShared && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Compartido</span>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Usuario</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={account.username}
                          readOnly
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(account.username)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Contraseña</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type={showPasswords[account.id] ? 'text' : 'password'}
                          value={account.password}
                          readOnly
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => togglePasswordVisibility(account.id)}
                        >
                          {showPasswords[account.id] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(account.password)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPassword(account)}
                        className="flex-1"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePassword(account.id)}
                        className="flex-1"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
          </Dialog>

      {/* Dialog para mostrar prompts */}
      <Dialog open={isPromptViewDialogOpen} onOpenChange={setIsPromptViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedPrompt?.emoji && (
                  <span className="text-2xl">{selectedPrompt.emoji}</span>
                )}
                <div>
                  <DialogTitle className="text-xl font-semibold">
                    {selectedPrompt?.title}
                  </DialogTitle>
                  {selectedPrompt?.isShared && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      Compartido
                    </span>
                  )}
                </div>
              </div>
            </div>
            <DialogDescription className="mt-2">
              Prompt completo en formato código
            </DialogDescription>
          </DialogHeader>
          
          {/* Contenedor del texto con scroll */}
          <div className="flex-1 overflow-hidden px-6 py-4 min-h-0 flex flex-col">
            <div className="flex-1 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden flex flex-col">
              <div className="flex-1 overflow-auto p-6 min-h-0">
                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                  <code className="text-slate-800 dark:text-slate-200">
                    {selectedPrompt?.promptText}
                  </code>
                </pre>
              </div>
            </div>
          </div>

          {/* Botones siempre visibles */}
          <div className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900 flex-shrink-0 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedPrompt?.promptText) {
                  copyToClipboard(selectedPrompt.promptText)
                }
              }}
              className="flex-1"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar prompt
            </Button>
            {selectedPrompt && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleEditPrompt(selectedPrompt)}
                  className="flex-1"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedPrompt.id) {
                      handleDeletePrompt(selectedPrompt.id)
                    }
                  }}
                  className="flex-1"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para añadir/editar prompts */}
      <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? 'Editar Prompt' : 'Añadir Nuevo Prompt'}
            </DialogTitle>
            <DialogDescription>
              Completa todos los campos para crear o editar un prompt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={promptForm.title}
                onChange={(e) =>
                  setPromptForm({ ...promptForm, title: e.target.value })
                }
                placeholder="Ej: Generador de contenido para blog"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="promptText">Texto del Prompt *</Label>
              <textarea
                id="promptText"
                value={promptForm.promptText}
                onChange={(e) =>
                  setPromptForm({ ...promptForm, promptText: e.target.value })
                }
                placeholder="Escribe aquí el prompt completo..."
                className="mt-1 w-full min-h-[200px] px-3 py-2 border border-input bg-background rounded-md text-sm font-mono"
                rows={10}
              />
            </div>
            <div>
              <Label htmlFor="image">Imagen de referencia (opcional)</Label>
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-4">
                  <label
                    htmlFor="image-upload"
                    className="flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-accent transition-colors"
                  >
                    <UploadIcon className="h-4 w-4" />
                    <span className="text-sm">
                      {imageFile ? 'Cambiar imagen' : imagePreview ? 'Cambiar imagen' : 'Seleccionar imagen'}
                    </span>
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(null)
                        setPromptForm({ ...promptForm, imageUrl: '' })
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  )}
                </div>
                {imagePreview && (
                  <div className="relative w-full max-w-xs aspect-[3/4] rounded-md overflow-hidden border border-input">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 320px) 100vw, 320px"
                    />
                  </div>
                )}
                {uploadingImage && (
                  <p className="text-sm text-muted-foreground">Subiendo imagen...</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emoji">Emoji</Label>
                <Select
                  value={promptForm.emoji}
                  onValueChange={(value) =>
                    setPromptForm({ ...promptForm, emoji: value })
                  }
                >
                  <SelectTrigger id="emoji" className="mt-1 w-full">
                    <SelectValue placeholder="Selecciona un emoji" />
                  </SelectTrigger>
                  <SelectContent>
                    {emojiOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={promptForm.category}
                  onValueChange={(value) =>
                    setPromptForm({ ...promptForm, category: value })
                  }
                >
                  <SelectTrigger id="category" className="mt-1 w-full">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <Select
                value={promptForm.color}
                onValueChange={(value) =>
                  setPromptForm({ ...promptForm, color: value })
                }
              >
                <SelectTrigger id="color" className="mt-1 w-full">
                  <SelectValue placeholder="Selecciona un color" />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`h-4 w-4 rounded ${option.value.split(' ')[0]}`} />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isShared"
                  checked={promptForm.isShared}
                  onChange={(e) =>
                    setPromptForm({ ...promptForm, isShared: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isShared" className="text-sm font-normal cursor-pointer">
                  Compartir con todos los usuarios (recurso global)
                </Label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsPromptDialogOpen(false)
                setPromptForm({
                  title: '',
                  promptText: '',
                  emoji: '',
                  color: '',
                  category: '',
                  isShared: false,
                  imageUrl: '',
                })
                setImageFile(null)
                setImagePreview(null)
                setEditingPrompt(null)
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSavePrompt}>
              <Save className="mr-2 h-4 w-4" />
              {editingPrompt ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para añadir herramientas */}
      <Dialog open={isToolDialogOpen} onOpenChange={setIsToolDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTool ? 'Editar Herramienta' : 'Añadir Nueva Herramienta'}
            </DialogTitle>
            <DialogDescription>
              Añade una herramienta con su URL y descripción
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="toolName">Nombre *</Label>
              <Input
                id="toolName"
                value={toolForm.name}
                onChange={(e) =>
                  setToolForm({ ...toolForm, name: e.target.value })
                }
                placeholder="Ej: Canva"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="toolUrl">URL *</Label>
              <Input
                id="toolUrl"
                type="url"
                value={toolForm.url}
                onChange={(e) =>
                  setToolForm({ ...toolForm, url: e.target.value })
                }
                placeholder="https://www.ejemplo.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="toolEmoji">Emoji</Label>
              <Select
                value={toolForm.emoji}
                onValueChange={(value) =>
                  setToolForm({ ...toolForm, emoji: value })
                }
              >
                <SelectTrigger id="toolEmoji" className="mt-1 w-full">
                  <SelectValue placeholder="Selecciona un emoji" />
                </SelectTrigger>
                <SelectContent>
                  {toolEmojiOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="toolDescription">Descripción</Label>
              <textarea
                id="toolDescription"
                value={toolForm.description}
                onChange={(e) =>
                  setToolForm({ ...toolForm, description: e.target.value })
                }
                placeholder="Explica qué hace esta herramienta..."
                className="mt-1 w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md text-sm"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsToolDialogOpen(false)
                setToolForm({
                  name: '',
                  url: '',
                  emoji: '',
                  description: '',
                })
                setEditingTool(null)
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!toolForm.name || !toolForm.url) {
                  alert('Por favor, completa el nombre y la URL')
                  return
                }

                try {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (!user) {
                    alert('Debes estar autenticado para guardar herramientas')
                    return
                  }

                  if (editingTool) {
                    // Actualizar herramienta existente
                    const { error } = await (supabase as any)
                      .from('tools')
                      .update({
                        name: toolForm.name,
                        url: toolForm.url,
                        emoji: toolForm.emoji || null,
                        description: toolForm.description || null,
                      })
                      .eq('id', editingTool.id)
                      .eq('user_id', user.id)

                    if (error) {
                      console.error('Error updating tool:', error)
                      alert('Error al actualizar la herramienta')
                      return
                    }

                    // Actualizar en el estado
                    setTools(
                      tools.map((t) =>
                        t.id === editingTool.id
                          ? {
                              ...t,
                              name: toolForm.name,
                              url: toolForm.url,
                              emoji: toolForm.emoji || '🔗',
                              description: toolForm.description || undefined,
                            }
                          : t
                      )
                    )
                  } else {
                    // Crear nueva herramienta
                    const { data, error } = await (supabase as any)
                      .from('tools')
                      .insert({
                        user_id: user.id,
                        name: toolForm.name,
                        url: toolForm.url,
                        emoji: toolForm.emoji || null,
                        description: toolForm.description || null,
                      })
                      .select()
                      .single() as { data: any; error: any }

                    if (error) {
                      console.error('Error creating tool:', error)
                      alert('Error al crear la herramienta')
                      return
                    }

                    // Añadir a la lista
                    if (data) {
                      const newTool: Tool = {
                        id: data.id,
                        name: data.name,
                        url: data.url,
                        emoji: data.emoji || '🔗',
                        description: data.description || undefined,
                        isCustom: true,
                      }
                      setTools([...tools, newTool])
                    }
                  }

                  setIsToolDialogOpen(false)
                  setToolForm({
                    name: '',
                    url: '',
                    emoji: '',
                    description: '',
                  })
                  setEditingTool(null)
                  // Recargar herramientas
                  const loadToolsAgain = async () => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser()
                      if (!user) return

                      const { data, error } = await (supabase as any)
                        .from('tools')
                        .select('id, name, url, emoji, description')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })

                      if (!error && data) {
                        const loadedTools: Tool[] = data.map((item: any) => ({
                          id: item.id,
                          name: item.name,
                          url: item.url,
                          emoji: item.emoji || '🔗',
                          description: item.description || undefined,
                          isCustom: true,
                        }))
                        setTools([...defaultTools, ...loadedTools])
                      }
                    } catch (error) {
                      console.error('Error reloading tools:', error)
                    }
                  }
                  loadToolsAgain()
                } catch (error) {
                  console.error('Error saving tool:', error)
                  alert('Error al guardar la herramienta')
                }
              }}
            >
              <Save className="mr-2 h-4 w-4" />
              {editingTool ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para añadir/editar contraseñas */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Editar Contraseña' : 'Añadir Nueva Contraseña'}
            </DialogTitle>
            <DialogDescription>
              {selectedResource && `Plataforma: ${selectedResource.title}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="username">Usuario/Email *</Label>
              <Input
                id="username"
                value={passwordForm.username}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, username: e.target.value })
                }
                placeholder="usuario@email.com o @usuario"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                value={passwordForm.password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, password: e.target.value })
                }
                placeholder="Contraseña"
                className="mt-1"
              />
            </div>
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isSharedPassword"
                  checked={passwordForm.isShared}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, isShared: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isSharedPassword" className="text-sm font-normal cursor-pointer">
                  Compartir con todos los usuarios (recurso global)
                </Label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsPasswordDialogOpen(false)
                setPasswordForm({
                  username: '',
                  password: '',
                  isShared: false,
                })
                setEditingAccount(null)
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSavePassword}>
              <Save className="mr-2 h-4 w-4" />
              {editingAccount ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

