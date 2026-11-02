# Daily AI token budget

## Goal

Limit daily provider token use by user for theory answer evaluation, using the existing Redis quota architecture and the user role stored in MongoDB.

## Design

- Add role-based daily limits, configurable through `AI_DAILY_TOKENS_FREE` and `AI_DAILY_TOKENS_PREMIUM`; defaults are 400,000 and 2,000,000 tokens.
- Use UTC-day Redis keys. Atomically reserve token estimates before provider calls so concurrent jobs cannot all spend the same remaining budget.
- Bound each generation to 512 output tokens. Estimate a conservative per-attempt reservation from UTF-8 prompt and instruction bytes plus 768 tokens of output/schema allowance. Reserve separately for each provider attempt so NVIDIA-to-Groq failover is accounted for.
- On success, settle the reservation to Mastra-reported total token usage. If usage is absent or settlement fails, retain the estimate and log the issue; never repeat a successful model call because Redis settlement failed.
- Keep failed provider attempts reserved at their estimate because exact token usage is unavailable; this errs toward preventing excess spend.
- If a reservation is denied, mark the queued answer failed with a user-readable daily-budget message and do not call the provider. If Redis or role lookup fails, fail the job closed without calling the provider.
- Do not persist token usage in PostgreSQL in this first implementation; Redis is the enforcement counter and expires at UTC midnight.

## Non-goals

- Billing, money-based cost tracking, token-budget UI, provider usage reconciliation, or changes to theory session/question quotas.
- Applying the budget to the offline evaluator CLI.

## Risks and limitations

Failed provider attempts are charged at their conservative reservation because the provider may have processed them even when the request failed. Redis loss resets the daily budget, matching the current quota system's documented limitation. The configured limits are initial defaults and can be adjusted in `.env`.
