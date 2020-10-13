import {google} from 'googleapis'
import {tryCall} from './gsheetsUtils'

const scopes = ['https://www.googleapis.com/auth/spreadsheets']

export default class GSheets {
  init(services, serviceEmail, serviceKey, spreadsheetId) {
    const key = Buffer.from(serviceKey, 'base64').toString()
    const auth = new google.auth.JWT(serviceEmail, null, key, scopes)

    this.api = google.sheets({version: 'v4', auth})
    this.services = services
    this.spreadsheetId = spreadsheetId
  }

  async getValues(range) {
    return (
      (
        await tryCall(() => this.api.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          valueRenderOption: 'UNFORMATTED_VALUE',
          range,
        }))
      ).data.values || []
    )
  }
}
