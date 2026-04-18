import { LM, getPalmCenter, normalizeHand } from './HandNormalizer.js'

const SEQUENCE_KEYPOINTS = [
  LM.WRIST,
  LM.THUMB_TIP,
  LM.INDEX_TIP,
  LM.MIDDLE_TIP,
  LM.RING_TIP,
  LM.PINKY_TIP,
]

function computeBBox(landmarks) {
  if (!landmarks?.length) return null

  const xs = landmarks.map((point) => point.x)
  const ys = landmarks.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    area: (maxX - minX) * (maxY - minY),
  }
}

function flattenCanonicalKeypoints(canonical) {
  if (!canonical?.length) {
    return Array(SEQUENCE_KEYPOINTS.length * 3).fill(0)
  }

  return SEQUENCE_KEYPOINTS.flatMap((index) => {
    const point = canonical[index]
    return [
      point?.x ?? 0,
      point?.y ?? 0,
      point?.z ?? 0,
    ]
  })
}

function normalizeRelativePoint(point, anchor, scaleX, scaleY) {
  if (!point || !anchor) {
    return { x: 0, y: 0, z: 0 }
  }

  return {
    x: (point.x - anchor.x) / (scaleX || 1),
    y: (point.y - anchor.y) / (scaleY || 1),
    z: point.z ?? 0,
  }
}

function buildHandModel(handLike) {
  if (!handLike?.landmarks?.length) return null

  const canonical = normalizeHand(handLike.worldLandmarks || handLike.landmarks)

  return {
    landmarks: handLike.landmarks,
    worldLandmarks: handLike.worldLandmarks ?? null,
    handedness: handLike.handedness ?? null,
    palmCenter: getPalmCenter(handLike.landmarks),
    bbox: computeBBox(handLike.landmarks),
    canonical,
    canonicalVector: flattenCanonicalKeypoints(canonical),
  }
}

function normalizeLegacyFrame(frameLike) {
  const faceAnchor = frameLike?.faceAnchor ?? null
  const handCount = frameLike?.handCount ?? frameLike?.handsCount ?? (frameLike?.secondaryPalmCenter ? 2 : 1)
  const primaryBBox = frameLike?.bbox ?? null
  const scaleX = faceAnchor?.width || primaryBBox?.width || 1
  const scaleY = faceAnchor?.height || primaryBBox?.height || 1
  const primaryRelative = normalizeRelativePoint(frameLike?.palmCenter, faceAnchor?.center, scaleX, scaleY)
  const secondaryRelative = normalizeRelativePoint(frameLike?.secondaryPalmCenter, faceAnchor?.center, scaleX, scaleY)
  const interHand = frameLike?.palmCenter && frameLike?.secondaryPalmCenter
    ? {
        x: (frameLike.secondaryPalmCenter.x - frameLike.palmCenter.x) / scaleX,
        y: (frameLike.secondaryPalmCenter.y - frameLike.palmCenter.y) / scaleY,
        distance: Math.hypot(
          (frameLike.secondaryPalmCenter.x - frameLike.palmCenter.x) / scaleX,
          (frameLike.secondaryPalmCenter.y - frameLike.palmCenter.y) / scaleY,
        ),
      }
    : { x: 0, y: 0, distance: 0 }

  return {
    handCount,
    faceAnchor,
    primaryRelative,
    secondaryRelative,
    interHand,
    primaryHand: {
      bbox: primaryBBox,
      canonicalVector: flattenCanonicalKeypoints(frameLike?.canonical),
    },
    secondaryHand: null,
  }
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function movingAverage(values, windowSize = 3) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1)
    const slice = values.slice(start, index + 1)
    return average(slice)
  })
}

function analyzeDirectionChanges(values, tolerance = 0.01) {
  if (values.length < 3) {
    return { directionChanges: 0, amplitude: 0 }
  }

  const smooth = movingAverage(values, 3)
  let previousSign = 0
  let directionChanges = 0
  let maxAmplitude = 0
  let lastExtreme = smooth[0]

  for (let index = 1; index < smooth.length; index += 1) {
    const delta = smooth[index] - smooth[index - 1]
    if (Math.abs(delta) < tolerance) continue

    const sign = Math.sign(delta)
    if (previousSign !== 0 && sign !== previousSign) {
      const pivot = smooth[index - 1]
      maxAmplitude = Math.max(maxAmplitude, Math.abs(pivot - lastExtreme))
      lastExtreme = pivot
      directionChanges += 1
    }

    previousSign = sign
  }

  return {
    directionChanges,
    amplitude: maxAmplitude,
  }
}

export function normalizeSequenceFrameModel(frameLike) {
  return frameLike?.primaryHand || frameLike?.interHand
    ? frameLike
    : normalizeLegacyFrame(frameLike)
}

export function buildFrameHandModel(primaryLandmarks, frameMeta = {}) {
  const primaryHand = buildHandModel({
    landmarks: primaryLandmarks,
    worldLandmarks: frameMeta.handWorldLandmarks ?? null,
    handedness: frameMeta.handedness ?? null,
  })

  const secondarySource = frameMeta.secondaryHand ?? frameMeta.hands?.[1] ?? null
  const secondaryHand = secondarySource
    ? buildHandModel({
        landmarks: secondarySource.landmarks,
        worldLandmarks: secondarySource.worldLandmarks ?? null,
        handedness: secondarySource.handedness ?? null,
      })
    : null

  const faceAnchor = frameMeta.faceAnchor ?? null
  const handCount = frameMeta.handsCount ?? (secondaryHand ? 2 : (primaryHand ? 1 : 0))
  const scaleX = faceAnchor?.width || primaryHand?.bbox?.width || 1
  const scaleY = faceAnchor?.height || primaryHand?.bbox?.height || 1
  const primaryRelative = normalizeRelativePoint(primaryHand?.palmCenter, faceAnchor?.center, scaleX, scaleY)
  const secondaryRelative = normalizeRelativePoint(secondaryHand?.palmCenter, faceAnchor?.center, scaleX, scaleY)
  const interHand = primaryHand?.palmCenter && secondaryHand?.palmCenter
    ? {
        x: (secondaryHand.palmCenter.x - primaryHand.palmCenter.x) / scaleX,
        y: (secondaryHand.palmCenter.y - primaryHand.palmCenter.y) / scaleY,
        distance: Math.hypot(
          (secondaryHand.palmCenter.x - primaryHand.palmCenter.x) / scaleX,
          (secondaryHand.palmCenter.y - primaryHand.palmCenter.y) / scaleY,
        ),
      }
    : { x: 0, y: 0, distance: 0 }

  return {
    faceAnchor,
    handCount,
    primaryRelative,
    secondaryRelative,
    interHand,
    primaryHand,
    secondaryHand,
  }
}

export function frameModelToSequenceVector(frameLike) {
  const frameModel = normalizeSequenceFrameModel(frameLike)

  const primaryHand = frameModel.primaryHand ?? null
  const secondaryHand = frameModel.secondaryHand ?? null

  return [
    frameModel.handCount >= 2 ? 1 : 0,
    frameModel.primaryRelative?.x ?? 0,
    frameModel.primaryRelative?.y ?? 0,
    frameModel.secondaryRelative?.x ?? 0,
    frameModel.secondaryRelative?.y ?? 0,
    frameModel.interHand?.x ?? 0,
    frameModel.interHand?.y ?? 0,
    frameModel.interHand?.distance ?? 0,
    primaryHand?.bbox?.width ?? 0,
    primaryHand?.bbox?.height ?? 0,
    secondaryHand?.bbox?.width ?? 0,
    secondaryHand?.bbox?.height ?? 0,
    ...(primaryHand?.canonicalVector ?? Array(SEQUENCE_KEYPOINTS.length * 3).fill(0)),
    ...(secondaryHand?.canonicalVector ?? Array(SEQUENCE_KEYPOINTS.length * 3).fill(0)),
  ]
}

export function getSequenceKeypointIndexes() {
  return [...SEQUENCE_KEYPOINTS]
}

export function summarizeSequenceFrames(framesLike = []) {
  const frames = framesLike
    .map(normalizeSequenceFrameModel)
    .filter(Boolean)

  if (!frames.length) {
    return null
  }

  const primaryXs = frames.map((frame) => frame.primaryRelative?.x ?? 0)
  const primaryYs = frames.map((frame) => frame.primaryRelative?.y ?? 0)
  const secondaryXs = frames.map((frame) => frame.secondaryRelative?.x ?? 0)
  const secondaryYs = frames.map((frame) => frame.secondaryRelative?.y ?? 0)
  const interHandDistances = frames.map((frame) => frame.interHand?.distance ?? 0)
  const handCounts = frames.map((frame) => frame.handCount ?? 1)

  const primaryXStats = analyzeDirectionChanges(primaryXs)
  const primaryYStats = analyzeDirectionChanges(primaryYs)

  return {
    frameCount: frames.length,
    handCountRatio: {
      one: handCounts.filter((count) => count <= 1).length / frames.length,
      two: handCounts.filter((count) => count >= 2).length / frames.length,
    },
    avgPrimary: {
      x: average(primaryXs),
      y: average(primaryYs),
    },
    avgSecondary: {
      x: average(secondaryXs),
      y: average(secondaryYs),
    },
    avgInterHandDistance: average(interHandDistances),
    primaryRange: {
      x: Math.max(...primaryXs) - Math.min(...primaryXs),
      y: Math.max(...primaryYs) - Math.min(...primaryYs),
    },
    secondaryRange: {
      x: Math.max(...secondaryXs) - Math.min(...secondaryXs),
      y: Math.max(...secondaryYs) - Math.min(...secondaryYs),
    },
    primaryDelta: {
      x: primaryXs[primaryXs.length - 1] - primaryXs[0],
      y: primaryYs[primaryYs.length - 1] - primaryYs[0],
    },
    motion: {
      xDirectionChanges: primaryXStats.directionChanges,
      yDirectionChanges: primaryYStats.directionChanges,
      xAmplitude: primaryXStats.amplitude,
      yAmplitude: primaryYStats.amplitude,
      dominantAxis:
        (Math.max(...primaryXs) - Math.min(...primaryXs)) >= (Math.max(...primaryYs) - Math.min(...primaryYs))
          ? 'x'
          : 'y',
    },
  }
}
