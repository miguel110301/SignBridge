import { LM, getPalmCenter, normalizeHand } from './HandNormalizer.js'

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

export function extractHandFeatures(landmarks) {
  const canonical = normalizeHand(landmarks)
  if (!canonical) return null

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
  }
}
