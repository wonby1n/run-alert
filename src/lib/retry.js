import { RETRY } from '../config.js';
import { log } from './logger.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 지수 백오프 재시도.
 * 네트워크나 렌더링은 원래 가끔 실패한다. 한 번 실패했다고 그날 수집을
 * 통째로 포기하지 않도록 감싼다.
 */
export async function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY.attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const isLast = attempt === RETRY.attempts;
      log.warn('attempt failed', {
        label,
        attempt,
        of: RETRY.attempts,
        error: err.message,
      });
      if (isLast) break;
      await sleep(RETRY.baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw new Error(`${label} 실패 (${RETRY.attempts}회 시도): ${lastErr?.message}`);
}
