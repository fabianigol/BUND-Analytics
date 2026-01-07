import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/utils/user'

/**
 * POST /api/admin/users
 * Crea un nuevo usuario (solo admins)
 * 
 * Este endpoint usa la Admin API de Supabase para crear usuarios
 * sin iniciar sesión automáticamente, manteniendo la sesión del admin.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que sea admin
    const isAdmin = await checkIsAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para crear usuarios' },
        { status: 403 }
      )
    }

    // Obtener datos del body
    const body = await request.json()
    const { email, password, full_name, department, role, sidebarPermissions } = body

    // Validaciones
    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: email, password, full_name, role' },
        { status: 400 }
      )
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'El formato del email no es válido' },
        { status: 400 }
      )
    }

    // Validar contraseña
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Crear cliente con service role key para usar Admin API
    const adminClient = createServiceRoleClient()

    // Crear usuario usando Admin API con service_role
    const { data: newUserData, error: createUserError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        full_name: full_name,
      },
    })

    if (createUserError) {
      console.error('Error creating user with admin API:', createUserError)
      
      let errorMessage = 'Error al crear usuario'
      if (createUserError.message.includes('already registered') || 
          createUserError.message.includes('already exists')) {
        errorMessage = 'Este email ya está registrado'
      } else {
        errorMessage = createUserError.message
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    if (!newUserData.user) {
      return NextResponse.json(
        { error: 'Error al crear el usuario' },
        { status: 500 }
      )
    }

    const newUserId = newUserData.user.id

    // Esperar un poco para que el trigger cree el perfil
    await new Promise(resolve => setTimeout(resolve, 500))

    // Actualizar perfil del usuario con departamento
    const { error: profileError } = await (supabase as any)
      .from('users')
      .upsert({
        id: newUserId,
        email: email.toLowerCase(),
        full_name: full_name,
        department: department || null,
      }, {
        onConflict: 'id'
      })

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error updating profile:', profileError)
      // No bloquear - continuar
    }

    // Obtener ID del rol
    const { data: roleData, error: roleError } = await (supabase as any)
      .from('roles')
      .select('id, name')
      .eq('name', role)
      .single()

    if (roleError || !roleData) {
      console.error('Error fetching role:', roleError)
      return NextResponse.json(
        { error: `El rol "${role}" no se encontró en la base de datos` },
        { status: 400 }
      )
    }

    // Eliminar roles anteriores (por si acaso) y asignar nuevo rol
    await (supabase as any).from('user_roles').delete().eq('user_id', newUserId)
    
    const { error: userRoleError } = await (supabase as any)
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role_id: roleData.id,
      })

    if (userRoleError) {
      console.error('Error inserting user role:', userRoleError)
      return NextResponse.json(
        { error: `Error al asignar el rol: ${userRoleError.message}` },
        { status: 500 }
      )
    }

    // Asignar permisos de sidebar si no es admin
    if (role !== 'admin' && sidebarPermissions && sidebarPermissions.length > 0) {
      const permissionsToInsert = sidebarPermissions.map((section: string) => ({
        user_id: newUserId,
        section_name: section,
      }))

      const { error: permissionsError } = await (supabase as any)
        .from('user_sidebar_permissions')
        .insert(permissionsToInsert)

      if (permissionsError) {
        console.error('Error creating permissions:', permissionsError)
        // No bloquear - los permisos se pueden añadir después
      }
    }

    // Retornar éxito
    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: email.toLowerCase(),
        full_name: full_name,
        role: role,
        department: department,
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Unexpected error creating user:', error)
    return NextResponse.json(
      { error: 'Error inesperado al crear usuario', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/users
 * Actualiza un usuario existente (solo admins)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que sea admin
    const isAdmin = await checkIsAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para actualizar usuarios' },
        { status: 403 }
      )
    }

    // Obtener datos del body
    const body = await request.json()
    const { userId, email, full_name, department } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Se requiere el ID del usuario' },
        { status: 400 }
      )
    }

    // Actualizar perfil del usuario
    const { error: updateError } = await (supabase as any)
      .from('users')
      .update({
        email: email?.toLowerCase(),
        full_name: full_name,
        department: department,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating user:', updateError)
      return NextResponse.json(
        { error: `Error al actualizar usuario: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado correctamente'
    })

  } catch (error: any) {
    console.error('Unexpected error updating user:', error)
    return NextResponse.json(
      { error: 'Error inesperado al actualizar usuario', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users
 * Elimina un usuario (solo admins)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que sea admin
    const isAdmin = await checkIsAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar usuarios' },
        { status: 403 }
      )
    }

    // Obtener userId de los parámetros
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Se requiere el ID del usuario' },
        { status: 400 }
      )
    }

    // No permitir auto-eliminación
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta' },
        { status: 400 }
      )
    }

    // Crear cliente con service role key para usar Admin API
    const adminClient = createServiceRoleClient()

    // Eliminar usuario usando Admin API
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return NextResponse.json(
        { error: `Error al eliminar usuario: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    })

  } catch (error: any) {
    console.error('Unexpected error deleting user:', error)
    return NextResponse.json(
      { error: 'Error inesperado al eliminar usuario', details: error.message },
      { status: 500 }
    )
  }
}

