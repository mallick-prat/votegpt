# SuperCRM Setup Guide

## Quick Start (5 minutes)

### Step 1: Create the Google Sheet
1. Go to [sheets.new](https://sheets.new) to create a new Google Sheet
2. Name it **"SuperCRM"** (or whatever you prefer)

### Step 2: Add the Apps Script
1. In your new sheet, go to **Extensions → Apps Script**
2. This opens the Apps Script editor in a new tab
3. Delete any existing code in `Code.gs`
4. Create the following files by clicking **+** next to "Files" in the left sidebar:

| File to Create | Copy From |
|---------------|-----------|
| `Code.gs` | `apps-script/Code.gs` |
| `Config.gs` | `apps-script/Config.gs` |
| `Utils.gs` | `apps-script/Utils.gs` |
| `CalendarSync.gs` | `apps-script/CalendarSync.gs` |
| `ContactManager.gs` | `apps-script/ContactManager.gs` |
| `SheetManager.gs` | `apps-script/SheetManager.gs` |
| `Dashboard.gs` | `apps-script/Dashboard.gs` |
| `Setup.gs` | `apps-script/Setup.gs` |

5. Also update `appsscript.json`:
   - Click the gear icon (⚙️ Project Settings) in the left sidebar
   - Check **"Show 'appsscript.json' manifest file in editor"**
   - Go back to the editor, click `appsscript.json`
   - Replace its contents with the provided `appsscript.json`

6. **Save all files** (Ctrl+S / Cmd+S)

### Step 3: Run Setup
1. Go back to your Google Sheet (close the Apps Script tab or switch tabs)
2. **Reload the page** — you should see a **"⚡ SuperCRM"** menu appear in the menu bar
   - If it doesn't appear immediately, wait 5-10 seconds and refresh again
3. Click **⚡ SuperCRM → 🔧 Setup SuperCRM**
4. Google will ask you to authorize the script:
   - Click **Review Permissions**
   - Choose your Google account
   - Click **Advanced → Go to SuperCRM (unsafe)** (this is normal for personal scripts)
   - Click **Allow**
5. Setup will create all tabs and configure your sheet

### Step 4: Configure Settings
1. Go to the **Settings** tab
2. Verify your email is correct in the `user_email` row
3. **Important:** Add your company domain(s) to `exclude_domains` if you want to exclude coworkers
   - Example: `mycompany.com,mycompany.io`
   - This prevents every internal teammate from being added to your CRM

### Step 5: Import Your Calendar
1. Click **⚡ SuperCRM → 📥 Import Last 12 Months**
2. Wait for it to complete (may take 1-3 minutes depending on calendar volume)
3. Your Master CRM will populate with all external contacts from your calendar

### Step 6: Tag Your Contacts
1. Go to the **Master CRM** tab
2. For each contact, fill in:
   - **City** (column D): Select from dropdown — NY, SF, BOSTON, AUSTIN, LA, DC
   - **Role** (column E): Select from dropdown — VCs, Founders, Angel Investors, etc.
   - **Company** (column C): Optionally type their company
3. As you tag contacts, they'll automatically appear in the corresponding city and role tabs

### Step 7: You're Done!
- The weekly auto-sync runs every **Sunday at 2 AM** automatically
- New contacts from your calendar will be added
- Existing contacts will have their Last Contact updated
- Your City, Role, Company, and Notes are **never** overwritten

---

## Daily Usage

### What to do each week
1. **Open the Dashboard tab** — see your network overview
2. **Check Master CRM** — look for contacts with empty City/Role (sort by those columns)
3. **Research contacts** — click the 🔍 Research link in column P to open Perplexity
4. **Review stale contacts** — sort by "Days Since Contact" to find people to reconnect with

### What NOT to do
- Don't manually add contacts (let the calendar sync handle it)
- Don't edit columns A, B, F, G, H, K, L, M (these are auto-populated)
- Don't modify the city or role tabs directly (they're formula-driven views)
- Don't delete the Settings or Sync Log tabs

### Manual overrides
If you want to manually add someone who isn't in your calendar:
1. Go to the bottom of the Master CRM tab
2. Type their name in column A, email in column B
3. Add City, Role, Company
4. The formulas in columns I, J, O, P will auto-populate
5. Set Source (column M) to "Manual" to distinguish from calendar imports

---

## Understanding the Tabs

| Tab | Purpose | User Action |
|-----|---------|-------------|
| **Dashboard** | Network overview, metrics, top contacts | Read only |
| **Master CRM** | Single source of truth for all contacts | Edit City, Role, Company, Notes |
| **NY, SF, etc.** | Filtered view of contacts by city | Read only (auto-populated) |
| **VCs, Founders, etc.** | Filtered view of contacts by role | Read only (auto-populated) |
| **Settings** | Configuration for sync behavior | Edit settings as needed |
| **Sync Log** | History of all sync operations | Read only (diagnostic) |

---

## Understanding the Columns

### Auto-populated (don't edit these)
- **Full Name** (A): From calendar attendee data
- **Email** (B): From calendar attendee data
- **Last Contact** (F): Date of most recent meeting
- **Contact Count** (G): Total number of meetings
- **First Contact** (H): Date of first meeting
- **Days Since Contact** (I): Formula: TODAY() - Last Contact
- **Recency Status** (J): 🟢 Active / 🟡 Warm / 🟠 Cooling / 🔴 Stale
- **Most Recent Meeting** (K): Title of last calendar event
- **Meeting Notes Snippet** (L): First 200 chars of event description
- **Source** (M): "Google Calendar" or "Manual"
- **Needs Review** (O): TRUE if name/email is missing or suspicious
- **Research** (P): Click to search this person on Perplexity

### User-editable
- **Company** (C): Type the person's company
- **City** (D): Select from dropdown (NY, SF, BOSTON, AUSTIN, LA, DC)
- **Role** (E): Select from dropdown (VCs, Founders, Angel Investors, etc.)
- **Status / Notes** (N): Freeform notes about this person

---

## Troubleshooting

### Menu doesn't appear
- Refresh the page. The menu loads via the `onOpen` trigger.
- If still missing: Extensions → Apps Script → Run `onOpen` manually.

### Import takes too long
- The 12-month import processes all calendar events. If you have thousands of events, it may take 3-5 minutes.
- Google Apps Script has a 6-minute execution limit. If you hit this, reduce `lookback_months` in Settings to 6, import, then increase back to 12 for a second run.

### Duplicate contacts
- The system deduplicates by email. If someone uses multiple emails, they'll appear as separate contacts.
- To merge: keep the row you prefer, delete the other, and the sync won't recreate it (unless a new meeting occurs with that email).

### Missing contacts
- Contacts only appear if they're listed as attendees on your calendar events.
- 1:1 phone calls or meetings without calendar invites won't be captured.
- Check that the person's email isn't in your `exclude_domains` list.

### Weekly sync didn't run
- Check the Sync Log tab for the last sync timestamp.
- Run ⚡ SuperCRM → ⏰ Setup Auto-Sync Trigger to re-create the trigger.
- Triggers can be disrupted by Google Workspace admin policies or script quota limits.

### Formulas broken in city/role tabs
- Run ⚡ SuperCRM → 🏙️ Rebuild City Tabs or 🏷️ Rebuild Role Tabs.

---

## Admin Notes

### Performance
- Master CRM handles up to ~5,000 contacts without performance issues
- QUERY formulas in derived tabs are efficient up to ~10,000 rows
- Weekly sync processes ~100-500 events in under 30 seconds typically
- Initial import of 12 months may process 1,000-5,000 events

### Quotas
- Google Apps Script: 6-minute execution limit per run
- Google Calendar API: 50,000 queries per day (more than enough)
- Google Sheets: 10 million cells per workbook

### Backup
- Google Sheets auto-saves and has version history (File → Version History)
- Consider making a weekly backup copy: File → Make a Copy

### Extending the System
- To add new cities: Update `CITY_TABS` in `Config.gs` and re-run Setup
- To add new roles: Update `ROLE_TABS` in `Config.gs` and re-run Setup
- To change thresholds: Update values in the Settings tab
- To change sync frequency: Modify `setupTriggers()` in `Code.gs`

### Privacy
- The script only reads YOUR calendar (default calendar)
- It runs under YOUR Google account permissions
- No data leaves Google's ecosystem
- The script has read-only access to Calendar and read-write access to this specific spreadsheet only
