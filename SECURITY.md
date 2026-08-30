# Security Policy

PrepAI takes the security of the platform seriously. This document explains
how to report a vulnerability, what we promise when you do, and the
versions we currently support.

## Supported versions

| Version                            | Supported                              |
| ---------------------------------- | -------------------------------------- |
| `main`                             | :white_check_mark: Active development  |
| latest tagged release              | :white_check_mark: Best-effort patches |
| anything older than the latest tag | :x: No patches                         |

Until we cut the first tagged release (`v0.1.0`) the only supported line is
`main`. We will not backport fixes to historic commits.

## Reporting a vulnerability

**Please do not file a public issue for suspected vulnerabilities.**

Use one of these private channels — both go directly to the maintainers:

1. **GitHub Security Advisories** (preferred)
   <https://github.com/anomalyco/PrepAI/security/advisories/new>
   Draft is private until published. Attach a reproducer, log slice,
   or PoC commit.
2. **Email**
   `security@prepai.dev` (replace with the address you publish)
   PGP key fingerprint: `0000 0000 0000 0000 0000 0000 0000 0000 0000 0000`

Include in your report:

- The component and version (`server`, `ui`, `mastra`, `piston`, `prisma`, …)
- A reproducible proof of concept, ideally as a failing test or curl invocation
- The impact you observe (data exposure, auth bypass, DoS, RCE, …)
- Whether you are OK with public acknowledgement after the fix lands

### What we promise

- **Acknowledgement** within 2 business days of your report
- **Triage decision** (accepted / out of scope / duplicate) within 5 business days
- **Status updates** every 7 calendar days until the fix lands
- **Credit** in the release notes if you want it (you can stay anonymous)
- **No legal action** against researchers acting in good faith and within
  the [scope](#scope) below

### What we ask

- Give us a reasonable window to fix before public disclosure
  (default 90 days, negotiable)
- Stop once you have demonstrated the vulnerability — do not enumerate
  further accounts, scrape data, or run destructive tests against
  production
- Do not exfiltrate user data, even to prove a point

## Scope

In scope for this program:

| Area                             | Examples                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/`                        | Auth bypass (ClerkAuthGuard), IDOR on user data, SQL/NoSQL injection in Prisma queries, SSRF to Clerk / Razorpay / Cloudinary / Resend, webhook signature forgery, rate-limit evasion, file-upload RCE via Cloudinary or multipart parsing |
| `server/src/mastra/`             | Prompt injection that exfiltrates user data, model-output XSS when rendered in the UI, schema-evasion attacks that bypass structured-output validation                                                                                     |
| `ui/`                            | Stored XSS through AI output, Clerk token leakage, CSRF on state-changing endpoints, open-redirect on `useApiClient`                                                                                                                       |
| `piston-cli/`, `types/piston.ts` | Container escape from Piston, host filesystem write, network egress from the sandbox                                                                                                                                                       |
| `.github/workflows/`             | Workflow injection via PR titles / commit messages, supply-chain on Actions versions                                                                                                                                                       |
| Secrets in repo history          | API keys, OAuth client secrets, database connection strings committed accidentally                                                                                                                                                         |

Out of scope:

- Self-XSS that requires the user to paste content into devtools
- Volumetric DoS against hosted infrastructure (we are not paying for that)
- Missing security headers on the marketing landing page only
- Issues that require a valid Clerk admin session
- Best-practice nits that have no concrete exploit path

## Safe harbour

We will not pursue civil or criminal action against researchers who:

- Make a good-faith effort to avoid privacy violations, destruction of
  data, or interruption/degradation of our service
- Only interact with accounts they own or have explicit permission for
- Stop testing immediately if they encounter user data and notify us
  before any further action

## Hall of fame

Reported issues and their reporters are listed in
`docs/SECURITY_HALL_OF_FAME.md` after the fix lands.

## Bug bounty

There is **no monetary bug bounty** at this time. We credit researchers
publicly and are happy to issue reference letters.

## Contact

- Private disclosure: GitHub Security Advisories or `security@prepai.dev`
- General questions: open an issue labelled `question`
- Status page: see `docs/runbooks/` (planned, see
  `docs/architecture/TODO.md`)

Thank you for keeping PrepAI's users safe.
