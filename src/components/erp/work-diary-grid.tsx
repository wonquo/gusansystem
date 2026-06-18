"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellEditingStartedEvent,
  type CellEditingStoppedEvent,
  type CellValueChangedEvent,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
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
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
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
  const gridApiRef = useRef<GridApi<WorkDiaryGridRow> | null>(null);
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
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isAdmin = currentUser.role === "admin";
  const todayText = useMemo(() => formatDateInputValue(new Date()), []);
  const defaultWorkType = useMemo(
    () => workTypes.find((item) => item.code === "WORK" && item.isActive) ?? workTypes.find((item) => item.isActive) ?? null,
    [workTypes],
  );
  const defaultWorkTypeId = defaultWorkType?.id ?? null;
  const dirtyCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.isDeleted ||
          (row.rowState === "modified" && !row.isPlaceholder) ||
          (row.rowState === "new" && rowHasContent(row, defaultWorkTypeId)),
      ).length,
    [defaultWorkTypeId, rows],
  );

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
        width: 78,
        minWidth: 78,
        maxWidth: 92,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
        cellClass: "erp-grid-cell erp-grid-cell-row-number",
        cellRenderer: (params: ICellRendererParams<WorkDiaryGridRow>) => (
          <RowNumberWithState value={params.value} row={params.data} />
        ),
      },
      {
        field: "workDate",
        headerName: "일자(요일)",
        width: 132,
        editable: (params) => !params.data?.isDeleted,
        cellEditor: "agDateStringCellEditor",
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

  const saveRows = useCallback(() => {
    gridApiRef.current?.stopEditing();
    const created = rows
      .filter((row) => row.rowState === "new" && !row.isDeleted && rowHasContent(row, defaultWorkTypeId))
      .map(toSavePayload);
    const updated = rows
      .filter((row) => row.rowState === "modified" && !row.isDeleted && !row.isPlaceholder)
      .map(toSavePayload);
    const deleted = rows
      .filter((row) => row.isDeleted && row.rowState !== "new" && !row.isPlaceholder)
      .map((row) => row.id);

    if (!created.length && !updated.length && !deleted.length) {
      setNotice("저장할 변경사항이 없습니다.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/work-diaries", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ created, updated, deleted }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "업무일지 저장에 실패했습니다.");
        }
        setNotice("업무일지를 저장했습니다.");
        reloadRows(month, selectedUserId);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "업무일지 저장에 실패했습니다.");
      }
    });
  }, [defaultWorkTypeId, month, reloadRows, rows, selectedUserId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRows();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveRows]);

  function onCellValueChanged(event: CellValueChangedEvent<WorkDiaryGridRow>) {
    const row = event.data;
    const field = event.colDef.field;
    if (!row || !field || event.oldValue === event.newValue) {
      return;
    }
    const nextValue = normalizeCellValue(field, event.newValue);
    setRows((current) =>
      current.map((item) =>
        item.clientId === row.clientId
          ? {
              ...item,
              [field]: nextValue,
              rowState: item.isPlaceholder || item.rowState === "new" ? "new" : "modified",
              isPlaceholder: item.isPlaceholder && rowHasContent({ ...item, [field]: nextValue }, defaultWorkTypeId)
                ? false
                : item.isPlaceholder,
            }
          : item,
      ),
    );
  }

  function onSelectionChanged(event: SelectionChangedEvent<WorkDiaryGridRow>) {
    setSelectedRow(event.api.getSelectedRows()[0] ?? null);
  }

  function changeMonth(delta: -1 | 1) {
    const nextMonth = shiftMonth(month, delta);
    setMonth(nextMonth);
    reloadRows(nextMonth, selectedUserId);
  }

  function addRow() {
    const workDate = selectedRow?.workDate ?? `${month}-01`;
    const sameDateRows = rows.filter((row) => row.workDate === workDate);
    const row: WorkDiaryGridRow = {
      id: `new:${crypto.randomUUID()}`,
      clientId: crypto.randomUUID(),
      userId: selectedUser.id,
      userName: selectedUser.name,
      workDate,
      workType: "업무",
      workTypeId: defaultWorkTypeId,
      workTypeCode: defaultWorkType?.code ?? null,
      workTypeLabel: defaultWorkType?.label ?? null,
      workTypeColor: defaultWorkType?.color ?? null,
      primaryWork: "",
      secondaryWork: "",
      destinationId: null,
      destinationCode: null,
      destinationLabel: null,
      memo: "",
      sortOrder: Math.max(0, ...sameDateRows.map((item) => item.sortOrder)) + 1,
      isPlaceholder: false,
      rowState: "new",
      isDeleted: false,
      createdAt: null,
      updatedAt: null,
    };

    setRows((current) =>
      [...current, row].sort((left, right) =>
        left.workDate === right.workDate
          ? left.sortOrder - right.sortOrder
          : left.workDate.localeCompare(right.workDate),
      ),
    );
    setSelectedRow(row);
    setNotice(null);
  }

  function deleteSelectedRow() {
    if (!selectedRow) {
      setNotice("삭제할 행을 선택해 주세요.");
      return;
    }

    setRows((current) => {
      if (selectedRow.rowState === "new") {
        return current.filter((row) => row.clientId !== selectedRow.clientId);
      }

      if (selectedRow.isPlaceholder) {
        return current.map((row) =>
          row.clientId === selectedRow.clientId
            ? {
                ...row,
                primaryWork: "",
                secondaryWork: "",
              workTypeId: defaultWorkTypeId,
              workTypeCode: defaultWorkType?.code ?? null,
              workTypeLabel: defaultWorkType?.label ?? null,
              workTypeColor: defaultWorkType?.color ?? null,
              workType: defaultWorkType?.label ?? "업무",
                destinationId: null,
                destinationCode: null,
                destinationLabel: null,
                memo: "",
                rowState: "clean",
              }
            : row,
        );
      }

      return current.map((row) =>
        row.clientId === selectedRow.clientId ? { ...row, isDeleted: true } : row,
      );
    });
    setNotice("삭제 표시되었습니다. 저장하면 반영됩니다.");
  }

  return (
    <div className="crm-erp-surface space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#d8e0ea] bg-white px-3 py-3 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[#2f70dc]" />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="전월"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                reloadRows(event.target.value, selectedUserId);
              }}
              className="h-8 w-[150px]"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="다음월"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {isAdmin ? (
            <Select
              value={selectedUserId}
              onValueChange={(value) => {
                setSelectedUserId(value);
                reloadRows(month, value);
              }}
            >
              <SelectTrigger className="h-8 w-[180px]">
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
          ) : null}
          <Badge variant="outline" className="h-7 rounded-md px-2">
            {rows.length.toLocaleString()}행
          </Badge>
          {dirtyCount ? (
            <Badge className="h-7 rounded-md px-2">{dirtyCount.toLocaleString()}건 변경</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-4" />
              행 추가
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={deleteSelectedRow}>
              <Trash2 className="size-4" />
              행 삭제
            </Button>
          </div>
          <div className="flex items-center gap-2 border-l border-[#d8e0ea] pl-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDestinationDialogOpen(true)}
            >
              <MapPin className="size-4" />
              행선지 관리
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsWorkTypeDialogOpen(true)}
              >
                <Tags className="size-4" />
                업무구분 관리
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 border-l border-[#d8e0ea] pl-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => reloadRows()}
            >
              <RefreshCw className="size-4" />
              새로고침
            </Button>
            <Button type="button" size="sm" disabled={isPending} onClick={saveRows}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              저장
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
        <div className="rounded-md border border-[#c9d8ee] bg-[#f5f8fd] px-3 py-2 text-xs text-[#29456f]">
          {notice}
        </div>
      ) : null}

      <div className="ag-theme-quartz erp-grid h-[calc(100vh-15rem)] min-h-[520px] w-full overflow-hidden rounded-md border border-[#d8e0ea] bg-white">
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefs}
          getRowId={(params: GetRowIdParams<WorkDiaryGridRow>) => params.data.clientId}
          defaultColDef={{ resizable: true, sortable: true, filter: true, editable: true }}
          singleClickEdit
          rowSelection="single"
          suppressDragLeaveHidesColumns
          stopEditingWhenCellsLoseFocus
          onGridReady={(event) => {
            gridApiRef.current = event.api;
            event.api.getDisplayedRowAtIndex(0)?.setSelected(true);
          }}
          onCellValueChanged={onCellValueChanged}
          onCellEditingStarted={(event: CellEditingStartedEvent<WorkDiaryGridRow>) => {
            setEditingClientId(event.data?.clientId ?? null);
          }}
          onCellEditingStopped={(event: CellEditingStoppedEvent<WorkDiaryGridRow>) => {
            setEditingClientId((current) => (current === event.data?.clientId ? null : current));
          }}
          onSelectionChanged={onSelectionChanged}
          getRowClass={(params: RowClassParams<WorkDiaryGridRow>) => {
            const classes = [];
            if (params.data?.workDate === todayText) classes.push("work-diary-row-today");
            if (params.data?.clientId === editingClientId) classes.push("work-diary-row-editing");
            if (params.data?.isDeleted) classes.push("work-diary-row-deleted");
            else if (params.data?.rowState === "new") classes.push("work-diary-row-new");
            else if (params.data?.rowState === "modified") classes.push("work-diary-row-modified");
            return classes.length ? classes.join(" ") : undefined;
          }}
          overlayNoRowsTemplate='<span class="erp-grid-empty">표시할 업무일지가 없습니다</span>'
        />
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

function RowNumberWithState({ value, row }: { value: unknown; row?: WorkDiaryGridRow }) {
  const label = getRowStateLabel(row);

  return (
    <span className="work-diary-row-number-state">
      <span>{String(value ?? "")}</span>
      {label ? <span className={`work-diary-state-chip ${label.className}`}>{label.text}</span> : null}
    </span>
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

function getRowStateLabel(row?: WorkDiaryGridRow) {
  if (!row) return null;
  if (row.isDeleted) return { text: "삭제", className: "is-delete" };
  if (row.rowState === "new") return { text: "신규", className: "is-new" };
  if (row.rowState === "modified") return { text: "수정", className: "is-modified" };
  return null;
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
