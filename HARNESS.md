# CRM Development Harness

이 파일은 CRM 프로젝트의 초기 개발 하네스입니다. 아직 코드가 없는 상태에서
기능 범위, 테스트 기준, 더미 데이터, 검증 시나리오를 한곳에 고정하기 위해
사용합니다.

## Product Scope

CRM의 첫 버전은 고객과 영업 활동을 안정적으로 기록하고 추적하는 것을
목표로 합니다.

- 고객사와 담당자 관리
- 리드, 딜, 파이프라인 관리
- 활동 로그 관리: 통화, 이메일, 미팅, 메모
- 태스크와 후속 조치 관리
- 기본 검색, 필터, 정렬
- 대시보드: 파이프라인 금액, 단계별 딜 수, 예정 태스크

## Core Entities

### Account

- id
- name
- industry
- ownerId
- status
- createdAt
- updatedAt

### Contact

- id
- accountId
- name
- email
- phone
- title
- createdAt
- updatedAt

### Lead

- id
- name
- company
- email
- source
- status
- ownerId
- createdAt
- updatedAt

### Deal

- id
- accountId
- name
- stage
- amount
- expectedCloseDate
- ownerId
- createdAt
- updatedAt

### Activity

- id
- relatedType
- relatedId
- type
- subject
- note
- occurredAt
- createdBy

### Task

- id
- relatedType
- relatedId
- title
- dueDate
- status
- assigneeId

## Seed Data

초기 개발과 테스트에는 아래 정도의 더미 데이터가 있으면 충분합니다.

- accounts: 10
- contacts: 30
- leads: 25
- deals: 20
- activities: 80
- tasks: 40

권장 딜 단계:

- Prospecting
- Qualification
- Proposal
- Negotiation
- Won
- Lost

권장 리드 상태:

- New
- Contacted
- Qualified
- Unqualified
- Converted

## Smoke Test Scenarios

첫 번째 구현부터 계속 유지할 최소 검증 시나리오입니다.

1. 고객사를 생성하고 목록에서 확인한다.
2. 고객사 상세 화면에서 담당자를 추가한다.
3. 리드를 생성하고 상태를 변경한다.
4. 리드를 딜로 전환한다.
5. 딜의 단계를 변경하고 파이프라인 화면에 반영되는지 확인한다.
6. 딜 또는 고객사에 활동 로그를 남긴다.
7. 후속 태스크를 만들고 완료 처리한다.
8. 검색어로 고객사, 담당자, 리드를 찾는다.
9. 대시보드의 단계별 딜 수와 총 금액이 데이터와 일치하는지 확인한다.

## Acceptance Checklist

새 기능을 완료했다고 보기 전에 아래 항목을 확인합니다.

- 빈 상태 화면이 있다.
- 로딩 상태가 있다.
- 실패 상태와 재시도 방법이 있다.
- 생성, 수정, 삭제 후 목록과 상세 화면이 갱신된다.
- 모바일 폭에서도 핵심 액션이 가려지지 않는다.
- 필수 입력값 검증이 있다.
- 날짜와 금액 표시 형식이 일관된다.
- 접근 권한이 필요한 기능은 권한 없는 사용자를 막는다.

## Future Automation Hooks

프로젝트가 만들어지면 이 하네스를 기준으로 아래 파일이나 명령을 연결합니다.

- `seed`: 더미 CRM 데이터를 생성한다.
- `test`: 단위 테스트와 통합 테스트를 실행한다.
- `smoke`: 핵심 사용자 흐름을 브라우저에서 검증한다.
- `lint`: 코드 스타일과 타입 문제를 확인한다.

## Notes

아직 기술 스택은 정하지 않았습니다. Next.js, React, Rails, Django, Laravel 등
어떤 스택을 선택하더라도 이 파일의 엔티티와 시나리오는 초기 기준으로 사용할
수 있습니다.
