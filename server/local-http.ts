import type { IncomingMessage, ServerResponse } from 'node:http';

export function sendLocalJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

export function isLocalEditorRequest(req: IncomingMessage): boolean {
  const host = req.headers.host;
  const peer = req.socket.remoteAddress;
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) return false;
  if (peer !== '127.0.0.1' && peer !== '::1' && peer !== '::ffff:127.0.0.1') return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (req.method === 'POST' && !origin) return false;
  return !origin || origin === 'http://' + host || origin === 'https://' + host;
}
