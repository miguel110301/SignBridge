# SignBridge 🤟

> Intérprete de lengua de señas en tiempo real, sin intérprete humano.
> PWA — funciona en cualquier teléfono sin instalar nada.

Proyecto desarrollado para **Hackathon Troyano 2026**.

---

## El problema

En México hay **2 millones de personas sordas** y menos de **200 intérpretes certificados**.  
Eso significa que la mayoría de personas sordas no puede tener una conversación fluida  
con alguien que no conoce el lenguaje de señas — en hospitales, escuelas, trabajo, o en la calle.

**SignBridge cierra esa brecha.**

---

## Cómo funciona

```
Persona sorda hace señas
        ↓
MediaPipe detecta 21 landmarks por mano (30fps)
        ↓
Clasificador geométrico → letra LSM
        ↓
Suavizador de predicciones (ventana de 8 frames)
        ↓
ElevenLabs convierte el texto en voz natural
        ↓
Persona oyente escucha la traducción
```

El canal inverso usa **Web Speech API** del browser:  
la persona oyente habla → el texto aparece en pantalla para que el sordo lea.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Detección de manos | `@mediapipe/tasks-vision` |
| Clasificador de señas | Geométrico (distancias de landmarks) |
| Voz | ElevenLabs `eleven_multilingual_v2` |
| Práctica con IA | Gemini Vision API |
| Base de datos | MongoDB Atlas |
| Frontend | React 18 + Vite + Tailwind + PWA |
| Backend | Node.js + Express |
| Deploy frontend | Vercel |
| Deploy backend | Vultr |

---

## Estructura del proyecto

```
SignBridge/
├── apps/
│   ├── web/                   # PWA (React + Vite)
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── translator/
│   │       │   ├── training/
│   │       │   ├── practice/
│   │       │   └── landing/
│   │       ├── hooks/
│   │       └── utils/
│   └── api/                   # API (Node.js + Express)
│       └── routes/
│           ├── elevenlabs.js
│           ├── gemini.js
│           ├── progress.js
│           └── training.js
├── packages/
│   └── sign-engine/           # Motor compartido de landmarks, reglas y decoding
├── archive/
│   └── pwa-experiments/       # Línea experimental previa, fuera del flujo principal
├── .env.example
└── package.json
```

---

## Setup en 5 minutos

### 1. Clonar y instalar
```bash
git clone https://github.com/miguel110301/SignBridge.git
cd SignBridge
npm run install:all
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus API keys:
#   ELEVENLABS_API_KEY=...
#   GEMINI_API_KEY=...
#   MONGODB_URI=...         (de MongoDB Atlas → Connect → Drivers)
```

### 3. Arrancar en desarrollo
```bash
npm run dev
# Web: http://localhost:5173
# API: http://localhost:3001
```

---

## Variables de entorno necesarias

| Variable | Dónde obtenerla |
|----------|-----------------|
| `ELEVENLABS_API_KEY` | [elevenlabs.io/app/api-keys](https://elevenlabs.io/app/api-keys) |
| `ELEVENLABS_VOICE_ID` | [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library) |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/) |
| `MONGODB_URI` | [cloud.mongodb.com](https://cloud.mongodb.com/) → Connect |

---

## Sponsors

| Premio | Integración |
|--------|-------------|
| **ElevenLabs** | La persona sorda elige su voz. El texto traducido se habla en tiempo real con `eleven_multilingual_v2`. |
| **Gemini API** | El módulo de práctica analiza la posición de los dedos del usuario y da feedback específico en lenguaje natural. |
| **MongoDB Atlas** | Guarda el progreso del usuario: señas dominadas, racha de práctica y voz preferida. |
| **Vultr** | El servidor Node.js (proxy de ElevenLabs y Gemini) corre en Vultr con HTTPS. |

---

## Por qué no se puede replicar con ChatGPT

MediaPipe procesa **30 frames por segundo** de forma continua.  
El usuario no hace nada — la IA trabaja sola mientras existe frente a la cámara.  
No hay forma de "describir con texto" los micro-movimientos de 21 puntos de la mano  
en tiempo real con la fidelidad suficiente para que una IA los interprete.

---

## Equipo

Hackathon Troyano 2026 · Monterrey, México

---

## Licencia

MIT
