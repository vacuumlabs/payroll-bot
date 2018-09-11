import express from 'express'
import bodyParser from 'body-parser'
import {expressHelpers, run, createChannel} from 'yacol'
import logger from 'winston'
import c from './config'
import {listenSlack} from './slack'

logger.cli()
logger.level = c.logLevel
logger.setLevels(logger.config.npm.levels)

const app = express()
app.use(bodyParser.urlencoded())

const {register, runApp} = expressHelpers

const slackEvents = createChannel()

// eslint-disable-next-line require-yield
function* actions(req, res) {
  slackEvents.put({...JSON.parse(req.body.payload), type: 'action'})
  res.status(200).send()
}

register(app, 'post', '/actions', actions)

// eslint-disable-next-line require-await
;(async function() {
  run(runApp)
  app.listen(c.port, () =>
    logger.log('info', `App started on localhost:${c.port}.`)
  )

  await listenSlack(c.slack.botToken, slackEvents)

})().catch((e) => {
  logger.log('error', e)
  process.exit(1)
})
