export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export const badRequest = (errors) => new HttpError(400, 'VALIDATION_ERROR', errors[0], errors)
