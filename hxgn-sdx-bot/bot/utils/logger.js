/**
 * Structured logger for bot execution.
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.entries = [];
    this.startTime = new Date();
  }

  log(level, step, message, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      step,
      message,
      details: details || null
    };
    this.entries.push(entry);

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [Step ${step}]`;
    console.log(`${prefix} ${message}`);
    if (details) console.log(`  -> ${JSON.stringify(details)}`);
  }

  info(step, message, details) { this.log('info', step, message, details); }
  pass(step, message, details) { this.log('pass', step, message, details); }
  fail(step, message, details) { this.log('fail', step, message, details); }
  warn(step, message, details) { this.log('warn', step, message, details); }

  getEntries() { return this.entries; }

  save(filePath) {
    fs.writeFileSync(filePath, JSON.stringify(this.entries, null, 2));
  }
}

module.exports = { Logger };
