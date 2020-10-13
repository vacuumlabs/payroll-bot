import c from './config'
import cMain from '../config'
import SlackClient from '../common/SlackClient'
import GSheets from '../common/GSheets'

import {ACTION_ID} from './constants'
import messageHandler from './handlers/message'
import buttonHandler from './handlers/button'
import remindHandler from './handlers/remind'

export async function init(app, urlPrefix) {
  const services = {}

  const slack = new SlackClient()
  const sheets = new GSheets()

  services.slack = slack
  services.sheets = sheets

  await Promise.all([
    slack.init(services, c.slackBotToken),
    sheets.init(services, cMain.gsheetsServiceEmail, cMain.gsheetsServiceKey, c.spreadsheetId),
  ])

  app.use(`${urlPrefix}/events`, slack.getEventsMiddleware(
    c.slackSigningSecret,
    [{name: 'message', handler: messageHandler}],
  ))

  app.use(`${urlPrefix}/actions`, slack.getActionsMiddleware(
    c.slackSigningSecret,
    [{constraints: {actionId: ACTION_ID.SEND_REPORTS}, handler: buttonHandler}]
  ))

  app.get(`${urlPrefix}/remind`, remindHandler(services))
}
