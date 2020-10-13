export async function callApi(apiCall, dataField) {
  const resp = await apiCall()

  if (!resp.ok) {
    throw new Error(`Failed to load data: ${resp.error}`)
  }

  return dataField ? resp[dataField] : resp
}

export function getTextBlock(text) {
  return {type: 'section', text: {type: 'mrkdwn', text}}
}
