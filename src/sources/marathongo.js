import { withPage } from '../lib/browser.js';

/**
 * 마라톤GO 국내 대회 일정.
 *
 * 셀렉터 전략:
 *  클래스명 깊게 파고드는 셀렉터는 사이트 개편에 쉽게 깨진다.
 *  대신 "대회 상세로 가는 링크를 가진 행"을 앵커로 잡고, 행 안의 텍스트를
 *  정규식으로 파싱한다. 마크업이 바뀌어도 텍스트 형식이 유지되면 살아남는다.
 *
 *  ⚠️ ROW_SELECTOR는 실제 DOM을 보고 확정해야 한다.
 *     `npm run probe -- marathongo` 로 후보를 뽑은 뒤 채워 넣을 것.
 */
const ROW_SELECTOR = 'a[href*="/raceSchedule/"], li:has(a[href*="race"])';

const DATE_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const DISTANCE_RE = /(풀코스|풀|하프|\d+(?:\.\d+)?\s*km|\d+\s*K)/gi;
const STATUS_RE = /(접수중|접수마감|접수예정|접수전)/;

function parseRow(text, href) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 6) return null;

  const dm = clean.match(DATE_RE);
  if (!dm) return null; // 날짜 없는 행은 대회가 아니다

  const year = new Date().getFullYear();
  const month = String(dm[1]).padStart(2, '0');
  const day = String(dm[2]).padStart(2, '0');

  const distances = [...new Set((clean.match(DISTANCE_RE) || []).map((d) => d.replace(/\s+/g, '')))];
  const status = clean.match(STATUS_RE)?.[1] ?? null;

  // "경북 | 울릉도내 나리분지 | 16:30 집결" 형태에서 앞쪽 지역명을 뽑는다
  const region = clean.split('|')[0].trim().split(/\s+/).slice(-1)[0] ?? null;

  return {
    type: 'race',
    source: 'marathongo',
    title: clean.slice(0, 120),
    date: `${year}-${month}-${day}`,
    region,
    distances,
    status,
    link: href,
  };
}

export async function collect(source) {
  return withPage(source.url, async (page) => {
    const rows = await page.$$eval(ROW_SELECTOR, (els) =>
      els.map((el) => ({
        text: el.innerText || el.textContent || '',
        href: el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '',
      })),
    );

    const items = [];
    for (const r of rows) {
      const href = r.href ? new URL(r.href, source.url).toString() : null;
      const item = parseRow(r.text, href);
      if (item) items.push(item);
    }
    return items;
  });
}
