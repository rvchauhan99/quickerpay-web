export class MoneyError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'MoneyError'
    this.code = code
  }
}
