# run-alert

러닝 대회 일정과 러닝화 발매 정보를 매일 한 번 수집해서, **새로 올라온 것만** 알려주는 자동화.

## 왜 만들었나

마라톤 대회는 주최가 제각각이라 정보가 여러 사이트에 흩어져 있다.
문제는 정보를 못 찾는 게 아니라 **접수 오픈을 놓치는 것**이다. 선착순으로 마감되는 대회가 많아서
며칠만 안 들여다봐도 못 나간다. 매일 사이트 서너 개를 도는 대신, 그 일을 자동화했다.

## 무엇을 하나

```
매일 09:00 (GitHub Actions 스케줄)
  │
  ├─ 마라톤GO 국내 대회 일정      ─ Playwright (API 없음)
  ├─ 랭킹마라톤 대회 일정          ─ Playwright (API 없음)
  ├─ Nike SNKRS 발매 예정          ─ Playwright (JS 렌더링)
  └─ Hypebeast KR 신발 카테고리    ─ 공식 RSS
  │
  ▼  관심 지역·거리·키워드로 필터
  ▼  이전 수집분과 비교해 신규 건만 추출
  ▼  Discord 알림 발송
  ▼  data/items.json 갱신 → Express API + 웹 화면이 읽음
```

## 설계에서 신경 쓴 것

### 1. 긁어도 되는 곳만 긁는다

수집 대상을 고르기 전에 각 사이트의 robots.txt를 확인하고, 결과를 `src/config.js`에 근거로 남겼다.

| 사이트 | 판단 | 근거 |
|---|---|---|
| 마라톤GO | 사용 | `User-agent: * / Allow: /` |
| 랭킹마라톤 | 사용 (공개 페이지만) | `Allow: /`, `Disallow: /api/` → 내부 API는 호출하지 않음 |
| Nike SNKRS | 사용 | `/kr/launch` 계열 허용 |
| Hypebeast KR | 사용 (RSS) | 공식 피드 제공 — 화면을 긁을 이유가 없다 |
| 무신사 | **제외** | 기본값이 `User-agent: * / Disallow: /`. 등록된 봇만 허용 |
| KREAM | **제외** | robots.txt 확인 불가 → 확인이 안 되면 하지 않는다 |

**API나 RSS가 있으면 화면을 긁지 않는다**는 것도 같은 원칙이다. Hypebeast는 크롤링 대상이 아니라
피드 소비 대상이다.

### 2. 상대 서버에 부담을 주지 않는다

마라톤 일정 사이트는 대부분 개인이나 소규모로 운영된다. 대기업 사이트처럼 다뤄선 안 된다.

- 하루 1회만 실행 (`schedule: '0 0 * * *'`)
- 요청 간 3초 딜레이 (`POLITENESS.delayBetweenRequestsMs`)
- 이미지·폰트·미디어 리소스는 차단 — 텍스트만 필요하고, 전송량도 줄어든다
- User-Agent에 연락처를 넣어 운영자가 로그를 보고 연락할 수 있게 했다
- 소스당 페이지 수 상한 — 페이지네이션 사고로 수백 번 요청하는 일을 막는다

### 3. 조용히 죽지 않게 한다

자동화의 진짜 실패는 에러가 나는 게 아니라 **아무 일도 안 하면서 성공한 척하는 것**이다.

- **재시도**: 지수 백오프로 3회 (2s → 4s → 8s)
- **실패 알림**: 3회 모두 실패하면 Discord로 알린다
- **셀렉터 드리프트 감지**: 사이트가 개편되면 셀렉터가 안 먹으면서도 예외는 안 난다.
  그래서 **"에러 없이 0건"을 성공이 아니라 이상 신호로 취급**하고 알림을 보낸다
- **종료 코드**: 문제가 있으면 CI에 빨간불이 뜨도록 `exitCode = 1`
- **구조화 로그**: JSON 한 줄씩 `data/run.log`에 남기고, 실패해도 아티팩트로 업로드

### 4. 셀렉터를 눈으로 찍지 않는다

`npm run probe -- <source-id>` 로 대상 페이지의 반복 클래스 조합과 링크 샘플을 뽑아
셀렉터를 정한다. 사이트가 개편돼도 같은 방법으로 다시 찾을 수 있다.

깊은 클래스 체인 대신 **"상세 링크를 가진 행"을 앵커로 잡고 행 텍스트를 정규식으로 파싱**한다.
마크업이 바뀌어도 텍스트 형식이 유지되면 살아남는다.

### 5. 화면도 테스트로 지킨다

알림이 조용히 망가지면 안 되므로 Express API와 웹 화면에 Playwright E2E 테스트를 붙이고
CI에서 돌린다. Playwright를 남의 사이트 긁는 데만 쓰는 게 아니라 원래 용도로도 쓴다.

## 시작하기

```bash
npm install
npx playwright install chromium

cp .env.example .env      # WEBHOOK_URL 채우기 (없으면 콘솔 출력)

npm run probe -- marathongo   # 셀렉터 확인
npm run collect:dry           # 알림 없이 수집 결과만 출력
npm run collect               # 실제 수집 + 알림

npm run server                # http://localhost:3000
npm run test:e2e              # E2E 테스트
```

## 구조

```
src/
  config.js            수집 대상, 필터, 예의 규칙, 재시도 정책
  collect.js           엔트리포인트: 수집 → 필터 → diff → 알림
  server.js            Express API + 정적 화면
  lib/
    browser.js         Playwright 컨텍스트 (UA, 리소스 차단)
    retry.js           지수 백오프
    store.js           수집분 저장과 신규 건 비교
    notify.js          Discord 알림 (신규 / 실패)
    logger.js          JSON 구조화 로그
  sources/
    marathongo.js      Playwright
    rankingmarathon.js Playwright
    snkrs.js           Playwright (JS 렌더링)
    hypebeast.js       RSS
tools/probe.mjs        셀렉터 탐색기
tests/e2e/             화면·API E2E
.github/workflows/     collect (스케줄) / e2e (PR)
```

## 알려진 한계

- 각 `sources/*.js`의 셀렉터는 실제 DOM을 보고 확정해야 한다 (`npm run probe`)
- 대회 연도를 현재 연도로 가정한다. 연말에 다음 해 대회가 섞이면 보정 필요
- 상태를 리포지토리에 커밋해 관리한다. 항목이 수천 건을 넘으면 SQLite로 옮기는 게 맞다
