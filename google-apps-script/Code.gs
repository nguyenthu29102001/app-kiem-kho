const MAX_ROWS = 10000;
const MAX_TEXT_LENGTH = 500;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const properties = PropertiesService.getScriptProperties();
    const configuredSpreadsheetId = properties.getProperty("INVENTORY_SPREADSHEET_ID");
    const configuredSecret = properties.getProperty("INVENTORY_SHARED_SECRET");
    if (!configuredSpreadsheetId || !configuredSecret) {
      throw new Error("Apps Script chưa được cấu hình Script Properties");
    }

    const rawPayload = e.parameter && e.parameter.payload
      ? e.parameter.payload
      : e.postData.contents;
    const payload = JSON.parse(rawPayload);
    validatePayload_(payload);
    if (payload.sharedSecret !== configuredSecret) {
      throw new Error("Không được phép: shared secret không hợp lệ");
    }
    if (payload.spreadsheetId !== configuredSpreadsheetId) {
      throw new Error("Không được phép: Google Sheet không đúng cấu hình");
    }
    if (!lock.tryLock(10000)) {
      throw new Error("Hệ thống đang xử lý phiên khác, vui lòng thử lại");
    }

    // Only the server-side configured ID is ever opened. Never trust a target
    // spreadsheet supplied by the browser.
    const spreadsheet = SpreadsheetApp.openById(configuredSpreadsheetId);
    const propertyKey = "inventory-session-" + payload.sessionId;
    const savedSheetId = Number(properties.getProperty(propertyKey));
    let sheet = savedSheetId ? spreadsheet.getSheetById(savedSheetId) : null;

    if (!sheet) {
      let name = payload.sheetName;
      let suffix = 2;
      while (spreadsheet.getSheetByName(name)) {
        name = payload.sheetName + " (" + suffix + ")";
        suffix += 1;
      }
      sheet = spreadsheet.insertSheet(name);
      properties.setProperty(propertyKey, String(sheet.getSheetId()));
    } else {
      sheet.clear();
    }

    const headers = [["STT", "Barcode", "Tên sản phẩm", "Đơn vị", "Số lượng", "Cập nhật lúc"]];
    const rows = payload.rows.map(function(row) {
      return [
        Number(row[0]),
        safeText_(row[1]),
        safeText_(row[2]),
        safeText_(row[3]),
        Number(row[4]),
        new Date(row[5]),
      ];
    });
    const values = headers.concat(rows);
    sheet.getRange(1, 1, values.length, headers[0].length).setValues(values);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers[0].length)
      .setFontWeight("bold")
      .setBackground("#1f704a")
      .setFontColor("#ffffff");
    if (rows.length) {
      sheet.getRange(2, 5, rows.length, 1).setNumberFormat("0.########");
      sheet.getRange(2, 6, rows.length, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
    }
    sheet.autoResizeColumns(1, headers[0].length);

    return jsonResponse_({ ok: true, sheetName: sheet.getName() });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Payload không hợp lệ");
  if (!/^[a-zA-Z0-9_-]{6,100}$/.test(String(payload.sessionId || ""))) {
    throw new Error("Session ID không hợp lệ");
  }
  if (!/^KIỂM KHO - \d{2}-\d{2}-\d{4}$/.test(String(payload.sheetName || ""))) {
    throw new Error("Tên sheet không hợp lệ");
  }
  if (!Array.isArray(payload.rows) || payload.rows.length > MAX_ROWS) {
    throw new Error("Số dòng vượt quá giới hạn");
  }
  payload.rows.forEach(function(row) {
    if (!Array.isArray(row) || row.length !== 6) throw new Error("Dòng dữ liệu không hợp lệ");
    if (!Number.isFinite(Number(row[0])) || !Number.isFinite(Number(row[4])) || Number(row[4]) < 0) {
      throw new Error("Số lượng không hợp lệ");
    }
    [row[1], row[2], row[3]].forEach(function(value) {
      if (String(value).length > MAX_TEXT_LENGTH) throw new Error("Nội dung vượt quá giới hạn");
    });
    if (isNaN(new Date(row[5]).getTime())) throw new Error("Thời gian không hợp lệ");
  });
}

function safeText_(value) {
  const text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
