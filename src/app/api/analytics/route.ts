import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '30', 10)

    // Get analytics data from database
    const { data: analyticsData, error } = await supabase
      .from('analytics_data')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching analytics data:', error)
      throw error
    }

    // Calculate aggregated metrics from the data
    const totalSessions = analyticsData?.reduce((sum, item) => sum + (item.sessions || 0), 0) || 0
    const totalUsers = analyticsData?.reduce((sum, item) => sum + (item.users || 0), 0) || 0
    const totalPageViews = analyticsData?.reduce((sum, item) => sum + (item.page_views || 0), 0) || 0
    const totalNewUsers = analyticsData?.reduce((sum, item) => sum + (item.new_users || 0), 0) || 0

    // Get the most recent data point for current metrics
    const latestData = analyticsData && analyticsData.length > 0 ? analyticsData[0] : null

    // Calculate average bounce rate
    const avgBounceRate = analyticsData && analyticsData.length > 0
      ? analyticsData.reduce((sum, item) => sum + (item.bounce_rate || 0), 0) / analyticsData.length
      : 0

    // Calculate average session duration
    const avgSessionDuration = analyticsData && analyticsData.length > 0
      ? analyticsData.reduce((sum, item) => sum + (item.avg_session_duration || 0), 0) / analyticsData.length
      : 0

    // Aggregate traffic sources from all records
    const trafficSourcesMap = new Map<string, { source: string; medium: string; sessions: number; users: number }>()
    analyticsData?.forEach((item) => {
      const sources = (item.traffic_sources as any) || []
      sources.forEach((source: any) => {
        const key = `${source.source}-${source.medium}`
        const existing = trafficSourcesMap.get(key)
        if (existing) {
          existing.sessions += source.sessions || 0
          existing.users += source.users || 0
        } else {
          trafficSourcesMap.set(key, {
            source: source.source || 'unknown',
            medium: source.medium || 'unknown',
            sessions: source.sessions || 0,
            users: source.users || 0,
          })
        }
      })
    })

    const trafficSources = Array.from(trafficSourcesMap.values())
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10)

    // Aggregate top pages from all records
    const topPagesMap = new Map<string, { pagePath: string; pageTitle: string; pageViews: number; avgTimeOnPage: number }>()
    analyticsData?.forEach((item) => {
      const pages = (item.top_pages as any) || []
      pages.forEach((page: any) => {
        const key = page.page_path || page.pagePath
        const existing = topPagesMap.get(key)
        if (existing) {
          existing.pageViews += page.page_views || page.pageViews || 0
          existing.avgTimeOnPage = (existing.avgTimeOnPage + (page.avg_time_on_page || page.avgTimeOnPage || 0)) / 2
        } else {
          topPagesMap.set(key, {
            pagePath: page.page_path || page.pagePath || '/',
            pageTitle: page.page_title || page.pageTitle || 'Unknown',
            pageViews: page.page_views || page.pageViews || 0,
            avgTimeOnPage: page.avg_time_on_page || page.avgTimeOnPage || 0,
          })
        }
      })
    })

    const topPages = Array.from(topPagesMap.values())
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 10)

    // Prepare daily data for charts
    const sessionsData = analyticsData?.map((item) => ({
      date: item.date,
      value: item.sessions || 0,
    })) || []

    const usersData = analyticsData?.map((item) => ({
      date: item.date,
      usuarios: item.users || 0,
      nuevos: item.new_users || 0,
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        // Aggregated metrics
        totalSessions,
        totalUsers,
        totalPageViews,
        totalNewUsers,
        avgBounceRate,
        avgSessionDuration,
        
        // Latest data point
        latest: latestData ? {
          sessions: latestData.sessions || 0,
          users: latestData.users || 0,
          new_users: latestData.new_users || 0,
          page_views: latestData.page_views || 0,
          bounce_rate: latestData.bounce_rate || 0,
          avg_session_duration: latestData.avg_session_duration || 0,
          traffic_sources: latestData.traffic_sources || [],
          top_pages: latestData.top_pages || [],
        } : null,
        
        // Chart data
        sessionsData,
        usersData,
        
        // Aggregated lists
        trafficSources,
        topPages,
        
        // Raw data
        rawData: analyticsData || [],
      },
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

