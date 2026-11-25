import { test, expect } from '@playwright/test';

test.describe('Workflow 4: PGI Dental Administrator Audit Logs & Staff Management', () => {
    test('should login as admin, inspect PGI audit trail, and manage PGI staff accounts', async ({ page }) => {
        // 1. Login as PGI Admin
        await page.goto('/login');
        await page.fill('input[name="username"]', 'admin@pgi.edu.in');
        await page.fill('input[name="password"]', 'Dental@123');
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(/.*dashboard/);

        // 2. Navigate to Audit Logs
        await page.click('a[href="/audit-logs"]');
        await expect(page).toHaveURL(/.*audit-logs/);
        await expect(page.locator('text=System Audit & Compliance Log')).toBeVisible();
        await expect(page.locator('text=PGI Compliance Trail')).toBeVisible();

        // 3. Navigate to PGI Staff & User Accounts
        await page.click('a[href="/users"]');
        await expect(page).toHaveURL(/.*users/);
        await expect(page.locator('text=PGI Staff & User Accounts')).toBeVisible();
        await expect(page.locator('button:has-text("Add Staff Member")')).toBeVisible();
    });
});
