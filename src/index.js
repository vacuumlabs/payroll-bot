import express from 'express'
import logger from 'winston'
import c from './config'
import * as payrollbot from './payrollbot'
import * as cardholdersbot from './cardholdersbot'

logger.cli()
logger.level = c.logLevel
logger.setLevels(logger.config.npm.levels)

const app = express()

// eslint-disable-next-line require-await
;(async function() {
  const bots = [
    {scripts: payrollbot, urlPrefix: '/payrollbot'},
    {scripts: cardholdersbot, urlPrefix: '/cardholdersbot'},
  ]

  await Promise.all(
    bots.map(({scripts, urlPrefix}) => scripts.init(app, urlPrefix)),
  )

  app.listen(c.port, () =>
    logger.log('info', `App started on localhost:${c.port}.`)
  )
})().catch((e) => {
  logger.log('error', e)
  process.exit(1)
})
