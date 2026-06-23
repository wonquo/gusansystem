"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type ICellRendererParams,
  type RowDoubleClickedEvent,
  type SelectionChangedEvent,
  type ValueFormatterParams,
  type ValueGetterParams,
} from "ag-grid-community";
import {
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactRow } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

type ContactDraft = {
  id: string | null;
  name: string;
  position: string;
  company: string;
  phone: string;
  email: string;
  task: string;
  memo: string;
};

const EMPTY_DRAFT: ContactDraft = {
  id: null,
  name: "",
  position: "",
  company: "",
  phone: "",
  email: "",
  task: "",
  memo: "",
};

export function ContactGrid({
  initialRows,
  canCreate,
  canUpdate,
  canDelete,
}: {
  initialRows: ContactRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [selectedRow, setSelectedRow] = useState<ContactRow | null>(initialRows[0] ?? null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const columnDefs = useMemo<ColDef<ContactRow>[]>(
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
        valueGetter: (params: ValueGetterParams<ContactRow>) => (params.node?.rowIndex ?? 0) + 1,
      },
      {
        field: "name",
        headerName: "이름",
        width: 140,
        pinned: "left",
        cellClass: "erp-grid-cell text-sm font-semibold",
      },
      {
        field: "position",
        headerName: "직책",
        width: 120,
        cellClass: "erp-grid-cell",
        valueFormatter: emptyValueFormatter,
      },
      {
        field: "company",
        headerName: "회사",
        minWidth: 190,
        flex: 1,
        cellClass: "erp-grid-cell",
        cellRenderer: (params: ICellRendererParams<ContactRow>) => <IconText icon="company" value={params.value} />,
      },
      {
        field: "phone",
        headerName: "전화번호",
        width: 160,
        cellClass: "erp-grid-cell",
        cellRenderer: (params: ICellRendererParams<ContactRow>) => <ContactLink type="phone" value={params.value} />,
      },
      {
        field: "email",
        headerName: "이메일",
        minWidth: 210,
        flex: 1,
        cellClass: "erp-grid-cell",
        cellRenderer: (params: ICellRendererParams<ContactRow>) => <ContactLink type="email" value={params.value} />,
      },
      {
        field: "task",
        headerName: "담당업무",
        minWidth: 220,
        flex: 1.1,
        cellClass: "erp-grid-cell text-[#334155]",
        cellRenderer: (params: ICellRendererParams<ContactRow>) => <IconText icon="task" value={params.value} />,
      },
      {
        field: "memo",
        headerName: "비고",
        minWidth: 220,
        flex: 1,
        cellClass: "erp-grid-cell text-[#475569]",
        valueFormatter: emptyValueFormatter,
      },
      {
        field: "updatedAt",
        headerName: "수정일",
        width: 160,
        cellClass: "erp-grid-cell erp-grid-cell-date",
        valueFormatter: (params) => formatDateTime(params.value),
      },
    ],
    [],
  );

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return rows;
    }

    return rows.filter((row) =>
      [row.name, row.position, row.company, row.phone, row.email, row.task, row.memo, row.authorName ?? ""].some(
        (value) => value.toLowerCase().includes(text),
      ),
    );
  }, [query, rows]);

  const reloadRows = useCallback(
    (nextQuery = query) => {
      startTransition(async () => {
        try {
          setError(null);
          const params = new URLSearchParams();
          if (nextQuery.trim()) params.set("query", nextQuery.trim());
          const response = await fetch(`/api/contacts${params.size ? `?${params.toString()}` : ""}`);
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error ?? "연락처 조회에 실패했습니다.");
          }
          setRows(body.rows ?? []);
          setSelectedRow(body.rows?.[0] ?? null);
          setNotice(null);
        } catch (fetchError) {
          setError(fetchError instanceof Error ? fetchError.message : "연락처 조회에 실패했습니다.");
        }
      });
    },
    [query],
  );

  function onSelectionChanged(event: SelectionChangedEvent<ContactRow>) {
    setSelectedRow(event.api.getSelectedRows()[0] ?? null);
  }

  function openContact(row: ContactRow) {
    setSelectedRow(row);
    setDraft({
      id: row.id,
      name: row.name,
      position: row.position,
      company: row.company,
      phone: row.phone,
      email: row.email,
      task: row.task,
      memo: row.memo,
    });
    setIsDialogOpen(true);
    setNotice(null);
  }

  function openNewContact() {
    setDraft(EMPTY_DRAFT);
    setIsDialogOpen(true);
    setNotice(null);
  }

  function saveContact() {
    const name = draft.name.trim();
    if (!name) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (draft.id ? !canUpdate : !canCreate) {
      setError("연락처 저장 권한이 없습니다.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/contacts", {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draft.id ?? undefined,
            name,
            position: draft.position,
            company: draft.company,
            phone: draft.phone,
            email: draft.email,
            task: draft.task,
            memo: draft.memo,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "연락처 저장에 실패했습니다.");
        }

        const contact = body.contact as ContactRow;
        setRows((current) => [contact, ...current.filter((row) => row.id !== contact.id)]);
        setSelectedRow(contact);
        setDraft(toDraft(contact));
        setNotice("연락처를 저장했습니다.");
        setIsDialogOpen(false);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "연락처 저장에 실패했습니다.");
      }
    });
  }

  function deleteCurrentContact(row = selectedRow) {
    if (!row) {
      setNotice("삭제할 연락처를 선택해 주세요.");
      return;
    }
    if (!canDelete) {
      setError("연락처 삭제 권한이 없습니다.");
      return;
    }
    if (!window.confirm(`"${row.name}" 연락처를 삭제할까요?`)) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch(`/api/contacts?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "연락처 삭제에 실패했습니다.");
        }
        setRows((current) => current.filter((item) => item.id !== row.id));
        setSelectedRow(null);
        setNotice("연락처를 삭제했습니다.");
        setIsDialogOpen(false);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "연락처 삭제에 실패했습니다.");
      }
    });
  }

  return (
    <div className="crm-erp-surface mx-auto flex h-[calc(100vh-5.5rem)] max-w-[1840px] flex-col gap-3 overflow-hidden max-md:h-[calc(100dvh-5.5rem)]">
      <div className="hidden flex-col gap-2 md:flex md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[#0d1b3d]">연락처</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 w-fit border-[#cfd9e7] bg-white px-2.5 text-xs">
            {filteredRows.length.toLocaleString()}건
          </Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]">
        <div className="grid gap-px bg-[#edf1f6] p-px md:grid-cols-[88px_minmax(280px,460px)_auto]">
          <div className="hidden items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a] md:flex">
            검색
          </div>
          <div className="bg-white p-2">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") reloadRows();
                  }}
                  placeholder="이름, 회사, 연락처 검색"
                  className="h-10 border-[#d8e0ea] bg-white pl-7 text-base focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20 sm:h-8 sm:text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0 md:hidden"
                onClick={() => reloadRows()}
                disabled={isPending}
                aria-label="새로고침"
              >
                <RefreshCw className="size-4" />
              </Button>
              {canCreate ? (
                <Button
                  type="button"
                  size="icon"
                  className="size-10 shrink-0 md:hidden"
                  onClick={openNewContact}
                  disabled={isPending}
                  aria-label="새 연락처"
                >
                  <Plus className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="hidden flex-col gap-2 bg-[#f8fafc] p-2 md:flex md:flex-row md:items-center md:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center md:w-auto"
              onClick={() => reloadRows()}
              disabled={isPending}
            >
              <RefreshCw className="size-3.5" />
              새로고침
            </Button>
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden w-full justify-center md:inline-flex md:w-auto"
                onClick={() => deleteCurrentContact()}
                disabled={isPending}
              >
                <Trash2 className="size-3.5" />
                삭제
              </Button>
            ) : null}
            {canCreate ? (
              <Button
                type="button"
                size="sm"
                className="w-full justify-center md:w-auto"
                onClick={openNewContact}
                disabled={isPending}
              >
                <Plus className="size-3.5" />
                새 연락처
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert className="border-[#bfd2f5] bg-[#eef4ff] text-[#1f4f9f]">
          <AlertTitle>처리 완료</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-y-auto md:hidden">
        {isPending ? (
          <div className="sticky inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-[#dbe7fb]">
            <span className="block h-full w-1/3 animate-pulse bg-[#2f70dc]" />
          </div>
        ) : null}

        <div className="flex flex-col gap-2 pb-2">
          {filteredRows.length ? (
            filteredRows.map((row) => (
              <ContactMobileCard
                key={row.id}
                row={row}
                canUpdate={canUpdate}
                onOpen={openContact}
              />
            ))
          ) : (
            <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[#cfd9e7] bg-white px-4 text-center text-sm text-[#64748b]">
              표시할 연락처가 없습니다
            </div>
          )}
        </div>
      </div>

      <div className="relative hidden min-h-0 flex-1 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_10px_34px_rgba(15,28,48,0.06)] md:block">
        {isPending ? (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-[#dbe7fb]">
            <span className="block h-full w-1/3 animate-pulse bg-[#2f70dc]" />
          </div>
        ) : null}
        <div className="ag-theme-quartz erp-grid h-full w-full">
          <AgGridReact
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={{
              minWidth: 110,
              resizable: true,
              sortable: true,
              filter: true,
              suppressHeaderMenuButton: true,
              cellClass: "erp-grid-cell",
            }}
            rowSelection="single"
            animateRows={false}
            theme="legacy"
            suppressDragLeaveHidesColumns
            onGridReady={(event: GridReadyEvent<ContactRow>) => {
              event.api.getDisplayedRowAtIndex(0)?.setSelected(true);
            }}
            onSelectionChanged={onSelectionChanged}
            onRowDoubleClicked={(event: RowDoubleClickedEvent<ContactRow>) => {
              if (event.data) openContact(event.data);
            }}
            overlayNoRowsTemplate='<span class="erp-grid-empty">표시할 연락처가 없습니다</span>'
          />
        </div>
      </div>

      <ContactDialog
        open={isDialogOpen}
        draft={draft}
        canDelete={canDelete}
        canSave={draft.id ? canUpdate : canCreate}
        isPending={isPending}
        onOpenChange={setIsDialogOpen}
        onDraftChange={setDraft}
        onDelete={() => {
          const row = rows.find((item) => item.id === draft.id);
          if (row) deleteCurrentContact(row);
        }}
        onSave={saveContact}
      />
    </div>
  );
}

function ContactMobileCard({
  row,
  canUpdate,
  onOpen,
}: {
  row: ContactRow;
  canUpdate: boolean;
  onOpen: (row: ContactRow) => void;
}) {
  const company = displayContactValue(row.company);
  const task = displayContactValue(row.task);
  const memo = displayContactValue(row.memo);
  const position = displayContactValue(row.position);
  const hasTask = row.task.trim().length > 0;
  const hasMemo = row.memo.trim().length > 0;
  const [isMemoOpen, setIsMemoOpen] = useState(false);

  return (
    <article
      className="rounded-lg border border-[#dbe3ef] bg-white px-3 py-2.5 shadow-[0_8px_22px_rgba(15,28,48,0.055)]"
      aria-label={`${row.name} 연락처`}
    >
      <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
        <span className="max-w-[68px] shrink-0 truncate text-[15px] font-bold tracking-tight text-[#0d1b3d]">
          {row.name || "-"}
        </span>
        <span className="text-[#c1cad8]">·</span>
        <span className="max-w-[118px] shrink-0 truncate text-xs font-semibold text-[#475569]">{company}</span>
        {row.position.trim() ? (
          <span className="max-w-[52px] shrink-0 truncate rounded-md border border-[#d8e0ea] bg-[#f8fafc] px-1.5 py-0.5 text-[11px] font-semibold text-[#475569]">
            {position}
          </span>
        ) : null}
        <span className="text-[#c1cad8]">·</span>
        <span className="min-w-0 flex-1 truncate text-xs text-[#64748b]">{hasTask ? task : "-"}</span>
      </div>

      {hasMemo ? (
        <div className="mt-2 rounded-md bg-[#f8fafc] px-2.5 py-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-bold text-[#64748b]"
            onClick={() => setIsMemoOpen((current) => !current)}
            aria-expanded={isMemoOpen}
          >
            <span>비고</span>
            <span className="inline-flex items-center gap-1 text-[#1f4f9f]">
              {isMemoOpen ? "접기" : "펼치기"}
              {isMemoOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </span>
          </button>
          {isMemoOpen ? (
            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-[#1f2937]">{memo}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#7c8aa0]">
        <span className="min-w-0 truncate">수정일 {formatDateTime(row.updatedAt) || "-"}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <MobileContactAction type="phone" value={row.phone} />
          <MobileContactAction type="email" value={row.email} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-md border-[#cdd8e7] px-2 text-[11px] font-bold text-[#1f4f9f]"
            onClick={() => onOpen(row)}
          >
            <Eye className="size-3.5" />
            {canUpdate ? "편집" : "상세"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function MobileContactAction({ type, value }: { type: "phone" | "email"; value: string }) {
  const text = value.trim();
  const Icon = type === "phone" ? Phone : Mail;
  const label = type === "phone" ? "전화" : "메일";

  if (!text) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-md border-[#e2e8f0] px-2 text-[11px] font-bold text-[#94a3b8]"
        disabled
      >
        <Icon className="size-3.5" />
        {label}
      </Button>
    );
  }

  const href = type === "phone" ? `tel:${text.replace(/[^\d+]/g, "")}` : `mailto:${text}`;

  return (
    <a
      href={href}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#cdd8e7] bg-white px-2 text-[11px] font-bold text-[#1f4f9f] transition hover:border-[#9bb8eb] hover:bg-[#f8fbff]"
      aria-label={`${rowContactActionAria(type)} ${text}`}
    >
      <Icon className="size-3.5 shrink-0 text-[#64748b]" />
      {label}
    </a>
  );
}

function ContactDialog({
  open,
  draft,
  canDelete,
  canSave,
  isPending,
  onOpenChange,
  onDraftChange,
  onDelete,
  onSave,
}: {
  open: boolean;
  draft: ContactDraft;
  canDelete: boolean;
  canSave: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: ContactDraft) => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] grid w-[calc(100%-1rem)] max-w-none translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:top-1/2 sm:bottom-auto sm:max-h-[88vh] sm:w-full sm:max-w-3xl sm:-translate-y-1/2">
        <DialogHeader className="border-b border-[#e2e8f0] px-4 py-3 pr-12">
          <DialogTitle>{draft.id ? "연락처 상세" : "새 연락처"}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="이름" htmlFor="contact-name" required>
                <Input
                  ref={nameInputRef}
                  id="contact-name"
                  value={draft.name}
                  onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                  placeholder="이름"
                  className="h-11 border-[#d8e0ea] bg-white px-3 text-base sm:h-10 sm:text-sm"
                />
              </Field>
              <Field label="직책" htmlFor="contact-position">
                <Input
                  id="contact-position"
                  value={draft.position}
                  onChange={(event) => onDraftChange({ ...draft, position: event.target.value })}
                  placeholder="직책"
                  className="h-11 border-[#d8e0ea] bg-white px-3 text-base sm:h-10 sm:text-sm"
                />
              </Field>
              <Field label="회사" htmlFor="contact-company">
                <Input
                  id="contact-company"
                  value={draft.company}
                  onChange={(event) => onDraftChange({ ...draft, company: event.target.value })}
                  placeholder="회사"
                  className="h-11 border-[#d8e0ea] bg-white px-3 text-base sm:h-10 sm:text-sm"
                />
              </Field>
              <Field label="전화번호" htmlFor="contact-phone">
                <Input
                  id="contact-phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
                  placeholder="010-0000-0000"
                  className="h-11 border-[#d8e0ea] bg-white px-3 text-base sm:h-10 sm:text-sm"
                />
              </Field>
              <Field label="이메일" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  type="email"
                  value={draft.email}
                  onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
                  placeholder="name@example.com"
                  className="h-11 border-[#d8e0ea] bg-white px-3 text-base sm:h-10 sm:text-sm"
                />
              </Field>
              <Field label="담당업무" htmlFor="contact-task">
                <Input
                  id="contact-task"
                  value={draft.task}
                  onChange={(event) => onDraftChange({ ...draft, task: event.target.value })}
                  placeholder="담당업무"
                  className="h-11 border-[#d8e0ea] bg-white px-3 text-base sm:h-10 sm:text-sm"
                />
              </Field>
            </div>

            <Field label="비고" htmlFor="contact-memo">
              <Textarea
                id="contact-memo"
                value={draft.memo}
                onChange={(event) => onDraftChange({ ...draft, memo: event.target.value })}
                placeholder="비고"
                className="min-h-32 resize-y border-[#d8e0ea] bg-white px-3 text-base sm:min-h-28 sm:text-sm"
              />
            </Field>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#d8e0ea] bg-white px-4 pt-3 pb-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {draft.id && canDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-11 w-full sm:h-8 sm:w-auto"
                  onClick={onDelete}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5" />
                  삭제
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="sm"
                className="h-11 w-full sm:h-8 sm:w-auto"
                onClick={onSave}
                disabled={isPending || !canSave || !draft.name.trim()}
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                저장
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 w-full sm:h-8 sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
        {required ? <span className="ml-0.5 text-[#dc2626]">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function ContactLink({ type, value }: { type: "phone" | "email"; value: unknown }) {
  const text = String(value ?? "").trim();
  if (!text) {
    return <span className="text-[#94a3b8]">-</span>;
  }

  const href = type === "phone" ? `tel:${text.replace(/[^\d+]/g, "")}` : `mailto:${text}`;
  const Icon = type === "phone" ? Phone : Mail;

  return (
    <a
      href={href}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1.5 truncate font-medium text-[#1f4f9f] hover:underline"
    >
      <Icon className="size-3.5 shrink-0 text-[#64748b]" />
      <span className="truncate">{text}</span>
    </a>
  );
}

function IconText({ icon, value }: { icon: "company" | "task"; value: unknown }) {
  const text = String(value ?? "").trim();
  if (!text) {
    return <span className="text-[#94a3b8]">-</span>;
  }

  const Icon = icon === "company" ? Building2 : BriefcaseBusiness;

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate">
      <Icon className="size-3.5 shrink-0 text-[#94a3b8]" />
      <span className="truncate">{text}</span>
    </span>
  );
}

function emptyValueFormatter(params: ValueFormatterParams<ContactRow>) {
  return String(params.value ?? "").trim() || "-";
}

function displayContactValue(value: string) {
  return value.trim() || "-";
}

function rowContactActionAria(type: "phone" | "email") {
  return type === "phone" ? "전화 걸기" : "메일 보내기";
}

function toDraft(contact: ContactRow): ContactDraft {
  return {
    id: contact.id,
    name: contact.name,
    position: contact.position,
    company: contact.company,
    phone: contact.phone,
    email: contact.email,
    task: contact.task,
    memo: contact.memo,
  };
}

function formatDateTime(value: unknown) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour ?? "0");
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "오전" : "오후";

  return `${values.year}. ${values.month}. ${values.day}. ${period} ${String(displayHour).padStart(2, "0")}:${values.minute}`;
}
