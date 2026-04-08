export class AppError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

export function badRequest(message: string) {
  return new AppError(message, 400)
}

export function notFound(message: string) {
  return new AppError(message, 404)
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(message, 401)
}
