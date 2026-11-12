import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { isLocalEditorRequest, sendLocalJson as json } from './local-http';

type Keys = { googleFonts?: string; unsplash?: string };
const paths = new Set(['/api/media/fonts', '/api/media/unsplash', '/api/local-media/unsplash-selection']);

export function localMediaPlugin(keys: Keys, request: typeof fetch = fetch): Plugin {
  const register = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, res, next) => {
      const raw = req.url ?? '';
      if (!paths.has(raw.split('?', 1)[0])) return next();
      void handle(req, res, raw).catch(() => {
        if (!res.headersSent) json(res, 502, { error: 'Media provider request failed.' });
        else res.end();
      });
    });
  };

  async function handle(req: IncomingMessage, res: ServerResponse, raw: string) {
    if (!isLocalEditorRequest(req)) return json(res, 403, { error: 'Local editor only.' });
    const { pathname, searchParams } = new URL(raw, 'http://localhost');
    const isSelection = pathname === '/api/local-media/unsplash-selection';
    const method = isSelection ? 'POST' : 'GET';
    if (req.method !== method) {
      res.setHeader('Allow', method);
      return json(res, 405, { error: 'Method not allowed.' });
    }

    let url: URL;
    let headers: Record<string, string>;
    if (pathname === '/api/media/fonts') {
      if (!keys.googleFonts) return json(res, 503, { error: 'Google Fonts is not configured.' });
      url = new URL('https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&capability=FAMILY_TAGS');
      headers = { 'x-goog-api-key': keys.googleFonts };
    } else {
      if (!keys.unsplash) return json(res, 503, { error: 'Unsplash is not configured.' });
      headers = { Authorization: 'Client-ID ' + keys.unsplash, 'Accept-Version': 'v1' };
      if (isSelection) {
        const id = searchParams.get('id') ?? '';
        const ixid = searchParams.get('ixid');
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || (ixid !== null && !/^[A-Za-z0-9_+=/-]{1,512}$/.test(ixid))) {
          return json(res, 400, { error: 'Invalid Unsplash photo.' });
        }
        url = new URL('https://api.unsplash.com/photos/' + id + '/download');
        if (ixid) url.searchParams.set('ixid', ixid);
      } else {
        const query = searchParams.get('query')?.trim() ?? '';
        const page = Number(searchParams.get('page') ?? 1);
        const perPage = Number(searchParams.get('per_page') ?? 30);
        if (!query || query.length > 200 || !Number.isInteger(page) || page < 1 || page > 8
          || !Number.isInteger(perPage) || perPage < 1 || perPage > 30) {
          return json(res, 400, { error: 'Invalid Unsplash search.' });
        }
        url = new URL('https://api.unsplash.com/search/photos');
        url.search = new URLSearchParams({ query, page: String(page), per_page: String(perPage) }).toString();
      }
    }

    const upstream = await request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(12_000) });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return json(res, upstream.status === 429 ? 429 : 502, { error: 'Media provider rejected the request.' });
    }
    if (isSelection) {
      await upstream.body?.cancel();
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    const data = await upstream.json();
    json(res, 200, data);
  }

  return { name: 'revyme-local-media', configureServer: register, configurePreviewServer: register };
}
