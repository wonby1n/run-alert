/**
 * 웹훅 연결 확인용.
 *
 * 첫 수집은 상태만 저장하고 알림을 건너뛰기 때문에, 그것만으로는
 * 웹훅이 제대로 붙었는지 알 수 없다. 그래서 알림 경로만 따로 두드려본다.
 *
 * 사용법: npm run notify:test
 */
import { notifyEvents } from '../src/lib/notify.js';

await notifyEvents({
  reminders: [
    {
      title: '[테스트] 접수 마감 임박',
      date: '2026-10-25',
      region: '강원',
      distances: ['풀', '10km'],
      regClose: '2026.09.11',
      dday: 2,
      link: 'https://github.com/wonby1n/run-alert',
    },
  ],
  opened: [
    {
      title: '[테스트] 접수 열림 알림',
      date: '2026-10-12',
      region: '부산',
      distances: ['하프', '10km'],
      regClose: '2026.09.30',
      link: 'https://github.com/wonby1n/run-alert',
    },
  ],
  newRaces: [
    {
      title: '[테스트] 새로 올라온 대회',
      date: '2026-11-01',
      region: '경남',
      distances: ['10km'],
      status: '접수예정',
      link: 'https://github.com/wonby1n/run-alert',
    },
  ],
});

console.log('발송 시도 완료 — 디스코드 채널을 확인하세요.');
