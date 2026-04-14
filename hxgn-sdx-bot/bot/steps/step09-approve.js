/**
 * Step 9 — Approve Submittal
 */
module.exports = async function step09Approve(page, env, logger, ctx) {
  const step = 9;
  logger.info(step, 'Navigating back to detail screen...');

  await page.click('[data-testid="transmittal-back-btn"]');
  await page.waitForSelector('[data-testid="detail-screen"]', { state: 'visible', timeout: 10000 });

  logger.info(step, 'Clicking "Approve Submittal"...');
  await page.click('[data-testid="approve-btn"]');
  await page.waitForSelector('[data-testid="approve-screen"]', { state: 'visible', timeout: 10000 });

  // Enter revision number
  const revision = 'A';
  logger.info(step, `Entering revision number: ${revision}`);
  await page.fill('[data-testid="approve-revision-input"]', revision);

  logger.info(step, 'Clicking Approve...');
  await page.click('[data-testid="approve-confirm-btn"]');

  // Wait for success message
  await page.waitForSelector('[data-testid="approve-success"]', { state: 'visible', timeout: 10000 });

  logger.pass(step, `Submittal approved with revision ${revision}`);
  return { status: 'PASS', notes: `Revision: ${revision}` };
};
