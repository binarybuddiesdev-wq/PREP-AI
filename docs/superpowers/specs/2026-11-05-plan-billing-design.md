# Plan and Billing Design

## Intent

Add the prototype's Plan experience to the existing Settings screen so a signed-in user can understand their server-assigned plan and quotas, start monthly or yearly Premium checkout, and schedule cancellation at the end of the paid period.

## Goals

- Show Free, Premium, or Admin based on the authenticated user's server profile.
- Show practice-session, question-per-session, coding-solve, and AI-review limits and current daily usage from server responses.
- Read the current subscription and clearly represent creation, provider checkout, pending, active, cancellation-scheduled, halted, completed, expired, and failed request states.
- Create a subscription using only the `monthly` or `yearly` enum and the existing idempotency contract.
- Open only the backend-provided Razorpay hosted checkout URL. The browser never collects payment credentials or claims payment success.
- Schedule cancellation through the existing end-of-cycle endpoint and show the current period end.
- Keep loading, retry, and error states actionable and preserve the Settings page when billing calls fail.

## Non-goals

- No client-entered card, CVV, OTP, UPI PIN, or bank details.
- No simulated payment approval, receipt, entitlement, or success screen.
- No hardcoded subscription prices. The configured Razorpay plan is authoritative and displays its amount in hosted checkout.
- No immediate cancellation, self-service refund, plan changes while a subscription is in progress, or frontend entitlement enforcement.
- No production Razorpay key or webhook rollout.

## Constraints

- Follow ADR-0009's `core -> service -> logic -> components -> pages -> app` boundaries.
- Use the existing authenticated `useApiClient`, TanStack Query, and user-scoped query keys.
- Preserve existing payment API behavior and idempotency semantics.
- Keep all quota values server-owned. The coding stats endpoint already returns solve and review usage; add an authenticated theory stats endpoint for practice usage and question limits.
- If Razorpay is not configured, keep the current plan and quota view available and show the server's checkout error when an upgrade is requested.

## Approaches considered

1. Add a separate billing route and navigation item. This provides room for expansion but diverges from the prototype's Plan settings tab.
2. Add a Plan tab to Settings and keep its API state in page/logic layers. This matches the prototype and reuses the compact settings frame; selected.
3. Put checkout and plan state in the dashboard. This spreads billing concerns across the app and makes plan management harder to find; rejected.

The user delegated continuation of the roadmap without an approval pause. The selected approach is therefore the implementation call for this feature.

## Design

Add `Plan` to the existing accessible Settings tab list. Lift the selected tab into `SettingsPage` so payment and quota readers are enabled only while Plan is selected. The plan panel receives plain data and callbacks; it does not call APIs.

Add authenticated `GET /api/v1/theory/stats` returning today's UTC practice-session usage and server-calculated daily session and questions-per-session limits. Reuse the exact quota key and role limits used by theory session creation. Combine it with existing `GET /api/v1/coding/stats`, `GET /api/v1/users/me`, and the current subscription payment endpoint.

Add typed payment API functions and TanStack Query readers/commands. Start requests retain one idempotency key across retries. A successful start exposes a deliberate link to the returned hosted checkout URL in a new tab. The current-subscription query polls only while provider state can still change. Cancellation is a two-step in-page confirmation and calls the existing cycle-end endpoint.

Use descriptive plan-term cards without dollar/rupee amounts. Show the configured amount only on Razorpay's hosted page. Refresh the profile, subscription, and relevant usage queries after successful commands or terminal payment-state changes.

## Acceptance

- Plan tab is keyboard accessible and matches current Settings density and theme.
- Free/Premium/Admin label and all displayed quotas originate in authenticated API data.
- Unauthenticated readers stay disabled; all data is keyed to the Clerk user.
- Creating checkout sends only the chosen term and idempotency header; unsafe or absent checkout URLs are never rendered as links.
- Checkout/pending/provider errors never render a success claim or hide the rest of Settings.
- Cancellation requires explicit confirmation and displays the period end until paid access expires.
- Focused backend and UI tests, full relevant gates, and browser visual checks pass.
