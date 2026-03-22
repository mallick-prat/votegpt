/**
 * SuperCRM Sheet Manager
 * Handles all read/write operations to Google Sheets.
 */

/**
 * Gets or creates a sheet by name.
 */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Reads all data from Master CRM (excluding header row).
 * Returns a 2D array.
 */
function readMasterCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_MASTER);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // Only header or empty

  const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS).getValues();
  return data;
}

/**
 * Writes the complete Master CRM data back to the sheet.
 * Preserves header row. Handles formulas for formula columns.
 *
 * @param {Array<Array>} existingData - Updated existing rows
 * @param {Array<Array>} newRows - New rows to append
 */
function writeMasterCRM(existingData, newRows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_MASTER);

  // Write updated existing rows (only auto-populated columns)
  if (existingData.length > 0) {
    for (let i = 0; i < existingData.length; i++) {
      const rowNum = i + 2; // 1-based, skip header
      const row = existingData[i];

      // Write only the auto-populated columns to avoid overwriting formulas and manual data
      // A: Full Name
      sheet.getRange(rowNum, COL.FULL_NAME + 1).setValue(row[COL.FULL_NAME]);
      // B: Email
      sheet.getRange(rowNum, COL.EMAIL + 1).setValue(row[COL.EMAIL]);
      // F: Last Contact
      sheet.getRange(rowNum, COL.LAST_CONTACT + 1).setValue(row[COL.LAST_CONTACT]);
      // G: Contact Count
      sheet.getRange(rowNum, COL.CONTACT_COUNT + 1).setValue(row[COL.CONTACT_COUNT]);
      // H: First Contact
      sheet.getRange(rowNum, COL.FIRST_CONTACT + 1).setValue(row[COL.FIRST_CONTACT]);
      // K: Most Recent Meeting
      sheet.getRange(rowNum, COL.RECENT_MEETING + 1).setValue(row[COL.RECENT_MEETING]);
      // L: Meeting Notes Snippet
      sheet.getRange(rowNum, COL.MEETING_NOTES + 1).setValue(row[COL.MEETING_NOTES]);
      // M: Source
      sheet.getRange(rowNum, COL.SOURCE + 1).setValue(row[COL.SOURCE]);
    }
  }

  // Append new rows
  if (newRows.length > 0) {
    const startRow = sheet.getLastRow() + 1;

    // Write data values first
    const dataRange = sheet.getRange(startRow, 1, newRows.length, TOTAL_COLUMNS);
    dataRange.setValues(newRows);

    // Now set formulas for formula columns on each new row
    for (let i = 0; i < newRows.length; i++) {
      const rowNum = startRow + i;
      setRowFormulas(sheet, rowNum);
    }
  }
}

/**
 * Writes the Master CRM for initial import (from scratch).
 * Clears existing data and writes everything fresh.
 */
function writeInitialMasterCRM(rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(SHEET_MASTER);

  // Clear everything below header
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, TOTAL_COLUMNS).clear();
  }

  // Set header if not present
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== MASTER_HEADERS[0]) {
    sheet.getRange(1, 1, 1, TOTAL_COLUMNS).setValues([MASTER_HEADERS]);
    formatHeaderRow(sheet);
  }

  if (rows.length === 0) return;

  // Write all data
  const startRow = 2;
  sheet.getRange(startRow, 1, rows.length, TOTAL_COLUMNS).setValues(rows);

  // Set formulas for all rows
  for (let i = 0; i < rows.length; i++) {
    setRowFormulas(sheet, startRow + i);
  }

  // Apply formatting
  formatMasterCRM(sheet, rows.length);
}

/**
 * Sets formula-driven columns for a specific row.
 */
function setRowFormulas(sheet, rowNum) {
  const formulas = getRowFormulas(rowNum);

  for (const [colIdx, formula] of Object.entries(formulas)) {
    sheet.getRange(rowNum, Number(colIdx) + 1).setFormula(formula);
  }
}

/**
 * Formats the header row of any sheet.
 */
function formatHeaderRow(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a1a2e');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

/**
 * Applies formatting to the Master CRM sheet.
 */
function formatMasterCRM(sheet, rowCount) {
  if (rowCount === 0) return;

  // Column widths
  const widths = {
    1: 180,  // Full Name
    2: 220,  // Email
    3: 150,  // Company
    4: 70,   // City
    5: 180,  // Role
    6: 110,  // Last Contact
    7: 50,   // Contact Count
    8: 110,  // First Contact
    9: 60,   // Days Since
    10: 110, // Recency Status
    11: 220, // Most Recent Meeting
    12: 250, // Meeting Notes
    13: 120, // Source
    14: 200, // Status/Notes
    15: 80,  // Needs Review
    16: 100  // Research
  };

  for (const [col, width] of Object.entries(widths)) {
    sheet.setColumnWidth(Number(col), width);
  }

  // Data validation for City column (D)
  const cityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CITY_TABS, true)
    .setAllowInvalid(true) // Allow custom cities too
    .build();
  sheet.getRange(2, COL.CITY + 1, rowCount, 1).setDataValidation(cityRule);

  // Data validation for Role column (E)
  const roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ROLE_TABS, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, COL.ROLE + 1, rowCount, 1).setDataValidation(roleRule);

  // Date formatting for date columns
  sheet.getRange(2, COL.LAST_CONTACT + 1, rowCount, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, COL.FIRST_CONTACT + 1, rowCount, 1).setNumberFormat('yyyy-mm-dd');

  // Conditional formatting: highlight stale contacts
  const staleRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(90)
    .setBackground('#fce4ec') // Light red
    .setRanges([sheet.getRange(2, COL.DAYS_SINCE + 1, rowCount, 1)])
    .build();

  const coolingRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberBetween(60, 89)
    .setBackground('#fff3e0') // Light orange
    .setRanges([sheet.getRange(2, COL.DAYS_SINCE + 1, rowCount, 1)])
    .build();

  const activeRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThanOrEqualTo(30)
    .setBackground('#e8f5e9') // Light green
    .setRanges([sheet.getRange(2, COL.DAYS_SINCE + 1, rowCount, 1)])
    .build();

  const rules = sheet.getConditionalFormatRules();
  rules.push(staleRule, coolingRule, activeRule);
  sheet.setConditionalFormatRules(rules);

  // Highlight manual columns with subtle background
  const manualBg = '#f5f5f5';
  sheet.getRange(2, COL.COMPANY + 1, rowCount, 1).setBackground(manualBg);
  sheet.getRange(2, COL.CITY + 1, rowCount, 1).setBackground(manualBg);
  sheet.getRange(2, COL.ROLE + 1, rowCount, 1).setBackground(manualBg);
  sheet.getRange(2, COL.STATUS_NOTES + 1, rowCount, 1).setBackground(manualBg);
}

/**
 * Logs sync results to the Sync Log tab.
 */
function logSync(stats) {
  const sheet = getOrCreateSheet(SHEET_SYNC_LOG);

  // Set headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 6).setValues([[
      'Sync Timestamp',
      'Events Processed',
      'New Contacts Added',
      'Contacts Updated',
      'Errors / Warnings',
      'Duration (seconds)'
    ]]);
    formatHeaderRow(sheet);
  }

  sheet.appendRow([
    new Date(),
    stats.eventsProcessed || 0,
    stats.added || 0,
    stats.updated || 0,
    stats.errors || '',
    stats.duration || 0
  ]);
}
