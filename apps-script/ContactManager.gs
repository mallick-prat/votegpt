/**
 * SuperCRM Contact Manager
 * Deduplication, merge logic, and contact normalization.
 */

/**
 * Builds a lookup map from existing Master CRM data.
 * Returns { emailMap: Map<email, rowIndex>, nameMap: Map<normalizedName, rowIndex> }
 *
 * @param {Array<Array>} existingData - 2D array from Master CRM (excluding header)
 * @returns {Object} Lookup maps
 */
function buildContactLookup(existingData) {
  const emailMap = new Map();
  const nameMap = new Map();

  for (let i = 0; i < existingData.length; i++) {
    const row = existingData[i];
    const email = normalizeEmail(row[COL.EMAIL]);
    const name = normalizeName(row[COL.FULL_NAME]);

    if (email) {
      emailMap.set(email, i);
    }
    if (name) {
      // Only use name map for rows WITHOUT an email (to avoid false matches)
      if (!email) {
        nameMap.set(name, i);
      }
    }
  }

  return { emailMap, nameMap };
}

/**
 * Merges new calendar data into existing Master CRM data.
 * Returns the updated data array plus stats.
 *
 * CRITICAL: Never overwrites MANUAL columns (Company, City, Role, Status/Notes).
 *
 * @param {Array<Array>} existingData - Current Master CRM rows (excluding header)
 * @param {Map<string, Object>} newContacts - Aggregated contact data from calendar
 * @returns {Object} { updatedData, newRows, stats }
 */
function mergeContacts(existingData, newContacts) {
  const lookup = buildContactLookup(existingData);
  const stats = {
    updated: 0,
    added: 0,
    skipped: 0
  };

  // Clone existing data to avoid mutations
  const updatedData = existingData.map(row => [...row]);
  const newRows = [];

  for (const [email, contact] of newContacts) {
    // Strategy 1: Exact email match
    if (lookup.emailMap.has(email)) {
      const rowIdx = lookup.emailMap.get(email);
      const existingRow = updatedData[rowIdx];

      // Update ONLY auto-populated fields
      // Update name if current one is better
      if (contact.name && (
        !existingRow[COL.FULL_NAME] ||
        contact.name.length > String(existingRow[COL.FULL_NAME]).length
      )) {
        updatedData[rowIdx][COL.FULL_NAME] = contact.name;
      }

      // Update Last Contact if newer
      const existingLastContact = existingRow[COL.LAST_CONTACT];
      if (contact.lastContact &&
          (!existingLastContact || contact.lastContact > new Date(existingLastContact))) {
        updatedData[rowIdx][COL.LAST_CONTACT] = contact.lastContact;
        updatedData[rowIdx][COL.RECENT_MEETING] = contact.recentMeetingTitle;
        updatedData[rowIdx][COL.MEETING_NOTES] = contact.meetingNotesSnippet;
      }

      // Update First Contact if earlier
      const existingFirstContact = existingRow[COL.FIRST_CONTACT];
      if (contact.firstContact &&
          (!existingFirstContact || contact.firstContact < new Date(existingFirstContact))) {
        updatedData[rowIdx][COL.FIRST_CONTACT] = contact.firstContact;
      }

      // Update Contact Count (add new meetings to existing count)
      const existingCount = Number(existingRow[COL.CONTACT_COUNT]) || 0;
      updatedData[rowIdx][COL.CONTACT_COUNT] = existingCount + contact.contactCount;

      // NEVER touch: Company (2), City (3), Role (4), Status/Notes (13)

      stats.updated++;
      continue;
    }

    // Strategy 2: Name-based match (only for contacts without email in existing data)
    const normalizedNewName = normalizeName(contact.name);
    if (normalizedNewName && lookup.nameMap.has(normalizedNewName)) {
      const rowIdx = lookup.nameMap.get(normalizedNewName);
      const existingRow = updatedData[rowIdx];

      // Merge: add the email to the existing row (it was missing)
      if (!existingRow[COL.EMAIL] && email) {
        updatedData[rowIdx][COL.EMAIL] = email;
      }

      // Update dates and counts as above
      const existingLastContact = existingRow[COL.LAST_CONTACT];
      if (contact.lastContact &&
          (!existingLastContact || contact.lastContact > new Date(existingLastContact))) {
        updatedData[rowIdx][COL.LAST_CONTACT] = contact.lastContact;
        updatedData[rowIdx][COL.RECENT_MEETING] = contact.recentMeetingTitle;
        updatedData[rowIdx][COL.MEETING_NOTES] = contact.meetingNotesSnippet;
      }

      const existingFirstContact = existingRow[COL.FIRST_CONTACT];
      if (contact.firstContact &&
          (!existingFirstContact || contact.firstContact < new Date(existingFirstContact))) {
        updatedData[rowIdx][COL.FIRST_CONTACT] = contact.firstContact;
      }

      const existingCount = Number(existingRow[COL.CONTACT_COUNT]) || 0;
      updatedData[rowIdx][COL.CONTACT_COUNT] = existingCount + contact.contactCount;

      stats.updated++;
      continue;
    }

    // Strategy 3: New contact — add new row
    const newRow = createNewContactRow(contact);
    newRows.push(newRow);
    stats.added++;
  }

  Logger.log(`Merge complete: ${stats.updated} updated, ${stats.added} added, ${stats.skipped} skipped`);
  return { updatedData, newRows, stats };
}

/**
 * Creates a new Master CRM row array from aggregated contact data.
 * Formula columns are left as empty strings — they'll be filled by setRowFormulas().
 */
function createNewContactRow(contact) {
  const row = new Array(TOTAL_COLUMNS).fill('');

  row[COL.FULL_NAME] = contact.name || '';
  row[COL.EMAIL] = contact.email || '';
  // Company, City, Role left blank for user
  row[COL.LAST_CONTACT] = contact.lastContact || '';
  row[COL.CONTACT_COUNT] = contact.contactCount || 1;
  row[COL.FIRST_CONTACT] = contact.firstContact || '';
  // Days Since Contact — FORMULA (set later)
  // Recency Status — FORMULA (set later)
  row[COL.RECENT_MEETING] = contact.recentMeetingTitle || '';
  row[COL.MEETING_NOTES] = contact.meetingNotesSnippet || '';
  row[COL.SOURCE] = contact.source || 'Google Calendar';
  // Status/Notes left blank for user
  // Needs Review — FORMULA (set later)
  // Research — FORMULA (set later)

  return row;
}

/**
 * For an initial import, handles the special case where Contact Count
 * should NOT be additive (since we're importing everything at once).
 * This is the same as mergeContacts but designed for first run.
 */
function initialImportContacts(newContacts) {
  const rows = [];

  for (const [email, contact] of newContacts) {
    rows.push(createNewContactRow(contact));
  }

  // Sort by last contact date, newest first
  rows.sort((a, b) => {
    const dateA = a[COL.LAST_CONTACT] ? new Date(a[COL.LAST_CONTACT]) : new Date(0);
    const dateB = b[COL.LAST_CONTACT] ? new Date(b[COL.LAST_CONTACT]) : new Date(0);
    return dateB - dateA;
  });

  return rows;
}
