# GEMINI.md

This repository's assistant guidance lives in [`CLAUDE.md`](CLAUDE.md). That file is the single source of truth; this one only points to it so the two cannot drift apart.

@./CLAUDE.md

## How to use it

- Read [`CLAUDE.md`](CLAUDE.md) first: project overview, repo-wide commands, role dispatch, and the full list of skills and agents.
- Work in `server/` or `ui/`? Also read that package's guide: [`server/CLAUDE.md`](server/CLAUDE.md) or [`ui/CLAUDE.md`](ui/CLAUDE.md). Each has its commands, architecture notes and a when-to-use table of skills.
- The skills are plain Markdown. If your tool does not load them automatically, open the `SKILL.md` the guide names and follow it before changing code in that area: shared skills are in `.claude/skills/`, backend skills in `server/.claude/skills/`, frontend skills in `ui/.claude/skills/`.
