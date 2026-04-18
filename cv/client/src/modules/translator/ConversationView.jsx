/**
 * ConversationView.jsx
 * Chat bidireccional: señas del usuario sordo + voz de la persona oyente.
 */

import { useEffect, useRef } from 'react'

export default function ConversationView({ messages }) {
  const bottomRef = useRef(null)

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-zinc-500 text-sm text-center">
          La conversación aparecerá aquí.<br />
          Empieza a hacer señas o habla.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex flex-col gap-0.5 ${
            msg.type === 'sign' ? 'items-start' : 'items-end'
          }`}
        >
          {/* Etiqueta del emisor */}
          <span className="text-xs text-zinc-500 px-1">
            {msg.type === 'sign' ? '🤟 Señas' : '🗣 Voz'}
          </span>
          {/* Burbuja */}
          <div className={msg.type === 'sign' ? 'bubble-sign' : 'bubble-voice'}>
            {msg.text}
          </div>
          {/* Timestamp */}
          <span className="text-[10px] text-zinc-600 px-1">
            {new Date(msg.timestamp).toLocaleTimeString('es-MX', {
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            })}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
