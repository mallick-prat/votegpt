/**
 * SuperCRM Dashboard & Derived View Builder
 * Creates the Dashboard tab and sets up QUERY formulas for city/role tabs.
 */

/**
 * Builds or refreshes the Dashboard tab with summary metrics.
 * All values are formulas that auto-update.
 */
function buildDashboard() {
  const sheet = getOrCreateSheet(SHEET_DASHBOARD);
  sheet.clear();

  // Title
  sheet.getRange('A1').setValue('SuperCRM Dashboard').setFontSize(18).setFontWeight('bold');
  sheet.getRange('A2').setValue('Your network at a glance').setFontSize(11).setFontColor('#666666');

  // Last Sync
  sheet.getRange('A4').setValue('Last Sync:').setFontWeight('bold');
  sheet.getRange('B4').setFormula(
    `=IF(COUNTA('Sync Log'!A:A)>1, INDEX('Sync Log'!A:A, COUNTA('Sync Log'!A:A)), "Never")`
  );

  // === NETWORK OVERVIEW ===
  sheet.getRange('A6').setValue('📊 Network Overview').setFontSize(14).setFontWeight('bold');

  const metrics = [
    ['Total Contacts', `=COUNTA('Master CRM'!A2:A)`],
    ['New This Week', `=COUNTIFS('Master CRM'!H2:H, ">="&TODAY()-7)`],
    ['Active (Last 30 Days)', `=COUNTIFS('Master CRM'!I2:I, "<="&30, 'Master CRM'!I2:I, "<>")`],
    ['Warm (30-60 Days)', `=COUNTIFS('Master CRM'!I2:I, ">"&30, 'Master CRM'!I2:I, "<="&60)`],
    ['Cooling (60-90 Days)', `=COUNTIFS('Master CRM'!I2:I, ">"&60, 'Master CRM'!I2:I, "<="&90)`],
    ['Stale (90+ Days)', `=COUNTIFS('Master CRM'!I2:I, ">"&90)`],
    ['Needs Review', `=COUNTIF('Master CRM'!O2:O, TRUE)`],
    ['Avg Days Since Contact', `=IFERROR(ROUND(AVERAGE('Master CRM'!I2:I), 0), 0)`],
  ];

  for (let i = 0; i < metrics.length; i++) {
    const row = 8 + i;
    sheet.getRange(row, 1).setValue(metrics[i][0]).setFontWeight('bold');
    sheet.getRange(row, 2).setFormula(metrics[i][1]).setFontSize(12);
  }

  // === CONTACTS BY CITY ===
  sheet.getRange('A18').setValue('🏙️ Contacts by City').setFontSize(14).setFontWeight('bold');

  for (let i = 0; i < CITY_TABS.length; i++) {
    const row = 20 + i;
    sheet.getRange(row, 1).setValue(CITY_TABS[i]).setFontWeight('bold');
    sheet.getRange(row, 2).setFormula(
      `=COUNTIF('Master CRM'!D2:D, "${CITY_TABS[i]}")`
    );
  }
  // Untagged cities
  sheet.getRange(20 + CITY_TABS.length, 1).setValue('Untagged').setFontColor('#999999');
  sheet.getRange(20 + CITY_TABS.length, 2).setFormula(
    `=COUNTBLANK('Master CRM'!D2:D)`
  );

  // === CONTACTS BY ROLE ===
  const roleStartRow = 20 + CITY_TABS.length + 3;
  sheet.getRange(roleStartRow, 1).setValue('🏷️ Contacts by Role').setFontSize(14).setFontWeight('bold');

  for (let i = 0; i < ROLE_TABS.length; i++) {
    const row = roleStartRow + 2 + i;
    sheet.getRange(row, 1).setValue(ROLE_TABS[i]).setFontWeight('bold');
    sheet.getRange(row, 2).setFormula(
      `=COUNTIF('Master CRM'!E2:E, "${ROLE_TABS[i]}")`
    );
  }
  // Untagged roles
  const untaggedRow = roleStartRow + 2 + ROLE_TABS.length;
  sheet.getRange(untaggedRow, 1).setValue('Untagged').setFontColor('#999999');
  sheet.getRange(untaggedRow, 2).setFormula(
    `=COUNTBLANK('Master CRM'!E2:E)`
  );

  // === TOP CONTACTS ===
  const topRow = untaggedRow + 3;
  sheet.getRange(topRow, 1).setValue('🔥 Most Frequent Contacts (Top 10)').setFontSize(14).setFontWeight('bold');
  sheet.getRange(topRow + 1, 1).setFormula(
    `=IFERROR(QUERY('Master CRM'!A2:P, "SELECT A, C, G, F ORDER BY G DESC LIMIT 10", 0), "No data yet")`
  );

  // Formatting
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 120);

  // Background
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setBackground('#ffffff');

  Logger.log('Dashboard built successfully');
}

/**
 * Creates all city view tabs with QUERY formulas.
 * Each tab auto-populates from Master CRM filtered by city.
 */
function buildCityTabs() {
  for (const city of CITY_TABS) {
    const sheet = getOrCreateSheet(city);
    sheet.clear();

    // Title
    sheet.getRange('A1').setValue(`${city} Contacts`).setFontSize(14).setFontWeight('bold');

    // QUERY formula starting at A3
    sheet.getRange('A3').setFormula(
      `=IFERROR(QUERY('Master CRM'!A2:P, ` +
      `"SELECT A, B, C, E, F, I, J, G, P ` +
      `WHERE D = '${city}' ` +
      `ORDER BY F DESC ` +
      `LABEL A 'Name', B 'Email', C 'Company', E 'Role', ` +
      `F 'Last Contact', I 'Days Since', J 'Status', ` +
      `G 'Meetings', P 'Research'", 1), ` +
      `"No contacts tagged for ${city} yet. Tag contacts in the Master CRM tab.")`
    );

    // Column widths
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 110);
    sheet.setColumnWidth(6, 60);
    sheet.setColumnWidth(7, 110);
    sheet.setColumnWidth(8, 60);
    sheet.setColumnWidth(9, 100);
  }

  Logger.log(`Built ${CITY_TABS.length} city tabs`);
}

/**
 * Creates all role view tabs with QUERY formulas.
 */
function buildRoleTabs() {
  for (const role of ROLE_TABS) {
    const sheet = getOrCreateSheet(role);
    sheet.clear();

    sheet.getRange('A1').setValue(`${role}`).setFontSize(14).setFontWeight('bold');

    sheet.getRange('A3').setFormula(
      `=IFERROR(QUERY('Master CRM'!A2:P, ` +
      `"SELECT A, B, C, D, F, I, J, G, P ` +
      `WHERE E = '${role}' ` +
      `ORDER BY F DESC ` +
      `LABEL A 'Name', B 'Email', C 'Company', D 'City', ` +
      `F 'Last Contact', I 'Days Since', J 'Status', ` +
      `G 'Meetings', P 'Research'", 1), ` +
      `"No contacts tagged as ${role} yet. Tag contacts in the Master CRM tab.")`
    );

    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 70);
    sheet.setColumnWidth(5, 110);
    sheet.setColumnWidth(6, 60);
    sheet.setColumnWidth(7, 110);
    sheet.setColumnWidth(8, 60);
    sheet.setColumnWidth(9, 100);
  }

  Logger.log(`Built ${ROLE_TABS.length} role tabs`);
}
