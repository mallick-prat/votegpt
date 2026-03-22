/**
 * SuperCRM Utility Functions
 * Name normalization, email handling, date helpers.
 */

/**
 * Normalizes an email address: lowercase, trimmed.
 */
function normalizeEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Normalizes a display name for comparison.
 * - Lowercase
 * - Trim whitespace
 * - Remove extra internal spaces
 * - Remove common suffixes like Jr., III, etc.
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b(jr\.?|sr\.?|iii?|iv|phd|md|esq\.?)\b/gi, '')
    .trim();
}

/**
 * Extracts a clean display name from a potentially messy calendar name.
 * Handles formats like "Last, First" → "First Last"
 * and "first.last@email.com" → "First Last" (fallback only)
 */
function cleanDisplayName(rawName, email) {
  if (!rawName || rawName.trim().length === 0) {
    // Fall back to email prefix if no name
    if (email) {
      const prefix = email.split('@')[0];
      return prefix
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
    }
    return '';
  }

  let name = rawName.trim();

  // Handle "Last, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
      name = parts[1] + ' ' + parts[0];
    }
  }

  // Remove quotes
  name = name.replace(/['"]/g, '');

  // Trim extra whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

/**
 * Extracts the domain from an email address.
 */
function getEmailDomain(email) {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[1].toLowerCase();
}

/**
 * Checks if an email belongs to an excluded domain.
 */
function isExcludedDomain(email, excludeDomains) {
  const domain = getEmailDomain(email);
  return excludeDomains.some(d => domain === d || domain.endsWith('.' + d));
}

/**
 * Checks if a name looks suspicious (likely an email, random string, etc.)
 */
function isNameSuspicious(name) {
  if (!name || name.length < 2) return true;
  // Name is just an email
  if (name.includes('@')) return true;
  // Name is all numbers
  if (/^\d+$/.test(name)) return true;
  // Name has no letters
  if (!/[a-zA-Z]/.test(name)) return true;
  return false;
}

/**
 * Formats a date as YYYY-MM-DD for sheet display.
 */
function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(date);
}

/**
 * Truncates a string to maxLen characters, adding "..." if truncated.
 */
function truncate(str, maxLen) {
  if (!str) return '';
  str = String(str).trim();
  // Remove newlines for snippet display
  str = str.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Creates a Perplexity research URL for a contact.
 */
function buildResearchUrl(name, company) {
  const query = (name + (company ? ' ' + company : '') + ' background').trim();
  return 'https://www.perplexity.ai/search?q=' + encodeURIComponent(query);
}

/**
 * Generates row formulas for formula-driven columns.
 * Returns an object with column index → formula string.
 * rowNum is the 1-based row number in the sheet.
 */
function getRowFormulas(rowNum) {
  return {
    // Days Since Contact: =IF(F{row}="", "", ROUND(TODAY()-F{row}, 0))
    [COL.DAYS_SINCE]: `=IF(F${rowNum}="", "", ROUND(TODAY()-F${rowNum}, 0))`,

    // Recency Status
    [COL.RECENCY_STATUS]: `=IF(F${rowNum}="", "Unknown", IF(TODAY()-F${rowNum}<=30, "🟢 Active", IF(TODAY()-F${rowNum}<=60, "🟡 Warm", IF(TODAY()-F${rowNum}<=90, "🟠 Cooling", "🔴 Stale"))))`,

    // Needs Review: OR(name blank, email blank, name looks like email)
    [COL.NEEDS_REVIEW]: `=OR(A${rowNum}="", B${rowNum}="", LEN(A${rowNum})<3, ISNUMBER(SEARCH("@", A${rowNum})))`,

    // Research link
    [COL.RESEARCH]: `=IF(A${rowNum}="", "", HYPERLINK("https://www.perplexity.ai/search?q=" & ENCODEURL(A${rowNum} & IF(C${rowNum}<>"", " " & C${rowNum}, "") & " background"), "🔍 Research"))`
  };
}
