/**
 * VoiceSelector.jsx
 * Permite al usuario sordo elegir la voz con la que quiere ser escuchado.
 * Usa la API de ElevenLabs para listar voces disponibles.
 */

import { useState } from 'react'

// Voces predefinidas con nombres amigables (sin llamada a la API en el MVP)
// Voice IDs de ElevenLabs: https://api.elevenlabs.io/v1/voices
const PRESET_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',  preview: '🎤 Voz femenina clara' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',    preview: '🎤 Voz femenina joven' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',   preview: '🎤 Voz femenina suave' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni',  preview: '🎤 Voz masculina amable' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold',  preview: '🎤 Voz masculina fuerte' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    preview: '🎤 Voz masculina profunda' },
]

export default function VoiceSelector({ selectedVoiceId, onSelect }) {
  const [open, setOpen] = useState(false)
  const selected = PRESET_VOICES.find(v => v.id === selectedVoiceId) ?? PRESET_VOICES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700
                   border border-zinc-700 rounded-xl px-3 py-2 text-sm
                   transition-colors"
      >
        <span>{selected.preview}</span>
        <span className="font-medium">{selected.name}</span>
        <svg className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 bg-zinc-800 border
                        border-zinc-700 rounded-xl overflow-hidden shadow-xl z-10 w-64">
          {PRESET_VOICES.map(voice => (
            <button
              key={voice.id}
              onClick={() => { onSelect(voice.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm
                          hover:bg-zinc-700 transition-colors text-left
                          ${voice.id === selectedVoiceId ? 'bg-brand-500/20 text-brand-300' : 'text-white'}`}
            >
              <span>{voice.preview}</span>
              <span className="font-medium">{voice.name}</span>
              {voice.id === selectedVoiceId && (
                <span className="ml-auto text-brand-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
