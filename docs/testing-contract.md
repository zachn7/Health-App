# Testing Contract

This document establishes the contract between UI components and E2E tests to prevent future test drift.

## Core Principles

1. **Use Semantic Selectors**
   - Prefer `getByRole()` for user-facing controls (buttons, links, inputs)
   - Use `getByTestId()` for ambiguous or styled-only elements
   - NEVER use structural CSS selectors like `.space-y-4`, `.flex`, or other layout classes

2. **No Hard Sleeps**
   - Use Playwright's auto-waiting features
   - Wait for specific state: `expect(locator).toBeVisible()`, `expect(locator).toHaveCount(n)`
   - Only use `waitForTimeout()` for intentional delays (debounce timing, etc.)

3. **Shared Test IDs**
   - All interactive elements that tests touch must have a `data-testid` attribute
   - Test IDs are defined in `src/testIds.ts` as the single source of truth
   - Both components and tests import from this shared file
   - When a test ID changes, TypeScript will immediately show which tests need updating

4. **Web-First Assertions**
   - Use `expect(locator).toBeVisible()` instead of checking display properties
   - Use `expect(locator).toHaveText()` instead of parsing innerHTML
   - Use `expect(locator).toHaveURL()` for navigation verification

## Implementation Guidelines

### Adding New Test IDs

```typescript
// src/testIds.ts
export const testIds = {
  featureName: {
    elementId: 'feature-element-id',  // kebab-case
    dynamicElement: (id: string | number) => `feature-element-${id}`,  // if dynamic
  }
} as const;

// src/components/ComponentName.tsx
<div data-testid={testIds.featureName.elementId}>
  {/* component content */}
</div>

// tests/e2e/feature.spec.ts
import { testIds } from '../../../src/testIds';
await expect(page.getByTestId(testIds.featureName.elementId)).toBeVisible();
```

### Selector Examples

✅ GOOD:
```typescript
// Semantic role - user-visible
await page.getByRole('button', { name: 'Save' }).click();

// Test ID - styled/internal
await page.getByTestId(testIds.nutrition.addButton).click();

// Role with filter
await page.getByRole('listitem').filter({ hasText: 'Apple' }).click();
```

❌ BAD:
```typescript
// Structural CSS - brittle
await page.locator('.space-y-4').first().click();
await page.locator('.btn-primary').click();

// Hard sleep - flaky
await page.waitForTimeout(5000);
```

## Common Patterns

### Waiting for Asynchronous Operations

```typescript
// ✅ GOOD: Wait for specific outcome
await expect(page.getByTestId('result-list')).toHaveCount(5);

// ❌ BAD: Arbitrary wait
await page.waitForTimeout(3000);
```

### Modal Interactions

```typescript
// Open modal
await page.getByTestId('modal-trigger').click();

// Wait for modal to appear
await expect(page.getByTestId('modal-content')).toBeVisible();

// Perform action
await page.getByTestId('modal-save-button').click();

// Wait for modal to close
await expect(page.getByTestId('modal-content')).not.toBeVisible();
```

### Form Validation

```typescript
// Fill field
await page.getByTestId('input-field').fill('value');

// Submit form
await page.getByRole('button', { name: 'Submit' }).click();

// Wait for success/error
await expect(page.getByTestId('success-message')).toBeVisible();
```

## When Tests Fail

Two possibilities:

1. **Test is outdated** (most common)
   - UI text changed
   - Feature removed/moved
   - Flow modified
   - **Fix**: Update test expectations, test IDs, or locator strategy

2. **App has a bug** (regression)
   - Feature not working as expected
   - Data not persisting
   - State not updating correctly
   - **Fix**: Fix the app, not the test

## CI Configuration

Playwright is configured with:
- `retries: 1` in CI (process.env.CI)
- `trace: 'on-first-retry'` for debugging
- Workers: 1 in CI for stability
- Workers: auto in local dev for speed

## Review Checklist

Before merging code that touches-tested features:

- [ ] Does the UI change require updating `/src/testIds.ts`?
- [ ] Are all test IDs using kebab-case?
- [ ] Do tests use `getByRole` or `getByTestId` (no CSS selectors)?
- [ ] Are there no hard `waitForTimeout` sleeps except for intentional delays?
- [ ] Do tests verify meaningful UI behavior, not implementation details?

## References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Principles](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)