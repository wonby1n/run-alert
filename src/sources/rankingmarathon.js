import { withPage } from '../lib/browser.js';

/**
 * 랭킹마라톤.
 * robots.txt가 /api/ 를 막고 있으므로 내부 API는 건드리지 않고
 * 공개 페이지에 렌더된 결과만 읽는다.
 *
 * ⚠️ ROW_SELECTOR는 `npm run probe -- rankingmarathon` 결과로 확정할 것.
 */
const ROW_SELECTOR = 'a[href*="/race"], a[href*="/event"]';

const DATE_RE = /(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일/;

export async function collect(source) {
  return withPage(source.url, async (page) => {
    const rows = await page.$$eval(ROW_SELECTOR, (els) =>
      els.map((el) => ({
        text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') || '',
      })),
    );

    const seen = new Set();
    const items = [];
    for (const r of rows) {
      if (!r.text || r.text.length < 4) continue;
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
        source: 'rankingmarathon',
        title: r.text.slice(0, 120),
        date: `${year}-${month}-${day}`,
        region: null,
        distances: [],
        status: r.text.match(/(접수중|접수마감|접수예정)/)?.[1] ?? null,
        link,
      });
    }
    return items;
  });
}
