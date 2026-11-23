/*
  PPT 기획안 원고(deck) 명세 — editorial_proposal_ppt_design_prompt_v2.md 10·11장 기준 + KPI 산출 규칙
  proposal-agent / combine-develop-agent / csr-common(csr-proposal·csr-develop) / deck-agent 가 함께 사용.
  화면(assets/js/proposal-deck.js)이 이 형식을 그대로 템플릿 PPT 에 채웁니다.
*/

const DECK_VERSION = 2;   // 규칙이 바뀌면 올림 → deck-agent 가 이전 버전 원고를 다시 작성

const DECK_SCHEMA = `"deck": {
  "cover": { "title": "캠페인 핵심 제목 1줄 (한글 22자/영문 30자 이내)", "subtitle": "제안 목적 한 문장 (60자 이내, 명사형 종결)" },
  "background": { "background": ["프로젝트 배경 1줄 (32자)", "2줄 (32자)"], "strategy": ["전략 방향 요약 1줄", "2줄"], "execution": ["실행 방향 요약 1줄", "2줄"] },
  "market": [{ "source": "매체명 (20자, 영문은 대문자)", "headline": "사례 헤드라인 1줄 (28자)", "body": "사례 요약, 출처에 있는 사실만 (250자)" }],
  "insight": { "cards": [["인사이트1 1줄 (18자)", "2줄 (18자)"], ["인사이트2 1줄", "2줄"]], "result": ["인사이트에서 나온 결론 1줄 (32자)", "2줄"] },
  "strategy": { "lead": "전략 키워드 영문 대문자 (20자)", "text": "핵심 전략 한 문장 (50자)",
    "ideas": [{ "label": "아이디어 구분명 (10자)", "title": "아이디어 제목 (20자)", "lines": ["세부 내용 (32자)", "(32자)", "(32자)"] }] },
  "execution": { "items": [{ "title": "실행 항목 키워드 (16자)", "desc": "실행 내용 한 줄 (26자)" }],
    "programs": [{ "title": "대표 실행 프로그램명 (16자)", "desc": "프로그램 설명 (18자)" }] },
  "schedule": { "lead": "일정 키워드 영문 대문자 (20자)", "text": "전체 일정 요약 한 문장 (50자)",
    "stages": [{ "period": "YYYY.MM 또는 YYYY.MM~MM (12자)", "title": "단계 이름 (18자)", "lines": ["주요 작업 (18자)", "(18자)", "(18자)"] }] },
  "budget": { "rows": [{ "item": "비용 항목 (20자)", "cost": "0,000,000원 | 협의 | 설정 필요" }], "total": "총액 또는 설정 필요",
    "note": "※ 비용 산출 기준·전제 (80자)", "effects": [{ "title": "효과 키워드 (16자)", "lines": ["효과 설명 1줄 (20자)", "2줄 (20자)"] }] },
  "kpi": { "lead": "KPI 키워드 영문 대문자 (20자)", "text": "성과 목표 한 문장 (50자)",
    "items": [{ "value": "예상 수치+단위 (7자, 예: 1,200건 / 35%)", "name": "지표명 (16자)", "desc": "산출 근거 (18자, 예: 참가 413명×30%)" }],
    "measure": { "data": "측정 데이터 출처 (28자)", "period": "측정 주기·기간 (28자)", "tool": "측정 도구 (28자)" } },
  "closing": { "subtitle": "제안 핵심 한 문장 요약 (60자, 명사형 종결)" }
}`;

const KPI_RULE = `[KPI 산출 규칙 — "설정 필요" 금지]
- KPI 목표(kpis.target, deck.kpi.items.value)는 반드시 예상 수치로 쓰세요. 주어진 데이터(측정 학교·인원, 관중·참여 인원, 활동 성과,
  근거 사례의 성과 수치)와 일반적인 업계 전환율(예: 오프라인 행사→온라인 가입 10~30%, 가입→첫 구매 3~10%, SNS 도달→참여 2~5%,
  쿠폰 사용률 5~20%, 이벤트 재방문율 20~40%)을 조합해 계산하세요. 보수적으로 잡습니다.
- kpis 의 target 형식: "수치+단위 (산출 근거)" 예: "120명 (참가 413명×30%)", "15% (업계 평균 5~20% 중간값)".
- deck.kpi.items: value 는 수치+단위만(7자 이내), desc 에 산출 근거(18자 이내).
- 근거가 정말 전혀 없을 때만 "설정 필요". 금액(예산)·날짜는 근거 없이 만들지 마세요.`;

const DECK_RULES = `[PPT 원고(deck) 작성 규칙 — 제안서 템플릿 v2.1]
- deck 은 위 기획안 내용을 PPT 칸에 맞게 다시 쓴 원고입니다. 디자인은 고정이고 글자 수 한도(공백 포함 한글 기준, 영문은 1.3배까지)를 반드시 지킵니다. 넘치면 글자를 줄이지 말고 문장을 줄입니다.
- 문장 끝은 명사형 종결("~연결합니다." → "~연결.", "~확보합니다." → "~확보."). 제목·헤드라인은 1줄.
- 근거 없는 금액·날짜는 지어내지 않습니다("설정 필요", 금액은 "협의"도 가능). KPI 는 아래 KPI 산출 규칙대로 예상 수치를 씁니다.
- market 은 근거 자료(research)에 있는 사실만 2~3건. 근거가 없으면 빈 배열 [].
- 개수: insight.cards 2개, strategy.ideas 1~2개, execution.items 3~5개, execution.programs 3개, schedule.stages 3~4개,
  budget.rows 2~6개(많으면 비슷한 항목 합치기), budget.effects 3개, kpi.items 3~4개.
- strategy.ideas.lines 에는 앞의 "> " 표시를 넣지 마세요(디자인에서 자동으로 붙음).
- 안내 문구("명사형 마무리", "예시 텍스트", "EXAMPLE", "0,000,000원" 등)를 남기지 않습니다. lead 는 실제 키워드를 영문 대문자로.

${KPI_RULE}`;

/* 저장 전 최소 검증 (형식이 크게 어긋나면 버림 — 화면에서 자동 구성으로 대체) */
function cleanDeck(d) {
  if (!d || typeof d !== 'object') return undefined;
  if (!(d.cover && d.background && d.kpi && d.budget)) return undefined;
  const s = JSON.stringify(d);
  if (s.length > 20000) return undefined;
  const out = JSON.parse(s.replace(/명사형 마무리|예시 텍스트|이곳에 내용에 맞는 텍스트 입력/g, ''));
  for (const i of (out.strategy && out.strategy.ideas) || []) i.lines = (i.lines || []).map(l => String(l).replace(/^>\s*/, ''));
  out.v = DECK_VERSION;
  return out;
}

/* KPI 목록 정리 (기획안 본문용) */
const cleanKpis = list => (Array.isArray(list) ? list : []).filter(k => k && k.name).map(k => ({ name: String(k.name).slice(0, 100), target: String(k.target || '').slice(0, 120) }));

module.exports = { DECK_VERSION, DECK_SCHEMA, DECK_RULES, KPI_RULE, cleanDeck, cleanKpis };
