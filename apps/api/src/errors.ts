/** Erros de negócio com código estável (o front reage ao `code`, não à mensagem). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Faça login para continuar') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Você não tem permissão para isso') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Não encontrado') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
