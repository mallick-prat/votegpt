# SuperCRM: Ultra-Personal Relationship Intelligence Spreadsheet

## A. Product Overview

### User Persona
A high-agency, highly-networked individual — likely a founder, investor, operator, or dealmaker — who meets 10–40 people per week across cities like NY, SF, Austin, LA, Boston, and DC. They use Google Calendar religiously. They do NOT want to become a CRM operator. They want a system that knows who they know, when they last talked, and surfaces the right people at the right time.

### Job to Be Done
"Help me understand my network without any work. Show me who I've met, where they are, what they do, when we last spoke, and who's going stale — all from my calendar. I'll only tag city and role. Everything else should be automatic."

### Core Design Principles

1. **Calendar is the source of truth.** If you met someone, it's on your calendar. The CRM reads your life from your calendar.
2. **Manual input = only CITY, ROLE, maybe COMPANY.** Everything else is inferred, synced, or formula-driven.
3. **Master sheet is the single source of truth.** City/role tabs are derived views. Never duplicate data entry.
4. **Preserve user annotations.** Weekly sync must never overwrite manually entered CITY, ROLE, or COMPANY.
5. **Stale = signal.** Contacts you haven't spoken to in 90+ days get flagged. Recency is a first-class metric.
6. **Research-ready.** One click to research any contact via Perplexity.
7. **Zero-maintenance UX.** The user opens the sheet and immediately understands their network.

---

## B. System Architecture

### Data Flow (End to End)

```
Google Calendar API
        │
        ▼
┌──────────────────────┐
│  Apps Script Engine   │
│  (Time-driven trigger │
│   runs weekly)        │
│                       │
│  1. Fetch events      │
│     (rolling 12mo)    │
│  2. Parse attendees   │
│  3. Normalize names   │
│  4. Deduplicate       │
│  5. Merge into Master │
│     CRM sheet         │
│  6. Rebuild derived   │
│     views (city/role) │
│  7. Log sync results  │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│   Google Sheet        │
│                       │
│  ┌─ Dashboard         │
│  ├─ Master CRM ◄──── │ ← User edits CITY, ROLE, COMPANY here
│  ├─ City: NY          │
│  ├─ City: SF          │
│  ├─ City: BOSTON       │
│  ├─ City: AUSTIN      │
│  ├─ City: LA          │
│  ├─ City: DC          │
│  ├─ Role: VCs         │
│  ├─ Role: Founders    │
│  ├─ Role: Angels      │
│  ├─ Role: Celebs      │
│  ├─ Role: Politicians │
│  ├─ Role: Misc        │
│  ├─ Role: LPs & FOs   │
│  ├─ Role: Service     │
│  ├─ Role: Press       │
│  ├─ Settings          │
│  └─ Sync Log          │
└──────────────────────┘
```

### Sync Strategy

**Initial sync:** Pulls all calendar events from the past 12 months. Processes every event, extracts all external attendees, builds the Master CRM from scratch.

**Incremental weekly sync:**
1. Fetches events from the past 7 days (plus a 2-day overlap buffer for edits).
2. For each event, extracts attendees.
3. For each attendee email:
   - If email exists in Master CRM → update Last Contact (if newer), increment Contact Count, update Most Recent Meeting Title.
   - If email does NOT exist → append new row with all auto-populated fields.
4. **Never touches** CITY, ROLE, or COMPANY columns on existing rows.
5. Rebuilds derived view tabs via QUERY formulas (no script needed for views).
6. Logs sync timestamp, events processed, contacts added/updated to Sync Log.

### Where Manual Input Happens
- **CITY column:** User types city code (NY, SF, BOSTON, AUSTIN, LA, DC).
- **ROLE column:** User selects from dropdown (VCs, Founders, Angel Investors, etc.).
- **COMPANY column:** User optionally types company name.
- **Status/Notes column:** User optionally adds freeform notes.
- **Everything else:** Automated.

---

## C. Spreadsheet Schema

### Tab: Dashboard
Summary metrics and charts. No user editing. All formula-driven.

| Section | Content |
|---------|---------|
| Total Contacts | COUNT of Master CRM |
| New This Week | Contacts with First Contact in last 7 days |
| Active (Last 30 Days) | Contacts with Last Contact in last 30 days |
| Going Stale (60-90 Days) | Last Contact 60-90 days ago |
| Stale (90+ Days) | Last Contact 90+ days ago |
| Top Cities | Count by city |
| Top Roles | Count by role |
| Needs Review | Count of contacts flagged for review |
| Last Sync | Timestamp from Sync Log |

### Tab: Master CRM (Columns A–P)

| Col | Header | Auto/Manual | Description |
|-----|--------|-------------|-------------|
| A | Full Name | Auto | Extracted from calendar attendee display name |
| B | Email | Auto | Extracted from calendar attendee email |
| C | Company | **Manual** | User enters. Never overwritten by sync. |
| D | City | **Manual** | User enters (NY/SF/BOSTON/AUSTIN/LA/DC). Dropdown validated. |
| E | Role | **Manual** | User selects from dropdown. Never overwritten by sync. |
| F | Last Contact | Auto | Date of most recent calendar event with this person |
| G | Contact Count | Auto | Total number of meetings with this person |
| H | First Contact | Auto | Date of earliest calendar event with this person |
| I | Days Since Contact | Auto (formula) | =TODAY() - F (Last Contact) |
| J | Recency Status | Auto (formula) | "Active" / "Warm" / "Cooling" / "Stale" based on days |
| K | Most Recent Meeting | Auto | Title of most recent calendar event |
| L | Meeting Notes Snippet | Auto | First 200 chars of most recent event description |
| M | Source | Auto | "Google Calendar" (future: could be "Manual", "Import") |
| N | Status / Notes | **Manual (optional)** | Freeform user notes. Never overwritten. |
| O | Needs Review | Auto | TRUE if name or email is missing/suspicious |
| P | Research | Auto (formula) | Hyperlink to Perplexity search for this person |

### Tab: Settings

| Col | Header | Description |
|-----|--------|-------------|
| A | Setting | Setting name |
| B | Value | Setting value |

Rows:
- `user_email` → The user's own email (to exclude from attendee parsing)
- `exclude_domains` → Comma-separated domains to exclude (e.g., company internal domains)
- `stale_threshold_days` → Default 90
- `cooling_threshold_days` → Default 60
- `warm_threshold_days` → Default 30
- `lookback_months` → Default 12
- `min_attendees_for_group` → Default 8 (events with 8+ attendees are flagged as "group")
- `city_list` → NY,SF,BOSTON,AUSTIN,LA,DC
- `role_list` → VCs,Founders,Angel Investors,Celebrities & Influencers,Politicians,Misc,LPs & Family Offices,Service Providers,Press & Content

### Tab: Sync Log

| Col | Header |
|-----|--------|
| A | Sync Timestamp |
| B | Events Processed |
| C | New Contacts Added |
| D | Existing Contacts Updated |
| E | Errors / Warnings |
| F | Duration (seconds) |

### City Tabs (NY, SF, BOSTON, AUSTIN, LA, DC)
Each is a single QUERY formula that pulls from Master CRM where City = tab name.
Shows: Full Name, Email, Company, Role, Last Contact, Days Since Contact, Recency Status, Contact Count, Research Link.

### Role Tabs (VCs, Founders, Angel Investors, etc.)
Same approach — single QUERY formula filtered by Role.
Shows: Full Name, Email, Company, City, Last Contact, Days Since Contact, Recency Status, Contact Count, Research Link.

---

## D. Automation Logic (Weekly Sync)

### Step-by-Step Process

```
1. TRIGGER: Time-driven trigger fires every Sunday at 2 AM.

2. READ SETTINGS:
   - Get user_email from Settings tab
   - Get exclude_domains from Settings tab
   - Get lookback period (7 days + 2 day buffer for incremental)

3. FETCH CALENDAR EVENTS:
   - CalendarApp.getDefaultCalendar().getEvents(startDate, endDate)
   - For each event, extract:
     - title, startTime, endTime, description, location
     - getGuestList(true) → array of {email, name, status}
     - getCreators() / getOrganizers()

4. PARSE ATTENDEES:
   - For each event with attendees:
     - Filter out user_email
     - Filter out excluded domains
     - Filter out events with 0 external attendees
     - For large events (8+ attendees), flag as "Group Event"
     - For each remaining attendee, create a record:
       {email, displayName, eventTitle, eventDate, eventDescription}

5. READ EXISTING MASTER CRM:
   - Load all rows from Master CRM tab
   - Build a lookup map: email → row index

6. DEDUPLICATION & MERGE:
   For each parsed attendee:

   a. EXACT EMAIL MATCH:
      - If email exists in lookup map → UPDATE existing row:
        - Update Last Contact if event date is newer
        - Increment Contact Count
        - Update Most Recent Meeting Title
        - Update Meeting Notes Snippet
        - DO NOT touch: Company, City, Role, Status/Notes

   b. NO EMAIL MATCH → FUZZY NAME CHECK:
      - Normalize name (lowercase, trim, remove middle initials)
      - Check if normalized name matches any existing row
      - If match found AND existing row has no email → merge (add email to existing)
      - If match found AND existing row has different email → add as new (could be different person)
      - If no match → ADD new row

   c. NEW ROW CREATION:
      - Full Name = attendee display name
      - Email = attendee email
      - Company = "" (blank, for user to fill)
      - City = "" (blank, for user to fill)
      - Role = "" (blank, for user to fill)
      - Last Contact = event date
      - Contact Count = 1
      - First Contact = event date
      - Most Recent Meeting = event title
      - Meeting Notes Snippet = first 200 chars of description
      - Source = "Google Calendar"
      - Needs Review = TRUE if name is blank or looks like an email

7. WRITE BACK TO SHEET:
   - Update modified existing rows in place (only auto columns)
   - Append new rows at bottom
   - Sort Master CRM by Last Contact (newest first)

8. LOG RESULTS:
   - Append row to Sync Log with timestamp, counts, duration

9. REFRESH FORMULAS:
   - City and Role tabs use QUERY formulas, so they auto-update
   - Dashboard metrics auto-update via formulas
```

### Row Identity Strategy
- **Email is the primary key.** Each unique email = one row.
- If a contact has no email (rare in calendar data), use normalized full name as fallback key.
- Contacts with neither email nor name are logged as warnings and skipped.

### Protecting Manual Data
The script explicitly reads columns C (Company), D (City), E (Role), and N (Status/Notes) before any write operation. On update, it writes ONLY to auto-populated columns (A, B, F, G, H, I, K, L, M, O). Manual columns are never in the write range.

---

## E. UX and Product Decisions

### Why CITY and ROLE are the only manual fields

**City** cannot be reliably inferred from calendar data. Calendar events may have locations, but they reflect where the meeting happened, not where the person is based. A VC in SF can take a Zoom call that shows no location. Only the user knows.

**Role** is a subjective classification. The same person could be a "Founder" or a "VC" depending on context. Calendar data has no signal for this. Only the user knows.

**Company** is borderline automatable. Email domains sometimes reveal company (e.g., @sequoia.com), but many people use Gmail, and company affiliation changes. We make it manual-optional because inferring it wrong is worse than leaving it blank.

**Everything else** — name, email, meeting dates, frequency, meeting titles — comes directly from calendar data with high confidence. No reason to make the user type it.

### Why derived views (not manual tabs)
City and role tabs use QUERY formulas pointing at the Master CRM. This means:
- Zero maintenance. Add a city tag on Master CRM → person appears in city tab instantly.
- No sync issues. There's one source of truth.
- No stale data. Tabs always reflect current Master CRM state.

### Why formulas over script for views
QUERY formulas are instant, require no triggers, and survive sheet edits gracefully. Using Apps Script to copy data into city/role tabs would create sync lag and potential data inconsistency.

---

## F. Apps Script Implementation Plan

### File Structure

```
Code.gs          — Main entry point, menu, triggers
CalendarSync.gs  — Calendar fetching and event parsing
ContactManager.gs — Deduplication, normalization, merge logic
SheetManager.gs  — Reading/writing to sheets, tab management
Dashboard.gs     — Dashboard refresh logic
Config.gs        — Settings reader, constants
Utils.gs         — Helper functions (name normalization, date formatting)
Setup.gs         — First-time setup, initial sync, sheet creation
```

### Function Map

**Code.gs:**
- `onOpen()` — Adds custom menu: "SuperCRM" → "Run Full Sync", "Run Initial Import", "Setup Sheet"
- `runWeeklySync()` — Entry point for weekly trigger
- `runInitialImport()` — Entry point for first-time 12-month import
- `setupTriggers()` — Creates weekly time-driven trigger

**CalendarSync.gs:**
- `fetchCalendarEvents(startDate, endDate)` — Returns array of parsed event objects
- `parseEventAttendees(event, userEmail, excludeDomains)` — Returns array of attendee records
- `isInternalAttendee(email, excludeDomains)` — Checks if attendee should be excluded

**ContactManager.gs:**
- `buildContactMap(existingRows)` — Builds email → row lookup
- `normalizeEmail(email)` — Lowercase, trim
- `normalizeName(name)` — Lowercase, trim, remove extra spaces
- `mergeContact(existing, newData)` — Merges new event data into existing contact
- `createNewContact(attendeeData)` — Creates a new contact row array
- `detectDuplicates(contacts)` — Flags potential duplicates for review

**SheetManager.gs:**
- `getOrCreateSheet(name)` — Gets or creates a tab
- `readMasterCRM()` — Reads all data from Master CRM
- `writeMasterCRM(data)` — Writes updated data back
- `updateExistingRow(sheet, rowIndex, data)` — Updates only auto columns
- `appendNewRows(sheet, rows)` — Appends new contacts
- `logSync(stats)` — Writes to Sync Log

### Trigger Setup
```javascript
function setupTriggers() {
  // Delete existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Weekly sync: every Sunday at 2 AM
  ScriptApp.newTrigger('runWeeklySync')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(2)
    .create();
}
```

---

## G. Key Google Sheets Formulas

### Days Since Contact (Column I)
```
=IF(F2="", "", ROUND(TODAY()-F2, 0))
```

### Recency Status (Column J)
```
=IF(F2="", "Unknown",
  IF(TODAY()-F2 <= 30, "🟢 Active",
    IF(TODAY()-F2 <= 60, "🟡 Warm",
      IF(TODAY()-F2 <= 90, "🟠 Cooling",
        "🔴 Stale"))))
```

### Needs Review Flag (Column O)
```
=OR(A2="", B2="", LEN(A2)<3, ISNUMBER(SEARCH("@", A2)))
```

### Research Link (Column P)
```
=IF(A2="", "",
  HYPERLINK("https://www.perplexity.ai/search?q=" & ENCODEURL(A2 & IF(C2<>"", " " & C2, "") & " background"), "🔍 Research"))
```

### City Tab Query (e.g., NY tab)
```
=QUERY('Master CRM'!A:P,
  "SELECT A, B, C, E, F, I, J, G, P
   WHERE D = 'NY'
   ORDER BY F DESC
   LABEL A 'Name', B 'Email', C 'Company', E 'Role',
         F 'Last Contact', I 'Days Since', J 'Status',
         G 'Meetings', P 'Research'", 1)
```

### Role Tab Query (e.g., VCs tab)
```
=QUERY('Master CRM'!A:P,
  "SELECT A, B, C, D, F, I, J, G, P
   WHERE E = 'VCs'
   ORDER BY F DESC
   LABEL A 'Name', B 'Email', C 'Company', D 'City',
         F 'Last Contact', I 'Days Since', J 'Status',
         G 'Meetings', P 'Research'", 1)
```

### Dashboard: Total Contacts
```
=COUNTA('Master CRM'!A2:A) - COUNTBLANK('Master CRM'!A2:A)
```

### Dashboard: New This Week
```
=COUNTIFS('Master CRM'!H2:H, ">=" & TODAY()-7)
```

### Dashboard: Stale Contacts (90+ days)
```
=COUNTIFS('Master CRM'!I2:I, ">=90", 'Master CRM'!I2:I, "<>")
```

---

## H. Research Button Design

### Recommendation: Formula-Generated Perplexity Hyperlink (Column P)

**Why this is the best option:**

| Option | Pros | Cons |
|--------|------|------|
| Formula hyperlink | Zero setup, works everywhere, no permissions needed, instant | Static query, can't customize per-click |
| Apps Script button | Could do more complex queries | Requires authorization, slower, more fragile |
| Sidebar app | Rich UI | Over-engineered for this use case |
| Custom menu action | Could batch research | Overkill, breaks spreadsheet flow |

The formula hyperlink wins because:
1. **No extra permissions** — just a clickable link in each row.
2. **Always up to date** — recalculates if name/company changes.
3. **One click** — opens Perplexity in a new tab with a pre-filled query.
4. **Zero maintenance** — it's a formula, not code.

### Formula
```
=IF(A2="", "",
  HYPERLINK(
    "https://www.perplexity.ai/search?q=" &
    ENCODEURL(A2 & IF(C2<>"", " " & C2, "") & " background"),
    "🔍 Research"
  ))
```

This generates queries like:
- "Jane Smith Sequoia Capital background"
- "John Doe background" (if no company)

---

## I. Smart Product Features

### Included in V1

1. **Recency Status with color coding** — 🟢 Active (30d) / 🟡 Warm (60d) / 🟠 Cooling (90d) / 🔴 Stale (90+d)
2. **"New This Week" count** on Dashboard — Instantly see who's new in your network
3. **Needs Review flag** — Auto-flags contacts with missing name, missing email, or suspicious data
4. **Stale contact highlighting** — Conditional formatting turns stale rows red
5. **Meeting frequency indicator** — Contact Count column shows who you meet most
6. **Top Cities / Top Roles breakdown** — Dashboard shows network composition
7. **Research link on every row** — One-click Perplexity search
8. **Duplicate warning** — Sync process flags potential duplicates in Needs Review

### Deferred to V2
- Follow-up task management
- Email integration (Gmail thread linking)
- Automated company inference from email domain
- LinkedIn profile linking
- Intro pathway mapping ("who can intro me to X")

---

## J. Edge Cases and Constraints

| Edge Case | Handling |
|-----------|----------|
| Event with 20+ attendees | Flagged as "Group Event" in notes, all attendees still added but meeting title prefixed with [Group] |
| Only internal teammates | Filtered out if all attendees match exclude_domains |
| Recurring meetings | Each occurrence updates Last Contact; Contact Count increments per occurrence |
| Renamed events | New title captured on next sync via Most Recent Meeting |
| Missing attendee email | Row created with name only, Needs Review = TRUE |
| Same email, different display name | Email is primary key; display name updated to most recent |
| Same name, different emails | Treated as different people (conservative approach) |
| Person changes city/role | User updates manually; sync never overwrites |
| One person, multiple roles | Pick primary role; add note in Status/Notes. One row per person. |
| One person, multiple cities | Pick primary city. System supports only one per row. |
| Events with no attendees | Skipped unless title contains a clear person name (V2) |
| Apps Script 6-min execution limit | Initial import batches events in chunks; weekly sync processes only 9 days |
| Google Sheets row limit (10M cells) | Master CRM unlikely to exceed 5,000 contacts; well within limits |
| Rate limiting on Calendar API | Batch reads; Calendar API is generous for personal calendars |
