import transenv from 'transenv'

export default transenv()(({str, bool, num}) => {
  return {
    payrollsChannel: str('PAYROLLBOT_CHANNEL'),
    slackBotToken: str('PAYROLLBOT_SLACK_BOT_TOKEN'),
    slackSigningSecret: str('PAYROLLBOT_SLACK_SIGNING_SECRET'),
  }
})
