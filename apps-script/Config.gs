/**
 * SuperCRM Configuration
 * Central configuration constants and settings reader.
 */

// Sheet names
const SHEET_MASTER = 'Master CRM';
const SHEET_DASHBOARD = 'Dashboard';
const SHEET_SETTINGS = 'Settings';
const SHEET_SYNC_LOG = 'Sync Log';

// City tabs
const CITY_TABS = ['NY', 'SF', 'BOSTON', 'AUSTIN', 'LA', 'DC'];

// Role tabs
const ROLE_TABS = [
  'VCs',
  'Founders',
  'Angel Investors',
  'Celebrities & Influencers',
  'Politicians',
  'Misc',
  'LPs & Family Offices',
  'Service Providers',
  'Press & Content'
];

// Master CRM column indices (0-based)
const COL = {
  FULL_NAME: 0,        // A
  EMAIL: 1,            // B
  COMPANY: 2,          // C - MANUAL
  CITY: 3,             // D - MANUAL
  ROLE: 4,             // E - MANUAL
  LAST_CONTACT: 5,     // F
  CONTACT_COUNT: 6,    // G
  FIRST_CONTACT: 7,    // H
  DAYS_SINCE: 8,       // I - FORMULA
  RECENCY_STATUS: 9,   // J - FORMULA
  RECENT_MEETING: 10,  // K
  MEETING_NOTES: 11,   // L
  SOURCE: 12,          // M
  STATUS_NOTES: 13,    // N - MANUAL
  NEEDS_REVIEW: 14,    // O - FORMULA
  RESEARCH: 15         // P - FORMULA
};

// Columns that are MANUAL and must never be overwritten by sync
const MANUAL_COLUMNS = [COL.COMPANY, COL.CITY, COL.ROLE, COL.STATUS_NOTES];

// Columns that are FORMULA-driven (set once on row creation, then formulas handle it)
const FORMULA_COLUMNS = [COL.DAYS_SINCE, COL.RECENCY_STATUS, COL.NEEDS_REVIEW, COL.RESEARCH];

// Total number of columns in Master CRM
const TOTAL_COLUMNS = 16;

// Master CRM headers
const MASTER_HEADERS = [
  'Full Name',
  'Email',
  'Company',
  'City',
  'Role',
  'Last Contact',
  'Contact Count',
  'First Contact',
  'Days Since Contact',
  'Recency Status',
  'Most Recent Meeting',
  'Meeting Notes Snippet',
  'Source',
  'Status / Notes',
  'Needs Review',
  'Research'
];

// Default settings
const DEFAULT_SETTINGS = {
  user_email: '',
  exclude_domains: '',
  stale_threshold_days: 90,
  cooling_threshold_days: 60,
  warm_threshold_days: 30,
  lookback_months: 12,
  min_attendees_for_group: 8
};

/**
 * Reads all settings from the Settings tab into an object.
 */
function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!settingsSheet) {
    return DEFAULT_SETTINGS;
  }

  const data = settingsSheet.getDataRange().getValues();
  const settings = Object.assign({}, DEFAULT_SETTINGS);

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const value = data[i][1];
    if (key && key in DEFAULT_SETTINGS) {
      settings[key] = value;
    }
  }

  // Ensure user_email is set
  if (!settings.user_email) {
    settings.user_email = Session.getActiveUser().getEmail();
  }

  return settings;
}

/**
 * Parses the exclude_domains setting into an array.
 */
function getExcludeDomains(settings) {
  if (!settings.exclude_domains) return [];
  return String(settings.exclude_domains)
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(d => d.length > 0);
}
