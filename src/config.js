/**
 * 수집 대상과 필터 조건을 한 곳에 모아둔다.
 *
 * 수집 대상을 고를 때 지킨 원칙 (README에 근거 기록):
 *  1. robots.txt에서 명시적으로 허용된 경로만 사용한다.
 *  2. API나 RSS가 제공되면 화면을 긁지 않고 그쪽을 쓴다.
 *  3. 개인·소규모 운영 사이트는 하루 1회, 요청 간 딜레이를 두고 접근한다.
 */

export const POLITENESS = {
  // 연락 가능한 UA. 사이트 운영자가 로그를 보고 연락할 수 있어야 한다.
  userAgent:
    'RunAlertBot/0.1 (+https://github.com/wonby1n/run-alert; wonby1n@gmail.com)',
  // 같은 사이트에 연속 요청할 때 최소 간격(ms)
  delayBetweenRequestsMs: 3000,
  // 소스 하나당 최대 페이지 수 — 무한 페이지네이션 사고 방지
  maxPagesPerSource: 3,
};

export const RETRY = {
  attempts: 3,
  baseDelayMs: 2000, // 2s -> 4s -> 8s
  timeoutMs: 30000,
};

/**
 * 소스 정의.
 * enabled: false 로 두면 수집에서 제외된다. robots.txt 확인 결과를 note에 남긴다.
 */
export const SOURCES = [
  {
    id: 'marathongo',
    kind: 'browser',
    label: '마라톤GO 국내 대회 일정',
    url: 'https://marathongo.co.kr/raceSchedule/domestic',
    enabled: true,
    note: 'robots.txt: User-agent: * / Allow: / (2026-09 확인)',
  },
  {
    id: 'rankingmarathon',
    kind: 'browser',
    label: '랭킹마라톤 대회 일정',
    url: 'https://rankingmarathon.com/',
    enabled: true,
    note: 'robots.txt: Allow: / , Disallow: /api/ → 공개 페이지만 사용 (2026-09 확인)',
  },
  {
    id: 'snkrs',
    kind: 'browser',
    label: 'Nike SNKRS 발매 예정',
    url: 'https://www.nike.com/kr/launch/upcoming',
    enabled: true,
    note: 'robots.txt: /kr/launch 계열 허용 (2026-09 확인)',
  },
  {
    id: 'hypebeast',
    kind: 'rss',
    label: 'Hypebeast KR (신발 카테고리)',
    url: 'https://hypebeast.kr/feed',
    enabled: true,
    note: '공식 RSS. 화면을 긁지 않고 피드를 쓴다.',
  },
  // 확인 결과 제외한 대상 — 왜 뺐는지 코드에 남겨둔다.
  {
    id: 'musinsa',
    kind: 'browser',
    label: '무신사',
    url: 'https://www.musinsa.com/',
    enabled: false,
    note: '제외: robots.txt 기본값이 User-agent: * / Disallow: / (등록된 봇만 허용)',
  },
];

/** 내 관심사 필터 */
export const FILTERS = {
  // 대회: 관심 지역 (빈 배열이면 전체)
  regions: ['부산', '경남', '울산'],
  // 대회: 관심 거리
  distances: ['풀', '하프', '10km'],
  // 발매: 관심 키워드
  keywords: ['러닝', 'running', '페가수스', '보메로', '알파플라이', '베이퍼플라이'],
};

export const NOTIFY = {
  // Discord Incoming Webhook URL. 미설정이면 콘솔에만 출력한다.
  webhookUrl: process.env.WEBHOOK_URL || '',
  // 실패 알림도 같은 채널로 보낸다. 조용히 죽는 게 제일 나쁘다.
  notifyOnFailure: true,
};

export const PATHS = {
  seen: 'data/seen.json',
  items: 'data/items.json',
  log: 'data/run.log',
};

/**
 * 셀렉터 드리프트 감지 임계값.
 * 사이트가 개편되면 셀렉터가 안 먹으면서도 에러는 안 난다.
 * "에러 없이 0건"은 성공이 아니라 이상 신호로 취급한다.
 */
export const HEALTH = {
  minItemsPerSource: 1,
};
