import { AppError } from '@/server/domain/errors'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export function resultadoError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  if (e instanceof AppError) {
    return { ok: false, error: e.message, fieldErrors: e.fieldErrors }
  }
  return { ok: false, error: 'Ocurrió un error inesperado. Intenta de nuevo.' }
}

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export { zodResolver }
export type { ZodType }