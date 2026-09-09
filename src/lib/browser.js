import { chromium } from 'playwright';
import { POLITENESS, RETRY } from '../config.js';
import { sleep } from './retry.js';

let browser;

export async function getBrowser() {
  if (!browser) browser = await chromium.launch();
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = undefined;
  }
}

/**
 * 페이지 하나를 열고 콜백을 실행한다.
 * - 이미지/폰트/미디어는 차단한다. 우리는 텍스트만 필요하고,
 *   상대 서버에 주는 부하도 줄어든다.
 * - 연락처가 담긴 UA를 붙인다.
 */
export async function withPage(url, fn) {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: POLITENESS.userAgent,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) return route.abort();
    return route.continue();
  });

  const page = await context.newPage();
  page.setDefaultTimeout(RETRY.timeoutMs);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: RETRY.timeoutMs });
    await sleep(POLITENESS.delayBetweenRequestsMs);
    return await fn(page);
  } finally {
    await context.close();
  }
}
