import { NOTIFY } from '../config.js';
import { log } from './logger.js';

async function post(payload) {
  if (!NOTIFY.webhookUrl) {
    log.warn('WEBHOOK_URL 미설정 — 콘솔로만 출력');
    console.log(payload.content);
    return;
  }
  const res = await fetch(NOTIFY.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`webhook ${res.status} ${await res.text()}`);
}

const line = (r) =>
  `• ${r.date ?? '날짜미정'} ${r.title}` +
  `${r.region ? ` (${r.region})` : ''}` +
  `${r.distances?.length ? ` — ${r.distances.join('/')}` : ''}` +
  `${r.regClose ? ` · 접수마감 ${r.regClose}` : ''}` +
  `${r.link ? `\n  ${r.link}` : ''}`;

/**
 * 알림 순서 = 급한 순서.
 *   1) 접수 마감 임박  — 지금 안 하면 못 나간다
 *   2) 접수 열림       — 오늘 신청할 수 있다
 *   3) 새로 올라온 대회 — 알아두면 되는 정보
 *
 * 셋 다 없으면 아무것도 보내지 않는다. 매일 "새 소식 없음"이 오면
 * 사람이 알림을 무시하기 시작하고, 그러면 정작 중요한 날에도 안 본다.
 */
export async function notifyEvents({ newRaces = [], opened = [], reminders = [] }) {
  if (!newRaces.length && !opened.length && !reminders.length) return;

  const lines = [];

  // 마감 임박이 맨 위다. 아침에 폰을 보는 3초 안에 "지금 해야 할 것"이 보여야 한다.
  if (reminders.length) {
    lines.push('**⏳ 접수 마감 임박**');
    for (const r of reminders.slice(0, 10)) {
      lines.push(line(r) + ` · **D-${r.dday}**`);
    }
    lines.push('');
  }

  if (opened.length) {
    lines.push('**🔔 접수 열림**');
    for (const r of opened.slice(0, 15)) lines.push(line(r));
    lines.push('');
  }

  if (newRaces.length) {
    lines.push('**🏃 새로 올라온 대회**');
    for (const r of newRaces.slice(0, 15)) {
      lines.push(line(r) + (r.status ? ` [${r.status}]` : ''));
    }
  }

  const total = reminders.length + newRaces.length + opened.length;
  if (total > 35) lines.push('', `…외 ${total - 35}건`);

  await post({ content: lines.join('\n').slice(0, 1900) });
}

/** 조용히 죽지 않게 하는 것이 이 자동화의 핵심 요구사항이다. */
export async function notifyFailure(summary) {
  if (!NOTIFY.notifyOnFailure) return;
  const lines = ['**⚠️ run-alert 수집 이상**'];
  for (const f of summary) lines.push(`• [${f.source}] ${f.reason}`);
  try {
    await post({ content: lines.join('\n').slice(0, 1900) });
  } catch (err) {
    log.error('실패 알림 자체가 실패', { error: err.message });
  }
}
