const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '')

export async function requestPracticeFeedback(payload) {
  const response = await fetch(`${API_BASE}/api/practice/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'No se pudo consultar Gemini')
  }

  return response.json()
}
