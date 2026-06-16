import type { AppUserRole } from "@/db/schema";

export type ErpMenuKey =
  | "dashboard"
  | "board"
  | "calendar"
  | "projects"
  | "tax-invoices"
  | "bank"
  | "payroll"
  | "my-payroll"
  | "imports"
  | "permissions";

export type PermissionAction = "view" | "create" | "update" | "delete" | "upload";

export const ERP_MENUS: {
  key: ErpMenuKey;
  label: string;
  href: string;
  adminOnly?: boolean;
}[] = [
  { key: "dashboard", label: "대시보드", href: "/dashboard" },
  { key: "board", label: "게시판", href: "/board" },
  { key: "calendar", label: "캘린더", href: "/calendar" },
  { key: "projects", label: "프로젝트 관리", href: "/projects" },
  { key: "tax-invoices", label: "전자세금계산서", href: "/tax-invoices" },
  { key: "bank", label: "법인통장", href: "/bank" },
  { key: "payroll", label: "급여대장", href: "/payroll", adminOnly: true },
  { key: "my-payroll", label: "내 급여명세서", href: "/my-payroll" },
  { key: "imports", label: "업로드 이력", href: "/imports" },
  { key: "permissions", label: "권한 관리", href: "/permissions", adminOnly: true },
];

export const PERMISSION_ACTIONS: {
  key: PermissionAction;
  label: string;
  field: "canView" | "canCreate" | "canUpdate" | "canDelete" | "canUpload";
}[] = [
  { key: "view", label: "조회", field: "canView" },
  { key: "create", label: "등록", field: "canCreate" },
  { key: "update", label: "수정", field: "canUpdate" },
  { key: "delete", label: "삭제", field: "canDelete" },
  { key: "upload", label: "업로드", field: "canUpload" },
];

export function isMenuVisibleForRole(role: AppUserRole, menuKey: ErpMenuKey) {
  if (role === "admin") {
    return true;
  }
  return menuKey === "board" || menuKey === "calendar" || menuKey === "my-payroll";
}
