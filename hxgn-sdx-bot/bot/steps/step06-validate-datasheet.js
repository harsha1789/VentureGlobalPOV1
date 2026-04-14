/**
 * Step 6 — Validate Load Datasheet fields
 */
module.exports = async function step06ValidateDatasheet(page, env, logger) {
  const step = 6;
  logger.info(step, 'Validating datasheet fields...');

  const fields = ['documentNumber', 'title', 'revision', 'fileType', 'discipline'];
  const fieldLabels = {
    documentNumber: 'Document Number',
    title: 'Title',
    revision: 'Revision',
    fileType: 'File Type',
    discipline: 'Discipline'
  };

  const failures = [];
  const details = [];

  for (const f of fields) {
    const statusEl = await page.$(`[data-testid="ds-validation-status-${f}"]`);
    const statusText = statusEl ? (await statusEl.textContent()).trim() : 'UNKNOWN';
    const valueEl = await page.$(`[data-testid="ds-field-${f}"]`);
    const value = valueEl ? (await valueEl.textContent()).trim() : '';

    const pass = statusText === 'PASS';
    details.push(`${fieldLabels[f]}: ${pass ? 'PASS' : 'FAIL'} (${value})`);
    logger.info(step, `  ${fieldLabels[f]}: ${statusText} — "${value}"`);

    if (!pass) {
      failures.push(fieldLabels[f]);
    }
  }

  if (failures.length > 0) {
    logger.fail(step, `Datasheet validation FAILED for: ${failures.join(', ')}`);
    throw new Error(`Datasheet validation failed: ${failures.join(', ')}`);
  }

  logger.pass(step, 'All datasheet fields passed validation');
  return { status: 'PASS', notes: details.join('; ') };
};
