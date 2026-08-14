import type { HorarioDisponibilidad } from '@/server/domain/constants'
import { validationError } from '@/server/domain/errors'

export const HORARIO_KEY = 'horario_disponibilidad'

export const HORARIO_DEFAULT: HorarioDisponibilidad = {
  habilitado: false,
  horaInicio: '07:00',
  horaFin: '19:00',
  dias: [1, 2, 3, 4, 5],
}

export function parseHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function validarHorario(datos: HorarioDisponibilidad): void {
  const fieldErrors: Record<string, string[]> = {}
  const rx = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!rx.test(datos.horaInicio)) fieldErrors.horaInicio = ['Formato inválido (usa HH:mm).']
  if (!rx.test(datos.horaFin)) fieldErrors.horaFin = ['Formato inválido (usa HH:mm).']
  if (
    rx.test(datos.horaInicio) &&
    rx.test(datos.horaFin) &&
    parseHora(datos.horaFin) <= parseHora(datos.horaInicio)
  ) {
    fieldErrors.horaFin = ['La hora de fin debe ser posterior a la de inicio.']
  }
  if (
    !Array.isArray(datos.dias) ||
    datos.dias.length === 0 ||
    datos.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  ) {
    fieldErrors.dias = ['Selecciona al menos un día.']
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw validationError(fieldErrors, Object.values(fieldErrors).flat().join(' '))
  }
}

export function estaDentroDelHorario(h: HorarioDisponibilidad, ahora = new Date()): boolean {
  if (!h.habilitado) return true
  if (!h.dias.includes(ahora.getDay())) return false
  const minutos = ahora.getHours() * 60 + ahora.getMinutes()
  return minutos >= parseHora(h.horaInicio) && minutos < parseHora(h.horaFin)
}

const DIAS_MIN = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function horarioEnTexto(h: HorarioDisponibilidad): string {
  const nombres = DIAS_MIN.filter((_, i) => h.dias.includes(i))
  if (nombres.length === 0) return ''
  return `${h.horaInicio} a ${h.horaFin}, ${nombres.join(', ')}`
}
