import transenv from 'transenv'

export default transenv()(({str, bool, num}) => {
  const isDevelopment = str('NODE_ENV') === 'development'

  return {
    logLevel: str('log_level', isDevelopment ? 'debug' : 'error'),
    port: str('PORT'),
    payrollsChannel: str('payrolls_channel'),
    slack: {
      botToken: str('slack_bot_token'),
    },
  }
})
