const STORAGE_KEY = 'signbridge_knn_dataset'
const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '')

let memoryCache = null

function normalizeLabel(label) {
  const value = String(label || '').trim()
  if (!value) return ''
  return value.length === 1 ? value.toUpperCase() : value.toLowerCase()
}

function getApiUrl(pathname) {
  return `${API_BASE}${pathname}`
}

function isDatasetEmpty(data) {
  return !Object.values(data || {}).some((samples) => Array.isArray(samples) && samples.length > 0)
}

function buildSampleSignature(sample) {
  if (!sample) return ''
  return JSON.stringify({
    type: sample.type,
    variantKey: sample.variantKey ?? null,
    variantLabel: sample.variantLabel ?? null,
    vector: sample.vector ?? null,
    frames: sample.frames ?? null,
  })
}

function buildRequestPayload(sample) {
  return {
    type: sample.type,
    vector: sample.vector,
    frames: sample.frames,
    variantKey: sample.variantKey ?? null,
    variantLabel: sample.variantLabel ?? null,
    metadata: sample.metadata ?? {},
  }
}

async function postSampleToServer(label, payload) {
  const response = await fetch(getApiUrl(`/api/training/${encodeURIComponent(label)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `No se pudo subir muestra para ${label}`)
  }

  return response.json()
}

async function fetchServerDataset() {
  const response = await fetch(getApiUrl('/api/training'))
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'No se pudo cargar el dataset desde MongoDB')
  }

  return response.json()
}

async function migrateMissingLocalSamples(localData, serverData) {
  const uploads = []

  for (const [label, localSamples] of Object.entries(localData || {})) {
    const normalizedLabel = normalizeLabel(label)
    const serverSamples = serverData?.[normalizedLabel] ?? []
    const knownSignatures = new Set(serverSamples.map(buildSampleSignature))

    for (const sample of localSamples ?? []) {
      const signature = buildSampleSignature(sample)
      if (!signature || knownSignatures.has(signature)) continue

      uploads.push(
        postSampleToServer(normalizedLabel, buildRequestPayload(sample)).then((result) => {
          knownSignatures.add(signature)
          return result
        })
      )
    }
  }

  if (uploads.length === 0) return serverData

  await Promise.all(uploads)
  return fetchServerDataset()
}

function writeTemplates(data) {
  memoryCache = data

  // Las secuencias dinámicas (frames DTW) pueden ser muy grandes para localStorage.
  // Solo guardamos localmente las muestras estáticas; las secuencias viven únicamente en MongoDB.
  const localSafe = {}
  for (const [label, samples] of Object.entries(data || {})) {
    const staticOnly = (samples || []).filter((s) => s.type !== 'sequence')
    if (staticOnly.length > 0) {
      localSafe[label] = staticOnly
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localSafe))
  } catch (e) {
    // Si aún así se desborda (muchos moldes estáticos), limpiamos la cache local
    // para no bloquear al usuario. Los datos están seguros en MongoDB.
    console.warn('[KNNStorage] localStorage lleno, limpiando cache local:', e)
    try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
  }

  return data
}

function readTemplates() {
  if (memoryCache) return memoryCache

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    memoryCache = raw ? JSON.parse(raw) : {}
  } catch (e) {
    memoryCache = {}
  }

  return memoryCache
}

export async function hydrateTemplatesFromServer() {
  const localData = readTemplates()
  const serverData = await fetchServerDataset()
  const mergedData =
    isDatasetEmpty(localData)
      ? serverData
      : await migrateMissingLocalSamples(localData, serverData)

  return writeTemplates(mergedData)
}

export async function saveTemplate(label, dataPayload, isSequence = false, metadata = {}) {
  const normalizedLabel = normalizeLabel(label)

  const payload = isSequence
    ? {
        type: 'sequence',
        frames: dataPayload,
        metadata,
      }
    : {
        type: 'static',
        vector: dataPayload?.flatMap((point) => [point.x, point.y, point.z || 0]),
        variantKey: metadata.variantKey ?? null,
        variantLabel: metadata.variantLabel ?? null,
        metadata,
      }

  if (!isSequence && (!dataPayload || dataPayload.length !== 21)) {
    return false
  }

  const result = await postSampleToServer(normalizedLabel, payload)
  const data = { ...readTemplates() }
  if (!data[normalizedLabel]) data[normalizedLabel] = []
  data[normalizedLabel] = [...data[normalizedLabel], result.sample]
  writeTemplates(data)
  return result.sample
}

export function getTemplates() {
  return readTemplates()
}

export async function clearTemplates(label = null) {
  const data = { ...readTemplates() }

  if (label) {
    const normalizedLabel = normalizeLabel(label)
    const response = await fetch(getApiUrl(`/api/training/${encodeURIComponent(normalizedLabel)}`), {
      method: 'DELETE',
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(detail || 'No se pudo borrar la letra en MongoDB')
    }

    delete data[normalizedLabel]
    writeTemplates(data)
  } else {
    const response = await fetch(getApiUrl('/api/training'), {
      method: 'DELETE',
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(detail || 'No se pudo limpiar el dataset en MongoDB')
    }

    memoryCache = {}
    localStorage.removeItem(STORAGE_KEY)
  }
}

export async function deleteTemplateById(label, id) {
  const normalizedLabel = normalizeLabel(label)
  const response = await fetch(
    getApiUrl(`/api/training/${encodeURIComponent(normalizedLabel)}/${encodeURIComponent(id)}`),
    { method: 'DELETE' }
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'No se pudo borrar la muestra en MongoDB')
  }

  const data = { ...readTemplates() }
  if (data[normalizedLabel]) {
    data[normalizedLabel] = data[normalizedLabel].filter((template) => template.id !== id)
    if (data[normalizedLabel].length === 0) {
      delete data[normalizedLabel]
    }
    writeTemplates(data)
  }
}
