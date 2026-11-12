// @vitest-environment node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ViteDevServer } from 'vite';
import { expect, it, vi } from 'vitest';
import { localAiPlugin } from '../../server/local-ai';

it('only runs a fixed prompt against an installed model on same-origin requests', async () => {
  const provider = vi.fn<typeof fetch>(async (url) => String(url).endsWith('/tags')
    ? Response.json({ models: [{ name: 'local:test' }] })
    : Response.json({ message: { content: 'Connection OK' } }));
  const configure = localAiPlugin(provider).configureServer;
  if (typeof configure !== 'function') throw new Error('Expected middleware hook');
  let middleware!: (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
  configure.call({} as ThisParameterType<typeof configure>, {
    middlewares: { use: (fn: typeof middleware) => { middleware = fn; } },
  } as unknown as ViteDevServer);
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404).end(); }));
  await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    expect(await (await fetch(`${origin}/api/local-ai/models`)).json()).toEqual({ models: ['local:test'] });
    const post = (query: string, source: string) => fetch(`${origin}/api/local-ai/test?${query}`, {
      method: 'POST', headers: { Origin: source },
    });
    expect((await post('model=local:test', 'https://outside.invalid')).status).toBe(403);
    expect((await post('model=not-installed', origin)).status).toBe(400);
    expect(provider.mock.calls.every(([url]) => url === 'http://127.0.0.1:11434/api/tags')).toBe(true);

    expect(await (await post('model=local:test&prompt=untrusted', origin)).json()).toEqual({ reply: 'Connection OK' });
    const calls = provider.mock.calls.filter(([url]) => url === 'http://127.0.0.1:11434/api/chat');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0][1]?.body))).toMatchObject({ model: 'local:test', think: false, messages: [{ content: 'Reply with exactly: Connection OK' }] });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
