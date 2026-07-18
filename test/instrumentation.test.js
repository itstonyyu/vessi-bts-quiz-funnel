import test from "node:test";
import assert from "node:assert/strict";
import {
  addAttributionToUrl,
  createInstrumentation,
  sanitizeAnonymous,
  shopifyAttribution
} from "../src/instrumentation.js";

const pii = {
  entry_id: "entry-1", role: "student", first_name: "Ada", lastName: "Lovelace",
  email: "ada@example.com", phone: "555", school: "Secret University",
  nested: { raw_school_name: "Secret", recommendation: "Weekend Neo" },
  campaign: "accidental@example.com"
};

test("anonymous adapter payload recursively strips PII", () => {
  assert.deepEqual(sanitizeAnonymous(pii), {
    entry_id: "entry-1", role: "student", nested: { recommendation: "Weekend Neo" }, campaign: ""
  });
});

test("GA4 and Shopify receive no PII while Klaviyo identifies only after email", () => {
  const dataLayer = [];
  const learnq = [];
  const shopifyEvents = [];
  const target = {
    dataLayer,
    _learnq: learnq,
    Shopify: {
      customerPrivacy: { analyticsProcessingAllowed: () => true },
      analytics: { publish: (name, properties) => shopifyEvents.push({ name, properties }) }
    }
  };
  const analytics = createInstrumentation({ target, config: { ga4MeasurementId: "G-TEST", klaviyoCompanyId: "COMPANY" }, entry: { entry_id: "entry-1" } });

  analytics.track("quiz_started", pii);
  assert.equal(learnq.some(([command]) => command === "identify"), false, "Klaviyo must not identify before an email exists");
  assert.equal(JSON.stringify(learnq[0]).includes("ada@example.com"), false, "anonymous Klaviyo event must be PII-free");
  analytics.identify({ email: "ada@example.com", first_name: "Ada", last_name: "Lovelace" });
  analytics.track("contact_submitted", pii);

  assert.deepEqual(learnq[1], ["identify", { "$email": "ada@example.com", "$first_name": "Ada", "$last_name": "Lovelace" }]);
  assert.equal(JSON.stringify(dataLayer).includes("ada@example.com"), false);
  assert.equal(JSON.stringify(shopifyEvents).includes("Secret University"), false);
  assert.equal(shopifyEvents.at(-1).name, "vessi_quiz:contact_submitted");
});

test("existing Shopify storefront tags are reused without duplicate script loads", () => {
  const appended = [];
  const klaviyoCommands = [];
  const gtagCalls = [];
  const target = {
    document: {
      scripts: [
        { src: "https://static.klaviyo.com/onsite/js/Mfy22k/klaviyo.js?company_id=Mfy22k" },
        { src: "https://www.googletagmanager.com/gtag/js?id=G-KSS2LH8LPM" }
      ],
      getElementById: () => null,
      head: { appendChild: node => appended.push(node) }
    },
    klaviyo: { push: command => klaviyoCommands.push(command) },
    gtag: (...args) => gtagCalls.push(args),
    dataLayer: []
  };
  const analytics = createInstrumentation({ target, config: { klaviyoCompanyId: "Mfy22k", ga4MeasurementId: "G-KSS2LH8LPM" }, entry: { entry_id: "entry-1" } });
  analytics.initialize();
  analytics.track("quiz_started", { role: "student" });

  assert.equal(appended.length, 0);
  assert.deepEqual(klaviyoCommands, [["track", "quiz_started", { entry_id: "entry-1", campaign: "", role: "student" }]]);
  assert.deepEqual(gtagCalls, [["event", "quiz_started", { entry_id: "entry-1", campaign: "", role: "student", send_to: "G-KSS2LH8LPM" }]]);
});

test("marketing subscription uses Klaviyo's client consent API, requires explicit consent, and is idempotent", async () => {
  const calls = [];
  const target = { fetch: async (...args) => { calls.push(args); return { ok: true, status: 202 }; } };
  const analytics = createInstrumentation({ target, config: { klaviyoCompanyId: "X", klaviyoListId: "LIST" }, entry: { entry_id: "entry-1" } });
  assert.equal(await analytics.subscribe({ email: "ada@example.com" }, false), false);
  assert.equal(await analytics.subscribe({ email: "ada@example.com" }, true), true);
  assert.equal(await analytics.subscribe({ email: "ada@example.com" }, true), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://a.klaviyo.com/client/subscriptions?company_id=X");
  assert.equal(calls[0][1].headers.revision, "2026-07-15");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    data: {
      type: "subscription",
      attributes: {
        profile: { data: { type: "profile", attributes: { email: "ada@example.com", subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } } } },
        custom_source: "Vessi BTS Quiz"
      },
      relationships: { list: { data: { type: "list", id: "LIST" } } }
    }
  });
});

test("once events deduplicate while answers can track changes", () => {
  const target = { dataLayer: [] };
  const analytics = createInstrumentation({ target, config: {}, entry: { entry_id: "entry-1" } });
  assert.equal(analytics.track("quiz_viewed", {}, { once: true }), true);
  assert.equal(analytics.track("quiz_viewed", {}, { once: true }), false);
  assert.equal(analytics.track("quiz_answered", { question_id: "rain", answer: "boots" }), true);
  assert.equal(analytics.track("quiz_answered", { question_id: "rain", answer: "sneakers" }), true);
  assert.deepEqual(target.dataLayer.map(({ event }) => event), ["quiz_viewed", "quiz_answered", "quiz_answered"]);
});

test("Shopify privacy denial blocks all adapters but safe dataLayer fallback works outside Shopify", () => {
  const denied = { dataLayer: [], _learnq: [], Shopify: { customerPrivacy: { analyticsProcessingAllowed: () => false }, analytics: { publish: () => assert.fail("must not publish") } } };
  const deniedAnalytics = createInstrumentation({ target: denied, config: { ga4MeasurementId: "G-X", klaviyoCompanyId: "K-X", klaviyoListId: "LIST" }, entry: { entry_id: "e" } });
  deniedAnalytics.track("quiz_started");
  deniedAnalytics.identify({ email: "private@example.com" });
  deniedAnalytics.subscribe({ email: "private@example.com" }, true);
  assert.equal(denied.dataLayer.length, 0);
  assert.equal(denied._learnq.length, 0);

  const outside = { dataLayer: [] };
  createInstrumentation({ target: outside, config: { ga4MeasurementId: "G-X" }, entry: { entry_id: "e" } }).track("quiz_started");
  assert.equal(outside.dataLayer.length, 1);
});

test("UTM and anonymous entry attribution are added without PII", () => {
  const url = addAttributionToUrl("https://vessi.com/products/neo?color=black", {
    entry_id: "entry-1", utm_source: "quiz", utm_medium: "quiz", utm_campaign: "bts-2026", utm_content: "student-high",
    role: "student", recommendation: "Weekend Neo", intent_bucket: "high_intent"
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("quiz_entry_id"), "entry-1");
  assert.equal(parsed.searchParams.get("utm_campaign"), "bts-2026");
  assert.equal(parsed.searchParams.get("quiz_role"), "student");
  assert.equal(parsed.searchParams.get("quiz_recommendation"), "Weekend Neo");
  assert.equal(parsed.searchParams.get("quiz_intent"), "high_intent");
  assert.equal(parsed.searchParams.get("color"), "black");
  assert.equal(url.includes("email"), false);

  assert.deepEqual(shopifyAttribution({ entry_id: "entry-1", campaign: "bts-2026", role: "student", email: "nope@example.com" }), {
    attributes: { quiz_entry_id: "entry-1", quiz_campaign: "bts-2026", quiz_role: "student" },
    lineItemProperties: { _quiz_entry_id: "entry-1", _quiz_campaign: "bts-2026", _quiz_role: "student" }
  });
});

test("cart attribution posts only with consent and a configured same-origin endpoint", async () => {
  const calls = [];
  const target = {
    location: { origin: "https://vessi.com" },
    Shopify: { customerPrivacy: { analyticsProcessingAllowed: () => true } },
    fetch: async (...args) => calls.push(args), dataLayer: []
  };
  const analytics = createInstrumentation({ target, config: { shopifyCartEndpoint: "/cart/update.js", campaign: "bts" }, entry: { entry_id: "entry-1" } });
  assert.equal(await analytics.persistCartAttribution({ role: "teacher", email: "private@example.com" }), true);
  assert.equal(calls[0][0], "/cart/update.js");
  assert.deepEqual(JSON.parse(calls[0][1].body), { attributes: { quiz_entry_id: "entry-1", quiz_campaign: "bts", quiz_role: "teacher" } });
});
