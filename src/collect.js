import { SOURCES, FILTERS, HEALTH } from './config.js';
import { log } from './lib/logger.js';
import { withRetry } from './lib/retry.js';
import { closeBrowser } from './lib/browser.js';
import { loadSeen, saveSeen, diffNew, saveItems, itemKey } from './lib/store.js';
import { notifyNewItems, notifyFailure } from './lib/notify.js';

import * as marathongo from './sources/marathongo.js';
import * as rankingmarathon from './sources/rankingmarathon.js';
import * as snkrs from './sources/snkrs.js';
import * as hypebeast from './sources/hypebeast.js';

const COLLECTORS = { marathongo, rankingmarathon, snkrs, hypebeast };

/** 관심사 필터. 조건이 비어 있으면 통과시킨다. */
function matchesInterest(item) {
  if (item.type === 'race') {
    const regionOk =
      !FILTERS.regions.length ||
      !item.region ||
      FILTERS.regions.some((r) => (item.title + ' ' + item.region).includes(r));
    const distOk =
      !FILTERS.distances.length ||
      !item.distances?.length ||
      item.distances.some((d) => FILTERS.distances.some((f) => d.includes(f)));
    return regionOk && distOk;
  }
  if (item.type === 'drop') {
    if (!FILTERS.keywords.length) return true;
    const hay = `${item.title} ${item.raw ?? ''}`.toLowerCase();
    return FILTERS.keywords.some((k) => hay.includes(k.toLowerCase()));
  }
  return true;
}

async function main() {
  const started = Date.now();
  const problems = [];
  const all = [];

  for (const source of SOURCES.filter((s) => s.enabled)) {
    const mod = COLLECTORS[source.id];
    if (!mod) {
      problems.push({ source: source.id, reason: '수집기 미구현' });
      continue;
    }
    try {
      const items = await withRetry(source.id, () => mod.collect(source));
      log.info('수집 완료', { source: source.id, count: items.length });

      // 에러 없이 0건 = 셀렉터가 깨졌을 가능성. 성공으로 치지 않는다.
      if (items.length < HEALTH.minItemsPerSource) {
        problems.push({
          source: source.id,
          reason: `에러 없이 ${items.length}건 — 셀렉터 확인 필요`,
        });
      }
      all.push(...items);
    } catch (err) {
      log.error('수집 실패', { source: source.id, error: err.message });
      problems.push({ source: source.id, reason: err.message });
    }
  }

  await closeBrowser();

  const interesting = all.filter(matchesInterest);
  const seen = loadSeen();
  const fresh = diffNew(interesting, seen);

  log.info('집계', {
    수집: all.length,
    관심사통과: interesting.length,
    신규: fresh.length,
    소요초: Math.round((Date.now() - started) / 1000),
  });

  saveItems(interesting);

  if (process.env.DRY_RUN) {
    console.log(JSON.stringify(fresh.slice(0, 20), null, 2));
    return;
  }

  if (fresh.length) {
    await notifyNewItems(fresh);
    for (const it of fresh) seen.add(itemKey(it));
    saveSeen(seen);
  }

  if (problems.length) {
    await notifyFailure(problems);
    // CI에서 빨간불이 뜨도록 종료 코드를 남긴다
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  log.error('치명적 오류', { error: err.message, stack: err.stack });
  await notifyFailure([{ source: 'collect', reason: err.message }]).catch(() => {});
  await closeBrowser().catch(() => {});
  process.exit(1);
});
