import os

file_path = "apps/web/src/modules/translator/TranslatorPage.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variable
if "const [isSimulating, setIsSimulating] = useState(false)" not in content:
    content = content.replace(
        "const isVoiceToSignMode = translationMode === TRANSLATION_MODE.VOICE_TO_SIGN",
        "const isVoiceToSignMode = translationMode === TRANSLATION_MODE.VOICE_TO_SIGN\n  const [isSimulating, setIsSimulating] = useState(false)"
    )

# 2. Add runSimulation function after appendLetter
run_simulation_code = """
  const runSimulation = useCallback(async () => {
    if (!isActive) return
    setIsSimulating(true)
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    // 1. A
    updateDetectionDisplay('A', 0.85, 'letter')
    appendLetter('A')
    await delay(1200)

    // 2. B
    updateDetectionDisplay('B', 0.90, 'letter')
    appendLetter('B')
    await delay(1200)

    // 3. C
    updateDetectionDisplay('C', 0.88, 'letter')
    appendLetter('C')
    await delay(1500)
    
    commitWord() // append ABC
    await delay(800)

    // 4. Hola
    updateDetectionDisplay('HOLA', 0.95, 'gesture')
    commitGesture({ word: 'hola', confidence: 0.95 })
    await delay(2000)

    // 5. Mundo
    updateDetectionDisplay('MUNDO', 0.92, 'gesture')
    commitGesture({ word: 'mundo', confidence: 0.92 })
    await delay(2000)

    // End
    updateDetectionDisplay(null, 0, 'letter')
    setIsSimulating(false)
  }, [isActive, appendLetter, commitWord, commitGesture, updateDetectionDisplay])
"""
if "const runSimulation =" not in content:
    content = content.replace(
        "const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {",
        run_simulation_code + "\n  const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {"
    )

# 3. Suppress actual analysis during simulation
sim_intercept = """    const gestureState = gestureRecognizerRef.current.push(landmarks, enrichedFrameMeta, now)

    if (isSimulating) {
      updateDebugVisuals({
        landmarks,
        frameMeta: enrichedFrameMeta,
        handMetrics,
        handQuality,
        staticPose,
        handedness,
        fingerDebugString: debugFingers(landmarks, { handedness }),
        gestureState,
        rawPrediction: null,
        smoothedPrediction: null,
        prediction: null,
      })
      lastHandSeenAtRef.current = now
      wordPauseHandledRef.current = false
      phrasePauseHandledRef.current = false
      setHandPresence(true)
      return
    }"""
if "    if (isSimulating) {" not in content:
    content = content.replace(
        "    const gestureState = gestureRecognizerRef.current.push(landmarks, enrichedFrameMeta, now)",
        sim_intercept
    )

# 4. Add Buttons
sim_button_mobile = """
                {!isSimulating && isActive && (
                  <button
                    type="button"
                    onClick={runSimulation}
                    className="col-span-2 mt-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2.5 text-xs font-semibold text-purple-300 transition active:scale-95"
                  >
                    🚀 Grabar Demo (Simulación)
                  </button>
                )}"""

content = content.replace(
    "              </div>\n            </div>\n          )}",
    "              </div>" + sim_button_mobile + "\n            </div>\n          )}"
)

sim_button_desktop = """
          {!isSimulating && isActive && (
            <button
              type="button"
              onClick={runSimulation}
              className="absolute left-[8.5rem] z-20 rounded-2xl border border-purple-400/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 shadow-xl backdrop-blur-xl transition hover:bg-purple-500/20 active:scale-95 sm:left-36"
              style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}
            >
              🚀 Simular Video
            </button>
          )}"""

content = content.replace(
    "          <button\n            type=\"button\"\n            onClick={() => setShowDebug((prev) => !prev)}",
    sim_button_desktop + "\n\n          <button\n            type=\"button\"\n            onClick={() => setShowDebug((prev) => !prev)}"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied")
