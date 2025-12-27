import { createClient } from '@/lib/supabase/client'

/**
 * Verifica si un usuario es administrador
 * @param userId - ID del usuario a verificar. Si no se proporciona, usa el usuario actual
 * @returns Promise<boolean>
 */
export async function checkIsAdmin(userId?: string): Promise<boolean> {
  try {
    const supabase = createClient()
    
    // Si no se proporciona userId, obtener el usuario actual
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('checkIsAdmin: No user found')
        return false
      }
      userId = user.id
    }

    // Intentar usar la vista users_with_roles primero (más confiable)
    const { data: viewData, error: viewError } = await (supabase as any)
      .from('users_with_roles')
      .select('role_name')
      .eq('id', userId)
      .maybeSingle()

    if (!viewError && (viewData as any)?.role_name) {
      return (viewData as any).role_name === 'admin'
    }

    // Fallback: consulta directa a user_roles con join
    const { data, error } = await (supabase as any)
      .from('user_roles')
      .select('role_id, roles!inner(name)')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }

    if (!data) {
      console.warn('checkIsAdmin: No role data found for user', userId)
      return false
    }

    // @ts-ignore - Supabase join types
    const isAdmin = data.roles?.name === 'admin'
    return isAdmin
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Obtiene el rol de un usuario
 * @param userId - ID del usuario. Si no se proporciona, usa el usuario actual
 * @returns Promise<string | null> - Nombre del rol o null si no tiene rol
 */
export async function getUserRole(userId?: string): Promise<string | null> {
  try {
    const supabase = createClient()
    
    // Si no se proporciona userId, obtener el usuario actual
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('getUserRole: No user found')
        return null
      }
      userId = user.id
    }

    // Intentar usar la vista users_with_roles primero (más confiable)
    const { data: viewData, error: viewError } = await (supabase as any)
      .from('users_with_roles')
      .select('role_name')
      .eq('id', userId)
      .maybeSingle()

    if (!viewError && (viewData as any)?.role_name) {
      return (viewData as any).role_name
    }

    // Fallback: consulta directa a user_roles con join
    const { data, error } = await (supabase as any)
      .from('user_roles')
      .select('role_id, roles!inner(name)')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error getting user role:', error)
      return null
    }

    if (!data) {
      console.warn('getUserRole: No role data found for user', userId)
      return null
    }

    // @ts-ignore - Supabase join types
    return data.roles?.name || null
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

/**
 * Sube un avatar a Supabase Storage
 * @param file - Archivo de imagen a subir
 * @param userId - ID del usuario. Si no se proporciona, usa el usuario actual
 * @returns Promise<string | null> - URL pública del avatar o null si falla
 */
export async function uploadAvatar(file: File, userId?: string): Promise<string | null> {
  try {
    const supabase = createClient()

    // Si no se proporciona userId, obtener el usuario actual
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuario no autenticado')
      }
      userId = user.id
    }

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no válido. Solo se permiten JPG, PNG o GIF.')
    }

    // Validar tamaño (2MB máximo)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. El tamaño máximo es 2MB.')
    }

    // Generar nombre único para el archivo
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    // Eliminar avatar anterior si existe
    // Primero obtener el avatar actual
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single()

    if ((userData as any)?.avatar_url) {
      // Extraer el path del avatar anterior desde la URL
      const oldPath = (userData as any).avatar_url.split('/').slice(-2).join('/') // userId/filename
      try {
        await supabase.storage.from('avatars').remove([oldPath])
      } catch (error) {
        // Si falla al eliminar, continuar de todas formas
        console.warn('No se pudo eliminar el avatar anterior:', error)
      }
    }

    // Subir el nuevo avatar
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Error al subir el avatar: ${uploadError.message}`)
    }

    // Obtener la URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Error uploading avatar:', error)
    throw error
  }
}

