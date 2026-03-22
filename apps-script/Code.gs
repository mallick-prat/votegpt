/**
 * ═══════════════════════════════════════════════════════
 *  SuperCRM — Ultra-Personal Relationship Intelligence
 * ═══════════════════════════════════════════════════════
 *
 *  A spreadsheet-first CRM powered by Google Calendar.
 *  Auto-imports contacts from your meetings.
 *  You only tag: CITY, ROLE, maybe COMPANY.
 *  Everything else is automatic.
 *
 *  Setup: Run SuperCRM → Setup SuperCRM from the menu.
 *  Import: Run SuperCRM → Import Last 12 Months.
 *  Weekly sync runs automatically every Sunday at 2 AM.
 *
 * ═══════════════════════════════════════════════════════
 */

/**
 * Adds custom menu to the spreadsheet.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ SuperCRM')
    .addItem('🔧 Setup SuperCRM', 'setupSuperCRM')
    .addSeparator()
    .addItem('📥 Import Last 12 Months', 'runInitialImport')
    .addItem('🔄 Run Weekly Sync Now', 'runWeeklySync')
    .addSeparator()
    .addItem('📊 Rebuild Dashboard', 'buildDashboard')
    .addItem('🏙️ Rebuild City Tabs', 'buildCityTabs')
    .addItem('🏷️ Rebuild Role Tabs', 'buildRoleTabs')
    .addSeparator()
    .addItem('⏰ Setup Auto-Sync Trigger', 'setupTriggers')
    .addItem('❌ Remove All Triggers', 'removeAllTriggers')
    .addToUi();
}

/**
 * Initial import: pulls all calendar events from the past N months
 * and builds the Master CRM from scratch.
 *
 * WARNING: This clears existing auto-populated data in Master CRM.
 * Manual fields (Company, City, Role, Notes) are preserved if rows
 * already exist for those contacts.
 */
function runInitialImport() {
  const startTime = new Date();
  const ui = SpreadsheetApp.getUi();

  // Confirm with user
  const response = ui.alert(
    'Initial Import',
    'This will import all contacts from your Google Calendar for the past 12 months.\n\n' +
    'If you have existing contacts in the Master CRM, their City, Role, Company, and Notes will be preserved.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const settings = getSettings();

    if (!settings.user_email) {
      ui.alert('Error', 'Please set your email in the Settings tab first.', ui.ButtonSet.OK);
      return;
    }

    const excludeDomains = getExcludeDomains(settings);
    const lookbackMonths = Number(settings.lookback_months) || 12;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    Logger.log(`Starting initial import from ${formatDate(startDate)} to ${formatDate(endDate)}`);
    SpreadsheetApp.getActiveSpreadsheet().toast('Fetching calendar events...', 'SuperCRM', -1);

    // Fetch and parse events
    const events = fetchCalendarEvents(startDate, endDate);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Processing ${events.length} events...`, 'SuperCRM', -1
    );

    const interactions = parseAllAttendees(events, settings.user_email, excludeDomains);
    const aggregatedContacts = aggregateInteractions(interactions);

    // Check if Master CRM has existing manual data to preserve
    const existingData = readMasterCRM();
    let manualDataMap = new Map();

    if (existingData.length > 0) {
      // Build map of email → manual fields from existing data
      for (const row of existingData) {
        const email = normalizeEmail(row[COL.EMAIL]);
        if (email) {
          manualDataMap.set(email, {
            company: row[COL.COMPANY] || '',
            city: row[COL.CITY] || '',
            role: row[COL.ROLE] || '',
            notes: row[COL.STATUS_NOTES] || ''
          });
        }
      }
    }

    // Create new rows
    const newRows = initialImportContacts(aggregatedContacts);

    // Restore manual data where it existed before
    for (let i = 0; i < newRows.length; i++) {
      const email = normalizeEmail(newRows[i][COL.EMAIL]);
      if (email && manualDataMap.has(email)) {
        const manual = manualDataMap.get(email);
        newRows[i][COL.COMPANY] = manual.company;
        newRows[i][COL.CITY] = manual.city;
        newRows[i][COL.ROLE] = manual.role;
        newRows[i][COL.STATUS_NOTES] = manual.notes;
      }
    }

    // Write to sheet
    writeInitialMasterCRM(newRows);

    // Rebuild dashboard
    buildDashboard();

    // Log sync
    const duration = Math.round((new Date() - startTime) / 1000);
    logSync({
      eventsProcessed: events.length,
      added: newRows.length,
      updated: 0,
      errors: '',
      duration: duration
    });

    // Clean up default sheet
    cleanupDefaultSheet();

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Import complete! ${newRows.length} contacts from ${events.length} events.`,
      'SuperCRM', 10
    );

    ui.alert(
      'Import Complete!',
      `Imported ${newRows.length} contacts from ${events.length} calendar events.\n\n` +
      `Duration: ${duration} seconds.\n\n` +
      'Next steps:\n' +
      '1. Review the Master CRM tab\n' +
      '2. Tag contacts with CITY and ROLE\n' +
      '3. Optionally add COMPANY\n' +
      '4. Check the Dashboard for your network overview',
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log(`Initial import error: ${error.message}\n${error.stack}`);
    logSync({
      eventsProcessed: 0,
      added: 0,
      updated: 0,
      errors: error.message,
      duration: Math.round((new Date() - startTime) / 1000)
    });
    ui.alert('Error', `Import failed: ${error.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Weekly incremental sync.
 * Pulls events from the past 9 days (7 + 2 buffer) and merges into existing CRM.
 * This is designed to be run by a time-driven trigger.
 */
function runWeeklySync() {
  const startTime = new Date();

  try {
    const settings = getSettings();

    if (!settings.user_email) {
      Logger.log('Weekly sync aborted: no user_email in Settings');
      return;
    }

    const excludeDomains = getExcludeDomains(settings);

    // 9-day lookback: 7 days + 2 day buffer for late edits
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 9);

    Logger.log(`Starting weekly sync from ${formatDate(startDate)} to ${formatDate(endDate)}`);

    // Fetch and parse events
    const events = fetchCalendarEvents(startDate, endDate);
    const interactions = parseAllAttendees(events, settings.user_email, excludeDomains);
    const aggregatedContacts = aggregateInteractions(interactions);

    // Read existing data
    const existingData = readMasterCRM();

    if (existingData.length === 0 && aggregatedContacts.size === 0) {
      Logger.log('Weekly sync: no existing data and no new contacts. Skipping.');
      return;
    }

    // Merge
    const { updatedData, newRows, stats } = mergeContacts(existingData, aggregatedContacts);

    // Write back
    if (stats.updated > 0 || stats.added > 0) {
      writeMasterCRM(updatedData, newRows);

      // Re-apply formatting if new rows were added
      if (newRows.length > 0) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER);
        const totalRows = sheet.getLastRow() - 1;
        formatMasterCRM(sheet, totalRows);
      }
    }

    // Log
    const duration = Math.round((new Date() - startTime) / 1000);
    logSync({
      eventsProcessed: events.length,
      added: stats.added,
      updated: stats.updated,
      errors: '',
      duration: duration
    });

    Logger.log(`Weekly sync complete: ${stats.added} added, ${stats.updated} updated in ${duration}s`);

    // Toast if user is viewing the sheet
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Sync complete: ${stats.added} new, ${stats.updated} updated`,
        'SuperCRM', 5
      );
    } catch (e) {
      // Toast may fail if sheet isn't open — that's fine
    }

  } catch (error) {
    Logger.log(`Weekly sync error: ${error.message}\n${error.stack}`);
    logSync({
      eventsProcessed: 0,
      added: 0,
      updated: 0,
      errors: error.message,
      duration: Math.round((new Date() - startTime) / 1000)
    });
  }
}

/**
 * Sets up the weekly time-driven trigger.
 */
function setupTriggers() {
  // Remove existing SuperCRM triggers to avoid duplicates
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of existingTriggers) {
    if (trigger.getHandlerFunction() === 'runWeeklySync') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create weekly trigger: Sunday at 2 AM
  ScriptApp.newTrigger('runWeeklySync')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(2)
    .create();

  // Also create the onOpen trigger if it doesn't exist
  let hasOnOpen = false;
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === 'onOpen') {
      hasOnOpen = true;
      break;
    }
  }
  if (!hasOnOpen) {
    ScriptApp.newTrigger('onOpen')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onOpen()
      .create();
  }

  Logger.log('Triggers configured: weekly sync on Sunday at 2 AM');

  try {
    SpreadsheetApp.getUi().alert(
      'Triggers Set',
      'Weekly auto-sync is configured for every Sunday at 2 AM.\n' +
      'The SuperCRM menu will appear when you open the spreadsheet.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // May fail if called from trigger context
  }
}

/**
 * Removes all project triggers (useful for cleanup/debugging).
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  Logger.log(`Removed ${triggers.length} triggers`);

  try {
    SpreadsheetApp.getUi().alert(
      'Triggers Removed',
      `Removed ${triggers.length} trigger(s). Weekly auto-sync is now disabled.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // May fail if called from trigger context
  }
}
