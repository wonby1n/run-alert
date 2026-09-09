# 포팅 매뉴얼

run-alert를 새 환경에 설치하고 배포하기 위한 문서.

---

## 1. 개발 환경

### 1.1 버전

| 구분 | 항목 | 버전 | 비고 |
|---|---|---|---|
| 런타임 | Node.js | **22.x** | 20은 GitHub Actions에서 지원 종료 예고 |
| 패키지 매니저 | npm | 10.x 이상 | |
| 브라우저 자동화 | Playwright | **1.56.0** | 정확히 고정 (`^` 없음) |
| 브라우저 | Chromium | Playwright 1.56 번들 | `npx playwright install chromium` |
| 웹 서버 | Express | 4.19.x | |
| 파서 | fast-xml-parser | 4.4.x | RSS 소스용 |
| CI | GitHub Actions | ubuntu-latest | |

> **Playwright 버전을 고정한 이유**
> npm 패키지 버전과 브라우저 바이너리 빌드 번호가 1:1로 묶여 있다.
> `^1.56.0` 으로 두면 CI가 새 마이너를 받아오면서 캐시된 브라우저와 어긋나
> `Executable doesn't exist at .../chromium_headless_shell-XXXX` 로 깨진다.

### 1.2 지원 OS

Windows / macOS / Linux 모두 동작한다.

> **Windows 주의**
> npm 스크립트는 `cmd.exe`로 실행되므로 `VAR=1 node ...` 문법이 동작하지 않는다.
> 그래서 dry run은 환경변수가 아니라 `--dry` **플래그**로 받는다.
> (`process.env.DRY_RUN`도 함께 지원하므로 CI에서는 어느 쪽이든 된다.)

---

## 2. 설치

```bash
git clone https://github.com/wonby1n/run-alert.git
cd run-alert

npm install
npx playwright install chromium     # 브라우저 바이너리 (~150MB, 최초 1회)
```

`npm install`만으로는 브라우저가 안 깔린다. 위 두 번째 명령을 반드시 실행한다.

---

## 3. 환경 변수

`.env.example`을 복사해 `.env`를 만든다.

```bash
cp .env.example .env
```

| 변수 | 필수 | 설명 |
|---|---|---|
| `WEBHOOK_URL` | 선택 | Discord Incoming Webhook URL. 없으면 콘솔에만 출력한다 |
| `PORT` | 선택 | 웹 서버 포트 (기본 3000) |

> `.env`는 `.gitignore`에 포함돼 있다. **웹훅 URL은 그 자체가 인증 수단**이므로
> 코드나 커밋에 절대 넣지 않는다.

---

## 4. 외부 서비스 설정

### 4.1 Discord Webhook 발급

1. Discord에서 서버 생성 — 좌측 `+` → `직접 만들기` → `나와 친구들을 위한 서버`
2. 알림을 받을 채널 생성 (예: `#마라톤`)
3. 채널 우측 **톱니(채널 편집)** → `연동` → `웹후크` → `새 웹후크`
4. **웹후크 URL 복사**

### 4.2 로컬 적용

`.env`에 붙여넣는다.

```
WEBHOOK_URL=https://discord.com/api/webhooks/xxxxx/yyyyy
```

### 4.3 GitHub Actions 적용

레포지토리 → `Settings` → `Secrets and variables` → `Actions`
→ `New repository secret`

| Name | Value |
|---|---|
| `WEBHOOK_URL` | 발급받은 웹후크 URL |

### 4.4 연결 확인

```bash
npm run notify:test
```

샘플 알림 3종(마감 임박 / 접수 열림 / 신규 대회)이 Discord 채널에 도착하면 정상이다.

> 첫 수집(`npm run collect`)은 **시드 처리**라 알림을 보내지 않는다.
> 그래서 웹훅 연결 확인은 반드시 `notify:test`로 한다.

---

## 5. 실행

### 5.1 명령어

| 명령 | 설명 |
|---|---|
| `npm run probe -- <source-id>` | 대상 페이지 구조 분석 (셀렉터 확정용) |
| `npm run collect:dry` | 수집만 하고 알림·상태 저장 없이 결과 출력 |
| `npm run collect` | 실제 수집 → 판정 → 알림 → 상태 저장 |
| `npm run notify:test` | 웹훅 연결만 확인 |
| `npm run server` | 웹 화면 + API (http://localhost:3000) |
| `npm run test:e2e` | Playwright E2E 테스트 |

`source-id`: `marathongo`, `rankingmarathon`, `runneron`, `snkrs`, `hypebeast`

### 5.2 최초 구동 순서

```bash
npm run notify:test     # 1. 웹훅 확인
npm run collect:dry     # 2. 수집이 되는지 확인 (상태 변경 없음)
npm run collect         # 3. 첫 실행 — 상태만 저장, 알림 없음 (정상)
npm run collect         # 4. 두 번째부터 실제 변화만 알림
```

3번에서 알림이 안 오는 것이 **정상 동작**이다.
로그에 `"첫실행": true` 와 `초기 수집 — 상태만 저장하고 알림은 건너뜀`이 찍힌다.

---

## 6. 배포 (GitHub Actions)

별도 서버가 필요 없다. Actions가 스케줄러 겸 실행 환경이다.

### 6.1 워크플로우

| 파일 | 트리거 | 하는 일 |
|---|---|---|
| `.github/workflows/collect.yml` | `cron: '0 0 * * *'` (UTC) = 매일 09:00 KST, 수동 실행 가능 | 수집 → 알림 → `data/state.json` 커밋 |
| `.github/workflows/e2e.yml` | push / PR | Playwright E2E |

### 6.2 필요한 권한

`collect.yml`은 수집 결과를 리포지토리에 커밋한다. 따라서 다음이 필요하다.

- 워크플로우에 `permissions: contents: write` (이미 설정됨)
- 레포지토리 → `Settings` → `Actions` → `General` → `Workflow permissions`
  → **Read and write permissions** 선택

### 6.3 수동 실행

레포지토리 → `Actions` 탭 → `collect` → `Run workflow`

### 6.4 스케줄 변경

`collect.yml`의 cron은 **UTC 기준**이다. KST는 UTC+9이므로 9시간을 뺀다.

| 원하는 시각 (KST) | cron (UTC) |
|---|---|
| 매일 09:00 | `0 0 * * *` |
| 매일 07:00 | `0 22 * * *` |
| 매일 21:00 | `0 12 * * *` |

---

## 7. 설정 변경

모든 설정은 `src/config.js` 한 곳에 있다.

### 7.1 수집 대상 켜고 끄기

```js
export const SOURCES = [
  { id: 'marathongo', enabled: true,  /* ... */ },
  { id: 'snkrs',      enabled: false, /* ... */ },  // 끄기
];
```

> 새 사이트를 추가할 때는 **반드시 robots.txt를 먼저 확인**하고
> 판단 근거를 `note` 필드에 남긴다.

### 7.2 관심사 필터

```js
export const FILTERS = {
  regions: ['부산', '경남', '울산'],   // 빈 배열 = 전국
  distances: ['하프', '10km'],        // 빈 배열 = 전체 거리
  excludeKeywords: ['비대면'],        // 제외할 키워드
};
```

### 7.3 알림 규칙

```js
export const NOTIFY_RULES = {
  skipPastRaces: true,     // 지난 대회는 알리지 않음
  skipClosedRaces: true,   // 접수마감 대회를 '신규'로 알리지 않음
};

export const REMIND = {
  daysBefore: 3,           // 접수 마감 D-3 이내면 리마인드
  cooldownDays: 2,         // 같은 대회는 2일에 한 번까지만
};
```

### 7.4 접수중 표기 추가

사이트마다 `접수중` / `접수 중` / `신청중` 등으로 다르게 쓴다.
새 표기를 만나면 정규식에 추가한다.

```js
export const OPEN_STATUS = /접수\s*중|접수중|신청\s*중|접수\s*진행/;
```

---

## 8. 새 수집 소스 추가하기

1. **robots.txt 확인** — `https://<도메인>/robots.txt`
   허용되지 않으면 여기서 중단한다
2. `src/config.js`의 `SOURCES`에 항목 추가 (`note`에 robots.txt 확인 결과 기록)
3. `npm run probe -- <새-id>` 로 페이지 구조 확인
4. `src/sources/<새-id>.js` 작성 — `collect(source)` 를 export 하고
   아래 형태의 배열을 반환한다

```js
{
  type: 'race',
  source: '<새-id>',
  title: '대회명',
  date: 'YYYY-MM-DD',
  region: '부산',
  distances: ['하프', '10km'],
  status: '접수중',
  regOpen: 'YYYY.MM.DD',
  regClose: 'YYYY.MM.DD',
  link: 'https://...',
}
```

5. `src/collect.js`의 `COLLECTORS`에 등록
6. `npm run collect:dry` 로 확인

> **셀렉터 선택 원칙**: 클래스명을 쓰지 않는다.
> MUI·Tailwind 등은 빌드마다 클래스 해시가 바뀐다.
> 상세 링크 `href` 패턴처럼 잘 안 바뀌는 것을 앵커로 잡는다.

---

## 9. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `Executable doesn't exist at .../chromium_headless_shell-XXXX` | 브라우저 바이너리 미설치 또는 버전 불일치 | `npx playwright install chromium` |
| `'DRY_RUN'은(는) 내부 또는 외부 명령...` | Windows에서 환경변수 문법 사용 | `npm run collect:dry` (플래그 방식) 사용 |
| CI: `Dependencies lock file is not found` | `package-lock.json` 미커밋 | `npm install` 후 lock 파일 커밋 |
| 수집 `count: 0` 인데 에러 없음 | **셀렉터 드리프트** — 사이트 개편으로 셀렉터가 안 맞음 | `npm run probe -- <id>` 로 재확인 후 셀렉터 수정 |
| 알림이 안 옴 (첫 실행) | 시드 처리 — 의도된 동작 | 한 번 더 `npm run collect` |
| 알림이 안 옴 (그 외) | 웹훅 미설정 | `npm run notify:test` 로 확인 |
| CI에서 `git push` 실패 | 워크플로우 쓰기 권한 없음 | Settings → Actions → Read and write permissions |
| 대회명이 이상하게 잘림 | 대회명에 거리 표기가 섞임 (알려진 한계) | 알림 식별에는 지장 없음 |

### 로그 확인

- **로컬**: `data/run.log` (JSON 한 줄씩)
- **CI**: 해당 워크플로우 실행 → `Artifacts` → `run-log`
- **서버 기동 중**: `GET /api/health` — 마지막 로그와 저장된 항목 수를 반환

---

## 10. 데이터 초기화

상태를 처음부터 다시 쌓으려면 상태 파일을 비운다.

```bash
echo '{ "items": {} }' > data/state.json
```

다음 실행이 첫 실행으로 처리돼 알림 없이 상태만 다시 채운다.
