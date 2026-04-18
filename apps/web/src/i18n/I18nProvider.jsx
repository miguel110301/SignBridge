import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import es from './es.json'
import en from './en.json'

const LANGS = { es, en }
const STORAGE_KEY = 'signbridge-lang'

const I18nContext = createContext(null)

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return 'es'
    return localStorage.getItem(STORAGE_KEY) || 'es'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback((key, params) => {
    let value = getNestedValue(LANGS[lang], key) ?? getNestedValue(LANGS.es, key) ?? key
    if (typeof value === 'string' && params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, v)
      }
    }
    return value
  }, [lang])

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'es' ? 'en' : 'es'))
  }, [])

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
