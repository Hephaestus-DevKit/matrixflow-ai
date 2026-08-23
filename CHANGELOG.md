# Changelog

All notable MatrixFlow AI changes are documented here. Versions follow semantic versioning for the product shell; the Appwrite Function keeps its own compatible runtime version.

## [0.3.1] - 2026-08-23

### Improved

- Replaced the task-center list Function invocation with tenant-scoped Appwrite row reads, avoiding Function cold-start latency on the main jobs view.
- Added 25-row task pagination and aligned sidebar prefetching with the paginated cache.
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
