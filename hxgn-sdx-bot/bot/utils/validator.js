/**
 * Field validation utilities used by the bot.
 */

function validateNotEmpty(value, fieldName) {
  if (!value || !value.trim()) {
    return { pass: false, field: fieldName, reason: 'Field is empty' };
  }
  return { pass: true, field: fieldName };
}

function validateNoLeadingSpaces(value, fieldName) {
  if (value && value !== value.trimStart()) {
    return { pass: false, field: fieldName, reason: 'Has leading spaces' };
  }
  return { pass: true, field: fieldName };
}

function validateNoTrailingSpaces(value, fieldName) {
  if (value && value !== value.trimEnd()) {
    return { pass: false, field: fieldName, reason: 'Has trailing spaces' };
  }
  return { pass: true, field: fieldName };
}

function validateNoSpecialChars(value, fieldName) {
  // Allow alphanumeric, spaces, hyphens, underscores, periods, and em-dash
  const pattern = /^[a-zA-Z0-9\s\-_.—\/]+$/;
  if (value && !pattern.test(value)) {
    return { pass: false, field: fieldName, reason: 'Contains unexpected special characters' };
  }
  return { pass: true, field: fieldName };
}

function validateField(value, fieldName) {
  const results = [
    validateNotEmpty(value, fieldName),
    validateNoLeadingSpaces(value, fieldName),
    validateNoTrailingSpaces(value, fieldName),
    validateNoSpecialChars(value, fieldName)
  ];
  const failures = results.filter(r => !r.pass);
  return {
    field: fieldName,
    value,
    pass: failures.length === 0,
    checks: results,
    failures
  };
}

module.exports = {
  validateNotEmpty,
  validateNoLeadingSpaces,
  validateNoTrailingSpaces,
  validateNoSpecialChars,
  validateField
};
