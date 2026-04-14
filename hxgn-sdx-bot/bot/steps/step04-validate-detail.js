/**
 * Step 4 — Validate Submittal Detail Screen fields
 */
const { validateField } = require('../utils/validator');

module.exports = async function step04ValidateDetail(page, env, logger, ctx) {
  const step = 4;
  logger.info(step, 'Validating submittal detail fields...');

  const docNum = (await page.textContent('[data-testid="detail-docnum"]')).trim();
  const revision = (await page.textContent('[data-testid="detail-revision"]')).trim();
  const fileType = (await page.textContent('[data-testid="detail-filetype"]')).trim();
  const originator = (await page.textContent('[data-testid="detail-originator"]')).trim();
  const date = (await page.textContent('[data-testid="detail-date"]')).trim();

  logger.info(step, 'Field values:', { docNum, revision, fileType, originator, date });

  // Validate key fields
  const results = [
    validateField(docNum, 'Document Number'),
    validateField(fileType, 'File Type'),
    validateField(revision, 'Revision')
  ];

  // Check file type is PDF
  if (fileType.toUpperCase() !== 'PDF') {
    results.push({ field: 'File Type', pass: false, failures: [{ reason: 'Expected PDF' }] });
  }

  const failures = results.filter(r => !r.pass);
  if (failures.length > 0) {
    const details = failures.map(f => `${f.field}: ${f.failures.map(x => x.reason).join(', ')}`).join('; ');
    logger.fail(step, `Validation failed: ${details}`);
    throw new Error(`Submittal detail validation failed: ${details}`);
  }

  logger.pass(step, 'All submittal detail fields valid');
  return { status: 'PASS', notes: `DocNum=${docNum}, Rev=${revision}, Type=${fileType}` };
};
