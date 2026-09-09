import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PATHS } from '../config.js';

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

export function loadSeen() {
  return new Set(readJson(PATHS.seen, []));
}

export function saveSeen(set) {
  writeJson(PATHS.seen, [...set]);
}

/** 이번에 새로 나타난 것만 골라낸다. */
export function diffNew(items, seen) {
  return items.filter((it) => !seen.has(itemKey(it)));
}

/** 웹 화면과 API가 읽을 전체 목록 (최신 상태로 갱신) */
export function saveItems(items) {
  const prev = readJson(PATHS.items, []);
  const byKey = new Map(prev.map((it) => [itemKey(it), it]));
  for (const it of items) byKey.set(itemKey(it), { ...byKey.get(itemKey(it)), ...it });
  const merged = [...byKey.values()].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || '')),
  );
  writeJson(PATHS.items, merged);
  return merged;
}

export function loadItems() {
  return readJson(PATHS.items, []);
}
