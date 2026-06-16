"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERMISSION_ACTIONS } from "@/lib/erp/menus";
import { cn } from "@/lib/utils";
import type { AppUserRole } from "@/db/schema";

type PermissionRow = {
  role: AppUserRole;
  menuKey: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canUpload: boolean;
};

type PermissionField = (typeof PERMISSION_ACTIONS)[number]["field"];

type PermissionMessage = {
  type: "success" | "error";
  text: string;
};

const roleLabels: Record<AppUserRole, string> = {
  admin: "관리자",
  employee: "사원",
};

const roleDescriptions: Partial<Record<AppUserRole, string>> = {
  admin: "모든 메뉴 권한 고정",
  employee: "메뉴별 권한 부여 대상",
};

const roleOrder: AppUserRole[] = ["employee", "admin"];

export function PermissionManager({
  initialRows,
  menus,
}: {
  initialRows: PermissionRow[];
  menus: { key: string; label: string }[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [savedRows, setSavedRows] = useState(initialRows);
  const [selectedRole, setSelectedRole] = useState<AppUserRole>("employee");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<PermissionMessage | null>(null);

  const availableRoles = useMemo(() => {
    const roles = new Set(initialRows.map((row) => row.role));
    return roleOrder.filter((role) => roles.has(role));
  }, [initialRows]);

  const selectedRows = useMemo(
    () => menus.map((menu) => getPermissionRow(rows, selectedRole, menu.key)),
    [menus, rows, selectedRole],
  );

  const savedSelectedRows = useMemo(
    () => menus.map((menu) => getPermissionRow(savedRows, selectedRole, menu.key)),
    [menus, savedRows, selectedRole],
  );

  const hasChanges = selectedRows.some((row, index) => !samePermission(row, savedSelectedRows[index]));
  const selectedViewCount = selectedRows.filter((row) => row.canView).length;
  const isFixedRole = selectedRole === "admin";

  function selectRole(role: AppUserRole) {
    setSelectedRole(role);
    setMessage(null);
  }

  function togglePermission(menuKey: string, field: PermissionField) {
    if (isFixedRole) {
      return;
    }

    setRows((current) =>
      current.map((row) => {
        if (row.role !== selectedRole || row.menuKey !== menuKey) {
          return row;
        }

        const nextValue = !row[field];
        const next = { ...row, [field]: nextValue };
        if (field === "canView" && !nextValue) {
          return {
            ...next,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canUpload: false,
          };
        }
        if (field !== "canView" && nextValue) {
          return { ...next, canView: true };
        }
        return next;
      }),
    );
    setMessage(null);
  }

  function applyMenuPreset(menuKey: string, preset: "all" | "view" | "none") {
    if (isFixedRole) {
      return;
    }

    setRows((current) =>
      current.map((row) => {
        if (row.role !== selectedRole || row.menuKey !== menuKey) {
          return row;
        }
        if (preset === "all") {
          return {
            ...row,
            canView: true,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            canUpload: true,
          };
        }
        if (preset === "view") {
          return {
            ...row,
            canView: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canUpload: false,
          };
        }
        return {
          ...row,
          canView: false,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          canUpload: false,
        };
      }),
    );
    setMessage(null);
  }

  function resetSelectedRole() {
    setRows((current) =>
      current.map((row) => {
        if (row.role !== selectedRole) {
          return row;
        }
        return getPermissionRow(savedRows, selectedRole, row.menuKey);
      }),
    );
    setMessage(null);
  }

  async function saveSelectedRole() {
    if (isFixedRole || !hasChanges) {
      return;
    }

    const payloadRows = selectedRows.map((row) => ({
      menuKey: row.menuKey,
      canView: row.canView,
      canCreate: row.canCreate,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      canUpload: row.canUpload,
    }));

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, rows: payloadRows }),
      });

      if (!response.ok) {
        throw new Error("권한 저장에 실패했습니다.");
      }

      const data = (await response.json()) as { rows?: PermissionRow[] };
      const nextRows = data.rows?.length
        ? data.rows.map((row) => normalizePermissionRow(row, selectedRole))
        : selectedRows;

      setSavedRows((current) => mergeRoleRows(current, selectedRole, nextRows));
      setRows((current) => mergeRoleRows(current, selectedRole, nextRows));
      setMessage({ type: "success", text: "선택한 권한의 메뉴 설정을 반영했습니다." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "권한 저장에 실패했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[#0d1b3d]">권한 관리</h1>
          <p className="mt-1 text-sm text-[#667085]">
            왼쪽에서 권한을 선택하고 오른쪽에서 메뉴별 CRUDU 권한을 설정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message ? (
            <span
              className={cn(
                "text-sm font-medium",
                message.type === "success" ? "text-[#087443]" : "text-[#b42318]",
              )}
            >
              {message.text}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isSaving || !hasChanges || isFixedRole}
            onClick={resetSelectedRole}
          >
            <RotateCcw className="size-4" />
            되돌리기
          </Button>
          <Button
            type="button"
            disabled={isSaving || !hasChanges || isFixedRole}
            onClick={saveSelectedRole}
          >
            <Save className="size-4" />
            {isSaving ? "반영 중" : "일괄 반영"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-[#dbe3ee] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">권한 선택</h2>
            <ShieldCheck className="size-4 text-[#2f70dc]" />
          </div>
          <div className="space-y-2">
            {availableRoles.map((role) => {
              const roleRows = menus.map((menu) => getPermissionRow(rows, role, menu.key));
              const grantedCount = roleRows.filter((row) => row.canView).length;
              const isSelected = role === selectedRole;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectRole(role)}
                  className={cn(
                    "w-full rounded-md border px-3 py-3 text-left transition-colors",
                    isSelected
                      ? "border-[#2f70dc] bg-[#eef5ff] text-[#12376f]"
                      : "border-[#e4eaf2] bg-white text-[#334155] hover:bg-[#f8fafc]",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{roleLabels[role]}</span>
                    <Badge variant={isSelected ? "default" : "outline"}>
                      {grantedCount}/{menus.length}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs text-[#667085]">
                    {roleDescriptions[role] ?? "메뉴 권한 설정"}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="overflow-hidden rounded-lg border border-[#dbe3ee] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6edf5] px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">
                {roleLabels[selectedRole]} 메뉴 권한
              </h2>
              <p className="mt-0.5 text-sm text-[#667085]">
                {selectedViewCount}개 메뉴 접근 허용
                {hasChanges && !isFixedRole ? " · 저장되지 않은 변경 있음" : ""}
              </p>
            </div>
            {isFixedRole ? (
              <Badge variant="outline">관리자 권한은 항상 전체 허용</Badge>
            ) : (
              <Badge variant={hasChanges ? "default" : "outline"}>
                {hasChanges ? "변경됨" : "저장됨"}
              </Badge>
            )}
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[minmax(220px,1fr)_repeat(5,92px)_176px] border-b border-[#e6edf5] bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-[#667085]">
                <span>메뉴</span>
                {PERMISSION_ACTIONS.map((action) => (
                  <span key={action.key} className="text-center">
                    {action.label}
                  </span>
                ))}
                <span className="text-center">빠른 설정</span>
              </div>

              <div className="divide-y divide-[#edf2f7]">
                {menus.map((menu) => {
                  const row = getPermissionRow(rows, selectedRole, menu.key);
                  const enabledCount = PERMISSION_ACTIONS.filter((action) => row[action.field]).length;

                  return (
                    <div
                      key={menu.key}
                      className="grid grid-cols-[minmax(220px,1fr)_repeat(5,92px)_176px] items-center px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#1f2937]">{menu.label}</div>
                        <div className="mt-0.5 text-xs text-[#7c8493]">
                          {enabledCount > 0 ? `${enabledCount}개 권한 허용` : "권한 없음"}
                        </div>
                      </div>

                      {PERMISSION_ACTIONS.map((action) => (
                        <label
                          key={action.key}
                          className="flex h-9 items-center justify-center"
                          title={`${menu.label} ${action.label}`}
                        >
                          <input
                            type="checkbox"
                            checked={row[action.field]}
                            disabled={isSaving || isFixedRole}
                            onChange={() => togglePermission(menu.key, action.field)}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "grid size-6 place-items-center rounded-md border text-white transition-colors",
                              row[action.field]
                                ? "border-[#2f70dc] bg-[#2f70dc]"
                                : "border-[#cfd8e3] bg-white",
                              (isSaving || isFixedRole) && "opacity-60",
                            )}
                            aria-hidden="true"
                          >
                            {row[action.field] ? <Check className="size-4" /> : null}
                          </span>
                        </label>
                      ))}

                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={isSaving || isFixedRole}
                          onClick={() => applyMenuPreset(menu.key, "all")}
                        >
                          전체
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={isSaving || isFixedRole}
                          onClick={() => applyMenuPreset(menu.key, "view")}
                        >
                          조회만
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={isSaving || isFixedRole}
                          onClick={() => applyMenuPreset(menu.key, "none")}
                        >
                          해제
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function getPermissionRow(rows: PermissionRow[], role: AppUserRole, menuKey: string): PermissionRow {
  return (
    rows.find((row) => row.role === role && row.menuKey === menuKey) ?? {
      role,
      menuKey,
      canView: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canUpload: false,
    }
  );
}

function samePermission(left: PermissionRow, right: PermissionRow) {
  return PERMISSION_ACTIONS.every((action) => left[action.field] === right[action.field]);
}

function normalizePermissionRow(row: PermissionRow, fallbackRole: AppUserRole): PermissionRow {
  return {
    role: row.role ?? fallbackRole,
    menuKey: row.menuKey,
    canView: row.canView,
    canCreate: row.canCreate,
    canUpdate: row.canUpdate,
    canDelete: row.canDelete,
    canUpload: row.canUpload,
  };
}

function mergeRoleRows(rows: PermissionRow[], role: AppUserRole, nextRows: PermissionRow[]) {
  const byMenuKey = new Map(nextRows.map((row) => [row.menuKey, row]));
  return rows.map((row) => {
    if (row.role !== role) {
      return row;
    }
    return byMenuKey.get(row.menuKey) ?? row;
  });
}
