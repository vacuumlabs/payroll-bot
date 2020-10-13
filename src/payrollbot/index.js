import SlackClient from '../common/SlackClient'
import {listenAction, listenEvent} from './slack'
import c from './config'

export async function init(app, urlPrefix) {
  const context = {}

  const slack = new SlackClient()

  context.slack = slack

  await slack.init(context, c.slackBotToken)

  app.use(`${urlPrefix}/events`, slack.getEventsMiddleware(
    c.slackSigningSecret,
    [{name: 'message', handler: listenEvent}]
  ))

  app.use(`${urlPrefix}/actions`, slack.getActionsMiddleware(
    c.slackSigningSecret,
    [{constraints: {type: 'button'}, handler: listenAction}]
  ))
}
