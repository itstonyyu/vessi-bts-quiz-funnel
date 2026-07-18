import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadScript(extra = {}) {
  const context = vm.createContext({ console, Date, JSON, Number, isNaN, ...extra });
  vm.runInContext(fs.readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8"), context);
  return context;
}

const valid = {
  entry_id: "entry_12345678", entry_started_at: "2026-07-16T12:00:00.000Z",
  entry_completed_at: "", first_name: " Ada ", last_name: "Lovelace",
  email: "ADA@EXAMPLE.COM", country: "us", state_province: "Oregon", type: "student",
  marketing_consent: false, consent_date: "ignored", answers: { role: { value: "student" } },
  entry_number: 999999
};

test("Apps Script normalizes fields and ignores client entry_number", () => {
  const ctx = loadScript();
  const result = ctx.normalizePayload_(valid);
  assert.equal(result.first_name, "Ada");
  assert.equal(result.email, "ada@example.com");
  assert.equal(result.consent_date, "");
  assert.equal("entry_number" in result, false);
  assert.deepEqual(JSON.parse(result.answers_json), valid.answers);
  assert.equal(ctx.cellSafe_("=IMPORTXML(1)"), "'=IMPORTXML(1)");
});

test("Apps Script rejects invalid IDs, dates, emails, and consent without date", () => {
  const ctx = loadScript();
  assert.throws(() => ctx.normalizePayload_({ ...valid, entry_id: "bad" }), /entry_id/);
  assert.throws(() => ctx.normalizePayload_({ ...valid, entry_started_at: "yesterday" }), /entry_started_at/);
  assert.throws(() => ctx.normalizePayload_({ ...valid, email: "not-an-email" }), /email/);
  assert.throws(() => ctx.normalizePayload_({ ...valid, marketing_consent: true, consent_date: "" }), /consent_date/);
});

test("Apps Script upserts by entry_id under a lock and preserves server entry number", () => {
  const rows = [
    ["entry_number", "entry_id", "entry_started_at", "entry_completed_at", "last_updated_at", "first_name", "last_name", "email", "country", "state_province", "type", "marketing_consent", "consent_date", "answers_json"],
    [7, "entry_12345678", "old"]
  ];
  const writes = [];
  const sheet = {
    getLastRow: () => rows.length,
    getRange(row, col, countRows = 1, countCols = 1) {
      return {
        getDisplayValues: () => Array.from({ length: countRows }, (_, r) => Array.from({ length: countCols }, (_, c) => String(rows[row - 1 + r]?.[col - 1 + c] ?? ""))),
        getValues: () => Array.from({ length: countRows }, (_, r) => Array.from({ length: countCols }, (_, c) => rows[row - 1 + r]?.[col - 1 + c] ?? "")),
        getValue: () => rows[row - 1]?.[col - 1],
        setValues: (values) => writes.push({ row, col, values })
      };
    }
  };
  const lockEvents = [];
  const ctx = loadScript({
    LockService: { getScriptLock: () => ({ waitLock: () => lockEvents.push("wait"), releaseLock: () => lockEvents.push("release") }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) }
  });
  const normalized = ctx.normalizePayload_(valid);
  const result = ctx.upsertEntry_(normalized);
  assert.equal(result.entry_number, 7);
  assert.equal(result.row, 2);
  assert.equal(writes[0].values[0][0], 7);
  assert.deepEqual(lockEvents, ["wait", "release"]);
});
