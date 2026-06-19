"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AgGridReact, type CustomCellEditorProps } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellEditingStartedEvent,
  type CellEditingStoppedEvent,
  type CellValueChangedEvent,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  type RowClassParams,
  type SelectionChangedEvent,
  type ValueFormatterParams,
} from "ag-grid-community";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AppUserRow,
  type WorkDiaryDestinationRow,
  type WorkDiaryRow,
  type WorkDiaryTypeRow,
} from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

type RowState = "clean" | "new" | "modified";

type WorkDiaryGridRow = WorkDiaryRow & {
  clientId: string;
  rowState: RowState;
  isDeleted: boolean;
};

const EMPTY_DESTINATION = "__empty_destination__";
const EMPTY_WORK_TYPE = "__empty_work_type__";
const WORK_TYPE_COLORS = [
  { label: "회색", value: "#475569" },
  { label: "파랑", value: "#2563eb" },
  { label: "초록", value: "#16a34a" },
  { label: "보라", value: "#9333ea" },
  { label: "빨강", value: "#dc2626" },
  { label: "분홍", value: "#be123c" },
  { label: "주황", value: "#ea580c" },
  { label: "청록", value: "#0f766e" },
];
const KOREAN_HOLIDAYS_BY_DATE: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날",
  "2026-02-17": "설날",
  "2026-02-18": "설날",
  "2026-03-01": "삼일절",
  "2026-03-02": "삼일절 대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "부처님오신날 대체공휴일",
  "2026-06-03": "지방선거",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "광복절 대체공휴일",
  "2026-09-24": "추석",
  "2026-09-25": "추석",
  "2026-09-26": "추석",
  "2026-10-03": "개천절",
  "2026-10-05": "개천절 대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

export function WorkDiaryGrid({
  initialRows,
  initialDestinations,
  initialWorkTypes,
  users,
  currentUser,
  initialMonth,
}: {
  initialRows: WorkDiaryRow[];
  initialDestinations: WorkDiaryDestinationRow[];
  initialWorkTypes: WorkDiaryTypeRow[];
  users: AppUserRow[];
  currentUser: AppUserRow;
  initialMonth: string;
}) {
  const [rows, setRows] = useState(() => toGridRows(initialRows, initialWorkTypes));
  const [destinations, setDestinations] = useState(initialDestinations);
  const [workTypes, setWorkTypes] = useState(initialWorkTypes);
  const [selectedRow, setSelectedRow] = useState<WorkDiaryGridRow | null>(rows[0] ?? null);
  const [month, setMonth] = useState(initialMonth);
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDestinationDialogOpen, setIsDestinationDialogOpen] = useState(false);
  const [isWorkTypeDialogOpen, setIsWorkTypeDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isAdmin = currentUser.role === "admin";
  const todayText = useMemo(() => formatDateInputValue(new Date()), []);
  const defaultWorkType = useMemo(
    () => workTypes.find((item) => item.code === "WORK" && item.isActive) ?? workTypes.find((item) => item.isActive) ?? null,
    [workTypes],
  );
  const defaultWorkTypeId = defaultWorkType?.id ?? null;

  const destinationNameById = useMemo(() => {
    const map = new Map<string, string>();
    destinations.forEach((destination) => map.set(destination.id, destination.label));
    return map;
  }, [destinations]);

  const destinationSelectValues = useMemo(
    () => [EMPTY_DESTINATION, ...destinations.filter((item) => item.isActive).map((item) => item.id)],
    [destinations],
  );

  const workTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    workTypes.forEach((workType) => map.set(workType.id, workType.label));
    return map;
  }, [workTypes]);

  const workTypeById = useMemo(() => {
    const map = new Map<string, WorkDiaryTypeRow>();
    workTypes.forEach((workType) => map.set(workType.id, workType));
    return map;
  }, [workTypes]);

  const workTypeSelectValues = useMemo(
    () => [EMPTY_WORK_TYPE, ...workTypes.filter((item) => item.isActive).map((item) => item.id)],
    [workTypes],
  );

  const columnDefs = useMemo<ColDef<WorkDiaryGridRow>[]>(
    () => [
      {
        colId: "rowNumber",
        headerName: "No",
        width: 56,
        minWidth: 56,
        maxWidth: 64,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
        cellClass: "erp-grid-cell erp-grid-cell-row-number",
      },
      {
        field: "workDate",
        headerName: "일자(요일)",
        width: 132,
        editable: false,
        cellClass: (params) => getDateCellClass(params.data?.workDate),
        valueFormatter: (params) => formatWorkDate(params.value),
      },
      ...(isAdmin
        ? [
            {
              field: "workTypeId" as const,
              headerName: "업무구분",
              width: 116,
              minWidth: 108,
              editable: (params) => !params.data?.isDeleted,
              cellEditor: "agSelectCellEditor",
              cellEditorParams: {
                values: workTypeSelectValues,
              },
              valueFormatter: (params: ValueFormatterParams<WorkDiaryGridRow>) =>
                params.value === EMPTY_WORK_TYPE
                  ? ""
                  : workTypeNameById.get(String(params.value ?? "")) ?? params.data?.workTypeLabel ?? params.data?.workType ?? "",
              cellRenderer: (params: ICellRendererParams<WorkDiaryGridRow>) => {
                const option = workTypeById.get(String(params.value ?? ""));
                const label = option?.label ?? params.data?.workTypeLabel ?? params.data?.workType ?? "";
                const color = option?.color ?? params.data?.workTypeColor ?? "#475569";
                return label ? <WorkTypeBadge label={label} color={color} /> : null;
              },
              cellClass: "erp-grid-cell work-diary-type-cell",
            } satisfies ColDef<WorkDiaryGridRow>,
          ]
        : []),
      {
        field: "primaryWork",
        headerName: "업무내용(주)",
        flex: 1.5,
        minWidth: 260,
        editable: (params) => !params.data?.isDeleted,
        cellClass: "erp-grid-cell work-diary-text-cell",
        cellEditor: MultilineTextCellEditor,
        wrapText: true,
        autoHeight: true,
      },
      {
        field: "secondaryWork",
        headerName: "업무내용(부)",
        flex: 1.2,
        minWidth: 240,
        editable: (params) => !params.data?.isDeleted,
        cellClass: "erp-grid-cell work-diary-text-cell",
        cellEditor: MultilineTextCellEditor,
        wrapText: true,
        autoHeight: true,
      },
      {
        field: "destinationId",
        headerName: "행선지",
        width: 170,
        editable: (params) => !params.data?.isDeleted,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: {
          values: destinationSelectValues,
        },
        valueFormatter: (params: ValueFormatterParams<WorkDiaryGridRow>) =>
          params.value === EMPTY_DESTINATION
            ? ""
            : destinationNameById.get(String(params.value ?? "")) ?? params.data?.destinationLabel ?? "",
        cellClass: "erp-grid-cell",
      },
      {
        field: "memo",
        headerName: "비고",
        flex: 0.8,
        minWidth: 180,
        editable: (params) => !params.data?.isDeleted,
        cellClass: "erp-grid-cell work-diary-text-cell",
        cellEditor: MultilineTextCellEditor,
        wrapText: true,
        autoHeight: true,
      },
    ],
    [destinationNameById, destinationSelectValues, isAdmin, workTypeById, workTypeNameById, workTypeSelectValues],
  );

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? currentUser,
    [currentUser, selectedUserId, users],
  );

  const reloadRows = useCallback(
    (nextMonth = month, nextUserId = selectedUserId) => {
      startTransition(async () => {
        try {
          setError(null);
          const params = new URLSearchParams({ month: nextMonth });
          if (isAdmin) {
            params.set("userId", nextUserId);
          }
          const response = await fetch(`/api/work-diaries?${params.toString()}`);
          const body = await response.json();
          if (!response.ok) {
            throw new Error(body.error ?? "업무일지 조회에 실패했습니다.");
          }
          const nextRows = toGridRows(body.rows ?? [], workTypes);
          setRows(nextRows);
          setSelectedRow(nextRows[0] ?? null);
          setNotice(null);
        } catch (fetchError) {
          setError(fetchError instanceof Error ? fetchError.message : "업무일지 조회에 실패했습니다.");
        }
      });
    },
    [isAdmin, month, selectedUserId, workTypes],
  );

  const reloadDestinations = useCallback(() => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/work-diary-destinations");
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "행선지 조회에 실패했습니다.");
        }
        setDestinations(body.rows ?? []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "행선지 조회에 실패했습니다.");
      }
    });
  }, []);

  const reloadWorkTypes = useCallback(() => {
    if (!isAdmin) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/work-diary-types");
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "업무구분 조회에 실패했습니다.");
        }
        setWorkTypes(body.rows ?? []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "업무구분 조회에 실패했습니다.");
      }
    });
  }, [isAdmin]);

  const persistRow = useCallback((row: WorkDiaryGridRow) => {
    if (row.isDeleted) return;
    if ((row.isPlaceholder || row.rowState === "new") && !rowHasContent(row, defaultWorkTypeId)) {
      return;
    }

    const payload = toSavePayload(row);
    const requestBody = row.isPlaceholder || row.rowState === "new" ? { created: [payload] } : { updated: [payload] };
    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/work-diaries", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "업무일지 저장에 실패했습니다.");
        }
        setNotice(null);
        reloadRows(month, selectedUserId);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "업무일지 저장에 실패했습니다.");
      }
    });
  }, [defaultWorkTypeId, month, reloadRows, selectedUserId]);

  function onCellValueChanged(event: CellValueChangedEvent<WorkDiaryGridRow>) {
    const row = event.data;
    const field = event.colDef.field;
    if (!row || !field || event.oldValue === event.newValue) {
      return;
    }
    const nextValue = normalizeCellValue(field, event.newValue);
    const nextRow: WorkDiaryGridRow = {
      ...row,
      [field]: nextValue,
      rowState: row.isPlaceholder || row.rowState === "new" ? "new" : "modified",
      isPlaceholder: row.isPlaceholder && rowHasContent({ ...row, [field]: nextValue }, defaultWorkTypeId)
        ? false
        : row.isPlaceholder,
    };
    setRows((current) =>
      current.map((item) =>
        item.clientId === row.clientId ? { ...item, ...nextRow } : item,
      ),
    );
    setSelectedRow(nextRow);
    persistRow(nextRow);
  }

  function onSelectionChanged(event: SelectionChangedEvent<WorkDiaryGridRow>) {
    setSelectedRow(event.api.getSelectedRows()[0] ?? null);
  }

  function changeMonth(delta: -1 | 1) {
    const nextMonth = shiftMonth(month, delta);
    setMonth(nextMonth);
    reloadRows(nextMonth, selectedUserId);
  }

  function deleteSelectedRow() {
    if (!selectedRow) {
      setNotice("삭제할 행을 선택해 주세요.");
      return;
    }

    if (selectedRow.isPlaceholder || selectedRow.rowState === "new") {
      setRows((current) =>
        current.map((row) =>
          row.clientId === selectedRow.clientId ? resetPlaceholderRow(row, defaultWorkType) : row,
        ),
      );
      setNotice(null);
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/work-diaries", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleted: [selectedRow.id] }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "업무일지 삭제에 실패했습니다.");
        }
        setNotice("업무일지를 삭제했습니다.");
        reloadRows(month, selectedUserId);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "업무일지 삭제에 실패했습니다.");
      }
    });
  }

  return (
    <div className="crm-erp-surface mx-auto flex h-[calc(100vh-5.5rem)] max-w-[1840px] flex-col gap-3 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[#0d1b3d]">업무일지</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 w-fit border-[#cfd9e7] bg-white px-2.5 text-xs">
            {rows.length.toLocaleString()}건
          </Badge>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]">
        <div className="grid gap-px bg-[#edf1f6] p-px lg:grid-cols-[88px_minmax(230px,280px)_72px_minmax(170px,220px)_auto]">
          <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
            기준월
          </div>
          <div className="flex items-center gap-2 bg-white px-2 py-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="전월"
              onClick={() => changeMonth(-1)}
              disabled={isPending}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="relative min-w-0 flex-1">
              <CalendarDays className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
              <Input
                type="month"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  reloadRows(event.target.value, selectedUserId);
                }}
                className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                disabled={isPending}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="다음월"
              onClick={() => changeMonth(1)}
              disabled={isPending}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
            사용자
          </div>
          <div className="bg-white p-2">
            {isAdmin ? (
              <Select
                value={selectedUserId}
                onValueChange={(value) => {
                  setSelectedUserId(value);
                  reloadRows(month, value);
                }}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 w-full border-[#d8e0ea] bg-white text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20">
                  <SelectValue placeholder="사용자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-8 items-center rounded-md border border-[#d8e0ea] bg-[#f8fafc] px-3 text-sm font-medium text-[#334155]">
                {selectedUser.name}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 bg-[#f8fafc] p-2 lg:min-w-[620px] lg:flex-row lg:items-center lg:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={deleteSelectedRow} disabled={isPending}>
              <Trash2 className="size-3.5" />
              행 삭제
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDestinationDialogOpen(true)}
              disabled={isPending}
            >
              <MapPin className="size-3.5" />
              행선지 관리
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsWorkTypeDialogOpen(true)}
                disabled={isPending}
              >
                <Tags className="size-3.5" />
                업무구분 관리
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => reloadRows()} disabled={isPending}>
              <RefreshCw className="size-3.5" />
              새로고침
            </Button>
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
        <div className="ag-theme-quartz erp-grid work-diary-grid h-full w-full">
          <AgGridReact
            rowData={rows}
            columnDefs={columnDefs}
            getRowId={(params: GetRowIdParams<WorkDiaryGridRow>) => params.data.clientId}
            defaultColDef={{
              minWidth: 110,
              resizable: true,
              sortable: true,
              filter: true,
              editable: true,
              suppressHeaderMenuButton: true,
              cellClass: "erp-grid-cell",
            }}
            singleClickEdit
            rowSelection="single"
            animateRows={false}
            theme="legacy"
            suppressDragLeaveHidesColumns
            stopEditingWhenCellsLoseFocus
            onGridReady={(event) => {
              event.api.getDisplayedRowAtIndex(0)?.setSelected(true);
            }}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStarted={(event: CellEditingStartedEvent<WorkDiaryGridRow>) => {
              if (isMultilineTextField(event.colDef.field)) {
                event.node.setRowHeight(Math.max(event.node.rowHeight ?? 0, 104));
                event.api.onRowHeightChanged();
              }
            }}
            onCellEditingStopped={(event: CellEditingStoppedEvent<WorkDiaryGridRow>) => {
              if (isMultilineTextField(event.colDef.field)) {
                event.node.setRowHeight(undefined);
                event.api.onRowHeightChanged();
              }
            }}
            onSelectionChanged={onSelectionChanged}
            getRowClass={(params: RowClassParams<WorkDiaryGridRow>) => {
              const classes = [];
              if (params.data?.workDate === todayText) classes.push("work-diary-row-today");
              if (params.data?.isDeleted) classes.push("work-diary-row-deleted");
              else if (params.data?.rowState === "new") classes.push("work-diary-row-new");
              else if (params.data?.rowState === "modified") classes.push("work-diary-row-modified");
              return classes.length ? classes.join(" ") : undefined;
            }}
            overlayNoRowsTemplate='<span class="erp-grid-empty">표시할 업무일지가 없습니다</span>'
          />
        </div>
      </div>

      <DestinationDialog
        open={isDestinationDialogOpen}
        destinations={destinations}
        isPending={isPending}
        onOpenChange={setIsDestinationDialogOpen}
        onDestinationsChange={setDestinations}
        onReload={reloadDestinations}
        onError={setError}
      />
      {isAdmin ? (
        <WorkTypeDialog
          open={isWorkTypeDialogOpen}
          workTypes={workTypes}
          isPending={isPending}
          onOpenChange={setIsWorkTypeDialogOpen}
          onWorkTypesChange={setWorkTypes}
          onReload={reloadWorkTypes}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function DestinationDialog({
  open,
  destinations,
  isPending,
  onOpenChange,
  onDestinationsChange,
  onReload,
  onError,
}: {
  open: boolean;
  destinations: WorkDiaryDestinationRow[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onDestinationsChange: (rows: WorkDiaryDestinationRow[]) => void;
  onReload: () => void;
  onError: (message: string | null) => void;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: "", label: "" });
  const [isSaving, startTransition] = useTransition();
  const busy = isPending || isSaving;

  function upsert(next: WorkDiaryDestinationRow) {
    onDestinationsChange(
      [...destinations.filter((item) => item.id !== next.id), next].sort(sortDestinations),
    );
  }

  function createDestination() {
    startTransition(async () => {
      try {
        onError(null);
        const response = await fetch("/api/work-diary-destinations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, label }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "행선지 저장에 실패했습니다.");
        }
        upsert(body.option);
        setCode("");
        setLabel("");
      } catch (error) {
        onError(error instanceof Error ? error.message : "행선지 저장에 실패했습니다.");
      }
    });
  }

  function updateDestination(id: string, body: Partial<WorkDiaryDestinationRow>) {
    startTransition(async () => {
      try {
        onError(null);
        const response = await fetch(`/api/work-diary-destinations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "행선지 수정에 실패했습니다.");
        }
        upsert(result.option);
        setEditingId(null);
      } catch (error) {
        onError(error instanceof Error ? error.message : "행선지 수정에 실패했습니다.");
      }
    });
  }

  function deleteDestination(row: WorkDiaryDestinationRow) {
    if (!window.confirm(`${row.label} 행선지를 삭제할까요? 사용 중이면 숨김 처리됩니다.`)) {
      return;
    }

    startTransition(async () => {
      try {
        onError(null);
        const response = await fetch(`/api/work-diary-destinations/${row.id}`, { method: "DELETE" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "행선지 삭제에 실패했습니다.");
        }
        if (result.deleted) {
          onDestinationsChange(destinations.filter((item) => item.id !== row.id));
        } else if (result.option) {
          upsert(result.option);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : "행선지 삭제에 실패했습니다.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (nextOpen) onReload();
      }}
    >
      <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>행선지 관리</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="코드"
            className="h-8 w-36"
          />
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="행선지명"
            className="h-8"
          />
          <Button type="button" size="sm" disabled={busy || !label.trim()} onClick={createDestination}>
            <Plus className="size-4" />
            추가
          </Button>
        </div>
        <div className="max-h-[54vh] overflow-auto rounded-md border border-[#d8e0ea]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">코드</TableHead>
                <TableHead>행선지명</TableHead>
                <TableHead className="w-24 text-right">사용</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead className="w-32 text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {destinations.map((row) => {
                const editing = editingId === row.id;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {editing ? (
                        <Input
                          value={draft.code}
                          onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-mono text-xs">{row.code}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Input
                          value={draft.label}
                          onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium">{row.label}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{row.usageCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {row.isActive ? <Badge variant="secondary">사용</Badge> : <Badge variant="outline">숨김</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {editing ? (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              disabled={busy || !draft.code.trim() || !draft.label.trim()}
                              aria-label="저장"
                              onClick={() => updateDestination(row.id, draft)}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="취소"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label="수정"
                              onClick={() => {
                                setEditingId(row.id);
                                setDraft({ code: row.code, label: row.label });
                              }}
                            >
                              <MapPin className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label={row.isActive ? "숨김" : "사용"}
                              onClick={() => updateDestination(row.id, { isActive: !row.isActive })}
                            >
                              {row.isActive ? <X className="size-4" /> : <Check className="size-4" />}
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="destructive"
                              disabled={busy}
                              aria-label="삭제"
                              onClick={() => deleteDestination(row)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkTypeDialog({
  open,
  workTypes,
  isPending,
  onOpenChange,
  onWorkTypesChange,
  onReload,
  onError,
}: {
  open: boolean;
  workTypes: WorkDiaryTypeRow[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkTypesChange: (rows: WorkDiaryTypeRow[]) => void;
  onReload: () => void;
  onError: (message: string | null) => void;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(WORK_TYPE_COLORS[0].value);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: "", label: "", color: WORK_TYPE_COLORS[0].value });
  const [isSaving, startTransition] = useTransition();
  const busy = isPending || isSaving;

  function upsert(next: WorkDiaryTypeRow) {
    onWorkTypesChange([...workTypes.filter((item) => item.id !== next.id), next].sort(sortWorkTypes));
  }

  function createWorkType() {
    startTransition(async () => {
      try {
        onError(null);
        const response = await fetch("/api/work-diary-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, label, color }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "업무구분 저장에 실패했습니다.");
        }
        upsert(body.option);
        setCode("");
        setLabel("");
        setColor(WORK_TYPE_COLORS[0].value);
      } catch (error) {
        onError(error instanceof Error ? error.message : "업무구분 저장에 실패했습니다.");
      }
    });
  }

  function updateWorkType(id: string, body: Partial<WorkDiaryTypeRow>) {
    startTransition(async () => {
      try {
        onError(null);
        const response = await fetch(`/api/work-diary-types/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "업무구분 수정에 실패했습니다.");
        }
        upsert(result.option);
        setEditingId(null);
      } catch (error) {
        onError(error instanceof Error ? error.message : "업무구분 수정에 실패했습니다.");
      }
    });
  }

  function deleteWorkType(row: WorkDiaryTypeRow) {
    if (!window.confirm(`${row.label} 업무구분을 삭제할까요? 사용 중이면 숨김 처리됩니다.`)) {
      return;
    }

    startTransition(async () => {
      try {
        onError(null);
        const response = await fetch(`/api/work-diary-types/${row.id}`, { method: "DELETE" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "업무구분 삭제에 실패했습니다.");
        }
        if (result.deleted) {
          onWorkTypesChange(workTypes.filter((item) => item.id !== row.id));
        } else if (result.option) {
          upsert(result.option);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : "업무구분 삭제에 실패했습니다.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (nextOpen) onReload();
      }}
    >
      <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>업무구분 관리</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="코드"
            className="h-8 w-36"
          />
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="업무구분명"
            className="h-8 min-w-40 flex-1"
          />
          <ColorSelect value={color} onValueChange={setColor} />
          <WorkTypeBadge label={label.trim() || "미리보기"} color={color} />
          <Button type="button" size="sm" disabled={busy || !label.trim()} onClick={createWorkType}>
            <Plus className="size-4" />
            추가
          </Button>
        </div>
        <div className="max-h-[54vh] overflow-auto rounded-md border border-[#d8e0ea]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">코드</TableHead>
                <TableHead>업무구분명</TableHead>
                <TableHead className="w-36">색상</TableHead>
                <TableHead className="w-24 text-right">사용</TableHead>
                <TableHead className="w-24">상태</TableHead>
                <TableHead className="w-32 text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workTypes.map((row) => {
                const editing = editingId === row.id;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {editing ? (
                        <Input
                          value={draft.code}
                          onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-mono text-xs">{row.code}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Input
                          value={draft.label}
                          onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium">{row.label}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <ColorSelect
                          value={draft.color}
                          onValueChange={(nextColor) => setDraft((current) => ({ ...current, color: nextColor }))}
                        />
                      ) : (
                        <WorkTypeBadge label={row.label} color={row.color} />
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{row.usageCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {row.isActive ? <Badge variant="secondary">사용</Badge> : <Badge variant="outline">숨김</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {editing ? (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              disabled={busy || !draft.code.trim() || !draft.label.trim()}
                              aria-label="저장"
                              onClick={() => updateWorkType(row.id, draft)}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="취소"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label="수정"
                              onClick={() => {
                                setEditingId(row.id);
                                setDraft({ code: row.code, label: row.label, color: row.color });
                              }}
                            >
                              <Tags className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label={row.isActive ? "숨김" : "사용"}
                              onClick={() => updateWorkType(row.id, { isActive: !row.isActive })}
                            >
                              {row.isActive ? <X className="size-4" /> : <Check className="size-4" />}
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="destructive"
                              disabled={busy}
                              aria-label="삭제"
                              onClick={() => deleteWorkType(row)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkTypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="work-diary-type-badge"
      style={{
        "--work-type-color": color,
        "--work-type-bg": `${color}18`,
        "--work-type-border": `${color}45`,
      } as CSSProperties}
    >
      {label}
    </span>
  );
}

function ColorSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WORK_TYPE_COLORS.map((color) => (
          <SelectItem key={color.value} value={color.value}>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ backgroundColor: color.value }} />
              {color.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultilineTextCellEditor({
  value,
  onValueChange,
  stopEditing,
}: CustomCellEditorProps<WorkDiaryGridRow, string | null>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textValue, setTextValue] = useState(String(value ?? ""));

  function insertLineBreak(textarea: HTMLTextAreaElement) {
    if (typeof textarea.selectionStart !== "number" || typeof textarea.selectionEnd !== "number") {
      const nextValue = `${textarea.value}\n`;
      setTextValue(nextValue);
      onValueChange(nextValue);
      return;
    }

    textarea.setRangeText("\n", textarea.selectionStart, textarea.selectionEnd, "end");
    setTextValue(textarea.value);
    onValueChange(textarea.value);
  }

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, []);

  return (
    <textarea
      ref={textareaRef}
      className="work-diary-multiline-editor"
      enterKeyHint="enter"
      value={textValue}
      onChange={(event) => {
        setTextValue(event.target.value);
        onValueChange(event.target.value);
      }}
      onBeforeInput={(event) => {
        const inputEvent = event.nativeEvent as InputEvent;
        if (!isCoarsePointerDevice() || !["insertLineBreak", "insertParagraph"].includes(inputEvent.inputType)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        insertLineBreak(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.stopPropagation();

        if (isCoarsePointerDevice()) {
          event.preventDefault();
          insertLineBreak(event.currentTarget);
          return;
        }

        if (event.shiftKey || event.altKey) {
          return;
        }

        event.preventDefault();
        stopEditing();
      }}
    />
  );
}

function isMultilineTextField(field: string | undefined) {
  return field === "primaryWork" || field === "secondaryWork" || field === "memo";
}

function isCoarsePointerDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || window.navigator.maxTouchPoints > 0;
}

function toGridRows(rows: WorkDiaryRow[], workTypes: WorkDiaryTypeRow[]): WorkDiaryGridRow[] {
  const defaultWorkType =
    workTypes.find((item) => item.code === "WORK" && item.isActive) ?? workTypes.find((item) => item.isActive) ?? null;
  return rows.map((row) => ({
    ...row,
    workType: row.workTypeLabel ?? row.workType ?? defaultWorkType?.label ?? "업무",
    workTypeId: row.workTypeId ?? defaultWorkType?.id ?? null,
    workTypeCode: row.workTypeCode ?? defaultWorkType?.code ?? null,
    workTypeLabel: row.workTypeLabel ?? defaultWorkType?.label ?? null,
    workTypeColor: row.workTypeColor ?? defaultWorkType?.color ?? null,
    clientId: row.id,
    rowState: "clean",
    isDeleted: false,
  }));
}

function resetPlaceholderRow(
  row: WorkDiaryGridRow,
  defaultWorkType: WorkDiaryTypeRow | null,
): WorkDiaryGridRow {
  return {
    ...row,
    primaryWork: "",
    secondaryWork: "",
    workTypeId: defaultWorkType?.id ?? null,
    workTypeCode: defaultWorkType?.code ?? null,
    workTypeLabel: defaultWorkType?.label ?? null,
    workTypeColor: defaultWorkType?.color ?? null,
    workType: defaultWorkType?.label ?? "업무",
    destinationId: null,
    destinationCode: null,
    destinationLabel: null,
    memo: "",
    rowState: "clean",
    isDeleted: false,
  };
}

function toSavePayload(row: WorkDiaryGridRow) {
  return {
    id: row.id,
    userId: row.userId,
    workDate: row.workDate,
    workType: row.workType,
    workTypeId: row.workTypeId === EMPTY_WORK_TYPE ? null : row.workTypeId,
    primaryWork: row.primaryWork,
    secondaryWork: row.secondaryWork,
    destinationId: row.destinationId === EMPTY_DESTINATION ? null : row.destinationId,
    memo: row.memo,
    sortOrder: row.sortOrder,
  };
}

function rowHasContent(
  row: Pick<WorkDiaryGridRow, "workTypeId" | "primaryWork" | "secondaryWork" | "destinationId" | "memo">,
  defaultWorkTypeId: string | null,
) {
  return Boolean(
    (row.workTypeId && row.workTypeId !== defaultWorkTypeId && row.workTypeId !== EMPTY_WORK_TYPE) ||
      row.primaryWork.trim() ||
      row.secondaryWork.trim() ||
      row.memo.trim() ||
      (row.destinationId && row.destinationId !== EMPTY_DESTINATION),
  );
}

function normalizeCellValue(field: string, value: unknown) {
  if (field === "destinationId" && value === EMPTY_DESTINATION) return null;
  if (field === "workTypeId" && value === EMPTY_WORK_TYPE) return null;
  return value;
}

function formatWorkDate(value: unknown) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const [, month, day] = text.split("-");
  return `${month}.${day} (${weekdayLabel(text)})`;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayLabel(value: unknown) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00`);
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

function getDateCellClass(value: unknown) {
  const text = String(value ?? "");
  const baseClass = "erp-grid-cell erp-grid-cell-date";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return baseClass;
  if (isHoliday(text) || weekdayLabel(text) === "일") {
    return `${baseClass} work-diary-date-red`;
  }
  if (weekdayLabel(text) === "토") {
    return `${baseClass} work-diary-date-blue`;
  }
  return baseClass;
}

function isHoliday(value: string) {
  if (KOREAN_HOLIDAYS_BY_DATE[value]) {
    return true;
  }

  const [, month, day] = value.split("-");
  return new Set(["01-01", "03-01", "05-05", "06-06", "08-15", "10-03", "10-09", "12-25"]).has(
    `${month}-${day}`,
  );
}

function shiftMonth(value: string, delta: -1 | 1) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const current = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date();
  current.setMonth(current.getMonth() + delta);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function sortDestinations(left: WorkDiaryDestinationRow, right: WorkDiaryDestinationRow) {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.label.localeCompare(right.label, "ko");
}

function sortWorkTypes(left: WorkDiaryTypeRow, right: WorkDiaryTypeRow) {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.label.localeCompare(right.label, "ko");
}
