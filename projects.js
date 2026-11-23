/*
  SPYDER AI Workspace — 업무(프로젝트) 목록
  ─────────────────────────────────────────────
  첫 페이지 탭은 이 목록으로 만들어집니다.
  새 업무를 추가할 때는 아래 형식으로 항목을 추가하고, 업무 폴더(예: proteam/index.html)를 만듭니다.

  {
    id: 'proteam',                       // 영문 고유 ID (폴더명과 동일 권장)
    name: '프로구단 후원·협업',            // 탭에 표시될 이름
    status: 'live',                      // 'live' = 운영 중, 'soon' = 준비 중
    url: 'proteam/index.html',           // 자동화 시스템 경로
    desc: '업무 설명',
    modules: [['01', '모듈명', '설명'], ...],
  }
*/
window.PROJECTS = [
  {
    id: 'combine',
    name: 'BASEBALL COMBINE',
    status: 'live',
    url: 'combine/index.html',
    desc: '고교 야구부를 방문해 주루·악력을 측정하는 SPYDER 베이스볼 컴바인. 측정 기록 분석, 시장 조사, 마케팅 기획, 학교 운영, 카카오톡 커뮤니케이션까지 AI가 함께 관리합니다.',
    modules: [
      ['01', 'Research Dashboard', '매시간 실제 사례 조사 및 축적'],
      ['02', 'Proposal', 'MARKETING · SNS 제안 매시간 자동 생성'],
      ['03', 'Operation Manager', '학교별 일정·측정·물품 증정 관리'],
      ['04', 'KakaoTalk Assistant', '상황별 메시지 초안 선제 제안'],
    ],
  },
  {
    id: 'csr',
    name: 'CSR',
    status: 'live',
    url: 'csr/index.html',
    desc: '종목·국내외·분야를 가리지 않고 타 기관의 CSR 사례를 분석해 인천유나이티드에 접목할 방안을 찾습니다. 목표는 CSR을 통한 구단 매출 증대(관중·티켓·MD·스폰서)입니다.',
    modules: [
      ['01', 'Incheon United 2026', '2026 CSR·마케팅 활동 현황과 매출 연결 진단'],
      ['02', 'CSR Research', '타 기관 CSR 사례 매시간 조사'],
      ['03', 'Proposal', 'CSR → 매출 증대 기획안 매시간 자동 생성'],
      ['04', 'Execution Manager', '채택 기획 담당·마감·체크리스트 관리'],
    ],
  },
];
