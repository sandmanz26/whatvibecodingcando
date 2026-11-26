import http from 'http'; import fs from 'fs'; import path from 'path'
const root = new URL('../../../../dist', import.meta.url).pathname
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm' }
http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname)
  if (p === '/app' || p === '/app/') p = '/app.html'
  if (p === '/') p = '/index.html'
  // The test site's page on this origin too (same browser storage as the demo panel): /layout-test.html
  if (p === '/layout-test.html') { return site(q, r) }
  const f = path.join(root, p)
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); r.end(b) } })
}).listen(8080)
function site(q, r) {
  const pid = (() => { try { return fs.readFileSync(new URL('pid', import.meta.url).pathname, 'utf8') } catch { return 'local' } })().trim()
  r.writeHead(200, { 'content-type': 'text/html' })
  // ?v=2: the same page redesigned (another layout), for the layout-split test. Both have a field with a
  // value, an email in the text and a private block, for the snapshot masking test.
  if (new URL(q.url, 'http://x').searchParams.get('v') === '2') {
    r.end(`<!doctype html><html><body style="margin:0;font-family:sans-serif;background:#fef9c3"><main><aside><form><input id="q" value="hidden-value-123"><input value="x"></form></aside><article><h1>Mint shop, new look</h1><h3>A</h3><h3>B</h3><h3>C</h3><picture></picture><button id="buy" role="tab" style="margin:40px;padding:30px">Buy now</button><button role="tab">More</button></article></main><div data-private>Private: Jane</div><div style="height:1200px"></div><script src="http://localhost:8080/embed/vibe.js" data-project="${pid}"></script></body></html>`)
    return
  }
  r.end(`<!doctype html><html><body style="margin:0;font-family:sans-serif"><input id="email" value="secret-typed@example.com"><p>Write to owner@mint.example</p><div data-private>Private: Jane</div><h1>Mint shop</h1><p>Hello</p><button id="buy" style="margin:40px;padding:20px">Buy now</button><a href="#x" id="about" style="margin:40px">About</a><div style="height:1200px"></div><script src="http://localhost:8080/embed/vibe.js" data-project="${pid}"></script></body></html>`)
}
http.createServer(site).listen(3000)
