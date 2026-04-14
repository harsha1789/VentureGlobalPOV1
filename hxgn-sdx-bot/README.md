# HxGN SDx Document Control Automation Bot

Venture Global CP2 LNG - Automated document control workflow on an HxGN SDx mimic application.

## Project Structure

```
hxgn-sdx-bot/
  mimic-app/
    frontend/         HTML/CSS/JS mimic of HxGN SDx UI
    backend/          Node.js/Express REST API server
  bot/
    steps/            One file per automation step (10 steps)
    utils/            Logger, validator, HTML report generator
    reports/          Generated HTML reports (after bot runs)
    screenshots/      Step screenshots (after bot runs)
    bot.js            Main entry point
  .env                Configuration (credentials, URLs)
  .env.example        Template for .env
```

## Prerequisites

- Node.js 18+
- npm

## Setup

### 1. Install mimic app dependencies

```bash
cd mimic-app/backend
npm install
```

### 2. Install bot dependencies

```bash
cd bot
npm install
npx playwright install chromium
```

### 3. Configure environment

Copy `.env.example` to `.env` and update values if needed (defaults work out of the box).

## Running

### Start the mimic app

```bash
cd mimic-app/backend
npm start
```

The app runs at http://localhost:3000.

### Run the bot

In a separate terminal:

```bash
cd bot
node bot.js
```

The bot will:
1. Reset the mimic app data (re-runnable)
2. Login with bot credentials
3. Find and claim a submitted document
4. Validate fields, check document integrity
5. Create transmittal, approve submittal
6. Set status to "Bot Reviewed" and STOP
7. Generate an HTML report in `bot/reports/`

### Run with visible browser

```bash
HEADLESS=false node bot.js
```

## Bot Credentials

| Field    | Default Value  |
|----------|----------------|
| Username | `dc_bot`       |
| Password | `BotPass2026!` |

## Reports

After each run, an HTML report is saved to `bot/reports/` with:
- Step-by-step pass/fail results
- Screenshots per step
- Execution timing
- Final status summary

## Re-running

The bot calls `POST /api/reset` at startup to re-seed the database. This makes every run idempotent.

## Notes

- The mimic app is for demonstration only and does not connect to any live HxGN SDx system
- The bot stops at "Bot Reviewed" — a human DC must mark "Complete"
- All credentials are stored in `.env`, never hardcoded
