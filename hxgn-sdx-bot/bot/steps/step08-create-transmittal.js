/**
 * Step 8 — Create Incoming Transmittal
 */
module.exports = async function step08CreateTransmittal(page, env, logger) {
  const step = 8;
  logger.info(step, 'Navigating back to detail screen...');

  await page.click('[data-testid="docviewer-back-btn"]');
  await page.waitForSelector('[data-testid="detail-screen"]', { state: 'visible', timeout: 10000 });

  logger.info(step, 'Clicking "Create Incoming Transmittal"...');
  await page.click('[data-testid="create-transmittal-btn"]');
  await page.waitForSelector('[data-testid="transmittal-screen"]', { state: 'visible', timeout: 10000 });

  // Verify auto-generated number placeholder
  const numText = (await page.textContent('[data-testid="trans-number"]')).trim();
  logger.info(step, `Transmittal number before generate: "${numText}"`);

  logger.info(step, 'Clicking "Generate Transmittal"...');
  await page.click('[data-testid="generate-transmittal-btn"]');

  // Wait for success message
  await page.waitForSelector('[data-testid="transmittal-success"]', { state: 'visible', timeout: 10000 });

  const transNumber = (await page.textContent('[data-testid="trans-number"]')).trim();
  logger.pass(step, `Transmittal created: ${transNumber}`);
  return { status: 'PASS', notes: `Transmittal: ${transNumber}` };
};
