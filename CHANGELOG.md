# Changelog

All notable MatrixFlow AI changes are documented here. Versions follow semantic versioning for the product shell; the Appwrite Function keeps its own compatible runtime version.

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
