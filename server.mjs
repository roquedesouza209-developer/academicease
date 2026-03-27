import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const rootDir = resolve(".");
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function resolveRequestPath(urlPath) {
  const safePath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath === "/" ? "index.html" : safePath.replace(/^[/\\]/, "");
  const absolutePath = resolve(rootDir, requestedPath);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
    return join(absolutePath, "index.html");
  }

  return absolutePath;
}

createServer((request, response) => {
  const requestedUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const filePath = resolveRequestPath(requestedUrl.pathname);

  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("AcademicEase could not find that file.");
    return;
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
  });

  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`AcademicEase is ready at http://localhost:${port}`);
});
