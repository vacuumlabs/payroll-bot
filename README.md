# VacuumBots

Multiple slack bots

## Deployment

We use [Heroku](https://www.heroku.com/home) for hosting this application. When something is merged into `master` branch, it is automatically deployed. You can also deploy any branch manually from Heroku Dashboard.

Important parts regards to Heroku to note:
  - in `package.json`:
    - `engines.node` - which Node version to use
    - `scripts.build` - what to run in build phase
    - `scripts.start` - what to run in start phase

## Bots

Each bot is in its own folder.

### CardHoldersBot

Slack bot for sending reminders to company card holders.

### PayrollBot

Slack bot for company share holders.
