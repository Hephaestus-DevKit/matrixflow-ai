import http from 'node:http';
import { once } from 'node:events';

export const origin = 'http://127.0.0.1:3100';
export const appwrite = 'http://127.0.0.1:3102';
export async function serveFixture() {
  const init = [];
  let route;
  const api = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers':
        req.headers['access-control-request-headers'] ?? 'content-type',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }
    if (!route) {
      res.writeHead(req.method === 'OPTIONS' ? 204 : 401, headers);
      res.end();
      return;
    }
    const request = {
      url: () => appwrite + req.url,
      method: () => req.method,
      headers: () => req.headers,
      postData: () => body,
      postDataJSON: () => JSON.parse(body),
    };
    try {
      await route({
        request: () => request,
        fulfill: async (reply) => {
          res.writeHead(reply.status ?? 200, {
            ...headers,
            'content-type': reply.contentType ?? 'application/json',
            ...reply.headers,
          });
          res.end(reply.body);
        },
      });
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, headers);
      res.end(String(error));
    }
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/__safari_boot') {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><title>Safari fixture</title>');
      return;
    }
    if (req.url === '/__safari_init.js') {
      res.setHeader('content-type', 'application/javascript');
      res.end(
        "window.safariErrors=[];addEventListener('error',e=>{if(e.message)safariErrors.push(e.message)});addEventListener('unhandledrejection',e=>safariErrors.push(String(e.reason)));\n" +
          init.map((fn) => '(' + fn.toString() + ')()').join(';\n'),
      );
      return;
    }
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: 3101,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, 'accept-encoding': 'identity' },
      },
      async (reply) => {
        const headers = { ...reply.headers };
        if (!(headers['content-type'] ?? '').startsWith('text/html')) {
          res.writeHead(reply.statusCode, headers);
          reply.pipe(res);
          return;
        }
        const body = [];
        for await (const chunk of reply) body.push(chunk);
        const html = Buffer.concat(body)
          .toString()
          .replace('<head>', '<head><script src="/__safari_init.js"></script>');
        delete headers['content-length'];
        res.writeHead(reply.statusCode, headers);
        res.end(html);
      },
    );
    upstream.on('error', (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(upstream);
  });
  server.on('upgrade', (req, socket, head) => {
    const conn = http.request({
      hostname: '127.0.0.1',
      port: 3101,
      path: req.url,
      headers: req.headers,
    });
    conn.on('upgrade', (response, remote, extra) => {
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          Object.entries(response.headers)
            .map(([k, v]) => k + ': ' + v)
            .join('\r\n') +
          '\r\n\r\n',
      );
      if (head.length) remote.write(head);
      if (extra.length) socket.write(extra);
      socket.on('error', () => remote.destroy());
      remote.on('error', () => socket.destroy());
      socket.pipe(remote).pipe(socket);
      socket.on('close', () => remote.destroy());
    });
    conn.on('error', () => socket.destroy());
    conn.end();
  });
  try {
    api.listen(3102, '127.0.0.1');
    await once(api, 'listening');
    server.listen(3100, '127.0.0.1');
    await once(server, 'listening');
    return {
      init,
      setRoute: (fn) => {
        route = fn;
      },
      close() {
        server.closeAllConnections();
        api.closeAllConnections();
        server.close();
        api.close();
      },
    };
  } catch (err) {
    server.close();
    api.close();
    throw err;
  }
}
