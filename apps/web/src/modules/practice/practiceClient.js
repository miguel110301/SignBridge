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

async function request(pathname, options = {}) {
	const { token, headers, ...rest } = options

	const response = await fetch(`${API_BASE}${pathname}`, {
		headers: {
			'Content-Type': 'application/json',
			...(token
				? {
						Authorization: `Bearer ${token}`,
					}
				: {}),
			...(headers || {}),
		},
		...rest,
	})

	const payload = await response.json().catch(() => ({}))
	if (!response.ok) {
		throw new Error(payload.error || 'No se pudo completar la solicitud.')
	}

	return payload
}

export function fetchPracticeModules(token) {
	return request('/api/learning/modules', { token })
}

export function completePracticeMission(missionId, token) {
	if (!missionId) {
		return Promise.reject(new Error('missionId es requerido.'))
	}

	return request(`/api/learning/missions/${missionId}/complete`, {
		method: 'POST',
		token,
	})
}
