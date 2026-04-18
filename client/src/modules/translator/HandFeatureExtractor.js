import { LM, getPalmCenter, normalizeHand } from './HandNormalizer.js'

function cross(v1, v2) {
  return {
    x: (v1.y * v2.z) - (v1.z * v2.y),
    y: (v1.z * v2.x) - (v1.x * v2.z),
    z: (v1.x * v2.y) - (v1.y * v2.x),
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function vec(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z ?? 0) - (a.z ?? 0),
  }
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y)
}

function magnitude3D(vector) {
  return Math.hypot(vector.x, vector.y, vector.z ?? 0)
}

function normalize2D(vector) {
  const length = magnitude(vector) || 1
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: (vector.z ?? 0) / length,
  }
}

function normalize3D(vector) {
  const length = magnitude3D(vector) || 1
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: (vector.z ?? 0) / length,
  }
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function between(value, start, end, padding = 0) {
  return value >= Math.min(start, end) - padding && value <= Math.max(start, end) + padding
}

function classifyDirection(direction) {
  const absX = Math.abs(direction.x)
  const absY = Math.abs(direction.y)

  if (absX >= absY * 1.2) return 'horizontal'
  return direction.y >= 0 ? 'up' : 'down'
}

function classifyCameraDirection(direction) {
  const absX = Math.abs(direction.x)
  const absY = Math.abs(direction.y)

  if (absX >= absY * 1.2) return 'horizontal'
  return direction.y <= 0 ? 'up' : 'down'
}

function classifyPalmOrientation(normal) {
  const absX = Math.abs(normal.x)
  const absY = Math.abs(normal.y)
  const absZ = Math.abs(normal.z)

  if (absZ >= absX && absZ >= absY) {
    return normal.z > 0 ? 'back' : 'front'
  }

  if (absY >= absX) {
    return normal.y > 0 ? 'down' : 'up'
  }

  return normal.x > 0 ? 'side_right' : 'side_left'
}

function scoreFingerState({ mcp, pip, dip, tip }) {
  const direct = dist(mcp, tip)
  const path =
    dist(mcp, pip) +
    dist(pip, dip) +
    dist(dip, tip)
  const base = dist(mcp, pip) || 1
  const straightness = direct / (path || 1)
  const reach = direct / base

  if (straightness >= 0.8 && reach >= 2.0) return 1
  if (straightness >= 0.62 && reach >= 1.55) return 0.5
  return 0
}

function scoreThumbState({ mcp, ip, tip }) {
  const direct = dist(mcp, tip)
  const path = dist(mcp, ip) + dist(ip, tip)
  const base = dist(mcp, ip) || 1
  const straightness = direct / (path || 1)
  const reach = direct / base
  const lateral = Math.abs(tip.x - mcp.x)
  const vertical = Math.abs(tip.y - mcp.y)

  if (straightness >= 0.78 && reach >= 1.12 && (lateral >= 0.16 || vertical >= 0.16)) return 1
  if (straightness >= 0.6 && reach >= 0.95) return 0.5
  return 0
}

function buildFingerBundle(points, indices) {
  return {
    mcp: points[indices[0]],
    pip: points[indices[1]],
    dip: points[indices[2]],
    tip: points[indices[3]],
  }
}

export function extractHandFeatures(landmarks, worldLandmarks) {
  const sourceMarks = worldLandmarks?.length === 21 ? worldLandmarks : landmarks
  const canonical = normalizeHand(sourceMarks)
  if (!canonical) return null
  
  let palmOrientation = 'front'
  let palmNormal = { x: 0, y: 0, z: -1 }
  
  if (worldLandmarks?.length === 21) {
    const wWrist = worldLandmarks[LM.WRIST]
    const wIndex = worldLandmarks[LM.INDEX_MCP]
    const wPinky = worldLandmarks[LM.PINKY_MCP]
    const rawNormal = cross(vec(wWrist, wIndex), vec(wWrist, wPinky))
    palmNormal = normalize3D(rawNormal)
    palmOrientation = classifyPalmOrientation(palmNormal)
  }

  const thumb = {
    mcp: canonical[LM.THUMB_MCP],
    ip: canonical[LM.THUMB_IP],
    tip: canonical[LM.THUMB_TIP],
  }
  const index = buildFingerBundle(canonical, [LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP])
  const middle = buildFingerBundle(canonical, [LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP])
  const ring = buildFingerBundle(canonical, [LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP])
  const pinky = buildFingerBundle(canonical, [LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP])

  const fingerStates = {
    T: scoreThumbState(thumb),
    I: scoreFingerState(index),
    M: scoreFingerState(middle),
    R: scoreFingerState(ring),
    P: scoreFingerState(pinky),
  }

  const directions = {
    T: classifyDirection(vec(thumb.mcp, thumb.tip)),
    I: classifyDirection(vec(index.mcp, index.tip)),
    M: classifyDirection(vec(middle.mcp, middle.tip)),
    R: classifyDirection(vec(ring.mcp, ring.tip)),
    P: classifyDirection(vec(pinky.mcp, pinky.tip)),
  }

  const rawThumb = {
    mcp: landmarks[LM.THUMB_MCP],
    tip: landmarks[LM.THUMB_TIP],
  }
  const rawIndex = {
    mcp: landmarks[LM.INDEX_MCP],
    tip: landmarks[LM.INDEX_TIP],
  }
  const rawMiddle = {
    mcp: landmarks[LM.MIDDLE_MCP],
    tip: landmarks[LM.MIDDLE_TIP],
  }
  const rawRing = {
    mcp: landmarks[LM.RING_MCP],
    tip: landmarks[LM.RING_TIP],
  }
  const rawPinky = {
    mcp: landmarks[LM.PINKY_MCP],
    tip: landmarks[LM.PINKY_TIP],
  }

  const cameraDirections = {
    T: classifyCameraDirection(vec(rawThumb.mcp, rawThumb.tip)),
    I: classifyCameraDirection(vec(rawIndex.mcp, rawIndex.tip)),
    M: classifyCameraDirection(vec(rawMiddle.mcp, rawMiddle.tip)),
    R: classifyCameraDirection(vec(rawRing.mcp, rawRing.tip)),
    P: classifyCameraDirection(vec(rawPinky.mcp, rawPinky.tip)),
  }

  const screenAxes = {
    x: normalize2D(vec(landmarks[LM.PINKY_MCP], landmarks[LM.INDEX_MCP])),
    y: normalize2D(vec(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP])),
  }

  const gapIM = Math.abs(index.tip.x - middle.tip.x)
  const gapMR = Math.abs(middle.tip.x - ring.tip.x)
  const pinchTI = dist(thumb.tip, index.tip)
  const pinchTM = dist(thumb.tip, middle.tip)

  const baseOrderIM = index.mcp.x > middle.mcp.x
  const tipOrderIM = index.tip.x > middle.tip.x
  const crossedIM = baseOrderIM !== tipOrderIM && gapIM < 0.18

  const curl = {
    T: thumb.mcp.y - thumb.tip.y,
    I: index.mcp.y - index.tip.y,
    M: middle.mcp.y - middle.tip.y,
    R: ring.mcp.y - ring.tip.y,
    P: pinky.mcp.y - pinky.tip.y,
  }

  const fingerPipY = average([index.pip.y, middle.pip.y, ring.pip.y, pinky.pip.y])
  const fingerMcpY = average([index.mcp.y, middle.mcp.y, ring.mcp.y, pinky.mcp.y])
  const thumbCentered = between(thumb.tip.x, ring.mcp.x, index.mcp.x, 0.06)
  const thumbBetween = between(thumb.tip.x, middle.mcp.x, index.mcp.x, 0.05) && thumb.tip.y > middle.mcp.y - 0.02

  let thumbRole = 'side'
  if (pinchTI < 0.15 || pinchTM < 0.15) {
    thumbRole = 'pinch'
  } else if (thumbBetween) {
    thumbRole = 'between'
  } else if (thumbCentered && thumb.tip.y > fingerPipY + 0.04) {
    thumbRole = 'over'
  } else if (thumbCentered && thumb.tip.y < fingerMcpY - 0.02) {
    thumbRole = 'under'
  }

  const thumbCoverCount = [index.tip, middle.tip, ring.tip].filter((point) => point.y > thumb.tip.y + 0.03).length
  const nonThumbExtendedCount = ['I', 'M', 'R', 'P'].filter((key) => fingerStates[key] >= 0.75).length
  const nonThumbClosedCount = ['I', 'M', 'R', 'P'].filter((key) => fingerStates[key] <= 0.25).length

  return {
    points: canonical,
    palmCenter: getPalmCenter(landmarks),
    fingers: fingerStates,
    directions,
    camera_directions: cameraDirections,
    gap_IM: gapIM,
    gap_MR: gapMR,
    crossed_IM: crossedIM,
    pinch_TI: pinchTI,
    pinch_TM: pinchTM,
    thumb_role: thumbRole,
    curl,
    meta: {
      thumb_cover_count: thumbCoverCount,
      nonThumbExtendedCount,
      nonThumbClosedCount,
      thumb_tip_above_index_mcp: thumb.tip.y > index.mcp.y,
      thumb_tip_above_middle_mcp: thumb.tip.y > middle.mcp.y,
      thumb_centered: thumbCentered,
    },
    palm_normal: palmNormal,
    palm_orientation: palmOrientation,
    axes: {
      screen: screenAxes,
    },
  }
}
