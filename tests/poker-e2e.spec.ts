import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'apitest@pokergame.dev';
const TEST_PASSWORD = 'testpass123456';
const P2_EMAIL = 'player2@pokergame.dev';
const P2_PASSWORD = 'testpass123456';

async function signIn(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).last().click();
  await page.waitForURL(`${BASE_URL}/lobby`, { timeout: 20000 });
}

test('Full poker game flow: create table, two players join, start game, play hand', async ({ browser }) => {
  // Create two browser contexts (two players)
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const p1 = await ctx1.newPage();
  const p2 = await ctx2.newPage();

  // Sign in player 2 first (try to create if needed)
  try {
    await p2.goto(`${BASE_URL}/login`);
    await p2.getByRole('button', { name: 'Create Account' }).first().click();
    await p2.getByPlaceholder('Poker Pro').fill('Player2');
    await p2.getByPlaceholder('you@example.com').fill(P2_EMAIL);
    await p2.getByPlaceholder('••••••••').fill(P2_PASSWORD);
    await p2.getByRole('button', { name: 'Create Account' }).last().click();
    await p2.waitForURL(`${BASE_URL}/lobby`, { timeout: 15000 });
  } catch {
    // User likely exists — sign in instead
    await signIn(p2, P2_EMAIL, P2_PASSWORD);
  }

  // Sign in player 1 (host)
  await signIn(p1);

  // Player 1 creates a table
  await p1.getByRole('button', { name: /Create Table/i }).first().click();
  await p1.getByRole('button', { name: 'Create Table' }).last().click();
  await p1.waitForURL(/\/room\/[A-Z0-9]{6}/, { timeout: 15000 });

  const roomUrl = p1.url();
  const roomCode = roomUrl.match(/\/room\/([A-Z0-9]{6})/)?.[1]!;
  console.log('Room code:', roomCode);

  // Player 1 buys in (seat 1)
  const buyInModal = p1.getByRole('heading', { name: 'Buy In' });
  await buyInModal.waitFor({ state: 'visible', timeout: 10000 });
  // Select seat 1 (already selected by default)
  await p1.getByRole('button', { name: 'Buy In', exact: false }).last().click();
  await buyInModal.waitFor({ state: 'hidden', timeout: 10000 });
  console.log('P1 bought in');

  // Player 2 joins the same room
  await p2.goto(`${BASE_URL}/room/${roomCode}`);
  const buyInModal2 = p2.getByRole('heading', { name: 'Buy In' });
  await buyInModal2.waitFor({ state: 'visible', timeout: 15000 });
  // Select seat 2 (scoped to the seat grid inside the buy-in form)
  await p2.locator('form').getByRole('button', { name: '2', exact: true }).click();
  await p2.getByRole('button', { name: 'Buy In', exact: false }).last().click();
  await buyInModal2.waitFor({ state: 'hidden', timeout: 10000 });
  console.log('P2 bought in');

  // Player 1 (host) starts the game
  const startBtn = p1.getByRole('button', { name: /Start Game/i });
  await startBtn.waitFor({ state: 'visible', timeout: 10000 });
  await startBtn.click();
  console.log('Game started');

  // Wait for cards to appear (preflop state) — realtime subscription may take a moment
  // Poll for action buttons to appear on either page (max 15s)
  let hasActionP1 = 0, hasActionP2 = 0;
  for (let i = 0; i < 15; i++) {
    await p1.waitForTimeout(1000);
    hasActionP1 = await p1.locator('button:has-text("Fold"), button:has-text("Check"), button:has-text("Call"), button:has-text("Raise")').count();
    hasActionP2 = await p2.locator('button:has-text("Fold"), button:has-text("Check"), button:has-text("Call"), button:has-text("Raise")').count();
    if (hasActionP1 + hasActionP2 > 0) break;
  }
  console.log('P1 action buttons:', hasActionP1, 'P2 action buttons:', hasActionP2);

  // One player should have the action
  expect(hasActionP1 + hasActionP2).toBeGreaterThan(0);

  // Determine who acts first and take a simple action (call)
  let actingPage: Page;
  if (hasActionP1 > 0) {
    actingPage = p1;
    console.log('P1 acts first');
  } else {
    actingPage = p2;
    console.log('P2 acts first');
  }

  // Take action: call or check
  const callBtn = actingPage.getByRole('button', { name: 'Call', exact: true });
  const checkBtn = actingPage.getByRole('button', { name: 'Check', exact: true });
  if (await callBtn.isVisible()) {
    await callBtn.click();
    console.log('Called');
  } else if (await checkBtn.isVisible()) {
    await checkBtn.click();
    console.log('Checked');
  }

  await p1.waitForTimeout(2000);
  console.log('Action taken successfully');

  await ctx1.close();
  await ctx2.close();
});
