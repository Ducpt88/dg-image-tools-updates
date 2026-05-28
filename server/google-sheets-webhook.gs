const SALES_SHEET_ID = '1YL2mY6uYJCNrLASNjev7g7XDiPYVi4wBy8S_V7Ntlzg';

function doPost(e) {
  const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  const ss = SpreadsheetApp.openById(data.sheetId || SALES_SHEET_ID);
  const sheetName = data.type === 'sales_order' || data.type === 'sales_trial_registered' || data.type === 'sales_payment_paid' ? 'orders' : (data.type === 'customer_email' ? 'customer_emails' : (data.type === 'security_alert' ? 'security_alerts' : 'events'));
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  if (data.type === 'sales_order' || data.type === 'sales_trial_registered' || data.type === 'sales_payment_paid') {
    ensureHeader_(sheet, [
      'createdAt',
      'code',
      'customerName',
      'email',
      'phone',
      'planId',
      'planName',
      'price',
      'quotaTotal',
      'deviceLimit',
      'months',
      'status',
      'paymentRequired',
      'transferContent',
      'note',
      'accountEmail',
      'accountUserId',
      'accountCreatedAt',
      'customerEmailSentAt',
      'expiresAt'
    ]);
    sheet.appendRow([
      data.createdAt || new Date().toISOString(),
      data.code || '',
      data.customerName || '',
      data.email || '',
      data.phone || '',
      data.planId || '',
      data.planName || '',
      data.price || 0,
      data.quotaTotal || 0,
      data.deviceLimit || 1,
      data.months || 1,
      data.status || '',
      data.paymentRequired ? 'YES' : 'NO',
      data.transferContent || '',
      data.note || '',
      data.accountEmail || '',
      data.accountUserId || '',
      data.accountCreatedAt || '',
      data.customerEmailSentAt || '',
      data.expiresAt || ''
    ]);
  } else if (data.type === 'customer_email') {
    ensureHeader_(sheet, ['createdAt', 'to', 'customerName', 'orderCode', 'planName', 'quotaTotal', 'expiresAt', 'subject']);
    sheet.appendRow([
      data.createdAt || new Date().toISOString(),
      data.to || '',
      data.customerName || '',
      data.orderCode || '',
      data.planName || '',
      data.quotaTotal || 0,
      data.expiresAt || '',
      data.subject || ''
    ]);

    if (data.to && data.subject && data.body) {
      MailApp.sendEmail({
        to: data.to,
        subject: data.subject,
        body: data.body
      });
    }
  } else if (data.type === 'security_alert') {
    ensureHeader_(sheet, ['createdAt', 'severity', 'reason', 'email', 'userId', 'deviceId', 'appFlavor', 'appVersion', 'detail']);
    sheet.appendRow([
      data.createdAt || new Date().toISOString(),
      data.severity || '',
      data.reason || '',
      data.email || '',
      data.userId || '',
      data.deviceId || '',
      data.appFlavor || '',
      data.appVersion || '',
      data.detail || ''
    ]);

    if (data.alertEmail) {
      MailApp.sendEmail({
        to: data.alertEmail,
        subject: data.subject || '[DG Image Tools] Security alert',
        body: [
          'DG Image Tools security alert',
          '',
          'Time: ' + (data.createdAt || new Date().toISOString()),
          'Severity: ' + (data.severity || ''),
          'Reason: ' + (data.reason || ''),
          'Email: ' + (data.email || ''),
          'User ID: ' + (data.userId || ''),
          'Device ID: ' + (data.deviceId || ''),
          'App: ' + (data.appFlavor || '') + ' ' + (data.appVersion || ''),
          'Detail: ' + (data.detail || '')
        ].join('\n')
      });
    }
  } else {
    ensureHeader_(sheet, ['createdAt', 'email', 'ok', 'deviceId', 'prompt', 'error']);
    sheet.appendRow([
      data.createdAt || new Date().toISOString(),
      data.email || '',
      data.ok ? 'OK' : 'ERROR',
      data.deviceId || '',
      data.prompt || '',
      data.error || ''
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureHeader_(sheet, header) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    return;
  }

  const current = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  if (current.join('|') !== header.join('|')) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
}
