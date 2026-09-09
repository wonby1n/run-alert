import { SOURCES, FILTERS, HEALTH, NOTIFY_RULES } from './config.js';
import { log } from './lib/logger.js';
import { withRetry } from './lib/retry.js';
import { closeBrowser } from './lib/browser.js';
import { loadState, saveState, reconcile, pickReminders } from './lib/store.js';
import { notifyEvents, notifyFailure } from './lib/notify.js';

import * as marathongo from './sources/marathongo.js';
import * as rankingmarathon from './sources/rankingmarathon.js';
import * as runneron from './sources/runneron.js';
import * as snkrs from './sources/snkrs.js';
import * as hypebeast from './sources/hypebeast.js';

const COLLECTORS = { marathongo, rankingmarathon, runneron, snkrs, hypebeast };

// 윈도우에서 npm 스크립트는 cmd로 실행돼 `VAR=1 node ...` 문법이 안 먹는다.
// OS를 타지 않도록 플래그를 우선으로 하고 환경변수도 함께 받는다.
const DRY_RUN = process.argv.includes('--dry') || !!process.env.DRY_RUN;

/** 관심사 필터. 조건이 비어 있으면 그 항목은 적용하지 않는다. */
function matchesInterest(item) {
  const hay = `${item.title} ${item.region ?? ''}`;

  if (FILTERS.excludeKeywords.length && FILTERS.excludeKeywords.some((k) => hay.includes(k))) {
    return false;
  }
  if (FILTERS.regions.length && !FILTERS.regions.some((r) => hay.includes(r))) {
    return false;
  }
  if (FILTERS.distances.length) {
    // 거리를 못 읽은 항목은 버리지 않는다 — 놓치는 것보다 한 번 더 보는 게 낫다
    if (item.distances?.length && !item.distances.some((d) => FILTERS.distances.some((f) => d.includes(f)))) {
      return false;
    }
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

  const today = new Date().toISOString().slice(0, 10);
  const interesting = all.filter(matchesInterest);
  const state = loadState();
  const hadState = Object.keys(state.items).length > 0;
  const isFirstRunGuard = !hadState;
  const { newRaces, opened } = reconcile(interesting, state);

  // 리마인드는 이번에 수집된 것뿐 아니라 저장된 전체를 대상으로 한다.
  // 대회가 목록에서 잠깐 안 보이더라도 마감은 다가오기 때문이다.
  const reminders = isFirstRunGuard ? [] : pickReminders(state, today);

  // 어느 소스가 몇 건 들어와 몇 건 살아남았는지 — 필터를 튜닝하려면 이게 보여야 한다
  const countBy = (arr) => arr.reduce((a, i) => ((a[i.source] = (a[i.source] ?? 0) + 1), a), {});

  log.info('집계', {
    수집: all.length,
    소스별: countBy(all),
    관심사통과: interesting.length,
    통과소스별: countBy(interesting),
    신규대회: newRaces.length,
    접수열림: opened.length,
    마감임박: reminders.length,
    첫실행: !hadState,
    소요초: Math.round((Date.now() - started) / 1000),
  });

  // 첫 실행은 전부가 '신규'다. 그대로 알리면 수백 건 폭탄이 되므로
  // 상태만 저장하고 알림은 건너뛴다. 다음 실행부터가 진짜 변화다.
  const isFirstRun = !hadState;
  const worthNotifying = (r) => {
    if (NOTIFY_RULES.skipPastRaces && r.date && r.date < today) return false;
    if (NOTIFY_RULES.skipClosedRaces && r.status === '접수마감') return false;
    return true;
  };
  const newToNotify = newRaces.filter(worthNotifying);

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          isFirstRun,
          마감임박: reminders,
          접수열림: opened,
          알림대상신규: newToNotify.slice(0, 20),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (isFirstRun) {
    log.info('초기 수집 — 상태만 저장하고 알림은 건너뜀', { saved: newRaces.length });
  } else if (newToNotify.length || opened.length || reminders.length) {
    await notifyEvents({ newRaces: newToNotify, opened, reminders });
  }
  saveState(state);

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
