const SHEET_NAME = "シート1";

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "add") {
    return addTopics({
      owner: e.parameter.owner || "名前なし",
      topics: [e.parameter.topic1, e.parameter.topic2, e.parameter.topic3],
    }, e.parameter.callback);
  }

  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const topics = rows.slice(1)
    .filter(function (row) {
      return String(row[0] || "").trim();
    })
    .map(function (row, index) {
      return {
        id: String(row[3] || "sheet-" + index),
        text: String(row[0] || ""),
        owner: String(row[1] || "名前なし"),
        createdAt: row[2] ? new Date(row[2]).toISOString() : new Date().toISOString(),
        updatedAt: row[2] ? new Date(row[2]).toISOString() : new Date().toISOString(),
      };
    });

  const payload = JSON.stringify({ ok: true, topics: topics });
  const callback = String((e && e.parameter && e.parameter.callback) || "");

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + payload + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  return addTopics(data, "");
}

function addTopics(data, callback) {
  const sheet = getSheet();
  const owner = data.owner || "名前なし";
  const topics = Array.isArray(data.topics) ? data.topics : [];
  const now = new Date();

  topics
    .filter(function (topic) {
      return String(topic || "").trim();
    })
    .forEach(function (topic) {
      sheet.appendRow([topic, owner, now, Utilities.getUuid()]);
    });

  const payload = JSON.stringify({ ok: true });

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + payload + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["お題", "名前", "登録日時", "ID"]);
  }

  return sheet;
}
