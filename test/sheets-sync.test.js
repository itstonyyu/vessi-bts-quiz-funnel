import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, createEntry, createSheetsSync } from "../src/sheets-sync.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

const date = new Date("2026-07-16T12:00:00.000Z");

test("createEntry persists and reuses entry identity", () => {
  const storage = memoryStorage();
  const first = createEntry(storage, () => date, () => "uuid-12345678");
  const second = createEntry(storage, () => new Date(), () => "different-uuid");
  assert.deepEqual(second, first);
  assert.equal(first.entry_started_at, date.toISOString());
});

test("buildPayload maps sheet schema and keeps all answers", () => {
  const payload = buildPayload(
    { entry_id: "uuid-12345678", entry_started_at: date.toISOString() },
    {
      role: "student", country: "us", region: "Oregon",
      answers: { rain: { value: "socks", label: "Wet socks" } },
      profile: { school: "A & B University" },
      contact: { first: "Ada", last: "Lovelace", email: "ada@example.com", phone: "555", smsOptIn: true },
      marketing_consent: true, consent_date: date.toISOString(), terms_accepted: true,
      entry_completed_at: date.toISOString()
    },
    () => date
  );
  assert.equal(payload.type, "student");
  assert.equal(payload.first_name, "Ada");
  assert.equal(payload.marketing_consent, true);
  assert.equal(payload.answers.school, "A & B University");
  assert.equal(payload.answers.rain.value, "socks");
  assert.equal(payload.answers.giveaway_terms_accepted, true);
});

test("sync debounces, sends CORS-simple writes, and flushes immediately", async () => {
  const calls = [];
  let scheduled;
  const sync = createSheetsSync({
    endpoint: "https://script.google.com/macros/s/example/exec",
    getSnapshot: () => ({ answers: { q: "a" } }),
    storage: memoryStorage(), fetchImpl: async (...args) => { calls.push(args); },
    now: () => date, randomUUID: () => "uuid-12345678",
    setTimeoutImpl: (fn) => { scheduled = fn; return 1; }, clearTimeoutImpl: () => {}
  });
  sync.schedule();
  sync.schedule();
  assert.equal(calls.length, 0);
  scheduled();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].mode, "no-cors");
  assert.equal(calls[0][1].headers["Content-Type"], "text/plain;charset=utf-8");
  await sync.flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1].keepalive, true);
});

test("sync failures are contained and do not reject quiz flow", async () => {
  const sync = createSheetsSync({
    endpoint: "https://example.invalid/exec", getSnapshot: () => ({}), storage: memoryStorage(),
    fetchImpl: async () => { throw new Error("offline"); }, now: () => date, randomUUID: () => "uuid-12345678"
  });
  const result = await sync.flush();
  assert.match(result.error.message, /offline/);
});
