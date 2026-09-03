const fs = require("fs/promises");
const path = require("path");
const http = require("http");
const { URL } = require("url");
const { createApiRouter } = require("./backend/api-router");
const { createMemorySessionStore } = require("./backend/session-store");
const { createBackendProviderFromEnv } = require("./backend/providers");

const PORT = Number(process.env.PORT || 3010);
const rendererDir = path.join(__dirname, "renderer");
const rendererRoot = path.resolve(rendererDir);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function send(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(body);
}

function resolveStaticPath(requestPath) {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const resolved = path.resolve(rendererRoot, normalized.replace(/^\/+/, ""));
  const relative = path.relative(rendererRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

async function serveStaticFile(requestPath, response) {
  const resolved = resolveStaticPath(requestPath);
  if (!resolved) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const buffer = await fs.readFile(resolved);
    const extension = path.extname(resolved).toLowerCase();
    send(response, 200, buffer, MIME_TYPES[extension] || "application/octet-stream");
  } catch (error) {
    if (error.code === "ENOENT") {
      send(response, 404, "Not Found");
      return;
    }
    throw error;
  }
}

function createRequestHandler(options = {}) {
  const provider = options.provider || createBackendProviderFromEnv(options.env || process.env, {
    fetchImpl: options.fetchImpl
  });
  const env = options.env || process.env;
  if (!options.sessionStore && String(env.NODE_ENV || "").toLowerCase() === "production") {
    throw new Error("Production backend requires a persistent sessionStore");
  }
  const sessionStore = options.sessionStore || createMemorySessionStore();
  const secureCookies = options.secureCookies !== undefined
    ? Boolean(options.secureCookies)
    : String(env.NODE_ENV || "").toLowerCase() === "production";
  const apiRouter = createApiRouter({ provider, sessionStore, secureCookies });

  return async function handleRequest(request, response) {
    try {
      const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
      if (await apiRouter.handle(request, response, url)) {
        return;
      }
      await serveStaticFile(url.pathname, response);
    } catch (error) {
      console.error(error);
      send(response, 500, JSON.stringify({ error: "Server error" }), "application/json; charset=utf-8");
    }
  };
}

function startServer(port = PORT, options = {}) {
  const handler = createRequestHandler(options);
  const server = http.createServer((request, response) => {
    handler(request, response);
  });
  server.listen(port, () => {
    if (options.log === false) return;
    const address = server.address();
    const actualPort = address && typeof address === "object" ? address.port : port;
    console.log(`web server running at http://127.0.0.1:${actualPort}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createRequestHandler,
  resolveStaticPath,
  startServer
};
