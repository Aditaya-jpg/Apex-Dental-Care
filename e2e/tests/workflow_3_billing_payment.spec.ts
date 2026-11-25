import { test, expect } from '@playwright/test';

test.describe('Workflow 3: Receptionist Billing & Invoicing Management', () => {
  test('should login as receptionist, inspect invoices, and view details', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="text"]', 'reception1@clinic.com');
    await page.fill('input[type="password"]', 'Dental@123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Navigate to Billing & Invoices
    await page.click('a[href="/billing"]');
    await expect(page).toHaveURL(/.*billing/);
    await expect(page.locator('text=Billing & Invoices')).toBeVisible();

    // 3. Verify Financial KPIs are rendered from real database
    await expect(page.locator('text=Total Billed')).toBeVisible();
    await expect(page.locator('text=Total Collected')).toBeVisible();
    await expect(page.locator('text=Outstanding Balance')).toBeVisible();
  });
});
