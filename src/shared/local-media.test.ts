// @vitest-environment node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ViteDevServer } from 'vite';
import { expect, it, vi } from 'vitest';
import { localMediaPlugin } from '../../server/local-media';

it('keeps keys on fixed provider requests and rejects non-local media actions', async () => {
  const provider = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ sample: true }));
  const plugin = localMediaPlugin({ googleFonts: 'fixture-font-key', unsplash: 'fixture-photo-key' }, provider);
  const configure = plugin.configureServer;
  if (typeof configure !== 'function') throw new Error('Expected Vite middleware hook');

  let middleware!: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  configure.call({} as ThisParameterType<typeof configure>, {
    middlewares: { use: (fn: typeof middleware) => { middleware = fn; } },
  } as unknown as ViteDevServer);
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404).end(); }));
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;

  try {
    const fonts = await fetch(origin + '/api/media/fonts');
    expect(await fonts.json()).toEqual({ sample: true });
    expect(fonts.status).toBe(200);
    const [fontUrl, fontOptions] = provider.mock.calls[0];
    expect(String(fontUrl)).toMatch(/^https:\/\/www\.googleapis\.com\/webfonts\/v1\/webfonts\?/);
    expect(String(fontUrl)).not.toContain('fixture-font-key');
    expect(fontOptions?.headers).toEqual({ 'x-goog-api-key': 'fixture-font-key' });

    const search = await fetch(origin + '/api/media/unsplash?query=blue%20sky');
    expect(await search.json()).toEqual({ sample: true });
    const [photoUrl, photoOptions] = provider.mock.calls[1];
    expect(String(photoUrl)).toContain('https://api.unsplash.com/search/photos?query=blue+sky');
    expect(photoOptions?.headers).toMatchObject({ Authorization: 'Client-ID fixture-photo-key' });
    expect(photoOptions?.redirect).toBe('error');

    const cross = await fetch(origin + '/api/media/unsplash?query=blue', { headers: { Origin: 'https://outside.invalid' } });
    expect(cross.status).toBe(403);
    const invalid = await fetch(origin + '/api/media/unsplash?query=blue&page=999');
    expect(invalid.status).toBe(400);
    const unscoped = await fetch(origin + '/api/local-media/unsplash-selection?id=photo_1', { method: 'POST' });
    expect(unscoped.status).toBe(403);
    expect(provider).toHaveBeenCalledTimes(2);

    const picked = await fetch(origin + '/api/local-media/unsplash-selection?id=photo_1&ixid=tracked', { method: 'POST', headers: { Origin: origin } });
    expect(picked.status).toBe(204);
    expect(String(provider.mock.calls[2][0])).toBe('https://api.unsplash.com/photos/photo_1/download?ixid=tracked');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
