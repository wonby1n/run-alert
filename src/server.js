import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadItems } from './lib/store.js';
import { PATHS } from './config.js';
import { log } from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

/** 수집된 전체 목록. type=race|drop, region, from/to로 필터. */
app.get('/api/items', (req, res) => {
  const { type, region, from, to, q } = req.query;
  let items = loadItems();

  if (type) items = items.filter((i) => i.type === type);
  if (region) items = items.filter((i) => (i.region ?? '').includes(region) || i.title.includes(region));
  if (from) items = items.filter((i) => !i.date || i.date >= from);
  if (to) items = items.filter((i) => !i.date || i.date <= to);
  if (q) items = items.filter((i) => i.title.toLowerCase().includes(String(q).toLowerCase()));

  res.json({ count: items.length, items });
});

/** 마지막 수집이 언제 어떤 결과였는지. 모니터링용. */
app.get('/api/health', (req, res) => {
  let lastLine = null;
  try {
    const lines = fs.readFileSync(PATHS.log, 'utf8').trim().split('\n');
    lastLine = JSON.parse(lines[lines.length - 1]);
  } catch {}
  res.json({ ok: true, items: loadItems().length, lastLog: lastLine });
});

app.listen(PORT, () => log.info('server up', { port: PORT }));
