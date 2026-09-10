import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PATHS, OPEN_STATUS, REMIND } from '../config.js';

/**
 * 상태 파일 하나로 관리한다.
 *   data/state.json = { items: { <key>: { ...대회정보, status, firstSeen, lastSeen } } }
 *
 * 신규 항목만 보던 방식으로는 "이미 알던 대회의 접수가 열린 순간"을 놓친다.
 * 그래서 항목별 직전 상태를 같이 저장해두고 상태 변화를 비교한다.
 */

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/** 항목의 고유 키. 제목이 조금 바뀌어도 같은 건으로 보도록 링크를 우선한다. */
export function itemKey(item) {
  const basis = item.link || `${item.source}|${item.title}|${item.date || ''}`;
  return crypto.createHash('sha1').update(basis).digest('hex').slice(0, 12);
}

export const isOpen = (status) => !!status && OPEN_STATUS.test(status);

export function loadState() {
  const s = readJson(PATHS.state, { items: {} });
  if (!s.items) s.items = {};
  return s;
}

export function saveState(state) {
  writeJson(PATHS.state, state);
}

/**
 * 이번 수집분을 직전 상태와 비교한다.
 * @returns { newRaces, opened, state }
 *   newRaces : 처음 보는 대회
 *   opened   : 알던 대회인데 접수가 열린 것 (접수예정/마감 → 접수중)
 */
export function reconcile(items, state) {
  const today = new Date().toISOString().slice(0, 10);
  const newRaces = [];
  const opened = [];

  for (const it of items) {
    const key = itemKey(it);
    const prev = state.items[key];

    if (!prev) {
      newRaces.push(it);
    } else if (isOpen(it.status) && !isOpen(prev.status)) {
      opened.push({ ...it, prevStatus: prev.status ?? '알 수 없음' });
    }

    state.items[key] = {
      ...prev,
      ...it,
      // 상태를 못 읽은 회차가 있어도 직전 값을 잃지 않는다
      status: it.status ?? prev?.status ?? null,
      firstSeen: prev?.firstSeen ?? today,
      lastSeen: today,
    };
  }

  return { newRaces, opened, state };
}

/** 웹 화면과 API가 읽을 목록 */
export function listItems() {
  const state = loadState();
  return Object.values(state.items).sort((a, b) =>
    String(a.date || '9999').localeCompare(String(b.date || '9999')),
  );
}

/** "2026.09.30" 또는 "2026-09-30" → "2026-09-30" */
export function toISODate(v) {
  if (!v) return null;
  const m = String(v).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

const daysBetween = (fromISO, toISO) =>
  Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86400000);

/**
 * 접수 마감이 임박했는데 아직 신청 안 했을 법한 대회를 고른다.
 *
 * 조건
 *   - 접수중이고
 *   - 마감일이 오늘로부터 REMIND.daysBefore 이내 (이미 지난 마감은 제외)
 *   - 대회일이 아직 안 지났고
 *   - 최근 REMIND.cooldownDays 안에 리마인드한 적이 없다
 *
 * 고른 항목에는 remindedAt을 찍어 다음 실행에서 중복 발송되지 않게 한다.
 */
export function pickReminders(state, today) {
  const out = [];

  for (const [key, it] of Object.entries(state.items)) {
    if (!isOpen(it.status)) continue;
    if (it.date && it.date < today) continue;

    const close = toISODate(it.regClose);
    if (!close) continue;

    const dday = daysBetween(today, close);
    if (dday < 0 || dday > REMIND.daysBefore) continue;

    // 마감 당일(D-0)은 "마지막 기회"이므로 쿨다운과 무관하게 반드시 보낸다.
    // 쿨다운만 적용하면 D-1에 리마인드가 나간 대회는 D-0에 막히고, 그다음은
    // dday < 0 이라 영영 못 보내는 구멍이 생긴다.
    if (dday > 0 && it.remindedAt && daysBetween(it.remindedAt, today) < REMIND.cooldownDays) {
      continue;
    }

    out.push({ ...it, dday });
    state.items[key] = { ...it, remindedAt: today };
  }

  // 급한 것부터
  return out.sort((a, b) => a.dday - b.dday);
}
