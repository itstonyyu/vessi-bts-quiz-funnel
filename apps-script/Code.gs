/*
 * Vessi quiz Google Apps Script web-app endpoint.
 * Bind this script to the target spreadsheet. See README.md for deployment.
 */
const SPREADSHEET_ID = "1xGJ79KR1jhclM9RzZYEqxMMyhhSEGnaaaRuZPd51KVw";
const SHEET_NAME = "Sheet1";
const HEADERS = [
  "entry_number", "entry_id", "entry_started_at", "entry_completed_at",
  "last_updated_at", "first_name", "last_name", "email", "country",
  "state_province", "type", "marketing_consent", "consent_date", "answers_json"
];

function doGet() {
  return json_({ ok: true, service: "vessi-quiz-sync" });
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw) throw new Error("Request body is required");
    return json_(upsertEntry_(normalizePayload_(JSON.parse(raw))));
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message || error) });
  }
}

function normalizePayload_(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Body must be a JSON object");
  const entryId = clean_(input.entry_id, 128);
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(entryId)) throw new Error("Invalid entry_id");

  const started = iso_(input.entry_started_at, true, "entry_started_at");
  const completed = iso_(input.entry_completed_at, false, "entry_completed_at");
  const consent = input.marketing_consent === true;
  const consentDate = consent ? iso_(input.consent_date, true, "consent_date") : "";
  const answers = input.answers && typeof input.answers === "object" && !Array.isArray(input.answers) ? input.answers : {};
  const answersJson = JSON.stringify(answers);
  if (answersJson.length > 45000) throw new Error("answers is too large");

  return {
    entry_id: entryId,
    entry_started_at: started,
    entry_completed_at: completed,
    first_name: clean_(input.first_name, 200),
    last_name: clean_(input.last_name, 200),
    email: normalizeEmail_(input.email),
    country: clean_(input.country, 100),
    state_province: clean_(input.state_province, 200),
    type: clean_(input.type, 100),
    marketing_consent: consent,
    consent_date: consentDate,
    answers_json: answersJson
  };
}

function upsertEntry_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet not found: " + SHEET_NAME);
    assertHeaders_(sheet);

    const lastRow = sheet.getLastRow();
    const ids = lastRow > 1 ? sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues() : [];
    let row = 0;
    for (let index = 0; index < ids.length; index += 1) {
      if (ids[index][0] === payload.entry_id) { row = index + 2; break; }
    }

    let entryNumber;
    if (row) {
      entryNumber = sheet.getRange(row, 1).getValue();
    } else {
      entryNumber = nextEntryNumber_(sheet, lastRow);
      row = Math.max(2, lastRow + 1);
    }

    const values = [[
      entryNumber, payload.entry_id, payload.entry_started_at, payload.entry_completed_at,
      new Date().toISOString(), cellSafe_(payload.first_name), cellSafe_(payload.last_name), cellSafe_(payload.email),
      cellSafe_(payload.country), cellSafe_(payload.state_province), cellSafe_(payload.type), payload.marketing_consent,
      payload.consent_date, payload.answers_json
    ]];
    sheet.getRange(row, 1, 1, HEADERS.length).setValues(values);
    return { ok: true, entry_id: payload.entry_id, entry_number: entryNumber, row: row };
  } finally {
    lock.releaseLock();
  }
}

function nextEntryNumber_(sheet, lastRow) {
  if (lastRow < 2) return 1;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  return values.reduce(function(max, row) {
    const value = Number(row[0]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

function assertHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (actual.join("|") !== HEADERS.join("|")) throw new Error("Sheet headers do not match the required schema");
}

function cellSafe_(value) {
  const text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function clean_(value, maxLength) {
  return String(value == null ? "" : value).trim().slice(0, maxLength);
}

function normalizeEmail_(value) {
  const email = clean_(value, 320).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  return email;
}

function iso_(value, required, field) {
  const text = clean_(value, 64);
  if (!text && !required) return "";
  if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text) || isNaN(new Date(text).getTime())) {
    throw new Error("Invalid " + field);
  }
  return new Date(text).toISOString();
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
