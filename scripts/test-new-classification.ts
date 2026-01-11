import { createClient } from '@supabase/supabase-js'
import { format, startOfMonth, endOfMonth, subDays, parseISO } from 'date-fns'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno')
  process.exit(1)
}

async function testNewClassification() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  
  console.log('🧪 TESTEANDO NUEVA CLASIFICACIÓN DE PEDIDOS')
  console.log('=' .repeat(80))
  console.log('')

  // Obtener pedidos del mes actual
  const { data: currentOrdersData } = await supabase
    .from('shopify_orders')
    .select('customer_email, created_at, tags')
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())

  if (!currentOrdersData || currentOrdersData.length === 0) {
    console.log('❌ No hay pedidos en el mes actual')
    return
  }

  const currentOrders = currentOrdersData as Array<{ customer_email: string; created_at: string; tags?: string[] | null }>

  // Separar pedidos online (sin etiquetas) de pedidos en tienda (con etiquetas)
  const onlineOrders = currentOrders.filter(order => {
    const tags = (order.tags as string[] | null) || []
    return !tags || tags.length === 0
  })

  const storeOrders = currentOrders.filter(order => {
    const tags = (order.tags as string[] | null) || []
    return tags && tags.length > 0
  })

  console.log(`📦 Total pedidos: ${currentOrders.length}`)
  console.log(`   Online (sin tags): ${onlineOrders.length}`)
  console.log(`   Tienda (con tags): ${storeOrders.length}`)
  console.log('')

  let ordersFromMedicion = 0
  let ordersFromFitting = 0
  let ordersWithoutAppointment = 0

  if (storeOrders.length > 0) {
    const customerEmails = [...new Set(storeOrders.map(o => o.customer_email).filter(Boolean))]

    if (customerEmails.length > 0) {
      // Obtener todas las citas relevantes (90 días antes - NUEVA VENTANA)
      const appointmentsSearchStart = subDays(monthStart, 90)
      const appointmentsSearchEnd = new Date(monthEnd)
      appointmentsSearchEnd.setDate(appointmentsSearchEnd.getDate() + 7)

      console.log(`📅 Buscando citas entre:`)
      console.log(`   Desde: ${format(appointmentsSearchStart, 'yyyy-MM-dd')}`)
      console.log(`   Hasta: ${format(appointmentsSearchEnd, 'yyyy-MM-dd')}`)
      console.log('')

      const { data: allAppointments } = await supabase
        .from('acuity_appointments')
        .select('customer_email, appointment_category, datetime')
        .in('customer_email', customerEmails)
        .gte('datetime', appointmentsSearchStart.toISOString())
        .lte('datetime', appointmentsSearchEnd.toISOString())
        .neq('status', 'canceled')
        .order('datetime', { ascending: false })

      console.log(`📅 Citas encontradas: ${allAppointments?.length || 0}`)
      console.log('')

      // Crear un mapa de email -> cita más reciente antes del pedido
      const appointmentsByEmail = new Map<string, { category: 'medición' | 'fitting'; datetime: string }>()

      if (allAppointments && allAppointments.length > 0) {
        storeOrders.forEach(order => {
          if (!order.customer_email) return

          const orderDate = parseISO(order.created_at)
          // Ampliar ventana de búsqueda: buscar citas hasta 90 días antes del pedido
          const relevantAppointments = (allAppointments as any[])
            .filter((apt: any) =>
              apt.customer_email === order.customer_email &&
              parseISO(apt.datetime) <= orderDate &&
              parseISO(apt.datetime) >= subDays(orderDate, 90)
            )
            .sort((a: any, b: any) => parseISO(b.datetime).getTime() - parseISO(a.datetime).getTime())

          if (relevantAppointments.length > 0) {
            const latestAppointment = relevantAppointments[0]
            const existing = appointmentsByEmail.get(order.customer_email)
            if (!existing || parseISO(latestAppointment.datetime) > parseISO(existing.datetime)) {
              appointmentsByEmail.set(order.customer_email, {
                category: latestAppointment.appointment_category as 'medición' | 'fitting',
                datetime: latestAppointment.datetime,
              })
            }
          }
        })
      }

      console.log(`🔗 Emails con citas encontradas: ${appointmentsByEmail.size}`)
      console.log('')

      // Función para inferir tipo de cita desde los tags de Shopify
      const inferAppointmentTypeFromTags = (tags: string[] | null): 'medición' | 'fitting' => {
        if (!tags || tags.length === 0) {
          return 'medición' // Default si no hay tags
        }

        const tagsLower = tags.map(t => t.toLowerCase())
        
        // INDICADORES DE MEDICIÓN (primera visita)
        // 1. Cliente nuevo → definitivamente medición
        if (tagsLower.some(t => t.includes('nuevo cliente'))) {
          return 'medición'
        }

        // 2. Motivos que sugieren primera compra
        const firstTimePurchaseMotives = [
          'su propia boda',
          'laboral',
          'boda o celebración ajena'
        ]
        const hasFirstTimeMotive = tagsLower.some(t => 
          firstTimePurchaseMotives.some(motive => t.includes(motive))
        )

        // INDICADORES DE FITTING (segunda visita, ajustes)
        // 1. Cliente recurrente → más probable fitting
        const isRecurrent = tagsLower.some(t => t.includes('recurrente'))
        
        // 2. Motivos que sugieren compra recurrente
        const recurrentMotives = [
          'diario por gusto',
          'ocasional para ocio'
        ]
        const hasRecurrentMotive = tagsLower.some(t => 
          recurrentMotives.some(motive => t.includes(motive))
        )

        // LÓGICA DE DECISIÓN:
        // Si es recurrente Y tiene motivo recurrente → FITTING
        if (isRecurrent && hasRecurrentMotive) {
          return 'fitting'
        }
        
        // Si es recurrente pero con motivo de primera compra → MEDICIÓN (nuevo traje)
        if (isRecurrent && hasFirstTimeMotive) {
          return 'medición'
        }

        // Si es recurrente sin más info → FITTING (probablemente ajuste)
        if (isRecurrent) {
          return 'fitting'
        }

        // Por defecto: MEDICIÓN (es el 74% de las citas y el primer paso)
        return 'medición'
      }

      // Contar pedidos inferidos (sin cita en BD)
      let inferredFromTags = 0
      let inferredAsMedicion = 0
      let inferredAsFitting = 0

      // NUEVA LÓGICA: Contar pedidos en tienda por tipo de cita
      storeOrders.forEach(order => {
        const appointment = appointmentsByEmail.get(order.customer_email)
        
        if (!appointment) {
          // Sin cita encontrada en BD: inferir desde tags
          inferredFromTags++
          const inferredType = inferAppointmentTypeFromTags(order.tags as string[] | null)
          if (inferredType === 'medición') {
            ordersFromMedicion++
            inferredAsMedicion++
          } else {
            ordersFromFitting++
            inferredAsFitting++
          }
        } else if (appointment.category === 'medición') {
          ordersFromMedicion++
        } else if (appointment.category === 'fitting') {
          ordersFromFitting++
        } else {
          // Categoría desconocida: inferir desde tags
          inferredFromTags++
          const inferredType = inferAppointmentTypeFromTags(order.tags as string[] | null)
          if (inferredType === 'medición') {
            ordersFromMedicion++
            inferredAsMedicion++
          } else {
            ordersFromFitting++
            inferredAsFitting++
          }
        }
      })

      console.log('📊 ESTADÍSTICAS DE INFERENCIA:')
      console.log(`   Pedidos SIN cita en BD: ${inferredFromTags}`)
      console.log(`   Inferidos como Medición: ${inferredAsMedicion} (${((inferredAsMedicion / inferredFromTags) * 100).toFixed(1)}%)`)
      console.log(`   Inferidos como Fitting: ${inferredAsFitting} (${((inferredAsFitting / inferredFromTags) * 100).toFixed(1)}%)`)
      console.log('')
    } else {
      // Si no hay emails, todos los pedidos en tienda son medición por defecto
      ordersFromMedicion = storeOrders.length
    }
  }

  console.log('🎯 RESULTADO NUEVA CLASIFICACIÓN:')
  console.log('=' .repeat(80))
  console.log(`   Total Pedidos: ${currentOrders.length}`)
  console.log(`   Online: ${onlineOrders.length}`)
  console.log(`   Medición: ${ordersFromMedicion}`)
  console.log(`   Fitting: ${ordersFromFitting}`)
  console.log(`   Sin Cita: ${ordersWithoutAppointment} ← ¡DEBERÍA SER 0!`)
  console.log('=' .repeat(80))
  console.log('')

  if (ordersWithoutAppointment === 0) {
    console.log('✅ ÉXITO: Todos los pedidos en tienda están clasificados como Medición o Fitting')
  } else {
    console.log('⚠️  ADVERTENCIA: Aún hay pedidos sin clasificar')
  }
  console.log('')

  // Calcular porcentajes
  const totalStoreOrders = ordersFromMedicion + ordersFromFitting + ordersWithoutAppointment
  if (totalStoreOrders > 0) {
    console.log('📊 Distribución de pedidos en tienda:')
    console.log(`   Medición: ${((ordersFromMedicion / totalStoreOrders) * 100).toFixed(1)}%`)
    console.log(`   Fitting: ${((ordersFromFitting / totalStoreOrders) * 100).toFixed(1)}%`)
    if (ordersWithoutAppointment > 0) {
      console.log(`   Sin Cita: ${((ordersWithoutAppointment / totalStoreOrders) * 100).toFixed(1)}%`)
    }
  }
}

testNewClassification().catch(console.error)
