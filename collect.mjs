#!/usr/bin/env node
/*
 * collect.mjs — KISA AX 공모전 대시보드 데이터 수집기
 * -----------------------------------------------------------------------------
 * gitlab.aigov.go.kr 공개 REST API를 읽어 index.html이 렌더링하는 data.json을 만든다.
 * 의존성 없음(Node 18+ 내장 fetch). GitHub Actions(.github/workflows/sync.yml)가 매일 09:00·15:00(KST)에
 * 실행해 main 브랜치에 커밋하고, GitHub Pages·Vercel이 그 커밋을 자동 배포한다.
 *
 * 사용법
 *   node collect.mjs                 실제 수집 → data.json
 *   node collect.mjs --sample        예시 데이터 생성(저장소 개설 전 데모)
 *   node collect.mjs --test <repo>   단일 저장소 연결 점검(콘솔 출력, 파일 미생성)
 *
 * 환경변수
 *   GITLAB_TOKEN  비공개 저장소를 집계할 때만 필요한 read_api 토큰. 공개 저장소면 불필요.
 *   DATA_OUT      data.json 출력 경로. 기본값 ./data.json.
 */

import { writeFileSync } from "node:fs";

/* ============================ 사무국 설정 ============================ */
const GITLAB_BASE = "https://gitlab.aigov.go.kr/api/v4";

/* 과제 저장소 지정
 *  - GROUP_PATH 를 채우면 해당 그룹(하위 그룹 포함)의 저장소를 자동 발견한다(권장).
 *  - 비워두면 PROJECT_REPOS 에 나열한 저장소 경로만 집계한다.
 * 참가팀 저장소가 개설되면 아래 목록(또는 GROUP_PATH)만 갱신하면 된다. */
const GROUP_PATH = "";                       // 예: "ax-contest"
const PROJECT_REPOS = [                      // 예: ["team1/proj", "team2/proj", ...]
  "lmj6706/pr_kisa",
  "118/118ai-agent",
  "KISA_thkim/kisa_workmate",
  "adms25/local-handover-ai",
  "sign-kids/kimart",
  "skynet_b/complaint-radar",
  "j30231/isds_check",
  "jh.noh/privacy",
  "dfdfhdfg1/doc_grading",
  "kdw3479/quiz-lock"
];
/* 참가 과제가 아닌 참고용 저장소(사무국 예시 등). GROUP_PATH 사용 여부와 무관하게 항상 수집한다.
 * 카드에 '참고' 표시가 붙고 과제 수·커밋·이슈·차트·최근활동 집계에서는 제외된다. */
const REFERENCE_REPOS = [
  "jikim/rack",
];

const CONTEST = {
  title: "KISA AX 앰버서더 공모전 진행 현황",
  subtitle: "AI 활용 혁신PoC 트랙 · 11개 과제 · 3개월",
  kickoff: "2026-08-24",
  finale: "2026-11-25",
  activeDays: 14,
  refreshNote: "매일 09:00·15:00 갱신",
  /* 이 날짜 이후 커밋을 누적 커밋에 포함한다. 킥오프 이전 커밋은 누적에는 들어가되 주차별 차트에서는 제외된다. */
  collectSince: "2026-08-01",
  /* 공지(다음 일정) 문구는 index.html이 milestones + 오늘 날짜로 계산한다. 별도 설정 불필요. */
  milestones: [
    { date: "2026-08-24", end: "2026-09-04", label: "AX 공모전 접수" },
    { date: "2026-09-10", label: "참가자 선정 발표" },
    { date: "2026-09-15", label: "멘토링 1차" },
    { date: "2026-09-28", label: "멘토링 2차" },
    { date: "2026-10-14", label: "멘토링 3차" },
    { date: "2026-10-28", label: "멘토링 4차" },
    { date: "2026-11-20", label: "산출물 제출" },
    { date: "2026-11-25", label: "최종발표" },
  ],
  /* index.html이 label로 찾는다: /운영계획/ → 운영계획 원문 링크, /오픈채팅|채팅/ → 오픈채팅방 입장 버튼. "#"이면 비활성. */
  resources: [
    { label: "공모전 운영계획(안)", url: "#" },
    { label: "참가자 오픈채팅방", url: "https://open.kakao.com/o/gEgM4vNi" },
  ],
  footnote: "KISA 경영기획본부 ESG성과단 · gitlab.aigov.go.kr 저장소 기준 매일 2회(09:00·15:00) 집계",
  totalWeeks: 14,
};

/* 시연 가능한 PoC 목록. 비어 있으면 대시보드에서 쇼케이스 패널이 숨겨진다. */
const SHOWCASE = []; // { name, team, desc, url }

/* ============================ 내부 구현 ============================ */
const TOKEN = process.env.GITLAB_TOKEN || "";
const OUT = process.env.DATA_OUT || "./data.json";
const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;
const enc = encodeURIComponent;

async function gl(path, { raw = false, tries = 3 } = {}) {
  const url = path.startsWith("http") ? path : GITLAB_BASE + path;
  const headers = { "User-Agent": "ax-contest-collector" };
  if (TOKEN) headers["PRIVATE-TOKEN"] = TOKEN;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    let waitMs = 400 * (i + 1);
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return raw ? res : res.json();
      const e = new Error(`GitLab ${res.status} ${res.statusText} @ ${url}`);
      e.status = res.status;
      // 429(요청 제한)와 5xx만 재시도. 그 외 4xx(401/403/404/422 등)는 재시도해도 결과가 같다.
      if (res.status < 500 && res.status !== 429) throw e;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (res.status === 429 && retryAfter > 0) waitMs = retryAfter * 1000;
      lastErr = e;
    } catch (e) {
      if (e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw lastErr;
}

async function glAll(path) {
  const sep = path.includes("?") ? "&" : "?";
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const rows = await gl(`${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

const teamCache = new Map();
async function resolveTeam(ns) {
  if (!ns) return "";
  if (ns.kind === "group") return ns.name || ns.full_path || ns.path;
  const key = ns.path;
  if (teamCache.has(key)) return teamCache.get(key);
  let name = ns.name || ns.path;
  try {
    const users = await gl(`/users?username=${enc(ns.path)}`);
    if (Array.isArray(users) && users[0] && users[0].name) name = users[0].name;
  } catch { /* 이름 조회 실패 시 네임스페이스 표기 사용 */ }
  teamCache.set(key, name);
  return name;
}

/* 설명 형식: "[분야] 한 줄 소개" 또는 "[분야], [세부] 한 줄 소개"
 * → 첫 대괄호를 분야로 뽑고, 그 접두부만 제거한 나머지를 설명으로 쓴다. */
function parseDesc(descRaw) {
  const d = (descRaw || "").trim();
  const m = d.match(/^\[([^\]]+)\]\s*,?\s*/);
  if (m) return { field: m[1].trim() || "미분류", description: d.slice(m[0].length).trim() };
  return { field: "미분류", description: d };
}

function weekBuckets() {
  return new Array(CONTEST.totalWeeks).fill(0);
}
/* 킥오프 기준 주차 인덱스(0부터). 대회 기간 밖(킥오프 이전·totalWeeks 이후)은 -1. */
function bucketIndex(dateIso, kickoffMs) {
  const idx = Math.floor((new Date(dateIso).getTime() - kickoffMs) / WEEK);
  return idx >= 0 && idx < CONTEST.totalWeeks ? idx : -1;
}

/* 팀 자기보고 dashboard.json 정규화: progress는 0~100 정수, updates는 날짜 내림차순. */
function normalizeReport(rep) {
  let progress = null;
  let updates = [];
  if (!rep || typeof rep !== "object") return { progress, updates };
  const n = Number(rep.progress);
  if (rep.progress !== null && rep.progress !== "" && Number.isFinite(n)) {
    progress = Math.min(100, Math.max(0, Math.round(n)));
  }
  if (Array.isArray(rep.updates)) {
    updates = rep.updates
      .filter((u) => u && u.date && u.note && !Number.isNaN(Date.parse(u.date)))
      .map((u) => ({ date: String(u.date), note: String(u.note) }))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }
  return { progress, updates };
}

async function collectRepo(repoPath, { reference = false, warnings = [] } = {}) {
  const p = await gl(`/projects/${enc(repoPath)}`);
  const { field, description } = parseDesc(p.description);
  const team = await resolveTeam(p.namespace);
  const branch = p.default_branch || "main";
  const kickoffMs = new Date(CONTEST.kickoff + "T00:00:00+09:00").getTime();
  const sinceIso = new Date(CONTEST.collectSince + "T00:00:00+09:00").toISOString();

  // 커밋 — 조회 실패(빈 저장소·일시 장애)해도 과제 자체는 남기고 0건으로 둔다.
  let commits = [];
  try {
    commits = await glAll(
      `/projects/${p.id}/repository/commits?since=${enc(sinceIso)}&ref_name=${enc(branch)}`,
    );
  } catch (e) {
    warnings.push(`${repoPath}: 커밋 조회 실패 (${e.message})`);
  }
  const weekly = weekBuckets();
  for (const c of commits) {
    const idx = bucketIndex(c.created_at, kickoffMs);
    if (idx >= 0) weekly[idx]++;
  }
  const recentCommits = commits.slice(0, 3).map((c) => ({
    title: c.title, date: c.created_at, url: c.web_url,
  }));

  // 이슈
  let issues = [];
  try {
    issues = await glAll(`/projects/${p.id}/issues?scope=all&order_by=updated_at&sort=desc`);
  } catch (e) {
    warnings.push(`${repoPath}: 이슈 조회 실패 (${e.message})`);
  }
  const openIssues = issues.filter((i) => i.state === "opened").length;
  const closedIssues = issues.filter((i) => i.state === "closed").length;
  const recentIssues = issues.slice(0, 5).map((i) => ({
    title: i.title,
    date: i.updated_at || i.created_at,
    state: i.state === "closed" ? "closed" : "opened",
    url: i.web_url,
  }));

  // 팀 자기보고(선택): 저장소 루트 dashboard.json
  let report = { progress: null, updates: [] };
  try {
    const res = await gl(
      `/projects/${p.id}/repository/files/${enc("dashboard.json")}/raw?ref=${enc(branch)}`,
      { raw: true },
    );
    report = normalizeReport(await res.json());
  } catch (e) {
    if (e.status !== 404) warnings.push(`${repoPath}: dashboard.json 읽기 실패 (${e.message})`);
  }

  const lastActivity = p.last_activity_at || null;
  const active = lastActivity
    ? Date.now() - new Date(lastActivity).getTime() <= CONTEST.activeDays * DAY
    : false;

  return {
    repo: p.path_with_namespace,
    name: p.name,
    team,
    field,
    description,
    webUrl: p.web_url,
    reference,
    active,
    progress: report.progress,
    updates: report.updates,
    gitlab: {
      commits: commits.length,
      weeklyCommits: weekly,
      openIssues,
      closedIssues,
      stars: p.star_count || 0,
      lastActivity,
    },
    recentCommits,
    recentIssues,
  };
}

/* 수집 대상 목록: [{ repo, reference }]. 참고 저장소는 참가 목록과 겹치면 참가 쪽을 우선한다. */
async function discoverRepos() {
  let repos = PROJECT_REPOS.slice();
  if (GROUP_PATH) {
    const projs = await glAll(
      `/groups/${enc(GROUP_PATH)}/projects?include_subgroups=true&archived=false&order_by=path&sort=asc`,
    );
    repos = projs.map((p) => p.path_with_namespace);
  }
  const seen = new Set(repos);
  const list = repos.map((repo) => ({ repo, reference: false }));
  for (const repo of REFERENCE_REPOS) {
    if (!seen.has(repo)) list.push({ repo, reference: true });
  }
  return list;
}

function writeOut(data) {
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
  const flag = data.sample ? " (예시)" : "";
  console.log(`data.json 생성${flag}: ${data.projects.length}개 과제 · ${OUT}`);
}

function buildSample() {
  const now = new Date().toISOString();
  const mk = (repo, name, team, field, desc, commits, prog, open, closed, stars) => {
    const weekly = weekBuckets();
    weekly[0] = commits;
    return {
      repo, name, team, field, description: desc,
      webUrl: `https://gitlab.aigov.go.kr/${repo}`,
      reference: false, active: true, progress: prog,
      updates: prog != null ? [{ date: CONTEST.kickoff, note: "착수 준비 완료" }] : [],
      gitlab: { commits, weeklyCommits: weekly, openIssues: open, closedIssues: closed, stars, lastActivity: now },
      recentCommits: [{ title: "초기 저장소 구성", date: now, url: `https://gitlab.aigov.go.kr/${repo}` }],
      recentIssues: open ? [{ title: "요구사항 정리", date: now, state: "opened", url: `https://gitlab.aigov.go.kr/${repo}/-/issues/1` }] : [],
    };
  };
  const projects = [
    mk("demo/rag-helpdesk", "RAG 헬프데스크", "정보보호팀 데모", "보안업무", "[보안업무] 사내 규정 RAG 챗봇 - 문서 검색·요약", 18, 35, 3, 1, 5),
    mk("demo/doc-classify", "민원 자동 분류", "고객지원팀 데모", "공공행정", "[공공행정] 민원 접수 자동 분류·라우팅", 9, 15, 2, 0, 3),
    mk("demo/report-gen", "보고서 자동 초안", "경영기획 데모", "행정효율화", "[행정효율화] 주간보고 초안 자동 생성", 4, null, 0, 0, 1),
  ];
  const weeklyCommits = weekBuckets();
  for (const p of projects) p.gitlab.weeklyCommits.forEach((v, i) => (weeklyCommits[i] += v));
  return { generatedAt: now, sample: true, contest: CONTEST, weeklyCommits, projects, warnings: [], showcase: SHOWCASE };
}

/* 전체 수집: 대상 저장소를 병렬로 모아 data.json 객체를 반환한다.
 * 저장소 단위 실패는 warnings에 기록하고 나머지는 계속 집계한다(화면 '기준시각' 옆에 경고 건수 표시). */
async function collectAll() {
  const targets = await discoverRepos();
  console.log(`대상 저장소 ${targets.length}개: ${targets.map((t) => t.repo + (t.reference ? "(참고)" : "")).join(", ") || "(없음)"}`);
  const warnings = [];
  const settled = await Promise.all(
    targets.map(async (t) => {
      try {
        return { ok: true, repo: t.repo, project: await collectRepo(t.repo, { reference: t.reference, warnings }) };
      } catch (e) {
        return { ok: false, repo: t.repo, error: e.message };
      }
    }),
  );
  const projects = [];
  for (const s of settled) {
    if (s.ok) projects.push(s.project);
    else warnings.push(`${s.repo}: 수집 실패 (${s.error})`);
  }
  const contestProjects = projects.filter((p) => !p.reference);
  if (contestProjects.length === 0 && targets.some((t) => !t.reference)) {
    throw new Error("수집된 과제가 없습니다 — " + warnings.join(" | "));
  }
  const weeklyCommits = weekBuckets();
  for (const p of contestProjects) p.gitlab.weeklyCommits.forEach((v, i) => (weeklyCommits[i] += v));
  for (const w of warnings) console.error("WARN", w);
  return {
    generatedAt: new Date().toISOString(),
    contest: CONTEST,
    weeklyCommits,
    projects,
    warnings,
    showcase: SHOWCASE,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--sample")) {
    writeOut(buildSample());
    return;
  }

  const testIdx = args.indexOf("--test");
  if (testIdx >= 0) {
    const repo = args[testIdx + 1];
    if (!repo) throw new Error("사용법: node collect.mjs --test <group/project>");
    console.log(JSON.stringify(await collectRepo(repo), null, 2));
    return;
  }

  writeOut(await collectAll());
}

main().catch((e) => {
  console.error("FATAL", e && e.stack ? e.stack : e);
  process.exit(1);
});
