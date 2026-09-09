import { withPage } from '../lib/browser.js';

/**
 * 마라톤GO 국내 대회 일정.
 *
 * 이 페이지는 MUI(React)로 그려진다. 클래스명이 css-pwbe9m 처럼 빌드마다 바뀌는
 * 해시라서 클래스 셀렉터로 잡으면 배포 한 번에 깨진다.
 * 대신 절대 안 바뀌는 것 — "대회 상세로 가는 링크" — 를 앵커로 잡는다.
 *
 * 행 텍스트 형식 (probe로 확인, 2026-09):
 *   "9월 12일 (토) 하프 10km 5km 제 6회 계란 마라톤 경기 | 아라타워 | 08시30분 집결 | 2026 접수마감 2026.08.06 ~ 2026.08.20"
 *    └날짜─────┘ └─거리──────┘ └─대회명───────┘ └지역┘   └─장소·시간─────┘   └연도┘└상태┘ └─접수기간──────────┘
 */
const ROW_SELECTOR = 'a[href*="/raceDetail/"]';

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const DATE_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const DISTANCE_RE = /(풀코스|풀|하프|\d+(?:\.\d+)?\s*(?:km|Km|KM|k|K))/g;
const STATUS_RE = /(접수중|접수 중|접수마감|접수예정|접수전|신청중)/;
const PERIOD_RE = /(\d{4}\.\d{2}\.\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})/;
const YEAR_RE = /\|\s*(\d{4})\s*(?:접수|신청)/;

export function parseRow(rawText, href) {
  const text = String(rawText).replace(/\s+/g, ' ').trim();
  if (text.length < 8) return null;

  const dm = text.match(DATE_RE);
  if (!dm) return null; // 날짜가 없으면 대회 행이 아니다

  // 연도는 "| 2026 접수마감" 표기에서 읽고, 없으면 현재 연도로 둔다
  const year = text.match(YEAR_RE)?.[1] ?? String(new Date().getFullYear());
  const date = `${year}-${String(dm[1]).padStart(2, '0')}-${String(dm[2]).padStart(2, '0')}`;

  // '|' 앞 첫 구간에 날짜·거리·대회명·지역이 모여 있다
  const head = text.split('|')[0].trim();
  const distances = [...new Set((head.match(DISTANCE_RE) || []).map((d) => d.replace(/\s+/g, '')))];

  const headTokens = head.split(' ');
  const last = headTokens[headTokens.length - 1];
  const region = REGIONS.includes(last) ? last : null;

  // 대회명 = 첫 구간에서 날짜·요일·거리·지역을 걷어낸 나머지
  const title =
    head
      .replace(DATE_RE, '')
      .replace(/\([월화수목금토일]\)/, '')
      .replace(DISTANCE_RE, '')
      .replace(/걷기\s*(\([^)]*\))?/g, '')
      .replace(region ? new RegExp(`${region}\\s*$`) : /$^/, '')
      .replace(/\s+/g, ' ')
      .trim() || head;

  const period = text.match(PERIOD_RE);

  return {
    type: 'race',
    source: 'marathongo',
    title: title.slice(0, 120),
    date,
    region,
    distances,
    status: text.match(STATUS_RE)?.[1] ?? null,
    regOpen: period?.[1] ?? null,
    regClose: period?.[2] ?? null,
    link: href,
  };
}

export async function collect(source) {
  return withPage(source.url, async (page) => {
    // React가 목록을 그릴 때까지 기다린다. 안 뜨면 타임아웃 → 재시도 → 실패 알림
    await page.waitForSelector(ROW_SELECTOR, { timeout: 20000 });

    const rows = await page.$$eval(ROW_SELECTOR, (els) =>
      els.map((el) => ({
        text: el.innerText || el.textContent || '',
        href: el.getAttribute('href') || '',
      })),
    );

    const seen = new Set();
    const items = [];
    for (const r of rows) {
      const link = r.href ? new URL(r.href, source.url).toString() : null;
      if (link && seen.has(link)) continue;
      const item = parseRow(r.text, link);
      if (!item) continue;
      if (link) seen.add(link);
      items.push(item);
    }
    return items;
  });
}
