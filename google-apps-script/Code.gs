function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (!payload.spreadsheetId || !payload.sessionId || !payload.sheetName || !Array.isArray(payload.rows)) {
      throw new Error("Payload không hợp lệ");
    }

    const spreadsheet = SpreadsheetApp.openById(payload.spreadsheetId);
    const properties = PropertiesService.getScriptProperties();
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
      return [row[0], row[1], row[2], row[3], row[4], new Date(row[5])];
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

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, sheetName: sheet.getName() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
