# Changelog

All notable MatrixFlow AI changes are documented here. Versions follow semantic versioning for the product shell; the Appwrite Function keeps its own compatible runtime version.

## [0.4.1] - 2026-08-29

### Interaction polish

- Expanded authentication helper, recovery, registration, and legal-link touch targets to the 44px mobile baseline.
- Aligned the registration agreement control with the same minimum touch-target rule.

## [0.4.0] - 2026-08-29

### Visual system

- Rebuilt the public, authentication, pricing, and dashboard visual language around a system-font hierarchy, restrained brand color, quiet material layers, consistent radii, and purpose-driven motion.
- Replaced visible grids and sweep effects with slow, irregular ambient light that continues naturally between landing sections and remains subtle behind product content.
- Simplified dashboard navigation to a single scannable label layer and aligned cards, status pills, controls, dialogs, empty states, and page headings with the shared component system.
- Refined the locale switcher into a compact, consistent control for Simplified Chinese, Traditional Chinese, and English.

### Interaction and accessibility

- Raised tertiary and helper-copy size floors to 12px and standardized primary touch targets around 44px on narrow screens.
- Added reduced-transparency handling alongside the existing reduced-motion and high-contrast behaviors.
- Removed sticky hover translation on touch devices, improved focus treatment, and corrected icon/text and authentication-helper spacing.
- Preserved the complete public journey at the 320px minimum width without horizontal overflow in every locale.

### Product clarity

- Shortened the landing eyebrow and replaced infrastructure-specific pricing copy with user-facing model-provider guidance.
- Reduced excessive hero height and visual saturation while retaining the organic ambient background requested for the product.
- Documented the UI tokens, hierarchy, motion, responsive, and accessibility rules for future maintenance.

### Verification

- Formatting, schema and i18n audits, type checking, linting, unit tests, production build, Axe accessibility checks, and Playwright public journeys pass.

## [0.3.2] - 2026-08-25

### Security and reliability

- Kept `background_jobs` on the Function-only permission boundary while adding server-side pagination and summary-field redaction; browser clients never read job payloads, results, errors, or worker leases directly.
- Added finite bounds and safe fallbacks for malformed list pagination values to prevent invalid Appwrite queries and accidental resource pressure.
- Replaced non-cryptographic random fallbacks for idempotency and worker lease identifiers with secure UUID generation.
- Restricted avatar data URIs to the exact generated preset SVG shape, blocking arbitrary SVG markup from entering image rendering.
- Removed invitation and password-reset secrets from browser history immediately after capture and set no-referrer metadata on those flows.
- Added `noreferrer` to external-context registration links.

### Verification

- Function checks and 79 Function tests pass.
- Type checking, linting, schema and i18n audits, production build, and dependency audits remain clean.

## [0.3.1] - 2026-08-23

### Improved

- Added a task-center list path with 25-row pagination and aligned sidebar prefetching with the paginated cache.
- Kept task payloads, results, errors, worker leases, and internal execution fields out of browser list responses; cancellation and job-detail operations still use the protected Function.

## [0.3.0] - 2026-08-23

### Added

- Localized list toolbar with current-page filtering, clear actions, and live result counts for AI workers, knowledge bases, workflows, and background jobs.
- Paginated knowledge documents, content projects, and workflow run history with navigation busy states.
- Explicit knowledge upload and indexing progress feedback.
- Background-job status filtering across all supported locales.

### Improved

- Limited knowledge-document and workflow-run aggregation to resources on the requested page, reducing unnecessary organization-wide reads.
- Aligned content-project prefetch keys with paginated queries so navigation warming is reused by the destination page.
- Standardized content, knowledge, and run-history headers, empty states, error states, status pills, and pagination surfaces.
- Reset page-scoped filters and selections during pagination to prevent stale or invisible selections.
- Kept server-rendered locale cookies authoritative over stale browser storage, preventing post-hydration language changes.
- Corrected locale-specific dashboard greeting punctuation.

### Accessibility and quality

- Removed entry-opacity blending that temporarily reduced primary-button contrast below WCAG AA.
- Verified the full public journey at 320 px and 390 px, across Simplified Chinese, Traditional Chinese, and English.
- Passed type checking, linting, unit and production-audit tests, production build, and all 10 Playwright journeys.

## [0.2.0] - 2026-08-20

### Added

- Responsive task center for queued, running, retrying, completed, failed, and canceled background jobs.
- Reusable localized pagination controls and paginated Agents, knowledge base, content project, and workflow API contracts.
- Release-readiness audit in CI and explicit production-Beta release criteria.
- Automated Axe WCAG checks for the complete public journey and all supported locales.
- Request timeout and view-level cancellation support in the web API client.

### Improved

- Unified card, input, button, status, typography, focus, contrast, and mobile interaction styling.
- Compact 320 px landing experience, accessible English hero text, and a visible mobile pricing path.
- Locale-safe API error presentation that no longer exposes raw Appwrite or provider messages.
- Data-aware dashboard prefetch that respects reduced-data and slow-network preferences.
- Workflow canvas theme consistency and responsive controls.
- Workflow, CRM conversation, and CRM lead hydration to remove per-row N+1 reads.
- README, API, operations, product-readiness, and security documentation formatting and release guidance.

### Security and reliability

- Production infrastructure now requires an AI Provider to be configured before reporting ready.
- Provider, Function, tenant isolation, billing boundaries, API keys, jobs, schema, i18n, build, and public browser journeys remain covered by automated checks.

### External activation still required

- Stripe checkout, connector OAuth/egress allowlists, enterprise SSO/SCIM, alert destinations, backup evidence, restore-drill evidence, and multi-region workers require operator-owned credentials or infrastructure and are not silently simulated.
