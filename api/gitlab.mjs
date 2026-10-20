/*
 * api/gitlab.mjs — gitlab.aigov.go.kr API 읽기 전용 중계(Vercel Function, 서울 icn1 리전)
 * -----------------------------------------------------------------------------
 * gitlab.aigov.go.kr는 해외 IP 접속을 차단한다(2026-10-19~). GitHub Actions 러너는 해외에 있으므로
 * collect.mjs가 GITLAB_PROXY 환경변수로 이 함수를 거쳐 GitLab API를 호출한다.
 *
 *   GET /api/gitlab?u=<인코딩된 /api/v4 이하 경로+쿼리>   예) ?u=%2Fprojects%2F123
 *
 * 대상 호스트는 고정이며 GET만 중계한다(임의 URL 중계 불가). PRIVATE-TOKEN 헤더는 그대로 전달한다.
 */

const UPSTREAM = "https://gitlab.aigov.go.kr/api/v4";
const PASS_HEADERS = ["content-type", "retry-after", "x-total", "x-total-pages", "x-next-page"];

export async function GET(request) {
  const u = new URL(request.url).searchParams.get("u") || "";
  if (!u.startsWith("/") || u.startsWith("//")) {
    return new Response("u 파라미터는 /로 시작하는 GitLab API 경로여야 합니다", { status: 400 });
  }
  const headers = { "User-Agent": "ax-contest-collector" };
  const token = request.headers.get("private-token");
  if (token) headers["PRIVATE-TOKEN"] = token;

  let res;
  try {
    res = await fetch(UPSTREAM + u, { headers, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    return new Response(`upstream 연결 실패: ${e.cause?.code || e.message}`, { status: 502 });
  }
  const out = new Headers({ "Cache-Control": "no-store" });
  for (const h of PASS_HEADERS) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(await res.arrayBuffer(), { status: res.status, headers: out });
}
