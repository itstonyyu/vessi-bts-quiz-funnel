// Public browser identifiers and endpoints only. Never put private API keys here.
// Leave an integration value blank to disable that integration safely.
window.VESSI_QUIZ_CONFIG = Object.freeze({
  // Production Apps Script web-app endpoint. Public browser configuration, not a private key.
  googleSheetsEndpoint: "https://script.google.com/macros/s/AKfycbxw1xW4ny2HecP72Shyzku59zgBCMAHfNkmTJGG2a3dQQtgBfkDapbDGcH-_wDOjT1aAg/exec",
  klaviyoCompanyId: "",
  klaviyoListId: "",
  klaviyoRevision: "2026-07-15",
  klaviyoConsentSource: "Vessi BTS Quiz",
  ga4MeasurementId: "",
  campaign: "bts-2026",
  shopifyEventPrefix: "vessi_quiz",
  utmSource: "vessi_quiz",
  utmMedium: "quiz",
  // Runs only when hosted on a Shopify storefront; ignored elsewhere.
  // A relative URL is required; cross-origin cart writes are intentionally rejected.
  shopifyCartEndpoint: "/cart/update.js"
});
