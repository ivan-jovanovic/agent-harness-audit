# Skill: validate

Run the full validation suite for agent-harness-audit and report results.

## When to use

Use this skill after writing or modifying any code to verify the project is in a shippable state. Also use before marking any Paperclip task done.

## Steps

1. Run lint:
```bash
npm run lint
```
If it fails, report the errors. Do not proceed to fix unless asked.

2. Run typecheck:
```bash
npm run typecheck
```
If it fails, report the type errors.

3. Run tests:
```bash
npm test
```
Report pass/fail counts. If tests fail, show the failing test names and errors.

4. Run build:
```bash
npm run build
```
Verify `dist/` is populated.

5. Smoke test the built CLI (optional, skip if build failed):
```bash
node dist/cli.js audit . --json | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('Score:', r.scoring.overallScore, '| Categories:', r.scoring.categoryScores.map(c=>c.id+':'+c.score).join(', '))"
```

## Output format

Report results as a concise markdown summary:

```
## Validation Results

| Check | Status |
|---|---|
| lint | ✅ pass / ❌ fail |
| typecheck | ✅ pass / ❌ fail |
| tests | ✅ N passed / ❌ N failed |
| build | ✅ pass / ❌ fail |

[If anything failed, list the errors below]
```

## Notes

- All four checks must pass before marking any implementation task done.
- If lint or typecheck fail, do not commit.
- The smoke test self-audits the repo — a score above 60 is expected once CLAUDE.md and AGENTS.md are in place.
