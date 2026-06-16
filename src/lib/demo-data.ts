import type { CustomerRow } from "./types";
import { SALES_POTENTIAL_OPTIONS } from "./sales-potential";

const sources = ["회사디비", "지산동", "수성구팀장님", "웅팀장님 맞디비"];
const statuses = ["다시 전화", "블랙", "재통", "타지역", "부동산", "아파트", "신규"];
const genders = ["남자", "여자", null];
const ages = ["30대", "40대", "50대", "60대", "70대", null];
const owners = ["한동수", "최재립", "관리자", "미배정"];

export function getDemoCustomers(count = 3004): CustomerRow[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `demo-${index + 1}`;
    const phoneTail = String(1000 + index).slice(-4);
    const source = sources[index % sources.length];
    const status = statuses[index % statuses.length];
    const updated = new Date(Date.UTC(2026, 4, 18, 9, index % 60, 0));

    return {
      id,
      source,
      salesPotential: SALES_POTENTIAL_OPTIONS[index % SALES_POTENTIAL_OPTIONS.length],
      phone: `010-${String(2000 + (index % 7000)).padStart(4, "0")}-${phoneTail}`,
      gender: genders[index % genders.length],
      ageDecade: ages[index % ages.length],
      status,
      callNote:
        index % 5 === 0
          ? "방문 가능 시간 재확인 필요"
          : index % 3 === 0
            ? "부재, 문자 발송 완료"
            : "상담 메모 대기",
      lastContactedAt: new Date(Date.UTC(2026, 4, 1 + (index % 18))).toISOString(),
      lastContactedLabel: `05월 ${1 + (index % 18)}일`,
      orderNote: index % 7 === 0 ? "범어 롯데캐슬 관심" : null,
      remark: index % 11 === 0 ? "우선 확인" : null,
      tags: index % 9 === 0 ? ["관심"] : [],
      assignedUserId: null,
      assignedUserName: owners[index % owners.length],
      createdAt: updated.toISOString(),
      updatedAt: updated.toISOString(),
    };
  });
}

export function getDemoUsers() {
  return [
    {
      id: "demo-admin",
      employeeCode: "ADMIN",
      loginId: "admin",
      email: "admin@example.com",
      name: "관리자",
      profileImageUrl: null,
      role: "admin" as const,
      status: "active" as const,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "demo-employee",
      employeeCode: "EMP-001",
      loginId: "employee",
      email: "employee@example.com",
      name: "사원",
      profileImageUrl: null,
      role: "employee" as const,
      status: "active" as const,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
