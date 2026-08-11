# KISA AX 공모전 진행 현황 대시보드

기관 내부 AX 공모전 10개 과제의 3개월 진행 과정을, 직원 누구나 볼 수 있는
단일 웹페이지로 공개하기 위한 정적 대시보드입니다.

과제 정보의 원본은 **gitlab.aigov.go.kr의 각 과제 저장소**입니다.
수집기가 하루 2회 GitLab API를 읽어 `data.json`을 만들고, `index.html`이 이를 렌더링합니다.

```
[10개 과제 저장소]  gitlab.aigov.go.kr
        │  REST API (커밋 · 이슈 · 설명 · Star · 최근활동)
        ▼
[collect.mjs]  매일 09:00 / 15:00 스케줄 실행
        │  data.json 생성
        ▼
[index.html + data.json]  기관 인터넷망 웹서버에 정적 배치
        ▼
     [직원 브라우저]
```

## 구성 파일

| 파일 | 역할 |
| --- | --- |
| `index.html` | 대시보드 화면. 수정할 일이 거의 없습니다. |
| `collect.mjs` | GitLab 수집기 + 사무국 설정(과제 식별·공지·일정·자료실). |
| `data.json` | 수집 결과. 하루 2회 자동 재생성됩니다. |
| `dashboard.sample.json` | 참가팀 배포용 자기보고 양식(선택 사항). |

## 실행

```bash
node collect.mjs            # 실제 수집 → data.json 생성
node collect.mjs --sample   # 예시 데이터 생성(저장소 개설 전 데모)
node collect.mjs --test <group/project>   # 단일 저장소 연결 점검
```

로컬 미리보기는 파일을 직접 열지 말고 간이 웹서버로 접속합니다.
(`fetch("./data.json")`가 `file://`에서 차단되기 때문입니다.)

```bash
npx serve -l 3000 .   # http://localhost:3000
```

## 배포

기관 인터넷망 웹서버의 문서 경로에 **`index.html`과 `data.json` 두 파일만** 두면 됩니다.
백엔드·DB·외부 라이브러리가 없고, 브라우저가 GitLab을 직접 호출하지 않으므로
CORS 문제나 GitLab 장애의 영향을 받지 않습니다.

수집기는 웹서버에서 실행하고 `DATA_OUT`으로 문서 경로를 지정하는 방식을 권장합니다.

```bash
# Windows 작업 스케줄러
schtasks /Create /TN "AX대시보드_0900" /TR "node D:\경로\collect.mjs" /SC DAILY /ST 09:00
schtasks /Create /TN "AX대시보드_1500" /TR "node D:\경로\collect.mjs" /SC DAILY /ST 15:00

# Linux cron
0 9,15 * * * cd /var/www/ax-dashboard && /usr/bin/node collect.mjs >> collect.log 2>&1
```

### 환경변수

| 이름 | 설명 |
| --- | --- |
| `GITLAB_TOKEN` | 비공개 저장소를 집계할 때만 필요한 `read_api` 토큰. 공개 저장소면 불필요합니다. |
| `DATA_OUT` | `data.json` 출력 경로. 기본값은 `./data.json`. |

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
- `CONTEST` — 대회명, 킥오프·최종발표 일자, 마일스톤, 공지, 자료실 링크.
- `SHOWCASE` — 시연 가능한 PoC 목록. 비어 있으면 해당 패널이 표시되지 않습니다.
