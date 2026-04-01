# Phase 2.5 Portal Evaluation

## Section A: Change understanding

Phase 2.5 in the plan adds a maturity overlay on top of the existing score: hard-gated readiness levels, staged recommendations (`Now` / `Next` / `Later`), additive JSON metadata, and lightweight deep-mode interaction without changing canonical score math. The contract is defined in [harness-engineering-implementation-plan.md](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/harness-engineering-implementation-plan.md#L280), especially the level map at lines 286-326 and the compatibility rules at lines 346-419.

1. Additive readiness level model was implemented.
Logic: `calculateReadinessLevel()` evaluates four gate sets in order, returning `L1 Bootstrap`, `L2 Baseline`, `L3 Reliable`, or `L4 Autonomous-Ready`; `buildStagedFixes()` derives `now`, `next`, and `later` from `fixPlan` priority plus hard-gate membership. Where: [src/scoring/levels.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/levels.ts#L46), [src/scoring/levels.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/levels.ts#L207), [src/scoring/levels.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/levels.ts#L236), [src/types.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/types.ts#L220), [src/types.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/types.ts#L279), [src/commands/audit.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/commands/audit.ts#L229). Scoring/reporting impact: score math is unchanged; `report.level` is additive in JSON and rendered as a new section in text. Risk: the level is only as accurate as the underlying heuristic checks, so false negatives in hard gates directly change the displayed maturity.

2. Four new level-only checks were implemented as evidence only, not scored checks.
Logic: `collectEvidence()` now returns `levelOnlyChecks` with `has_execution_plans`, `has_short_navigational_instructions`, `has_observability_signals`, and `has_quality_or_debt_tracking`. Execution plans look for plan/roadmap files; short instructions require `AGENTS.md` or `CLAUDE.md`, `<=250` lines, and at least two local markdown links; observability uses dependency names or root instrumentation files; quality/debt uses a narrow root-file and `docs/{debt,quality,maintenance}` matcher. Where: [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L292), [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L320), [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L357), [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L380), [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L699), [src/inspection/package.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/package.ts#L19), [src/inspection/package.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/package.ts#L80), [src/inspection/package.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/package.ts#L289). Scoring/reporting impact: these do not affect `overallScore` or category scores, but they do affect `report.level`. Portal values were `has_execution_plans=true`, `has_short_navigational_instructions=false`, `has_observability_signals=true`, `has_quality_or_debt_tracking=false`. Risk: these heuristics are intentionally shallow and two of them are narrow enough to miss real signals in portal.

3. Text reporting was made dynamic by maturity.
Logic: `renderLevelSummary()` prints `Readiness Level`, `Blocking hard gates`, and staged buckets; text caps are enforced separately from JSON via `capStagedFixesForText()`. Where: [src/reporters/text.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/reporters/text.ts#L221), [src/reporters/text.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/reporters/text.ts#L249), [src/reporters/text.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/reporters/text.ts#L320), [src/scoring/levels.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/levels.ts#L274). Scoring/reporting impact: portal text output is materially easier to triage because the current level gates are separated from future work; fixture `baseline` confirms the text cap with `+3 more` overflow while JSON still keeps all seven `now` IDs. Risk: max-level reporting still shows a `Next` bucket, which is slightly contradictory for `L4 Autonomous-Ready`.

4. JSON schema stayed additive.
Logic: the JSON reporter still serializes the whole `AuditReport` object; no bespoke transform was introduced. Where: [src/reporters/json.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/reporters/json.ts#L4), [src/types.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/types.ts#L279). Scoring/reporting impact: normal JSON keys were `version`, `generatedAt`, `input`, `evidence`, `scoring`, `level`, `artifacts`; deep JSON added only `deepAudit`. Risk: low for existing consumers because the old keys remain present and unchanged.

5. Deep-mode wiring was updated, but it is only partially relevant to Phase 2.5.
Logic: `runAudit()` now merges deep findings before scoring and level calculation, and deep evidence can overwrite heuristic evidence for existing scored checks. Where: [src/commands/audit.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/commands/audit.ts#L56), [src/commands/audit.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/commands/audit.ts#L188). Support files added around this include bounded prompt/context collection in [src/inspection/deep-context.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/deep-context.ts#L396) and [src/agents/deep-prompt.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/deep-prompt.ts#L111). Scoring/reporting impact: deep mode can change the level for scored hard gates, but it cannot currently change the new level-only gates because [src/agents/checks.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/checks.ts#L3) does not include them in `DEEP_CHECK_IDS`. Risk: acceptable per the plan, but it means `deep` is not actually level-complete for L3/L4 gates yet.

6. Phase 2.5 fixtures and tests were added and they are green.
Evidence: new fixtures `fixtures/baseline/` and `fixtures/autonomous/` exist, and tests cover level assignment, staged buckets, and JSON fields in [tests/scoring/scoring.test.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/tests/scoring/scoring.test.ts#L840) and [tests/cli.test.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/tests/cli.test.ts#L198). Validation status: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all passed locally; `npm test` reported `175 passed`.

## Section B: Raw run summary

| Command | Result | Key outputs |
|---|---|---|
| `node dist/cli.js --help` | Pass | No new Phase 2.5 flags. Existing surface only: `--deep`, `--agent`, `--json`, `--tokens`, `--no-color`, `--write-artifacts`, etc. |
| `npm run build` | Pass | `tsc` completed cleanly. |
| `npm run lint` | Pass | `eslint src tests --ext .ts` passed. |
| `npm run typecheck` | Pass | `tsc --noEmit` passed. |
| `npm test` | Pass | `12` test files, `175` tests passed. |
| `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal` | Pass | Score `62/100`; `Readiness Level: L2 Baseline`; blocking gates `has_test_dir`, `has_test_files`, `has_env_example`, `has_docs_index`; `Now` bucket contained exactly those four. |
| `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal --json` | Pass | Top-level keys: `version`, `generatedAt`, `input`, `evidence`, `scoring`, `level`, `artifacts`; `deepAudit` absent; `level.id=2`, `level.label="Baseline"`, `blockingGateSet="level2"`; `evidence.levelOnlyChecks={execution_plans:true, short_navigational_instructions:false, observability_signals:true, quality_or_debt_tracking:false}`. |
| `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal --deep --agent claude-code` | Pass | Same score and level as normal mode; deep header showed `cost: $0.2048`; deep highlights were rendered; top blockers gained deep evidence text, but stage buckets did not change. |
| `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal --deep --agent claude-code --json` | Pass | Top-level keys were normal keys plus `deepAudit`; `deepAudit.agentName="claude-code"`; `findings=23`, `strengths=5`, `risks=5`, `autonomyBlockers=2`; `overallScore` and `level` were identical to non-deep output. |
| `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal --deep --agent codex` | Not run | Per user instruction, only required if Claude deep failed. Claude deep succeeded. |
| `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal --deep --agent codex --json` | Not run | Same reason as above. |
| `node dist/cli.js audit fixtures/baseline --json` | Pass | Score `27`; `L2 Baseline`; JSON `stagedFixes.now` had `7` IDs, confirming full JSON retention. |
| `node dist/cli.js audit fixtures/baseline` | Pass | Text `Now` bucket showed first `4` items then `+3 more`, confirming the new low-maturity truncation behavior. |
| `node dist/cli.js audit fixtures/autonomous --json` | Pass | Score `88`; `L4 Autonomous-Ready`; `failedHardGates=[]`; `now=[]`; `next=[has_tool_skills, has_tsconfig, has_generic_skills]`. |
| `node dist/cli.js audit fixtures/autonomous` | Pass | Text still renders a `Next` bucket at L4, which is technically allowed by current code but is UX-noisy. |

Normal vs deep on portal:

- `overallScore` stayed `62` in both modes.
- `report.level` stayed identical in both modes.
- Deep mode added only descriptive overlays: `deepAudit`, the yellow non-determinism header, deep highlight sections, and evidence strings on failing checks.
- Deep mode did not change any Phase 2.5 level-only gates because those IDs are not currently part of the deep agent schema.

Portal-specific source verification against the target repo:

- `CLAUDE.md` exists, but it is `289` lines with `0` local markdown links, so `has_short_navigational_instructions=false` under the current heuristic.
- `docs/plans/**` exists, so `has_execution_plans=true` is justified.
- `backend/package.json` includes `@sentry/node`, so `has_observability_signals=true` is justified.
- Root `.env.example` is missing; only `.env.tools` and `.env.tools.dist` exist.
- `docs/index.md` is missing; `docs/shared/sentry-integration.md` exists, but that does not satisfy the docs-index gate.
- `backend/src/tests/` and `backend/src/tests/unit/sample.test.ts` exist, but the current collector still reports `has_test_dir=false` and `has_test_files=false`.

## Section C: Phase 2.5 feature evaluation table

| Feature | Verdict | Reason | Recommendation |
|---|---|---|---|
| Readiness level overlay (`report.level`) | Good signal | Matches the plan contract, is deterministic, and stays additive. Portal got a plausible `L2 Baseline`, and deep mode did not mutate the canonical score. Core logic is in [src/scoring/levels.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/levels.ts#L207). | Keep. |
| Staged text reporting (`Now` / `Next` / `Later`) | Good signal | On portal, the staged buckets made the output easier to prioritize than the old flat fix plan. On `fixtures/baseline`, the text cap and `+3 more` behavior work exactly as intended. | Keep, but tune max-level copy. |
| JSON additive level schema | Good signal | Backwards-compatible in practice: all prior top-level keys remain, and `level` is additive. Deep JSON adds only `deepAudit`. | Keep. |
| `has_execution_plans` | Good signal | Portal legitimately has `docs/plans/**`, and the heuristic detected it. This improves upper-level readiness without touching the score. | Keep. No immediate tuning needed. |
| `has_observability_signals` | Good signal | Portal has `@sentry/node` in `backend/package.json`, and the package-root aggregation in [src/inspection/package.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/package.ts#L289) captures it correctly. | Keep. |
| `has_short_navigational_instructions` | Weak signal | Portal fails it because `CLAUDE.md` is `289` lines and linkless, even though the file is materially useful. This will create avoidable L4 misses on real repos with strong but longer instruction surfaces. | Tune. Relax the line threshold or allow other navigability signals such as headings, repo map sections, or fenced path examples. |
| `has_quality_or_debt_tracking` | Weak signal | Portal fails because the heuristic only looks for a few root filenames or `docs/{debt,quality,maintenance}`. Portal has planning docs including `performance-and-code-quality-audit.md`, but that does not count. | Tune. Expand acceptable paths/stems, especially `docs/plans/**` entries containing `quality`, `debt`, `audit`, or `maintenance`. |
| Deep-mode interaction with Phase 2.5 | Weak signal | `runAudit()` is ready to merge deep findings into levels, but [src/agents/checks.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/checks.ts#L3) omits the new level-only check IDs, so deep mode cannot improve those gates. | Keep for 2.5, extend next. |
| Level-4 dynamic reporting | Regression risk | `fixtures/autonomous` reaches `L4`, but the reporter still shows a `Next` bucket with soft gaps. That is logically defensible, but the wording is misleading because there is no next level. | Tune. Rename to `Optional improvements` or suppress the bucket when `nextLevelId` is absent. |

## Section D: Problems found (bugs/noise/edge cases)

1. False-negative test detection on monorepo-style repos.
Evidence: portal contains `backend/src/tests/` and `backend/src/tests/unit/sample.test.ts`, but both normal and deep audits still report `has_test_dir=false` and `has_test_files=false`. The collector only checks the package root plus immediate `tests`, `test`, and `__tests__` directories at that root in [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L509). Impact: this directly suppresses feedback score, adds a top blocker, and keeps portal at `L2` by failing two hard gates. This is the highest-impact real-project defect in Phase 2.5.

2. L4 output still implies progression.
Evidence: `fixtures/autonomous` returns `level.id=4`, `failedHardGates=[]`, but `stagedFixes.next` still contains `has_tool_skills`, `has_tsconfig`, and `has_generic_skills`, and the text reporter renders them under `Next`. The behavior comes from [src/scoring/levels.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/levels.ts#L247) and unconditional bucket rendering in [src/reporters/text.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/reporters/text.ts#L273). Impact: mild UX noise; it undermines the meaning of `Autonomous-Ready`.

3. High-maturity heuristics are too narrow for real repos.
Evidence: portal gets `has_short_navigational_instructions=false` despite a strong repo-specific `CLAUDE.md`, and `has_quality_or_debt_tracking=false` despite multiple plan/audit docs under `docs/plans/`. These heuristics are defined in [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L320) and [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L357). Impact: weakens confidence in Level 4 gating and creates avoidable false negatives on mature repos.

4. Deep mode is not level-complete.
Evidence: portal deep JSON returned `23` findings, but none for `has_execution_plans`, `has_short_navigational_instructions`, `has_observability_signals`, or `has_quality_or_debt_tracking`. That is because the deep schema still ends at scored checks in [src/agents/checks.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/checks.ts#L3). Impact: `--deep` cannot currently overturn or validate the new L3/L4-only gates, even though merge code is prepared for it in [src/commands/audit.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/commands/audit.ts#L145).

## Section E: Recommended next actions (prioritized)

1. Fix monorepo test discovery first.
Why: this is already producing a wrong portal verdict and wrong level. Change [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L509) to scan package roots recursively for `tests|test|__tests__` and `*.test.*|*.spec.*`, with the same ignored-directory policy used elsewhere. Add regression cases in [tests/inspection/local.test.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/tests/inspection/local.test.ts) covering `src/tests/**` and nested monorepo package roots.

2. Recalibrate the Level 4-only heuristics before relying on them for real repos.
Why: portal shows that the current definitions are too brittle. Update [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L320) and [src/inspection/local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts#L357) to accept broader quality/debt signals and more navigability patterns. Back the changes with focused cases in [tests/inspection/local.test.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/tests/inspection/local.test.ts) and keep [tests/scoring/scoring.test.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/tests/scoring/scoring.test.ts#L840) as the guardrail for unchanged canonical scores.

3. Clean up max-level reporting semantics.
Why: `L4` should not read like there is still a formal next rung. Change [src/scoring/levels.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/levels.ts#L247) and [src/reporters/text.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/reporters/text.ts#L258) so `L4` either hides the `Next` bucket or renames it to something explicitly optional. Add text-UX assertions in [tests/cli.test.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/tests/cli.test.ts#L198).
