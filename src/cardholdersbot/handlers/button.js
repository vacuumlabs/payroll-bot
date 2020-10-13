import sendReports from '../actions/sendReports'

export default function buttonHandler(services, payload, respond) {
  return sendReports(services, (message) => respond({text: message, replace_original: true}))
}
