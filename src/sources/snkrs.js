import { withPage } from '../lib/browser.js';

/**
 * Nike SNKRS 발매 예정.
 * 이 페이지는 자바스크립트로 그려지기 때문에 HTTP 요청만으로는 내용이 비어 있다.
 * Playwright가 실제로 필요한 대상.
 *
 * ⚠️ CARD_SELECTOR는 `npm run probe -- snkrs` 로 확정할 것.
 */
const CARD_SELECTOR = 'figure[data-testid*="product"], a[href*="/launch/t/"]';

export async function collect(source) {
  return withPage(source.url, async (page) => {
    // 카드가 붙을 때까지 기다린다. 없으면 타임아웃 → 재시도 → 실패 알림으로 이어진다.
    await page.waitForSelector(CARD_SELECTOR, { timeout: 20000 }).catch(() => {});

    const cards = await page.$$eval(CARD_SELECTOR, (els) =>
      els.map((el) => {
        const a = el.tagName === 'A' ? el : el.querySelector('a');
        return {
          text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
          href: a?.getAttribute('href') || '',
        };
      }),
    );

    const seen = new Set();
    const items = [];
    for (const c of cards) {
      if (!c.text) continue;
      const link = c.href ? new URL(c.href, 'https://www.nike.com').toString() : null;
      if (link && seen.has(link)) continue;
      if (link) seen.add(link);

      // 카드 텍스트 첫 줄이 보통 발매일, 그 다음이 제품명
      const [first, ...rest] = c.text.split(' ');
      items.push({
        type: 'drop',
        source: 'snkrs',
        title: c.text.slice(0, 120),
        date: /\d/.test(first) ? c.text.match(/\d{1,2}\/\d{1,2}|\d{1,2}월\s*\d{1,2}일/)?.[0] ?? null : null,
        link,
        raw: rest.join(' ').slice(0, 200),
      });
    }
    return items;
  });
}
