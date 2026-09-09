/**
 * 수집 대상과 필터 조건.
 *
 * 이 프로젝트가 잡으려는 것은 두 가지다.
 *   1) 새로 올라온 대회
 *   2) 기존 대회의 접수가 열리는 순간   ← 선착순 마감 때문에 이게 더 중요하다
 *
 * 수집 대상을 고를 때 지킨 원칙 (근거는 note에 기록):
 *   - robots.txt에서 허용된 경로만 사용한다.
 *   - API나 RSS가 제공되면 화면을 긁지 않는다.
 *   - 개인·소규모 운영 사이트는 하루 1회, 요청 간 딜레이를 두고 접근한다.
 */

export const POLITENESS = {
  userAgent:
    'RunAlertBot/0.1 (+https://github.com/wonby1n/run-alert; wonby1n@gmail.com)',
  delayBetweenRequestsMs: 3000,
  maxPagesPerSource: 3,
};

export const RETRY = {
  attempts: 3,
  baseDelayMs: 2000, // 2s -> 4s -> 8s
  timeoutMs: 30000,
};

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
    id: 'runneron',
    kind: 'browser',
    label: '러너온 마라톤 대회 캘린더',
    url: 'https://www.runneron.com/Marathon',
    enabled: true,
    note: 'robots.txt: /Marathon 명시적 Allow. /api/ 와 /marathon/ics 는 Disallow → 건드리지 않음 (2026-09 확인)',
  },

  // --- 아래는 이 프로젝트의 목적(마라톤 일정)에 해당하지 않아 꺼둔다 ---
  {
    id: 'snkrs',
    kind: 'browser',
    label: 'Nike SNKRS 발매 예정',
    url: 'https://www.nike.com/kr/launch/upcoming',
    enabled: false,
    note: '보류: 러닝화 발매는 이번 범위가 아니다. robots.txt상 /kr/launch 는 허용됨',
  },
  {
    id: 'hypebeast',
    kind: 'rss',
    label: 'Hypebeast KR (신발 카테고리)',
    url: 'https://hypebeast.kr/feed',
    enabled: false,
    note: '보류: 위와 같은 이유. 공식 RSS라 필요해지면 바로 켜면 된다',
  },
  {
    id: 'musinsa',
    kind: 'browser',
    label: '무신사',
    url: 'https://www.musinsa.com/',
    enabled: false,
    note: '제외: robots.txt 기본값이 User-agent: * / Disallow: / (등록된 봇만 허용)',
  },
];

/** 관심사 필터. 배열이 비어 있으면 그 조건은 적용하지 않는다. */
export const FILTERS = {
  // 관심 지역 (대회명이나 지역 표기에 포함되면 통과)
  regions: [],
  // 관심 거리
  distances: [],
  // 제외하고 싶은 키워드 (예: '비대면', '온라인')
  excludeKeywords: [],
};

/** '접수중'으로 볼 상태 표기 */
export const OPEN_STATUS = /접수\s*중|접수중|신청\s*중|접수\s*진행/;

export const NOTIFY = {
  webhookUrl: process.env.WEBHOOK_URL || '',
  notifyOnFailure: true,
};

/**
 * 무엇을 알릴지에 대한 규칙.
 * 수집은 넓게 하고 알림은 좁게 한다 — 화면에서는 전체를 볼 수 있어야 하지만,
 * 알림이 시끄러우면 사람이 안 보게 되고 그 순간 자동화는 죽은 것이다.
 */
export const NOTIFY_RULES = {
  // 이미 지난 대회는 알리지 않는다
  skipPastRaces: true,
  // 이미 접수가 끝난 대회를 '신규'로 알리지 않는다 (할 수 있는 게 없다)
  skipClosedRaces: true,
};

/**
 * 접수 마감 임박 리마인드.
 *
 * 실제로 대회를 놓치는 경로는 "몰라서"가 아니라
 * "알림은 봤는데 나중에 하지 하다가 까먹어서"다.
 * 그래서 접수 오픈 알림과 별개로, 마감 직전에 한 번 더 찌른다.
 */
export const REMIND = {
  // 접수 마감 D-N 이내면 리마인드 대상
  daysBefore: 3,
  // 같은 대회를 며칠에 한 번까지 다시 알릴지 (매일 보내면 시끄럽다)
  cooldownDays: 2,
};

export const PATHS = {
  state: 'data/state.json',
  log: 'data/run.log',
};

/**
 * 셀렉터 드리프트 감지.
 * 사이트가 개편되면 셀렉터가 안 먹으면서도 예외는 안 난다.
 * "에러 없이 0건"은 성공이 아니라 이상 신호로 취급한다.
 */
export const HEALTH = {
  minItemsPerSource: 1,
};
