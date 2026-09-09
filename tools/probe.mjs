/**
 * 셀렉터 탐색기.
 *
 * 사용법: npm run probe -- <source-id>
 *   예) npm run probe -- marathongo
 *
 * 대상 페이지를 열어 (1) 반복되는 클래스 조합 상위 목록과
 * (2) 링크를 가진 후보 행의 텍스트 샘플을 뽑아준다.
 * 이걸 보고 각 sources/*.js 의 ROW_SELECTOR / CARD_SELECTOR를 확정한다.
 *
 * 셀렉터를 눈으로 찍지 말고 이 스크립트로 근거를 남겨두면,
 * 나중에 사이트가 개편됐을 때 같은 방법으로 다시 찾을 수 있다.
 */
import { chromium } from 'playwright';
import { SOURCES, POLITENESS } from '../src/config.js';

const id = process.argv[2];
const source = SOURCES.find((s) => s.id === id);
if (!source) {
  console.error('사용법: npm run probe -- <source-id>');
  console.error('가능한 id:', SOURCES.map((s) => s.id).join(', '));
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: POLITENESS.userAgent, locale: 'ko-KR' });
const page = await context.newPage();

console.log('열기:', source.url);
await page.goto(source.url, { waitUntil: 'networkidle', timeout: 60000 });

const repeated = await page.evaluate(() => {
  const counts = {};
  document.querySelectorAll('*').forEach((el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).join('.') : '';
    if (!cls) return;
    const key = el.tagName.toLowerCase() + '.' + cls;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, v]) => v >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);
});

console.log('\n=== 반복되는 클래스 조합 (개수 순) ===');
for (const [sel, n] of repeated) console.log(String(n).padStart(4), sel);

const links = await page.evaluate(() =>
  [...document.querySelectorAll('a')]
    .map((a) => ({ href: a.getAttribute('href') || '', text: (a.innerText || '').replace(/\s+/g, ' ').trim() }))
    .filter((x) => x.text.length > 8)
    .slice(0, 20),
);

console.log('\n=== 링크 텍스트 샘플 ===');
for (const l of links) console.log('-', l.text.slice(0, 100), '\n  ->', l.href);

await page.screenshot({ path: `data/probe-${id}.png`, fullPage: false });
console.log(`\n스크린샷: data/probe-${id}.png`);

await browser.close();
