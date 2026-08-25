import { expect, test } from '@playwright/test';
import { anmelden, KONTEN } from './hilfe';

test('falsches Passwort laesst niemanden hinein', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/name/i).fill(KONTEN.mitarbeit.name);
  await page.getByLabel(/passwort/i).fill('ganz-falsch-aber-lang');
  await page.getByRole('button', { name: /anmelden/i }).click();

  await expect(page.getByText(/fehlgeschlagen/i)).toBeVisible();
});

test('richtige Anmeldung fuehrt in den Kalender', async ({ page }) => {
  await anmelden(page, KONTEN.mitarbeit);
  await expect(page.getByText(KONTEN.mitarbeit.name).first()).toBeVisible();
});

test('ein Neuladen wirft nicht aus der Anwendung', async ({ page }) => {
  // Dafuer gibt es /api/me: Die Sitzung ueberlebt das Neuladen.
  await anmelden(page, KONTEN.mitarbeit);
  await page.reload();
  await expect(page.getByRole('button', { name: /anmelden/i })).toHaveCount(0);
});
