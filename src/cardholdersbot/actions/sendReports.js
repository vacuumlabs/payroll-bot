import async from 'async'
import logger from 'winston'

import {SEND_REPORTS_TRIGGER_TEXT, REPORTS_SHEET_RANGE} from '../constants'

function result(label, users) {
  return `${label}: ${users.length}\n${users.join(', ')}`
}

export default async function sendReports(services, respond) {
  try {
    await respond('Sending reports...')

    const [data, users] = await Promise.all([
      services.sheets.getValues(REPORTS_SHEET_RANGE),
      services.slack.getAllUsers(),
    ])

    const usersLinksMap = users.reduce((acc, user) => {
      acc[user.real_name] = `<@${user.id}>`
      return acc
    }, {})

    const sent = [], skipped = [], failed = []

    await async.eachLimit(data, 5, async (item) => {
      const [userId, slackId, message] = item

      try {
        if (!slackId) return

        if (!message) {
          skipped.push(userId)
          return
        }

        const messageWithUsers = message.replace(
          /@(\S+)/g,
          (match, user) => usersLinksMap[user] || match,
        )

        await services.slack.writeDM(slackId, messageWithUsers)

        sent.push(userId)
      } catch (err) {
        failed.push(userId)

        services.slack.contactAdmin(`Failed to send report to user\n\n${JSON.stringify(item)}\n\n${err.stack}`)
      }
    })

    await respond(`Sending complete.\n${result('Sent', sent)}\n\n${result('Skipped', skipped)}\n\n${result('Failed', failed)}`)
  } catch (err) {
    logger.error('Failed to send reports', err)

    services.slack.contactAdmin(`Failed to send reports\n\n${err.stack}`)

    respond(`Failed to send reports. Try again by sending message \`${SEND_REPORTS_TRIGGER_TEXT}\``)
      .catch((catchErr) => services.slack.contactAdmin(`Failed to inform user about failed sending of reports\n\n${catchErr.stack}`))
  }
}
