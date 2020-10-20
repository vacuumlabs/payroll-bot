import {WebClient} from '@slack/web-api'
import {createMessageAdapter} from '@slack/interactive-messages'
import {createEventAdapter} from '@slack/events-api'
import logger from 'winston'

import {callApi, getAll} from './slackUtils'
import c from '../config'

export default class SlackClient {
  async init(services, botToken, {
    supportChannel = c.supportChannel,
  } = {}) {
    this.services = services
    this.supportChannel = supportChannel

    this.web = new WebClient(botToken)

    const {user_id: userId, bot_id: botId} = await callApi(() => this.web.auth.test())

    this.userId = userId
    this.botId = botId

    const {real_name: realName} = await callApi(() => this.web.users.info({user: userId}), 'user')

    this.name = realName
  }

  getEventsMiddleware(signingSecret, eventsData) {
    const events = createEventAdapter(signingSecret)

    eventsData.forEach(({name, handler}) => {
      events.on(name, async (event) => {
        try {
          await handler(this.services, event)
        } catch (err) {
          logger.error('Failed to handle slack event', this.name, err)

          this.contactAdmin(`Failed to handle slack event\n\n${JSON.stringify(event)}\n\n${err.stack}`)

          this.web.chat.postEphemeral({
            channel: event.channel,
            text: `Failed to handle event: ${err.message}`,
            user: event.user,
          }).catch((err) => {
            this.contactAdmin(`Failed to inform about failed slack event handling\n\n${err.stack}`)
          })
        }
      })
    })

    return events.requestListener()
  }

  getActionsMiddleware(signingSecret, actions) {
    const interactions = createMessageAdapter(signingSecret)

    if (actions) {
      actions.forEach(({constraints, handler}) => {
        interactions.action(constraints, async (payload, respond) => {
          try {
            const autoRespondTimeout = setTimeout(() => {
              respond({text: 'Working... :hourglass:', replace_original: true})
            })

            await handler(this.services, payload, (response) => {
              clearTimeout(autoRespondTimeout)
              respond(response)
            })
          } catch (err) {
            logger.error('Failed to handle action', this.name, err)

            this.contactAdmin(`Failed to handle slack action\n\n${JSON.stringify(payload)}\n\n${err.stack}`)

            this.web.chat.postEphemeral({
              channel: payload.channel,
              text: `Failed to handle action: ${err.message}`,
              user: payload.user.id,
            }).catch((err) => {
              this.contactAdmin(`Failed to inform about failed slack action handling\n\n${err.stack}`)
            })
          }
        })
      })
    }

    return interactions.requestListener()
  }

  getInstallHandler(clientId, clientSecret, scopes, onSuccess) {
    return async (req, res) => {
      if (req.query.code) {
        try {
          const {authored_user: {id: userId, access_token: token}, error} = await callApi(
            () => this.web.oauth.v2.access({
              client_id: clientId,
              client_secret: clientSecret,
              code: req.query.code,
            }))

          if (error) {
            throw new Error(`Api error: ${error}`)
          }

          const result = await onSuccess(this.services, userId, token)

          if (result) {
            if (result.redirect) {
              res.redirect(result.redirect)
            } else {
              res.send(result)
            }
          } else {
            res.send(`${this.name} was authorized successfully, you can close this tab/window.`)
          }
        } catch (err) {
          logger.error('Authorization failed', err)

          this.contactAdmin(`Authorization failed\n\n${err.sta}`)

          res.send('Sorry, something went wrong. Try again or contact administrator')
        }
      } else {
        res.redirect(`https://slack.com/oauth/v2/authorize?client_id=${this.clientId}&scope=${scopes.join(' ')}`)
      }
    }
  }

  async sendMessage(channel, blocks, ts) {
    try {
      return await callApi(() =>
        ts
          ? this.web.chat.update({channel, ts, blocks})
          : this.web.chat.postMessage({channel, blocks}),
      'message',
      )
    } catch (err) {
      this.contactAdmin(`Failed to send message\n\n${JSON.stringify({channel, blocks, ts})}\n\n${err.stack}`)

      throw err
    }
  }

  async writeDM(to, message) {
    try {
      const {id: channelId} = await callApi(() => this.web.conversations.open({
        users: Array.isArray(to) ? to.join(',') : to,
      }), 'channel')

      return callApi(() => this.web.chat.postMessage({
        channel: channelId,
        ...(typeof message === 'string' ? {text: message} : message),
      }))
    } catch (err) {
      this.contactAdmin(`Failed to write DM\n\n${JSON.stringify({to, message})}\n\n${err.stack}`)

      throw err
    }
  }

  async getAllUsers() {
    const users = await getAll((cursor) => this.web.users.list({cursor}), 'members')

    return users.filter((user) => !user.deleted)
  }

  contactAdmin(text) {
    this.web.chat.postMessage({
      channel: this.supportChannel,
      text,
      mrkdwn: false,
      unfurl_links: false,
      unfurl_media: false,
    }).catch((err) => {
      logger.error('Failed to contact admin', err)
    })
  }
}
