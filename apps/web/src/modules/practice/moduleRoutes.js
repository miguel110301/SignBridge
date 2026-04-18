export const FUNDAMENTALS_MODULE_ROUTE = '/practica/modulos/fundamentos-de-lsm'
export const INTERACCIONES_BASICAS_MODULE_ROUTE = '/practica/modulos/interacciones-basicas'
export const CONTEXTOS_REALES_MODULE_ROUTE = '/practica/modulos/contextos-reales'

const FUNDAMENTALS_MODULE_ALIASES = new Set([
  'fundamentos-de-lsm',
  'fundamos-de-lsm',
])

const INTERACCIONES_BASICAS_MODULE_ALIASES = new Set([
  'interacciones-basicas',
  'interacciones-basicas-lsm',
  'interacciones-basicas-de-lsm',
  'interacciones-basicas-en-lsm',
  'interaccion-basica',
])

const CONTEXTOS_REALES_MODULE_ALIASES = new Set([
  'contextos-reales',
  'contextos-reales-lsm',
  'contextos-reales-de-lsm',
  'contextos-reales-en-lsm',
  'contexto-real',
])

function normalizeToSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function isFundamentalsModuleTitle(title = '') {
  return FUNDAMENTALS_MODULE_ALIASES.has(normalizeToSlug(title))
}

export function isInteraccionesBasicasModuleTitle(title = '') {
  return INTERACCIONES_BASICAS_MODULE_ALIASES.has(normalizeToSlug(title))
}

export function isContextosRealesModuleTitle(title = '') {
  return CONTEXTOS_REALES_MODULE_ALIASES.has(normalizeToSlug(title))
}

export function getPracticeModuleDetailPath(title = '') {
  if (isFundamentalsModuleTitle(title)) {
    return FUNDAMENTALS_MODULE_ROUTE
  }

  if (isInteraccionesBasicasModuleTitle(title)) {
    return INTERACCIONES_BASICAS_MODULE_ROUTE
  }

  if (isContextosRealesModuleTitle(title)) {
    return CONTEXTOS_REALES_MODULE_ROUTE
  }

  return null
}