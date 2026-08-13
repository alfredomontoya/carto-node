export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION' | 'AUTH' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL',
    public readonly status: number = 400,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function forbidden(message = 'No tienes permisos para realizar esta acción.'): AppError {
  return new AppError(message, 'FORBIDDEN', 403)
}

export function notFound(message = 'El recurso no existe.'): AppError {
  return new AppError(message, 'NOT_FOUND', 404)
}

export function conflict(message: string): AppError {
  return new AppError(message, 'CONFLICT', 409)
}

export function validationError(fieldErrors: Record<string, string[]>, message = 'Datos inválidos.'): AppError {
  return new AppError(message, 'VALIDATION', 422, fieldErrors)
}