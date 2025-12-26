# Email to Acuity Scheduling Developers Support

**Subject:** Request for Help: Availability Endpoints Returning Empty Results

**To:** developers@acuityscheduling.com

---

Subject: Request for Help: Availability Endpoints Returning Empty Results

Dear Acuity Scheduling Developers Support Team,

I hope this email finds you well. I'm writing to request assistance with an issue we're experiencing while integrating the Acuity Scheduling API into our analytics platform.

## Current Status

**What's Working Successfully:**
We have successfully integrated most of the Acuity Scheduling API functionality:
- ✅ Appointments synchronization (`/appointments` endpoint) - Working perfectly
- ✅ Calendars retrieval (`/calendars` endpoint) - Working perfectly  
- ✅ Appointment types retrieval (`/appointment-types` endpoint) - Working perfectly
- ✅ Authentication - No issues with API credentials
- ✅ We are currently syncing 409 appointments and 29 calendars successfully

**What's Not Working:**
We are unable to retrieve **available appointment slots** (future availability) using the availability endpoints:
- ❌ `/availability/times` - Always returns empty arrays (`datesCount: 0, totalSlots: 0`)
- ❌ `/availability/dates` - Returns empty arrays in all our tests

## What We've Tried

We have attempted multiple implementation strategies over the past several days, all without success:

1. **Direct calls to `/availability/times`** with `date` and `appointmentTypeID` (without `calendarID`)
2. **Two-step approach:** First calling `/availability/dates` to get available dates, then `/availability/times` for each date
3. **Per-employee approach:** Calling `/availability/times` for each `calendarID` (employee) individually
4. **Various parameter combinations:** With and without `calendarID`, different date formats, different month formats

**All attempts result in the same response:**
```json
{
  "dates": []
}
```

## Example API Calls

Here are examples of the API calls we're making:

```
GET /api/v1/availability/dates?month=2025-12&appointmentTypeID=57323769
GET /api/v1/availability/times?date=2025-12-26&appointmentTypeID=57323769
GET /api/v1/availability/times?date=2025-12-26&appointmentTypeID=57323769&calendarID=13199564
```

All calls return HTTP 200 OK, but with empty arrays. We're not receiving any error messages that would indicate what might be wrong.

## Our Goal

We need to retrieve available appointment slots to:
- Calculate store occupancy rates (booked vs available slots)
- Generate weekly, monthly, and quarterly occupancy reports
- Compare availability across different stores and appointment categories (medición/fitting)

We have already built the database structure and aggregation logic to handle this data - we just need the API to return the availability information.

## Questions

Could you please help us understand:

1. **Configuration Requirements:** Are there specific settings in the Acuity dashboard that must be enabled for these endpoints to return data? (e.g., appointment types marked as "public", availability hours configured, scheduling limits set)

2. **API Permissions:** Do the API credentials need special permissions beyond what's required for appointments/calendars endpoints?

3. **Date Limitations:** Are there any date range limitations for these endpoints? (e.g., only returns availability for next 30 days)

4. **Working Example:** Could you provide a working example request/response that successfully returns available slots?

5. **Different Endpoints:** Should we be using different endpoints or a different API version for administrative availability queries vs. client booking queries?

6. **Documentation Updates:** Is the API documentation at https://developers.acuityscheduling.com/reference/get-availability-times up to date, or are there any undocumented requirements?

## Attached Documentation

I've attached a detailed summary document (`ACUITY_AVAILABILITY_ISSUE_SUMMARY.md`) that includes:
- All implementation attempts we've tried
- Code examples of our current implementation
- Log analysis showing the responses we're receiving
- Database structure we've prepared

We would greatly appreciate any guidance or assistance you can provide to help us successfully retrieve availability data from the Acuity Scheduling API.

Thank you very much for your time and support. Please let me know if you need any additional information or if there's anything else we can provide to help diagnose this issue.

Best regards,

[Your Name]  
[Your Title]  
[Your Company]  
[Your Email]  
[Your Phone (optional)]

---

**Additional Context:**
- API Version: v1.1
- Account has 28 appointment types configured
- Account has 29 active calendars (employees)
- We're testing with date ranges from today up to 365 days in the future
- All other API endpoints work without any issues

