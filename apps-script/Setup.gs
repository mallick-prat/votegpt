/**
 * SuperCRM Setup
 * First-time setup: creates all sheets, sets headers, builds structure.
 */

/**
 * Full first-time setup. Creates all tabs and structure.
 * Run this once when setting up the CRM.
 */
function setupSuperCRM() {
  const ui = SpreadsheetApp.getUi();

  ui.alert(
    'SuperCRM Setup',
    'This will set up your SuperCRM with all required tabs.\n\n' +
    'Make sure you have set your email in the Settings tab after setup.\n\n' +
    'Click OK to proceed.',
    ui.ButtonSet.OK_CANCEL
  );

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Create Settings tab first
  setupSettingsTab();

  // 2. Create Master CRM with headers
  setupMasterCRMTab();

  // 3. Create Sync Log
  setupSyncLogTab();

  // 4. Build Dashboard
  buildDashboard();

  // 5. Build City tabs
  buildCityTabs();

  // 6. Build Role tabs
  buildRoleTabs();

  // 7. Reorder tabs
  reorderTabs();

  // 8. Set up triggers
  setupTriggers();

  ui.alert(
    'Setup Complete!',
    'SuperCRM is ready. Next steps:\n\n' +
    '1. Go to the Settings tab and enter your email address\n' +
    '2. Add any domains you want to exclude (e.g., your company domain)\n' +
    '3. Run "SuperCRM → Import Last 12 Months" to populate your CRM\n' +
    '4. Tag contacts with CITY and ROLE in the Master CRM tab\n\n' +
    'Weekly auto-sync is now active (runs every Sunday at 2 AM).',
    ui.ButtonSet.OK
  );
}

/**
 * Creates and populates the Settings tab.
 */
function setupSettingsTab() {
  const sheet = getOrCreateSheet(SHEET_SETTINGS);
  sheet.clear();

  const headers = ['Setting', 'Value', 'Description'];
  sheet.getRange(1, 1, 1, 3).setValues([headers]);
  formatHeaderRow(sheet);

  const settings = [
    ['user_email', Session.getActiveUser().getEmail() || '', 'Your Google Calendar email (to exclude yourself from attendees)'],
    ['exclude_domains', '', 'Comma-separated domains to exclude (e.g., yourcompany.com,gmail.com)'],
    ['stale_threshold_days', 90, 'Days after which a contact is considered stale'],
    ['cooling_threshold_days', 60, 'Days after which a contact is considered cooling'],
    ['warm_threshold_days', 30, 'Days after which a contact transitions from active to warm'],
    ['lookback_months', 12, 'Number of months to look back on initial import'],
    ['min_attendees_for_group', 8, 'Events with this many+ external attendees are flagged as group events'],
  ];

  sheet.getRange(2, 1, settings.length, 3).setValues(settings);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidth(3, 400);

  // Protect settings descriptions
  sheet.getRange(2, 3, settings.length, 1).setFontColor('#888888').setFontStyle('italic');
}

/**
 * Creates the Master CRM tab with headers and formatting.
 */
function setupMasterCRMTab() {
  const sheet = getOrCreateSheet(SHEET_MASTER);
  sheet.clear();

  // Set headers
  sheet.getRange(1, 1, 1, TOTAL_COLUMNS).setValues([MASTER_HEADERS]);
  formatHeaderRow(sheet);

  // Set column widths
  const widths = [180, 220, 150, 70, 180, 110, 50, 110, 60, 110, 220, 250, 120, 200, 80, 100];
  for (let i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i]);
  }

  // Freeze first row
  sheet.setFrozenRows(1);

  Logger.log('Master CRM tab created');
}

/**
 * Creates the Sync Log tab.
 */
function setupSyncLogTab() {
  const sheet = getOrCreateSheet(SHEET_SYNC_LOG);
  sheet.clear();

  const headers = [
    'Sync Timestamp',
    'Events Processed',
    'New Contacts Added',
    'Contacts Updated',
    'Errors / Warnings',
    'Duration (seconds)'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet);

  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 250);
  sheet.setColumnWidth(6, 130);
}

/**
 * Reorders tabs in a logical order:
 * Dashboard, Master CRM, Cities, Roles, Settings, Sync Log
 */
function reorderTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const desiredOrder = [
    SHEET_DASHBOARD,
    SHEET_MASTER,
    ...CITY_TABS,
    ...ROLE_TABS,
    SHEET_SETTINGS,
    SHEET_SYNC_LOG
  ];

  for (let i = 0; i < desiredOrder.length; i++) {
    const sheet = ss.getSheetByName(desiredOrder[i]);
    if (sheet) {
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(i + 1);
    }
  }

  // Activate Master CRM as default view
  const masterSheet = ss.getSheetByName(SHEET_MASTER);
  if (masterSheet) {
    ss.setActiveSheet(masterSheet);
  }
}

/**
 * Removes default "Sheet1" if it exists and is empty.
 */
function cleanupDefaultSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    if (defaultSheet.getLastRow() <= 1 && defaultSheet.getLastColumn() <= 1) {
      ss.deleteSheet(defaultSheet);
    }
  }
}
