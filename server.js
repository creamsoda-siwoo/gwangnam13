// 광남중학교 1학년 13반 시간표·급식 조회 서버
// 나이스 인증키는 .env의 NEIS_KEY에서만 읽고, 브라우저로는 보내지 않는다.
const http = require('http');
const fs = require('fs');
const path = require('path');

process.loadEnvFile(path.join(__dirname, '.env'));
if (!process.env.NEIS_KEY) {
  console.error('.env에 NEIS_KEY가 없습니다.');
  process.exit(1);
}

const { getWeek } = require('./lib/neis');

const PORT = 3000;

// 브라우저에 보내도 되는 파일만 여기 적는다. (.env 등은 절대 넣지 않기)
const STATIC = {
  '/index.html': { path: 'index.html', type: 'text/html; charset=utf-8' },
  '/manifest.webmanifest': { path: 'manifest.webmanifest', type: 'application/manifest+json' },
  '/sw.js': { path: 'sw.js', type: 'text/javascript; charset=utf-8' },
  '/icons/icon-192.png': { path: 'icons/icon-192.png', type: 'image/png' },
  '/icons/icon-512.png': { path: 'icons/icon-512.png', type: 'image/png' },
  '/icons/apple-touch-icon.png': { path: 'icons/apple-touch-icon.png', type: 'image/png' },
  '/icons/favicon.png': { path: 'icons/favicon.png', type: 'image/png' },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/week') {
    const { status, body } = await getWeek(url.searchParams.get('from'), url.searchParams.get('to'));
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
    return;
  }

  const file = STATIC[url.pathname === '/' ? '/index.html' : url.pathname];
  if (file) {
    res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-cache' });
    return fs.createReadStream(path.join(__dirname, file.path)).pipe(res);
  }

  res.writeHead(404);
  res.end();
});

server.on('error', err => {
  // 이미 서버가 켜져 있으면 두 번째 실행은 조용히 종료한다.
  if (err.code === 'EADDRINUSE') {
    console.log(`이미 http://localhost:${PORT} 에서 실행 중입니다.`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`광남중 1-13 시간표·급식: http://localhost:${PORT}`);
});
