"use client";

import { useCallback, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type ICellRendererParams,
  type RowDoubleClickedEvent,
  type SelectionChangedEvent,
  type ValueFormatterParams,
} from "ag-grid-community";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Underline,
  X,
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
import type { BoardAttachment, MemoRow } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

type MemoDraft = {
  id: string | null;
  title: string;
  content: string;
  attachments: BoardAttachment[];
};

const EMPTY_DRAFT: MemoDraft = {
  id: null,
  title: "",
  content: "",
  attachments: [],
};

export function MemoGrid({
  initialRows,
  canCreate,
  canUpdate,
  canDelete,
}: {
  initialRows: MemoRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const gridApiRef = useRef<GridApi<MemoRow> | null>(null);
  const [rows, setRows] = useState(initialRows);
  const [selectedRow, setSelectedRow] = useState<MemoRow | null>(initialRows[0] ?? null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<MemoDraft>(EMPTY_DRAFT);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const columnDefs = useMemo<ColDef<MemoRow>[]>(
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
        field: "title",
        headerName: "제목",
        flex: 1.3,
        minWidth: 260,
        cellClass: "erp-grid-cell text-sm font-semibold",
      },
      {
        field: "content",
        headerName: "내용",
        flex: 1.8,
        minWidth: 360,
        cellClass: "erp-grid-cell text-[#475569]",
        valueFormatter: (params: ValueFormatterParams<MemoRow>) => toPlainText(String(params.value ?? "")),
      },
      {
        colId: "attachments",
        headerName: "첨부",
        width: 90,
        minWidth: 80,
        cellClass: "erp-grid-cell",
        valueGetter: (params) => params.data?.attachments.length ?? 0,
        cellRenderer: (params: ICellRendererParams<MemoRow>) => {
          const count = Number(params.value ?? 0);
          return count ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#d8e0ea] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-bold text-[#475569]">
              <Paperclip className="size-3" />
              {count}
            </span>
          ) : null;
        },
      },
      {
        field: "authorName",
        headerName: "작성자",
        width: 120,
        cellClass: "erp-grid-cell",
        valueFormatter: (params) => String(params.value ?? "-"),
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
      [row.title, toPlainText(row.content), row.authorName ?? ""].some((value) =>
        value.toLowerCase().includes(text),
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
          const response = await fetch(`/api/memos${params.size ? `?${params.toString()}` : ""}`);
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error ?? "메모 조회에 실패했습니다.");
          }
          setRows(body.rows ?? []);
          setSelectedRow(body.rows?.[0] ?? null);
          setNotice(null);
        } catch (fetchError) {
          setError(fetchError instanceof Error ? fetchError.message : "메모 조회에 실패했습니다.");
        }
      });
    },
    [query],
  );

  function onSelectionChanged(event: SelectionChangedEvent<MemoRow>) {
    setSelectedRow(event.api.getSelectedRows()[0] ?? null);
  }

  function openMemo(row: MemoRow) {
    setDraft({
      id: row.id,
      title: row.title,
      content: row.content,
      attachments: row.attachments,
    });
    setIsDialogOpen(true);
    setNotice(null);
  }

  function openNewMemo() {
    setDraft(EMPTY_DRAFT);
    setIsDialogOpen(true);
    setNotice(null);
  }

  function saveMemo() {
    const title = draft.title.trim();
    if (!title) {
      setError("메모 제목을 입력해 주세요.");
      return;
    }
    if (draft.id ? !canUpdate : !canCreate) {
      setError("메모 저장 권한이 없습니다.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/memos", {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draft.id ?? undefined,
            title,
            content: draft.content,
            attachments: draft.attachments,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "메모 저장에 실패했습니다.");
        }
        const memo = body.memo as MemoRow;
        setRows((current) => [memo, ...current.filter((row) => row.id !== memo.id)]);
        setSelectedRow(memo);
        setDraft({
          id: memo.id,
          title: memo.title,
          content: memo.content,
          attachments: memo.attachments,
        });
        setNotice("메모를 저장했습니다.");
        setIsDialogOpen(false);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "메모 저장에 실패했습니다.");
      }
    });
  }

  function deleteCurrentMemo(row = selectedRow) {
    if (!row) {
      setNotice("삭제할 메모를 선택해 주세요.");
      return;
    }
    if (!canDelete) {
      setError("메모 삭제 권한이 없습니다.");
      return;
    }
    if (!window.confirm(`"${row.title}" 메모를 삭제할까요?`)) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch(`/api/memos?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "메모 삭제에 실패했습니다.");
        }
        setRows((current) => current.filter((item) => item.id !== row.id));
        setSelectedRow(null);
        setNotice("메모를 삭제했습니다.");
        setIsDialogOpen(false);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "메모 삭제에 실패했습니다.");
      }
    });
  }

  return (
    <div className="crm-erp-surface mx-auto flex h-[calc(100vh-5.5rem)] max-w-[1840px] flex-col gap-3 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[#0d1b3d]">메모</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 w-fit border-[#cfd9e7] bg-white px-2.5 text-xs">
            {filteredRows.length.toLocaleString()}건
          </Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]">
        <div className="grid gap-px bg-[#edf1f6] p-px lg:grid-cols-[88px_minmax(260px,420px)_auto]">
          <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
            검색
          </div>
          <div className="bg-white p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") reloadRows();
                }}
                placeholder="제목, 내용, 작성자 검색"
                className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 bg-[#f8fafc] p-2 lg:flex-row lg:items-center lg:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => reloadRows()} disabled={isPending}>
              <RefreshCw className="size-3.5" />
              새로고침
            </Button>
            {canDelete ? (
              <Button type="button" variant="outline" size="sm" onClick={() => deleteCurrentMemo()} disabled={isPending}>
                <Trash2 className="size-3.5" />
                삭제
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" size="sm" onClick={openNewMemo} disabled={isPending}>
                <Plus className="size-3.5" />
                새 메모
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

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_10px_34px_rgba(15,28,48,0.06)]">
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
            onGridReady={(event) => {
              gridApiRef.current = event.api;
              event.api.getDisplayedRowAtIndex(0)?.setSelected(true);
            }}
            onSelectionChanged={onSelectionChanged}
            onRowDoubleClicked={(event: RowDoubleClickedEvent<MemoRow>) => {
              if (event.data) openMemo(event.data);
            }}
            overlayNoRowsTemplate='<span class="erp-grid-empty">표시할 메모가 없습니다</span>'
          />
        </div>
      </div>

      <MemoDialog
        open={isDialogOpen}
        draft={draft}
        canDelete={canDelete}
        canSave={draft.id ? canUpdate : canCreate}
        isPending={isPending}
        onOpenChange={setIsDialogOpen}
        onDraftChange={setDraft}
        onDelete={() => {
          const row = rows.find((item) => item.id === draft.id);
          if (row) deleteCurrentMemo(row);
        }}
        onSave={saveMemo}
      />
    </div>
  );
}

function MemoDialog({
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
  draft: MemoDraft;
  canDelete: boolean;
  canSave: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: MemoDraft) => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateContent() {
    onDraftChange({ ...draft, content: editorRef.current?.innerHTML ?? "" });
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateContent();
  }

  function addLink() {
    const url = window.prompt("링크 주소를 입력하세요.");
    if (!url) {
      return;
    }
    runCommand("createLink", url);
  }

  async function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const nextAttachments = await Promise.all(files.map(readAttachment));
    onDraftChange({
      ...draft,
      attachments: [...draft.attachments, ...nextAttachments].slice(0, 10),
    });
    event.target.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[88vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-[#e2e8f0] px-4 py-3">
          <DialogTitle>{draft.id ? "메모 상세" : "새 메모"}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="memo-title" className="text-xs">
                제목
              </Label>
              <Input
                id="memo-title"
                value={draft.title}
                onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
                placeholder="제목"
                className="h-8 border-[#d8e0ea] bg-white text-sm"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">내용</Label>
              <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
                <div className="flex flex-wrap items-center gap-1 border-b border-[#e2e8f0] bg-[#f8fafc] p-1.5">
                  <ToolbarButton label="굵게" onClick={() => runCommand("bold")}>
                    <Bold className="size-3.5" />
                  </ToolbarButton>
                  <ToolbarButton label="기울임" onClick={() => runCommand("italic")}>
                    <Italic className="size-3.5" />
                  </ToolbarButton>
                  <ToolbarButton label="밑줄" onClick={() => runCommand("underline")}>
                    <Underline className="size-3.5" />
                  </ToolbarButton>
                  <span className="mx-1 h-5 w-px bg-[#d8e0ea]" />
                  <ToolbarButton label="글머리 기호" onClick={() => runCommand("insertUnorderedList")}>
                    <List className="size-3.5" />
                  </ToolbarButton>
                  <ToolbarButton label="번호 목록" onClick={() => runCommand("insertOrderedList")}>
                    <ListOrdered className="size-3.5" />
                  </ToolbarButton>
                  <ToolbarButton label="링크" onClick={addLink}>
                    <LinkIcon className="size-3.5" />
                  </ToolbarButton>
                </div>
                <div
                  ref={(node) => {
                    editorRef.current = node;
                    if (node && node.innerHTML !== draft.content) {
                      node.innerHTML = draft.content;
                    }
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={updateContent}
                  onBlur={updateContent}
                  className="memo-rich-editor min-h-[260px] px-3 py-2 text-sm leading-6 text-[#1f2937] outline-none"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>첨부파일</Label>
              <div className="rounded-lg border border-[#d8e0ea] bg-[#f8fafc] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFilesSelected} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="size-3.5" />
                    파일 첨부
                  </Button>
                  <span className="text-[11px] font-medium text-[#64748b]">
                    {draft.attachments.length.toLocaleString()}개
                  </span>
                </div>
                {draft.attachments.length ? (
                  <div className="mt-3 grid gap-2">
                    {draft.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5"
                      >
                        <a
                          href={attachment.dataUrl}
                          download={attachment.name}
                          className="min-w-0 truncate text-xs font-semibold text-[#1f4f9f] hover:underline"
                        >
                          {attachment.name}
                        </a>
                        <span className="text-[11px] text-[#64748b]">{formatFileSize(attachment.size)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="첨부파일 제거"
                          onClick={() =>
                            onDraftChange({
                              ...draft,
                              attachments: draft.attachments.filter((item) => item.id !== attachment.id),
                            })
                          }
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#d8e0ea] bg-white px-4 pt-3 pb-5">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {draft.id && canDelete ? (
                <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={isPending}>
                  <Trash2 className="size-3.5" />
                  삭제
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                닫기
              </Button>
              <Button type="button" size="sm" onClick={onSave} disabled={isPending || !canSave || !draft.title.trim()}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                저장
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function readAttachment(file: File): Promise<BoardAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl: String(reader.result ?? ""),
      });
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function toPlainText(value: string) {
  if (!value) {
    return "";
  }
  return value
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateTime(value: unknown) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
