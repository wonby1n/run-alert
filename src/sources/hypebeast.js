import { XMLParser } from 'fast-xml-parser';
import { POLITENESS, RETRY } from '../config.js';

/**
 * Hypebeast KR 공식 RSS.
 * 화면을 긁을 필요가 없다 — 피드가 제공되면 피드를 쓴다.
 * 이 판단 자체가 크롤러 설계의 기본이다.
 */
export async function collect(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': POLITENESS.userAgent, Accept: 'application/rss+xml, application/xml' },
    signal: AbortSignal.timeout(RETRY.timeoutMs),
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);

  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const feed = parser.parse(await res.text());
  const entries = feed?.rss?.channel?.item ?? [];

  return (Array.isArray(entries) ? entries : [entries])
    .map((e) => {
      const categories = []
        .concat(e.category ?? [])
        .map((c) => (typeof c === 'string' ? c : c?.['#text']))
        .filter(Boolean);
      return {
        type: 'drop',
        source: 'hypebeast',
        title: String(e.title ?? '').slice(0, 120),
        date: e.pubDate ? new Date(e.pubDate).toISOString().slice(0, 10) : null,
        link: e.link ?? null,
        categories,
      };
    })
    // 신발/스니커즈 카테고리만 남긴다
    .filter((it) => it.categories.some((c) => /신발|스니커|footwear|sneaker/i.test(c)));
}
