# Vessi BTS Quiz — launch handoff for Ray

This package is the deployable source for the Vessi back-to-school quiz. Read this file first.

## Launch architecture

```text
Visitor -> https://giveaway.vessi.com (static Vite site on Vercel)
        -> Google Apps Script web-app /exec endpoint
        -> existing Google Sheet

After campaign: Google Sheet CSV -> filter to explicit email consent -> Klaviyo import
```

The browser sends incremental quiz/contact updates and a final completion update. Apps Script upserts by `entry_id`, so the same browser entry updates one row. The browser uses a CORS-simple `text/plain` request in `no-cors` mode; an opaque browser response only proves dispatch. **The Google Sheet is the source of truth for QA.**

## Google Sheets endpoint — installed and verified

The production Apps Script web-app endpoint is already configured in [`quiz-config.js`](quiz-config.js):

```text
https://script.google.com/macros/s/AKfycbxw1xW4ny2HecP72Shyzku59zgBCMAHfNkmTJGG2a3dQQtgBfkDapbDGcH-_wDOjT1aAg/exec
```

It was verified publicly on 2026-07-17: `GET` returned `{"ok":true,"service":"vessi-quiz-sync"}` without authentication. A controlled initial and completed `POST` using the same test `entry_id` both returned `entry_number: 1, row: 2`, confirming successful Sheet writes and upsert behavior. The QA row is labeled `QA TEST — DELETE`, uses `ray-handoff-qa@example.com`, and has `marketing_consent = FALSE`; campaign staff may delete it before launch.

Do not replace this with the redirected `script.googleusercontent.com` URL, a `/dev` URL, or a URL containing `user_content_key`. Do not add Google credentials, API keys, Klaviyo private keys, Shopify tokens, or other secrets. The `/exec` URL is public browser configuration.

The other integration fields in `quiz-config.js` are intentionally blank. Leave `klaviyoCompanyId`, `klaviyoListId`, and `ga4MeasurementId` blank for this launch.

## Local verification

Prerequisite: Node.js 22 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start
```

- Local URL: `http://localhost:5173`
- Build output: `docs/`
- `docs/` is generated; do not hand-edit it.

## Import to Vercel

Unzip this package into a clean Git repository and import that repository in Vercel. Use exactly:

| Vercel setting | Value |
|---|---|
| Scope/team | Vessi's production Vercel team |
| Root Directory | `.` (repository root) |
| Framework Preset | `Vite` |
| Node.js Version | `22.x` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | `docs` |
| Development Command | `pnpm start` (default is also acceptable) |

Do not select `dist`: this repository's [`vite.config.js`](vite.config.js) intentionally sets `build.outDir` to `docs` and `base` to `./`.

The Apps Script `/exec` URL is already installed. Deploy a Vercel preview first, complete the QA below, then promote/deploy to Production. This handoff does not perform any deploy.

## Add `giveaway.vessi.com`

1. In Vercel, open the project, then **Settings -> Domains**.
2. Add `giveaway.vessi.com` and assign it to the Production environment.
3. Vercel will display the DNS record required for the domain. At Vessi's authoritative DNS provider, create that exact record. For a subdomain this is normally:

   ```text
   Type: CNAME
   Name/Host: quiz
   Value/Target: cname.vercel-dns.com
   TTL: Auto/default
   ```

   Use Vercel's displayed target if it differs. Remove or replace any conflicting `giveaway` A, AAAA, or CNAME record; do not change unrelated `vessi.com` records.
4. Wait until Vercel shows the domain as valid and its managed TLS certificate is issued.
5. Confirm `https://giveaway.vessi.com` loads without a certificate warning and HTTP redirects to HTTPS.
6. In Vercel Domains, make `giveaway.vessi.com` the production primary domain or redirect the generated production domain to it if desired.

## Google Apps Script reference

The current server reference is included at [`apps-script/Code.gs`](apps-script/Code.gs). The agreed architecture uses the **existing** Apps Script endpoint; do not create a new Sheet or redeploy the script unless its owner asks.

Directly opening the supplied `/exec` URL should return:

```json
{"ok":true,"service":"vessi-quiz-sync"}
```

The target Sheet must have this exact A:N header row:

```text
entry_number, entry_id, entry_started_at, entry_completed_at, last_updated_at, first_name, last_name, email, country, state_province, type, marketing_consent, consent_date, answers_json
```

If the endpoint owner must update Apps Script, copy the complete included `Code.gs` into the spreadsheet-bound Apps Script project, verify its existing `SPREADSHEET_ID` and `SHEET_NAME`, then deploy a Web app as **Execute as: Me** / **Who has access: Anyone** and supply the resulting `/exec` URL. Do not share account credentials.

## Deployment and QA checklist

### Pre-deploy blockers

- [x] Production Apps Script `/exec` URL is installed in `quiz-config.js`.
- [x] Opening `/exec` publicly returns the expected health JSON; controlled create/update writes succeeded.
- [ ] Campaign/legal owner has replaced or approved the current giveaway terms URL and removed the on-page note saying to swap in final 2026 terms.
- [ ] Product owners have checked the three product links and campaign copy.
- [ ] `klaviyoCompanyId`, `klaviyoListId`, and `ga4MeasurementId` remain blank; no secret exists in source or Vercel client variables.
- [ ] `pnpm test` and `pnpm build` pass.

### Preview QA

- [ ] Welcome screen and all images load with no browser-console 404s.
- [ ] Test desktop (~1440 px), tablet (~768 px), and mobile (~390 px).
- [ ] Complete both Student and Teacher paths.
- [ ] Verify ineligible exits for country `Other`, province `Quebec`, and age under 18 occur before contact collection.
- [ ] Verify required school, first name, last name, valid email, and required giveaway-terms acceptance.
- [ ] Verify the email-marketing checkbox is optional and unchecked by default.
- [ ] Complete one entry and confirm the Sheet row has `entry_completed_at`, expected contact fields, and `answers_json`.
- [ ] In the same browser entry, move back/change an answer and verify the same `entry_id` row is updated, not duplicated.
- [ ] Test once with email marketing unchecked: `marketing_consent` must be `FALSE` and `consent_date` blank.
- [ ] Test once with email marketing checked: `marketing_consent` must be `TRUE` and `consent_date` an ISO timestamp.
- [ ] Verify result recommendation imagery and all CTAs/UTM query parameters.
- [ ] Confirm no Klaviyo, Shopify cart, or live analytics setup is required for the quiz-to-Sheet path.

### Production/domain QA

- [ ] `giveaway.vessi.com` resolves to Vercel and serves valid HTTPS.
- [ ] Repeat one full completed entry on the branded domain and verify the row directly in the Sheet.
- [ ] Confirm no credentials or private keys appear in browser source, requests, Vercel logs, or repository files.
- [ ] Record the deployed Vercel project owner and Apps Script owner for incident routing.

## Consent and post-campaign Klaviyo handoff

There is **no live Klaviyo or Shopify integration required for launch**. Sheet collection is independent of those integrations.

The data has distinct permissions:

- `giveaway_terms_accepted` inside `answers_json` allows campaign entry processing; it is **not email-marketing consent**.
- `marketing_consent = TRUE` plus a populated `consent_date` records explicit email-marketing consent.
- `sms_opt_in` and phone inside `answers_json` are separate from email consent. Do not infer email consent from SMS consent, or SMS consent from email consent.
- A submitted email address by itself is not permission to market.

After the campaign:

1. Export the final Google Sheet as CSV and retain an untouched access-controlled archive for campaign/audit needs.
2. Work from a copy. Restrict Klaviyo candidates to completed rows with a valid email, `marketing_consent = TRUE`, and a valid nonblank `consent_date`. Exclude `FALSE`, blank, malformed, and ambiguous consent rows.
3. Deduplicate by normalized lowercase email according to Vessi's CRM policy while preserving the most appropriate consent evidence and source fields.
4. Parse/flatten approved `answers_json` values into clearly named Klaviyo custom properties (for example entrant type, country/region, school, quiz answers, recommendation/intent, campaign, `entry_id`, and completion time). Do not map `giveaway_terms_accepted` as marketing consent.
5. Import only that consented file into the approved Vessi Klaviyo list. Map `email`, `first_name`, `last_name`, `consent_date`, source `Vessi BTS Quiz`, and approved custom properties. Follow Vessi legal/CRM policy and the target list's single/double-opt-in rules.
6. Do not import phone/SMS subscription status unless the CRM/legal owner separately validates the SMS consent text, evidence, and required fields. Email consent alone cannot subscribe SMS.
7. Spot-check counts and profiles before any send: exported rows, consented rows, excluded rows, deduplicated rows, imported profiles, custom-property mapping, and suppression behavior.
8. Store the export/import files only in an approved access-controlled location; delete local working copies under Vessi's retention policy.

## Explicitly out of scope for launch

- Live Klaviyo profile, list, event, or subscription sync
- Shopify storefront embedding, cart attributes, checkout/order instrumentation, or Admin API work
- GA4/GTM activation and dashboarding
- New Apps Script/Sheet creation when the existing production endpoint works
- Vercel deployment, DNS changes, or Apps Script deployment by the package author
- Private credentials or secrets in this static browser application

## Package contents

- `index.html` — quiz UI and flow
- `quiz-config.js` — public runtime configuration; endpoint goes here
- `src/` — Sheet sync and dormant optional instrumentation adapters
- `public/img/` — source images copied into the build
- `apps-script/Code.gs` — existing endpoint implementation reference
- `package.json`, `pnpm-lock.yaml`, `vite.config.js` — exact build setup
- `test/` — local contract and privacy tests
- `README.md` — full technical reference
- `HANDOFF-RAY.md` — start-here deployment handoff

Generated `docs/`/`dist/`, `node_modules/`, Git metadata, caches, and secrets are intentionally excluded from the ZIP.
