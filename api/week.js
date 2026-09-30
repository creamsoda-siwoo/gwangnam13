// Vercel 서버 함수: /api/week?from=YYYYMMDD&to=YYYYMMDD
// 나이스 키는 Vercel 프로젝트 환경변수 NEIS_KEY에 넣어 둔다.
const { getWeek } = require('../lib/neis');

module.exports = async (req, res) => {
  const { status, body } = await getWeek(req.query.from, req.query.to);
  res.status(status).setHeader('Cache-Control', 'no-cache').json(body);
};
