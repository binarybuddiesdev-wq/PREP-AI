# ADR Template (Michael Nygard format)

Copy this file to `NNNN-short-title.md` and fill in. Number sequentially;
**never** re-number or delete — superseded ADRs are marked `Status: Superseded
by ADR-XXXX` and kept for history.

```markdown
# ADR-NNNN: <Short imperative-mood title>

## Status

Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

## Context

What is the issue we're seeing that motivates this decision? What forces are
in tension? Cite the relevant [NFR](../architecture/nfrs.md) if applicable.

## Decision

What did we decide to do? Use present tense, active voice. "We will X."

## Consequences

What becomes easier? What becomes harder? What do we have to do now that we
didn't before? Include both positive and negative consequences.

## Alternatives considered

List the other options we weighed, and one sentence each on why we didn't pick them.

## References

Links to docs, prior art, RFCs, blog posts, Slack threads, etc.
```

## Style guide

- One decision per ADR. If you find yourself writing "and," split into two.
- Keep under one page. If you can't, the decision is too big and should be
  broken down.
- Include the *negative* consequences. An ADR that only lists pros is
  propaganda.
- Date format: `YYYY-MM-DD`.
- Status `Accepted` means the team agreed. `Proposed` means one person wants
  to, and is asking for review.
