// Mock backend for `npm run dev:mock`. Loaded only in mock mode (see main.tsx),
// so it never ships in a normal build. Data lives in memory and resets on reload.
import { api, API_BASE, installTransport } from '@/lib/api';
import { Id } from '@/types/api';
import { MockDb } from './db';
import { buildRoutes } from './handlers';
import { MockHttpError, MockReply } from './router';
import { buildSeed } from './seed';

const LATENCY_MS: [number, number] = [120, 380];

const delay = () =>
  new Promise((resolve) => setTimeout(resolve, LATENCY_MS[0] + Math.random() * (LATENCY_MS[1] - LATENCY_MS[0])));

const toResponse = ({ status, body }: MockReply) => {
  if (status === 204 || body === undefined) return new Response(null, { status: status === 200 ? 204 : status });
  if (body instanceof Blob) return new Response(body, { status, headers: { 'Content-Type': body.type } });
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
};

export const installMockBackend = async () => {
  const db: MockDb = await buildSeed();
  const routes = buildRoutes();
  const objectUrls = new Map<Id, string>();

  const mockFetch = async (input: string, init: RequestInit): Promise<Response> => {
    const url = new URL(input, window.location.origin);
    const path = url.pathname.startsWith(API_BASE) ? url.pathname.slice(API_BASE.length) : url.pathname;
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const actor = headers.get('X-Investigator-Id');

    await delay();
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const match = routes.match(method, path);
    if (!match) return toResponse({ status: 404, body: { detail: `Mock backend has no route for ${method} ${path}` } });

    let body: unknown;
    let form: FormData | null = null;
    if (init.body instanceof FormData) form = init.body;
    else if (typeof init.body === 'string') body = JSON.parse(init.body);

    try {
      const reply = await match.handler({
        db,
        params: match.params,
        query: url.searchParams,
        body,
        form,
        actorId: actor ? Number(actor) : null
      });
      return toResponse(reply);
    } catch (error) {
      if (error instanceof MockHttpError) return toResponse({ status: error.status, body: error.body });
      console.error('[mock backend]', method, path, error);
      return toResponse({ status: 500, body: { detail: `Mock backend error: ${(error as Error).message}` } });
    }
  };

  // Media elements can't call the mock, so they get object URLs for the stored files.
  const fileUrl = (evidenceId: Id) => {
    const file = db.files.get(evidenceId);
    if (!file) return null;
    if (!objectUrls.has(evidenceId)) objectUrls.set(evidenceId, URL.createObjectURL(file));
    return objectUrls.get(evidenceId)!;
  };

  installTransport(mockFetch, fileUrl);

  // Handy from the browser console: forensixMock.api.get('/cases'), forensixMock.db.
  (window as unknown as { forensixMock: unknown }).forensixMock = { db, api };
  console.info('[Forensix] Mock backend active: data is in memory and resets on reload.');
};
