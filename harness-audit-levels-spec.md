# Harness Audit Levels Spec (V1)

Date: 2026-03-28
Status: Draft

## Goal

Define a simple, non-overwhelming maturity model for `agent-harness-cli` audit output while keeping the existing scoring engine intact.

This model is for **JS/TS repositories only** in V1.

## Core Approach

- Run the same audit engine for all projects.
- Keep current scoring canonical (`0-100`, category scores, checks, blockers, fix plan).
- Add a dynamic report layer that adapts output by current maturity level.
- Show users the most relevant next steps for their current level, not every possible recommendation at once.

## Scope

In scope:
- Level model and rules for JS/TS repos.
- Dynamic report behavior in normal and deep mode.

Out of scope:
- Non-JS/TS ecosystems in V1 (PHP/Python/.NET).
- Replacing current score math with levels.
- 1-9 numeric maturity scale in V1.

## Levels (V1)

Use 4 levels:

1. **Level 1: Bootstrap**
2. **Level 2: Baseline**
3. **Level 3: Reliable**
4. **Level 4: Autonomous-Ready**

## Level 1: Bootstrap

Meaning:
- Project is not yet safely operable by an agent.
- Priority is minimum loop: understand -> run -> validate.

Hard gates (must pass to exit Level 1):
- `has_package_json`
- `has_lockfile`
- `has_primary_instructions`
- `has_readme`
- `has_test_script`
- `has_local_dev_boot_path`

Soft signals (tracked, not blocking Level 1 exit):
- `has_test_dir`
- `has_test_files`
- `has_typecheck_script`
- `has_lint_script`
- `has_env_example`
- `has_docs_index`

Report behavior:
- Show level status and short meaning.
- Show top blockers from Level 1 hard gates only.
- Show max 3 "Do this now" actions.
- Show short "Coming next in Level 2" preview.

Deep mode behavior:
- Do not add extra blocker classes at this level.
- Use deep results to clarify evidence and urgency of existing hard-gate blockers.

## Level 2: Baseline

Meaning:
- Project is operable with basic loops.
- Priority is repeatable and safe agent execution.

Hard gates (must pass to exit Level 2):
- `has_test_dir`
- `has_test_files`
- `has_lint_script`
- `has_typecheck_script`
- `has_build_script`
- `has_env_example`
- `has_docs_index`

Soft signals (tracked, not blocking Level 2 exit):
- `has_structured_docs`
- `has_architecture_docs`
- `has_ci_validation`
- `has_e2e_or_smoke_tests`
- `has_architecture_lints`
- `has_quality_or_debt_tracking`
- `has_execution_plans`

Report behavior:
- Show level status and what unlocks Level 3.
- Show blockers from Level 2 hard gates.
- Use `Now / Next / Later` sections:
  - `Now`: failed hard gates
  - `Next`: top soft signals
  - `Later`: advanced reliability/autonomy items

Deep mode behavior:
- Use deep findings to improve prioritization and concrete evidence.
- Keep advanced deep findings in `Next/Later`, not as immediate blockers.

## Level 3: Reliable

Meaning:
- Agents can execute normal feature/bug work with good predictability under light supervision.
- Priority is mechanical enforcement and stronger verification loops.

Hard gates (must pass to exit Level 3):
- `has_architecture_docs`
- `has_structured_docs`
- `has_ci_validation`
- `has_e2e_or_smoke_tests`
- `has_architecture_lints`
- `has_execution_plans`

Soft signals (tracked, not blocking Level 3 exit):
- `has_short_navigational_instructions`
- `has_observability_signals`
- `has_quality_or_debt_tracking`
- Deep finding quality consistency (`strengths`, `risks`, `autonomyBlockers`)

Report behavior:
- Show what blocks Level 4.
- Prioritize missing enforcement checks first (`ci`, `architecture lints`, `e2e/smoke`).
- Keep governance/maintenance items in `Next`.

Deep mode behavior:
- Deep findings influence ranking and explanation quality.
- Deep findings should not invent hard blockers outside the defined check model.

## Level 4: Autonomous-Ready

Meaning:
- Repo supports high-autonomy execution on non-trivial tasks with minimal steering.
- Priority is drift prevention and sustained quality.

Hard gates (must pass to be Level 4):
- All Level 1-3 hard gates pass.
- `has_short_navigational_instructions`
- `has_observability_signals`
- `has_quality_or_debt_tracking`

Soft signals (optimization only):
- Depth and quality of execution plans
- CI breadth and failure ergonomics
- Deep-finding consistency/specificity across runs
- Depth of selected tool-skill coverage

Report behavior:
- Default output is concise: strengths, residual risks, maintenance priorities.
- No blocker section unless regressions exist.

Deep mode behavior:
- Treat deep mode as risk/quality validation, not new hard-blocker discovery.
- Focus deep output on strengths, risks, and prevention actions.

## Level Determination Rules (Initial)

1. Evaluate hard gates for Level 1.
- If any fail -> Level 1.
2. Else evaluate hard gates for Level 2.
- If any fail -> Level 2.
3. Else evaluate hard gates for Level 3.
- If any fail -> Level 3.
4. Else evaluate hard gates for Level 4.
- If any fail -> Level 3 (upper-reliable but not autonomous-ready).
5. Else -> Level 4.

Notes:
- This is a precedence model, not a weighted level score.
- Existing `overallScore` remains unchanged and canonical.

## Deep vs Normal Mode

- Normal mode determines level from deterministic repo evidence.
- Deep mode can upgrade confidence and reprioritize recommendations with better evidence.
- Deep mode should not downgrade heuristic passes.
- Deep mode should not expand blocker surface beyond the current hard-gate set for the current level.

## Ecosystem Portability (Future)

The level model is portable, check implementations are ecosystem-specific.

For future PHP/Python/.NET support:
- Keep level intent constant.
- Replace Node-specific checks with ecosystem-equivalent checks.
- Implement language adapters without changing the core level framework.

## Rollout Guidance

Recommended rollout:
1. Add level calculation + level metadata in JSON output.
2. Update text reporter to stage output by level.
3. Keep `--full` mode to expose the complete recommendation set.
4. Validate on fixture + real-repo corpus before increasing level granularity.
