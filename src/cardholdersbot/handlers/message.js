import c from '../config'
import {SEND_REPORTS_TRIGGER_TEXT} from '../constants'
import sendReports from '../actions/sendReports'

export default function messageHandler(services, event) {
  const {channel, text} = event

  if (channel !== c.remindChannel || !text || text.trim() !== SEND_REPORTS_TRIGGER_TEXT) return

  let ts = null

  sendReports(services, async (msg) => {
    const {ts: newTs} = await services.slack.sendMessage(c.remindChannel, [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: msg,
        },
      },
    ], ts)

    ts = newTs
  })
}
