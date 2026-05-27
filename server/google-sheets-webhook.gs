const SALES_SHEET_ID = '1YL2mY6uYJCNrLASNjev7g7XDiPYVi4wBy8S_V7Ntlzg';

function doPost(e) {
  const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  const ss = SpreadsheetApp.openById(data.sheetId || SALES_SHEET_ID);
  const sheetName = data.type === 'sales_order' ? 'orders' : 'events';
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  if (data.type === 'sales_order') {
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
      'note'
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
      data.note || ''
    ]);
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
