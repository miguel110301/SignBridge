/**
 * Static curriculum data for the academy.
 * Each unit contains ordered lessons with content used during quizzes.
 */

/* Sign image helpers – we use Unicode emoji as placeholder images.
   In production these would be replaced with real images/videos. */

const ALPHABET_SIGNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const GREETINGS = ['hello', 'goodbye', 'please', 'thank_you', 'sorry', 'yes', 'no', 'help']
const NUMBERS   = ['0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20']
const PHRASES   = ['how_are_you', 'my_name_is', 'nice_to_meet_you', 'i_understand', 'repeat_please', 'where_is', 'i_need', 'excuse_me']
const MEDICAL   = ['pain', 'head', 'stomach', 'fever', 'medicine', 'doctor', 'emergency', 'allergic']
const EMOTIONS  = ['happy', 'sad', 'scared', 'angry', 'tired', 'surprised', 'love', 'worried']

/* Question labels per language (used by quiz logic) */
export const signLabels = {
  en: {
    hello: 'Hello', goodbye: 'Goodbye', please: 'Please', thank_you: 'Thank you',
    sorry: 'Sorry', yes: 'Yes', no: 'No', help: 'Help',
    how_are_you: 'How are you?', my_name_is: 'My name is…', nice_to_meet_you: 'Nice to meet you',
    i_understand: 'I understand', repeat_please: 'Repeat please', where_is: 'Where is…?',
    i_need: 'I need…', excuse_me: 'Excuse me',
    pain: 'Pain', head: 'Head', stomach: 'Stomach', fever: 'Fever',
    medicine: 'Medicine', doctor: 'Doctor', emergency: 'Emergency', allergic: 'Allergic',
    happy: 'Happy', sad: 'Sad', scared: 'Scared', angry: 'Angry',
    tired: 'Tired', surprised: 'Surprised', love: 'Love', worried: 'Worried',
  },
  es: {
    hello: 'Hola', goodbye: 'Adiós', please: 'Por favor', thank_you: 'Gracias',
    sorry: 'Lo siento', yes: 'Sí', no: 'No', help: 'Ayuda',
    how_are_you: '¿Cómo estás?', my_name_is: 'Me llamo…', nice_to_meet_you: 'Mucho gusto',
    i_understand: 'Entiendo', repeat_please: 'Repite por favor', where_is: '¿Dónde está…?',
    i_need: 'Necesito…', excuse_me: 'Disculpe',
    pain: 'Dolor', head: 'Cabeza', stomach: 'Estómago', fever: 'Fiebre',
    medicine: 'Medicina', doctor: 'Doctor', emergency: 'Emergencia', allergic: 'Alérgico',
    happy: 'Feliz', sad: 'Triste', scared: 'Asustado', angry: 'Enojado',
    tired: 'Cansado', surprised: 'Sorprendido', love: 'Amor', worried: 'Preocupado',
  },
}

/* Helper: chunk array into groups */
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/* Build lesson sets from sign arrays */
function buildLessons(signs, perLesson = 4) {
  return chunk(signs, perLesson).map((group, i) => ({
    id: `lesson-${i + 1}`,
    signs: group,
    xpReward: 10 + i * 2,
  }))
}

/** Full curriculum */
export const curriculum = [
  { id: 'alphabet',       lessons: buildLessons(ALPHABET_SIGNS, 4) },
  { id: 'greetings',      lessons: buildLessons(GREETINGS, 3) },
  { id: 'numbers',        lessons: buildLessons(NUMBERS, 5) },
  { id: 'common_phrases', lessons: buildLessons(PHRASES, 3) },
  { id: 'medical',        lessons: buildLessons(MEDICAL, 3) },
  { id: 'emotions',       lessons: buildLessons(EMOTIONS, 3) },
]

/**
 * Generate quiz questions for a lesson.
 * Returns array of { type, question, correctAnswer, options }
 */
export function generateQuestions(signs, lang = 'en') {
  const labels = signLabels[lang] || signLabels.en
  const allPool = Object.keys(labels)

  return signs.map((sign) => {
    const label = labels[sign] || sign
    const type = Math.random() < 0.5 ? 'multiple_choice' : 'sign_to_text'

    // Build 3 wrong options
    const wrongs = []
    const pool = allPool.filter(s => s !== sign)
    while (wrongs.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length)
      wrongs.push(pool.splice(idx, 1)[0])
    }

    const options = [
      { key: sign, label },
      ...wrongs.map(w => ({ key: w, label: labels[w] || w })),
    ].sort(() => Math.random() - 0.5)

    return {
      type,
      sign,
      signLabel: label,
      correctAnswer: sign,
      options,
    }
  })
}
