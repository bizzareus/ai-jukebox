import { test, expect } from '@playwright/test';

test.describe('QR Code, Notifications, GTM features', () => {
  test('admin login and Settings show QR Code, Notifications, Branding', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: /Jukebox Admin/i })).toBeVisible();

    await page.getByLabel(/email/i).fill('admin@jukebox.local');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/(admin\/dashboard|admin\/venues)/);
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

    expect(await page.getByText('QR Code').isVisible()).toBe(true);
    expect(await page.getByText('Generate poster').isVisible()).toBe(true);
    expect(await page.getByText('Enable push notifications').isVisible()).toBe(true);
    expect(await page.getByText('Branding').isVisible()).toBe(true);
    expect(await page.getByLabel(/logo url/i).isVisible()).toBe(true);
  });

  test('super admin can open GTM page and see resolve flow', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel(/email/i).fill('superadmin@jukebox.local');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/admin\//);
    await page.goto('/admin/gtm');
    await expect(page.getByRole('heading', { name: /GTM.*onboard/i })).toBeVisible();
    await expect(page.getByPlaceholder(/google\.com\/maps/)).toBeVisible();
    await expect(page.getByRole('button', { name: /resolve/i })).toBeVisible();
    await expect(page.getByText(/paste a google maps link/i)).toBeVisible();
  });
});
