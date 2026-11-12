import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { isLocalEditorRequest, sendLocalJson as json } from './local-http';

const OLLAMA = 'http://127.0.0.1:11434';
const MODELS = '/api/local-ai/models';
const TEST = '/api/local-ai/test';

export function localAiPlugin(request: typeof fetch = fetch): Plugin {
  let testing = false;
  const register = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, res, next) => {
      const raw = req.url ?? '';
      const path = raw.split('?', 1)[0];
      if (path !== MODELS && path !== TEST) return next();
      void handle(req, res, raw, path === TEST).catch(() => {
        if (!res.headersSent && !res.destroyed) json(res, 502, { error: 'Ollama did not respond. Check that it is running on this computer.' });
      });
    });
  };

  async function models() {
    const response = await request(`${OLLAMA}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(3000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Ollama model list failed');
    }
    const data = await response.json() as { models?: Array<{ name?: unknown }> };
    if (!Array.isArray(data.models)) throw new Error('Invalid Ollama model list');
    return data.models.flatMap(({ name }) => typeof name === 'string' && name.length <= 256 ? [name] : []);
  }

  async function handle(req: IncomingMessage, res: ServerResponse, raw: string, test: boolean) {
    if (!isLocalEditorRequest(req)) return json(res, 403, { error: 'Local editor only.' });
    const method = test ? 'POST' : 'GET';
    if (req.method !== method) {
      res.setHeader('Allow', method);
      return json(res, 405, { error: 'Method not allowed.' });
    }
    if (!test) return json(res, 200, { models: await models() });

    const model = new URL(raw, 'http://localhost').searchParams.get('model');
    if (!model || model.length > 256) return json(res, 400, { error: 'Choose an installed model.' });
    if (testing) return json(res, 409, { error: 'A model test is already running.' });
    testing = true;
    const cancel = new AbortController();
    const close = () => cancel.abort();
    res.once('close', close);
    try {
      if (!(await models()).includes(model)) return json(res, 400, { error: 'Choose an installed model.' });
      const response = await request(`${OLLAMA}/api/chat`, {
        method: 'POST', redirect: 'error',
        signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(60_000)]),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, stream: false, think: false, options: { num_predict: 64 },
          messages: [{ role: 'user', content: 'Reply with exactly: Connection OK' }],
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return json(res, 502, { error: 'Ollama could not run this model. Try another installed model.' });
      }
      const data = await response.json() as { message?: { content?: unknown } };
      const reply = typeof data.message?.content === 'string' ? data.message.content.trim().slice(0, 512) : '';
      if (!reply) return json(res, 502, { error: 'The model returned no text. Try another installed model.' });
      json(res, 200, { reply });
    } finally {
      res.off('close', close);
      testing = false;
    }
  }

  return { name: 'revyme-local-ai', configureServer: register, configurePreviewServer: register };
}
