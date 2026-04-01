# Market Analysis: Agent Harness Audit CLI

_Prepared by Market Research Analyst — March 18, 2026_

---

## Executive Summary

Proceed. The market is real, the timing is right, and no dominant player has claimed the space yet. The pain this product solves — developers losing control as AI agents make unsupervised changes — is supported by hard survey data. The closest existing competitor is a small open-source repo, not a funded company. Distribution via npm is the correct call. The window to establish first-mover positioning in "agent-readiness auditing" is open now and will close within 12–18 months.

---

## 1. Market Size

### AI Coding Agent Adoption

| Tool | Active Users / ARR | Signal |
|---|---|---|
| GitHub Copilot | 20M all-time users, 4.7M paid subscribers (Jan 2026) | 75% YoY paid growth |
| Cursor | $2B ARR (Mar 2026), doubled in 3 months | 1M+ daily active users |
| Anthropic / Claude Code | $14B company ARR (Feb 2026); Claude Code ~$2.5B run-rate | 10x website traffic growth in 2025 |
| Windsurf / Codeium | 800K+ active developers, $100M ARR before Google acquisition | Acquired for ~$2.4B |

**84% of developers now use or plan to use AI coding tools** (Stack Overflow 2025, 65K respondents). 65% use AI tools at least weekly. The product paradigm has shifted from autocomplete (2023) → multi-file editing (2024) → autonomous agent workflows (2025–2026).

### TAM

The AI code tools market is approximately **$7–8B in 2025**, growing at **~27% CAGR** toward $24–26B by 2030 (Grand View Research / MarketsandMarkets). Even a narrow slice — developer setup tooling, configuration linting, and pre-agent audit — represents a SAM in the hundreds of millions if captured at the point where every developer onboards a new agentic workflow.

### Addressable entry point

The relevant wedge is not the full AI tools market. It is the **~5–10 million developers who are actively running autonomous AI agents on real codebases** and experiencing quality and reliability failures. This number is growing fast. Cursor alone has multi-millions of monthly active users; Claude Code's usage is accelerating sharply.

---

## 2. The Pain Is Real

This is not a hypothetical problem. Survey data from 2025 is unambiguous:

- **65%** of developers say AI misses relevant context during critical tasks like refactoring and code review (Qodo 2025, n=609)
- **Only 29%** trust AI output accuracy — down from 40% the prior year (Stack Overflow 2025)
- **45%** cite "AI solutions that are almost right, but not quite" as their top frustration
- **66%** say they spend more time fixing nearly-correct AI-generated code than they save
- **METR controlled study (July 2025)**: experienced developers using frontier AI tools were **19% slower** than without AI on complex codebases — while believing they were 20% faster

The agent-readiness gap is not theoretical. Developers are already experiencing it. The product's core job-to-be-done — "tell me what is broken in my repo setup before I give an agent broad autonomy" — maps directly to the #1 complaint in the field.

---

## 3. Competitive Landscape

### Direct competitors (closest to agent-readiness audit)

| Tool | Description | Pricing | Maturity | Threat Level |
|---|---|---|---|---|
| **f/check-ai** | 66 automated checks across 8 categories including AGENTS.md, CLAUDE.md, .cursorrules, testing, MCP integrations. Scores 0–10 per category. | Open source, free | GitHub repo, solo/small project, no company | **High** — same concept, already shipping |
| **Packmind context-evaluator** | Audits CLAUDE.md, AGENTS.md, .cursorrules by actually invoking the agent CLI to evaluate content. Checks for contradictions, missing validation commands, gaps vs. codebase. Hosted scanner at packmind.com | OSS core + freemium platform | Backed by a company; enterprise tiers | **High** — most sophisticated, ongoing maintenance focus |
| **cursor-doctor** | Linter for Cursor rules files only. 100+ checks, A–F grade, 34 auto-fixers. | Free, open source | Active, published npm package | **Medium** — Cursor-specific; doesn't generalize |
| **RepoCheckAI / Repo Doctor** | General repo health checker (docs, CI/CD, testing, security). 0–100% score with P0/P1/P2 findings. | OSS, LLM API key for deep mode | Published Jan 2026, single developer | **Low-medium** — general health, not agent-config specific |

### Adjacent / complementary

| Tool | Description | Threat Level |
|---|---|---|
| **harnesskit** | Scaffolder: generates AGENTS.md, ARCHITECTURE.md, and IDE configs in one command. `harnesskit enforce` validates architecture rules in CI. | **Low** — generator, not auditor |
| **getsentry/skills** | Sentry's `claude-settings-audit` generates a recommended Claude Code settings.json allowlist. | **Low** — narrow skill, not standalone product |
| **AgentAudit** | Security scanner for AI packages and MCP servers. Checks for supply chain attacks, prompt injection. | **Low** — security focus (are packages safe?), not readiness focus |
| **OpenSSF Scorecard** | Security health metrics for open-source repos. | **Low** — security/supply-chain, not agent DX |
| **Repomix** | Packages entire codebase for LLM consumption. | **Low** — prep tool, not an auditor |

### Competitive summary

The space is **early and fragmented**. No tool has achieved dominant distribution or brand recognition in "agent-readiness auditing." The two closest competitors (`f/check-ai`, Packmind) are either undistributed or narrowly focused on context-file quality rather than full agent-readiness scoring. **No npm package with significant download counts has claimed this category.**

The AGENTS.md standard itself only emerged mid-2025 and reached cross-platform consensus by late 2025 (Linux Foundation). Tools built around it are correspondingly very new. This is a genuine window.

---

## 4. Differentiation: Is the Angle Defensible?

**Short answer: Yes, with the right positioning.**

The defensible position is not "checks whether AGENTS.md exists" — that's a single file check, easy to replicate. The defensible position is:

1. **Five-category scoring rubric** (Instructions, Context, Tooling, Feedback, Safety Gates) — a principled, opinionated framework that trains developers to think about agent-readiness holistically, not as a checklist
2. **Evidence-linked explanations** — every low score cites the specific missing file or failed check, not generic advice
3. **Fix plan with effort estimates** — actionable output, not just diagnosis
4. **Tool-aware auditing** (`--tool claude-code`, `--tool cursor`) — scans against the specific agent the user is actually running, not a generic standard
5. **Starter artifact generation** — bridges audit → action in a single workflow

`f/check-ai` is the most direct overlap. The differentiators: agent-tool-specific scoring, effort-tiered fix plans, artifact generation, and the overall 100-point "Agent Harness Score" as a shareable, memorable metric. If the score becomes a recognized benchmark ("our repo is a 74, we need to hit 85 before the sprint"), it creates stickiness.

**The moat isn't the checks — it's the framework, the brand, and the distribution.**

---

## 5. Distribution: Is npm the Right Channel?

**Yes.**

The target user (semi-technical solo builders using JS/TS web app repos with Claude Code or Cursor) lives on npm. This is exactly how they install and run developer tooling. Reference points:

| Tool | Weekly npm Downloads | Category |
|---|---|---|
| ESLint | ~70–86M | Linting |
| Prettier | ~35–82M | Formatting |
| TypeScript | ~60–70M | Type checking |
| Vite | ~12M | Build tooling |
| Snyk CLI | Millions | Security audit |
| Lighthouse CLI | Millions | Performance audit |

The "one-command audit" pattern (`npx agent-harness audit .`) has proven PMF: `npm audit` ships inside npm itself and normalized the concept of audit-on-every-project for an entire developer generation. Snyk, Lighthouse, and `npx depcheck` all follow the same pattern — zero friction to first value.

The path:
1. `npx agent-harness audit .` — zero install, zero signup, immediate value
2. Results worth sharing → organic distribution
3. CI integration hook → stickiness
4. Team/dashboard features → paid conversion

**Additional channels to consider post-MVP:** VS Code extension, GitHub Action, Claude Code/Cursor skill integration (Packmind's model validates this path).

---

## 6. Monetization

### Proven models for this category

| Model | Example | Revenue |
|---|---|---|
| Open-core + managed cloud | Vercel/Next.js, HashiCorp/Terraform | $200M+ ARR, multi-billion valuations |
| Freemium + enterprise tiers | Snyk, SonarQube | $278M+ ARR (Snyk) |
| SaaS dashboard around CLI output | Snyk, Socket.dev, Semgrep | Scales with enterprise adoption |

### Recommended path for agent-harness

**Phase 1 — Free, open source.** Build distribution. The free CLI is the product. Target 1M+ `npx` runs before monetizing. (ESLint and Prettier built their moats entirely free before any commercial model existed.)

**Phase 2 — Freemium individual tier.** Unlimited local audits free. Gating candidates:
- Historical score tracking (requires account)
- Team score dashboards
- Audit history / trend reports
- CI/CD integration with configurable failure thresholds
- Custom rubric weights for enterprise teams

**Phase 3 — Team/enterprise pricing.** Benchmark: $25–$100/developer/month (Snyk's Team plan starts at $25/dev/month). SonarQube's per-LOC model is worth considering as an alternative.

**Conversion rate expectations:**
- Mass-market CLI freemium: ~0.3–1% free-to-paid
- Enterprise-focused open-source: ~1–3%
- These rates are viable at scale: Elastic built a multi-billion dollar company on ~1% conversion due to high ACV enterprise deals

### Near-term monetization (if needed before scale)
Consulting and "agent-readiness workshops" for engineering teams. Low-margin, high-signal for product development.

---

## 7. Timing

**The window is open. It won't stay open long.**

Conditions today:
- AGENTS.md standard reached cross-platform consensus in late 2025 — the ecosystem agreed on the format, creating a clear audit target
- No funded company has claimed "agent-readiness auditing" as a branded product category
- Developer pain (AI regressions, context drift) is measurable and growing, but solutions are nascent
- The two closest competitors are solo GitHub projects or a small company with a narrower framing

Conditions in 12–18 months:
- GitHub, Cursor, and Anthropic will almost certainly build some form of readiness scaffolding into their own products
- The npm ecosystem will fill up with competing tools as the pain becomes more widely recognized
- The METR slowdown findings (developers are measurably slower with poorly-configured AI setups) will accelerate enterprise demand for audit tooling

**Verdict: This is a timing call. Early 2026 is the correct entry point.** The problem is proven, the market is forming, and the category has not been named or owned yet.

---

## So What

**Recommendation: Proceed to MVP build immediately.**

The market opportunity is real and time-sensitive. Here is what the data says about each question:

| Question | Answer |
|---|---|
| Market size | ~$7–8B AI code tools market, 27% CAGR. 5–10M active agent users today, growing fast. |
| Competitive threat | `f/check-ai` and Packmind are the only real overlaps; neither is a funded company with dominant distribution. Window is open. |
| Differentiation | Defensible via framework (5-category rubric), tool-aware scoring, effort-tiered fix plans, artifact generation, and the "Agent Harness Score" as a memorable metric. |
| Distribution | npm is correct. `npx agent-harness audit .` replicates the proven "one-command audit" pattern (npm audit, Snyk, Lighthouse). |
| Monetization | Start free/OSS. Gate team features (dashboards, CI thresholds, history). Target $25–$100/dev/month at team tier. Expect 0.3–1% conversion from free. |
| Timing | Now. The AGENTS.md standard just stabilized, no dominant player exists, and developer pain is accelerating. |

**The one risk to watch:** Shallow checklist problem. If the audit feels like a generic README-presence checker, it won't stick. The value is in the explanations, the fix plans, and the tool-specific awareness — not the checks themselves. Build those first, resist the urge to add more checks until each existing check produces output that developers find genuinely useful.

---

_Sources: Stack Overflow Developer Survey 2025 (65K respondents), Qodo State of AI Code Quality 2025 (n=609), JetBrains State of Developer Ecosystem 2025 (n=24,534), METR Productivity Study July 2025 (arxiv:2507.09089), TechCrunch/Bloomberg (Cursor, Anthropic revenue), Grand View Research / MarketsandMarkets (TAM), Snyk / SonarQube / Socket.dev pricing pages, npm download data, GitHub repos: f/check-ai, cursor-doctor, harnesskit, PackmindHub/packmind, glaucia86/repocheckai._
