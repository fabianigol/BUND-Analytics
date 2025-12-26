# Acuity Scheduling API - Availability Endpoints Issue Summary

**Date:** December 25, 2025  
**Status:** ❌ Not Working - All implementation attempts return 0 available slots  
**Contact:** [Your email]

---

## Overview

We have successfully integrated Acuity Scheduling API for fetching appointments, calendars, and appointment types. However, we are unable to retrieve **available appointment slots** (future availability) using the `/availability/times` and `/availability/dates` endpoints.

**What Works ✅:**
- Appointments synchronization (`/appointments`)
- Calendars retrieval (`/calendars`)
- Appointment types retrieval (`/appointment-types`)
- All appointment data is correctly stored and displayed

**What Doesn't Work ❌:**
- Available slots retrieval (`/availability/times`, `/availability/dates`)
- All attempts return `datesCount: 0, totalSlots: 0`

---

## Implementation Attempts

### Attempt 1: Direct Call to `/availability/times` with `days` Parameter
- **Approach:** Call `/availability/times` with `date`, `appointmentTypeID`, and `days` parameter
- **Result:** Failed - API doesn't accept `days` parameter for `/availability/times`

### Attempt 2: Call to `/availability/times` without `calendarID`
- **Approach:** Call `/availability/times` with only `date` and `appointmentTypeID` (aggregated)
- **Result:** Failed - Returns 0 slots

### Attempt 3: Two-Step Approach: `/availability/dates` + `/availability/times`
- **Approach:** 
  1. Call `/availability/dates` with `month` and `appointmentTypeID` to get available dates
  2. For each date, call `/availability/times` with `date` and `appointmentTypeID`
- **Result:** Failed - `/availability/times` still returns 0 slots

### Attempt 4: Call `/availability/times` for Each `calendarID` (Employee)
- **Approach:** 
  1. Query `acuity_calendars` to get all employees for an `appointmentTypeID`
  2. For each employee (`calendarID`), call `/availability/times`
  3. Aggregate results by store
- **Result:** Failed - Still returns 0 slots even with specific `calendarID`

### Attempt 5: `/availability/dates` without `calendarID` + `/availability/times` with `calendarID`
- **Approach:**
  1. Call `/availability/dates` without `calendarID` to get all dates for appointment type
  2. For each date, call `/availability/times` with specific `calendarID`
- **Result:** Failed - Returns 0 slots

### Attempt 6: Parallel Processing Optimization
- **Approach:** Process calendars and dates in parallel batches to reduce sync time
- **Result:** Improved performance but still returns 0 slots

### Attempt 7: Call `/availability/times` without `calendarID` and Filter After
- **Approach:**
  1. Call `/availability/times` without `calendarID` to get ALL slots from all employees
  2. Filter slots by `calendarID` using the field in each slot response
  3. Aggregate by store
- **Result:** Failed - Still returns 0 slots

---

## Current Implementation

### Code Structure

**Method: `getAvailableDates()`**
```typescript
async getAvailableDates(params: {
  appointmentTypeID?: number
  calendarID?: number
  month?: string // YYYY-MM
}): Promise<Array<{ date: string }>> {
  // Calls: GET /availability/dates?month=YYYY-MM&appointmentTypeID=XXX
}
```

**Method: `getAvailability()`**
```typescript
async getAvailability(params: {
  date: string // YYYY-MM-DD (required)
  appointmentTypeID: number // Required
  calendarID?: number // Optional
}): Promise<AcuityAvailability> {
  // Calls: GET /availability/times?date=YYYY-MM-DD&appointmentTypeID=XXX&calendarID=YYY (optional)
}
```

### API Calls Being Made

**Example 1: Getting Available Dates**
```
GET https://acuityscheduling.com/api/v1/availability/dates?month=2025-12&appointmentTypeID=57323769
```

**Example 2: Getting Available Times**
```
GET https://acuityscheduling.com/api/v1/availability/times?date=2025-12-26&appointmentTypeID=57323769
```

**Example 3: With calendarID**
```
GET https://acuityscheduling.com/api/v1/availability/times?date=2025-12-26&appointmentTypeID=57323769&calendarID=13199564
```

### Responses Received

**All responses return:**
```json
{
  "dates": []
}
```

Or when logged:
```
{ datesCount: 0, totalSlots: 0 }
```

---

## Database Structure

We have created two tables to store availability data:

**Table: `acuity_availability_by_store`**
- Stores aggregated availability by store, date, and category (medición/fitting)
- Fields: `date`, `store_name`, `appointment_type_id`, `appointment_category`, `total_slots`, `booked_slots`, `available_slots`

**Table: `acuity_availability_history`**
- Stores historical snapshots for weekly/monthly/quarterly comparisons
- Fields: `snapshot_date`, `store_name`, `period_type`, `total_slots`, `booked_slots`, `occupation_percentage`

**Status:** ✅ Tables created and ready. Empty because API returns no data.

---

## Log Analysis

**Pattern observed in all logs:**
```
[Acuity API] Requesting: /availability/dates
[Acuity API] Requesting: /availability/times
[Acuity Sync] Availability response for type 57323769 from 2025-12-25: { datesCount: 0, totalSlots: 0 }
[Acuity API] Processed 0 availability records for type 57323769
```

**All 10 log files analyzed show the same pattern:**
- API calls are being made successfully (no authentication errors)
- API responds with HTTP 200 OK
- Response structure is correct but arrays are empty
- No error messages from the API

---

## Questions for Acuity Support

1. **Are there any specific requirements** for the `/availability/times` and `/availability/dates` endpoints to return data? (e.g., appointment types must be marked as "public", availability must be actively configured)

2. **Is there a minimum configuration** needed in the Acuity dashboard for these endpoints to work? (e.g., availability hours must be set, scheduling limits must be configured)

3. **Do these endpoints have date range limitations?** (e.g., only returns availability for next 30 days)

4. **Are there different API endpoints** for admin vs client/booking context? Should we be using a different endpoint?

5. **Could you provide a working example** of a request that successfully returns available slots?

6. **Are there any API permissions or settings** that need to be enabled for availability endpoints to work?

---

## What We Need

**Goal:** Retrieve all available appointment slots for future dates, aggregated by store and appointment category (medición/fitting).

**Use Case:** Calculate store occupancy rates (booked vs available slots) for weekly, monthly, and quarterly reporting.

**Expected Behavior:** 
- `/availability/dates` should return dates with available slots
- `/availability/times` should return time slots for a given date and appointment type

**Current Behavior:**
- Both endpoints return empty arrays
- No error messages
- Appointments endpoint works perfectly

---

## Technical Details

- **API Version:** v1.1
- **Authentication:** Basic Auth (User ID + API Key)
- **Appointment Types:** 28 types configured (14 fitting, 14 medición)
- **Calendars:** 29 active calendars (employees)
- **Date Range Tested:** Next 365 days
- **Date Format:** YYYY-MM-DD
- **Month Format:** YYYY-MM

---

## Additional Information

- All other API endpoints work correctly
- Appointments are being synced successfully (409 appointments in database)
- Calendars and appointment types are retrieved correctly
- Authentication is working (no 401 errors)
- API rate limiting is respected (sleep delays implemented)

---

**We appreciate any assistance you can provide to help us successfully retrieve availability data from the Acuity Scheduling API.**

Thank you for your time and support.

