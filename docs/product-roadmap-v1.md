# agent-harness CLI — Product Roadmap (Hybrid Audit Model)

**Updated:** 2026-03-19
**Owner:** Product Manager
**Status:** Approved — CEO-approved three-phase hybrid model
**Distribution:** npm/npx primary, GitHub OSS
**Input docs:** [MVP Plan](./mvp-plan.md) · [Market Analysis](./market-analysis.md) · CEO analysis (THU-46)

---

## Overview: The Hybrid Model

The board approved a three-phase approach that combines a fast, free heuristic engine with an optional deep agent-delegated audit. This is the architectural decision that separates agent-harness from static linters.

```
Phase 1 — MVP:  Heuristic audit + template artifacts   (free, instant, offline)
Phase 2 — V1:  Deep agent audit + smart fix proposals  (paid, 10-30s, requires agent)
Phase 3 — V2:  Continuous mode + CI + team dashboard   (paid, hosted component)
```

**Why three phases:**
- Phase 1 ships fast with zero agent dependency and zero token cost. It gets developers in the door.
- Phase 2 is the real product moat. Agent-powered analysis produces repo-specific findings no static tool can match. This is also the monetization gate.
- Phase 3 turns the tool into a team workflow, not just a dev utility.

---

## Phase 1 — MVP

### Scope

**Commands:**
- `agent-harness audit .` — heuristic scan, scores 5 categories, outputs blockers + fix plan
- `agent-harness audit . --write-artifacts` — generates template-based starter files (`.generated.md` suffix)

**Characteristics:**
- Fully offline — no API calls, no agent required
- Deterministic — same repo, same output every time
- Free forever — no token cost, no account needed
- Generated files are templates, not AI-generated (fast, credible, safe)

**Out of scope for Phase 1:**
- `--deep` flag (Phase 2)
- `fix` command (Phase 2)
- Agent detection or invocation
- `--agent` flag
- Watch mode (Phase 3)
- CI integration (Phase 3)

### Success Metrics — Phase 1

**Target window: 30–90 days post-launch**

| Metric | Target at 30d | Target at 90d | Why it matters |
|--------|--------------|--------------|----------------|
| npm weekly downloads | 500+ | 2,000+ | Raw reach — are devs actually installing it? |
| GitHub stars | 100+ | 500+ | Credibility signal; drives organic discovery |
| GitHub issues filed | >5 bug/feature requests | >25 | Engagement proxy — users file issues for tools they use |
| README/blog mentions | 5+ | 25+ | Word-of-mouth signal |
| Community posts with before/after results | 1+ | 10+ | Retention signal — users who re-run after fixing |

**Qualitative gates (before proceeding to Phase 2 investment):**
- At least 3 developers report the tool surfaced a real issue they recognized as theirs
- At least 1 developer reports `--write-artifacts` saved them meaningful time
- No dominant complaints about output being generic or unhelpful

**Phase 2 unlock condition:** Both quantitative and qualitative gates met at 90d, OR strong inbound demand for `--deep` functionality via GitHub issues/discussions.

---

## Phase 2 — V1 (The Real Product)

### Scope

**New commands and flags:**
- `agent-harness audit . --deep` — delegates audit to installed coding agent (Claude Code or Codex); agent reads actual repo content and produces repo-specific findings
- `agent-harness audit . --deep --agent claude-code` — explicitly selects the agent adapter
- `agent-harness fix .` — new command; agent proposes specific, repo-targeted fixes; user accepts or rejects each interactively

**Supported agents (V1):**
- Claude Code (`claude` CLI) — primary; structured output, CLI-native, best integration
- Codex (`codex` CLI) — secondary; OpenAI's terminal agent, similar model
- Cursor, Windsurf — **deferred** (IDE-extension model, not CLI-native; cannot invoke programmatically)

**Architecture addition:** `src/agents/` module with adapter per agent type. Adapters are responsible for prompt construction, agent invocation, and response parsing. The scoring engine and reporter are shared between heuristic and deep paths.

**The `fix` command UX:**

```
$ agent-harness fix .

Using Claude Code for deep analysis...

Found 4 fixable issues:

  1. Missing CLAUDE.md
     → Generated project-specific instructions (preview: 23 lines)
     Apply? [y/n/preview]

  2. No test command in package.json
     → Add "test": "vitest run" to scripts
     Apply? [y/n/preview]

  3. Missing .env.example
     → Generated from detected env vars in src/config.ts
     Apply? [y/n/preview]

  4. No architecture documentation
     → Generated ARCHITECTURE.md from codebase analysis
     Apply? [y/n/preview]
```

Each fix is repo-specific because the agent read the actual code. This is the differentiator no static tool can replicate.

### Monetization Gate — Phase 2

Deep audit and smart fixes are the paid tier. The heuristic path remains free forever.

**Rationale:**
- Token cost is real — deep audit consumes API tokens. Charging covers costs.
- Value is clear — users who see repo-specific fixes understand what they're paying for.
- Free tier creates the top of the funnel; paid tier monetizes the power users.

**Pricing (reference, not committed):**

| Tier | Price | Includes |
|------|-------|----------|
| Free | $0 | Full heuristic audit + template artifacts |
| Pro | ~$10–12/mo | Unlimited deep audits + smart fix proposals, extended rubric (15+ checks), custom rules |
| Team | ~$20–30/user/mo | Org config, multi-repo tracking, API access, Slack/GitHub integrations |

**What triggers paid tier readiness:** Phase 1 success gates met. See Section 8.

### Success Metrics — Phase 2

| Metric | Target at 30d post-V1 | Target at 90d | Why it matters |
|--------|----------------------|--------------|----------------|
| `--deep` runs | 100+ | 500+ | Validates demand for the paid path |
| `fix` command adoption | 25+ users | 200+ | Stickiest feature — confirms retention |
| Paid conversions (once billing added) | 10+ | 100+ | Revenue validation |
| Fix acceptance rate | >50% per session | — | Measures fix quality; low rate = agent is missing |
| Deep audit NPS (via GitHub issues) | No dominant negative signal | >0 qualitative NPS | Quality bar |

---

## Phase 3 — V2

### Scope

**New capabilities:**
- `agent-harness watch` — continuous mode; re-audits on file changes; flags regressions as they're introduced
- **GitHub Action** — runs `audit .` on PRs; fails the check if score drops below threshold; posts results as PR comment
- **Team dashboard** — first hosted component; aggregates scores across repos; tracks score trends over time

**Architecture:** Phase 3 introduces the first hosted infrastructure. The dashboard requires a backend. This is a scope escalation that requires board approval before starting.

### Success Metrics — Phase 3

| Metric | Target | Why it matters |
|--------|--------|----------------|
| GitHub Action installs | 50+ repos | CI adoption signals team workflow penetration |
| Dashboard active teams | 10+ | First hosted component — validates need for infra investment |
| Watch mode daily active repos | 25+ | Continuous mode is the stickiest possible feature |

---

## V1 User Stories

### Phase 1 user — Solo builder doing a first-time audit

**Who:** Semi-technical solo builder in an existing JS/TS web app repo. Uses Claude Code or Cursor. Has experienced regressions, context drift, or agent making wrong assumptions.

**Trigger:** Reads a blog post, sees `npx agent-harness audit .` in a Show HN thread, or searches "how to set up repo for Claude Code."

**First-run flow:**
```
$ npx agent-harness audit .
```
1. No install required — npx runs immediately
2. Output appears in ~5 seconds
3. Sees overall Agent Harness Score + 5 category scores + top 3 blockers + fix plan
4. Recognizes at least one issue as real ("right, I never wrote an AGENTS.md")

**What they do next:**
- Run `audit . --write-artifacts` to get starter files to edit
- Apply one fix, re-run, see score improve — this is the aha moment

### Phase 2 user — Power user wanting repo-specific analysis

**Who:** Same profile as Phase 1, but has hit the limits of the heuristic output. Wants the audit to actually read their code, not just check file existence.

**Trigger:** Has used Phase 1 for a few weeks, applied the easy fixes, and wants deeper insight. Has Claude Code installed.

**Flow:**
```
$ agent-harness audit . --deep
```
1. CLI detects Claude Code in PATH, confirms token cost before proceeding
2. Agent reads CLAUDE.md, package.json, src/ structure, test setup
3. Output includes findings like: "Your CLAUDE.md mentions a test command but `npm test` exits with error" — not generic, repo-specific
4. Runs `agent-harness fix .` to apply recommended fixes interactively

---

## CLI Flags — Complete Reference

### Phase 1 flags (MVP)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--tool` | enum | `other` | Which agent the user has installed (`claude-code \| cursor \| copilot \| codex \| other`) |
| `--failure-mode` | string | empty | Describe how your agent tends to fail (context for scoring) |
| `--safety-level` | enum | `medium` | Risk tolerance for the repo (`low \| medium \| high`) |
| `--json` | boolean | false | Output results as JSON instead of terminal report |
| `--write-artifacts` | boolean | false | Generate template-based starter files |
| `--output` | string | stdout | Write output to file path |

### Phase 2 flags (V1 additions)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--deep` | boolean | false | Enable agent-delegated deep audit (requires agent in PATH) |
| `--agent` | enum | auto-detect | Explicit agent selection (`claude-code \| codex`) |

**Agent auto-detection order:** `claude-code` → `codex` → error with install instructions.

**Token cost disclosure:** When `--deep` is used, the CLI must print an estimated token cost before invoking the agent and require confirmation (`Proceed? [y/n]`). This is non-negotiable UX — users must not be surprised by token spend.

---

## Milestone Sequence

### Phase 1 milestones

```
Foundation (Weeks 1–2)
  M1: Lock product and technical constraints + npm name reservation
  M2: Scaffold CLI project (commander, vitest, chalk)

Core Engine (Weeks 2–3)
  M3: Local repo inspection (16 heuristic checks)
  M4: Scoring engine (weighted 0-100, 5 categories)
    [M3 must complete before M4]

Output Surface (Weeks 3–4)
  M5: Terminal reporter (three-zone layout, color degradation)
  M6: JSON output (nested schema with evidence)
    [M5 and M6 can run in parallel after M4]

Polish & Ship (Weeks 4–5)
  M7: Template artifact generation (--write-artifacts)
  M8: Quality gates, packaging, npm publish
    [M7 and M8 can run in parallel after M5+M6]
```

### Phase 2 milestones (post-Phase 1 success gates)

```
Agent Architecture (Weeks 1–2)
  M9: src/agents/ module + adapter interface
  M10: Claude Code adapter (--deep integration)
  M11: Codex adapter

Fix Command (Weeks 2–3)
  M12: fix . command — agent invocation + diff rendering
  M13: Interactive accept/reject per fix
  M14: Paid tier billing integration

Launch & Iterate (Weeks 3–4)
  M15: Token cost disclosure + confirmation UX
  M16: Error handling for missing agents, rate limits, API failures
  M17: V1 launch (Show HN, community)
```

---

## Milestone Priority Table

| # | Milestone | Priority | Phase | Dependency | Ships in |
|---|-----------|----------|-------|-----------|---------|
| M1 | Lock constraints + npm name | Critical | 1 | None | Phase 1 |
| M2 | Scaffold CLI | Critical | 1 | M1 | Phase 1 |
| M3 | Heuristic inspection engine | High | 1 | M2 | Phase 1 |
| M4 | Scoring engine | High | 1 | M3 | Phase 1 |
| M5 | Terminal reporter | High | 1 | M4 | Phase 1 |
| M6 | JSON output | Medium | 1 | M4 | Phase 1 |
| M7 | Template artifact generation | Medium | 1 | M5 | Phase 1 |
| M8 | QA + npm publish | Critical | 1 | M5–M7 | Phase 1 |
| M9 | Agent adapter architecture | Critical | 2 | M8 + Phase 1 gates | Phase 2 |
| M10 | Claude Code adapter | High | 2 | M9 | Phase 2 |
| M11 | Codex adapter | Medium | 2 | M9 | Phase 2 |
| M12 | `fix .` command | High | 2 | M10 | Phase 2 |
| M13 | Interactive accept/reject UX | High | 2 | M12 | Phase 2 |
| M14 | Paid billing integration | High | 2 | M13 | Phase 2 |
| M15 | Token cost disclosure UX | Critical | 2 | M10 | Phase 2 |

---

## Launch Strategy

### Phase 1 launch (Show HN)

**Target:** ~2 weeks after M8 is complete.

**Pre-launch checklist:**
- [ ] `npx agent-harness audit .` works cleanly on at least 5 real JS/TS repos
- [ ] README explains the problem, solution, and includes a sample output with score
- [ ] At least one before/after example documented (low score → user applies fix → score improves)
- [ ] Known false positives and limitations documented
- [ ] GitHub repo is clean (no debug commits, no placeholder files)
- [ ] npm package published under the real package name

**Show HN post:**
```
Show HN: agent-harness – audit your repo for AI coding agent readiness

npx agent-harness audit .

Before letting Claude Code or Cursor make autonomous changes, this CLI
checks what's missing in your repo setup and gives you a prioritized fix
plan. Scores: instructions, context, tooling, feedback loops, safety gates.

Phase 2 coming: --deep flag uses Claude Code/Codex to actually read your
codebase and propose repo-specific fixes.

[sample output screenshot]

Built for JS/TS repos. Free and open source.
```

**Community seeding:**
1. Show HN (Tuesday or Wednesday)
2. r/ClaudeAI and r/ChatGPTCoding with a concrete example
3. Claude Code Discord/community
4. Dev.to post: "How to audit your repo before giving Claude Code broad autonomy"
5. Reach out to 2–3 devs known to write about Claude Code/Cursor setups
6. Add to relevant awesome-lists

### Phase 2 launch

**Positioning shift:** Lead with the `fix` command in all marketing. The heuristic audit is the free on-ramp; the agent-powered fix command is the product story.

**Show HN update:**
```
Show HN: agent-harness v2 – AI-powered repo analysis + interactive fixes

agent-harness fix .   ← the new command

Uses Claude Code or Codex to read your actual codebase and propose
repo-specific fixes. Interactive accept/reject per fix. Free heuristic
audit still available (no agent required).
```

---

## Feedback Loop (Infrastructure-Free)

### Phase 1 signals

| Signal | How to track | Effort |
|--------|-------------|--------|
| npm download counts | npm stats dashboard (public) | Zero |
| GitHub stars | GitHub repo | Zero |
| GitHub issues + discussions | Read and respond | Low |
| Mentions in other repos | GitHub code search for `agent-harness` | Low — weekly |

**Active channels:**
- GitHub Discussions — three starter threads: "Show us your audit results", "False positives", "Feature requests"
- GitHub Issues with templates — bug report, false positive, missing check request

**What we are NOT doing in Phase 1:**
- No opt-in telemetry (can add in v1.1 with user consent)
- No email capture, no hosted feedback forms, no analytics

### Phase 2 signals (additions)

- Fix acceptance rate (logged client-side, reported in `--json` output if user pipes to file)
- Deep audit session count (inferred from GitHub issues referencing `--deep`)
- Paid conversion tracking (once billing is live)

---

## Monetization Gate Conditions

The following conditions must ALL be true before introducing the paid tier (Phase 2 billing):

**Gate 1 — Phase 1 usage:**
- `npm weekly downloads ≥ 2,000` sustained for 4+ consecutive weeks

**Gate 2 — Retention signal:**
- Evidence of re-use (GitHub issues/discussions showing before/after workflows)

**Gate 3 — Qualitative demand:**
- At least 10 GitHub issues or discussions requesting features that naturally live in a paid tier (`--deep`, custom rules, CI integration)

**Gate 4 — Competitive signal:**
- No well-funded competitor with a free equivalent at comparable quality

**What does NOT trigger monetization:**
- Launch spike (even 10K downloads in week 1 — wait for sustained numbers)
- Investor pressure
- Requests from people who haven't used the free tier

---

## Technical Decisions the Engineer Needs (Phase 2)

### Agent adapter interface

The `src/agents/` module must define a stable adapter interface before Phase 2 milestones start:

```typescript
interface AgentAdapter {
  name: AgentTool;                    // 'claude-code' | 'codex'
  isAvailable(): Promise<boolean>;    // checks if CLI is in PATH
  runAudit(ctx: AuditContext): Promise<AuditResult>;
  runFix(issue: AuditIssue): Promise<FixProposal>;
}
```

Each adapter is responsible for prompt construction, agent invocation, and response parsing. The scoring engine and reporter must be agnostic to whether results came from the heuristic path or the agent path.

### `AgentTool` enum (Phase 2 update)

Confirmed values for V1:

```typescript
type AgentTool = 'claude-code' | 'codex' | 'cursor' | 'copilot' | 'other';
```

For Phase 2 `--deep`, only `claude-code` and `codex` are supported adapters. `cursor` and `copilot` remain enum values for heuristic detection only.

### Token cost estimation

Before invoking `--deep`, the CLI must:
1. Estimate token cost based on repo size (file count, total chars)
2. Print the estimate in clear terms: `Estimated cost: ~2,500 tokens (~$0.004 at Claude Sonnet pricing)`
3. Require `y` confirmation before proceeding

This is a hard requirement for user trust. Non-negotiable in Phase 2.

---

## Product Decisions the Engineer Needs Before Phase 1 Technical Spec

### Scoring output format (JSON schema)

**Decision:** Option B — nested with evidence.

```json
{
  "summary": { "overallScore": 42, "grade": "D" },
  "categories": [
    { "id": "instructions", "score": 1, "maxScore": 5, "checks": [...] }
  ],
  "topBlockers": [...],
  "fixPlan": [...],
  "meta": { "tool": "claude-code", "path": ".", "version": "1.0.0", "mode": "heuristic" }
}
```

Note: `meta.mode` is `"heuristic"` or `"deep"` to distinguish output sources. This is a Phase 2 addition to the schema but must be planned before Phase 1 freezes the schema.

### Score scale

Category scores: integers 0–5. Overall: 0–100 integer. Weights configurable internally, not user-exposed.

### Error UX for unsupported paths

Hard exit for Phase 1: `Error: No package.json found. agent-harness currently supports JS/TS projects only.` Exit code 1.

### Terminal output formatting

Target 80-column-safe output. Use chalk but degrade gracefully when `NO_COLOR` is set or stdout is not a TTY.

### Generated artifact naming

Written to repo root (not a subdirectory). Never overwrite existing files.

### Package name on npm

Prefer unscoped `agent-harness` if available. Engineer confirms during M1.

---

## Appendix: Open Questions for the Board

1. **Package name reservation:** Should we register `agent-harness` on npm now, before M1? Low cost, high value.

2. **GitHub org:** Personal account or dedicated org? Orgs look more credible for OSS tools.

3. **License:** MIT assumed. Any reason to consider Apache 2.0?

4. **Cursor/Windsurf Phase 2 scope:** If community demand for Cursor deep audit is strong, do we invest in an IDE extension adapter or keep deferring?

5. **Phase 2 billing infrastructure:** What payment provider? Stripe? Usage-based or subscription? Needs board decision before M14.

---

*This roadmap reflects the CEO-approved three-phase hybrid model (approved 2026-03-19). Phase 1 remains free OSS. Phase 2 introduces the paid deep audit tier. Phase 3 adds hosted infrastructure. Each phase requires explicit success gates before proceeding. This document should be updated when Phase 1 gates are met.*
