# Vessi Back-to-School Quiz

Single-page Vite quiz funnel for matching students and educators to a Vessi back-to-school shoe recommendation and giveaway entry path.

## Run Locally

```sh
pnpm install
pnpm start
```

Build the static site with:

```sh
pnpm test
pnpm build
```

`vite.config.js` writes the production build to `docs/` with a relative asset base so it can be hosted as static files. Treat `docs/`, `dist/`, and `node_modules/` as generated artifacts unless the deployment target changes.

## Google Sheets synchronization

The quiz creates an `entry_id` and `entry_started_at` once in `localStorage`, then sends coalesced updates after answers and entry-form changes. Final submission immediately flushes a keepalive write. Network failures are contained and never block quiz navigation. The server upserts on `entry_id`, serializes writes with `LockService`, and assigns `entry_number` itself; a client-provided number is never accepted.

### Deploy the spreadsheet-bound Apps Script (manual)

No live deployment is performed by this repository. The owner of spreadsheet `1xGJ79KR1jhclM9RzZYEqxMMyhhSEGnaaaRuZPd51KVw` must:

1. Open the spreadsheet, then choose **Extensions → Apps Script**.
2. Replace the editor's `Code.gs` with the complete contents of [`apps-script/Code.gs`](apps-script/Code.gs). Confirm the spreadsheet ID and `SHEET_NAME = "Sheet1"` at the top.
3. Confirm row 1, columns A:N exactly match: `entry_number, entry_id, entry_started_at, entry_completed_at, last_updated_at, first_name, last_name, email, country, state_province, type, marketing_consent, consent_date, answers_json`.
4. Click **Deploy → New deployment**, select **Web app**, set **Execute as: Me**, and set **Who has access: Anyone**. Authorize spreadsheet access and click **Deploy**.
5. Copy the web-app URL ending in `/exec` (not the `/dev` test URL). Opening it in a browser should return `{"ok":true,"service":"vessi-quiz-sync"}`.
6. Paste that `/exec` URL into `quiz-config.js` as `googleSheetsEndpoint`, then run `pnpm build` and deploy the generated `docs/` site.
7. Complete one test entry on the deployed site and verify one row is created and subsequent answers for the same browser entry update that row rather than append another.

The endpoint URL is public configuration, not a credential; never put Google credentials or other secrets in the client. The browser intentionally uses a CORS-simple `text/plain` POST with `mode: "no-cors"`, because Apps Script ContentService responses/redirects do not provide dependable browser-readable CORS headers. Therefore the client can know a request was dispatched but cannot read the JSON response. `doGet` and `doPost` still return JSON for direct callers and diagnostics. Validation and write success are authoritative on the Apps Script side.

Run the local, Google-free synchronization and Apps Script contract tests with `pnpm test`.

## Privacy-safe analytics and commerce attribution

All public activation values live in [`quiz-config.js`](quiz-config.js). Blank values disable an integration without affecting the quiz. Do **not** add Klaviyo private keys, GA credentials, Shopify Admin tokens, or Google credentials to this client-side file.

```js
window.VESSI_QUIZ_CONFIG = Object.freeze({
  googleSheetsEndpoint: "https://script.google.com/macros/s/DEPLOYMENT/exec",
  klaviyoCompanyId: "PUBLIC_COMPANY_ID",
  klaviyoListId: "MARKETING_LIST_ID",
  klaviyoRevision: "2026-07-15",
  klaviyoConsentSource: "Vessi BTS Quiz",
  ga4MeasurementId: "G-XXXXXXXXXX",
  campaign: "bts-2026",
  shopifyEventPrefix: "vessi_quiz",
  utmSource: "vessi_quiz",
  utmMedium: "quiz",
  shopifyCartEndpoint: "/cart/update.js"
});
```

### Activation checklist (manual; not performed by this repository)

1. **Klaviyo:** copy the account's public Company/Site ID and the intended email marketing list ID into the config. Confirm that the list is configured for the desired single- or double-opt-in behavior and that consent text/legal basis are approved. Use Klaviyo's event/profile debugger to verify the custom events. The quiz queues anonymous, PII-stripped funnel events before contact, calls `identify` only after a valid email is submitted, and calls Klaviyo's official client subscription API only when the optional email-marketing checkbox is explicitly checked. A final profile update contains first/last/email, country/region, entrant type, school, answer values, recommendation, intent, entry ID, start/completion time, and consent metadata. Phone/SMS data is intentionally not sent to Klaviyo by this integration.
2. **GA4:** create/select the Web data stream and paste its `G-...` Measurement ID. Register useful custom dimensions such as `entry_id`, `campaign`, `role`, `question_id`, `answer`, `recommended_product`, and `intent_bucket`. Do not create dimensions from PII. Validate with DebugView after deploying to an approved test URL.
3. **Shopify:** set `shopifyCartEndpoint` to `/cart/update.js` only after the quiz is served on the Shopify storefront origin. The adapter checks `Shopify.customerPrivacy.analyticsProcessingAllowed()` (or `userCanBeTracked()` when available), blocks Klaviyo/GA4/Shopify behavioral analytics and attribution when Shopify explicitly denies analytics, and publishes namespaced `vessi_quiz:*` custom events through Shopify analytics when available. An entrant's explicit checked request to join the Klaviyo marketing list is sent through Klaviyo's consent endpoint independently of behavioral-cookie consent. Outside Shopify it makes no cart request and uses the PII-free `dataLayer` fallback.
4. **Product/cart theme handoff:** result links carry `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, optional `affiliate_id`, and anonymous `quiz_entry_id`. On a consented Shopify storefront, a product click also writes `quiz_entry_id`, `quiz_campaign`, `quiz_role`, `quiz_recommendation`, and `quiz_intent` cart attributes. To preserve **line-item** attribution too, have the eventual product form read the `quiz_entry_id` query parameter and render hidden inputs named `properties[_quiz_entry_id]`, `properties[_quiz_campaign]`, `properties[_quiz_role]`, `properties[_quiz_recommendation]`, and `properties[_quiz_intent]`; populate only these anonymous values. Confirm those properties and cart attributes appear on a test order. No Admin API is needed.
5. **Consent QA:** test Shopify's analytics allowed and denied states. If consent changes after this static page has loaded, reload/navigate back to the quiz after the consent UI updates so configured third-party scripts initialize under the new state. Review the final behavior with privacy/legal owners before launch.
6. Run `pnpm test && pnpm build`, deploy `docs/`, then verify all seven event names in GA4/Shopify/Klaviyo test tools: `quiz_viewed`, `quiz_started`, `quiz_answered`, `contact_submitted`, `quiz_completed`, `result_viewed`, and `product_clicked`.

GA4 and Shopify payloads are recursively stripped of email, names, phone, raw school fields, and similarly named nested fields. They receive only anonymous `entry_id` plus quiz/campaign metadata. One-time milestones are deduplicated for the page lifecycle; `quiz_answered` deliberately records changed answers after back navigation.


## Conversion Flow Smoke

- Welcome screen loads with product imagery, campaign copy, and `Find My Match`.
- Student path: role -> country -> region -> age -> five quiz questions -> match preview -> school -> contact -> terms -> result.
- Teacher path: role -> country -> region -> age -> five quiz questions -> match preview -> school -> contact -> terms -> result.
- Eligibility exits: `Other` country, `Quebec`, and `under 18` should show the ineligible screen before collecting contact details.
- Contact validation blocks missing first name, last name, email, invalid email, missing school, and unchecked terms.
- Result screen should show the recommended product, profile summary, `Shop My Match` CTA with UTM parameters, Vessi fallback CTA, and restart control.

## Responsive QA Checklist

- Check desktop around 1440px wide: split brand/quiz layout, no clipped hero copy, visible shoe art, and card centered.
- Check tablet around 768px wide: brand panel stacks above quiz, form fields remain usable, and product cards do not overlap.
- Check mobile around 390px wide: options and form fields collapse to one column, action buttons fill the width, and long labels wrap cleanly.
- Confirm product images load from `img/` in local dev and from copied assets after `pnpm build`.
- Confirm `window.dataLayer` receives quiz events during the happy path and result CTA clicks.
