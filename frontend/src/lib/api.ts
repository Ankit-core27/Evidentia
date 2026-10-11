// Fetch wrapper for the FastAPI backend. Every request goes through here, so the
// X-Investigator-Id header, error handling and mock mode live in one place.
import { useInvestigatorStore } from '@/stores/investigator';
import { ApiErrorBody, Id } from '@/types/api';

export const API_BASE = '/api';

export const isMockMode = import.meta.env.MODE === 'mock';

type Transport = (url: string, init: RequestInit) => Promise<Response>;
type FileUrlResolver = (evidenceId: Id, download: boolean) => string | null;

let transport: Transport = (url, init) => fetch(url, init);
let mockFileUrl: FileUrlResolver | null = null;

/** Used by src/mocks to serve the API from memory in `npm run dev:mock`. */
export const installTransport = (mockTransport: Transport, fileUrlResolver: FileUrlResolver) => {
  transport = mockTransport;
  mockFileUrl = fileUrlResolver;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const errorMessage = (status: number, body: unknown): string => {
  const detail = (body as ApiErrorBody | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => `${d.loc.slice(1).join('.')}: ${d.msg}`).join('; ');
  return `Request failed with status ${status}`;
};

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export const buildUrl = (path: string, query?: QueryParams) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE}${path}${search ? `?${search}` : ''}`;
};

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const investigatorId = useInvestigatorStore.getState().investigatorId;
  if (investigatorId !== null) headers['X-Investigator-Id'] = String(investigatorId);

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await transport(buildUrl(path, options.query), { method, headers, body, signal: options.signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the Evidentia API. Is the backend running on port 8000?', null);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, data), data);
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T = void>(path: string) => request<T>('DELETE', path)
};

/**
 * URL for an evidence file, for <img>, <video>, <audio>, <iframe> and download links.
 * Media elements can't send headers, so the investigator goes in the query string,
 * and `download` makes the backend log "exported" instead of "viewed".
 * Returns null in mock mode when the mock has no file for this evidence.
 */
export const fileUrl = (evidenceId: Id, { download = false }: { download?: boolean } = {}): string | null => {
  if (mockFileUrl) return mockFileUrl(evidenceId, download);
  return buildUrl(`/evidence/${evidenceId}/file`, {
    investigator_id: useInvestigatorStore.getState().investigatorId,
    download: download ? 1 : undefined
  });
};
