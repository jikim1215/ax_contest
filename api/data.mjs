// Vercel 서버리스 함수 — /data.json 요청을 실시간 수집 결과로 응답한다.
// vercel.json 의 rewrite 로 /data.json → /api/data 로 연결된다.
// s-maxage=86400 으로 Vercel 엣지가 하루 캐시(+백그라운드 재검증)하므로,
// 별도 크론/토큰 없이 매일 자동 갱신되는 효과를 얻는다. GitLab 공개 API라 시크릿도 불필요.
import { collectAll } from "../collect.mjs";

export default async function handler(req, res) {
  try {
    const data = await collectAll();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    // 엣지 24시간 캐시 + stale-while-revalidate: 만료 후 첫 요청엔 캐시를 주고 백그라운드로 갱신
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
