/* =============================================================================
 * KISA AX 공모전 대시보드 수집기 (v2 — GitLab 원본 기준)
 *
 * 개념: 공모전 10개 과제는 gitlab.aigov.go.kr에 저장소로 존재한다.
 *       과제명·설명·팀은 GitLab 프로젝트 메타데이터가 원본이며, 이 수집기는
 *       그것을 일 2회 읽어 data.json으로 만들고 index.html이 렌더링한다.
 *
 * 과제 식별(둘 중 하나):
 *   - GROUP_PATH: 공모전 그룹 경로를 지정하면 소속 프로젝트 자동 발견(권장)
 *   - PROJECT_REPOS: 저장소 경로(path_with_namespace) 10개를 명시
 *
 * 팀에게 요구하는 GitLab 관례(axboard.aigov.go.kr와 동일):
 *   - 프로젝트 설명(description)을 "[분야] 한 줄 소개" 형식으로 작성
 *   - (선택) 저장소 루트 dashboard.json으로 진척률 자기보고
 *     { "progress": 40, "updates": [ { "date": "2026-08-10", "note": "..." } ] }
 *
 * 실행:
 *   node collect.mjs                → 수집 후 data.json 생성
 *   node collect.mjs --sample       → 예시 데이터로 data.json 생성(데모)
 *   node collect.mjs --test <repo>  → 단일 저장소 수집 결과 출력(연결 점검)
 *
 * 환경변수:
 *   GITLAB_TOKEN  비공개 저장소 접근용 read_api PAT (공개 저장소면 불필요)
 *   DATA_OUT      data.json 출력 경로 (기본 ./data.json, 웹서버 문서경로 지정)
 *
 * 일 2회 스케줄:
 *   [Windows] schtasks /Create /TN "AX대시보드_0900" /TR "node D:\경로\collect.mjs" /SC DAILY /ST 09:00
 *             schtasks /Create /TN "AX대시보드_1500" /TR "node D:\경로\collect.mjs" /SC DAILY /ST 15:00
 *   [Linux]   0 9,15 * * * cd /var/www/ax-dashboard && /usr/bin/node collect.mjs >> collect.log 2>&1
 * ========================================================================== */

import { writeFileSync } from "node:fs";

/* ---------------------- 사무국 설정 영역 ---------------------- */
const GITLAB_URL = "https://gitlab.aigov.go.kr";

/* 공모전 그룹 경로. 지정하면 소속 프로젝트를 자동 발견한다(하위그룹 포함). */
const GROUP_PATH = ""; // 예: "kisa-ax"

/* 그룹을 쓰지 않을 때 저장소 경로 10개를 명시 (path_with_namespace). */
const PROJECT_REPOS = [
  "jikim/rack",
  // TODO(사무국): 나머지 참가 과제의 실제 저장소 경로(path_with_namespace)를 아래에 추가하면 자동 수집됩니다.
  //   예: "someuser/project", "team-a/poc-repo", ...
  // 참가 저장소를 하나의 GitLab 그룹으로 묶었다면, 위 GROUP_PATH에 그룹경로만 지정해도 전체 자동 발견됩니다.
];

const CONTEST = {
  title: "KISA AX 공모전 진행 현황",
  subtitle: "AI 업무개선 PoC 트랙 · 10개 과제 · 3개월",
  kickoff: "2026-09-07",
  finale: "2026-12-02",
  activeDays: 14, // 최근 N일 내 활동 시 "활성"
  refreshNote: "매일 09:00 / 15:00 자동 갱신",
  notice: { label: "다음 일정", text: "AX 앰버서더 — 킥오프: 9월 7일(월) 14:00, 중회의실" },
  milestones: [
    { date: "2026-09-07", label: "킥오프" },
    { date: "2026-09-20", label: "멘토링 1차" },
    { date: "2026-10-17", label: "중간점검" },
    { date: "2026-11-14", label: "멘토링 3차" },
    { date: "2026-12-02", label: "최종발표" },
  ],
  resources: [
    { label: "공모전 운영계획(안)", url: "#" },
    { label: "AI 도구 보안 이용 가이드", url: "#" },
    { label: "구독료 실비 지원 안내", url: "#" },
    { label: "강의자료 모음", url: "#" },
    { label: "참가자 오픈채팅방", url: "#" },
  ],
  footnote: "KISA 경영기획본부 ESG추진팀 · gitlab.aigov.go.kr 저장소 기준 일 2회 자동 집계",
};

/* 시연 가능 PoC — 사무국이 수동 큐레이션 */
const SHOWCASE = [];
/* ---------------------- 사무국 설정 영역 끝 ---------------------- */

const DAY = 86400000;
const kickoffDate = new Date(CONTEST.kickoff + "T00:00:00+09:00");
const finaleDate = new Date(CONTEST.finale + "T00:00:00+09:00");
const totalWeeks = Math.ceil(Math.round((finaleDate - kickoffDate) / DAY) / 7);

const headers = process.env.GITLAB_TOKEN ? { "PRIVATE-TOKEN": process.env.GITLAB_TOKEN } : {};

async function api(path, { raw = false } = {}) {
  const res = await fetch(`${GITLAB_URL}/api/v4${path}`, { headers });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${path}`);
    err.status = res.status;
    throw err;
  }
  return raw ? res.text() : res.json();
}

function weekOf(dateLike) {
  const d = new Date(dateLike);
  return Math.floor((d - kickoffDate) / DAY / 7) + 1;
}

/* axboard 관례: description "[분야] 설명" 파싱 */
function parseDescription(rawDescription) {
  const raw = String(rawDescription || "");
  const m = raw.match(/\[([^\]]+)\]/);
  if (!m) return { field: "미분류", description: raw.trim() };
  const description = (raw.slice(0, m.index) + raw.slice(m.index + m[0].length)).trim();
  return { field: m[1].trim() || "미분류", description };
}

async function fetchCommits(projectId) {
  const commits = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(
      `/projects/${projectId}/repository/commits?since=${CONTEST.kickoff}T00:00:00%2B09:00&per_page=100&page=${page}`
    );
    commits.push(...batch);
    if (batch.length < 100) break;
  }
  return commits;
}

async function fetchSelfReport(projectId, ref) {
  try {
    const text = await api(
      `/projects/${projectId}/repository/files/dashboard.json/raw?ref=${encodeURIComponent(ref)}`,
      { raw: true }
    );
    const data = JSON.parse(text);
    return {
      progress: data.progress == null ? null : Math.min(100, Math.max(0, Number(data.progress) || 0)),
      updates: Array.isArray(data.updates)
        ? data.updates
            .filter((u) => u && u.date && u.note)
            .map((u) => ({ date: String(u.date), note: String(u.note) }))
            .slice(0, 20)
        : [],
    };
  } catch {
    return { progress: null, updates: [] }; // 자기보고는 선택 사항
  }
}

async function collectProject(info) {
  const [statsR, commitsR, issuesR, reportR] = await Promise.allSettled([
    api(`/projects/${info.id}/issues_statistics`),
    fetchCommits(info.id),
    api(`/projects/${info.id}/issues?per_page=3&order_by=created_at&sort=desc`),
    fetchSelfReport(info.id, info.default_branch || "main"),
  ]);

  // 커밋 수집은 과제 데이터의 근간이므로 실패 시 과제를 제외(FAIL)한다.
  if (commitsR.status === "rejected") throw commitsR.reason;
  const commits = commitsR.value;
  // 이슈 기능이 비활성/권한제한(403·404)이어도 과제는 유지하고 0건·빈배열로 처리한다.
  const stats = statsR.status === "fulfilled" ? statsR.value : null;
  const issues = issuesR.status === "fulfilled" ? issuesR.value : [];
  const report = reportR.status === "fulfilled" ? reportR.value : { progress: null, updates: [] };

  const weeklyCommits = Array.from({ length: totalWeeks }, () => 0);
  for (const c of commits) {
    const w = weekOf(c.committed_date);
    if (w >= 1 && w <= totalWeeks) weeklyCommits[w - 1] += 1;
  }
  const counts = stats?.statistics?.counts || {};
  const parsed = parseDescription(info.description);
  const lastActivity = info.last_activity_at;
  const active = lastActivity
    ? new Date(lastActivity).getTime() >= Date.now() - CONTEST.activeDays * DAY
    : false;

  return {
    repo: info.path_with_namespace,
    name: info.name,
    team: info.namespace?.name || "-",
    field: parsed.field,
    description: parsed.description,
    webUrl: info.web_url,
    active,
    progress: report.progress,
    updates: report.updates,
    gitlab: {
      commits: commits.length,
      weeklyCommits,
      openIssues: Number(counts.opened || 0),
      closedIssues: Number(counts.closed || 0),
      stars: Number(info.star_count || 0),
      lastActivity,
    },
    recentCommits: commits.slice(0, 3).map((c) => ({
      title: c.title, date: c.committed_date, url: c.web_url,
    })),
    recentIssues: issues.map((i) => ({
      title: i.title, state: i.state, date: i.created_at, url: i.web_url,
    })),
  };
}

async function discoverProjects() {
  if (GROUP_PATH) {
    const list = await api(
      `/groups/${encodeURIComponent(GROUP_PATH)}/projects?include_subgroups=true&per_page=50&order_by=last_activity_at`
    );
    return list;
  }
  const infos = [];
  for (const repo of PROJECT_REPOS) {
    infos.push(await api(`/projects/${encodeURIComponent(repo)}`));
  }
  return infos;
}

async function collect() {
  const infos = await discoverProjects();
  const projects = [];
  let failures = 0;
  for (const info of infos) {
    try {
      projects.push(await collectProject(info));
      console.log(`ok    ${info.path_with_namespace}`);
    } catch (e) {
      failures++;
      console.error(`FAIL  ${info.path_with_namespace}: ${e.message}`);
    }
  }
  if (!projects.length) throw new Error("수집된 과제 없음 — data.json을 갱신하지 않음");
  if (failures) console.error(`경고: ${failures}개 과제 수집 실패(이번 회차에서 제외됨)`);
  return projects;
}

/* --sample: 저장소 개설 전 데모용 */
function sampleProjects() {
  const S = [
    { name: "118 민원 답변 도우미", team: "KISA 상담혁신팀", field: "민원·상담",
      desc: "118 상담 FAQ 기반 민원 답변 초안 자동 생성", progress: 55, commits: 34, open: 3, closed: 9, stars: 4,
      note: "FAQ 200건 학습 프롬프트 v2 완성, 답변 초안 품질 자체평가 통과" },
    { name: "시큐어브리핑", team: "KISA 침해대응본부", field: "보안업무",
      desc: "보안공지·취약점 정보 요약 및 배포 자동화", progress: 60, commits: 41, open: 2, closed: 11, stars: 6,
      note: "공개 CVE 피드 요약 파이프라인 동작 확인, 요약 정확도 검수 중" },
    { name: "신고 트리아지", team: "KISA 침해대응본부", field: "보안업무",
      desc: "침해사고 신고 접수 자동 분류", progress: 40, commits: 18, open: 5, closed: 4, stars: 2,
      note: "분류 정확도 미달로 분류체계 재설계 중 — 멘토 세션 추가 요청" },
    { name: "규정박사", team: "KISA 경영기획본부", field: "문서·지식",
      desc: "내부 규정·지침 Q&A 챗봇 (출처 표시)", progress: null, commits: 27, open: 4, closed: 7, stars: 5,
      note: null },
    { name: "홍보문 초안 생성기", team: "KISA 대외협력실", field: "문서·지식",
      desc: "기관 톤앤매너를 반영한 보도자료·홍보문 초안 생성", progress: 65, commits: 52, open: 1, closed: 14, stars: 8,
      note: "톤앤매너 가이드 반영 v3 시연, 홍보실 파일럿 사용 시작" },
    { name: "미닛츠", team: "KISA 경영지원실", field: "업무자동화",
      desc: "회의록 자동 작성·요약, 결정사항/할일 추출", progress: 45, commits: 22, open: 3, closed: 6, stars: 3,
      note: "발화자 구분 정확도 개선, 결정사항 추출 템플릿 적용" },
    { name: "오토리포트", team: "KISA 정책기획팀", field: "업무자동화",
      desc: "사업 통계 보고서 자동 생성", progress: 30, commits: 9, open: 6, closed: 2, stars: 1,
      note: "데이터 정제 난항 — 범위 축소(월간 1종 우선) 협의 중", inactive: true },
    { name: "문서요정", team: "KISA 총무팀", field: "업무자동화",
      desc: "공문·서식 작성 도우미 (스타일 검사 포함)", progress: 70, commits: 47, open: 2, closed: 12, stars: 7,
      note: "서식 8종 지원 완료, 부서 내 베타 사용자 5명 피드백 수집" },
    { name: "안티스팸랩", team: "KISA 디지털이용자보호단", field: "데이터분석",
      desc: "스팸 신고 데이터 분석 자동화", progress: null, commits: 15, open: 4, closed: 3, stars: 2,
      note: null, inactive: true },
    { name: "퀴즈메이커", team: "KISA 인재개발실", field: "교육·문화",
      desc: "교육자료 기반 사이버보안 퀴즈 자동 생성", progress: 75, commits: 58, open: 1, closed: 16, stars: 9,
      note: "난이도 3단계 자동 생성 완성, 8월 신입교육 시범 적용 확정" },
  ];
  const elapsedWeeks = Math.min(totalWeeks, Math.max(1, weekOf(new Date())));
  return S.map((s, i) => {
    const weeklyCommits = Array.from({ length: totalWeeks }, (_, w) => {
      if (w >= elapsedWeeks) return 0;
      const base = s.commits / elapsedWeeks;
      return Math.max(0, Math.round(base + Math.sin(i * 3.1 + w * 1.7) * base * 0.6));
    });
    const repo = `kisa-ax/team${String(i + 1).padStart(2, "0")}`;
    const lastDate = s.inactive ? "2026-07-20T10:00:00+09:00" : "2026-08-10T16:30:00+09:00";
    return {
      repo, name: s.name, team: s.team, field: s.field, description: s.desc,
      webUrl: `${GITLAB_URL}/${repo}`,
      active: !s.inactive,
      progress: s.progress,
      updates: s.note ? [{ date: "2026-08-07", note: s.note }] : [],
      gitlab: {
        commits: weeklyCommits.reduce((a, b) => a + b, 0),
        weeklyCommits, openIssues: s.open, closedIssues: s.closed, stars: s.stars,
        lastActivity: lastDate,
      },
      recentCommits: [
        { title: "feat: " + s.desc.slice(0, 22), date: lastDate, url: "#" },
      ],
      recentIssues: [
        { title: s.desc.slice(0, 18) + " 개선", state: i % 3 ? "closed" : "opened", date: "2026-08-08T11:00:00+09:00", url: "#" },
      ],
    };
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--test") {
    const repo = args[1];
    if (!repo) throw new Error("사용법: node collect.mjs --test <group/project>");
    const info = await api(`/projects/${encodeURIComponent(repo)}`);
    const p = await collectProject(info);
    console.log(JSON.stringify({
      repo: p.repo, name: p.name, team: p.team, field: p.field, description: p.description,
      active: p.active, progress: p.progress,
      commits: p.gitlab.commits, issues: `${p.gitlab.openIssues}/${p.gitlab.closedIssues}`,
      stars: p.gitlab.stars, lastActivity: p.gitlab.lastActivity,
      recentIssues: p.recentIssues.map((i) => i.title.slice(0, 40)),
      weeklyCommits: p.gitlab.weeklyCommits,
    }, null, 2));
    return;
  }

  const projects = args[0] === "--sample" ? sampleProjects() : await collect();

  const weeklyCommits = Array.from({ length: totalWeeks }, (_, w) =>
    projects.reduce((sum, p) => sum + (p.gitlab.weeklyCommits[w] || 0), 0));

  const data = {
    generatedAt: new Date().toISOString(),
    sample: args[0] === "--sample" || undefined,
    contest: { ...CONTEST, totalWeeks },
    weeklyCommits,
    projects,
    showcase: SHOWCASE,
  };

  const out = process.env.DATA_OUT || "./data.json";
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`written ${out} (projects: ${projects.length}, generatedAt: ${data.generatedAt})`);
}

main().catch((e) => {
  console.error("collect 실패:", e.message);
  process.exit(1);
});
