/**
 * GDC Speaker Email Automation
 * Google Sheets -> Gmail; one unique voucher per speaker.
 * This source file contains no credentials or personal data.
 */
const GDC = Object.freeze({
  SHEET_NAME: 'Speakers',
  HEADERS: ['Name', 'Email', 'Voucher', 'Status', 'Sent At', 'Error'],
  STATUS: { SENDING: 'Sending', SENT: 'Sent', ERROR: 'Error' },
  MAX_PER_RUN: 40,
  LOCK_TIMEOUT_MS: 30000
});

function onOpen() {
  SpreadsheetApp.getUi().createMenu('GDC Emails')
    .addItem('Set up headers', 'setupSheet')
    .addItem('Send a test email', 'sendTestEmail')
    .addItem('Send pending speaker emails', 'sendPendingEmails')
    .addItem('Show progress', 'showProgress')
    .addToUi();
}

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    eventName: p.getProperty('EVENT_NAME') || 'DevFest',
    subject: p.getProperty('EMAIL_SUBJECT') || 'Your DevFest speaker discount voucher',
    senderName: p.getProperty('SENDER_NAME') || 'GDC on Campus',
    replyTo: p.getProperty('REPLY_TO') || '',
    testEmail: p.getProperty('TEST_EMAIL') || ''
  };
}

function sheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GDC.SHEET_NAME);
  if (!sheet) throw new Error('Missing sheet "Speakers". Create it, then use GDC Emails > Set up headers.');
  return sheet;
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(GDC.SHEET_NAME) || ss.insertSheet(GDC.SHEET_NAME);
  const actual = sheet.getRange(1, 1, 1, GDC.HEADERS.length).getDisplayValues()[0];
  if (actual.some(v => v.trim() !== '') && actual.join('|') !== GDC.HEADERS.join('|')) {
    throw new Error('Row 1 has existing headers. Do not overwrite them. See README for required headers.');
  }
  sheet.getRange(1, 1, 1, GDC.HEADERS.length).setValues([GDC.HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:F1').setFontWeight('bold');
  SpreadsheetApp.getUi().alert('Speakers sheet ready. Add rows beneath the headers.');
}

function htmlEscape_(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function message_(name, voucher, cfg) {
  const safeName = htmlEscape_(name);
  const safeEvent = htmlEscape_(cfg.eventName);
  const safeVoucher = htmlEscape_(voucher);
  const looksLikeUrl = /^https:\/\/[^\s]+$/i.test(voucher);
  const voucherHtml = looksLikeUrl
    ? '<a href="' + safeVoucher + '">Access your voucher</a>'
    : '<strong>' + safeVoucher + '</strong>';
  return {
    plain: 'Hello ' + name + ',\n\nThank you for joining ' + cfg.eventName +
      ' as a speaker! Here is your personal discount voucher:\n' + voucher +
      '\n\nPlease keep it private; it is intended for you only.\n\nBest regards,\nGDC on Campus Team',
    html: '<p>Hello ' + safeName + ',</p><p>Thank you for joining ' + safeEvent +
      ' as a speaker! Here is your personal discount voucher:</p><p>' + voucherHtml +
      '</p><p>Please keep it private; it is intended for you only.</p>' +
      '<p>Best regards,<br>GDC on Campus Team</p>'
  };
}

function validEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function headers_() {
  const sheet = sheet_();
  const headers = sheet.getRange(1, 1, 1, GDC.HEADERS.length).getDisplayValues()[0];
  if (headers.join('|') !== GDC.HEADERS.join('|')) {
    throw new Error('Headers must be exactly: ' + GDC.HEADERS.join(', '));
  }
  return sheet;
}

function sendOne_(email, name, voucher, cfg) {
  const m = message_(name, voucher, cfg);
  const opts = { htmlBody: m.html, name: cfg.senderName };
  if (cfg.replyTo) opts.replyTo = cfg.replyTo;
  GmailApp.sendEmail(email, cfg.subject, m.plain, opts);
}

/**
 * Preview only: sends the first complete speaker row to TEST_EMAIL.
 * Does NOT change Status or Sent At.
 */
function sendTestEmail() {
  const cfg = getConfig_();
  if (!validEmail_(cfg.testEmail)) throw new Error('Set TEST_EMAIL in Project Settings > Script properties.');
  const sheet = headers_();
  const rows = Math.max(0, sheet.getLastRow() - 1);
  if (!rows) throw new Error('Add at least one sample speaker row first.');
  const data = sheet.getRange(2, 1, rows, 6).getDisplayValues();
  const entry = data.find(r => r[0].trim() && validEmail_(r[1]) && r[2].trim());
  if (!entry) throw new Error('No complete row with Name, valid Email, Voucher.');
  // Do not leak the speaker voucher to TEST_EMAIL unless the operator intentionally
  // uses a synthetic sample row. Test uses a placeholder instead.
  sendOne_(cfg.testEmail, entry[0], 'TEST-VOUCHER-NOT-VALID',
    Object.assign({}, cfg, { subject: '[TEST] ' + cfg.subject }));
  SpreadsheetApp.getUi().alert('Test sent to ' + cfg.testEmail + '. No rows were marked Sent.');
}

/**
 * Send at most MAX_PER_RUN rows per invocation.
 * Marks "Sending" BEFORE Gmail call to avoid accidental re-sends on retry.
 * If left as "Sending", manually check Gmail Sent before resetting the row.
 */
function sendPendingEmails() {
  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  if (!lock.tryLock(GDC.LOCK_TIMEOUT_MS)) throw new Error('Another send run is in progress.');
  let sent = 0, errors = 0, skipped = 0;
  try {
    const cfg = getConfig_();
    const sheet = headers_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) { SpreadsheetApp.getUi().alert('No speaker rows found.'); return; }
    const data = sheet.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
    const knownVouchers = new Set();
    for (let i = 0; i < data.length; i++) {
      const voucher = data[i][2].trim();
      if (voucher && knownVouchers.has(voucher)) {
        throw new Error('Duplicate voucher found. Fix row ' + (i + 2) + ' before sending.');
      }
      if (voucher) knownVouchers.add(voucher);
    }
    for (let i = 0; i < data.length; i++) {
      if (sent + errors >= GDC.MAX_PER_RUN) break;
      const [name, email, voucher, rawStatus] = data[i].map(v => String(v).trim());
      const status = rawStatus.toLowerCase();
      // Only blank / Pending rows are eligible. In particular, Sent and Sending are skipped.
      if (status && status !== 'pending') { skipped++; continue; }
      if (!name && !email && !voucher) { skipped++; continue; }
      const row = i + 2;
      if (!name || !validEmail_(email) || !voucher) {
        sheet.getRange(row, 6).setValue('Missing name/voucher or invalid email');
        errors++;
        continue;
      }
      sheet.getRange(row, 4, 1, 3).setValues([[GDC.STATUS.SENDING, '', '']]);
      SpreadsheetApp.flush();
      try {
        sendOne_(email, name, voucher, cfg);
        sheet.getRange(row, 4, 1, 3).setValues([[GDC.STATUS.SENT, new Date(), '']]);
        sent++;
      } catch (err) {
        // Error may be ambiguous. Do not automatically retry without inspection.
        sheet.getRange(row, 4).setValue(GDC.STATUS.ERROR);
        sheet.getRange(row, 6).setValue(String(err.message || err));
        errors++;
      }
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert('Run complete. Sent: ' + sent + ' | Errors: ' + errors +
    ' | Skipped: ' + skipped + '. Use Show progress for totals.');
}

function showProgress() {
  const sheet = headers_();
  const count = Math.max(0, sheet.getLastRow() - 1);
  const rows = count ? sheet.getRange(2, 1, count, 6).getDisplayValues() : [];
  const totals = { pending: 0, sent: 0, sending: 0, error: 0, other: 0 };
  rows.forEach(r => {
    if (!r[0] && !r[1] && !r[2]) return;
    const status = r[3].trim().toLowerCase();
    if (!status || status === 'pending') totals.pending++;
    else if (Object.prototype.hasOwnProperty.call(totals, status)) totals[status]++;
    else totals.other++;
  });
  SpreadsheetApp.getUi().alert('Speaker email progress\n' +
    'Sent: ' + totals.sent + '\nPending: ' + totals.pending +
    '\nSending (review): ' + totals.sending + '\nError: ' + totals.error +
    '\nOther statuses: ' + totals.other);
}