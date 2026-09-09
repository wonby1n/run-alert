import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PATHS, OPEN_STATUS } from '../config.js';

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
