/* =============================================================================
 * 참가자 안내 요약본 생성기 (build-guides.mjs)
 *
 * edu/ · ethics/ · security/ 의 원문 PDF를 "그대로" 링크하지 않고, 일반직원이
 * 한눈에 이해하도록 새로 정리한 요약본 HTML을 guides/ 에 생성한다.
 *
 * 실행:  node build-guides.mjs      → guides/*.html 재생성
 * 대시보드(index.html)의 GUIDES.docs 가 여기서 만든 파일을 열람·다운로드로 연결한다.
 * ========================================================================== */

import { writeFileSync, mkdirSync } from "node:fs";

const AREA = {
  edu:      { label: "AI 교육",   accent: "oklch(56% 0.20 235)", soft: "oklch(66% 0.18 235 / 0.14)", icon: "🎓" },
  ethics:   { label: "AI 윤리",   accent: "oklch(60% 0.18 305)", soft: "oklch(74% 0.16 305 / 0.14)", icon: "⚖️" },
  security: { label: "정보보안",  accent: "oklch(58% 0.16 150)", soft: "oklch(80% 0.16 150 / 0.16)", icon: "🔒" },
};

/* 안내 콘텐츠 — 일반직원 눈높이로 새로 정리한 요약 */
const GUIDES = [
  {
    file: "edu-0-ax-engineroom", area: "edu",
    title: "AX, 왜 지금 우리 업무에 필요한가",
    lead: "AX는 하던 일에 AI를 얹는 자동화가 아니라, 일하는 방식 자체를 다시 짜는 것입니다. 왜 지금 시작해야 하고 어떻게 첫발을 떼는지 5분 만에 잡아 봅니다.",
    points: [
      { h: "‘AI 활용’과 ‘AX’는 다릅니다", body: "AI 활용은 도구를 한번 써보는 것이고, AX(AI Transformation)는 AI를 업무 흐름·의사결정·협업에 연결해 실제 성과로 바꾸는 것입니다. 쉽게 공식으로 보면 'AX = AI 도구 사용 + 업무 재설계 + 지식·데이터 정리 + 지속 운영·개선' 입니다." },
      { h: "AX는 왜 자주 실패할까요", body: "문제·목표·데이터에 대한 정의 없이 'AI부터 도입', '예산부터 확보', '외주부터' 하면 실패 위험이 큽니다. 실패의 진짜 원인은 세 가지 — ① 무엇을 풀지 모르는 '문제 정의 부족', ② AI에 학습시킬 '데이터 기반 부재', ③ 업무를 아는 '내부 직원 미참여' 입니다." },
      { h: "작게 시작해 검증부터", body: "거창한 마스터플랜 대신 현업의 작은 병목부터 공략합니다. 수개월 설계 대신 며칠~몇 주 만에 프로토타입(PoC)을 만들어 써보고, 완성품이 아니라 '가능성'을 빠르게 확인합니다. 기술보다 문제, 구축보다 검증, 외주보다 내부 주도가 핵심입니다." },
      { h: "운전대는 내부 직원이 잡습니다", body: "외부 기술은 '구현'만 할 뿐, '무엇을 만들지'는 업무를 가장 잘 아는 내부 직원이 결정해야 합니다. 필요한 역량은 세 가지 — 현장 병목을 짚는 '문제 정의력', 데이터·프로세스를 꿰뚫는 '업무 이해도', 기술을 실무에 적용하는 'AI 활용 감각' 입니다." },
    ],
    check: [
      "내 업무에서 시간이 많이 걸리고 반복되는 병목 1개를 적는다",
      "그 병목을 AI로 어떻게 도울지 한 문장으로 정의한다",
      "며칠 안에 만들 수 있는 가장 작은 형태(Quick Win)로 좁힌다",
      "완성품이 아니라 ‘가능성 확인’을 목표로 빠르게 만들어 본다",
    ],
  },
  {
    file: "edu-1-lovable-basic", area: "edu",
    title: "Lovable — 코딩 없이 말로 만드는 웹앱",
    lead: "‘바이브 코딩’은 코딩 지식 없이 말로 설명하면 AI가 화면과 앱을 만들어 주는 방식입니다. Lovable로 10~30분 만에 첫 시제품을 만드는 감을 잡아 봅니다.",
    points: [
      { h: "바이브 코딩이란", body: "사람이 자연어로 '의도·느낌(Vibe)'을 설명하면 AI가 해석해 코드를 자동으로 만들고 고쳐 줍니다. 10~30분이면 간단한 시범도 가능해, 비전공자·비개발자도 오늘부터 해볼 수 있습니다." },
      { h: "이런 것을 만들 수 있어요", body: "간단한 설문·자가점검 사이트, 업무 현황 대시보드, 내부에서 쓸 작은 도구의 프로토타입 등. 완성 서비스가 아니라 '아이디어를 눈으로 확인'하는 용도로 먼저 만들어 봅니다." },
      { h: "잘 만드는 요령", body: "만들 화면과 목적을 구체적으로 설명하고, 결과를 보며 조금씩 수정을 요청하는 '반복'이 핵심입니다. 원하는 예시 화면이나 샘플 데이터를 함께 주면 정확도가 크게 오릅니다." },
    ],
    check: [
      "만들 목적을 한 줄로 적는다 (예: 부서 자가점검 설문)",
      "필요한 화면을 목록으로 나열한다",
      "예시 데이터 몇 건을 준비한다",
      "결과를 보며 작은 수정을 반복해 완성한다",
      "민감정보·실데이터는 넣지 않는다",
    ],
  },
  {
    file: "edu-2-lovable-advanced", area: "edu",
    title: "Lovable 심화 — 더 좋은 결과물을 위한 기본기",
    lead: "기본 개념을 조금만 알면 AI에게 요청을 훨씬 정확하게 할 수 있습니다. 자주 막히는 지점과 해결법을 정리했습니다.",
    points: [
      { h: "화면과 데이터를 구분해 이해하기", body: "눈에 보이는 '화면(프론트)'과 값을 저장·처리하는 '데이터(백엔드)'를 구분해 두면, '무엇을 어디에 만들어 달라'는 요청이 명확해져 결과가 좋아집니다." },
      { h: "자주 막히는 지점과 해결", body: "요구가 모호하면 AI도 헤맵니다. 큰 요청을 작은 단위로 쪼개고, 오류가 나면 오류 메시지를 그대로 붙여 '이 부분을 고쳐 달라'고 요청하면 잘 풀립니다." },
      { h: "실전 개발 흐름", body: "기획 → 프로토타입 → 피드백 → 개선을 반복합니다. 잘 된 상태는 자주 저장하고, 민감정보·실데이터는 넣지 않은 채 예시 데이터로 검증합니다." },
    ],
    check: [
      "큰 요청은 작은 단계로 쪼개 지시한다",
      "오류 메시지는 그대로 붙여 물어본다",
      "잘 된 버전은 자주 저장한다",
      "예시 데이터로만 검증한다",
    ],
  },
  {
    file: "edu-3-codex-basic", area: "edu",
    title: "Codex — AI를 검색창이 아니라 ‘동료’로",
    lead: "AI를 '검색창'이 아니라 '함께 일하는 똑똑한 신입 동료'로 대하면 업무가 달라집니다. 일을 맡기고 검토하는 방식을 익혀 봅니다.",
    points: [
      { h: "관점을 바꾸세요", body: "검색은 내가 다 찾고 정리하지만, AI 동료에게는 '이 일을 이렇게 해줘'라고 맡기고 결과를 검토합니다. 무가치해지는 게 아니라, '잘 맡기고 검증하는' 능력이 새로 중요해지는 것입니다." },
      { h: "이런 일을 맡깁니다", body: "보고서·공문 초안, 흩어진 파일 정리, 반복 작업 자동화, 자료 분석과 표 만들기 등. 처음부터 완벽을 기대하지 말고, 초안을 받아 내가 다듬는 흐름으로 씁니다." },
      { h: "믿기 전에 확인", body: "AI는 그럴듯하게 틀릴 수 있습니다(환각). 숫자·출처·최신성은 사람이 확인한 뒤 사용하고, 민감정보는 입력하지 않습니다." },
    ],
    check: [
      "‘무엇을·어떤 형식으로’ 원하는지 구체적으로 맡긴다",
      "초안을 받아 내가 검토·수정한다",
      "숫자·출처·최신성을 사람이 확인한다",
      "개인정보·대외비는 입력하지 않는다",
    ],
  },
  {
    file: "edu-4-codex-advanced", area: "edu",
    title: "Codex 심화 — 반복 업무 자동화와 도구 연결",
    lead: "한 번 잘 맡기는 것을 넘어, 반복되는 일을 자동화하고 여러 도구를 연결해 더 크게 씁니다.",
    points: [
      { h: "반복 업무 자동화", body: "매번 같은 순서로 하는 일(파일 이름 정리, 자료 취합, 형식 변환 등)은 절차를 한 번 정의해 두면 반복 실행할 수 있습니다. 사람은 예외와 검토에 집중합니다." },
      { h: "도구를 연결(MCP)", body: "AI가 문서·데이터·업무 도구와 연결되면 '읽고 → 정리하고 → 결과를 만들기'까지 한 흐름으로 이어집니다. 다만 연결 권한과 범위는 꼭 필요한 만큼만 허용합니다." },
      { h: "안전하게 확장", body: "자동화가 실수하면 빠르게 되돌릴 수 있도록 작게 시작하고, 결과를 항상 검증합니다. 승인된 도구·계정만 사용합니다." },
    ],
    check: [
      "반복 절차를 작게 정의해 시험한다",
      "도구 연결 권한은 최소한으로 준다",
      "자동화 결과를 항상 검증한다",
      "되돌리기 쉬운 범위에서 확장한다",
    ],
  },
  {
    file: "edu-5-ax-organization", area: "edu",
    title: "작은 PoC를 조직의 성과로",
    lead: "혼자 만든 작은 실험을 팀과 기관의 성과로 키우는 방법입니다. 확산과 지속이 AX의 마지막 단추입니다.",
    points: [
      { h: "개인 실험 → 함께 확산", body: "내 업무의 작은 PoC가 통하면, 같은 고민을 가진 옆 부서와 공유해 넓힙니다. 부서별 pain point를 모으는 공간과 사례 공유가 확산의 출발점입니다." },
      { h: "성과로 증명하기", body: "'며칠 만에 만든 작동하는 결과물'과 '무엇이 얼마나 나아졌는지'를 함께 보여주면 예산화·정식 도입으로 이어집니다. 경진대회·발표는 좋은 확산 계기입니다." },
      { h: "지속 운영·개선", body: "한 번 만들고 끝이 아니라, 쓰면서 계속 고쳐야 살아 있는 도구가 됩니다. 유지·개선 담당과 최소한의 운영 규칙을 정해 둡니다." },
    ],
    check: [
      "통한 PoC를 옆 부서와 공유한다",
      "개선 효과를 숫자·사례로 정리한다",
      "발표·경진대회로 확산 계기를 만든다",
      "유지·개선 담당과 운영 규칙을 정한다",
    ],
  },
  {
    file: "ethics-ai-ethics", area: "ethics",
    title: "생성형 AI, 안심하고 쓰기 위한 6가지 윤리 포인트",
    lead: "생성형 AI는 편리하지만 저작권·허위정보·개인정보 같은 위험이 따라옵니다. 일상 업무에서 꼭 지킬 6가지를 사례 중심으로 정리했습니다.",
    points: [
      { h: "저작권 — 만들었다고 다 내 것은 아니다", body: "AI 생성물은 저작권 인정이 제한적일 수 있고, 학습·재사용 과정에서 타인의 저작권을 건드릴 수 있습니다. 특히 연예인·유명인의 얼굴이나 목소리를 본뜬 이미지·AI 커버곡을 공개하면 초상권·퍼블리시티권 문제가 됩니다. 상업적 이용이나 공개 전에는 권리관계를 확인하세요." },
      { h: "책임성 — “AI가 했다”는 면죄부가 아니다", body: "보고서·기획안·사업계획서에 AI를 활용해도 그 내용의 사실과 책임은 작성한 사람에게 있습니다. 공모전·평가 제출물은 AI 활용 허용 여부와 표기 규정을 반드시 확인하세요." },
      { h: "허위조작정보 — 재미로도 안 된다", body: "재미로라도 가짜뉴스를 만들어 배포하면 처벌 대상이 될 수 있습니다. 엄마·지인 목소리를 흉내 낸 딥페이크가 보이스피싱에 악용되기도 합니다. 진위가 의심되면 사실 확인 후 다루세요." },
      { h: "개인정보·인격권 — 입력이 곧 유출일 수 있다", body: "AI와 나눈 대화는 학습·저장되어 노출될 수 있으니 민감정보를 입력하지 마세요. 또한 특정인을 차별·비방·명예훼손하는 결과를 만들거나 퍼뜨리지 않습니다." },
      { h: "오남용 — 도구일 뿐, 맹신 금지", body: "무엇이든 AI부터 묻는 과의존을 경계하고, 의료·법률·재무 같은 전문 상담은 참고용으로만 씁니다. 사람처럼 느껴지더라도 감정적으로 의존하지 않도록 거리를 둡니다." },
      { h: "현명한 활용 — 마지막 판단은 사람", body: "AI는 초안·아이디어를 빠르게 주는 조력자입니다. 출처·사실·권리·개인정보를 점검하고, 최종 판단과 책임은 사람이 지는 것을 원칙으로 삼습니다." },
    ],
    check: [
      "결과를 그대로 쓰기 전에 사실·출처를 확인했는가",
      "타인의 저작물·초상·개인정보를 무단 사용하지 않았는가",
      "민감정보·기밀을 입력하지 않았는가",
      "AI 활용 표기·규정을 지켰는가",
      "최종 판단과 책임이 나에게 있음을 이해했는가",
    ],
  },
  {
    file: "security-user-rules", area: "security",
    title: "AI 이용자 정보보안 수칙",
    lead: "AI를 쓸 때 무심코 한 입력이 유출로 이어질 수 있습니다. 이용자가 지켜야 할 핵심 수칙을 4가지로 정리했습니다.",
    points: [
      { h: "서비스 사용 — 승인된 것만", body: "기관이 승인한 서비스·계정만 사용하고, 출처가 불분명한 플러그인·확장 프로그램은 설치하지 않습니다. 계정 권한과 접근을 주기적으로 점검합니다." },
      { h: "대화 시 — 넣지 않는 것이 최선", body: "개인정보나 업무상 비밀을 입력하면 학습·저장·유출 위험이 있습니다. 꼭 필요하면 이름·번호를 가명처리(□□□)해 식별되지 않게 하고, 대화 이력의 학습 사용 여부 설정을 확인합니다." },
      { h: "결과 검증 — 그럴듯한 오답 주의", body: "AI는 사실이 아닌 내용을 자신 있게 말할 수 있습니다(환각). 숫자·출처·최신성을 사람이 확인한 뒤 업무에 사용합니다." },
      { h: "악용 대비 — 링크·유도 조심", body: "AI가 만든 링크·첨부의 출처를 확인하고, 프롬프트로 유도된 악성 출력이나 피싱 시도에 주의합니다. 의심되면 실행하지 말고 담당 부서에 문의합니다." },
    ],
    check: [
      "기관이 승인한 서비스·계정만 사용한다",
      "개인정보·업무상 비밀은 입력하지 않는다(불가피하면 가명처리)",
      "대화 이력의 학습 사용 여부 설정을 확인한다",
      "AI 답변은 사실·출처를 확인한 뒤 사용한다",
      "출처 불명 링크·플러그인은 실행·설치하지 않는다",
    ],
  },
  {
    file: "security-public-institution", area: "security",
    title: "공공기관을 위한 상용 AI 안전 활용",
    lead: "공공부문 AI 사고는 국가안보·정부 신뢰·국민 생활에 직결됩니다. 상용 AI 서비스를 안전하게 쓰기 위한 핵심을 정리했습니다.",
    points: [
      { h: "왜 각별한 주의가 필요한가", body: "공공부문의 정보 유출은 국가기밀·정부 신뢰도·국민 생활에 바로 영향을 줍니다. AI를 겨냥한 공격과 AI를 악용한 침해 사례가 빠르게 늘고 있어, 생산성 향상과 보안을 동시에 챙겨야 합니다." },
      { h: "구축 유형에 따라 눈높이를 다르게", body: "① 내부망 전용, ② 내부업무용의 외부망 연계, ③ 대민서비스용에 따라 요구되는 보안 수준이 다릅니다. 특히 외부망과 연계될 때는 어떤 데이터가 밖으로 나가는지 경계를 명확히 관리합니다." },
      { h: "상용 AI 서비스 활용 권고", body: "입력·대화 데이터가 모델 학습에 쓰이는지 설정을 확인하고(옵트아웃 등 보안설정 적용), 민감·비공개 자료는 입력하지 않으며, 기관의 승인 절차를 따릅니다. 계정은 강한 인증과 최소 권한으로 관리합니다." },
      { h: "에이전틱·피지컬 AI는 권한을 좁게", body: "스스로 작업을 실행하거나 기기를 제어하는 AI는 허용 행동 범위와 권한을 꼭 필요한 만큼으로 제한하고, 중요한 결정에는 사람이 개입하도록 설계합니다." },
    ],
    check: [
      "기관 승인 절차를 거친 서비스만 사용한다",
      "입력 데이터의 학습 사용 여부 등 보안설정을 적용한다",
      "민감·비공개·기밀 자료는 입력하지 않는다",
      "외부망 연계 시 나가는 데이터의 경계를 관리한다",
      "자동 실행·기기 제어 AI는 권한을 최소화하고 사람이 개입한다",
    ],
  },
];

function esc(v) {
  return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function page(d) {
  const a = AREA[d.area];
  const points = d.points.map((p, i) =>
    `<section class="pt"><h2><span class="n">${i + 1}</span>${esc(p.h)}</h2><p>${esc(p.body)}</p></section>`).join("\n");
  const check = `<section class="pt"><h2><span class="n">✓</span>실무 체크리스트</h2><ul class="check">` +
    d.check.map((c) => `<li>${esc(c)}</li>`).join("") + `</ul></section>`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.title)} — KISA AX 공모전 · ${esc(a.label)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  :root{
    --paper:oklch(97% 0.012 95); --paper-2:oklch(94% 0.016 95);
    --ink:oklch(20% 0.012 250); --ink-2:oklch(28% 0.014 250); --muted:oklch(50% 0.014 90);
    --rule:oklch(86% 0.014 90);
    --accent:${a.accent}; --accent-soft:${a.soft};
    --edge:color-mix(in oklab, ${a.accent}, black 20%);
    --font-display:"Plus Jakarta Sans","Pretendard","Malgun Gothic","맑은 고딕",ui-sans-serif,system-ui,sans-serif;
    --font-body:"Plus Jakarta Sans","Pretendard","Malgun Gothic","맑은 고딕",ui-sans-serif,system-ui,sans-serif;
    --font-label:"JetBrains Mono","Pretendard","Malgun Gothic",ui-monospace,monospace;
  }
  *{box-sizing:border-box}
  body{font-family:var(--font-body); color:var(--ink-2); line-height:1.7; max-width:800px; margin:0 auto;
    padding:0 24px 76px; background:var(--paper); -webkit-font-smoothing:antialiased;
    font-feature-settings:"ss01" on; font-variant-numeric:tabular-nums;}
  .strip{height:5px; margin:0 -24px 34px; background:var(--accent);}
  .no-print{margin:0 0 24px; text-align:right;}
  .no-print button{font-family:var(--font-display); font-weight:600; font-size:14.5px; color:#fff; background:var(--accent);
    border:0; border-radius:999px; padding:12px 24px; cursor:pointer;
    box-shadow:0 4px 0 0 var(--edge), 0 6px 12px -3px oklch(20% 0.012 250 / .3);
    transition:transform 140ms cubic-bezier(0.2,0.7,0.3,1), box-shadow 140ms cubic-bezier(0.2,0.7,0.3,1);}
  .no-print button:hover{transform:translateY(-2px); box-shadow:0 6px 0 0 var(--edge), 0 12px 22px -4px oklch(20% 0.012 250 / .3);}
  .no-print button:active{transform:translateY(3px); box-shadow:0 1px 0 0 var(--edge);}
  .head{padding-top:6px;}
  .brand{display:flex; gap:15px; align-items:center;}
  .mark{flex:none; width:54px; height:54px; border-radius:16px; display:grid; place-items:center;
    background:var(--accent-soft); font-size:26px; box-shadow:inset 0 0 0 1px var(--rule);}
  .eyebrow{margin:0; font-family:var(--font-label); font-size:11px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--accent);}
  .head h1{margin:16px 0 0; font-family:var(--font-display); font-size:28px; font-weight:700; line-height:1.3; letter-spacing:-.02em; color:var(--ink);}
  .lead{margin:0; color:var(--ink-2); font-size:15.5px;}
  .lead-box{background:var(--accent-soft); border:1px solid var(--rule); border-radius:20px; padding:18px 22px; margin:22px 0 8px;}
  .pt{padding:20px 0; border-bottom:1px solid var(--rule);}
  .pt:last-of-type{border-bottom:0;}
  .pt h2{font-family:var(--font-display); font-size:18px; font-weight:700; color:var(--ink); margin:0 0 9px; display:flex; align-items:center; gap:11px; letter-spacing:-.01em;}
  .pt h2 .n{flex:none; width:28px; height:28px; border-radius:9px; background:var(--accent); color:#fff;
    font-family:var(--font-display); font-size:14px; font-weight:700; display:inline-grid; place-items:center; box-shadow:0 3px 0 0 var(--edge);}
  .pt p{margin:0; color:var(--ink-2); font-size:15.5px; line-height:1.75;}
  ul.check{margin:0; padding:0; list-style:none; display:grid; gap:10px;}
  ul.check li{position:relative; padding-left:28px; font-size:15px; color:var(--ink-2); line-height:1.6;}
  ul.check li::before{content:"✓"; position:absolute; left:0; top:0; color:var(--accent); font-weight:800;}
  footer{margin-top:36px; padding-top:18px; border-top:1px solid var(--rule); font-family:var(--font-label); font-size:12px; letter-spacing:.02em; color:var(--muted);}
  footer b{color:var(--ink-2);}
  @media print{.no-print,.strip{display:none;} body{background:#fff; padding:0;}}
</style>
</head>
<body>
<div class="strip"></div>
<div class="no-print"><button onclick="window.print()">인쇄 / PDF로 저장</button></div>
<div class="head">
  <div class="brand">
    <div class="mark">${a.icon}</div>
    <div>
      <p class="eyebrow">KISA AX · ${esc(a.label)}</p>
    </div>
  </div>
  <h1>${esc(d.title)}</h1>
</div>
<div class="lead-box"><p class="lead">${esc(d.lead)}</p></div>
${points}
${check}
<footer>
  KISA 경영기획본부 ESG추진팀
</footer>
</body>
</html>
`;
}

mkdirSync("guides", { recursive: true });
let n = 0;
for (const d of GUIDES) {
  writeFileSync(`guides/${d.file}.html`, page(d), "utf8");
  n++;
}
console.log(`생성 완료: guides/ 에 ${n}개 요약본`);
