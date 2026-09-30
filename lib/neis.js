// 나이스 시간표·급식 조회 (로컬 server.js와 Vercel api/week.js가 함께 쓴다)
// 나이스 인증키는 환경변수 NEIS_KEY에서만 읽고, 브라우저로는 보내지 않는다.
const SCHOOL = {
  ATPT_OFCDC_SC_CODE: 'B10',   // 서울특별시교육청
  SD_SCHUL_CODE: '7134122',    // 광남중학교
};
const GRADE = '1';
const CLASS_NM = '13';

async function neis(service, params) {
  const key = process.env.NEIS_KEY;
  if (!key) throw new Error('NEIS_KEY 환경변수가 없습니다.');

  const url = new URL(`https://open.neis.go.kr/hub/${service}`);
  const query = { KEY: key, Type: 'json', pIndex: '1', pSize: '1000', ...SCHOOL, ...params };
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

const isYmd = s => /^\d{8}$/.test(s || '');

// { status, body } 형태로 돌려준다.
async function getWeek(from, to) {
  if (!isYmd(from) || !isYmd(to)) {
    return { status: 400, body: { error: 'from, to는 YYYYMMDD 형식이어야 합니다.' } };
  }
  try {
    const [timetable, meals] = await Promise.all([getTimetable(from, to), getMeals(from, to)]);
    return { status: 200, body: { timetable, meals } };
  } catch (err) {
    return { status: 502, body: { error: err.message } };
  }
}

module.exports = { getWeek };
