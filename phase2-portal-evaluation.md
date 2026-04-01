## Section A: Change understanding

Phase 2 implementation is present and wired:

- Deep context collection: [deep-context.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/deep-context.ts)
  - deterministic sections (`root-tree`, instructions, docs listing/index, package scripts, workflows, selected docs)
  - bounded excerpt sizes and stable ordering
- Deep prompt builder: [deep-prompt.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/deep-prompt.ts)
  - combines heuristic evidence + bounded context excerpts
  - prompt cap (`MAX_DEEP_PROMPT_CHARS=12000`)
- Deep adapter contract update: [adapter.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/adapter.ts), [claude-code.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/claude-code.ts), [codex.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/codex.ts)
  - supports `strengths`, `risks`, `autonomyBlockers`
- Merge/report flow: [audit.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/commands/audit.ts), [text.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/reporters/text.ts)
  - deep evidence still only upgrades checks (`false -> true`)
  - deep highlights section added in text output
- JSON failure envelope fix (Phase 1.5): [cli.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/cli.ts)
  - `--json` failures now emit structured `{"error":{...}}`

---

## Section B: Raw run summary (commands + pass/fail + key outputs)

Run directory: `/tmp/agent-harness-phase2-runs-20260328-231128`

1. `npm run build`
- Pass

2. `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal`
- Pass
- Key output: `62/100` (previously `28/100` in earlier eval), categories:
  - Instructions `4.5`
  - Context `2.4`
  - Tooling `4.3`
  - Feedback `2.5`
  - Safety `0`

3. `node dist/cli.js audit ... --json`
- Pass
- Confirms monorepo-aware improvements:
  - `hasPackageJson=true`, `hasLockfile=true`
  - `hasLocalDevBootPath=true`
  - `hasE2eOrSmokeTests=true`
  - `hasCIPipeline=true`, `hasCIValidation=false`

4. `node dist/cli.js audit ... --deep --agent claude-code`
- Fail (`exit 2`)
- Error: `deep audit failed: Claude returned no valid findings`

5. `node dist/cli.js audit ... --deep --agent claude-code --json`
- Fail (`exit 2`)
- Correct JSON error envelope produced:
  - `error.code=usage_error`
  - `error.agent=claude-code`

6. `node dist/cli.js audit ... --deep --agent codex`
- Fail (`exit 2`)
- Environment issue: Codex state DB migration mismatch

7. `node dist/cli.js audit ... --deep --agent codex --json`
- Fail (`exit 2`)
- Correct JSON error envelope produced (`agent=codex`)

---

## Section C: New-check / phase impact table

| Item | Result on `portal` | Correctness | Impact |
|---|---|---|---|
| `has_local_dev_boot_path` | `true` | Correct (detected in subpackages) | Big positive vs prior eval (`false -> true`) |
| `has_e2e_or_smoke_tests` | `true` | Likely correct via deeper recursive/config detection in package roots | Big positive (`false -> true`) |
| `has_ci_pipeline` (new split) | `true` | Correct (`.gitlab-ci.yml` detected) | Good disambiguation |
| `has_ci_validation` | `false` | Reasonable (`.gitlab-ci.yml` has no explicit lint/test/typecheck/build commands) | Reduced noise vs old “no CI” |
| `has_architecture_lints` | `false` | Likely correct | unchanged |
| `has_docs_index` | `false` | Correct | unchanged |
| `has_structured_docs` | `true` | Correct for this repo | unchanged |

Deep Phase 2 features on real run:
- Context excerpt collection works (I verified 5 deterministic sections were collected for `portal`).
- Deep execution through CLI currently fails for Claude/Codex in this environment, so `strengths/risks/autonomyBlockers` are not surfacing in real report output yet.

---

## Section D: Problems found (bugs/noise/edge cases)

1. **Phase 2 regression: Claude deep mode broken by `--max-turns 1`**
- In [claude-code.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/claude-code.ts), the new `--max-turns 1` causes Claude to return `subtype:"error_max_turns"` with no findings.
- I confirmed by direct invocation:
  - with `--max-turns 1`: no findings
  - without it: structured output is returned

2. **Codex deep remains blocked by local Codex state DB issue**
- Not a harness logic bug, but prevents Phase 2 runtime validation with Codex here.

3. **Phase 2 highlights section is unverified in real CLI run**
- Because deep fails, new text rendering (`strengths/risks/autonomyBlockers`) can’t be validated end-to-end on `portal` yet.

4. **Context excerpt selection misses many useful “plan” docs**
- `architecture-doc` selection relies on strict filename regex; `portal` docs are rich but mostly excluded by naming.

---

## Section E: Recommended next actions (prioritized)

1. **Fix deep-Claude execution first**
- Remove or relax `--max-turns 1` in [claude-code.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/claude-code.ts).
- Add an integration test that fails if Claude returns envelope subtype `error_max_turns` with zero findings.

2. **Add robust fallback parsing for Claude result envelopes**
- If `structured_output` is missing and `result` is empty/error subtype, surface a clearer diagnostic (including subtype/stop_reason) instead of generic “no valid findings”.

3. **Improve deep context doc selection**
- Expand [deep-context.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/deep-context.ts) to include high-signal planning docs (`docs/plans/**`, runbooks, refactor plans), not only architecture-named files.
