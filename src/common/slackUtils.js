export async function callApi(apiCall, dataField) {
  const resp = await apiCall()

  if (!resp.ok) {
    throw new Error(`Failed to load data: ${resp.error}`)
  }

  return dataField ? resp[dataField] : resp
}

export async function getAll(apiCall, dataField, cursor) {
  const resp = await callApi(() => apiCall(cursor))

  const data = resp[dataField]
  const {response_metadata: {next_cursor: nextCursor} = {}} = resp

  return nextCursor ? [...data, await getAll(apiCall, dataField, nextCursor)] : data
}

export function getTextBlock(text) {
  return {type: 'section', text: {type: 'mrkdwn', text}}
}
