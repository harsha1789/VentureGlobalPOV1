/**
 * Step 10 — Set status to "Bot Reviewed" (STOP POINT — do NOT click Complete)
 */
module.exports = async function step10BotReviewed(page, env, logger) {
  const step = 10;
  logger.info(step, 'Waiting for final status screen...');

  // The approve step auto-navigates to the final screen after 1s
  await page.waitForSelector('[data-testid="final-screen"]', { state: 'visible', timeout: 15000 });

  // Verify Complete button is disabled
  const completeDisabled = await page.isDisabled('[data-testid="complete-btn"]');
  logger.info(step, `Complete button disabled: ${completeDisabled}`);

  logger.info(step, 'Clicking "Bot Reviewed"...');
  await page.click('[data-testid="bot-reviewed-btn"]');

  // Wait for success message
  await page.waitForSelector('[data-testid="final-success"]', { state: 'visible', timeout: 10000 });

  logger.pass(step, 'Status set to Bot Reviewed. Stopped before Complete.');
  logger.info(step, 'Bot execution complete. Manual review required before completion.');

  return { status: 'PASS', notes: 'Stopped before Complete' };
};
