import { withPage } from '../lib/browser.js';

/**
 * 러너온 마라톤 대회 캘린더.
 * robots.txt가 /Marathon 은 허용하고 /api/ 와 /marathon/ics 는 막고 있으므로
 * 공개 캘린더 페이지에 렌더된 결과만 읽는다.
 *
 * ⚠️ ROW_SELECTOR는 `npm run probe -- runneron` 결과로 확정할 것.
 */
const ROW_SELECTOR = 'a[href*="/Marathon/"], li:has(a[href*="Marathon"])';

const DATE_RE = /(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일/;
const DISTANCE_RE = /(풀코스|풀|하프|\d+(?:\.\d+)?\s*km|\d+\s*K)/gi;
const STATUS_RE = /(접수중|접수 중|접수마감|접수예정|접수전|신청중)/;

export async function collect(source) {
  return withPage(source.url, async (page) => {
    const rows = await page.$$eval(ROW_SELECTOR, (els) =>
      els.map((el) => ({
        text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') || el.querySelector('a')?.getAttribute('href') || '',
      })),
    );

    const seen = new Set();
    const items = [];
    for (const r of rows) {
      if (!r.text || r.text.length < 6) continue;
      const m = r.text.match(DATE_RE);
      if (!m) continue;

      const year = m[1] ?? String(new Date().getFullYear());
      const month = String(m[2] ?? m[4]).padStart(2, '0');
      const day = String(m[3] ?? m[5]).padStart(2, '0');

      const link = r.href ? new URL(r.href, source.url).toString() : null;
      if (link && seen.has(link)) continue;
      if (link) seen.add(link);

      items.push({
        type: 'race',
        source: 'runneron',
        title: r.text.slice(0, 120),
        date: `${year}-${month}-${day}`,
        region: r.text.split('|')[0].trim().split(/\s+/).slice(-1)[0] ?? null,
        distances: [...new Set((r.text.match(DISTANCE_RE) || []).map((d) => d.replace(/\s+/g, '')))],
        status: r.text.match(STATUS_RE)?.[1] ?? null,
        link,
      });
    }
    return items;
  });
}
