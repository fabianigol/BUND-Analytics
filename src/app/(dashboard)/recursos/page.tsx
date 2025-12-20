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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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

const toolResources: ResourceItem[] = [
  {
    id: 'design-tools',
    title: 'Herramientas de Diseño',
    description: 'Figma, Canva, Adobe y más herramientas de diseño',
    icon: Palette,
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
  },
  {
    id: 'development-tools',
    title: 'Herramientas de Desarrollo',
    description: 'IDEs, editores, y herramientas para desarrolladores',
    icon: Code,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    id: 'analytics-tools',
    title: 'Herramientas de Analytics',
    description: 'Google Analytics, Mixpanel, Amplitude y más',
    icon: BarChart3,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  {
    id: 'email-tools',
    title: 'Herramientas de Email',
    description: 'Plataformas de email marketing y automatización',
    icon: Mail,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  {
    id: 'calendar-tools',
    title: 'Herramientas de Calendario',
    description: 'Calendly, Acuity, y otras herramientas de citas',
    icon: Calendar,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
  {
    id: 'ecommerce-tools',
    title: 'Herramientas de E-commerce',
    description: 'Shopify, WooCommerce, y plataformas de ventas',
    icon: ShoppingCart,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    id: 'social-tools',
    title: 'Herramientas de Social Media',
    description: 'Herramientas para gestionar redes sociales',
    icon: Megaphone,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  {
    id: 'image-tools',
    title: 'Herramientas de Imagen',
    description: 'Editores de imagen, optimizadores y generadores',
    icon: ImageIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    id: 'video-tools',
    title: 'Herramientas de Video',
    description: 'Editores de video y plataformas de streaming',
    icon: Video,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  {
    id: 'audio-tools',
    title: 'Herramientas de Audio',
    description: 'Editores de audio y plataformas de podcast',
    icon: Music,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
  {
    id: 'documentation-tools',
    title: 'Herramientas de Documentación',
    description: 'Plataformas para crear y gestionar documentación',
    icon: BookOpen,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  {
    id: 'link-tools',
    title: 'Herramientas de Enlaces',
    description: 'Acortadores de URL y gestores de enlaces',
    icon: LinkIcon,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  {
    id: 'cloud-tools',
    title: 'Herramientas Cloud',
    description: 'Servicios en la nube y almacenamiento',
    icon: Cloud,
    color: 'text-sky-600',
    bgColor: 'bg-sky-100',
  },
  {
    id: 'server-tools',
    title: 'Herramientas de Servidor',
    description: 'Herramientas para gestión de servidores y hosting',
    icon: Server,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  {
    id: 'mobile-tools',
    title: 'Herramientas Móviles',
    description: 'Herramientas para desarrollo y gestión móvil',
    icon: Smartphone,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
  },
  {
    id: 'desktop-tools',
    title: 'Herramientas de Escritorio',
    description: 'Aplicaciones y herramientas para escritorio',
    icon: Monitor,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
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
  const [isPromptSheetOpen, setIsPromptSheetOpen] = useState(false)
  const [prompts, setPrompts] = useState<Prompt[]>(promptResources)
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [promptForm, setPromptForm] = useState({
    title: '',
    promptText: '',
    emoji: '',
    color: '',
    category: '',
    isShared: false,
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    username: '',
    password: '',
    isShared: false,
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
          .select('id, title, prompt_text, emoji, color, category, is_shared')
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
    })
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
    })
    setIsPromptSheetOpen(false)
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
      setIsPromptSheetOpen(false)
      setSelectedPrompt(null)
    } catch (error) {
      console.error('Error deleting prompt:', error)
      alert('Error al eliminar el prompt')
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

      if (editingPrompt) {
        // Actualizar prompt existente
        const updateData = {
          title: promptForm.title,
          prompt_text: promptForm.promptText,
          emoji: promptForm.emoji || null,
          color: promptForm.color || null,
          category: promptForm.category || null,
          is_shared: isAdmin ? promptForm.isShared : false,
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
      })
      setEditingPrompt(null)
      // Recargar prompts para mostrar los cambios
      const loadPromptsAgain = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const { data, error } = await supabase
            .from('prompts')
            .select('id, title, prompt_text, emoji, color, category, is_shared')
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
                <div className="flex justify-end">
                  <Button onClick={handleAddPrompt} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Añadir Prompt
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {prompts.map((prompt) => (
                    <div key={prompt.id} className="relative">
                      <button
                        onClick={() => {
                          setSelectedPrompt(prompt)
                          setIsPromptSheetOpen(true)
                        }}
                        className={`font-mono text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                          prompt.color || 'bg-background border-border hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {prompt.emoji && <span className="mr-2">{prompt.emoji}</span>}
                        {prompt.title}
                      </button>
                      {prompt.isShared && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-white" title="Compartido con todos los usuarios" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="herramientas" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {toolResources.map((resource) => {
                const Icon = resource.icon
                return (
                  <Card
                    key={resource.id}
                    className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                    onClick={() => console.log('Herramientas:', resource.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {Icon && resource.bgColor && resource.color && (
                          <div className={`rounded-lg p-2 ${resource.bgColor}`}>
                            <Icon className={`h-5 w-5 ${resource.color}`} />
                          </div>
                        )}
                        <CardTitle className="text-base">{resource.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{resource.description}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
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

      {/* Sheet para mostrar prompts */}
      <Sheet open={isPromptSheetOpen} onOpenChange={setIsPromptSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <SheetTitle>{selectedPrompt?.title}</SheetTitle>
              {selectedPrompt?.isShared && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Compartido</span>
              )}
            </div>
            <SheetDescription>
              Prompt completo en formato código
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <div className="rounded-lg bg-muted p-4 overflow-x-auto">
              <pre className="font-mono text-sm whitespace-pre-wrap">
                <code>{selectedPrompt?.promptText}</code>
              </pre>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedPrompt?.promptText) {
                    copyToClipboard(selectedPrompt.promptText)
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar prompt
              </Button>
              {selectedPrompt && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleEditPrompt(selectedPrompt)}
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
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
                })
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

