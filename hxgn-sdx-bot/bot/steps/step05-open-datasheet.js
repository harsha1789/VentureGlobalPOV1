/**
 * Step 5 — Open Load Datasheet
 */
module.exports = async function step05OpenDatasheet(page, env, logger) {
  const step = 5;
  logger.info(step, 'Clicking "View Load Datasheet"...');

  await page.click('[data-testid="view-datasheet-btn"]');
  await page.waitForSelector('[data-testid="datasheet-screen"]', { state: 'visible', timeout: 10000 });

  const visible = await page.isVisible('[data-testid="datasheet-screen"]');
  if (!visible) throw new Error('Datasheet screen did not open');

  logger.pass(step, 'Load Datasheet screen opened');
  return { status: 'PASS', notes: '' };
};
