import transenv from 'transenv'

export default transenv()(({str, bool, num}) => {
  const isDevelopment = str('NODE_ENV') === 'development'

  return {
    logLevel: str('LOG_LEVEL', isDevelopment ? 'debug' : 'error'),
    port: str('PORT'),
    supportChannel: str('SUPPORT_CHANNEL'),
    gsheetsServiceEmail: str('GSHEETS_SERVICE_EMAIL'),
    gsheetsServiceKey: str('GSHEETS_SERVICE_KEY'),
  }
})
