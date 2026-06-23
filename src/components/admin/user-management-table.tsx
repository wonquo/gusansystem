"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { KeyRound, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getProfileImageDisplayUrl } from "@/lib/profile-image";
import type { AppUserRow } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

type UserRole = AppUserRow["role"];
type UserStatus = AppUserRow["status"];

type CreateUserForm = {
  loginId: string;
  employeeCode: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  status: UserStatus;
};

type EditUserForm = {
  id: string;
  loginId: string;
  employeeCode: string;
  email: string;
  name: string;
  profileImageUrl: string;
  password: string;
  role: UserRole;
  status: UserStatus;
};

type UserFilters = {
  query: string;
  role: "all" | UserRole;
  status: "all" | UserStatus;
};

const initialCreateForm: CreateUserForm = {
  loginId: "",
  employeeCode: "",
  email: "",
  name: "",
  password: "",
  role: "employee",
  status: "active",
};

const initialFilters: UserFilters = {
  query: "",
  role: "all",
  status: "all",
};

const roleLabels: Record<UserRole, string> = {
  admin: "관리자",
  employee: "사원",
};

const statusLabels: Record<UserStatus, string> = {
  active: "사용",
  invited: "초대",
  disabled: "중지",
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = seoul.getUTCFullYear();
  const month = String(seoul.getUTCMonth() + 1).padStart(2, "0");
  const day = String(seoul.getUTCDate()).padStart(2, "0");
  const hours = String(seoul.getUTCHours()).padStart(2, "0");
  const minutes = String(seoul.getUTCMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

export function UserManagementTable({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AppUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [draftFilters, setDraftFilters] = useState<UserFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<UserFilters>(initialFilters);
  const [createForm, setCreateForm] = useState<CreateUserForm>(initialCreateForm);
  const [editForm, setEditForm] = useState<EditUserForm | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !query ||
        [
          user.employeeCode,
          user.name,
          user.loginId,
          user.email,
          roleLabels[user.role],
          statusLabels[user.status],
        ].some((value) => String(value ?? "").toLowerCase().includes(query));
      const matchesRole = appliedFilters.role === "all" || user.role === appliedFilters.role;
      const matchesStatus =
        appliedFilters.status === "all" || user.status === appliedFilters.status;

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [appliedFilters, users]);

  const columnDefs = useMemo<ColDef<AppUserRow>[]>(
    () => [
      {
        colId: "rowNumber",
        headerName: "No",
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        pinned: "left",
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        cellClass: "erp-grid-cell erp-grid-cell-row-number",
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      },
      {
        colId: "profileImage",
        headerName: "사진",
        width: 72,
        minWidth: 72,
        maxWidth: 72,
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        cellClass: "erp-grid-cell flex items-center justify-center",
        cellRenderer: (params: ICellRendererParams<AppUserRow>) =>
          params.data ? <UserAvatar user={params.data} /> : null,
      },
      {
        field: "employeeCode",
        headerName: "사원코드",
        width: 120,
        cellClass: "erp-grid-cell erp-grid-cell-date",
        valueFormatter: (params) => params.value || "-",
      },
      {
        field: "name",
        headerName: "이름",
        width: 140,
        cellRenderer: (params: ICellRendererParams<AppUserRow>) =>
          params.data ? (
            <span className="block truncate font-semibold">{params.data.name}</span>
          ) : null,
      },
      {
        field: "loginId",
        headerName: "로그인 ID",
        width: 150,
        cellClass: "erp-grid-cell erp-grid-cell-date",
      },
      { field: "email", headerName: "이메일", minWidth: 220, flex: 1 },
      {
        field: "role",
        headerName: "역할",
        width: 110,
        valueFormatter: (params) => (params.value ? roleLabels[params.value as UserRole] : "-"),
      },
      {
        field: "status",
        headerName: "상태",
        width: 100,
        valueFormatter: (params) => (params.value ? statusLabels[params.value as UserStatus] : "-"),
      },
      {
        field: "lastLoginAt",
        headerName: "최근 로그인",
        width: 150,
        cellClass: "erp-grid-cell erp-grid-cell-date",
        valueFormatter: (params) => formatDateTime(params.value ?? null),
      },
      {
        colId: "actions",
        headerName: "관리",
        width: 92,
        pinned: "right",
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<AppUserRow>) => {
          const row = params.data;
          return row ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              onClick={(event) => {
                event.stopPropagation();
                openEditDialog(row);
              }}
            >
              수정
            </Button>
          ) : null;
        },
      },
    ],
    [],
  );

  function applyFilters() {
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }

  function openEditDialog(user: AppUserRow) {
    setEditForm({
      id: user.id,
      loginId: user.loginId,
      employeeCode: user.employeeCode ?? "",
      email: user.email,
      name: user.name,
      profileImageUrl: user.profileImageUrl ?? "",
      password: "",
      role: user.role,
      status: user.status,
    });
    setEditError(null);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await response.json();

    setIsCreating(false);

    if (!response.ok) {
      setCreateError(data.error ?? "계정을 추가하지 못했습니다.");
      return;
    }

    setUsers((current) => [data.user, ...current]);
    setCreateForm(initialCreateForm);
    setIsCreateOpen(false);
    router.refresh();
  }

  async function saveEditedUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) {
      return;
    }

    setEditError(null);
    setIsSavingEdit(true);

    const response = await fetch(`/api/users/${editForm.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginId: editForm.loginId,
        employeeCode: editForm.employeeCode,
        email: editForm.email,
        name: editForm.name,
        profileImageUrl: editForm.profileImageUrl,
        ...(editForm.password.trim() ? { password: editForm.password } : {}),
        role: editForm.role,
        status: editForm.status,
      }),
    });
    const data = await response.json();

    setIsSavingEdit(false);

    if (!response.ok) {
      setEditError(data.error ?? "계정을 수정하지 못했습니다.");
      return;
    }

    mergeUser(editForm.id, data.user);
    setEditForm(null);
    router.refresh();
  }

  async function deleteUser(user: Pick<AppUserRow, "id" | "name">) {
    if (user.id === currentUserId) {
      setEditError("현재 로그인한 사용자는 삭제할 수 없습니다.");
      return;
    }
    if (!window.confirm(`${user.name} 사용자를 삭제할까요? 연결된 사원 정보는 유지되고 계정 연결만 해제됩니다.`)) {
      return;
    }

    setEditError(null);
    setIsDeletingId(user.id);

    const response = await fetch(`/api/users/${user.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    setIsDeletingId(null);

    if (!response.ok) {
      setEditError(data.error ?? "사용자를 삭제하지 못했습니다.");
      return;
    }

    setUsers((current) => current.filter((currentUser) => currentUser.id !== user.id));
    if (editForm?.id === user.id) {
      setEditForm(null);
    }
    router.refresh();
  }

  function mergeUser(id: string, patch: Partial<AppUserRow>) {
    setUsers((current) =>
      current.map((user) => (user.id === id ? { ...user, ...patch } : user)),
    );
  }

  return (
    <div className="crm-erp-surface mx-auto min-h-[calc(100vh-9rem)] max-w-[1680px]">
      <section className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h1 className="hidden text-base font-semibold tracking-tight text-[#0d1b3d] md:block">사용자 목록</h1>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]">
          <div className="grid gap-px bg-[#edf1f6] p-px lg:grid-cols-[88px_minmax(220px,1fr)_68px_minmax(150px,180px)_68px_minmax(150px,180px)_148px]">
            <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
              검색어
            </div>
            <div className="bg-white p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
                <Input
                  value={draftFilters.query}
                  onChange={(event) =>
                    setDraftFilters((filters) => ({ ...filters, query: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      applyFilters();
                    }
                  }}
                  placeholder="사원코드, 이름, 로그인 ID, 이메일 검색"
                  className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                />
              </div>
            </div>
            <FilterLabel>역할</FilterLabel>
            <div className="bg-white p-2">
              <Select
                value={draftFilters.role}
                onValueChange={(role: UserFilters["role"]) =>
                  setDraftFilters((filters) => ({ ...filters, role }))
                }
              >
                <SelectTrigger className="h-8 w-full border-[#d8e0ea]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="employee">사원</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FilterLabel>상태</FilterLabel>
            <div className="bg-white p-2">
              <Select
                value={draftFilters.status}
                onValueChange={(status: UserFilters["status"]) =>
                  setDraftFilters((filters) => ({ ...filters, status }))
                }
              >
                <SelectTrigger className="h-8 w-full border-[#d8e0ea]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="active">사용</SelectItem>
                  <SelectItem value="invited">초대</SelectItem>
                  <SelectItem value="disabled">중지</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 bg-[#f8fafc] p-2">
              <Button type="button" size="sm" className="flex-1 justify-center" onClick={applyFilters}>
                <Search className="size-3.5" />
                조회
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex-1 justify-center" onClick={resetFilters}>
                <RefreshCw className="size-3.5" />
                초기화
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className="h-7 border-[#cfd9e7] bg-white px-2.5 text-xs">
            {filteredUsers.length.toLocaleString()}건
          </Badge>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="sm">
                <Plus className="size-3.5" />
                사용자 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-md">
              <UserForm
                mode="create"
                form={createForm}
                error={createError}
                isSaving={isCreating}
                onSubmit={createUser}
                onCancel={() => setIsCreateOpen(false)}
                onChange={setCreateForm}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_10px_34px_rgba(15,28,48,0.06)]">
          <div className="ag-theme-quartz erp-grid h-[calc(100vh-20rem)] min-h-[420px] w-full">
            <AgGridReact<AppUserRow>
              rowData={filteredUsers}
              columnDefs={columnDefs}
              getRowId={(params) => params.data.id}
              rowSelection="single"
              animateRows={false}
              theme="legacy"
              defaultColDef={{
                minWidth: 100,
                sortable: true,
                resizable: true,
                filter: true,
                suppressHeaderMenuButton: true,
                cellClass: "erp-grid-cell",
              }}
              overlayNoRowsTemplate='<span class="erp-grid-empty">표시할 행이 없습니다</span>'
            />
          </div>
        </div>
      </section>

      <Dialog open={Boolean(editForm)} onOpenChange={(open) => !open && setEditForm(null)}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-md">
          {editForm ? (
            <UserForm
              mode="edit"
              form={editForm}
              error={editError}
              isSaving={isSavingEdit}
              isDeleting={isDeletingId === editForm.id}
              onSubmit={saveEditedUser}
              onCancel={() => setEditForm(null)}
              onDelete={() => deleteUser(editForm)}
              onChange={(next) =>
                setEditForm((current) => {
                  if (!current) {
                    return current;
                  }
                  return typeof next === "function" ? next(current) : next;
                })
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm<TForm extends CreateUserForm | EditUserForm>({
  mode,
  form,
  error,
  isSaving,
  isDeleting = false,
  onSubmit,
  onCancel,
  onDelete,
  onChange,
}: {
  mode: "create" | "edit";
  form: TForm;
  error: string | null;
  isSaving: boolean;
  isDeleting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onChange: (form: TForm | ((form: TForm) => TForm)) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "사용자 추가" : "사용자 수정"}</DialogTitle>
        <DialogDescription>
          {mode === "create"
            ? "로그인 계정과 연결할 사원코드를 등록합니다."
            : "사용자 기본 정보와 사원코드를 변경합니다."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="로그인 ID" htmlFor={`${mode}-login-id`}>
            <Input
              id={`${mode}-login-id`}
              value={form.loginId}
              onChange={(event) => onChange((current) => ({ ...current, loginId: event.target.value }))}
              autoComplete="username"
              required
              minLength={3}
            />
          </FormField>
          <FormField label="사원코드" htmlFor={`${mode}-employee-code`}>
            <Input
              id={`${mode}-employee-code`}
              value={form.employeeCode}
              onChange={(event) =>
                onChange((current) => ({ ...current, employeeCode: event.target.value }))
              }
              placeholder="예: EMP-001"
            />
          </FormField>
        </div>
        <FormField label="이름" htmlFor={`${mode}-name`}>
          <Input
            id={`${mode}-name`}
            value={form.name}
            onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </FormField>
        <FormField label="이메일" htmlFor={`${mode}-email`}>
          <Input
            id={`${mode}-email`}
            type="email"
            value={form.email}
            onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))}
            autoComplete="email"
            required
          />
        </FormField>
        {mode === "create" ? (
          <FormField label="초기 비밀번호" htmlFor="create-password">
            <Input
              id="create-password"
              type="password"
              value={(form as CreateUserForm).password}
              onChange={(event) =>
                onChange((current) => ({ ...current, password: event.target.value }))
              }
              autoComplete="new-password"
              required
              minLength={8}
            />
          </FormField>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-[#dbe4ef] bg-[#f8fbff] p-3">
              <UserAvatar
                user={{
                  ...(form as EditUserForm),
                  profileImageUrl: (form as EditUserForm).profileImageUrl || null,
                }}
                className="size-14 text-base"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0d1b3d]">
                  {form.name || "사용자"}
                </p>
                <p className="truncate text-xs text-[#69758a]">{form.email || "이메일 없음"}</p>
              </div>
            </div>
            <FormField label="프로필 사진 URL" htmlFor="edit-profile-image-url">
              <Input
                id="edit-profile-image-url"
                type="url"
                value={(form as EditUserForm).profileImageUrl}
                onChange={(event) =>
                  onChange((current) => ({ ...current, profileImageUrl: event.target.value }))
                }
                placeholder="https://example.com/profile.jpg"
              />
            </FormField>
            <FormField label="새 비밀번호" htmlFor="edit-password">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
                <Input
                  id="edit-password"
                  type="password"
                  value={(form as EditUserForm).password}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, password: event.target.value }))
                  }
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="변경할 때만 입력"
                  className="pl-8"
                />
              </div>
            </FormField>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="역할">
            <Select
              value={form.role}
              onValueChange={(role: UserRole) => onChange((current) => ({ ...current, role }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">관리자</SelectItem>
                <SelectItem value="employee">사원</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="상태">
            <Select
              value={form.status}
              onValueChange={(status: UserStatus) => onChange((current) => ({ ...current, status }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">사용</SelectItem>
                <SelectItem value="invited">초대</SelectItem>
                <SelectItem value="disabled">중지</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        {mode === "edit" && onDelete ? (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={isSaving || isDeleting}>
            {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            삭제
          </Button>
        ) : null}
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "저장 중" : mode === "create" ? "추가" : "저장"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </DialogFooter>
    </form>
  );
}

function UserAvatar({
  user,
  className,
}: {
  user: Pick<AppUserRow, "name" | "profileImageUrl"> & { updatedAt?: string | null };
  className?: string;
}) {
  const imageUrl = getProfileImageDisplayUrl(user.profileImageUrl, user.updatedAt);

  if (imageUrl) {
    return (
      <span
        className={cn("block size-8 shrink-0 rounded-full bg-cover bg-center ring-1 ring-[#d5e0ee]", className)}
        style={{ backgroundImage: `url("${imageUrl}")` }}
        aria-label={`${user.name} 프로필 사진`}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-[#e9f0ff] text-xs font-semibold text-[#1f6fff] ring-1 ring-[#d5e0ee]",
        className,
      )}
      aria-label={`${user.name} 프로필 기본 이미지`}
    >
      {user.name.slice(0, 1)}
    </span>
  );
}

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
      {children}
    </div>
  );
}
