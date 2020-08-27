import logger from 'winston'
import parseCsv from 'csv-parse/lib/sync'
import _request from 'request-promise'
import querystring from 'querystring'
import c from './config'
import {init, apiCall, apiCallMultipart, showError} from './slackApi'

const request = _request.defaults({headers: {
  Authorization: `Bearer ${c.slack.botToken}`,
}})

let apiState
let pendingPayrolls = null

export async function listenSlack(token, stream) {
  apiState = init(token, stream)

  const isCSVUpload = (e) => (
    e.type === 'message' &&
    e.files &&
    e.files.length === 1 &&
    e.files[0].filetype === 'csv'
  )

  for (;;) {
    const event = await stream.take()
    logger.log('verbose', `slack event ${event.type}`, event)

    if (isCSVUpload(event) && event.channel === c.payrollsChannel) {
      logger.verbose('csv uploaded', event.files[0].url_private)
      handleCSVUpload(event)
      continue
    }

    if (event.type === 'action') {
      if (pendingPayrolls && pendingPayrolls.id === event.callback_id) {
        await handlePayrollsAction(event)
        pendingPayrolls = null
      } else {
        logger.log('warn', 'pending payrolls error', pendingPayrolls, event.callback_id)
        await showError(apiState, event.channel.id,
          'The operation has timed out. Please, re-upload your CSV file with payrolls.',
          event.original_message.ts
        )
      }
    }
  }
}

async function cancelPayrolls(ts) {
  await showError(apiState, c.payrollsChannel, 'Payrolls canceled', ts)
}

async function handlePayrollsAction(event) {
  const {channel, ts, message: {attachments: [attachment]}} =
    pendingPayrolls.confirmation

  async function updateMessage(attachmentUpdate) {
    await apiCall(apiState, 'chat.update', {channel, ts, as_user: true,
      attachments: [{...attachment, ...attachmentUpdate}],
    })
  }

  if (event.actions[0].name === 'send') {
    await updateMessage({
      pretext: ':woman: Sending payrolls:',
      color: 'good',
      actions: [],
    })
    await sendPayrolls(pendingPayrolls.payrolls, pendingPayrolls.comment)
      .catch((e) => showError(apiState, event.channel.id, 'Something went wrong.'))

    await apiCall(apiState, 'chat.update', {
      channel, ts, as_user: true,
      text: ':woman: Payrolls sent successfully.',
      attachments: [],
    })

  } else {
    await cancelPayrolls(ts)
  }
}

async function getChannelForUserID(userID) {
  const channel = await apiCall(apiState, 'conversations.open', {users: userID})
  if (channel.ok) {
    return (channel.channel.id)
  } else {
    return null
  }
}

async function sendPayrollToUser(payroll, comment) {
  const channelId = await getChannelForUserID(payroll.slackId)
  if (channelId) {
    await apiCall(apiState, 'chat.postMessage', {
      channel: channelId,
      text: `${payroll.message}${comment ? `\n\n${comment}` : ''}`,
    })

    return true
  } else {
    return false
  }
}

async function sendPayrolls(payrolls, comment) {
  let failMessage = 'I was unable to deliver the payroll to users:\n'
  let ts = null
  let count = 0
  for (const i of payrolls) {
    const success = await sendPayrollToUser(i, comment).catch((err) => {
      logger.warn('Failed to send payroll', err)
      return false
    })

    if (success) {
      count++
    } else {
      if (!ts) ts = (await showError(apiState, c.payrollsChannel, failMessage)).ts
      failMessage += `${i.user}\n`
      await showError(apiState, c.payrollsChannel, failMessage, ts)
    }
  }
  await apiCall(apiState, 'chat.postMessage', {
    channel: c.payrollsChannel,
    as_user: true,
    text: `Successfully delivered ${count} payrolls.`,
  })
}

async function handleCSVUpload(event) {
  if (pendingPayrolls) await cancelPayrolls(pendingPayrolls.confirmation.ts)

  const file = event.files[0]
  const csv = await request.get(file.url_private)

  const payrolls = parseCsv(csv, {
    columns: ['userId', 'slackId', 'message'],
    from: 2,
    relax_column_count: true,
    skip_empty_lines: true,
    skip_lines_with_empty_values: true,
  })

  const confirmation = await apiCall(apiState, 'chat.postMessage', {
    channel: c.payrollsChannel,
    as_user: true,
    text: 'You have uploaded a file, haven\'t you?',
    attachments: [
      {
        title: `Should I send the payrolls?`,
        callback_id: `${event.ts}`,
        actions: [
          {
            name: 'send',
            text: `Send ${payrolls.length} payrolls`,
            type: 'button',
            value: 'send',
            style: 'primary',
            confirm: {
              title: 'Do you really want to send these payrolls?',
              ok_text: 'Yes, send them all',
              dismiss_text: 'No',
            },
          },
          {
            name: 'cancel',
            text: 'Cancel',
            type: 'button',
            value: 'cancel',
            style: 'danger',
          },
        ],
      },
    ],
  })

  pendingPayrolls = {
    id: event.ts,
    payrolls,
    confirmation,
    comment: event.text,
  }
}
