// A tiny method + path router for the mock backend.
import { Id } from '@/types/api';
import { MockDb } from './db';

export interface MockRequest {
  db: MockDb;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Parsed JSON body, or undefined. */
  body: any;
  form: FormData | null;
  actorId: Id | null;
}

export interface MockReply {
  status: number;
  body?: unknown;
}

export type MockHandler = (req: MockRequest) => MockReply | Promise<MockReply>;

export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`Mock ${status}`);
  }
}

export const ok = (body: unknown): MockReply => ({ status: 200, body });
export const created = (body: unknown): MockReply => ({ status: 201, body });
export const noContent = (): MockReply => ({ status: 204 });

export const notFound = (what: string): never => {
  throw new MockHttpError(404, { detail: `${what} not found` });
};

/** Mirrors FastAPI's 422 body. */
export const invalid = (field: string, msg: string): never => {
  throw new MockHttpError(422, { detail: [{ loc: ['body', field], msg, type: 'value_error' }] });
};

export const idParam = (req: MockRequest, name = 'id'): Id => {
  const value = Number(req.params[name]);
  if (!Number.isInteger(value)) throw new MockHttpError(422, { detail: `${name} must be an integer` });
  return value;
};

interface Route {
  method: string;
  segments: string[];
  handler: MockHandler;
}

export class MockRouter {
  private routes: Route[] = [];

  on(method: string, path: string, handler: MockHandler) {
    this.routes.push({ method, segments: path.split('/').filter(Boolean), handler });
    return this;
  }

  match(method: string, path: string): { handler: MockHandler; params: Record<string, string> } | null {
    const parts = path.split('/').filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      const matches = route.segments.every((segment, i) => {
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(parts[i]);
          return true;
        }
        return segment === parts[i];
      });
      if (matches) return { handler: route.handler, params };
    }
    return null;
  }
}
