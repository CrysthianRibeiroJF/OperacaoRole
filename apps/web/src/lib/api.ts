import type { ApiError as ApiErrorBody } from '@role/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: BodyInit | object): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'content-type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  const text = await res.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? 'Não foi possível completar a ação. Tente novamente.',
      err?.details,
    );
  }
  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: object = {}) => request<T>('POST', path, body),
  put: <T>(path: string, body: object = {}) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: object = {}) => request<T>('PATCH', path, body),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>('POST', path, form);
  },
};

export const errorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : 'Sem conexão. Verifique a internet e tente de novo.';
