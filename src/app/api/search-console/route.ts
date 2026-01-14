import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSearchConsoleServiceFromSupabase } from '@/lib/integrations/google-search-console'
import { subDays, format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    
    // Get date range from query params or use defaults
    const startDate = searchParams.get('startDate') || format(subDays(new Date(), 27), 'yyyy-MM-dd')
    const endDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd')
    
    // Callback to save refreshed tokens
    const saveRefreshedToken = async (tokenData: { accessToken: string; expiresAt?: Date }) => {
      const { data: existing } = await supabase
        .from('integration_settings')
        .select('settings')
        .eq('integration', 'analytics')
        .single()

      const existingSettings = (existing as any)?.settings || {}

      await (supabase
        .from('integration_settings') as any)
        .update({
          settings: {
            ...existingSettings,
            access_token: tokenData.accessToken,
            expires_at: tokenData.expiresAt?.toISOString() || null,
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('integration', 'analytics')
      
      console.log('[Search Console API] Refreshed token saved to database')
    }

    // Create Search Console service
    const searchConsoleService = await createSearchConsoleServiceFromSupabase(supabase, saveRefreshedToken)
    
    if (!searchConsoleService) {
      return NextResponse.json({
        success: true,
        data: {
          queries: [],
          message: 'Search Console no está conectado. Reconecta Google Analytics para activar Search Console.'
        }
      })
    }

    // Calculate date ranges for current and previous periods
    const currentRange = { startDate, endDate }
    
    // Calculate the duration of the current period
    const currentStart = new Date(startDate)
    const currentEnd = new Date(endDate)
    const daysDiff = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24))
    
    // Previous period is the same duration before the current period
    const previousRange = {
      startDate: format(subDays(currentStart, daysDiff + 1), 'yyyy-MM-dd'),
      endDate: format(subDays(currentStart, 1), 'yyyy-MM-dd'),
    }

    console.log('[Search Console API] Fetching queries for:', currentRange)
    console.log('[Search Console API] Previous period:', previousRange)

    // Fetch queries for both periods
    let currentQueries
    let previousQueries
    
    try {
      currentQueries = await searchConsoleService.getSearchQueries(currentRange)
      previousQueries = await searchConsoleService.getSearchQueries(previousRange)
    } catch (error: any) {
      const errorMessage = error?.message || String(error)
      
      // Check for common errors
      if (errorMessage.includes('TOKEN_REVOKED') || errorMessage.includes('invalid_grant')) {
        return NextResponse.json({
          success: false,
          error: 'Token expirado o revocado',
          details: 'Por favor, reconecta Google Analytics desde la página de integraciones.',
          requiresReconnect: true
        }, { status: 401 })
      }
      
      if (errorMessage.includes('403') || errorMessage.includes('forbidden') || errorMessage.includes('not verified')) {
        return NextResponse.json({
          success: true,
          data: {
            queries: [],
            message: 'No tienes acceso a Search Console para este sitio. Verifica que el dominio esté verificado en Search Console o reconecta Google Analytics con los permisos correctos.'
          }
        })
      }
      
      if (errorMessage.includes('site not found') || errorMessage.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: {
            queries: [],
            message: 'El dominio no está verificado en Search Console. Ve a https://search.google.com/search-console para verificar tu dominio.'
          }
        })
      }
      
      throw error
    }

    // Group similar queries
    const groupedQueries = searchConsoleService.groupSimilarQueries(currentQueries, previousQueries)
    
    // Take top groups
    const topGroups = groupedQueries.slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        queries: topGroups,
        dateRange: currentRange,
        previousDateRange: previousRange,
        totalQueries: currentQueries.length,
      }
    })
  } catch (error: any) {
    console.error('[Search Console API] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Error al obtener datos de Search Console',
      details: error?.message || String(error)
    }, { status: 500 })
  }
}
