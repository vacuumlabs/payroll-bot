import transenv from 'transenv'

export default transenv()(({str, bool, num}) => {
  return {
    slackBotToken: str('CARDHOLDERSBOT_SLACK_BOT_TOKEN'),
    slackSigningSecret: str('CARDHOLDERSBOT_SLACK_SIGNING_SECRET'),
    remindChannel: str('CARDHOLDERSBOT_REMIND_CHANNEL'),
    spreadsheetId: str('CARDHOLDERSBOT_SPREADSHEET_ID'),
  }
})
