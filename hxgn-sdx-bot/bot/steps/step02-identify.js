/**
 * Step 2 — Identify first document with status "Submitted" in To Do List
 */
module.exports = async function step02Identify(page, env, logger, ctx) {
  const step = 2;
  logger.info(step, 'Waiting for To Do list to load...');

  await page.waitForSelector('[data-testid="todo-tbody"] tr', { timeout: 10000 });

  // Find the first row with status = "Submitted"
  const rows = await page.$$('[data-testid="todo-tbody"] tr');
  let targetRow = null;
  let docNumber = null;
  let submittalId = null;

  for (const row of rows) {
    const statusEl = await row.$('[data-testid="todo-status"]');
    const status = statusEl ? (await statusEl.textContent()).trim() : '';
    if (status === 'Review Submittal') {
      targetRow = row;
      const docEl = await row.$('[data-testid="todo-docnum"]');
      docNumber = docEl ? (await docEl.textContent()).trim() : '';
      // Extract ID from the row's data-testid
      const rowTestId = await row.getAttribute('data-testid');
      submittalId = rowTestId ? rowTestId.replace('todo-row-', '') : null;
      break;
    }
  }

  if (!targetRow || !docNumber) {
    throw new Error('No document with status "Submitted" found in To Do list');
  }

  ctx.targetRow = targetRow;
  ctx.documentNumber = docNumber;
  ctx.submittalId = submittalId;

  logger.pass(step, `Found submitted document: ${docNumber}`, { submittalId });
  return { status: 'PASS', notes: `Doc No: ${docNumber}` };
};
