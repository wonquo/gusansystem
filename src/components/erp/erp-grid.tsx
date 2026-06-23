"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridReadyEvent,
  type ICellRendererParams,
  type SelectionChangedEvent,
  type ValueFormatterParams,
  type ValueGetterParams,
} from "ag-grid-community";
import {
  AlertCircle,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ProjectDetail } from "@/components/erp/project-detail";
import { PayrollSlipView, formatDate, formatMoney } from "@/components/erp/payroll-slip-view";
import { cn } from "@/lib/utils";

ModuleRegistry.registerModules([AllCommunityModule]);

export type ErpGridColumn = {
  field: string;
  headerName: string;
  width?: number;
  type?: "money" | "date" | "text";
};

export type ErpGridDetailHelpers = {
  replaceRow: (row: Record<string, unknown>) => void;
  removeRow: (id: string) => void;
  reloadRows: () => Promise<void>;
};

type ErpGridDetailType = "default" | "payroll-slip" | "project";
type ErpGridSearchMode = "default" | "payroll";
type ErpGridPayrollScope = "all" | "mine";

const STATUS_FIELDS = new Set(["status", "direction", "importType"]);
const NUMERIC_FIELD_HINTS = ["amount", "count", "pay", "deduction", "balance"];
const ALL_PAYROLL_YEARS = "__all_payroll_years__";
const ALL_PAYROLL_MONTH_NUMBERS = "__all_payroll_month_numbers__";
const MONTH_NUMBER_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

export function ErpGrid({
  title,
  rows,
  columns,
  uploadType,
  uploadEnabled = false,
  detail,
  detailType = "default",
  searchMode = "default",
  payrollScope = "all",
  deleteEnabled = false,
  createEnabled = false,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: ErpGridColumn[];
  uploadType?: string;
  uploadEnabled?: boolean;
  detailType?: ErpGridDetailType;
  searchMode?: ErpGridSearchMode;
  payrollScope?: ErpGridPayrollScope;
  deleteEnabled?: boolean;
  createEnabled?: boolean;
  detail?: (row: Record<string, unknown>, helpers: ErpGridDetailHelpers) => ReactNode;
}) {
  const [gridRows, setGridRows] = useState(rows);
  const [query, setQuery] = useState("");
  const [payrollYear, setPayrollYear] = useState("");
  const [payrollMonthNumber, setPayrollMonthNumber] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [payrollQuery, setPayrollQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(rows[0] ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [errors, setErrors] = useState<{ message?: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const isPayrollSearch = searchMode === "payroll";
  const isPayrollSlipDetail = detailType === "payroll-slip";
  const isProjectDetail = detailType === "project";

  const openProjectDetailDialog = useCallback((row: Record<string, unknown>) => {
    setSelected(row);
    setIsDetailDialogOpen(true);
  }, []);

  const openNewProjectDialog = useCallback(() => {
    setSelected({
      id: `new-project-${crypto.randomUUID()}`,
      __isNew: true,
      projectName: "",
      clientName: "",
      orderedOn: todayDateInputValue(),
      memo: "",
      items: [],
      rawData: {},
    });
    setIsDetailDialogOpen(true);
  }, []);

  const columnDefs = useMemo<ColDef[]>(
    () =>
      [
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
          valueGetter: (params: ValueGetterParams<Record<string, unknown>>) =>
            params.node?.rowPinned ? "합계" : (params.node?.rowIndex ?? 0) + 1,
        },
        ...columns.map((column) => {
          const isNumeric = column.type === "money" || isNumericField(column.field);
          const isStatus = STATUS_FIELDS.has(column.field);

          return {
            field: column.field,
            headerName: column.headerName,
            width: column.width,
            sortable: true,
            filter: true,
            resizable: true,
            cellClass: cn(
              "erp-grid-cell",
              isNumeric && "erp-grid-cell-number",
              column.type === "date" && "erp-grid-cell-date",
            ),
            valueFormatter:
              column.type === "money"
                ? (params: ValueFormatterParams<Record<string, unknown>>) => formatMoney(params.value)
                : column.type === "date"
                  ? (params: ValueFormatterParams<Record<string, unknown>>) => formatDate(params.value)
                  : undefined,
            cellRenderer: isStatus
              ? (params: ICellRendererParams<Record<string, unknown>>) => (
                  <GridValueBadge value={params.value} field={column.field} />
                )
              : undefined,
          };
        }),
      ],
    [columns],
  );

  const filteredRows = useMemo(() => {
    if (isPayrollSearch) {
      return gridRows;
    }
    const text = query.trim().toLowerCase();
    if (!text) {
      return gridRows;
    }
    return gridRows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(text)),
    );
  }, [gridRows, isPayrollSearch, query]);

  const summaryRow = useMemo(
    () => (isPayrollSearch ? createSummaryRow(filteredRows, columns) : null),
    [columns, filteredRows, isPayrollSearch],
  );
  const payrollYearOptions = useMemo(() => {
    const years = new Set<string>();
    [...rows, ...gridRows].forEach((row) => {
      const year = parsePayrollMonthParts(String(row.payrollMonth ?? "").trim())?.year;
      if (year) {
        years.add(year);
      }
    });
    return Array.from(years).sort((left, right) => right.localeCompare(left));
  }, [gridRows, rows]);

  function onSelectionChanged(event: SelectionChangedEvent) {
    setSelected(event.api.getSelectedRows()[0] ?? null);
  }

  function onGridReady(event: GridReadyEvent) {
    if (filteredRows.length) {
      event.api.getDisplayedRowAtIndex(0)?.setSelected(true);
    }
  }

  async function fetchPayrollRows(search: {
    payrollYear?: string;
    payrollMonthNumber?: string;
    employeeName?: string;
    query?: string;
  } = {}) {
    const params = new URLSearchParams();
    const nextPayrollYear = search.payrollYear ?? payrollYear;
    const nextPayrollMonthNumber = search.payrollMonthNumber ?? payrollMonthNumber;
    const nextEmployeeName = search.employeeName ?? employeeName;
    const nextQuery = search.query ?? payrollQuery;

    if (payrollScope === "mine") params.set("mode", "mine");
    if (nextPayrollYear.trim()) params.set("payrollYear", nextPayrollYear.trim());
    if (nextPayrollMonthNumber.trim()) params.set("payrollMonthNumber", nextPayrollMonthNumber.trim());
    if (nextEmployeeName.trim()) params.set("employeeName", nextEmployeeName.trim());
    if (nextQuery.trim()) params.set("query", nextQuery.trim());

    const response = await fetch(`/api/payroll-slips${params.size ? `?${params.toString()}` : ""}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "급여대장 조회에 실패했습니다.");
    }
    return (data.rows ?? []) as Record<string, unknown>[];
  }

  async function fetchGenericRows() {
    if (!uploadType) {
      return gridRows;
    }
    const response = await fetch(`/api/${uploadType}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "데이터 조회에 실패했습니다.");
    }
    return (data.rows ?? []) as Record<string, unknown>[];
  }

  async function reloadRows() {
    const latestRows = isPayrollSearch ? await fetchPayrollRows() : await fetchGenericRows();
    setGridRows(latestRows);
    setSelected(latestRows[0] ?? null);
  }

  function replaceRow(row: Record<string, unknown>) {
    setGridRows((currentRows) => {
      const nextRows = currentRows.map((currentRow) => (currentRow.id === row.id ? row : currentRow));
      return nextRows.some((currentRow) => currentRow.id === row.id) ? nextRows : [row, ...nextRows];
    });
    setSelected(row);
  }

  function removeRow(id: string) {
    setGridRows((currentRows) => {
      const nextRows = currentRows.filter((row) => row.id !== id);
      setSelected((currentSelected) =>
        currentSelected?.id === id ? (nextRows[0] ?? null) : currentSelected,
      );
      setIsDetailDialogOpen(false);
      return nextRows;
    });
  }

  function loadPayrollRows(search: {
    payrollYear?: string;
    payrollMonthNumber?: string;
    employeeName?: string;
    query?: string;
  } = {}) {
    startTransition(async () => {
      try {
        const latestRows = await fetchPayrollRows(search);
        setGridRows(latestRows);
        setSelected(latestRows[0] ?? null);
        setErrors([]);
      } catch (error) {
        setErrors([{ message: error instanceof Error ? error.message : "급여대장 조회에 실패했습니다." }]);
      }
    });
  }

  function searchPayroll(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    loadPayrollRows();
  }

  function changePayrollYear(value: string) {
    const nextPayrollYear = value === ALL_PAYROLL_YEARS ? "" : value;
    setPayrollYear(nextPayrollYear);
    loadPayrollRows({ payrollYear: nextPayrollYear });
  }

  function changePayrollMonthNumber(value: string) {
    const nextPayrollMonthNumber = value === ALL_PAYROLL_MONTH_NUMBERS ? "" : value;
    setPayrollMonthNumber(nextPayrollMonthNumber);
    loadPayrollRows({ payrollMonthNumber: nextPayrollMonthNumber });
  }

  function resetSearch() {
    if (!isPayrollSearch) {
      setQuery("");
      return;
    }

    setPayrollYear("");
    setPayrollMonthNumber("");
    setEmployeeName("");
    setPayrollQuery("");
    loadPayrollRows({ payrollYear: "", payrollMonthNumber: "", employeeName: "", query: "" });
  }

  function openUploadDialog() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPassword("");
    setPreview(null);
    setErrors([]);
    setNotice(null);
    setIsUploadOpen(true);
  }

  function onUploadFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setErrors([]);
    setNotice(null);
  }

  function clearUploadFile() {
    setFile(null);
    setPreview(null);
    setErrors([]);
    setNotice(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function onUploadFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsFileDragging(false);
    onUploadFileChange(event.dataTransfer.files?.[0] ?? null);
  }

  function upload(action: "preview" | "commit") {
    if (!file || !uploadType) {
      setErrors([{ message: "업로드할 엑셀 파일을 선택해주세요." }]);
      return;
    }
    setErrors([]);
    setNotice(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("password", password);
    formData.set("action", action);

    startTransition(async () => {
      const response = await fetch(`/api/imports/${uploadType}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors([{ message: data.error ?? "업로드에 실패했습니다." }]);
        return;
      }
      setPreview(data.previewRows ?? []);
      setErrors(data.errors ?? []);
      if (action === "commit") {
        setNotice(`저장 완료: ${data.previewRows?.length ?? 0}건`);
        if (!data.errors?.length) {
          setIsUploadOpen(false);
        }
        if (uploadType === "payroll-slips") {
          const latestRows = await fetchPayrollRows();
          setGridRows(latestRows);
          setSelected(latestRows[0] ?? null);
        } else if (uploadType) {
          const latestRows = await fetchGenericRows();
          setGridRows(latestRows);
          setSelected(latestRows[0] ?? null);
        }
      }
    });
  }

  return (
    <div
      className={cn(
        "crm-erp-surface mx-auto grid h-[calc(100vh-5.5rem)] max-w-[1840px] gap-3 overflow-hidden",
        isPayrollSlipDetail
          ? "xl:grid-cols-[minmax(0,1fr)_480px] 2xl:grid-cols-[minmax(680px,1fr)_600px]"
          : !isProjectDetail && "xl:grid-cols-[minmax(0,1fr)_360px]",
      )}
    >
      <section className="flex min-h-0 min-w-0 flex-col gap-3">
        <div className="hidden flex-col gap-2 md:flex md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-[#0d1b3d]">{title}</h1>
          </div>
          <Badge variant="outline" className="h-7 w-fit border-[#cfd9e7] bg-white px-2.5 text-xs">
            {filteredRows.length.toLocaleString()}건
          </Badge>
        </div>

        {isPayrollSearch ? (
          <form
            onSubmit={searchPayroll}
            className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]"
          >
            <div className="grid gap-px bg-[#edf1f6] p-px lg:grid-cols-[88px_minmax(220px,260px)_72px_minmax(150px,190px)_88px_minmax(220px,1fr)_auto]">
              <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
                조회년월
              </div>
              <div className="flex items-center gap-2 bg-white px-2 py-1.5">
                <Select value={payrollYear || ALL_PAYROLL_YEARS} onValueChange={changePayrollYear}>
                  <SelectTrigger
                    size="sm"
                    className="h-8 flex-1 border-[#d8e0ea] bg-white text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                    disabled={isPending}
                  >
                    <SelectValue placeholder="연도" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PAYROLL_YEARS}>전체</SelectItem>
                    {payrollYearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={payrollMonthNumber || ALL_PAYROLL_MONTH_NUMBERS} onValueChange={changePayrollMonthNumber}>
                  <SelectTrigger
                    size="sm"
                    className="h-8 flex-1 border-[#d8e0ea] bg-white text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                    disabled={isPending}
                  >
                    <SelectValue placeholder="월" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PAYROLL_MONTH_NUMBERS}>전체</SelectItem>
                    {MONTH_NUMBER_OPTIONS.map((month) => (
                      <SelectItem key={month} value={month}>
                        {Number(month)}월
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
                성명
              </div>
              <div className="bg-white p-2">
                <Input
                  value={employeeName}
                  onChange={(event) => setEmployeeName(event.target.value)}
                  placeholder="성명"
                  className="h-8 border-[#d8e0ea] bg-white text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                />
              </div>
              <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
                조회조건
              </div>
              <div className="bg-white p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
                  <Input
                    value={payrollQuery}
                    onChange={(event) => setPayrollQuery(event.target.value)}
                    placeholder="사원코드, 직책 등"
                    className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 bg-[#f8fafc] p-2 lg:min-w-[260px] lg:flex-row lg:items-center lg:justify-end">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                  조회
                </Button>
                {uploadEnabled ? (
                  <Button type="button" size="sm" onClick={openUploadDialog} disabled={isPending}>
                    <FileUp className="size-3.5" />
                    엑셀 업로드
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetSearch}
                  disabled={isPending || (!payrollYear && !payrollMonthNumber && !employeeName && !payrollQuery)}
                >
                  <RefreshCw className="size-3.5" />
                  초기화
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]">
            <div className="grid gap-px bg-[#edf1f6] p-px lg:grid-cols-[88px_minmax(260px,1fr)_auto]">
              <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
                검색어
              </div>
              <div className="bg-white p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="전체 컬럼 검색"
                    className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 bg-[#f8fafc] p-2 lg:min-w-[176px] lg:flex-row lg:items-center lg:justify-end">
                {createEnabled && isProjectDetail ? (
                  <Button type="button" size="sm" onClick={openNewProjectDialog} disabled={isPending}>
                    <Plus className="size-3.5" />
                    신규 추가
                  </Button>
                ) : null}
                {uploadEnabled ? (
                  <Button type="button" size="sm" onClick={openUploadDialog} disabled={isPending}>
                    <FileUp className="size-3.5" />
                    엑셀 업로드
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={resetSearch} disabled={!query}>
                  <RefreshCw className="size-3.5" />
                  초기화
                </Button>
              </div>
            </div>
          </div>
        )}

        {notice ? (
          <Alert className="border-[#bfd2f5] bg-[#eef4ff] text-[#1f4f9f]">
            <AlertCircle className="size-4" />
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
              pinnedBottomRowData={summaryRow ? [summaryRow] : undefined}
              rowSelection="single"
              animateRows={false}
              theme="legacy"
              onGridReady={onGridReady}
              onSelectionChanged={onSelectionChanged}
              onCellDoubleClicked={(event) => {
                if (isProjectDetail && event.data && !event.node.rowPinned) {
                  openProjectDetailDialog(event.data);
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
        </div>
      </section>

      {!isProjectDetail ? (
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_8px_26px_rgba(15,28,48,0.05)]">
          <div className="shrink-0 border-b border-[#d8e0ea] bg-[#f8fafc] px-4 py-3">
            <p className="text-sm font-semibold text-[#0d1b3d]">상세 정보</p>
          </div>
          {selected ? (
            <div
              className={cn(
                "min-h-0 flex-1 bg-[#edf1f6] p-px text-sm text-[#33415c]",
                isPayrollSlipDetail ? "overflow-hidden" : "grid gap-px overflow-auto",
              )}
            >
              {detail ? (
                detail(selected, { replaceRow, removeRow, reloadRows })
              ) : detailType === "payroll-slip" ? (
                <PayrollSlipDetail
                  row={selected}
                  canDelete={deleteEnabled && payrollScope !== "mine"}
                  helpers={{ replaceRow, removeRow, reloadRows }}
                />
              ) : (
                <DefaultDetail row={selected} />
              )}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-[#7b8798]">행을 선택하면 상세 정보가 표시됩니다.</p>
          )}
        </aside>
      ) : null}

      {isProjectDetail ? (
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="flex max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[1500px] flex-col overflow-hidden p-0 sm:max-h-[88vh] sm:max-w-[1500px]">
            <DialogHeader className="shrink-0 border-b border-[#d8e0ea] bg-[#f8fafc] px-4 py-3">
              <DialogTitle className="text-sm text-[#0d1b3d]">
                {selected?.__isNew ? "신규 프로젝트" : "프로젝트 상세"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                프로젝트 기본 정보와 상세 항목을 확인하고 수정합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {selected ? (
                <ProjectDetail
                  key={String(selected.id)}
                  row={selected}
                  helpers={{ replaceRow, removeRow, reloadRows }}
                  onClose={() => setIsDetailDialogOpen(false)}
                />
              ) : (
                <p className="px-4 py-6 text-sm text-[#7b8798]">행을 선택하면 상세 정보가 표시됩니다.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {uploadEnabled ? (
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{title} 엑셀 업로드</DialogTitle>
              <DialogDescription>.xlsx 파일을 선택한 뒤 저장하세요.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="erp-upload-file">엑셀 파일</Label>
                  <span className="text-[11px] font-medium text-[#7b8798]">.xlsx 권장</span>
                </div>
                <Input
                  ref={fileInputRef}
                  id="erp-upload-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                <div
                  onDragEnter={() => setIsFileDragging(true)}
                  onDragLeave={() => setIsFileDragging(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onUploadFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex min-h-32 cursor-pointer flex-col justify-between gap-4 rounded-lg border border-dashed bg-[#f8fafc] p-4 transition-colors",
                    file
                      ? "border-[#86a9e8] bg-[#f3f7ff]"
                      : "border-[#c4d0df] hover:border-[#2f70dc] hover:bg-[#f5f8fd]",
                    isFileDragging && "border-[#2f70dc] bg-[#eef4ff]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-lg border",
                        file ? "border-[#b8cdf5] bg-white text-[#2f70dc]" : "border-[#d8e0ea] bg-white text-[#7c8aa0]",
                      )}
                    >
                      {file ? <FileSpreadsheet className="size-5" /> : <UploadCloud className="size-5" />}
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="block text-sm font-semibold text-[#0d1b3d]">
                        {file ? file.name : "파일을 선택하거나 여기로 끌어오세요"}
                      </span>
                      <span className="block text-xs text-[#69758a]">
                        {file
                          ? `${formatFileSize(file.size)} / 선택 완료`
                          : "엑셀에서 암호를 해제한 .xlsx 파일을 사용하면 가장 안정적입니다."}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="bg-white">
                      <FileUp className="size-3.5" />
                      {file ? "다른 파일 선택" : "파일 선택"}
                    </Button>
                    {file ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-[#69758a] hover:text-[#0d1b3d]"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          clearUploadFile();
                        }}
                      >
                        <X className="size-3.5" />
                        선택 해제
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="erp-upload-password">엑셀 비밀번호</Label>
                <Input
                  id="erp-upload-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호가 없으면 비워두세요"
                  type="password"
                  className="h-9 border-[#d8e0ea] bg-white text-sm"
                />
              </div>

              {errors.length ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>확인 필요</AlertTitle>
                  <AlertDescription>{errors.map((error) => error.message).join(" / ")}</AlertDescription>
                </Alert>
              ) : null}

              {preview ? (
                <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
                  <div className="border-b border-[#edf1f6] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#0d1b3d]">
                    업로드 미리보기
                  </div>
                  <div className="max-h-48 overflow-auto px-3 text-xs text-[#46546a]">
                    {preview.slice(0, 8).map((row, index) => (
                      <pre key={index} className="border-b border-[#edf2f7] py-1">
                        {JSON.stringify(row, null, 2)}
                      </pre>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => upload("preview")} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
                미리보기
              </Button>
              <Button type="button" onClick={() => upload("commit")} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function DefaultDetail({ row }: { row: Record<string, unknown> }) {
  return Object.entries(row)
    .filter(([, value]) => value != null && typeof value !== "object")
    .slice(0, 16)
    .map(([key, value]) => (
      <div key={key} className="grid min-h-10 grid-cols-[104px_minmax(0,1fr)] bg-white text-left text-xs">
        <span className="flex items-center bg-[#f8fafc] px-3 py-2 font-semibold text-[#69758a]">{key}</span>
        <span className="min-w-0 break-words px-3 py-2 text-[#26344d]">{String(value)}</span>
      </div>
    ));
}

function PayrollSlipDetail({
  row,
  canDelete = false,
  helpers,
}: {
  row: Record<string, unknown>;
  canDelete?: boolean;
  helpers?: ErpGridDetailHelpers;
}) {
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();
  const employeeName = String(row.employeeName ?? "-");
  const payrollMonth = String(row.payrollMonth ?? "-");

  async function savePdf() {
    if (isSavingPdf) {
      return;
    }
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) {
      setDeleteError("PDF 저장할 급여명세서 ID를 확인하지 못했습니다.");
      return;
    }

    setIsSavingPdf(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/payroll-slips/${encodeURIComponent(id)}/pdf`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setDeleteError(data?.error ?? "PDF 파일을 생성하지 못했습니다.");
        return;
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = getDownloadFileName(response.headers.get("content-disposition"))
        ?? sanitizeFileName(`${payrollMonth}_${employeeName}_급여명세서.pdf`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } finally {
      setIsSavingPdf(false);
    }
  }

  function deleteSlip() {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id || !helpers) {
      setDeleteError("삭제할 급여명세서 ID를 확인하지 못했습니다.");
      return;
    }
    if (!window.confirm(`${employeeName}님의 ${payrollMonth} 급여명세서를 삭제할까요? 지급/공제 항목도 함께 삭제됩니다.`)) {
      return;
    }

    setDeleteError(null);
    startDeleteTransition(async () => {
      const response = await fetch(`/api/payroll-slips?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setDeleteError(data.error ?? "급여명세서를 삭제하지 못했습니다.");
        return;
      }
      helpers.removeRow(id);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f8fb] p-3 text-xs">
      <div className="mb-2.5 flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#111827]">{employeeName}</p>
          <p className="truncate text-[11px] font-medium text-[#69758a]">{payrollMonth} 급여명세서</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={deleteSlip}
              disabled={isDeletePending}
            >
              {isDeletePending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              삭제
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-[#cfd9e7] bg-white"
            onClick={savePdf}
            disabled={isSavingPdf}
          >
            {isSavingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
            PDF 저장
          </Button>
        </div>
      </div>

      {deleteError ? (
        <Alert variant="destructive" className="mb-2.5 shrink-0">
          <AlertTitle className="text-xs">확인 필요</AlertTitle>
          <AlertDescription className="text-xs">{deleteError}</AlertDescription>
        </Alert>
      ) : null}

      <PayrollSlipView row={row} />
    </div>
  );
}

function GridValueBadge({ value, field }: { value: unknown; field: string }) {
  const text = String(value ?? "").trim();
  if (!text) return <span className="text-[#9aa6b6]">-</span>;

  return (
    <span className={cn("erp-value-badge", getBadgeTone(field, text))}>
      {text}
    </span>
  );
}

function getBadgeTone(field: string, value: string) {
  const normalized = value.toLowerCase();

  if (field === "direction") {
    if (value.includes("매출") || normalized.includes("in")) return "is-blue";
    if (value.includes("매입") || normalized.includes("out")) return "is-amber";
  }

  if (field === "importType") return "is-slate";
  if (/(완료|성공|진행|active|paid|done|success|completed)/i.test(value)) return "is-green";
  if (/(오류|실패|취소|중단|error|fail|cancel)/i.test(value)) return "is-red";
  if (/(대기|예정|검토|pending|draft|hold)/i.test(value)) return "is-amber";

  return "is-blue";
}

function createSummaryRow(rows: Record<string, unknown>[], columns: ErpGridColumn[]) {
  const summary: Record<string, unknown> = { id: "__summary", __summary: true };
  const labelField =
    columns.find((column) => column.field === "employeeName")?.field ??
    columns.find((column) => column.type !== "money" && !isNumericField(column.field))?.field;

  columns.forEach((column) => {
    summary[column.field] = column.type === "money"
      ? rows.reduce((total, row) => {
          const value = Number(row[column.field] ?? 0);
          return Number.isFinite(value) ? total + value : total;
        }, 0)
      : "";
  });

  if (labelField) {
    summary[labelField] = "합계";
  }

  return summary;
}

function parsePayrollMonthParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  return match ? { year: match[1], month: match[2] } : null;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size}B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)}KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
}

function todayDateInputValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function getDownloadFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  return quotedMatch?.[1] ?? null;
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

function isNumericField(field: string) {
  const normalized = field.toLowerCase();
  if (normalized.includes("month")) {
    return false;
  }
  return NUMERIC_FIELD_HINTS.some((hint) => normalized.includes(hint));
}
