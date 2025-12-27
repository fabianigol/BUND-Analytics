'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  Trash2,
  Edit,
  Loader2,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { createClient } from '@/lib/supabase/client'
import { checkIsAdmin } from '@/lib/utils/user'

interface User {
  id: string
  full_name: string
  email: string
  role: string
  avatar_url: string | null
  department: string | null
  created_at: string
  last_sign_in_at: string | null
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  marketing_manager: 'Marketing Manager',
  viewer: 'Viewer',
  CEO: 'CEO',
  CBDO: 'CBDO',
  CFO: 'CFO',
  art_director: 'Art Director',
  content: 'Content',
  support: 'Support',
  agency: 'Agency',
}

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  marketing_manager: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
  CEO: 'bg-red-100 text-red-700',
  CBDO: 'bg-orange-100 text-orange-700',
  CFO: 'bg-green-100 text-green-700',
  art_director: 'bg-pink-100 text-pink-700',
  content: 'bg-yellow-100 text-yellow-700',
  support: 'bg-cyan-100 text-cyan-700',
  agency: 'bg-indigo-100 text-indigo-700',
}

// Secciones del sidebar que pueden tener permisos
// Los IDs deben coincidir con sectionName en Sidebar.tsx
const sidebarSections = [
  { id: 'dashboard', label: 'Dashboard', section: 'principal' },
  { id: 'citas', label: 'Citas', section: 'principal' },
  { id: 'ventas', label: 'Ventas', section: 'principal' },
  { id: 'paid-media', label: 'Paid Media', section: 'principal' },
  { id: 'analytics', label: 'Analytics', section: 'principal' },
  { id: 'reportes', label: 'Reportes', section: 'principal' },
  { id: 'recursos', label: 'Recursos', section: 'principal' },
  { id: 'usuarios', label: 'Usuarios', section: 'admin' },
  { id: 'integraciones', label: 'Integraciones', section: 'admin' },
  { id: 'configuracion', label: 'Configuración', section: 'admin' },
]

export default function UsuariosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  
  // Estados para edición
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    department: '',
  })
  
  // Estados para cambiar rol
  const [changingRoleUser, setChangingRoleUser] = useState<User | null>(null)
  const [isChangingRole, setIsChangingRole] = useState(false)
  const [newRole, setNewRole] = useState('')
  
  // Estados para eliminar
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Formulario de creación
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'viewer',
    department: 'marketing',
    sidebarPermissions: [] as string[],
  })

  const supabase = createClient()

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // Verificar si es admin y cargar usuarios
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)

        // Verificar si es admin
        const adminCheck = await checkIsAdmin()
        setIsAdmin(adminCheck)

        // Cargar usuarios
        await loadUsers()
      } catch (error) {
        console.error('Error loading data:', error)
        showMessage('error', 'Error al cargar los datos')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const loadUsers = async () => {
    try {
      // Obtener usuarios con sus roles
      const { data: usersData, error: usersError } = await (supabase as any)
        .from('users')
        .select('id, full_name, email, avatar_url, department, created_at')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      // Obtener roles para cada usuario
      const usersWithRoles: User[] = []
      for (const user of (usersData || []) as any[]) {
        const { data: roleData } = await (supabase as any)
          .from('user_roles')
          .select('roles!inner(name)')
          .eq('user_id', user.id)
          .maybeSingle()

        usersWithRoles.push({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: (roleData as any)?.roles?.name || 'viewer',
          avatar_url: user.avatar_url,
          department: user.department,
          created_at: user.created_at,
          last_sign_in_at: null, // No disponible desde cliente sin service role
        })
      }

      setUsers(usersWithRoles)
    } catch (error: any) {
      // Ignorar errores vacíos {} completamente
      // Solo mostrar error si hay un mensaje real
      const shouldShowError = error && 
                             typeof error === 'object' && 
                             Object.keys(error).length > 0 &&
                             (error.message?.trim() || 
                              error.code?.trim() ||
                              error.details?.trim())
      
      if (shouldShowError && error.message?.trim()) {
        console.error('Error loading users:', error.message)
        showMessage('error', error.message || 'Error al cargar los usuarios')
      }
      // Si no cumple las condiciones, ignorar completamente (objeto vacío o sin información útil)
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  // Crear usuario
  const handleCreateUser = async () => {
    try {
      setIsCreatingUser(true)

      // Limpiar y validar email
      const emailTrimmed = newUser.email?.trim() || ''
      const fullNameTrimmed = newUser.full_name?.trim() || ''
      const passwordTrimmed = newUser.password?.trim() || ''

      // Validaciones
      if (!emailTrimmed || !fullNameTrimmed || !passwordTrimmed) {
        showMessage('error', 'Por favor completa todos los campos requeridos')
        return
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailTrimmed)) {
        showMessage('error', 'Por favor ingresa un email válido (ejemplo: usuario@dominio.com)')
        return
      }

      if (passwordTrimmed.length < 6) {
        showMessage('error', 'La contraseña debe tener al menos 6 caracteres')
        return
      }

      // Crear usuario en auth.users (usando admin API)
      // Nota: Esto requiere service role key en el servidor
      // Por ahora, crearemos el usuario directamente usando signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailTrimmed.toLowerCase(),
        password: passwordTrimmed,
        options: {
          data: {
            full_name: fullNameTrimmed,
          },
        },
      })

      if (authError) {
        let errorMessage = 'Error al crear usuario'
        
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          errorMessage = 'Este email ya está registrado'
        } else if (authError.message.includes('invalid format') || authError.message.includes('Unable to validate email')) {
          errorMessage = 'El formato del email no es válido. Por favor verifica que sea correcto (ejemplo: usuario@dominio.com)'
        } else if (authError.message.includes('Password')) {
          errorMessage = `Error en la contraseña: ${authError.message}`
        } else {
          errorMessage = `Error al crear usuario: ${authError.message}`
        }
        
        showMessage('error', errorMessage)
        setIsCreatingUser(false)
        return
      }

      if (!authData.user) {
        showMessage('error', 'Error al crear el usuario')
        return
      }

      const userId = authData.user.id

      // Esperar un poco para que el trigger cree el perfil (si aún no existe)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Usar upsert para crear o actualizar el perfil del usuario
      const { error: profileError } = await (supabase as any)
        .from('users')
        .upsert({
          id: userId,
          email: emailTrimmed.toLowerCase(),
          full_name: fullNameTrimmed,
          department: newUser.department || null,
        }, {
          onConflict: 'id'
        })

      // Verificar error de perfil - ignorar si es solo que no existe (el trigger lo crea)
      if (profileError && profileError.code !== 'PGRST116') {
        // Solo mostrar si hay un mensaje real
        if (profileError.message?.trim()) {
          console.error('Error updating profile:', profileError.message)
          // No bloquear - el trigger puede haber creado el perfil
        }
      }

      // Obtener ID del rol
      const { data: roleData, error: roleError } = await (supabase as any)
        .from('roles')
        .select('id, name')
        .eq('name', newUser.role)
        .single()

      if (roleError) {
        // Si el rol no existe, dar mensaje más específico
        if (roleError.code === 'PGRST116') {
          showMessage('error', `El rol "${newUser.role}" no existe en la base de datos. Por favor ejecuta la migración de roles primero.`)
        } else {
          console.error('Error fetching role:', roleError)
          showMessage('error', `Error al obtener el rol: ${roleError.message || roleError.code || 'Error desconocido'}`)
        }
        setIsCreatingUser(false)
        return
      }

      if (!roleData) {
        showMessage('error', `El rol "${newUser.role}" no se encontró en la base de datos`)
        setIsCreatingUser(false)
        return
      }

      // Eliminar rol anterior si existe y asignar nuevo rol
      await (supabase as any).from('user_roles').delete().eq('user_id', userId)
      
      const { error: userRoleError } = await (supabase as any)
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleData.id,
        })

      if (userRoleError) {
        // Solo mostrar si hay un mensaje real
        if (userRoleError.message?.trim()) {
          console.error('Error inserting user role:', userRoleError.message)
          showMessage('error', `Error al asignar el rol: ${userRoleError.message}`)
        } else if (userRoleError.code?.trim()) {
          console.error('Error inserting user role:', userRoleError.code)
          showMessage('error', `Error al asignar el rol: ${userRoleError.code}`)
        } else {
          showMessage('error', 'Error al asignar el rol. Verifica las políticas RLS.')
        }
        setIsCreatingUser(false)
        return
      }

      // Si no es admin, asignar permisos de sidebar
      if (newUser.role !== 'admin' && newUser.sidebarPermissions.length > 0) {
        const permissionsToInsert = newUser.sidebarPermissions.map((section) => ({
          user_id: userId,
          section_name: section,
        }))

        const { error: permissionsError } = await (supabase as any)
          .from('user_sidebar_permissions')
          .insert(permissionsToInsert)

        // Error de permisos no es crítico, solo loguear si hay mensaje
        if (permissionsError && permissionsError.message?.trim()) {
          console.error('Error creating permissions:', permissionsError.message)
          // Continuar de todas formas
        }
      }

      // Limpiar formulario
      setNewUser({
        email: '',
        full_name: '',
        password: '',
        role: 'viewer',
        department: 'marketing',
        sidebarPermissions: [],
      })
      setIsCreating(false)

      // Recargar usuarios
      await loadUsers()

      showMessage('success', 'Usuario creado exitosamente')
    } catch (error: any) {
      // Solo mostrar error si tiene información útil
      const hasValidError = error?.message?.trim() || 
                           error?.code?.trim() ||
                           error?.details?.trim()
      
      if (hasValidError) {
        console.error('Error creating user:', error)
        showMessage('error', error.message || error.code || 'Error al crear el usuario')
      } else {
        // Error vacío - puede que se haya creado correctamente, intentar recargar usuarios
        await loadUsers()
        showMessage('success', 'Usuario creado exitosamente')
      }
    } finally {
      setIsCreatingUser(false)
    }
  }

  const toggleSidebarPermission = (sectionId: string) => {
    setNewUser((prev) => ({
      ...prev,
      sidebarPermissions: prev.sidebarPermissions.includes(sectionId)
        ? prev.sidebarPermissions.filter((id) => id !== sectionId)
        : [...prev.sidebarPermissions, sectionId],
    }))
  }

  // Función para editar usuario
  const handleEditClick = (user: User) => {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      department: user.department || '',
    })
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return

    try {
      const fullNameTrimmed = editForm.full_name.trim()
      const emailTrimmed = editForm.email.trim().toLowerCase()

      if (!fullNameTrimmed || !emailTrimmed) {
        showMessage('error', 'Por favor completa todos los campos requeridos')
        return
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailTrimmed)) {
        showMessage('error', 'Por favor ingresa un email válido')
        return
      }

      // Actualizar perfil del usuario
      const { error: updateError } = await (supabase as any)
        .from('users')
        .update({
          full_name: fullNameTrimmed,
          email: emailTrimmed,
          department: editForm.department || null,
        })
        .eq('id', editingUser.id)

      if (updateError) {
        if (updateError.message?.trim()) {
          showMessage('error', `Error al actualizar usuario: ${updateError.message}`)
        } else {
          showMessage('error', 'Error al actualizar usuario')
        }
        return
      }

      showMessage('success', 'Usuario actualizado correctamente')
      setIsEditing(false)
      setEditingUser(null)
      await loadUsers()
    } catch (error: any) {
      showMessage('error', error.message || 'Error al actualizar usuario')
    }
  }

  // Función para cambiar rol
  const handleChangeRoleClick = (user: User) => {
    setChangingRoleUser(user)
    setNewRole(user.role)
    setIsChangingRole(true)
  }

  const handleSaveRoleChange = async () => {
    if (!changingRoleUser || !newRole) return

    try {
      // Obtener ID del rol
      const { data: roleData, error: roleError } = await (supabase as any)
        .from('roles')
        .select('id')
        .eq('name', newRole)
        .single()

      if (roleError || !roleData) {
        showMessage('error', `El rol "${newRole}" no existe en la base de datos`)
        return
      }

      // Eliminar rol anterior y asignar nuevo rol
      await (supabase as any).from('user_roles').delete().eq('user_id', changingRoleUser.id)
      
      const { error: userRoleError } = await (supabase as any)
        .from('user_roles')
        .insert({
          user_id: changingRoleUser.id,
          role_id: roleData.id,
        })

      if (userRoleError) {
        if (userRoleError.message?.trim()) {
          showMessage('error', `Error al cambiar rol: ${userRoleError.message}`)
        } else {
          showMessage('error', 'Error al cambiar rol')
        }
        return
      }

      showMessage('success', 'Rol actualizado correctamente')
      setIsChangingRole(false)
      setChangingRoleUser(null)
      await loadUsers()
    } catch (error: any) {
      showMessage('error', error.message || 'Error al cambiar rol')
    }
  }

  // Función para eliminar usuario
  const handleDeleteClick = (user: User) => {
    setDeletingUser(user)
    setIsDeleting(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return

    try {
      // Eliminar permisos de sidebar primero
      const { error: permissionsError } = await (supabase as any)
        .from('user_sidebar_permissions')
        .delete()
        .eq('user_id', deletingUser.id)

      if (permissionsError && permissionsError.message?.trim()) {
        console.error('Error deleting sidebar permissions:', permissionsError.message)
      }

      // Eliminar roles del usuario
      const { error: rolesError } = await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', deletingUser.id)

      if (rolesError && rolesError.message?.trim()) {
        console.error('Error deleting user roles:', rolesError.message)
      }

      // Eliminar perfil del usuario (esto debería ser posible con políticas RLS para admins)
      const { error: profileDeleteError } = await (supabase as any)
        .from('users')
        .delete()
        .eq('id', deletingUser.id)

      if (profileDeleteError) {
        if (profileDeleteError.message?.trim()) {
          showMessage('error', `Error al eliminar usuario: ${profileDeleteError.message}`)
        } else {
          showMessage('error', 'Error al eliminar usuario. El usuario de autenticación debe eliminarse manualmente desde Supabase Dashboard.')
        }
        setIsDeleting(false)
        return
      }

      showMessage('success', 'Usuario eliminado correctamente. Nota: El usuario de autenticación puede necesitar eliminarse manualmente desde Supabase Dashboard.')
      setIsDeleting(false)
      setDeletingUser(null)
      await loadUsers()
    } catch (error: any) {
      showMessage('error', error.message || 'Error al eliminar usuario')
      setIsDeleting(false)
    }
  }

  // Agrupar secciones por tipo
  const principalSections = sidebarSections.filter((s) => s.section === 'principal')
  const adminSections = sidebarSections.filter((s) => s.section === 'admin')

  const totalUsers = users.length
  const activeUsers = users.length // Todos los usuarios están activos por ahora
  const adminUsers = users.filter((u) => u.role === 'admin').length

  return (
    <div className="flex flex-col">
      <Header
        title="Usuarios"
        subtitle="Gestiona el acceso del equipo al dashboard"
      />

      <div className="flex-1 space-y-6 p-6">
        {message && (
          <div className={`rounded-lg border p-4 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-sm text-muted-foreground">Usuarios totales</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-emerald-100 p-2">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeUsers}</p>
                <p className="text-sm text-muted-foreground">Activos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-amber-100 p-2">
                <Mail className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Invitaciones pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-purple-100 p-2">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{adminUsers}</p>
                <p className="text-sm text-muted-foreground">Administradores</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-medium">Miembros del Equipo</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuarios..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 pl-9"
                  />
                </div>
                {isAdmin && (
                  <Dialog open={isCreating} onOpenChange={setIsCreating}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Crear Usuario
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                          Crea un nuevo usuario con todos sus datos y permisos
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Primera fila horizontal: Email y Nombre */}
                        <div className="grid gap-4 grid-cols-2">
                          <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input
                              type="email"
                              placeholder="usuario@email.com"
                              value={newUser.email}
                              onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Nombre completo *</Label>
                            <Input
                              placeholder="Nombre Apellido"
                              value={newUser.full_name}
                              onChange={(e) => setNewUser((prev) => ({ ...prev, full_name: e.target.value }))}
                            />
                          </div>
                        </div>
                        {/* Segunda fila horizontal: Contraseña y Rol */}
                        <div className="grid gap-4 grid-cols-2">
                          <div className="space-y-2">
                            <Label>Contraseña *</Label>
                            <Input
                              type="password"
                              placeholder="Mínimo 6 caracteres"
                              value={newUser.password}
                              onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Rol *</Label>
                            <Select
                              value={newUser.role}
                              onValueChange={(value) => setNewUser((prev) => ({ ...prev, role: value, sidebarPermissions: value === 'admin' ? [] : prev.sidebarPermissions }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="marketing_manager">Marketing Manager</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="CEO">CEO</SelectItem>
                                <SelectItem value="CBDO">CBDO</SelectItem>
                                <SelectItem value="CFO">CFO</SelectItem>
                                <SelectItem value="art_director">Art Director</SelectItem>
                                <SelectItem value="content">Content</SelectItem>
                                <SelectItem value="support">Support</SelectItem>
                                <SelectItem value="agency">Agency</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* Tercera fila horizontal: Departamento */}
                        <div className="grid gap-4 grid-cols-2">
                          <div className="space-y-2">
                            <Label>Departamento</Label>
                            <Select
                              value={newUser.department}
                              onValueChange={(value) => setNewUser((prev) => ({ ...prev, department: value }))}
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
                          <div></div>
                        </div>

                        {newUser.role !== 'admin' && (
                          <div className="space-y-4 border-t pt-4">
                            <Label className="text-base font-semibold">Permisos de Sidebar</Label>
                            <p className="text-sm text-muted-foreground">
                              Selecciona las secciones a las que tendrá acceso este usuario. Los administradores tienen acceso a todo.
                            </p>
                            
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground mb-2 block">PRINCIPAL</Label>
                                <div className="space-y-2">
                                  {principalSections.map((section) => (
                                    <div key={section.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={section.id}
                                        checked={newUser.sidebarPermissions.includes(section.id)}
                                        onCheckedChange={() => toggleSidebarPermission(section.id)}
                                      />
                                      <Label htmlFor={section.id} className="font-normal cursor-pointer">
                                        {section.label}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <Label className="text-sm font-medium text-muted-foreground mb-2 block">ADMINISTRACIÓN</Label>
                                <div className="space-y-2">
                                  {adminSections.map((section) => (
                                    <div key={section.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={section.id}
                                        checked={newUser.sidebarPermissions.includes(section.id)}
                                        onCheckedChange={() => toggleSidebarPermission(section.id)}
                                      />
                                      <Label htmlFor={section.id} className="font-normal cursor-pointer">
                                        {section.label}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreating(false)} disabled={isCreatingUser}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateUser} disabled={isCreatingUser}>
                          {isCreatingUser ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creando...
                            </>
                          ) : (
                            'Crear Usuario'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead>Fecha de registro</TableHead>
                    {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                        No hay usuarios registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {getInitials(user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={roleBadgeColors[user.role]}>
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at ? formatDate(user.last_sign_in_at, 'dd MMM yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell>{formatDate(user.created_at, 'dd MMM yyyy')}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditClick(user)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRoleClick(user)}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Cambiar rol
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteClick(user)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para editar usuario */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica la información del usuario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input
                placeholder="Nombre Apellido"
                value={editForm.full_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="usuario@email.com"
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={editForm.department}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, department: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="ventas">Ventas</SelectItem>
                  <SelectItem value="operaciones">Operaciones</SelectItem>
                  <SelectItem value="soporte">Soporte</SelectItem>
                  <SelectItem value="desarrollo">Desarrollo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para cambiar rol */}
      <Dialog open={isChangingRole} onOpenChange={setIsChangingRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Rol</DialogTitle>
            <DialogDescription>
              Selecciona el nuevo rol para {changingRoleUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="marketing_manager">Marketing Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="CEO">CEO</SelectItem>
                  <SelectItem value="CBDO">CBDO</SelectItem>
                  <SelectItem value="CFO">CFO</SelectItem>
                  <SelectItem value="art_director">Art Director</SelectItem>
                  <SelectItem value="content">Content</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangingRole(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRoleChange}>
              Cambiar rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el usuario
              <strong> {deletingUser?.full_name}</strong> ({deletingUser?.email}) y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleting(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
