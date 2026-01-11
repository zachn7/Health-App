# Scripts Directory

## playwright-problems-summary.mjs

Extracts only failing, skipped, and interrupted tests from a Playwright JSON report.

### Usage

```bash
# Run Playwright tests with JSON reporter
npx playwright test --reporter=json > test-results/playwright-results.json

# Generate problems-only summary
node scripts/playwright-problems-summary.mjs test-results/playwright-results.json
```

### Output

The script outputs to both:
1. **Console**: Markdown-formatted summary
2. **File**: `test-results/playwright-problems.md` (for easy copy/paste)

### Example Output

```markdown
# Playwright Test Problems Summary

**Total Problems:** 3

- Failed: 1
- Skipped: 2
- Interrupted/Did-not-run: 0
- Failed Suites (causing did-not-run): 0

---

## ❌ Failed Tests

### 1. Example Test Suite › should fail

**File:** `tests/e2e/example.spec.ts`:10
**Error:** Expected 'actual' to equal 'expected'


## ⏭️ Skipped Tests

### 1. Example Test Suite › should be skipped

**File:** `tests/e2e/example.spec.ts`:20
**Skip Reason:** SKIPPED: Need to investigate flaky test

---
```

### Current Skipped Tests in This Repo

Based on grep analysis as of 2026-01-11:

| File | Line | Type | Reason |
|------|------|------|--------|
| `tests/e2e/regression-usda-foods.spec.ts` | 692 | describe.skip | No reason specified (USDA Inference and Validation) |
| `tests/e2e/regression-usda-foods.spec.ts` | 825 | describe.skip | SKIPPED: E2E test route handler complexity - validation logic is tested separately |
| `tests/e2e/regression-usda-foods.spec.ts` | 829 | test.skip | SKIPPED: E2E test route handler complexity - validation logic is tested separately |
| `tests/e2e/regression-usda-foods.spec.ts` | 832 | test.skip | SKIPPED: E2E test route handler complexity - validation logic is tested separately |

Total: 4 skip instances (2 describe.skip blocks, 2 test.skip calls)

## assert-no-playwright-skips.mjs

CI guard that fails if any `test.skip()` or `describe.skip()` calls are found in E2E tests.

Prevents accidental regressions back to skipped tests.
