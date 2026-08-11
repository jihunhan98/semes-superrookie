// 의존성 없는 최소 정적 파일 서버. Next.js 정적 export(out/) 폴더를 서빙한다.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "out");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (p === "/") p = "/login"; // 시작점

  const candidates = [
    path.join(ROOT, p),
    path.join(ROOT, `${p}.html`),
    path.join(ROOT, p, "index.html"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { filePath: candidate, status: 200 };
    }
  }
  return { filePath: path.join(ROOT, "404.html"), status: 404 };
}

http
  .createServer((req, res) => {
    const { filePath, status } = resolveFile(req.url || "/");
    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }
      res.writeHead(status, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`reqops-frontend: http://localhost:${PORT}/login`);
  });
