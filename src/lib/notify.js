import { NOTIFY } from '../config.js';
import { log } from './logger.js';

async function post(payload) {
  if (!NOTIFY.webhookUrl) {
    log.warn('WEBHOOK_URL 미설정 — 콘솔로만 출력', { preview: payload.content?.slice(0, 200) });
    return;
  }
  const res = await fetch(NOTIFY.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`webhook ${res.status} ${await res.text()}`);
}

export async function notifyNewItems(items) {
  if (!items.length) return;
  const races = items.filter((i) => i.type === 'race');
  const drops = items.filter((i) => i.type === 'drop');

  const lines = ['**🏃 새로 올라온 소식**'];
  if (races.length) {
    lines.push('', '__대회__');
    for (const r of races.slice(0, 15)) {
      lines.push(`• ${r.date ?? '날짜미정'} ${r.title}${r.region ? ` (${r.region})` : ''}` +
        `${r.distances?.length ? ` — ${r.distances.join('/')}` : ''}` +
        `${r.status ? ` [${r.status}]` : ''}\n  ${r.link ?? ''}`);
    }
  }
  if (drops.length) {
    lines.push('', '__발매__');
    for (const d of drops.slice(0, 15)) {
      lines.push(`• ${d.date ?? ''} ${d.title}\n  ${d.link ?? ''}`);
    }
  }
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
