import re

file_path = "apps/web/src/modules/translator/TranslatorPage.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State changes
if "const isSimulatingRef = useRef(false)" not in content:
    content = content.replace(
        "const [isSimulating, setIsSimulating] = useState(false)",
        """const [isSimulating, setIsSimulating] = useState(false)
  const isSimulatingRef = useRef(false)
  const [isStaticSimulating, setIsStaticSimulating] = useState(false)
  const isStaticSimulatingRef = useRef(false)"""
    )

# 2. runSimulation replacements (robust replacement using re)
run_sim_new = """const runSimulation = useCallback(async () => {
    if (!isActive) return
    setIsSimulating(true)
    isSimulatingRef.current = true
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    updateDetectionDisplay(null, 0, 'letter')
    await delay(1000)

    // 1. A
    updateDetectionDisplay('A', 0.85, 'letter')
    await delay(1200)
    appendLetter('A')
    updateDetectionDisplay(null, 0, 'letter')
    await delay(500)

    // 2. B
    updateDetectionDisplay('B', 0.90, 'letter')
    await delay(1200)
    appendLetter('B')
    updateDetectionDisplay(null, 0, 'letter')
    await delay(500)

    // 3. C
    updateDetectionDisplay('C', 0.88, 'letter')
    await delay(1500)
    appendLetter('C')
    updateDetectionDisplay(null, 0, 'letter')
    await delay(500)
    
    commitWord() // append ABC
    await delay(1000)

    // 4. Hola
    updateDetectionDisplay('HOLA', 0.95, 'gesture')
    await delay(1000)
    commitGesture({ word: 'hola', confidence: 0.95 })
    updateDetectionDisplay(null, 0, 'letter')
    
    // DELAY EXTRA POR MUNDO
    await delay(4000)

    // 5. Mundo
    updateDetectionDisplay('MUNDO', 0.92, 'gesture')
    await delay(1000)
    commitGesture({ word: 'mundo', confidence: 0.92 })
    updateDetectionDisplay(null, 0, 'letter')
    await delay(1000)

    setIsSimulating(false)
    isSimulatingRef.current = false
  }, [isActive, appendLetter, commitWord, commitGesture, updateDetectionDisplay])

  const toggleStaticSimulation = useCallback(() => {
    const next = !isStaticSimulating
    setIsStaticSimulating(next)
    isStaticSimulatingRef.current = next
    if (next) {
      updateDetectionDisplay(null, 0, 'letter')
    }
  }, [isStaticSimulating, updateDetectionDisplay])"""

content = re.sub(
    r"const runSimulation = useCallback\(async \(\) => \{.+?setIsSimulating\(false\)\n  \}, \[.*?\]\)",
    run_sim_new.strip(),
    content,
    flags=re.DOTALL
)

# 3. suppress logic handleLandmarks
content = re.sub(
    r"if \(isSimulating\) \{",
    "if (isSimulatingRef.current || isStaticSimulatingRef.current) {",
    content
)

# 4. suppress interval
if "if (isSimulatingRef.current || isStaticSimulatingRef.current) return;" not in content:
    content = content.replace(
        "if (idleFor >= HAND_LOST_GRACE_MS) {",
        "if (isSimulatingRef.current || isStaticSimulatingRef.current) return;\n      if (idleFor >= HAND_LOST_GRACE_MS) {"
    )

# 5. liveSubtitle
if "isStaticSimulating ?" not in content:
    content = re.sub(
        r"const liveSubtitle = \[\.\.\.phraseWords, liveWordPreview\]\s*\.filter\(Boolean\)\s*\.join\(' '\)",
        "const liveSubtitle = isStaticSimulating ? 'Hola, quisiera agendar una cita' : [...phraseWords, liveWordPreview].filter(Boolean).join(' ')",
        content
    )

# 6. Replace Buttons 
# Desktops
old_desktop_btn = r"\{!isSimulating && isActive && \(\s*<button\s*type=\"button\"\s*onClick=\{runSimulation\}\s*className=\"absolute left-\[8\.5rem\] z-20 rounded-2xl border border-purple-400/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 shadow-xl backdrop-blur-xl transition hover:bg-purple-500/20 active:scale-95 sm:left-36\"\s*style=\{\{ bottom: `calc\(env\(safe-area-inset-bottom, 0px\) \+ \$\{mobileBottomOffset\}\)` \}\}\s*>\s*🚀 Simular Video\s*</button>\s*\)\}"

new_desktop_btn = """<div className="absolute left-[8.5rem] sm:left-36 z-20 flex gap-2" style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}>
            {!isSimulating && isActive && (
              <button
                type="button"
                onClick={runSimulation}
                className="rounded-2xl border border-purple-400/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 shadow-xl backdrop-blur-xl transition hover:bg-purple-500/20 active:scale-95"
              >
                🚀 Simular Video
              </button>
            )}
            {isActive && (
              <button
                type="button"
                onClick={toggleStaticSimulation}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur-xl transition active:scale-95 ${isStaticSimulating ? 'border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'border-blue-400/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'}`}
              >
                {isStaticSimulating ? 'Detener Frase Estática' : '📌 Frase Estática'}
              </button>
            )}
          </div>"""

content = re.sub(old_desktop_btn, new_desktop_btn, content)

# Mobile
old_mobile_btn = r"\{!isSimulating && isActive && \(\s*<button\s*type=\"button\"\s*onClick=\{runSimulation\}\s*className=\"col-span-2 mt-2 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2\.5 text-xs font-semibold text-purple-300 transition active:scale-95\"\s*>\s*🚀 Grabar Demo \(Simulación\)\s*</button>\s*\)\}"

new_mobile_btn = """<div className="col-span-2 mt-2 flex flex-col gap-2">
                  {!isSimulating && isActive && (
                    <button
                      type="button"
                      onClick={runSimulation}
                      className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2.5 text-xs font-semibold text-purple-300 transition active:scale-95"
                    >
                      🚀 Grabar Demo
                    </button>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      onClick={toggleStaticSimulation}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition active:scale-95 ${isStaticSimulating ? 'border-amber-400/30 bg-amber-500/10 text-amber-300' : 'border-blue-400/30 bg-blue-500/10 text-blue-300'}`}
                    >
                      {isStaticSimulating ? 'Detener Frase' : '📌 Frase Estática'}
                    </button>
                  )}
                </div>"""

content = re.sub(old_mobile_btn, new_mobile_btn, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch 2 applied successfully")
