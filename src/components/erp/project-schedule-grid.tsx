"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";
import {
  CalendarDays,
  CircleAlert,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import {
  ProjectScheduleStatusManager,
  statusBadgeStyle,
} from "@/components/erp/project-schedule-status-manager";
import type { ProjectScheduleStatusOptionRow } from "@/lib/types";
import { cn } from "@/lib/utils";

ModuleRegistry.registerModules([AllCommunityModule]);

type ProjectType = "main" | "sub";

type ProjectScheduleItem = {
  id?: string;
  scheduleDate?: string | null;
  scheduleText?: string | null;
  taskDescription?: string | null;
  managerName?: string | null;
  status?: string | null;
  memo?: string | null;
  sourceLineNumber?: number;
  sortOrder?: number;
};

type ProjectScheduleRow = Record<string, unknown> & {
  id: string;
  projectType: ProjectType;
  projectCode?: string | null;
  projectName?: string | null;
  taskDescription?: string | null;
  destinationName?: string | null;
  controlManagerName?: string | null;
  facilityManagerName?: string | null;
  managerName?: string | null;
  projectMonth?: string | null;
  status?: string | null;
  expenseMemo?: string | null;
  expenseAmount?: number;
  memo?: string | null;
  itemCount?: number;
  items?: ProjectScheduleItem[];
  __isNew?: boolean;
};

type DraftItem = {
  localId: string;
  scheduleDate: string;
  scheduleText: string;
  taskDescription: string;
  managerName: string;
  status: string;
  memo: string;
  sourceLineNumber: number;
  sortOrder: number;
};

type ProjectScheduleExportColumn = {
  header: string;
  width: number;
  value: (row: ProjectScheduleRow, index: number) => string | number;
};

type Permissions = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canUpload: boolean;
};

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  main: "MAIN",
  sub: "SUB",
};
const PROJECT_STATUS_EMPTY = "__empty_project_schedule_status__";
const PROJECT_SCHEDULE_MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ProjectScheduleGrid({
  mainRows,
  subRows,
  permissions,
  statusOptions: initialStatusOptions,
}: {
  mainRows: ProjectScheduleRow[];
  subRows: ProjectScheduleRow[];
  permissions: Permissions;
  statusOptions: ProjectScheduleStatusOptionRow[];
}) {
  const [activeType, setActiveType] = useState<ProjectType>("main");
  const [rowsByType, setRowsByType] = useState<Record<ProjectType, ProjectScheduleRow[]>>({
    main: mainRows,
    sub: subRows,
  });
  const [query, setQuery] = useState("");
  const [statusOptions, setStatusOptions] = useState(initialStatusOptions);
  const [selected, setSelected] = useState<ProjectScheduleRow | null>(mainRows[0] ?? null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ message?: string }[]>([]);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRows = rowsByType[activeType];
  const statusByLabel = useMemo(
    () => new Map(statusOptions.map((option) => [option.label, option])),
    [statusOptions],
  );
  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return activeRows;
    }
    return activeRows.filter((row) =>
      [
        row.projectCode,
        row.projectName,
        row.taskDescription,
        row.destinationName,
        row.controlManagerName,
        row.facilityManagerName,
        row.managerName,
        row.projectMonth,
        row.status,
        row.memo,
      ].some((value) => String(value ?? "").toLowerCase().includes(text)),
    );
  }, [activeRows, query]);

  const columnDefs = useMemo<ColDef<ProjectScheduleRow>[]>(() => {
    const common: ColDef<ProjectScheduleRow>[] = [
      { field: "projectCode", headerName: "관리번호", width: 120 },
      { field: "projectName", headerName: "프로젝트", width: 260 },
      { field: "taskDescription", headerName: "업무내용", width: 340 },
    ];
    if (activeType === "main") {
      return [
        ...common,
        { field: "destinationName", headerName: "설치장소", width: 170 },
        {
          field: "controlManagerName",
          headerName: "제어부 담당",
          width: 150,
          autoHeight: true,
          cellStyle: { whiteSpace: "pre-line", lineHeight: "1.45" },
        },
        {
          field: "facilityManagerName",
          headerName: "설비부 담당",
          width: 150,
          autoHeight: true,
          cellStyle: { whiteSpace: "pre-line", lineHeight: "1.45" },
        },
        {
          field: "status",
          headerName: "상태",
          width: 120,
          cellRenderer: (params: ICellRendererParams<ProjectScheduleRow>) => (
            <StatusBadge value={params.value} option={statusByLabel.get(String(params.value ?? ""))} />
          ),
        },
        { field: "memo", headerName: "비고", width: 180 },
        { field: "itemCount", headerName: "일정", width: 90, cellClass: "erp-grid-cell erp-grid-cell-number" },
      ];
    }
    return [
      ...common,
      { field: "managerName", headerName: "담당자", width: 170 },
      { field: "projectMonth", headerName: "행선지", width: 110 },
      {
        field: "status",
        headerName: "상태",
        width: 120,
        cellRenderer: (params: ICellRendererParams<ProjectScheduleRow>) => (
          <StatusBadge value={params.value} option={statusByLabel.get(String(params.value ?? ""))} />
        ),
      },
      { field: "memo", headerName: "비고", width: 180 },
      { field: "itemCount", headerName: "일정", width: 90, cellClass: "erp-grid-cell erp-grid-cell-number" },
    ];
  }, [activeType, statusByLabel]);

  function changeType(type: ProjectType) {
    setActiveType(type);
    setSelected(rowsByType[type][0] ?? null);
  }

  async function fetchRows(type: ProjectType) {
    const params = new URLSearchParams({ type });
    const response = await fetch(`/api/project-schedules?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "프로젝트 조회에 실패했습니다.");
    }
    return (data.rows ?? []) as ProjectScheduleRow[];
  }

  async function reloadType(type: ProjectType) {
    const latestRows = await fetchRows(type);
    setRowsByType((current) => ({ ...current, [type]: latestRows }));
    setSelected(latestRows[0] ?? null);
  }

  async function reloadAllTypes() {
    const [latestMainRows, latestSubRows] = await Promise.all([fetchRows("main"), fetchRows("sub")]);
    setRowsByType({ main: latestMainRows, sub: latestSubRows });
    setSelected((activeType === "main" ? latestMainRows : latestSubRows)[0] ?? null);
  }

  function replaceRow(row: ProjectScheduleRow) {
    setRowsByType((current) => {
      const type = row.projectType;
      const nextRows = current[type].map((currentRow) => (currentRow.id === row.id ? row : currentRow));
      return {
        ...current,
        [type]: nextRows.some((currentRow) => currentRow.id === row.id) ? nextRows : [row, ...nextRows],
      };
    });
    setSelected(row);
  }

  function removeRow(id: string, type: ProjectType) {
    setRowsByType((current) => {
      const nextRows = current[type].filter((row) => row.id !== id);
      return { ...current, [type]: nextRows };
    });
    setSelected(null);
    setIsDetailOpen(false);
  }

  function openNewDialog() {
    const row: ProjectScheduleRow = {
      id: `new-project-schedule-${crypto.randomUUID()}`,
      __isNew: true,
      projectType: activeType,
      projectCode: "",
      projectName: "",
      taskDescription: "",
      destinationName: "",
      controlManagerName: "",
      facilityManagerName: "",
      managerName: "",
      projectMonth: "",
      status: "",
      expenseMemo: "",
      expenseAmount: 0,
      memo: "",
      items: [],
      itemCount: 0,
    };
    setSelected(row);
    setIsDetailOpen(true);
  }

  function openUploadDialog() {
    setFile(null);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsUploadOpen(true);
  }

  function selectUploadFile(nextFile: File | null) {
    setErrors([]);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setErrors([{ message: ".xlsx 파일만 업로드할 수 있습니다." }]);
      return;
    }
    if (nextFile.size > PROJECT_SCHEDULE_MAX_FILE_SIZE) {
      setFile(null);
      setErrors([{ message: "프로젝트 엑셀 파일은 10MB 이하만 업로드할 수 있습니다." }]);
      return;
    }
    setFile(nextFile);
  }

  function upload() {
    if (!file) {
      setErrors([{ message: "업로드할 엑셀 파일을 선택해주세요." }]);
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("action", "commit");
    setErrors([]);

    startTransition(async () => {
      const response = await fetch("/api/imports/project-schedules", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors?.length ? data.errors : [{ message: data.error ?? "업로드에 실패했습니다." }]);
        return;
      }
      if (!data.batch) {
        setErrors(
          data.errors?.length
            ? data.errors
            : [{ message: "프로젝트 데이터를 저장하지 못했습니다. 데이터베이스 연결을 확인해 주세요." }],
        );
        return;
      }
      setIsUploadOpen(false);
      const [latestMainRows, latestSubRows] = await Promise.all([fetchRows("main"), fetchRows("sub")]);
      setRowsByType({ main: latestMainRows, sub: latestSubRows });
      setSelected((activeType === "main" ? latestMainRows : latestSubRows)[0] ?? null);
    });
  }

  async function downloadUploadTemplate() {
    if (isDownloadingTemplate) return;
    setIsDownloadingTemplate(true);
    setErrors([]);
    try {
      const response = await fetch("/api/imports/project-schedules?template=1");
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "업로드 샘플 다운로드에 실패했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "프로젝트_업로드_샘플.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrors([
        { message: error instanceof Error ? error.message : "업로드 샘플 다운로드에 실패했습니다." },
      ]);
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function downloadExcel() {
    if (!filteredRows.length || isDownloading) {
      return;
    }

    setIsDownloading(true);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheetName = `${PROJECT_TYPE_LABELS[activeType]} PROJECT`;
      const worksheet = workbook.addWorksheet(sheetName);
      const columns = getProjectScheduleExportColumns(activeType);

      worksheet.views = [{ state: "frozen", ySplit: 1 }];
      worksheet.properties.defaultRowHeight = 20;
      worksheet.addRow(columns.map((column) => column.header));
      filteredRows.forEach((row, index) => {
        worksheet.addRow(columns.map((column) => column.value(row, index)));
      });

      const headerRow = worksheet.getRow(1);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      columns.forEach((column, index) => {
        worksheet.getColumn(index + 1).width = column.width;
      });
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.alignment = { vertical: "middle", wrapText: true };
      });
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const fileName = `프로젝트_${PROJECT_TYPE_LABELS[activeType]}_${localDateText()}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "엑셀 다운로드에 실패했습니다.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="crm-erp-surface mx-auto flex h-[calc(100vh-5.5rem)] max-w-[1840px] flex-col gap-3 overflow-hidden">
      <div className="hidden items-end justify-between gap-3 md:flex">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[#0d1b3d]">프로젝트</h1>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]">
        <div className="grid gap-px bg-[#edf1f6] p-px xl:grid-cols-[240px_88px_minmax(260px,1fr)_auto]">
          <div className="flex items-center gap-1 bg-white p-2">
            {(["main", "sub"] as ProjectType[]).map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant={activeType === type ? "default" : "outline"}
                className={cn("h-8 flex-1", activeType !== type && "bg-white")}
                onClick={() => changeType(type)}
              >
                {PROJECT_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
          <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
            검색어
          </div>
          <div className="bg-white p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="프로젝트, 업무내용, 담당자, 상태 검색"
                className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
              />
            </div>
          </div>
          <div className="flex bg-[#f8fafc] p-2 xl:min-w-[116px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                startTransition(() => void reloadType(activeType));
              }}
              disabled={isPending && !query}
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              초기화
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline" className="h-7 w-fit border-[#cfd9e7] bg-white px-2.5 text-xs">
          {filteredRows.length.toLocaleString()}건
        </Badge>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {permissions.canCreate ? (
            <Button type="button" size="sm" className="justify-center" onClick={openNewDialog} disabled={isPending}>
              <Plus className="size-3.5" />
              신규 추가
            </Button>
          ) : null}
          {permissions.canUpdate ? (
            <Button type="button" size="sm" variant="outline" className="bg-white" onClick={() => setIsStatusOpen(true)} disabled={isPending}>
              <Settings2 className="size-3.5" />
              상태 관리
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-white"
            onClick={() => void downloadExcel()}
            disabled={isDownloading || filteredRows.length === 0}
          >
            {isDownloading ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
            엑셀 다운로드
          </Button>
          {permissions.canUpload ? (
            <Button type="button" size="sm" onClick={openUploadDialog} disabled={isPending}>
              <FileUp className="size-3.5" />
              엑셀 업로드
            </Button>
          ) : null}
        </div>
      </div>

      <section className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_10px_34px_rgba(15,28,48,0.06)]">
        {isPending ? (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-[#dbe7fb]">
            <span className="block h-full w-1/3 animate-pulse bg-[#2f70dc]" />
          </div>
        ) : null}
        <div className="ag-theme-quartz erp-grid h-full w-full">
          <AgGridReact
            key={activeType}
            rowData={filteredRows}
            columnDefs={columnDefs}
            rowSelection="single"
            animateRows={false}
            theme="legacy"
            onGridReady={(event: GridReadyEvent<ProjectScheduleRow>) => {
              if (filteredRows.length) event.api.getDisplayedRowAtIndex(0)?.setSelected(true);
            }}
            onSelectionChanged={(event) => setSelected(event.api.getSelectedRows()[0] ?? null)}
            onCellDoubleClicked={(event) => {
              if (event.data) {
                setSelected(event.data);
                setIsDetailOpen(true);
              }
            }}
            defaultColDef={{
              minWidth: 110,
              sortable: true,
              resizable: true,
              filter: true,
              suppressHeaderMenuButton: true,
              cellClass: "erp-grid-cell",
            }}
            overlayNoRowsTemplate='<span class="erp-grid-empty">표시할 행이 없습니다</span>'
          />
        </div>
        <div className="absolute right-4 bottom-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-white shadow-sm"
            onClick={() => selected && setIsDetailOpen(true)}
            disabled={!selected}
          >
            <CalendarDays className="size-3.5" />
            상세
          </Button>
        </div>
      </section>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="!flex h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-[calc(100vw-20px)] !max-w-[1078px] flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[92dvh] xl:w-[70vw]">
          <DialogHeader className="shrink-0 border-b border-[#d8e0ea] bg-[#f8fafc] px-4 py-3">
            <DialogTitle className="text-sm text-[#0d1b3d]">
              {selected?.__isNew ? "신규 프로젝트" : "프로젝트 상세"}
            </DialogTitle>
            <DialogDescription className="sr-only">프로젝트 기본 정보와 일정 목록을 확인하고 수정합니다.</DialogDescription>
          </DialogHeader>
          {selected ? (
            <ProjectScheduleDetail
              key={String(selected.id)}
              row={selected}
              permissions={permissions}
              replaceRow={replaceRow}
              removeRow={removeRow}
              statusOptions={statusOptions}
              onClose={() => setIsDetailOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>프로젝트 상태 관리</DialogTitle>
            <DialogDescription>프로젝트 화면과 상세 화면에서 사용할 상태명과 색상을 관리합니다.</DialogDescription>
          </DialogHeader>
          <ProjectScheduleStatusManager
            initialOptions={statusOptions}
            onOptionsChange={setStatusOptions}
            onRowsChange={() => {
              startTransition(() => void reloadAllTypes());
            }}
          />
        </DialogContent>
      </Dialog>

      {permissions.canUpload ? (
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="max-h-[calc(100vh-24px)] gap-0 overflow-hidden p-0 sm:max-h-[88vh] sm:max-w-[720px]">
            <DialogHeader className="shrink-0 border-b border-[#e1e7ef] px-5 py-4 pr-12">
              <DialogTitle className="text-[15px] font-semibold text-[#17233b]">프로젝트 엑셀 업로드</DialogTitle>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
              <div className="grid gap-5">
                <section className="rounded-lg border border-[#d7e0eb] bg-[#f8fafc] p-3.5" aria-labelledby="upload-guide-title">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CircleAlert className="size-4 text-[#526b91]" />
                        <h3 id="upload-guide-title" className="text-xs font-semibold text-[#26344d]">업로드 전 확인</h3>
                      </div>
                      <ul className="mt-2 grid gap-1 text-[11px] leading-5 text-[#5c687b] sm:text-xs">
                        <li><b className="font-semibold text-[#34435b]">시트</b> · MAIN PROJECT 또는 SUB PROJECT, 프로젝트명 필수</li>
                        <li><b className="font-semibold text-[#34435b]">코드</b> · 공란이면 MAIN은 GSTMYY_###, SUB는 GSTSYY_###로 자동 생성</li>
                        <li><b className="font-semibold text-[#34435b]">반영</b> · 같은 코드는 갱신하고 자동 생성 코드는 신규 저장</li>
                      </ul>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 self-end bg-white sm:self-auto"
                      onClick={() => void downloadUploadTemplate()}
                      disabled={isDownloadingTemplate || isPending}
                    >
                      {isDownloadingTemplate ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <FileDown className="size-3.5" />
                      )}
                      <span className="hidden sm:inline">샘플 양식</span>
                      <span className="sm:hidden">샘플</span>
                    </Button>
                  </div>
                </section>

                <div className="grid gap-2">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <Label htmlFor="project-schedule-upload-file" className="text-xs font-semibold text-[#26344d]">엑셀 파일</Label>
                      <p className="mt-0.5 text-[11px] text-[#7a8698]">.xlsx 형식 · 최대 10MB</p>
                    </div>
                    {file ? (
                      <span className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold",
                        errors.length
                          ? "bg-[#fff0f0] text-[#c43c3c]"
                          : "bg-[#edf4ff] text-[#245db3]",
                      )}>
                        {errors.length ? "확인 필요" : "선택 완료"}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    ref={fileInputRef}
                    id="project-schedule-upload-file"
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => selectUploadFile(event.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onDragEnter={() => setIsFileDragging(true)}
                    onDragLeave={() => setIsFileDragging(false)}
                    onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
                    onDrop={(event: DragEvent<HTMLButtonElement>) => {
                      event.preventDefault();
                      setIsFileDragging(false);
                      selectUploadFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex min-h-36 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed px-5 py-6 text-center transition-all focus-visible:ring-2 focus-visible:ring-[#2f70dc]/25 focus-visible:outline-none",
                      file
                        ? "border-[#91afe0] bg-[#f4f7fd] hover:border-[#6590d5]"
                        : "border-[#b8c6d8] bg-white hover:border-[#2f70dc] hover:bg-[#f8fbff]",
                      isFileDragging && "scale-[0.995] border-[#2f70dc] bg-[#eef4ff]",
                    )}
                  >
                    <span className="flex min-w-0 flex-col items-center">
                      <span className={cn(
                        "mb-3 flex size-11 items-center justify-center rounded-xl border bg-white shadow-sm",
                        file ? "border-[#c9d8ef] text-[#2f70dc]" : "border-[#dbe3ed] text-[#5c7191]",
                      )}>
                        {file ? <FileSpreadsheet className="size-5" /> : <UploadCloud className="size-5" />}
                      </span>
                      <span className="block max-w-full truncate text-sm font-semibold text-[#17233b]">
                        {file ? file.name : "파일을 끌어놓거나 클릭해 선택하세요"}
                      </span>
                      <span className="mt-1 block text-xs text-[#69758a]">
                        {file ? `${formatFileSize(file.size)} · 클릭하면 파일 변경` : "샘플 양식에 맞는 Excel 통합 문서"}
                      </span>
                    </span>
                  </button>
                </div>

                {errors.length ? (
                  <Alert variant="destructive" className="border-[#f0b8b8] bg-[#fff7f7] px-3 py-3">
                    <CircleAlert className="size-4" />
                    <AlertTitle className="text-xs font-semibold">파일을 다시 확인해 주세요</AlertTitle>
                    <AlertDescription className="whitespace-pre-line text-xs leading-5">
                      {errors.map((error) => error.message).join("\n")}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-[#e1e7ef] bg-[#f8fafc] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="hidden text-[11px] text-[#69758a] sm:block">
                {errors.length
                  ? "오류를 수정한 파일로 다시 업로드해 주세요."
                  : file
                    ? "선택한 파일을 프로젝트에 바로 반영합니다."
                    : "업로드할 파일을 먼저 선택해 주세요."}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={upload}
                  disabled={isPending || !file}
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  업로드
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">취소</Button>
                </DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function getProjectScheduleExportColumns(type: ProjectType): ProjectScheduleExportColumn[] {
  const commonColumns: ProjectScheduleExportColumn[] = [
    { header: "No", width: 8, value: (_row, index) => index + 1 },
    { header: "관리번호", width: 16, value: (row) => String(row.projectCode ?? "") },
    { header: "프로젝트", width: 32, value: (row) => String(row.projectName ?? "") },
    { header: "업무내용", width: 42, value: (row) => String(row.taskDescription ?? "") },
  ];

  if (type === "main") {
    return [
      ...commonColumns,
      { header: "설치장소", width: 22, value: (row) => String(row.destinationName ?? "") },
      { header: "제어부 담당", width: 20, value: (row) => String(row.controlManagerName ?? "") },
      { header: "설비부 담당", width: 20, value: (row) => String(row.facilityManagerName ?? "") },
      { header: "상태", width: 16, value: (row) => String(row.status ?? "") },
      { header: "비고", width: 24, value: (row) => String(row.memo ?? "") },
      { header: "일정", width: 10, value: (row) => Number(row.itemCount ?? 0) },
    ];
  }

  return [
    ...commonColumns,
    { header: "담당자", width: 20, value: (row) => String(row.managerName ?? "") },
    { header: "행선지", width: 18, value: (row) => String(row.projectMonth ?? "") },
    { header: "상태", width: 16, value: (row) => String(row.status ?? "") },
    { header: "비고", width: 24, value: (row) => String(row.memo ?? "") },
    { header: "일정", width: 10, value: (row) => Number(row.itemCount ?? 0) },
  ];
}

function localDateText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ProjectScheduleDetail({
  row,
  permissions,
  replaceRow,
  removeRow,
  statusOptions,
  onClose,
}: {
  row: ProjectScheduleRow;
  permissions: Permissions;
  replaceRow: (row: ProjectScheduleRow) => void;
  removeRow: (id: string, type: ProjectType) => void;
  statusOptions: ProjectScheduleStatusOptionRow[];
  onClose: () => void;
}) {
  const isNew = row.__isNew === true;
  const editable = isNew ? permissions.canCreate : permissions.canUpdate;
  const [projectCode, setProjectCode] = useState(String(row.projectCode ?? ""));
  const [projectName, setProjectName] = useState(String(row.projectName ?? ""));
  const [taskDescription, setTaskDescription] = useState(String(row.taskDescription ?? ""));
  const [destinationName, setDestinationName] = useState(String(row.destinationName ?? ""));
  const [controlManagerName, setControlManagerName] = useState(String(row.controlManagerName ?? ""));
  const [facilityManagerName, setFacilityManagerName] = useState(String(row.facilityManagerName ?? ""));
  const [managerName, setManagerName] = useState(String(row.managerName ?? ""));
  const [projectMonth, setProjectMonth] = useState(String(row.projectMonth ?? ""));
  const [status, setStatus] = useState(String(row.status ?? ""));
  const [memo, setMemo] = useState(String(row.memo ?? ""));
  const [items, setItems] = useState<DraftItem[]>(() => toDraftItems(row.items));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectableStatusOptions = useMemo(
    () => buildSelectableStatusOptions(statusOptions, status),
    [status, statusOptions],
  );

  function addItem() {
    const mainManagerName = combineManagerNames(controlManagerName, facilityManagerName);
    setItems((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        scheduleDate: "",
        scheduleText: "",
        taskDescription,
        managerName: row.projectType === "main" ? mainManagerName : managerName,
        status,
        memo: "",
        sourceLineNumber: current.length + 1,
        sortOrder: current.length,
      },
    ]);
  }

  function updateItem(localId: string, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  }

  function removeItem(localId: string) {
    setItems((current) => current.filter((item) => item.localId !== localId));
  }

  function save() {
    setError(null);
    const payload = {
      projectType: row.projectType,
      projectCode,
      projectName,
      taskDescription,
      destinationName,
      controlManagerName,
      facilityManagerName,
      managerName: row.projectType === "main" ? combineManagerNames(controlManagerName, facilityManagerName) : managerName,
      projectMonth,
      status,
      expenseMemo: row.expenseMemo,
      expenseAmount: row.expenseAmount,
      memo,
      items: items.map((item, index) => ({
        scheduleDate: item.scheduleDate,
        scheduleText: item.scheduleText,
        taskDescription: item.taskDescription,
        managerName: item.managerName,
        status: item.status,
        memo: item.memo,
        sourceLineNumber: item.sourceLineNumber || index + 1,
        sortOrder: index,
      })),
    };
    startTransition(async () => {
      const response = await fetch("/api/project-schedules", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNew ? payload : { id: row.id, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "프로젝트 저장에 실패했습니다.");
        return;
      }
      replaceRow(data.row);
    });
  }

  function deleteCurrent() {
    if (!window.confirm("선택한 프로젝트를 삭제할까요? 일정도 함께 삭제됩니다.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/project-schedules?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "프로젝트 삭제에 실패했습니다.");
        return;
      }
      removeRow(row.id, row.projectType);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-xs text-[#1f2a3d]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <section className="overflow-hidden rounded-lg border border-[#dce6f3] bg-white shadow-[0_10px_28px_rgba(15,28,48,0.06)]">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#0f4cad] text-white shadow-[0_6px_14px_rgba(15,76,173,0.22)]">
                  <ClipboardList className="size-4.5" />
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <Badge className="h-5 shrink-0 border-0 bg-[#eef4ff] px-2 text-[10px] font-extrabold text-[#164899] shadow-none">
                    {PROJECT_TYPE_LABELS[row.projectType]}
                  </Badge>
                  <h2 className="truncate text-base font-extrabold text-[#0d1b3d]">
                    {projectName || "이름 없는 프로젝트"}
                  </h2>
                </div>
              </div>
              <Badge variant="outline" className="h-6 shrink-0 rounded-md border-[#d8e2ef] bg-white px-2.5 text-[11px] font-extrabold text-[#26344d]">
                {items.length.toLocaleString()} 일정
              </Badge>
            </div>

            <div className="grid border-t border-[#dce6f3] bg-[#dce6f3] lg:grid-cols-[120px_minmax(220px,0.8fr)_120px_minmax(320px,1.2fr)]">
              <DetailLabel label="관리번호" />
              <DetailBox>
                <Input
                  value={projectCode}
                  onChange={(event) => setProjectCode(event.target.value)}
                  disabled={!editable}
                  className="h-8 w-fit min-w-24 border-[#d5e2f2] bg-[#edf4ff] px-2.5 font-extrabold text-[#174c98] shadow-none"
                />
              </DetailBox>
              <DetailLabel label="프로젝트명" />
              <DetailBox>
                <Input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  disabled={!editable}
                  className="h-8 border-transparent bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                />
              </DetailBox>

              {row.projectType === "main" ? (
                <>
                  <DetailLabel label="설치장소" />
                  <DetailBox>
                    <Input
                      value={destinationName}
                      onChange={(event) => setDestinationName(event.target.value)}
                      disabled={!editable}
                      className="h-8 border-transparent bg-transparent px-0 shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                    />
                  </DetailBox>
                  <DetailLabel label="상태" />
                  <DetailBox>
                    <StatusSelect
                      value={status}
                      onChange={setStatus}
                      disabled={!editable}
                      options={selectableStatusOptions}
                    />
                  </DetailBox>
                </>
              ) : (
                <>
                  <DetailLabel label="행선지" />
                  <DetailBox>
                    <Input
                      value={projectMonth}
                      onChange={(event) => setProjectMonth(event.target.value)}
                      disabled={!editable}
                      className="h-8 border-transparent bg-transparent px-0 shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                    />
                  </DetailBox>
                  <DetailLabel label="상태" />
                  <DetailBox>
                    <StatusSelect
                      value={status}
                      onChange={setStatus}
                      disabled={!editable}
                      options={selectableStatusOptions}
                    />
                  </DetailBox>
                </>
              )}

              <DetailLabel label="업무내용" />
              <DetailBox className="lg:col-span-3">
                <Textarea
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                  disabled={!editable}
                  rows={3}
                  placeholder="업무내용을 입력하세요"
                  className="min-h-8 resize-y border-transparent bg-transparent px-0 py-1 leading-5 shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                />
              </DetailBox>

              {row.projectType === "main" ? (
                <>
                  <DetailLabel label="설비부 담당" />
                  <DetailBox>
                    <Textarea
                      value={facilityManagerName}
                      onChange={(event) => setFacilityManagerName(event.target.value)}
                      disabled={!editable}
                      rows={2}
                      placeholder="한 줄에 한 명씩 입력"
                      className="min-h-10 resize-y border-transparent bg-transparent px-0 leading-5 shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                    />
                  </DetailBox>
                  <DetailLabel label="제어부 담당" />
                  <DetailBox>
                    <Textarea
                      value={controlManagerName}
                      onChange={(event) => setControlManagerName(event.target.value)}
                      disabled={!editable}
                      rows={2}
                      placeholder="한 줄에 한 명씩 입력"
                      className="min-h-10 resize-y border-transparent bg-transparent px-0 leading-5 shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                    />
                  </DetailBox>
                </>
              ) : (
                <>
                  <DetailLabel label="담당자" />
                  <DetailBox className="lg:col-span-3">
                    <Input
                      value={managerName}
                      onChange={(event) => setManagerName(event.target.value)}
                      disabled={!editable}
                      className="h-8 border-transparent bg-transparent px-0 shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                    />
                  </DetailBox>
                </>
              )}
              <DetailLabel label="비고" />
              <DetailBox className="lg:col-span-3">
                <Textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  disabled={!editable}
                  rows={2}
                  placeholder="비고를 입력하세요"
                  className="min-h-10 resize-y border-transparent bg-transparent px-0 leading-5 shadow-none focus-visible:border-[#2f70dc] focus-visible:px-2"
                />
              </DetailBox>
            </div>
          </section>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle className="text-xs">확인 필요</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-[#dce6f3] bg-white shadow-[0_14px_36px_rgba(15,28,48,0.07)]">
            <div className="flex items-center justify-between border-b border-[#dce6f3] bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-[#0f4cad]" />
                <p className="text-sm font-extrabold text-[#0d1b3d]">일정</p>
              </div>
              {editable ? (
                <Button type="button" size="sm" className="h-8 bg-[#0f4cad] shadow-[0_8px_18px_rgba(15,76,173,0.22)] hover:bg-[#0d4192]" onClick={addItem}>
                  <Plus className="size-3.5" />
                  일정 추가
                </Button>
              ) : null}
            </div>
            <div className="max-h-[392px] overflow-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[120px]" />
                  <col className="w-[360px]" />
                  <col className="w-[220px]" />
                  <col className="w-[44px]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[#f8fafc] text-[11px] font-extrabold text-[#51627b]">
                  <tr className="border-b border-[#dce6f3]">
                    <th className="px-4 py-2.5">일자</th>
                    <th className="px-2 py-2.5">일정</th>
                    <th className="px-2 py-2.5">비고</th>
                    <th className="px-3 py-2.5 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.localId} className="border-b border-[#edf1f6] bg-white last:border-b-0 hover:bg-[#fbfdff]">
                      <ScheduleCell>
                        <Input type="date" value={item.scheduleDate} onChange={(event) => updateItem(item.localId, { scheduleDate: event.target.value })} disabled={!editable} className="h-8 border-[#dce6f3] bg-white font-mono shadow-sm" />
                      </ScheduleCell>
                      <ScheduleCell>
                        <Input value={item.scheduleText} onChange={(event) => updateItem(item.localId, { scheduleText: event.target.value })} disabled={!editable} className="h-8 border-[#dce6f3] bg-white shadow-sm" />
                      </ScheduleCell>
                      <ScheduleCell>
                        <Input value={item.memo} onChange={(event) => updateItem(item.localId, { memo: event.target.value })} disabled={!editable} placeholder="비고 입력" className="h-8 border-[#dce6f3] bg-white shadow-sm placeholder:text-[#9aa8ba]" />
                      </ScheduleCell>
                      <td className="px-3 py-1 text-center">
                        {editable ? (
                          <Button type="button" size="icon-xs" variant="ghost" className="text-[#40516c] hover:bg-[#eef4ff] hover:text-[#0f4cad]" title="일정 삭제" aria-label="일정 삭제" onClick={() => removeItem(item.localId)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!items.length ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[#7b8798]">
                        등록된 일정이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      <div className="shrink-0 border-t border-[#d8e0ea] bg-white px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!isNew && permissions.canDelete ? (
            <Button type="button" variant="destructive" size="sm" className="h-11 w-full bg-[#fff1f1] text-[#e11d48] shadow-none hover:bg-[#ffe4e6] sm:h-10 sm:w-auto sm:px-6" onClick={deleteCurrent} disabled={isPending}>
              <Trash2 className="size-3.5" />
              삭제
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {editable ? (
              <Button type="button" size="sm" className="h-11 w-full bg-[#0f4cad] shadow-[0_8px_18px_rgba(15,76,173,0.22)] hover:bg-[#0d4192] sm:h-10 sm:w-auto sm:px-5" onClick={save} disabled={isPending || !projectName.trim()}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {isNew ? "등록" : "저장"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-11 w-full border-[#d8e2ef] bg-white text-[#1f2a3d] sm:h-10 sm:w-auto sm:px-5" onClick={onClose}>
              <X className="size-3.5" />
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailLabel({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center border-r border-b border-[#dce6f3] bg-[#f8fafc] px-5 py-3 text-[12px] font-extrabold whitespace-nowrap text-[#52647d]",
        className,
      )}
    >
      {label}
    </div>
  );
}

function DetailBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 border-b border-[#dce6f3] bg-white px-4 py-2", className)}>{children}</div>;
}

function ScheduleCell({ children }: { children: ReactNode }) {
  return <td className="px-2 py-1.5 align-middle first:pl-4">{children}</td>;
}

function StatusSelect({
  value,
  onChange,
  disabled,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  options: ProjectScheduleStatusOptionRow[];
}) {
  return (
    <Select
      value={value || PROJECT_STATUS_EMPTY}
      onValueChange={(nextValue) => onChange(nextValue === PROJECT_STATUS_EMPTY ? "" : nextValue)}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 border-[#d8ecd8] bg-[#f3fbf2] text-xs font-semibold text-[#244235] shadow-none focus-visible:border-[#64b878] focus-visible:ring-[#64b878]/20">
        <SelectValue placeholder="상태 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={PROJECT_STATUS_EMPTY}>선택 안 함</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.label}>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full border border-black/10" style={{ backgroundColor: option.color }} />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusBadge({
  value,
  option,
}: {
  value: unknown;
  option?: ProjectScheduleStatusOptionRow;
}) {
  const text = String(value ?? "").trim();
  if (!text) return <span className="text-[#9aa6b6]">-</span>;

  return (
    <span
      className="erp-value-badge"
      style={option ? statusBadgeStyle(option.color) : statusBadgeStyle("#64748b")}
    >
      {text}
    </span>
  );
}

function buildSelectableStatusOptions(options: ProjectScheduleStatusOptionRow[], currentStatus: string) {
  const activeOptions = options.filter((option) => option.isActive);
  const hasCurrent = currentStatus && activeOptions.some((option) => option.label === currentStatus);
  if (!currentStatus || hasCurrent) {
    return activeOptions;
  }

  return [
    ...activeOptions,
    {
      id: `current-project-schedule-status-${currentStatus}`,
      label: currentStatus,
      color: "#64748b",
      sortOrder: 999,
      isActive: true,
      usageCount: 0,
      isManaged: false,
      createdAt: null,
      updatedAt: null,
    },
  ];
}

function toDraftItems(items: ProjectScheduleItem[] | undefined): DraftItem[] {
  return (items ?? []).map((item, index) => ({
    localId: item.id ?? crypto.randomUUID(),
    scheduleDate: String(item.scheduleDate ?? ""),
    scheduleText: String(item.scheduleText ?? ""),
    taskDescription: String(item.taskDescription ?? ""),
    managerName: String(item.managerName ?? ""),
    status: String(item.status ?? ""),
    memo: String(item.memo ?? ""),
    sourceLineNumber: Number(item.sourceLineNumber ?? index + 1),
    sortOrder: Number(item.sortOrder ?? index),
  }));
}

function combineManagerNames(...values: string[]) {
  return values
    .flatMap((value) => value.split(/\r?\n/))
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}
