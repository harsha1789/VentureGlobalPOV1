/**
 * Step 1 — Login to HxGN SDx Mimic App
 */
module.exports = async function step01Login(page, env, logger) {
  const step = 1;
  logger.info(step, 'Navigating to mimic app...');
  await page.goto(env.APP_URL, { waitUntil: 'networkidle' });

  logger.info(step, 'Entering credentials...');
  await page.fill('[data-testid="login-username"]', env.BOT_USERNAME);
  await page.fill('[data-testid="login-password"]', env.BOT_PASSWORD);

  logger.info(step, 'Clicking Sign In...');
  // Click login and wait for the API response before checking the screen
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/login') && resp.status() === 200),
    page.click('[data-testid="login-button"]')
  ]);

  // Wait for To Do screen to appear (login JS shows app-shell then navigates to todo)
  await page.waitForSelector('[data-testid="todo-screen"]', { state: 'visible', timeout: 15000 });

  const visible = await page.isVisible('[data-testid="todo-screen"]');
  if (!visible) throw new Error('To Do List screen did not appear after login');

  logger.pass(step, 'Login successful — To Do List visible');
  return { status: 'PASS', notes: `Logged in as ${env.BOT_USERNAME}` };
};
