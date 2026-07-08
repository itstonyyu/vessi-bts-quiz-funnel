# Vessi Back-to-School Quiz

Single-page Vite quiz funnel for matching students and educators to a Vessi back-to-school shoe recommendation and giveaway entry path.

## Run Locally

```sh
pnpm install
pnpm start
```

Build the static site with:

```sh
pnpm build
```

`vite.config.js` writes the production build to `docs/` with a relative asset base so it can be hosted as static files. Treat `docs/`, `dist/`, and `node_modules/` as generated artifacts unless the deployment target changes.

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
