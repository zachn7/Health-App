import { test, expect } from '@playwright/test';

test.describe('No Coming Soon Text (F05)', () => {
  test.beforeEach(async ({ page }) => {
    // Set up complete profile to access all pages
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('age_gate_accepted', 'true');
      localStorage.setItem('age_gate_timestamp', new Date().toISOString());
    });
  });

  test('should not show Coming Soon on main pages', async ({ page }) => {
    const pages = [
      { path: '/', name: 'Dashboard' },
      { path: '/profile', name: 'Profile' },
      { path: '/coach', name: 'Coach' },
      { path: '/workouts', name: 'Workouts' },
      { path: '/log/workout', name: 'Workout Logger' },
      { path: '/nutrition', name: 'Nutrition' },
      { path: '/progress', name: 'Progress' },
      { path: '/injury', name: 'Injury' },
      { path: '/privacy', name: 'Privacy' },
      { path: '/legal/privacy', name: 'Privacy Policy' },
      { path: '/legal/terms', name: 'Terms of Use' },
      { path: '/legal/disclaimer', name: 'Medical Disclaimer' }
    ];

    for (const pageInfo of pages) {
      await page.goto(`./#${pageInfo.path}`);
      await page.waitForLoadState();
      
      // Check page content
      const pageContent = await page.textContent('body');
      
      // Should not contain "Coming Soon" text
      expect(pageContent).not.toContain('Coming Soon');
      expect(pageContent).not.toContain('coming soon');
    }
  });
}); 