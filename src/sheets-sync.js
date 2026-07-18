const STORAGE_KEY = "vessi_quiz_entry_v1";

export function createEntry(storage = globalThis.localStorage, now = () => new Date(), randomUUID = () => globalThis.crypto.randomUUID()) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    if (saved?.entry_id && saved?.entry_started_at) return saved;
  } catch (_) {
    // A malformed or unavailable store should never stop the quiz.
  }

  const entry = {
    entry_id: randomUUID(),
    entry_started_at: now().toISOString()
  };
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(entry)); } catch (_) {}
  return entry;
}

export function clearEntry(storage = globalThis.localStorage) {
  try { storage?.removeItem(STORAGE_KEY); } catch (_) {}
}

export function buildPayload(entry, snapshot, now = () => new Date()) {
  return {
    entry_id: entry.entry_id,
    entry_started_at: entry.entry_started_at,
    entry_completed_at: snapshot.entry_completed_at || "",
    first_name: snapshot.contact?.first || "",
    last_name: snapshot.contact?.last || "",
    email: snapshot.contact?.email || "",
    country: snapshot.country || "",
    state_province: snapshot.region || "",
    type: snapshot.role || "",
    marketing_consent: Boolean(snapshot.marketing_consent),
    consent_date: snapshot.consent_date || "",
    answers: {
      ...snapshot.answers,
      school: snapshot.profile?.school || "",
      phone: snapshot.contact?.phone || "",
      sms_opt_in: Boolean(snapshot.contact?.smsOptIn),
      giveaway_terms_accepted: Boolean(snapshot.terms_accepted)
    },
    client_updated_at: now().toISOString()
  };
}

/**
 * Coalescing, single-flight writer. Apps Script web apps can be unreliable with
 * CORS response handling, so this intentionally sends a CORS-simple text/plain
 * request in no-cors mode. An opaque response means "dispatched", not a
 * confirmed Sheet write; server-side validation remains authoritative.
 */
export function createSheetsSync({ endpoint, getSnapshot, storage, fetchImpl = globalThis.fetch, debounceMs = 350, now, randomUUID, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout }) {
  const entry = createEntry(storage, now, randomUUID);
  let timer = null;
  let tail = Promise.resolve();

  async function send(keepalive = false) {
    if (!endpoint || !fetchImpl) return { skipped: true };
    const body = JSON.stringify(buildPayload(entry, getSnapshot(), now));
    return fetchImpl(endpoint, {
      method: "POST",
      mode: "no-cors",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
      keepalive
    });
  }

  function enqueue(keepalive = false) {
    const result = tail.then(() => send(keepalive)).catch((error) => ({ error }));
    tail = result.then(() => undefined);
    return result;
  }

  function schedule() {
    if (!endpoint) return;
    if (timer) clearTimeoutImpl(timer);
    timer = setTimeoutImpl(() => {
      timer = null;
      enqueue(false);
    }, debounceMs);
  }

  function flush({ keepalive = true } = {}) {
    if (timer) clearTimeoutImpl(timer);
    timer = null;
    return enqueue(keepalive);
  }

  return { entry, schedule, flush, reset: () => clearEntry(storage) };
}
