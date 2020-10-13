import c from '../config'
import {ACTION_ID} from '../constants'

export default function remind(services) {
  return async (req, res) => {
    try {
      await services.slack.sendMessage(c.remindChannel, [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '@channel it is time to send <https://docs.google.com/spreadsheets/d/${c./edit?usp=sharing|the reports>!',
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Send reports',
            },
            value: 'send',
            style: 'primary',
            action_id: ACTION_ID.SEND_REPORTS,
          },
        },
      ])

      res.send('OK')
    } catch (err) {
      res.status(500).send('ERROR')
    }
  }
}
