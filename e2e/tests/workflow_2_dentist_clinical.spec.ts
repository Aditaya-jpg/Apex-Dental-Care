import { test, expect } from '@playwright/test';

test.describe('Workflow 2: PGI Doctor Clinical EMR, FDI & Perio Chart, Treatments & Prescriptions', () => {
    test('should login as PGI doctor, inspect dashboard, open patient EMR, and access clinical tabs', async ({ page }) => {
        // 1. Login as Dr. Mehta (PGI Doctor)
        await page.goto('/login');
        await page.fill('input[name="username"]', 'dr.mehta@pgi.edu.in');
        await page.fill('input[name="password"]', 'Dental@123');
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(/.*dashboard/);

        // 2. Open Patients Directory & Navigate to First Patient Dossier
        await page.click('a[href="/patients"]');
        await expect(page).toHaveURL(/.*patients/);
        await page.click('tbody tr:first-child a');
        await expect(page).toHaveURL(/.*patients\/\d+/);

        // 3. Switch to Dental Chart Tab (FDI + Perio toggle)
        await page.click('button:has-text("FDI Dental Chart")');
        await expect(page.locator('text=Maxilla (Upper Jaw)')).toBeVisible();

        // 4. Select a tooth (e.g., Tooth 16)
        await page.locator('button:has-text("16")').first().click();

        // 5. Switch to Treatment Plans Tab (cost-free PGI care plans + Surgical Log)
        await page.click('button:has-text("Treatment Plans")');
        await expect(page.locator('button:has-text("New Treatment Plan")')).toBeVisible();

        // 6. Switch to Prescriptions Tab
        await page.click('button:has-text("Prescriptions")');
        await expect(page.locator('button:has-text("Write Prescription")')).toBeVisible();
    });
});
