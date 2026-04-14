/**
 * Step 3 — Claim the identified submittal
 */
module.exports = async function step03Claim(page, env, logger, ctx) {
  const step = 3;
  logger.info(step, `Claiming submittal: ${ctx.documentNumber}...`);

  const claimBtn = await ctx.targetRow.$('[data-testid="claim-btn"]');
  if (!claimBtn) throw new Error('Claim button not found on target row');

  await claimBtn.click();

  // Wait for detail screen to appear
  await page.waitForSelector('[data-testid="detail-screen"]', { state: 'visible', timeout: 10000 });

  const visible = await page.isVisible('[data-testid="detail-screen"]');
  if (!visible) throw new Error('Submittal detail screen did not open after claim');

  logger.pass(step, 'Submittal claimed — detail screen opened');
  return { status: 'PASS', notes: `Claimed ${ctx.documentNumber}` };
};
