import async from 'async'
import parseCsv from 'csv-parse/lib/sync'
import _request from 'request-promise'
import c from './config'

const request = _request.defaults({headers: {
  Authorization: `Bearer ${c.slackBotToken}`,
}})

// eslint-disable-next-line no-empty-function
const noop = () => {}

let pendingPayrolls = null

export function listenEvent(services, event) {
  const isCSVUpload = Boolean(
    event.type === 'message' &&
    event.files &&
    event.files.length === 1 &&
    event.files[0].filetype === 'csv'
  )

  if (isCSVUpload && event.channel === c.payrollsChannel) {
    return handleCSVUpload(services, event)
  }

  return null
}

export async function listenAction(services, payload, respond) {
  if (pendingPayrolls && pendingPayrolls.confirmation.ts === payload.message.ts) {
    await handlePayrollsAction(services, payload, respond)
    pendingPayrolls = null
  } else {
    respond({
      text: 'The operation has timed out. Please, re-upload your CSV file with payrolls.',
      replace_original: true,
    })
  }
}

async function handlePayrollsAction(services, payload, respond) {
  const [action] = payload.actions

  if (action.value === 'send') {
    respond({text: ':woman: Sending payrolls:', replace_original: true})

    await sendPayrolls(services, pendingPayrolls.payrolls, pendingPayrolls.comment)
      .then((count) =>
        respond({text: `:woman: Successfully delivered ${count} payrolls.`, replace_original: true})
      )
      .catch((e) => {
        services.slack.contactAdmin(`Failed to send payrolls\n\n${e.stack}`)

        return respond({text: 'Something went wrong.', replace_original: true})
      })
  } else {
    respond({text: 'Payrolls cancelled', replace_original: true})
  }
}

async function sendPayrolls(services, payrolls, comment) {
  const failed = []
  let count = 0

  await async.eachLimit(payrolls, 5, async (payroll) => {
    try {
      await services.slack.writeDM(payroll.slackId, `${payroll.message}${comment ? `\n\n${comment}` : ''}`)

      count++
    } catch (err) {
      failed.push(payroll.user)
    }
  })

  if (failed.length > 0) {
    await services.slack.sendMessage(c.payrollsChannel, [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `I was unable to deliver the payroll to users:\n${failed.join('\n')}`,
        },
      },
    ])
  }

  return count
}

async function handleCSVUpload(services, event) {
  if (pendingPayrolls) {
    await services.slack.sendMessage(
      c.payrollsChannel,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Payrolls cancelled',
          },
        },
      ],
      pendingPayrolls.confirmation.ts,
    ).catch(noop)
  }

  const file = event.files[0]
  const csv = await request.get(file.url_private_download)
  let payrolls

  try {
    payrolls = parseCsv(csv, {
      columns: ['userId', 'slackId', 'message'],
      from: 2,
      relax_column_count: true,
      skip_empty_lines: true,
      skip_lines_with_empty_values: true,
    })
  } catch (err) {
    await services.slack.sendMessage(c.payrollsChannel, [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'File could not be parsed',
        },
      },
    ])

    return
  }

  const confirmation = await services.slack.sendMessage(c.payrollsChannel, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'You have uploaded a file, haven\'t you?',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Should I send the payrolls?',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `Send ${payrolls.length} payrolls`,
          },
          style: 'primary',
          value: 'send',
          confirm: {
            title: {
              type: 'plain_text',
              text: 'Confirm sending',
            },
            text: {
              type: 'mrkdwn',
              text: 'Do you really want to send these payrolls?',
            },
            confirm: {
              type: 'plain_text',
              text: 'Yes, send them all',
            },
            deny: {
              type: 'plain_text',
              text: 'No',
            },
          },
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Cancel',
          },
          style: 'danger',
          value: 'cancel',
        },
      ],
    },
  ])

  pendingPayrolls = {
    payrolls,
    confirmation,
    comment: event.text,
  }
}
