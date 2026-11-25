import { test, expect } from '@playwright/test';

test.describe('Workflow 1: PGI Receptionist Attendance Desk & RBAC Isolation', () => {
    test('should login as receptionist, land directly on /attendance, and see Attendance Desk only', async ({ page }) => {
        // 1. Login with PGI Reception account
        await page.goto('/login');
        await page.fill('input[name="username"]', 'reception@pgi.edu.in');
        await page.fill('input[name="password"]', 'Dental@123');
        await page.click('button[type="submit"]');

        // 2. Verify redirected directly to /attendance (not /dashboard or /patients)
        await expect(page).toHaveURL(/.*attendance/);
        await expect(page.locator('h1:has-text("PGI Reception & Patient Attendance Desk")')).toBeVisible();
        await expect(page.locator('text=Walk-In Patient Check-In')).toBeVisible();

        // 3. Sidebar must expose Attendance only
        await expect(page.locator('aside a[href="/attendance"]')).toBeVisible();
        await expect(page.locator('aside a[href="/patients"]')).toHaveCount(0);
        await expect(page.locator('aside a[href="/dashboard"]')).toHaveCount(0);

        // 4. Attempting to visit clinical routes must show Access Restricted
        await page.goto('/patients');
        await expect(page.locator('text=Access Restricted')).toBeVisible();
    });
});
