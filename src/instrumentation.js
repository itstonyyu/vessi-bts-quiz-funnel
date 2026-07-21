const PII_KEYS = new Set([
  "email", "$email", "first", "first_name", "firstname", "last", "last_name", "lastname",
  "name", "full_name", "phone", "phone_number", "school", "school_name", "raw_school_name",
  "organization", "sms_opt_in"
]);

function normalizedKey(key) {
  return String(key).replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

export function sanitizeAnonymous(value) {
  if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "";
  if (Array.isArray(value)) return value.map(sanitizeAnonymous);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !PII_KEYS.has(normalizedKey(key)))
    .map(([key, item]) => [key, sanitizeAnonymous(item)]));
}

export function addAttributionToUrl(url, attribution = {}) {
  const output = new URL(url, globalThis.location?.href || "https://example.invalid/");
  const allowed = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "affiliate_id"];
  for (const key of allowed) if (attribution[key]) output.searchParams.set(key, attribution[key]);
  if (attribution.entry_id) output.searchParams.set("quiz_entry_id", attribution.entry_id);
  const quizValues = {
    quiz_campaign: attribution.campaign || attribution.utm_campaign,
    quiz_role: attribution.role,
    quiz_recommendation: attribution.recommendation,
    quiz_intent: attribution.intent_bucket
  };
  for (const [key, value] of Object.entries(quizValues)) if (value) output.searchParams.set(key, value);
  return output.toString();
}

export function shopifyAttribution(properties = {}) {
  const safe = sanitizeAnonymous(properties);
  const values = {
    quiz_entry_id: safe.entry_id || "",
    quiz_campaign: safe.campaign || "",
    quiz_role: safe.role || "",
    quiz_recommendation: safe.recommendation || "",
    quiz_intent: safe.intent_bucket || ""
  };
  const attributes = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
  return {
    attributes,
    lineItemProperties: Object.fromEntries(Object.entries(attributes).map(([key, value]) => [`_${key}`, value]))
  };
}

function shopifyTrackingAllowed(target) {
  const privacy = target.Shopify?.customerPrivacy;
  if (!privacy) return true;
  try {
    if (typeof privacy.analyticsProcessingAllowed === "function") return Boolean(privacy.analyticsProcessingAllowed());
    if (typeof privacy.userCanBeTracked === "function") return Boolean(privacy.userCanBeTracked());
  } catch (_) {
    return false;
  }
  return false;
}

function loadScript(target, src, id) {
  const document = target.document;
  if (!document || !src || document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function createInstrumentation({ target = globalThis, config = {}, entry = {}, logger = null } = {}) {
  const onceEvents = new Set();
  let subscribedEmail = "";
  const metaEvents = {
    quiz_started: ["trackCustom", "QuizStarted"],
    contact_submitted: ["track", "Lead"],
    quiz_completed: ["track", "CompleteRegistration"],
    result_viewed: ["track", "ViewContent"],
    product_clicked: ["trackCustom", "ProductClicked"]
  };

  function allowed() {
    return shopifyTrackingAllowed(target);
  }

  function pushKlaviyo(command) {
    if (target.klaviyo && typeof target.klaviyo.push === "function") {
      target.klaviyo.push(command);
      return;
    }
    target._learnq = target._learnq || [];
    target._learnq.push(command);
  }

  function initialize() {
    if (config.klaviyoCompanyId && allowed()) {
      target._learnq = target._learnq || [];
      const existing = target.document && Array.from(target.document.scripts || []).some(script => script.src?.includes(`company_id=${config.klaviyoCompanyId}`) || script.src?.includes(`/js/${config.klaviyoCompanyId}/`));
      if (!target.klaviyo && !existing) loadScript(target, `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${encodeURIComponent(config.klaviyoCompanyId)}`, "vessi-klaviyo");
    }
    if (config.ga4MeasurementId && allowed()) {
      target.dataLayer = target.dataLayer || [];
      target.gtag = target.gtag || function gtag() { target.dataLayer.push(arguments); };
      const existing = target.document && Array.from(target.document.scripts || []).some(script => script.src?.includes(`id=${config.ga4MeasurementId}`));
      if (!existing) {
        target.gtag("js", new Date());
        target.gtag("config", config.ga4MeasurementId, { send_page_view: false });
        loadScript(target, `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4MeasurementId)}`, "vessi-ga4");
      }
    }
  }

  function identify(profile = {}) {
    const email = String(profile.email || profile.$email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || !config.klaviyoCompanyId || !allowed()) return false;
    const properties = {
      "$email": email,
      ...(profile.first_name || profile.first ? { "$first_name": profile.first_name || profile.first } : {}),
      ...(profile.last_name || profile.last ? { "$last_name": profile.last_name || profile.last } : {}),
      ...(profile.phone ? { "$phone_number": profile.phone } : {}),
      ...Object.fromEntries(Object.entries(profile).filter(([key]) => !["email", "$email", "first", "first_name", "last", "last_name", "phone"].includes(key)))
    };
    pushKlaviyo(["identify", properties]);
    return true;
  }

  async function subscribe(profile = {}, explicitConsent = false) {
    const email = String(profile.email || "").trim().toLowerCase();
    if (!explicitConsent || !email || !config.klaviyoCompanyId || !config.klaviyoListId || subscribedEmail === email || typeof target.fetch !== "function") return false;

    const profileAttributes = {
      email,
      ...(profile.phone ? { phone_number: profile.phone } : {}),
      subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } }
    };
    const body = {
      data: {
        type: "subscription",
        attributes: {
          profile: { data: { type: "profile", attributes: profileAttributes } },
          custom_source: config.klaviyoConsentSource || "Vessi BTS Quiz"
        },
        relationships: { list: { data: { type: "list", id: config.klaviyoListId } } }
      }
    };

    try {
      const response = await target.fetch(`https://a.klaviyo.com/client/subscriptions?company_id=${encodeURIComponent(config.klaviyoCompanyId)}`, {
        method: "POST",
        headers: {
          accept: "application/vnd.api+json",
          "content-type": "application/vnd.api+json",
          revision: config.klaviyoRevision || "2026-07-15"
        },
        body: JSON.stringify(body),
        keepalive: true
      });
      if (!response?.ok) return false;
      subscribedEmail = email;
      return true;
    } catch (_) {
      return false;
    }
  }

  function track(name, properties = {}, { once = false, klaviyoProperties } = {}) {
    const key = `${entry.entry_id || "anonymous"}:${name}`;
    if (once && onceEvents.has(key)) return false;
    if (once) onceEvents.add(key);

    const safe = { entry_id: entry.entry_id || "", campaign: config.campaign || "", ...sanitizeAnonymous(properties) };
    if (config.klaviyoCompanyId && allowed()) pushKlaviyo(["track", name, klaviyoProperties || safe]);

    if (allowed()) {
      const metaEvent = metaEvents[name];
      if (metaEvent && typeof target.fbq === "function") {
        const { entry_id: _entryId, ...metaProperties } = safe;
        target.fbq(metaEvent[0], metaEvent[1], metaProperties);
      }
      if (target.Shopify) {
        if (typeof target.Shopify.analytics?.publish === "function") {
          const prefix = config.shopifyEventPrefix || "vessi_quiz";
          target.Shopify.analytics.publish(`${prefix}:${name}`, safe);
        }
        if (config.ga4MeasurementId && typeof target.gtag === "function") target.gtag("event", name, { ...safe, send_to: config.ga4MeasurementId });
      } else if (config.ga4MeasurementId && typeof target.gtag === "function") {
        target.gtag("event", name, { ...safe, send_to: config.ga4MeasurementId });
      } else {
        target.dataLayer = target.dataLayer || [];
        target.dataLayer.push({ event: name, ...safe });
      }
    }
    if (logger) logger(name, safe);
    return true;
  }

  async function persistCartAttribution(properties = {}) {
    if (!target.Shopify || !allowed() || !config.shopifyCartEndpoint || typeof target.fetch !== "function") return false;
    const endpoint = config.shopifyCartEndpoint;
    if (!endpoint.startsWith("/")) return false;
    const { attributes } = shopifyAttribution({ entry_id: entry.entry_id, campaign: config.campaign, ...properties });
    try {
      await target.fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes }),
        keepalive: true
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  return { initialize, identify, subscribe, track, persistCartAttribution, attribution: shopifyAttribution };
}
