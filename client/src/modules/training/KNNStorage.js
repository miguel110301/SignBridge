const STORAGE_KEY = 'signbridge_knn_dataset'

export function saveTemplate(label, dataPayload, isSequence = false) {
  const data = getTemplates()
  if (!data[label]) data[label] = []

  if (isSequence) {
    // dataPayload is an array of frames
    data[label].push({ id: Date.now(), type: 'sequence', frames: dataPayload })
  } else {
    // dataPayload is canonicalLandmarks
    if (!dataPayload || dataPayload.length !== 21) return false
    const vector = dataPayload.flatMap(p => [p.x, p.y, p.z || 0])
    data[label].push({ id: Date.now(), type: 'static', vector })
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return true
}

export function getTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

export function clearTemplates(label = null) {
  if (label) {
    const data = getTemplates()
    delete data[label]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function deleteTemplateById(label, id) {
  const data = getTemplates()
  if (data[label]) {
    data[label] = data[label].filter(t => t.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
