export async function tryCall(call) {
  try {
    return await call()
  } catch (err) {
    if (err.errors) {
      throw new Error(`Google API error: ${err.errors.map((e) => e.message).join(', ')}`)
    }

    throw err
  }
}
