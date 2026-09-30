// 광남중학교 1학년 13반 시간표·급식 조회 서버
// 나이스 인증키는 .env의 NEIS_KEY에서만 읽고, 브라우저로는 보내지 않는다.
const http = require('http');
const fs = require('fs');
const path = require('path');

process.loadEnvFile(path.join(__dirname, '.env'));
const NEIS_KEY = process.env.NEIS_KEY;
if (!NEIS_KEY) {
  console.error('.env에 NEIS_KEY가 없습니다.');
  process.exit(1);
}

const PORT = 3000;
const SCHOOL = {
  ATPT_OFCDC_SC_CODE: 'B10',   // 서울특별시교육청
  SD_SCHUL_CODE: '7134122',    // 광남중학교
};
const GRADE = '1';
const CLASS_NM = '13';

async function neis(service, params) {
  const url = new URL(`https://open.neis.go.kr/hub/${service}`);
  const query = { KEY: NEIS_KEY, Type: 'json', pIndex: '1', pSize: '1000', ...SCHOOL, ...params };
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const res = await fetch(url);
  const data = await res.json();
  // 결과가 없으면 나이스는 { RESULT: { CODE: 'INFO-200' } } 형태로 응답한다.
  if (!data[service]) {
    if (data.RESULT?.CODE === 'INFO-200') return [];
    throw new Error(data.RESULT?.MESSAGE || '나이스 응답 오류');
  }
  return data[service][1].row;
}

async function getTimetable(from, to) {
  const rows = await neis('misTimetable', {
    GRADE, CLASS_NM, TI_FROM_YMD: from, TI_TO_YMD: to,
  });
  return rows.map(r => ({ date: r.ALL_TI_YMD, period: Number(r.PERIO), subject: r.ITRT_CNTNT }));
}

async function getMeals(from, to) {
  const rows = await neis('mealServiceDietInfo', { MLSV_FROM_YMD: from, MLSV_TO_YMD: to });
  return rows.map(r => ({
    date: r.MLSV_YMD,
    type: r.MMEAL_SC_NM,
    // "토마토스파게티 (1.2.5.6)" → 메뉴 이름과 알레르기 번호를 분리
    dishes: r.DDISH_NM.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(.*?)\s*\(([\d.\s]+)\)\s*$/);
      return m ? { name: m[1], allergy: m[2].split('.').filter(Boolean) } : { name: s, allergy: [] };
    }),
    calories: r.CAL_INFO,
  }));
}

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

const isYmd = s => /^\d{8}$/.test(s || '');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/week') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!isYmd(from) || !isYmd(to)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'from, to는 YYYYMMDD 형식이어야 합니다.' }));
    }
    try {
      const [timetable, meals] = await Promise.all([getTimetable(from, to), getMeals(from, to)]);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ timetable, meals }));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
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
