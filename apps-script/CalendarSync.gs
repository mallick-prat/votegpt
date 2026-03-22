/**
 * SuperCRM Calendar Sync
 * Fetches and parses Google Calendar events into contact records.
 */

/**
 * Fetches calendar events within a date range and returns parsed event objects.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array<Object>} Array of parsed event objects
 */
function fetchCalendarEvents(startDate, endDate) {
  const calendar = CalendarApp.getDefaultCalendar();
  const events = calendar.getEvents(startDate, endDate);

  Logger.log(`Fetched ${events.length} events from ${formatDate(startDate)} to ${formatDate(endDate)}`);

  return events.map(event => {
    try {
      return {
        title: event.getTitle() || '',
        startTime: event.getStartTime(),
        endTime: event.getEndTime(),
        description: event.getDescription() || '',
        location: event.getLocation() || '',
        guests: event.getGuestList(true) || [], // true = include organizer
        creators: event.getCreators() || [],
        isAllDay: event.isAllDayEvent(),
        isRecurring: event.isRecurringEvent(),
        eventId: event.getId()
      };
    } catch (e) {
      Logger.log(`Error parsing event: ${e.message}`);
      return null;
    }
  }).filter(e => e !== null);
}

/**
 * Parses all attendees from a list of events, excluding the user and internal domains.
 * Returns an array of contact interaction records.
 *
 * @param {Array<Object>} events - Parsed event objects from fetchCalendarEvents
 * @param {string} userEmail - The user's own email to exclude
 * @param {Array<string>} excludeDomains - Domains to exclude
 * @returns {Array<Object>} Array of {email, name, eventTitle, eventDate, eventDescription, isGroup}
 */
function parseAllAttendees(events, userEmail, excludeDomains) {
  const interactions = [];
  const normalizedUserEmail = normalizeEmail(userEmail);
  const settings = getSettings();
  const groupThreshold = Number(settings.min_attendees_for_group) || 8;

  for (const event of events) {
    const guests = event.guests || [];

    // Also check creators as potential attendees (for events with no guest list)
    const allEmails = new Set();
    const attendeeRecords = [];

    // Process guest list
    for (const guest of guests) {
      const email = normalizeEmail(guest.getEmail());
      const name = cleanDisplayName(guest.getName(), email);

      if (!email) continue;
      if (email === normalizedUserEmail) continue;
      if (isExcludedDomain(email, excludeDomains)) continue;

      // Skip resource rooms (common in Google Workspace)
      if (email.includes('resource.calendar.google.com')) continue;
      if (email.includes('@calendar.google.com')) continue;

      if (!allEmails.has(email)) {
        allEmails.add(email);
        attendeeRecords.push({ email, name });
      }
    }

    // If no guests parsed, check creators
    if (attendeeRecords.length === 0 && event.creators) {
      for (const creatorEmail of event.creators) {
        const email = normalizeEmail(creatorEmail);
        if (!email || email === normalizedUserEmail) continue;
        if (isExcludedDomain(email, excludeDomains)) continue;
        if (!allEmails.has(email)) {
          allEmails.add(email);
          attendeeRecords.push({ email, name: cleanDisplayName('', email) });
        }
      }
    }

    // Skip if no external attendees
    if (attendeeRecords.length === 0) continue;

    const isGroup = attendeeRecords.length >= groupThreshold;
    const titlePrefix = isGroup ? '[Group] ' : '';

    for (const att of attendeeRecords) {
      interactions.push({
        email: att.email,
        name: att.name,
        eventTitle: titlePrefix + event.title,
        eventDate: event.startTime,
        eventDescription: event.description,
        isGroup: isGroup
      });
    }
  }

  Logger.log(`Parsed ${interactions.length} contact interactions from ${events.length} events`);
  return interactions;
}

/**
 * Aggregates raw interactions into per-contact summaries.
 * One record per unique email, with earliest/latest dates and meeting count.
 *
 * @param {Array<Object>} interactions - Raw interaction records
 * @returns {Map<string, Object>} Map of email → aggregated contact data
 */
function aggregateInteractions(interactions) {
  const contactMap = new Map();

  for (const interaction of interactions) {
    const key = interaction.email;

    if (contactMap.has(key)) {
      const existing = contactMap.get(key);

      // Update name if current one is better (longer, more complete)
      if (interaction.name && interaction.name.length > (existing.name || '').length) {
        existing.name = interaction.name;
      }

      // Update dates
      if (interaction.eventDate > existing.lastContact) {
        existing.lastContact = interaction.eventDate;
        existing.recentMeetingTitle = interaction.eventTitle;
        existing.meetingNotesSnippet = truncate(interaction.eventDescription, 200);
      }
      if (interaction.eventDate < existing.firstContact) {
        existing.firstContact = interaction.eventDate;
      }

      existing.contactCount++;
    } else {
      contactMap.set(key, {
        name: interaction.name,
        email: interaction.email,
        lastContact: interaction.eventDate,
        firstContact: interaction.eventDate,
        contactCount: 1,
        recentMeetingTitle: interaction.eventTitle,
        meetingNotesSnippet: truncate(interaction.eventDescription, 200),
        source: 'Google Calendar'
      });
    }
  }

  Logger.log(`Aggregated into ${contactMap.size} unique contacts`);
  return contactMap;
}
