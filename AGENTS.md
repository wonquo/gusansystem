<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 작업 루트
- GUSAN 현재 프로젝트의 실제 소스 경로는 `/Users/wonquo/Dev/06. GUSAN/gusan`이다.
- `/Users/wonquo/Documents/GUSAN`은 실제 앱 소스가 아니므로, GUSAN 작업은 위 경로를 기준으로 진행한다.

## 목적
이 저장소에서 Codex가 CRM 관리자 웹앱의 코드를 수정하거나 추가할 때 따라야 할 기본 규칙이다. 현재 프로젝트는 Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, Neon, shadcn/radix UI, AG Grid 기반이다.

## 기본 원칙
- 요청 범위를 벗어나는 리팩토링은 하지 않는다.
- 기존 동작을 바꾸는 수정은 최소 범위로 진행한다.
- 사용자가 요청하지 않은 의존성 추가는 피한다.
- 패키지 구조, 라우트 구조, DB 스키마를 임의로 재편하지 않는다.
- 변경 전 관련 화면, API route, lib 함수, DB schema/migration 영향 범위를 먼저 파악한다.
- `.env.local`, 실제 고객 데이터, 세션/비밀번호 관련 값은 노출하거나 커밋하지 않는다.
- `package-lock.json`이 있으므로 패키지 작업은 기본적으로 npm 기준으로 한다.

## 프로젝트 구조
- `src/app`: Next.js App Router 라우트, 레이아웃, 로딩 UI, API Route Handler를 둔다.
- `src/app/(crm)`: 로그인 후 CRM 화면 그룹이다. URL에는 `(crm)`이 포함되지 않는다.
- `src/app/api`: 고객, 사용자, 공지, 옵션, import 등 클라이언트에서 호출하는 Route Handler를 둔다.
- `src/components`: 화면별 컴포넌트와 `components/ui` shadcn 계열 공용 UI를 둔다.
- `src/lib`: 인증, 권한, 고객/공지/옵션 비즈니스 로직, import 파싱, 타입 변환을 둔다.
- `src/db`: Drizzle schema와 DB 접근 진입점을 둔다.
- `drizzle`: 생성된 migration 파일을 둔다.
- `scripts`: 운영성 스크립트와 import 스크립트를 둔다.

## Next.js / React 규칙
- 코드를 쓰기 전에 변경 영역에 맞는 `node_modules/next/dist/docs/` 문서를 먼저 확인한다.
  - 라우트/레이아웃: `01-app/01-getting-started/02-project-structure.md`
  - Server/Client Component: `01-app/01-getting-started/05-server-and-client-components.md`
  - mutation/server action: `01-app/01-getting-started/07-mutating-data.md`
  - route handler: `01-app/01-getting-started/15-route-handlers.md`
- App Router를 기준으로 작업하고 Pages Router를 추가하지 않는다.
- Server Component를 기본값으로 유지하고, `useState`, `useEffect`, 이벤트 핸들러, 브라우저 API가 필요한 작은 컴포넌트에만 `"use client"`를 붙인다.
- 서버 전용 로직에는 필요 시 `server-only`를 사용한다.
- DB 조회, 세션, 권한, 환경 변수 비밀값은 Client Component로 넘기지 않는다.
- Route Handler는 `Request`/`NextResponse` 패턴을 유지하고, 입력값은 가능한 한 zod로 검증한다.
- `GET` Route Handler의 캐싱/정적화 여부는 Next.js 16 문서를 확인하고 명시적으로 판단한다.

## TypeScript / 코드 스타일
- TypeScript 타입을 명확히 유지하고 불필요한 `any`를 피한다.
- `@/*` import alias를 사용한다.
- 기존 파일의 큰따옴표, 함수형 스타일, 직렬화 함수 패턴을 따른다.
- API 응답용 row 타입은 `src/lib/types.ts`를 우선 확인하고 재사용한다.
- 날짜는 DB 저장용 `Date`와 API 응답용 ISO 문자열 변환을 명확히 구분한다.
- 매직 넘버/매직 스트링은 반복되거나 도메인 의미가 있으면 상수로 분리한다.
- 불필요한 전역 상태를 추가하지 않는다.

## DB / Drizzle 규칙
- DB 접근은 `src/db/index.ts`의 `getDb()`를 통해 수행한다.
- Neon/Drizzle 클라이언트는 빌드 안정성을 위해 모듈 최상위에서 즉시 초기화하지 말고 lazy getter 패턴을 유지한다.
- `DATABASE_URL`이 없는 로컬/데모 흐름이 있는 함수는 기존 `hasDatabaseUrl()` fallback을 깨지 않는다.
- 스키마 변경은 `src/db/schema.ts`와 Drizzle migration을 함께 고려한다.
- schema를 바꿨다면 `npm run db:generate` 필요 여부를 확인한다.
- 운영 DB에 영향을 주는 `npm run db:push`는 사용자가 명시적으로 요청하거나 승인한 경우에만 실행한다.

## 인증 / 권한 규칙
- 현재 세션 쿠키는 `crm_session`이며 `src/lib/auth.ts`에서 관리한다.
- 로그인/로그아웃 흐름은 `src/lib/actions.ts`의 server action 패턴을 유지한다.
- 관리자/매니저/상담원 권한 체크는 `canManageUsers`, `canManageCustomers`, `canManageNotices` 같은 기존 helper를 우선 사용한다.
- 보호된 화면과 API는 `getCurrentAppUser()` 또는 `requireAppUser()`로 인증 상태를 확인한다.
- 비밀번호 해시, 세션 서명, 쿠키 옵션을 바꿀 때는 기존 로그인 유지/만료 동작을 함께 점검한다.

## CRM 도메인 규칙
- 고객 관리는 `customers`, `customerActivities`, `customerOptions`, import batch 관련 테이블과 연결된다.
- 고객 목록은 AG Grid 기반이며 페이지 크기, 필터, 정렬, 컬럼 너비 localStorage 동작을 함께 고려한다.
- 고객 데이터는 담당자별 접근 제한이 있으므로 `assignedUserId` 필터를 누락하지 않는다.
- 공지 관리는 고정 공지, 팝업 기간, 댓글 수, 작성자 표시를 함께 고려한다.
- 고객 옵션은 `source`, `status` 타입을 구분하고 정렬 순서와 활성 상태를 유지한다.
- 엑셀 import는 `exceljs`와 `src/lib/customer-import.ts`의 파싱 규칙을 따른다.
- 전화번호, 성별/연령대, 최종 연락일 파싱 로직을 변경할 때는 실제 import 행 스킵/정규화 영향까지 확인한다.

## UI / 프론트엔드 규칙
- 기존 shadcn/radix UI 컴포넌트와 `src/components/ui`를 우선 사용한다.
- 버튼에는 가능한 경우 `lucide-react` 아이콘을 함께 사용한다.
- CRM 운영 화면은 조용하고 밀도 있는 관리자 UI를 유지한다.
- 고객 목록처럼 반복 작업이 많은 화면은 스캔, 필터링, 수정, 저장 흐름을 우선한다.
- 로딩, 빈 상태, 실패 상태, 권한 없음 상태를 고려한다.
- 모바일 폭에서도 주요 액션과 폼 컨트롤이 겹치거나 잘리지 않게 한다.
- 삭제가 있는 모달 footer는 모바일과 데스크톱 모두 시각 순서를 `삭제` → `저장/등록` → `닫기/취소`로 둔다. 신규 작성처럼 삭제가 없으면 주요 액션을 닫기/취소보다 먼저 둔다.
- AG Grid 관련 변경은 행 id, 선택 상태, 편집 저장, 컬럼 크기 저장 동작을 확인한다.

## 작업 방식
1. 먼저 요구사항과 영향 범위를 짧게 정리한다.
2. 관련 파일을 읽고 기존 패턴을 확인한다.
3. 가장 영향이 적은 방식으로 수정한다.
4. 필요한 경우에만 새 파일을 추가한다.
5. 수정 후 lint/build 또는 관련 수동 검증 결과를 함께 정리한다.

## 금지 사항
- 사용자가 요청하지 않은 대규모 구조 변경
- 관련 없는 lint 수정이나 미사용 코드 대량 정리
- Pages Router 추가
- public API나 DB schema의 임의 변경
- 권한 체크 제거 또는 우회
- `.env.local` 내용 노출
- 테스트/빌드 실패 상태를 숨기고 완료 처리
- 사용자 승인 없는 운영 DB push, 배포, destructive git 명령

## 검증 명령
가능하면 아래 순서로 검증한다.

- `npm run lint`
- `npm run build`

DB schema 변경 시 추가로 확인한다.

- `npm run db:generate`
- `npm run db:push`는 명시 승인 후에만 실행

고객 import 변경 시 관련 파일 또는 샘플 데이터가 있으면 아래 흐름을 확인한다.

- `npm run import:customers`

개발 서버가 필요하면 아래 명령을 사용한다.

- `npm run dev`
- 기본 포트는 `3002`이다.

## 응답 형식
최종 응답에는 아래 내용을 포함한다.

- 작업 요약
- 변경한 파일
- 핵심 수정 내용
- 검증 결과
- 남은 리스크 또는 확인 필요 사항
