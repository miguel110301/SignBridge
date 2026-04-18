const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
}

function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + (point.z ?? 0), 0) / points.length,
  }
}

function vec(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z ?? 0) - (a.z ?? 0),
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y)
}

function normalizeVector(vector) {
  const length = magnitude(vector) || 1
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: (vector.z ?? 0) / length,
  }
}

function dot(a, b) {
  return (a.x * b.x) + (a.y * b.y)
}

export function getPalmCenter(landmarks) {
  return averagePoint([
    landmarks[LM.WRIST],
    landmarks[LM.INDEX_MCP],
    landmarks[LM.MIDDLE_MCP],
    landmarks[LM.RING_MCP],
    landmarks[LM.PINKY_MCP],
  ])
}

function orthogonalize(base, reference) {
  const projection = dot(reference, base)
  return {
    x: reference.x - (projection * base.x),
    y: reference.y - (projection * base.y),
  }
}

export function normalizeHand(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    return null
  }

  const palmCenter = getPalmCenter(landmarks)
  const scale = dist(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]) || 1

  const xAxis = normalizeVector(vec(landmarks[LM.PINKY_MCP], landmarks[LM.INDEX_MCP]))
  const rawYAxis = normalizeVector(vec(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]))
  let yAxis = orthogonalize(xAxis, rawYAxis)

  if (magnitude(yAxis) < 1e-6) {
    yAxis = { x: -xAxis.y, y: xAxis.x }
  }

  yAxis = normalizeVector(yAxis)

  let canonical = landmarks.map((point) => {
    const relative = {
      x: point.x - palmCenter.x,
      y: point.y - palmCenter.y,
      z: (point.z ?? 0) - (palmCenter.z ?? 0),
    }

    return {
      x: dot(relative, xAxis) / scale,
      y: dot(relative, yAxis) / scale,
      z: relative.z / scale,
    }
  })

  // La orientación canónica siempre deja el índice del lado positivo.
  if (canonical[LM.INDEX_MCP].x < canonical[LM.PINKY_MCP].x) {
    canonical = canonical.map((point) => ({
      ...point,
      x: -point.x,
    }))
  }

  return canonical
}

export { LM }
