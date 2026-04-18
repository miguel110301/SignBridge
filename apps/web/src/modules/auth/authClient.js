const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '')

async function request(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'No se pudo completar la solicitud.')
  }

  return payload
}

export function registerUser(input) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function loginUser(input) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchProfile(token) {
  return request('/api/auth/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
