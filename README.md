# KISA AX 공모전 진행 현황 대시보드

기관 내부 AX 공모전 과제(10개 과제·3개월 트랙)의 진행 과정을, 직원 누구나 볼 수 있는
단일 웹페이지로 공개하는 정적 대시보드입니다.

과제 정보의 원본은 **gitlab.aigov.go.kr의 각 과제 저장소**입니다. 수집기가 GitLab API를
읽어 `data.json`을 만들고 `index.html`이 이를 렌더링합니다. 백엔드·DB가 없고, 브라우저가
GitLab을 직접 호출하지 않습니다.

```
[과제 저장소]  gitlab.aigov.go.kr
      │  REST API (커밋 · 이슈 · 설명 · Star · 최근활동)
      ▼
[collect.mjs / collectAll()]
      │  data.json 생성
      ▼
[index.html + data.json]  웹서버에 정적 배치 → [직원 브라우저]
```

`data.json`을 만드는 방법은 두 가지이며 같은 `collectAll()`을 재사용합니다.

- **정적 파일** — `collect.mjs`를 스케줄로 돌려 `data.json`을 파일로 생성(사내 인터넷망 권장).
- **서버리스** — Vercel `api/data.mjs`가 요청 시 실시간 수집해 `/data.json`으로 응답(엣지 24h 캐시).

## 구성 파일

| 경로 | 역할 |
| --- | --- |
| `index.html` | 대시보드 화면 전체(HTML+CSS+JS 단일 파일). 반응형·정적 안내 콘텐츠 포함. |
| `collect.mjs` | GitLab 수집기 + 사무국 설정. `collectAll()`을 export해 CLI·서버리스가 공유. |
| `api/data.mjs` | Vercel 서버리스 함수. `/data.json` 요청을 실시간 수집으로 응답. |
| `vercel.json` | `/data.json` → `/api/data` rewrite, 엣지 캐시, 일 1회 크론. |
| `data.json` | 수집 결과(정적 배포 시 사용). |
| `guides/*.html` | 참가자 자료 '열람·다운로드'용 각색 요약본(보안 2 · 윤리 1). |
| `dashboard.sample.json` | 참가팀 자기보고 양식 예시(선택). |

> `assets/css/style.css`는 현재 `index.html`이 링크하지 않는 잔여 파일로, 화면에 영향을 주지 않습니다.

## 화면 구성

상단 네비게이션은 두 그룹의 탭으로 나뉩니다.

**대회 진행**
- **전체 일정 · 추진현황**(기본 화면) — 핵심 지표, 전체 일정 타임라인, 과제별 추진현황
  카드(분야·상태 필터 + 검색), 주차별 커밋 차트, 분야/상태 도넛, 최근 활동 피드, PoC 쇼케이스.
- **공모전 운영계획** — 요약 지표, 추진 일정 로드맵, 추진 방향·참가 자격·시상 등.

**참가자 자료**
- **AI 도구 보안 · 인공지능 윤리 · AI 강의자료** — 일반직원 눈높이로 새로 집필한 안내.
  각 페이지에서 요약본을 `열람`(전체 보기)하거나 `다운로드`(인쇄·PDF 저장이 가능한 단독 HTML)할 수 있습니다.
- **참고사이트** — 공개 데이터·AI 도구·MCP 카탈로그 큐레이션(정적).
- **오픈채팅방** — 참가자 채널 입장 + AI·언론 동향 뉴스 채널.

안내(교육·윤리·보안)와 참고사이트·오픈채팅 문구는 `index.html`의 `GUIDES`·`REF_GROUPS`
등 정적 데이터라 `data.json`·GitLab 수집과 무관하게 항상 렌더링됩니다.

### 각색 요약 자료 (`guides/`)

보안·윤리 페이지의 `열람`/`다운로드`가 연결하는 문서는 원문을 그대로 쓰지 않고, 일반직원
눈높이로 각색한 요약본입니다. 각 문서 하단에 원문 출처를 밝힙니다.

- `guides/security-user-rules.html` — AI 이용자 정보보안 수칙
- `guides/security-public-institution.html` — 공공기관을 위한 상용 AI 안전 활용
- `guides/ethics-ai-ethics.html` — 안심하게 쓰기 위한 6가지 윤리 포인트

각 페이지의 '한눈에 보기' 요약과 본문은 `index.html`의 `GUIDES` 상수에 있으며,
`요약본 다운로드` 버튼은 이 상수로 단독 HTML을 즉석 생성합니다.

## 모바일 대응

`index.html`은 반응형입니다(`viewport` 메타 + `max-width` 900/820/640/420 브레이크포인트).

- 과제 카드·PoC 목록은 좁은 폭에서 단 수가 줄어 가로 오버플로가 생기지 않습니다.
- **전체 일정 타임라인**과 **주차별 커밋 차트**는 좁은 폭에서 라벨이 겹치지 않도록 가로로
  스크롤됩니다. 타임라인 우측에는 더 볼 내용이 남아 있으면 페이드를 표시해 스크롤 가능함을
  알립니다.
- 헤더·D-day·지표·도넛 등은 화면 폭에 맞춰 재배치됩니다.

## 실행

```bash
node collect.mjs            # 실제 수집 → data.json 생성
node collect.mjs --sample   # 예시 데이터 생성(저장소 개설 전 데모)
node collect.mjs --test <group/project>   # 단일 저장소 연결 점검
```

로컬 미리보기는 파일을 직접 열지 말고 간이 웹서버로 접속합니다
(`fetch("./data.json")`가 `file://`에서 차단되기 때문입니다).

```bash
npx serve -l 3000 .            # http://localhost:3000
python -m http.server 5173     # http://127.0.0.1:5173
```

## 배포

### A) 사내 인터넷망 정적 배포

웹서버의 문서 경로에 **`index.html`·`data.json`·`guides/` 폴더**를 함께 두면 됩니다.
참가자 자료의 [열람]이 `guides/*.html`을 상대경로로 연결합니다. 수집기는 웹서버에서
스케줄로 돌리고 `DATA_OUT`으로 출력 경로를 지정하는 방식을 권장합니다.

```bash
# Windows 작업 스케줄러
schtasks /Create /TN "AX대시보드_0900" /TR "node D:\경로\collect.mjs" /SC DAILY /ST 09:00

# Linux cron
0 9 * * * cd /var/www/ax-dashboard && /usr/bin/node collect.mjs >> collect.log 2>&1
```

### B) Vercel 서버리스 배포

저장소를 그대로 Vercel에 연결하면 `api/data.mjs`가 `/data.json`을 실시간으로 응답합니다.
`vercel.json`이 rewrite·엣지 캐시(하루)·일 1회 크론을 설정하므로 별도의 `data.json` 생성이나
스케줄러가 필요 없습니다. GitLab 공개 API를 쓰므로 토큰·시크릿도 불필요합니다.

외부 라이브러리·DB가 없고 브라우저가 GitLab을 직접 호출하지 않으므로 CORS 문제나 GitLab
장애의 영향을 받지 않습니다.

### 환경변수

| 이름 | 설명 |
| --- | --- |
| `GITLAB_TOKEN` | 비공개 저장소를 집계할 때만 필요한 `read_api` 토큰. 공개 저장소면 불필요합니다. |
| `DATA_OUT` | `data.json` 출력 경로. 기본값은 `./data.json`. (정적 배포용) |

## 참가팀 안내 사항

대시보드는 GitLab에 있는 정보를 그대로 비춥니다. 팀이 할 일은 두 가지입니다.

1. **프로젝트 설명(description)을 `[분야] 한 줄 소개` 형식으로 작성**
   예: `[보안업무] 침해사고 신고 접수 자동 분류`
   → 대괄호 안의 값이 대시보드의 분야 필터·분포 차트에 쓰입니다. 없으면 `미분류`로 표시됩니다.

2. **(선택) 저장소 루트에 `dashboard.json` 커밋** — `dashboard.sample.json` 참고
   진척률과 주간 한 줄 보고가 카드에 표시됩니다. 없어도 커밋·이슈·최근활동은 자동 집계됩니다.

과제명·팀은 GitLab 프로젝트명과 네임스페이스에서 자동으로 가져오므로 따로 보고할 필요가 없습니다.
활성/비활성 상태는 최근 14일간 저장소 활동 여부로 자동 판정합니다.

## 사무국 설정

`collect.mjs` 상단의 설정 영역만 수정합니다.

- `GROUP_PATH` — 공모전 그룹 경로를 지정하면 소속 저장소를 자동으로 찾습니다(권장).
  비워두면 `PROJECT_REPOS`에 나열한 저장소 경로를 사용합니다.
- `CONTEST` — 대회명·부제, 킥오프·최종발표 일자, `activeDays`(활성 판정 일수), 마일스톤,
  공지(`notice`), 자료실 링크(`resources`), 주차 수(`totalWeeks`) 등.
- `SHOWCASE` — 시연 가능한 PoC 목록. 비어 있으면 해당 패널이 표시되지 않습니다.

`resources`의 URL을 `#`이 아닌 실제 링크로 바꾸면 운영계획 원문 열람·오픈채팅방 입장 버튼이
활성화됩니다.
