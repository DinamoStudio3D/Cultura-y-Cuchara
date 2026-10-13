# Public contrast and installation audit — V55

Scope: `design/modernizacion-web-v1`, based on `6a6d6dac2130a2e207961dcca56618b29c70b6ea` (V54). Production is outside this change.

## Changes

- Consolidate homepage layout styles into `css/public-layout.css` in their original order. Retire legacy foreground declarations, redundant emergency color patches and unused install-banner rules.
- Own foregrounds in `css/public-colors.css` with explicit light/dark surface tokens and an ordered cascade layer. Nested cards, form controls, buttons and dynamically injected content reset their surface tokens.
- Share the color contract with 12 additional public pages: business details, visitor loyalty, QR visits, allies, plans, shop, business registration, tourism board, privacy, terms, reviews and application status.
- Give custom campaign buttons a measured black/white foreground; darken configurable campaign gradients behind text.
- Reuse the existing ILE signature instead of injecting a second badge. Keep it within the copy column.
- Remove the floating installation component and its event handlers. Installation is offered only through the footer when the browser supplies an install prompt. Dismissal consumes that prompt; no automatic prompt or reminder is scheduled. Installed apps hide the action.
- Precache the extracted styles and new scripts and bump the offline shell cache.

## Verification

- `node scripts/validate-site.mjs`: passed.
- `node --test scripts/test-app-install.mjs scripts/test-public-colors.mjs scripts/test-public-cache.mjs`: 7 passed. Includes 4096 custom RGB background combinations at normal-text AA contrast, dismissed/duplicate installation requests and navigation cache writes.
- `npm test --prefix functions`: 77 passed.
- PostCSS parsing of both stylesheets: passed. `git diff --check`: passed.
- Chromium + axe-core `color-contrast`, 1440×900 and 390×900: 42 views/states, 0 detected violations, 0 uncaught page JavaScript errors. Homepage sections, menu, account/passport/route/recommendation/event/story/restaurant dialogs, and the 12 additional public pages were checked.

## Limits

Local browser verification used locally compiled Tailwind 3.4.17 utilities and cached copies of external script/style dependencies, because this container's browser does not trust the network proxy certificate. External images and live Firebase requests were unavailable in that local run. The live Preview must also be inspected after deployment.

Axe reports some indeterminate image/gradient/overlap cases for manual review; zero detected violations is not a certification of every possible runtime state. Empty/fallback public states were checked without signing in, changing business records, sending forms, making purchases or registering a real QR visit. Authentication-dependent flows and administrator-configured content require further end-to-end checks with representative authorized test data. Backend unit tests were run; real Firebase/QR writes were not performed.
