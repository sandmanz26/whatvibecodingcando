import http from 'http'; import fs from 'fs'; import path from 'path'
const root = new URL('../../../../dist', import.meta.url).pathname
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm' }
http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname)
  if (p === '/app' || p === '/app/') p = '/app.html'
  if (p === '/') p = '/index.html'
  const f = path.join(root, p)
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(b) } })
}).listen(8080)
http.createServer((q, r) => {
  const pid = (() => { try { return fs.readFileSync(new URL('pid', import.meta.url).pathname, 'utf8') } catch { return 'local' } })().trim()
  r.writeHead(200, { 'content-type': 'text/html' })
  r.end(`<!doctype html><html><body style="margin:0;font-family:sans-serif"><h1>Mint shop</h1><p>Hello</p><button id="buy" style="margin:40px;padding:20px">Buy now</button><a href="#x" id="about" style="margin:40px">About</a><div style="height:1200px"></div><script src="http://localhost:8080/embed/vibe.js" data-project="${pid}"></script></body></html>`)
}).listen(3000)
