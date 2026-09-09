import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config.js';

fs.mkdirSync(path.dirname(PATHS.log), { recursive: true });

function write(level, msg, meta) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {}),
  });
  console.log(line);
  fs.appendFileSync(PATHS.log, line + '\n');
}

export const log = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};
