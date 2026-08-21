#!/usr/bin/env node
/*
 * collect.mjs — KISA AX 공모전 대시보드 데이터 수집기
 * -----------------------------------------------------------------------------
 * gitlab.aigov.go.kr 공개 REST API를 읽어 index.html이 렌더링하는 data.json을 만든다.
 * 의존성 없음(Node 18+ 내장 fetch). 인터넷망(GitHub Actions·Vercel 등)에서 그대로 실행된다.
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
import { fileURLToPath } from "node:url";

/* ============================ 사무국 설정 ============================ */
const GITLAB_BASE = "https://gitlab.aigov.go.kr/api/v4";

/* 과제 저장소 지정
 *  - GROUP_PATH 를 채우면 해당 그룹(하위 그룹 포함)의 저장소를 자동 발견한다(권장).
 *  - 비워두면 PROJECT_REPOS 에 나열한 저장소 경로만 집계한다.
 * 참가팀 저장소가 개설되면 아래 목록(또는 GROUP_PATH)만 갱신하면 된다. */
const GROUP_PATH = "";                       // 예: "ax-contest"
const PROJECT_REPOS = ["jikim/rack"];        // 예: ["team1/proj", "team2/proj", ...]

const CONTEST = {
  title: "KISA AX 앰버서더 공모전 진행 현황",
  subtitle: "AI 활용 혁신PoC 트랙 · 10개 과제 · 3개월",
  kickoff: "2026-08-24",
  finale: "2026-11-25",
  activeDays: 14,
  refreshNote: "매일 09:00 자동 갱신",
  collectSince: "2026-08-01",
  notice: { label: "다음 일정", text: "참가자 선정 발표" },
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
  resources: [
    { label: "공모전 운영계획(안)", url: "#" },
    { label: "AI 도구 보안 이용 가이드", url: "#" },
    { label: "인공지능 윤리 가이드", url: "#" },
    { label: "AI 강의자료 모음", url: "#" },
    { label: "참가자 오픈채팅방", url: "#" },
  ],
  footnote: "KISA 경영기획본부 ESG성과단 · gitlab.aigov.go.kr 저장소 기준 매일 1회 자동 집계",
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
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const e = new Error(`GitLab ${res.status} ${res.statusText} @ ${url}`);
        e.status = res.status;
        if (res.status === 404 || res.status === 403) throw e; // 재시도 무의미
        lastErr = e;
      } else {
        return raw ? res : res.json();
      }
    } catch (e) {
      if (e.status === 404 || e.status === 403) throw e;
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
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
function bucketIndex(dateIso, kickoffMs) {
  let idx = Math.floor((new Date(dateIso).getTime() - kickoffMs) / WEEK);
  if (idx < 0) idx = 0;
  if (idx > CONTEST.totalWeeks - 1) idx = CONTEST.totalWeeks - 1;
  return idx;
}

async function collectRepo(repoPath) {
  const p = await gl(`/projects/${enc(repoPath)}`);
  const { field, description } = parseDesc(p.description);
  const team = await resolveTeam(p.namespace);
  const branch = p.default_branch || "main";
  const kickoffMs = new Date(CONTEST.kickoff + "T00:00:00+09:00").getTime();
  const sinceIso = new Date(CONTEST.collectSince + "T00:00:00+09:00").toISOString();

  // 커밋
  const commits = await glAll(
    `/projects/${p.id}/repository/commits?since=${enc(sinceIso)}&ref_name=${enc(branch)}`,
  );
  const weekly = weekBuckets();
  for (const c of commits) weekly[bucketIndex(c.created_at, kickoffMs)]++;
  const recentCommits = commits.slice(0, 3).map((c) => ({
    title: c.title, date: c.created_at, url: c.web_url,
  }));

  // 이슈
  let issues = [];
  try {
    issues = await glAll(`/projects/${p.id}/issues?scope=all&order_by=updated_at&sort=desc`);
  } catch { /* 이슈 비활성 저장소 */ }
  const openIssues = issues.filter((i) => i.state === "opened").length;
  const closedIssues = issues.filter((i) => i.state === "closed").length;
  const recentIssues = issues.slice(0, 5).map((i) => ({
    title: i.title,
    date: i.updated_at || i.created_at,
    state: i.state === "closed" ? "closed" : "opened",
    url: i.web_url,
  }));

  // 팀 자기보고(선택): 저장소 루트 dashboard.json
  let progress = null;
  let updates = [];
  try {
    const res = await gl(
      `/projects/${p.id}/repository/files/${enc("dashboard.json")}/raw?ref=${enc(branch)}`,
      { raw: true },
    );
    const rep = await res.json();
    if (rep && typeof rep === "object") {
      if (typeof rep.progress === "number") progress = rep.progress;
      if (Array.isArray(rep.updates)) {
        updates = rep.updates
          .filter((u) => u && u.date && u.note)
          .map((u) => ({ date: String(u.date), note: String(u.note) }));
      }
    }
  } catch { /* 없으면 무시 */ }

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
    active,
    progress,
    updates,
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

async function discoverRepos() {
  if (GROUP_PATH) {
    const projs = await glAll(
      `/groups/${enc(GROUP_PATH)}/projects?include_subgroups=true&archived=false&order_by=path&sort=asc`,
    );
    return projs.map((p) => p.path_with_namespace);
  }
  return PROJECT_REPOS.slice();
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
      active: true, progress: prog,
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
  return { generatedAt: now, sample: true, contest: CONTEST, weeklyCommits, projects, showcase: SHOWCASE };
}

/* 전체 수집: 대상 저장소를 병렬로 모아 data.json 객체를 반환한다.
 * 파일을 쓰지 않으므로 CLI(collect.mjs)와 Vercel 서버리스 함수(api/data.mjs)가 함께 재사용한다. */
export async function collectAll() {
  const repos = await discoverRepos();
  console.log(`대상 저장소 ${repos.length}개: ${repos.join(", ") || "(없음)"}`);
  const settled = await Promise.all(
    repos.map(async (r) => {
      try {
        return { ok: true, r, project: await collectRepo(r) };
      } catch (e) {
        return { ok: false, r, error: e.message };
      }
    }),
  );
  const projects = [];
  const errors = [];
  for (const s of settled) {
    if (s.ok) projects.push(s.project);
    else {
      errors.push(`${s.r}: ${s.error}`);
      console.error("WARN", s.r, s.error);
    }
  }
  if (projects.length === 0 && repos.length > 0) {
    throw new Error("수집된 과제가 없습니다 — " + errors.join(" | "));
  }
  const weeklyCommits = weekBuckets();
  for (const p of projects) p.gitlab.weeklyCommits.forEach((v, i) => (weeklyCommits[i] += v));
  if (errors.length) console.error(`(경고 ${errors.length}건) ` + errors.join(" | "));
  return {
    generatedAt: new Date().toISOString(),
    contest: CONTEST,
    weeklyCommits,
    projects,
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

// 직접 실행(CLI)일 때만 main()을 돈다. import(서버리스 함수)될 때는 실행하지 않는다.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((e) => {
    console.error("FATAL", e && e.stack ? e.stack : e);
    process.exit(1);
  });
}

export { CONTEST, collectRepo };
