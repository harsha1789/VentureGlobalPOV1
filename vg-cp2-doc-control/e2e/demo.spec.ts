import { test, expect, Page } from '@playwright/test';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:4200';

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function login(page: Page, username = 'harsha', password = 'test') {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('.login-btn').click();
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function runScenario(page: Page, scenarioId: 'valid' | 'invalid' | 'bulk') {
  await page.locator(`.scenario-card`).filter({ hasText: scenarioId === 'valid' ? 'Valid Contract' : scenarioId === 'invalid' ? 'Invalid Contract' : 'Bulk' }).click();
  await page.locator('.run-all-btn').click();
  // Wait for pipeline to complete — poll audit table for new row
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll('tbody tr:not(.processing)');
    return rows.length > 0;
  }, { timeout: 30000 });
}

// ── TEST SUITE ────────────────────────────────────────────────────────────────

test.describe('VG CP2 LNG — Document Control Automation', () => {

  // ── AUTH ────────────────────────────────────────────────────────────────────

  test.describe('Authentication', () => {

    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    });

    test('should show login screen with correct branding', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await expect(page.locator('.login-title')).toHaveText('VG CP2 LNG');
      await expect(page.locator('.login-subtitle')).toContainText('Document Control');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator('#username').fill('wronguser');
      await page.locator('#password').fill('wrongpass');
      await page.locator('.login-btn').click();
      await expect(page.locator('.login-error.show')).toBeVisible();
      await expect(page.locator('.login-error.show')).toContainText('Invalid');
    });

    test('should show error for missing fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator('.login-btn').click();
      await expect(page.locator('.login-error.show')).toBeVisible();
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
      await expect(page.locator('.tb-uname')).toHaveText('Harsha');
    });

    test('should show user initials in topbar avatar', async ({ page }) => {
      await login(page);
      await expect(page.locator('.tb-avatar')).toHaveText('HA');
    });

    test('should login with Enter key press', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      await page.locator('#username').fill('harsha');
      await page.locator('#password').fill('test');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
    });

    test('should logout and return to login screen', async ({ page }) => {
      await login(page);
      await page.locator('.tb-btn').filter({ hasText: 'Sign out' }).click();
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    });

    test('should clear session on logout', async ({ page }) => {
      await login(page);
      await page.locator('.tb-btn').filter({ hasText: 'Sign out' }).click();
      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page).toHaveURL(`${BASE_URL}/login`);
    });
  });

  // ── DASHBOARD ───────────────────────────────────────────────────────────────

  test.describe('Dashboard layout', () => {

    test.beforeEach(async ({ page }) => await login(page));

    test('should show all 3 scenario cards', async ({ page }) => {
      const cards = page.locator('.scenario-card');
      await expect(cards).toHaveCount(3);
    });

    test('should show terminal panel', async ({ page }) => {
      await expect(page.locator('.terminal-panel')).toBeVisible();
    });

    test('should show audit log table with empty state', async ({ page }) => {
      await expect(page.locator('.empty-state')).toBeVisible();
      await expect(page.locator('.empty-txt')).toContainText('No records yet');
    });

    test('should show session stats all at zero initially', async ({ page }) => {
      await expect(page.locator('.sp-stat-num.total')).toHaveText('0');
      await expect(page.locator('.sp-stat-num.pass')).toHaveText('0');
      await expect(page.locator('.sp-stat-num.fail')).toHaveText('0');
    });

    test('should disable run button when no scenario selected', async ({ page }) => {
      await expect(page.locator('.run-all-btn')).toBeDisabled();
    });

    test('should enable run button when scenario selected', async ({ page }) => {
      await page.locator('.scenario-card').first().click();
      await expect(page.locator('.run-all-btn')).toBeEnabled();
    });
  });

  // ── VALID CONTRACT ───────────────────────────────────────────────────────────

  test.describe('Scenario: Valid Contract', () => {

    test.beforeEach(async ({ page }) => await login(page));

    test('should select valid scenario and update button label', async ({ page }) => {
      await page.locator('.scenario-card').filter({ hasText: 'Valid Contract' }).click();
      await expect(page.locator('.run-all-btn')).toContainText('Run Valid Contract');
    });

    test('should process valid contract and show ACCEPTED decision', async ({ page }) => {
      await runScenario(page, 'valid');
      const pill = page.locator('.status-pill.accept').first();
      await expect(pill).toBeVisible();
      await expect(pill).toContainText('ACCEPTED');
    });

    test('should add one row to audit log after valid run', async ({ page }) => {
      await runScenario(page, 'valid');
      const rows = page.locator('tbody tr:not(.processing)');
      await expect(rows).toHaveCount(1);
    });

    test('should show correct document name in audit table', async ({ page }) => {
      await runScenario(page, 'valid');
      await expect(page.locator('.doc-col').first()).toContainText('C2-WOR-SOW-0042');
    });

    test('should show TRN number starting with TRN-C2-WOR', async ({ page }) => {
      await runScenario(page, 'valid');
      await expect(page.locator('.trn-col').first()).toContainText('TRN-C2-WOR');
    });

    test('should show all 4 tier badges for valid contract', async ({ page }) => {
      await runScenario(page, 'valid');
      const tierTags = page.locator('tbody tr:first-child .tier-tag');
      await expect(tierTags).toHaveCount(4);
    });

    test('should update session stats after valid run', async ({ page }) => {
      await runScenario(page, 'valid');
      await expect(page.locator('.sp-stat-num.total')).toHaveText('1');
      await expect(page.locator('.sp-stat-num.pass')).toHaveText('1');
    });

    test('should show score above 70 for valid contract', async ({ page }) => {
      await runScenario(page, 'valid');
      const scoreText = await page.locator('.bar-val').first().textContent();
      expect(Number(scoreText)).toBeGreaterThan(70);
    });

    test('should log pipeline steps in terminal', async ({ page }) => {
      await runScenario(page, 'valid');
      const terminal = page.locator('.terminal-body');
      await expect(terminal).toContainText('T1');
      await expect(terminal).toContainText('T2');
      await expect(terminal).toContainText('T3');
      await expect(terminal).toContainText('T4');
    });
  });

  // ── INVALID CONTRACT ─────────────────────────────────────────────────────────

  test.describe('Scenario: Invalid Contract', () => {

    test.beforeEach(async ({ page }) => await login(page));

    test('should process invalid contract and show REJECTED decision', async ({ page }) => {
      await runScenario(page, 'invalid');
      const pill = page.locator('.status-pill.reject').first();
      await expect(pill).toBeVisible();
      await expect(pill).toContainText('REJECTED');
    });

    test('should show low score for invalid contract', async ({ page }) => {
      await runScenario(page, 'invalid');
      const scoreText = await page.locator('.bar-val').first().textContent();
      expect(Number(scoreText)).toBeLessThan(60);
    });

    test('should increment fail stat after invalid run', async ({ page }) => {
      await runScenario(page, 'invalid');
      await expect(page.locator('.sp-stat-num.fail')).toHaveText('1');
    });

    test('should log FAILURES DETECTED in terminal', async ({ page }) => {
      await runScenario(page, 'invalid');
      await expect(page.locator('.terminal-body')).toContainText('FAILURES DETECTED');
    });
  });

  // ── BULK PROCESSING ──────────────────────────────────────────────────────────

  test.describe('Scenario: Bulk Processing', () => {

    test.beforeEach(async ({ page }) => await login(page));

    test('should process all 8 bulk documents', async ({ page }) => {
      // Bulk needs more time
      test.setTimeout(60000);

      await page.locator('.scenario-card').filter({ hasText: 'Bulk' }).click();
      await page.locator('.run-all-btn').click();

      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('tbody tr:not(.processing)');
        return rows.length >= 8;
      }, { timeout: 55000 });

      const rows = page.locator('tbody tr:not(.processing)');
      await expect(rows).toHaveCount(8);
    });

    test('should show mixed decisions in bulk run', async ({ page }) => {
      test.setTimeout(60000);

      await page.locator('.scenario-card').filter({ hasText: 'Bulk' }).click();
      await page.locator('.run-all-btn').click();

      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('tbody tr:not(.processing)');
        return rows.length >= 8;
      }, { timeout: 55000 });

      const accepted = await page.locator('.status-pill.accept').count();
      const rejected = await page.locator('.status-pill.reject').count();
      expect(accepted).toBeGreaterThan(0);
      expect(rejected).toBeGreaterThan(0);
    });

    test('should update total stats to 8 after bulk run', async ({ page }) => {
      test.setTimeout(60000);

      await page.locator('.scenario-card').filter({ hasText: 'Bulk' }).click();
      await page.locator('.run-all-btn').click();

      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('tbody tr:not(.processing)');
        return rows.length >= 8;
      }, { timeout: 55000 });

      await expect(page.locator('.sp-stat-num.total')).toHaveText('8');
    });
  });

  // ── AUDIT LOG FEATURES ───────────────────────────────────────────────────────

  test.describe('Audit log features', () => {

    test.beforeEach(async ({ page }) => {
      await login(page);
      await runScenario(page, 'valid');
    });

    test('should clear audit log', async ({ page }) => {
      await page.locator('.audit-btn').filter({ hasText: 'Clear' }).click();
      await expect(page.locator('.empty-state')).toBeVisible();
      await expect(page.locator('.sp-stat-num.total')).toHaveText('0');
    });

    test('should export CSV', async ({ page }) => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('.audit-btn').filter({ hasText: 'Export CSV' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/VG_CP2_AuditLog.*\.csv/);
    });

    test('should update record count in header', async ({ page }) => {
      await expect(page.locator('.audit-count')).toContainText('1 record');
    });
  });

  // ── FULL E2E FLOW ────────────────────────────────────────────────────────────

  test.describe('Full end-to-end flow', () => {

    test('complete login → valid run → invalid run → bulk → export → logout', async ({ page }) => {
      test.setTimeout(120000);

      // 1. Login
      await login(page);
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`);

      // 2. Run valid contract
      await runScenario(page, 'valid');
      await expect(page.locator('.status-pill.accept')).toBeVisible();

      // 3. Run invalid contract
      await runScenario(page, 'invalid');
      await expect(page.locator('.status-pill.reject')).toBeVisible();

      // 4. Run bulk
      await page.locator('.scenario-card').filter({ hasText: 'Bulk' }).click();
      await page.locator('.run-all-btn').click();
      await page.waitForFunction(() => {
        const rows = document.querySelectorAll('tbody tr:not(.processing)');
        return rows.length >= 10;
      }, { timeout: 60000 });

      // 5. Total should be 10
      await expect(page.locator('.sp-stat-num.total')).toHaveText('10');

      // 6. Export CSV
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('.audit-btn').filter({ hasText: 'Export CSV' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.csv$/);

      // 7. Logout
      await page.locator('.tb-btn').filter({ hasText: 'Sign out' }).click();
      await expect(page).toHaveURL(`${BASE_URL}/login`);
      await expect(page.locator('.login-screen')).toBeVisible();
    });
  });
});
