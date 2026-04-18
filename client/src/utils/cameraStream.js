const DEFAULT_PREVIEW_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 960 },
  frameRate: { ideal: 30, max: 30 },
}

export async function requestCameraStream({ preferredFacingMode } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no soporta acceso a camara.')
  }

  const attempts = []

  if (preferredFacingMode) {
    attempts.push({
      audio: false,
      video: {
        ...DEFAULT_PREVIEW_CONSTRAINTS,
        facingMode: { ideal: preferredFacingMode },
      },
    })

    attempts.push({
      audio: false,
      video: {
        facingMode: preferredFacingMode,
      },
    })
  }

  attempts.push({
    audio: false,
    video: {
      ...DEFAULT_PREVIEW_CONSTRAINTS,
    },
  })

  attempts.push({
    audio: false,
    video: true,
  })

  let lastError = null

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('No se pudo iniciar la camara.')
}

export function stopCameraStream(stream) {
  stream?.getTracks?.().forEach((track) => {
    track.stop()
  })
}
