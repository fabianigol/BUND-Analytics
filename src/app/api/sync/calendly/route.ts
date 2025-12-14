import { NextRequest, NextResponse } from 'next/server'
import { createCalendlyService } from '@/lib/integrations/calendly'
import { subDays } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const calendlyService = createCalendlyService()
    if (!calendlyService) {
      return NextResponse.json(
        { error: 'Calendly integration not configured. Please add CALENDLY_API_KEY to environment variables.' },
        { status: 400 }
      )
    }

    // Get current user to fetch their events
    const currentUser = await calendlyService.getCurrentUser()
    const userUri = currentUser.resource.uri

    // Fetch events from the last 30 days
    const minStartTime = subDays(new Date(), 30).toISOString()
    const events = await calendlyService.getScheduledEvents({
      userUri,
      minStartTime,
      count: 100,
    })

    const transformedEvents = []

    // Process each event
    for (const event of events.collection) {
      const invitees = await calendlyService.getEventInvitees(event.uri)
      const invitee = invitees.collection[0]

      const transformedEvent = calendlyService.transformEvent({
        ...event,
        invitee: invitee
          ? { email: invitee.email, name: invitee.name }
          : undefined,
      })

      transformedEvents.push({
        id: event.uri.split('/').pop(),
        ...transformedEvent,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Fetched ${transformedEvents.length} Calendly events`,
      records_synced: transformedEvents.length,
      data: transformedEvents,
    })
  } catch (error) {
    console.error('Calendly sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Calendly data', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to trigger Calendly sync',
    configured: !!process.env.CALENDLY_API_KEY
  })
}
