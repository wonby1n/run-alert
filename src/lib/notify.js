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
  `${r.link ? `\n  ${r.link}` : ''}`;

/**
 * 접수 오픈을 신규 대회보다 먼저 보여준다.
 * 선착순 마감 때문에 사용자가 당장 움직여야 하는 건 이쪽이다.
 */
export async function notifyEvents({ newRaces = [], opened = [] }) {
  if (!newRaces.length && !opened.length) return;

  const lines = [];

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

  const total = newRaces.length + opened.length;
  if (total > 30) lines.push('', `…외 ${total - 30}건`);

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
