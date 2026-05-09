import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Pre-created test user (created via Supabase admin API, email confirmed)
const TEST_EMAIL = 'apitest@pokergame.dev';
const TEST_PASSWORD = 'testpass123456';
const TEST_NAME = 'APITester';

// Sign in via the login UI and wait for lobby redirect
async function signIn(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto(`${BASE_URL}/login`);
  // Make sure we're in Sign In mode (it's default, but be explicit)
  const signInTab = page.getByRole('button', { name: 'Sign In' }).first();
  await signInTab.waitFor({ state: 'visible' });
  await signInTab.click();
  // Fill credentials
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  // Submit — the submit button is the last "Sign In" button (the tab is first)
  await page.getByRole('button', { name: 'Sign In' }).last().click();
  await page.waitForURL(`${BASE_URL}/lobby`, { timeout: 20000 });
  // Wait for lobby content to finish loading (auth + profile + tables fetched)
  await page.getByText('Your Tables').waitFor({ state: 'visible', timeout: 25000 });
}

test.describe('Landing Page', () => {
  test('renders hero heading and feature cards', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: /Play Poker/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Create a Table/i })).toBeVisible();
    // The hero Sign In link — use the nav one (first) to avoid the card-deck overlay issue
    await expect(page.getByRole('link', { name: 'Sign In' }).first()).toBeVisible();
    // Feature card headings (h3 elements — unambiguous)
    await expect(page.getByRole('heading', { name: 'Real-Time Play' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Private Rooms' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chip Wallet' })).toBeVisible();
  });

  test('Create a Table link navigates to lobby or login', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: /Create a Table/i }).click();
    // Unauthenticated → lobby redirects to login; or directly to lobby if already authed
    await expect(page).toHaveURL(/\/(lobby|login)/);
  });

  test('Sign In nav link navigates to /login', async ({ page }) => {
    await page.goto(BASE_URL);
    // Use the Nav's "Sign In" link (first) — the hero link is obscured by floating card overlay
    await page.getByRole('link', { name: 'Sign In' }).first().click();
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});

test.describe('Login page UI', () => {
  test('renders Sign In and Create Account tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' }).first()).toBeVisible();
  });

  test('clicking Create Account tab reveals display name field', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Click the tab — in Sign In mode there is only ONE "Create Account" button (the tab)
    await page.getByRole('button', { name: 'Create Account' }).first().click();
    // The display name input appears only in signup mode
    await expect(page.getByPlaceholder('Poker Pro')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('wrong credentials shows error message', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByPlaceholder('you@example.com').fill('nobody@nowhere.invalid');
    await page.getByPlaceholder('••••••••').fill('badpassword99');
    await page.getByRole('button', { name: 'Sign In' }).last().click();
    // Error message rendered inside the login card — look for any visible text
    await expect(
      page.locator('form').locator('div').filter({ hasText: /invalid|incorrect|error|failed|wrong/i }).last()
    ).toBeVisible({ timeout: 12000 });
  });

  test('successful sign in with existing user redirects to lobby', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(`${BASE_URL}/lobby`);
    await expect(page.getByText('Your Tables')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Lobby (requires auth)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('shows username in nav after sign in', async ({ page }) => {
    // Username appears in the header profile button
    await expect(page.locator('header').getByText(TEST_NAME)).toBeVisible({ timeout: 10000 });
  });

  test('shows chip balance in header', async ({ page }) => {
    // Chip balance is in the nav (formatted like 10,000)
    await expect(page.locator('header').getByText(/\d{1,3}(,\d{3})*/)).toBeVisible({ timeout: 10000 });
  });

  test('shows lobby content section', async ({ page }) => {
    // "Your Tables" heading always renders
    await expect(page.getByText('Your Tables')).toBeVisible({ timeout: 10000 });
  });

  test('Create Table button opens modal with form fields', async ({ page }) => {
    await page.getByRole('button', { name: /Create Table/i }).first().click();
    // Wait for modal heading to appear
    await expect(page.getByRole('heading', { name: 'Create Table' })).toBeVisible({ timeout: 5000 });
    // Check modal-specific labels (exact to avoid strict-mode violations with table card text)
    await expect(page.getByText('Blinds', { exact: true })).toBeVisible();
    await expect(page.getByText('Buy-In Range', { exact: true })).toBeVisible();
    await expect(page.getByText(/Max Players/i).first()).toBeVisible();
  });

  test('Create Table form submits and navigates to a room', async ({ page }) => {
    await page.getByRole('button', { name: /Create Table/i }).first().click();
    // Submit the modal with default values
    await page.getByRole('button', { name: 'Create Table' }).last().click();
    await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 });
  });

  test('Join by code navigates to room URL', async ({ page }) => {
    await page.getByPlaceholder('Enter room code…').fill('TESTXX');
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/room/TESTXX`);
  });

  test('Nav shows PokerNight branding', async ({ page }) => {
    await expect(page.locator('header').getByText('PokerNight')).toBeVisible();
  });

  test('Sign out navigates away from lobby', async ({ page }) => {
    // Open profile dropdown — the last button in the header
    await page.locator('header button').last().click();
    // Click Sign Out button in dropdown
    await page.getByRole('button', { name: /Sign Out/i }).click();
    // Should redirect to root or login
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 10000 });
  });
});

test.describe('Room page', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('invalid room code shows not-found state', async ({ page }) => {
    await page.goto(`${BASE_URL}/room/ZZZZZZ`);
    // Use exact heading text to avoid strict-mode violation (the page also renders "...doesn't exist" text)
    await expect(page.getByText('Table Not Found', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /Back to Lobby/i })).toBeVisible();
  });

  test('creating a table lands on a room page with lobby back-link', async ({ page }) => {
    await page.goto(`${BASE_URL}/lobby`);
    await page.getByRole('button', { name: /Create Table/i }).first().click();
    await page.getByRole('button', { name: 'Create Table' }).last().click();
    await page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 });

    // Room always shows back-to-lobby link
    await expect(page.getByText(/← Lobby/i)).toBeVisible({ timeout: 10000 });
  });
});
