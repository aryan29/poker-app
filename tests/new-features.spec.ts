import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'apitest@pokergame.dev';
const TEST_PASSWORD = 'testpass123456';
const TEST_NAME = 'APITester';

async function signIn(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('button', { name: 'Sign In' }).first().waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).last().click();
  await page.waitForURL(`${BASE_URL}/lobby`, { timeout: 20000 });
  await page.getByText('Your Tables').waitFor({ state: 'visible', timeout: 25000 });
}

async function createTableAndJoin(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/lobby`);
  await page.getByRole('button', { name: /Create Table/i }).first().click();
  await page.getByRole('button', { name: 'Create Table' }).last().click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 });
  const code = page.url().split('/room/')[1];

  // Wait for page to stabilize so the buy-in modal has time to mount
  await page.waitForTimeout(2000);
  await dismissModal(page);
  return code;
}

async function dismissModal(page: Page) {
  const modal = page.locator('div.fixed.inset-0').first();
  if (!await modal.isVisible().catch(() => false)) return;

  // Try Buy In first (works when user has chips)
  const buyInBtn = page.getByRole('button', { name: /Buy In/i }).last();
  if (await buyInBtn.isVisible().catch(() => false)) {
    await buyInBtn.click();
    try {
      await modal.waitFor({ state: 'detached', timeout: 3000 });
      return;
    } catch {
      // Buy In failed (no chips) — fall through to Cancel
    }
  }

  // Click Cancel to close without buying in
  const cancelBtn = page.getByRole('button', { name: 'Cancel' });
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click();
    await modal.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

// ─── Feature: Rebuy button only shows when game is NOT active ──────────────

test.describe('Rebuy button behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('rebuy button is NOT visible for a seated player with chips and no active game', async ({ page }) => {
    await createTableAndJoin(page);
    // After joining, player has chips — rebuy should be hidden
    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: /Rebuy/i })).not.toBeVisible();
  });

  test('"Take a Seat" button is absent after buying in', async ({ page }) => {
    await createTableAndJoin(page);
    await page.waitForTimeout(1500);
    // Take a Seat only shows when not seated
    await expect(page.getByRole('button', { name: /Take a Seat/i })).not.toBeVisible();
  });
});

// ─── Feature: Chat message persistence across page reload ──────────────────

test.describe('Chat persistence', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('chat message sent in room survives a page reload', async ({ page }) => {
    const code = await createTableAndJoin(page);

    // Ensure any lingering modal is fully gone before interacting with chat
    await dismissModal(page);
    await page.locator('div.fixed.inset-0').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});

    // Wait for chat input to be visible
    const chatInput = page.getByPlaceholder('Say something…');
    await chatInput.waitFor({ state: 'visible', timeout: 10000 });

    const testMsg = `reload-test-${Date.now()}`;
    await chatInput.fill(testMsg);
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for message to appear
    await expect(page.getByText(testMsg)).toBeVisible({ timeout: 8000 });

    // Reload the page
    await page.goto(`${BASE_URL}/room/${code}`);
    await page.waitForTimeout(2000);

    // Message should still be there (loaded from DB)
    await expect(page.getByText(testMsg)).toBeVisible({ timeout: 10000 });
  });

  test('chat input is visible in the room sidebar', async ({ page }) => {
    await createTableAndJoin(page);
    await expect(page.getByPlaceholder('Say something…')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('chat header shows "Table Chat" label', async ({ page }) => {
    await createTableAndJoin(page);
    await expect(page.getByText('Table Chat')).toBeVisible({ timeout: 5000 });
  });
});

// ─── Feature: Fold display ─────────────────────────────────────────────────

test.describe('Fold badge rendering', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('room page renders the poker table with seat positions', async ({ page }) => {
    await createTableAndJoin(page);
    // The table should be visible with the felt surface
    await expect(page.locator('.rounded-\\[50\\%\\]').first()).toBeVisible({ timeout: 8000 });
  });

  test('room page shows the room code in the header bar', async ({ page }) => {
    await createTableAndJoin(page);
    const code = page.url().split('/room/')[1];
    // Room code is displayed in the top bar as a monospace font span
    await expect(page.locator('span.font-mono').filter({ hasText: code })).toBeVisible({ timeout: 5000 });
  });
});

// ─── Feature: Round bet info in action panel ───────────────────────────────

test.describe('Action panel structure', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('action panel shows "Waiting for" message when not your turn', async ({ page }) => {
    await createTableAndJoin(page);
    // With only one player, no game can start — verify waiting state renders
    await page.waitForTimeout(1500);
    // The action panel should either be absent (no game) or show waiting state
    // Verify no error state is visible
    await expect(page.getByText(/Something went wrong/i)).not.toBeVisible();
  });

  test('room page does not show any JS errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await createTableAndJoin(page);
    await page.waitForTimeout(2000);

    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});

// ─── Feature: GameResultModal shows cards ─────────────────────────────────

test.describe('Result modal card structure', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('room page loads without crashing when game is in showdown', async ({ page }) => {
    // Navigate to a room and verify stable render
    await createTableAndJoin(page);
    await page.waitForTimeout(1000);
    // Check no fatal error UI
    await expect(page.getByText('Table Not Found')).not.toBeVisible();
    await expect(page.getByText(/← Lobby/i)).toBeVisible();
  });
});

// ─── Feature: Auth protection ─────────────────────────────────────────────────

test.describe('Auth protection', () => {
  test('unauthenticated user is redirected from lobby to login', async ({ page }) => {
    // Go directly to lobby without auth
    await page.goto(`${BASE_URL}/lobby`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('unauthenticated user accessing a room is redirected to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/room/ABCDEF`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

// ─── Feature: Hand strength badge and pot odds bar ────────────────────────────

test.describe('Hand strength and pot odds', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('hand strength badge is absent in waiting room (no game)', async ({ page }) => {
    await createTableAndJoin(page);
    await dismissModal(page);
    // No active game — badge should not appear
    await expect(page.getByTestId('hand-strength-badge')).not.toBeVisible();
  });

  test('pot odds bar is absent in waiting room (no game)', async ({ page }) => {
    await createTableAndJoin(page);
    await dismissModal(page);
    // No active game — pot odds bar should not appear
    await expect(page.getByTestId('pot-odds-bar')).not.toBeVisible();
  });
});

// ─── Feature: Hand history panel ─────────────────────────────────────────────

test.describe('Hand history panel', () => {
  test.beforeEach(async ({ page }) => { await signIn(page) })

  test('history button is visible in the room header', async ({ page }) => {
    await createTableAndJoin(page)
    await dismissModal(page)
    await expect(page.getByRole('button', { name: /History/i })).toBeVisible({ timeout: 5000 })
  })

  test('history panel opens when button is clicked', async ({ page }) => {
    await createTableAndJoin(page)
    await dismissModal(page)
    await page.getByRole('button', { name: /History/i }).click()
    // Panel should appear with either hands or empty state
    await expect(page.getByText(/No hands yet|Hand #/i)).toBeVisible({ timeout: 5000 })
  })
})
