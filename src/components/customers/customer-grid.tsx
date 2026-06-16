"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AgGridReact, type CustomCellEditorProps } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColumnResizedEvent,
  type ColumnState,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type SelectionChangedEvent,
  type SortChangedEvent,
  type ValueFormatterParams,
  type ValueGetterParams,
} from "ag-grid-community";
import {
  AlertCircle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  Eye,
  FilePlus2,
  FileUp,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { CustomerOptionManager } from "@/components/customers/customer-option-manager";
import {
  SALES_POTENTIAL_OPTIONS,
  SALES_TEMPERATURE_LABEL,
  getSalesPotentialMeta,
  normalizeSalesPotential,
} from "@/lib/sales-potential";
import type {
  CustomerActivityRow,
  CustomerContactMethod,
  CustomerDashboardFilter,
  CustomerFacets,
  CustomerOptionRow,
  CustomerPageInfo,
  CustomerRow,
} from "@/lib/types";
import { CUSTOMER_EMPTY_FACET } from "@/lib/types";
import { cn } from "@/lib/utils";

ModuleRegistry.registerModules([AllCommunityModule]);

const ALL = "__all__";
const EMPTY = "__empty__";
const PAGE_SIZE_OPTIONS = [
  { value: "100", label: "100개" },
  { value: "500", label: "500개" },
  { value: "1000", label: "1000개" },
  { value: "2000", label: "2000개" },
  { value: "all", label: "전체" },
] as const;
const SELECT_EMPTY_LABEL = "-";
const COLUMN_WIDTH_STORAGE_VERSION = 4;
const PAGE_SIZE_STORAGE_VERSION = 1;
const RESIZABLE_COLUMN_IDS = [
  "rowNumber",
  "salesPotential",
  "source",
  "phone",
  "gender",
  "ageDecade",
  "status",
  "callNote",
  "lastContacted",
  "orderNote",
  "remark",
] as const;
const resizableColumnIdSet = new Set<string>(RESIZABLE_COLUMN_IDS);

type ImportNotice = {
  type: "success" | "error";
  message: string;
};

type DraftContactActivity = {
  clientId: string;
  method: CustomerContactMethod;
  occurredAt: string;
  note: string;
};

type DetailCustomerDraft = {
  source: string;
  salesPotential: string | null;
  phone: string;
  gender: string | null;
  ageDecade: string | null;
  status: string | null;
  callNote: string | null;
  lastContactedAt: string;
  orderNote: string | null;
  remark: string | null;
};

type PageSize = 100 | 500 | 1000 | 2000 | "all";
type SortDirection = "asc" | "desc";
type SortKey =
  | "source"
  | "salesPotential"
  | "phone"
  | "gender"
  | "ageDecade"
  | "status"
  | "lastContacted"
  | "callNote"
  | "orderNote"
  | "remark";

type SortState = {
  key: SortKey | null;
  direction: SortDirection;
};

type CustomerGridInitialFilters = {
  query: string;
  source: string;
  salesPotential: string;
  status: string;
  gender: string;
  ageDecade: string;
  dashboardFilter: CustomerDashboardFilter | null;
};

type CustomerImportResponse = {
  fileName: string;
  imported: number;
  inserted?: number;
  updated?: number;
  mergedDuplicates?: number;
  parsedRows: number;
  sourceRows: number;
  rows: CustomerRow[];
  pageInfo: CustomerPageInfo;
  facets: CustomerFacets;
};

type EditableField =
  | "source"
  | "salesPotential"
  | "phone"
  | "gender"
  | "ageDecade"
  | "status"
  | "callNote"
  | "lastContactedAt"
  | "orderNote"
  | "remark";

const editableFields = new Set<string>([
  "source",
  "salesPotential",
  "phone",
  "gender",
  "ageDecade",
  "status",
  "callNote",
  "lastContactedAt",
  "orderNote",
  "remark",
]);

const DEFAULT_INITIAL_FILTERS: CustomerGridInitialFilters = {
  query: "",
  source: ALL,
  salesPotential: ALL,
  status: ALL,
  gender: ALL,
  ageDecade: ALL,
  dashboardFilter: null,
};

type SalesPotentialQuickEditorProps = CustomCellEditorProps<CustomerRow, string | null> & {
  values?: string[];
};

function SalesPotentialQuickEditor({
  value,
  onValueChange,
  values = [],
  stopEditing,
}: SalesPotentialQuickEditorProps) {
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const options = useMemo(
    () => uniqueSalesPotentialOptions([...SALES_POTENTIAL_OPTIONS, ...values]),
    [values],
  );

  useEffect(() => {
    window.requestAnimationFrame(() => {
      firstButtonRef.current?.focus();
    });
  }, []);

  function selectValue(nextValue: string) {
    onValueChange(nextValue === EMPTY ? null : nextValue);
    stopEditing();
  }

  return (
    <div className="crm-sales-potential-editor" role="radiogroup" aria-label={SALES_TEMPERATURE_LABEL}>
      <button
        ref={firstButtonRef}
        type="button"
        role="radio"
        aria-checked={!value}
        className={cn("crm-sales-potential-editor-button", !value && "is-selected")}
        onClick={() => selectValue(EMPTY)}
      >
        없음
      </button>
      {options.map((item) => {
        const meta = getSalesPotentialMeta(item);
        const selected = normalizeSalesPotential(value) === meta.value;

        return (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn("crm-sales-potential-editor-button", selected && "is-selected")}
            style={
              selected
                ? {
                    backgroundColor: meta.background,
                    borderColor: meta.border,
                    color: meta.foreground,
                  }
                : undefined
            }
            onClick={() => selectValue(meta.value)}
          >
            {meta.value}
          </button>
        );
      })}
    </div>
  );
}

export function CustomerGrid({
  userId,
  initialRows,
  initialPageInfo,
  facets: initialFacets,
  initialCustomerOptions,
  initialDetailCustomerId,
  initialFilters = DEFAULT_INITIAL_FILTERS,
}: {
  userId: string;
  initialRows: CustomerRow[];
  initialPageInfo: CustomerPageInfo;
  facets: CustomerFacets;
  initialCustomerOptions: CustomerOptionRow[];
  initialDetailCustomerId?: string | null;
  initialFilters?: CustomerGridInitialFilters;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMountRef = useRef(false);
  const gridApiRef = useRef<GridApi<CustomerRow> | null>(null);
  const rowsRef = useRef<CustomerRow[]>(initialRows);
  const sortStateRef = useRef<SortState>({ key: null, direction: "asc" });
  const didOpenInitialDetailRef = useRef(false);
  const [rows, setRows] = useState(initialRows);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [facets, setFacets] = useState(initialFacets);
  const [customerOptions, setCustomerOptions] = useState(initialCustomerOptions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState(initialFilters.query);
  const [source, setSource] = useState(initialFilters.source);
  const [salesPotential, setSalesPotential] = useState(initialFilters.salesPotential);
  const [status, setStatus] = useState(initialFilters.status);
  const [gender, setGender] = useState(initialFilters.gender);
  const [ageDecade, setAgeDecade] = useState(initialFilters.ageDecade);
  const [dashboardFilter, setDashboardFilter] = useState<CustomerDashboardFilter | null>(
    initialFilters.dashboardFilter,
  );
  const [appliedFilters, setAppliedFilters] = useState({
    query: initialFilters.query,
    source: initialFilters.source,
    salesPotential: initialFilters.salesPotential,
    status: initialFilters.status,
    gender: initialFilters.gender,
    ageDecade: initialFilters.ageDecade,
    dashboardFilter: initialFilters.dashboardFilter,
  });
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [, setSavingIds] = useState<Set<string>>(() => new Set());
  const [sortState, setSortState] = useState<SortState>({ key: null, direction: "asc" });
  const [pageSize, setPageSize] = useState<PageSize>(normalizeClientPageSize(initialPageInfo.pageSize));
  const [currentPage, setCurrentPage] = useState(1);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [detailCustomer, setDetailCustomer] = useState<CustomerRow | null>(null);
  const [detailDraft, setDetailDraft] = useState<DetailCustomerDraft | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCreatingDetailCustomer, setIsCreatingDetailCustomer] = useState(false);
  const [contactActivities, setContactActivities] = useState<DraftContactActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [isSavingActivities, setIsSavingActivities] = useState(false);
  const [detailNotice, setDetailNotice] = useState<ImportNotice | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCount = selectedIds.size;
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds],
  );
  const smsRecipients = useMemo(
    () => selectedRows.filter((row) => row.phone.trim().length > 0),
    [selectedRows],
  );
  const smsPreviewPhones = useMemo(
    () => smsRecipients.slice(0, 5).map((row) => row.phone),
    [smsRecipients],
  );
  const trimmedSmsMessage = smsMessage.trim();
  const effectivePageSize = pageSize === "all" ? Math.max(rows.length, 1) : pageSize;
  const pageStartIndex = pageSize === "all" ? 0 : (currentPage - 1) * effectivePageSize;
  const displayStart = rows.length === 0 ? 0 : pageStartIndex + 1;
  const displayEnd = pageStartIndex + rows.length;
  const columnWidthStorageKey = useMemo(() => getColumnWidthStorageKey(userId), [userId]);
  const pageSizeStorageKey = useMemo(() => getPageSizeStorageKey(userId), [userId]);
  const detailCustomerIndex = useMemo(
    () => rows.findIndex((row) => row.id === detailCustomer?.id),
    [detailCustomer?.id, rows],
  );
  const canOpenPreviousDetail = detailCustomerIndex > 0;
  const canOpenNextDetail = detailCustomerIndex >= 0 && detailCustomerIndex < rows.length - 1;
  const isSavingDetailDialog = isSavingDetail || isSavingActivities;

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    sortStateRef.current = sortState;
  }, [sortState]);

  useEffect(() => {
    const storedPageSize = readStoredPageSize(pageSizeStorageKey);
    if (!storedPageSize) return;

    const frame = window.requestAnimationFrame(() => {
      setPageSize(storedPageSize);
      setCurrentPage(1);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pageSizeStorageKey]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(pageSize),
      query: appliedFilters.query,
      source: appliedFilters.source,
      salesPotential: appliedFilters.salesPotential,
      status: appliedFilters.status,
      gender: appliedFilters.gender,
      ageDecade: appliedFilters.ageDecade,
      sortDirection: sortState.direction,
    });

    if (appliedFilters.dashboardFilter) {
      params.set("dashboardFilter", appliedFilters.dashboardFilter);
    }

    if (sortState.key) {
      params.set("sortKey", sortState.key);
    }

    setIsSearching(true);
    fetch(`/api/customers?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "조회 실패");
        }

        rowsRef.current = payload.rows;
        setRows(payload.rows);
        setPageInfo(payload.pageInfo);
        setSelectedIds(new Set());
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setImportNotice({
          type: "error",
          message: error instanceof Error ? error.message : "고객 조회에 실패했습니다.",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => controller.abort();
  }, [appliedFilters, currentPage, pageSize, sortState]);

  const selectValues = useMemo(
    () => ({
      sourceOptions: uniqueStrings(facets.sources),
      salesPotentialOptions: uniqueSalesPotentialOptions([
        ...facets.salesPotentialOptions,
        ...SALES_POTENTIAL_OPTIONS,
      ]),
      statusOptions: uniqueStrings(facets.statuses),
      genders: uniqueStrings(facets.genders),
      ageDecades: uniqueStrings(facets.ageDecades),
    }),
    [
      facets.sources,
      facets.salesPotentialOptions,
      facets.statuses,
      facets.genders,
      facets.ageDecades,
    ],
  );

  const loadContactActivities = useCallback(async (customerId: string) => {
    setIsLoadingActivities(true);
    setContactActivities([]);

    try {
      const response = await fetch(`/api/customers/${customerId}/activities`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "연락 이력 조회에 실패했습니다.");
      }

      setContactActivities(
        (payload.activities as CustomerActivityRow[]).map((activity) => ({
          clientId: activity.id,
          method: activity.method,
          occurredAt: toDateInputValue(activity.occurredAt),
          note: activity.note ?? "",
        })),
      );
    } catch (error) {
      setDetailNotice({
        type: "error",
        message: error instanceof Error ? error.message : "연락 이력 조회에 실패했습니다.",
      });
    } finally {
      setIsLoadingActivities(false);
    }
  }, []);

  const openDetailDialog = useCallback((customer: CustomerRow) => {
    setIsCreatingDetailCustomer(false);
    setDetailCustomer(customer);
    setDetailDraft(createDetailCustomerDraft(customer));
    setIsDetailDialogOpen(true);
    setDetailNotice(null);
    loadContactActivities(customer.id);
  }, [loadContactActivities]);

  const openCreateDetailDialog = useCallback(() => {
    const draftCustomer = createNewCustomerPlaceholder({
      assignedUserId: userId,
      source: facets.sources[0] ?? "",
      status: facets.statuses[0] ?? null,
    });

    setIsCreatingDetailCustomer(true);
    setDetailCustomer(draftCustomer);
    setDetailDraft(createDetailCustomerDraft(draftCustomer));
    setContactActivities([]);
    setIsLoadingActivities(false);
    setDetailNotice(null);
    setIsDetailDialogOpen(true);
  }, [facets.sources, facets.statuses, userId]);

  function setDetailDialogOpen(open: boolean) {
    setIsDetailDialogOpen(open);

    if (!open) {
      setIsCreatingDetailCustomer(false);
    }
  }

  useEffect(() => {
    if (!initialDetailCustomerId || didOpenInitialDetailRef.current) return;

    didOpenInitialDetailRef.current = true;
    const visibleCustomer = rowsRef.current.find((row) => row.id === initialDetailCustomerId);

    if (visibleCustomer) {
      openDetailDialog(visibleCustomer);
      return;
    }

    let ignore = false;

    async function loadInitialDetailCustomer() {
      try {
        const response = await fetch(`/api/customers/${initialDetailCustomerId}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "고객 상세 정보를 불러오지 못했습니다.");
        }

        if (!ignore) {
          openDetailDialog(payload.customer as CustomerRow);
        }
      } catch (error) {
        if (ignore) return;
        setImportNotice({
          type: "error",
          message: error instanceof Error ? error.message : "고객 상세 정보를 불러오지 못했습니다.",
        });
      }
    }

    loadInitialDetailCustomer();

    return () => {
      ignore = true;
    };
  }, [initialDetailCustomerId, openDetailDialog]);

  const moveDetailDialog = useCallback((direction: -1 | 1) => {
    if (detailCustomerIndex < 0) return;

    const nextCustomer = rows[detailCustomerIndex + direction];
    if (!nextCustomer) return;

    setDetailCustomer(nextCustomer);
    setDetailDraft(createDetailCustomerDraft(nextCustomer));
    setDetailNotice(null);
    loadContactActivities(nextCustomer.id);
  }, [detailCustomerIndex, loadContactActivities, rows]);

  const columnDefs = useMemo<ColDef<CustomerRow>[]>(
    () => [
      {
        colId: "rowNumber",
        headerName: "No",
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        pinned: "left",
        sortable: false,
        editable: false,
        valueGetter: (params: ValueGetterParams<CustomerRow>) =>
          pageStartIndex + (params.node?.rowIndex ?? 0) + 1,
        cellClass: "font-mono text-muted-foreground",
      },
      {
        colId: "detail",
        headerName: "상세",
        width: 76,
        sortable: false,
        editable: false,
        resizable: false,
        cellClass: "crm-detail-cell",
        cellRenderer: (params: ICellRendererParams<CustomerRow>) => (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="h-5 px-1.5 text-[11px] leading-none"
            aria-label={`${params.data?.phone ?? "고객"} 상세 보기`}
            onClick={(event) => {
              event.stopPropagation();
              if (params.data) {
                openDetailDialog(params.data);
              }
            }}
          >
            <Eye className="size-3" />
            상세
          </Button>
        ),
      },
      {
        field: "salesPotential",
        headerName: SALES_TEMPERATURE_LABEL,
        width: 118,
        editable: true,
        cellEditor: SalesPotentialQuickEditor,
        cellEditorPopup: true,
        cellEditorParams: { values: selectValues.salesPotentialOptions },
        valueFormatter: salesPotentialFormatter,
        cellRenderer: SalesPotentialCell,
      },
      {
        field: "source",
        headerName: "DB출처",
        width: 120,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [EMPTY, ...selectValues.sourceOptions] },
        valueFormatter: emptyFormatter,
      },
      {
        field: "phone",
        headerName: "전화번호",
        width: 132,
        editable: true,
        cellClass: "font-mono",
      },
      {
        field: "gender",
        headerName: "성별",
        width: 74,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [EMPTY, ...selectValues.genders] },
        valueFormatter: emptyFormatter,
      },
      {
        field: "ageDecade",
        headerName: "나이대",
        width: 77,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [EMPTY, ...selectValues.ageDecades] },
        valueFormatter: emptyFormatter,
      },
      {
        field: "status",
        headerName: "상황",
        width: 104,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: [EMPTY, ...selectValues.statusOptions] },
        valueFormatter: emptyFormatter,
      },
      {
        field: "callNote",
        headerName: "고객 메모",
        width: 430,
        editable: true,
        cellEditor: "agLargeTextCellEditor",
        cellEditorPopup: true,
        cellEditorParams: { maxLength: 4000, rows: 7, cols: 56 },
        valueFormatter: emptyFormatter,
        cellClass: "crm-multiline-cell crm-double-click-edit-cell",
        wrapText: true,
        autoHeight: true,
      },
      {
        field: "lastContactedAt",
        colId: "lastContacted",
        headerName: "마지막 통화",
        width: 150,
        editable: true,
        cellEditor: DateCellEditor,
        valueFormatter: lastContactedFormatter,
      },
      {
        field: "orderNote",
        headerName: "오더 특이사항",
        width: 240,
        editable: true,
        cellEditor: "agLargeTextCellEditor",
        cellEditorPopup: true,
        cellEditorParams: { maxLength: 3000, rows: 5, cols: 44 },
        valueFormatter: emptyFormatter,
      },
      {
        field: "remark",
        headerName: "비고",
        width: 190,
        editable: true,
        valueFormatter: emptyFormatter,
      },
    ],
    [openDetailDialog, pageStartIndex, selectValues],
  );

  const defaultColDef = useMemo<ColDef<CustomerRow>>(
    () => ({
      resizable: true,
      sortable: true,
      suppressHeaderMenuButton: true,
      singleClickEdit: false,
      cellClass: "leading-5",
    }),
    [],
  );

  const getRowId = useCallback((params: GetRowIdParams<CustomerRow>) => params.data.id, []);

  const onGridReady = useCallback((event: GridReadyEvent<CustomerRow>) => {
    gridApiRef.current = event.api;
    restoreColumnWidths(event.api, columnWidthStorageKey);
  }, [columnWidthStorageKey]);

  const onColumnResized = useCallback(
    (event: ColumnResizedEvent<CustomerRow>) => {
      if (!event.finished) return;
      saveColumnWidths(event.api, columnWidthStorageKey);
    },
    [columnWidthStorageKey],
  );

  const onSelectionChanged = useCallback((event: SelectionChangedEvent<CustomerRow>) => {
    setSelectedIds(new Set(event.api.getSelectedRows().map((row) => row.id)));
  }, []);

  const onSortChanged = useCallback((event: SortChangedEvent<CustomerRow>) => {
    const sortedColumn = event.api.getColumnState().find((column) => column.sort);
    const nextSort: SortState = isSortKey(sortedColumn?.colId)
      ? {
          key: sortedColumn.colId,
          direction: sortedColumn?.sort === "desc" ? "desc" : "asc",
        }
      : { key: null, direction: "asc" };
    const current = sortStateRef.current;

    if (current.key === nextSort.key && current.direction === nextSort.direction) {
      return;
    }

    setSortState(nextSort);
    setCurrentPage(1);
  }, []);

  function onCellValueChanged(event: CellValueChangedEvent<CustomerRow>) {
    const field = event.colDef.field;
    if (!event.data || !field || !editableFields.has(field)) return;

    const editableField = field as EditableField;
    const previousValue = normalizeEditedValue(editableField, event.oldValue);
    const nextValue = normalizeEditedValue(editableField, event.newValue);

    if ((previousValue ?? null) === (nextValue ?? null)) {
      updateGridRow({ ...event.data, [editableField]: previousValue } as CustomerRow);
      return;
    }

    const previousRow = { ...event.data, [editableField]: previousValue } as CustomerRow;
    const nextRow = {
      ...event.data,
      [editableField]: nextValue,
      ...(editableField === "lastContactedAt" ? { lastContactedLabel: null } : {}),
      updatedAt: new Date().toISOString(),
    } as CustomerRow;

    updateGridRow(nextRow);
    if (editableField === "callNote" || editableField === "lastContactedAt") {
      resetGridRowHeights();
    }
    saveCustomerField(previousRow, editableField, nextValue, nextRow);
  }

  function resetFilters() {
    const emptyFilters = {
      query: "",
      source: ALL,
      salesPotential: ALL,
      status: ALL,
      gender: ALL,
      ageDecade: ALL,
      dashboardFilter: null,
    };

    setQuery("");
    setSource(ALL);
    setSalesPotential(ALL);
    setStatus(ALL);
    setGender(ALL);
    setAgeDecade(ALL);
    setDashboardFilter(null);
    setAppliedFilters(emptyFilters);
    setCurrentPage(1);
  }

  function searchCustomers() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    setIsSearching(true);
    searchTimer.current = setTimeout(() => {
      setAppliedFilters({ query, source, salesPotential, status, gender, ageDecade, dashboardFilter });
      setIsSearching(false);
      setCurrentPage(1);
      searchTimer.current = null;
    }, 180);
  }

  function clearDashboardFilter() {
    setDashboardFilter(null);
    setAppliedFilters({ query, source, salesPotential, status, gender, ageDecade, dashboardFilter: null });
    setCurrentPage(1);
  }

  function replaceRows(nextRows: CustomerRow[]) {
    rowsRef.current = nextRows;
    setRows(nextRows);
  }

  function updateGridRow(row: CustomerRow) {
    rowsRef.current = rowsRef.current.map((current) => (current.id === row.id ? row : current));
    const api = gridApiRef.current;

    if (api && !api.isDestroyed()) {
      api.applyTransaction({ update: [row] });
      return;
    }

    setRows(rowsRef.current);
  }

  function resetGridRowHeights() {
    window.requestAnimationFrame(() => {
      const api = gridApiRef.current;
      if (api && !api.isDestroyed()) {
        api.resetRowHeights();
      }
    });
  }

  function addContactActivity() {
    setContactActivities((current) => [
      {
        clientId: createClientId(),
        method: "call",
        occurredAt: toDateInputValue(new Date().toISOString()),
        note: "",
      },
      ...current,
    ]);
  }

  function updateDetailDraft<K extends keyof DetailCustomerDraft>(field: K, value: DetailCustomerDraft[K]) {
    setDetailDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateContactActivity<K extends keyof Omit<DraftContactActivity, "clientId">>(
    clientId: string,
    field: K,
    value: DraftContactActivity[K],
  ) {
    setContactActivities((current) =>
      current.map((activity) =>
        activity.clientId === clientId ? { ...activity, [field]: value } : activity,
      ),
    );
  }

  function removeContactActivity(clientId: string) {
    setContactActivities((current) => current.filter((activity) => activity.clientId !== clientId));
  }

  async function saveDetailChanges() {
    if (!detailCustomer || !detailDraft) return;

    setDetailNotice(null);
    setIsSavingDetail(true);

    const isCreating = isCreatingDetailCustomer;
    let savedCustomer = detailCustomer;

    try {
      const detailPayload: Partial<{
        source: string;
        salesPotential: string | null;
        phone: string;
        gender: string | null;
        ageDecade: string | null;
        status: string | null;
        callNote: string | null;
        lastContactedAt: string | null;
        lastContactedLabel: string | null;
        orderNote: string | null;
        remark: string | null;
      }> = {
        source: detailDraft.source.trim(),
        salesPotential: normalizeSalesPotential(detailDraft.salesPotential),
        phone: detailDraft.phone.trim(),
        gender: normalizeNullableText(detailDraft.gender),
        ageDecade: normalizeNullableText(detailDraft.ageDecade),
        status: normalizeNullableText(detailDraft.status),
        callNote: normalizeMemoText(detailDraft.callNote),
        orderNote: normalizeMemoText(detailDraft.orderNote),
        remark: normalizeMemoText(detailDraft.remark),
      };
      const originalLastContactedValue = createDetailCustomerDraft(detailCustomer).lastContactedAt;

      if (detailDraft.lastContactedAt.trim() !== originalLastContactedValue) {
        Object.assign(detailPayload, normalizeDetailLastContactedValue(detailDraft.lastContactedAt));
      }

      const response = await fetch(isCreating ? "/api/customers" : `/api/customers/${detailCustomer.id}`, {
        method: isCreating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detailPayload),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? (isCreating ? "고객 추가에 실패했습니다." : "고객 정보 저장에 실패했습니다."));
      }

      const payloadCustomer = payload.customer as CustomerRow;
      savedCustomer = {
        ...detailCustomer,
        ...payloadCustomer,
        assignedUserName: payloadCustomer.assignedUserName ?? detailCustomer.assignedUserName,
        updatedAt: payloadCustomer.updatedAt ?? new Date().toISOString(),
      };

      if (savedCustomer.source) {
        rememberSourceOption(savedCustomer.source);
      }

      setDetailCustomer(savedCustomer);
      setDetailDraft(createDetailCustomerDraft(savedCustomer));
      setIsCreatingDetailCustomer(false);

      if (isCreating) {
        replaceRows([savedCustomer, ...rowsRef.current].slice(0, effectivePageSize));
        setPageInfo((current) => ({
          ...current,
          returned: Math.min(effectivePageSize, current.returned + 1),
          hasNextPage: current.hasNextPage || current.returned >= effectivePageSize,
        }));
        setSelectedIds(new Set([savedCustomer.id]));
        window.requestAnimationFrame(() => {
          const api = gridApiRef.current;
          if (api && !api.isDestroyed()) {
            api.getRowNode(savedCustomer.id)?.setSelected(true, true);
          }
        });
      } else {
        updateGridRow(savedCustomer);
      }
      resetGridRowHeights();
    } catch (error) {
      setDetailNotice({
        type: "error",
        message: error instanceof Error
          ? error.message
          : isCreating
            ? "고객 추가에 실패했습니다."
            : "고객 정보 저장에 실패했습니다.",
      });
      setIsSavingDetail(false);
      return;
    }

    setIsSavingDetail(false);
    if (isCreating && contactActivities.length === 0) {
      setDetailNotice({ type: "success", message: "고객을 추가했습니다." });
      return;
    }

    await saveContactActivities(savedCustomer, isCreating ? "고객을 추가했습니다." : "상세 정보를 저장했습니다.");
  }

  async function saveContactActivities(
    customer = detailCustomer,
    successMessage = "연락 이력을 저장했습니다.",
  ) {
    if (!customer) return false;

    const invalidRow = contactActivities.find((activity) => !activity.occurredAt);
    if (invalidRow) {
      setDetailNotice({ type: "error", message: "연락일자를 입력하지 않은 행이 있습니다." });
      return false;
    }

    setIsSavingActivities(true);
    setDetailNotice(null);

    try {
      const response = await fetch(`/api/customers/${customer.id}/activities`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: contactActivities.map((activity) => ({
            method: activity.method,
            occurredAt: toIsoDate(activity.occurredAt),
            note: activity.note,
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "연락 이력 저장에 실패했습니다.");
      }

      const savedActivities = payload.activities as CustomerActivityRow[];
      const latestContactedAt = (payload.latestContactedAt as string | null) ?? null;
      setContactActivities(
        savedActivities.map((activity) => ({
          clientId: activity.id,
          method: activity.method,
          occurredAt: toDateInputValue(activity.occurredAt),
          note: activity.note ?? "",
        })),
      );

      const nextCustomer = {
        ...customer,
        lastContactedAt: latestContactedAt,
        lastContactedLabel: null,
        updatedAt: new Date().toISOString(),
      };
      setDetailCustomer(nextCustomer);
      setDetailDraft(createDetailCustomerDraft(nextCustomer));
      updateGridRow(nextCustomer);
      setDetailNotice({ type: "success", message: successMessage });
      return true;
    } catch (error) {
      setDetailNotice({
        type: "error",
        message: error instanceof Error ? error.message : "연락 이력 저장에 실패했습니다.",
      });
      return false;
    } finally {
      setIsSavingActivities(false);
    }
  }

  async function saveCustomerField(
    previousRow: CustomerRow,
    field: EditableField,
    value: string | null,
    nextRow: CustomerRow,
  ) {
    setSavingIds((current) => new Set(current).add(previousRow.id));

    try {
      const response = await fetch(`/api/customers/${previousRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          field === "lastContactedAt"
            ? { lastContactedAt: value, lastContactedLabel: null }
            : { [field]: value },
        ),
      });

      if (!response.ok) {
        throw new Error("저장 실패");
      }

      if (field === "source" && value) {
        rememberSourceOption(value);
      }

      updateGridRow(nextRow);
    } catch {
      updateGridRow(previousRow);
      if (field === "callNote" || field === "lastContactedAt") {
        resetGridRowHeights();
      }
      setImportNotice({
        type: "error",
        message: "고객 정보를 저장하지 못했습니다. 변경 전 값으로 되돌렸습니다.",
      });
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(previousRow.id);
        return next;
      });
    }
  }

  function rememberSourceOption(value: string) {
    setFacets((current) => ({
      ...current,
      sources: uniqueStrings([...current.sources, value]),
      sourceOptions: uniqueStrings([...current.sourceOptions, value]),
    }));
  }

  const syncCustomerOptionFacets = useCallback((options: CustomerOptionRow[]) => {
    const activeManagedOptions = options.filter((option) => option.isManaged && option.isActive);
    const nextSourceOptions = activeManagedOptions
      .filter((option) => option.type === "source")
      .map((option) => option.label);
    const nextStatusOptions = activeManagedOptions
      .filter((option) => option.type === "status")
      .map((option) => option.label);

    setCustomerOptions(options);
    setFacets((current) => ({
      ...current,
      sourceOptions: uniqueStrings([...nextSourceOptions, ...current.sources]),
      statusOptions: uniqueStrings([...nextStatusOptions, ...current.statuses]),
    }));
  }, []);

  function deleteSelectedCustomers() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    startTransition(async () => {
      const response = await fetch("/api/customers/bulk?delete=1", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) return;

      const deletedVisibleCount = rowsRef.current.filter((row) => ids.includes(row.id)).length;
      replaceRows(rowsRef.current.filter((row) => !ids.includes(row.id)));
      setPageInfo((current) => ({
        ...current,
        returned: Math.max(0, current.returned - deletedVisibleCount),
      }));
      setSelectedIds(new Set());
    });
  }

  function sendSmsMessage() {
    if (!smsRecipients.length || !trimmedSmsMessage) return;

    setIsSmsDialogOpen(false);
    setSmsMessage("");
    setImportNotice({
      type: "success",
      message: `${smsRecipients.length.toLocaleString()}건 문자 전송 화면을 확인했습니다. 실제 발송 연동은 아직 연결하지 않았습니다.`,
    });
  }

  function exportCsv() {
    const headers = [
      "No",
      SALES_TEMPERATURE_LABEL,
      "DB출처",
      "전화번호",
      "성별",
      "연령대",
      "상황",
      "고객 메모",
      "마지막 통화",
      "오더 특이사항",
      "비고",
    ];
    const csvRows = rowsRef.current.map((row, index) => [
      String(pageStartIndex + index + 1),
      formatSalesPotential(row.salesPotential),
      row.source,
      row.phone,
      row.gender ?? "",
      row.ageDecade ?? "",
      row.status ?? "",
      row.callNote ?? "",
      formatLastContacted(row),
      row.orderNote ?? "",
      row.remark ?? "",
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "customers.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExcelTemplate() {
    setIsDownloadingTemplate(true);
    setImportNotice(null);

    try {
      const response = await fetch("/api/customers/import");

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "엑셀 템플릿 다운로드에 실패했습니다.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "customer-import-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportNotice({
        type: "error",
        message: error instanceof Error ? error.message : "엑셀 템플릿 다운로드에 실패했습니다.",
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setIsImporting(true);
    setImportNotice(null);

    try {
      const response = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "엑셀 업로드에 실패했습니다.");
      }

      const result = payload as CustomerImportResponse;
      replaceRows(result.rows);
      setPageInfo(result.pageInfo);
      setFacets(result.facets);
      resetFilters();
      const importDetails = [
        `신규 ${(result.inserted ?? result.imported).toLocaleString()}건`,
        result.updated !== undefined ? `업데이트 ${result.updated.toLocaleString()}건` : null,
        result.mergedDuplicates ? `파일 내 중복 ${result.mergedDuplicates.toLocaleString()}건 병합` : null,
      ].filter(Boolean);
      setImportNotice({
        type: "success",
        message: `${result.fileName}에서 ${result.imported.toLocaleString()}건을 업로드했습니다. (${importDetails.join(", ")})`,
      });
    } catch (error) {
      setImportNotice({
        type: "error",
        message: error instanceof Error ? error.message : "엑셀 업로드에 실패했습니다.",
      });
    } finally {
      setIsImporting(false);
      input.value = "";
    }
  }

  return (
    <div className="crm-customer-surface flex min-h-[calc(100vh-9rem)] flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[68px]" />
            <col />
            <col className="w-[68px]" />
            <col />
            <col className="w-[68px]" />
            <col />
            <col className="w-[116px]" />
          </colgroup>
          <tbody>
            <tr className="border-b border-[#edf1f6]">
              <th className="align-middle bg-[#f2f5f9] px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap text-[#69758a]">검색어</th>
              <td className="align-middle border-r border-[#edf1f6] px-2 py-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        searchCustomers();
                      }
                    }}
                    placeholder="전화번호, 메모 검색"
                    className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                  />
                </div>
              </td>
              <th className="align-middle bg-[#f2f5f9] px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap text-[#69758a]">출처</th>
              <td className="align-middle border-r border-[#edf1f6] px-2 py-2">
                <FacetSelect value={source} onValueChange={setSource} values={facets.sources} label="출처" className="w-full" />
              </td>
              <th className="align-middle bg-[#f2f5f9] px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap text-[#69758a]">상황</th>
              <td className="align-middle border-r border-[#edf1f6] px-2 py-2">
                <FacetSelect value={status} onValueChange={setStatus} values={facets.statuses} label="상황" className="w-full" />
              </td>
              <td rowSpan={2} className="border-l border-[#d8e0ea] bg-[#f8fafc] px-3 py-2 align-middle">
                <div className="flex flex-col gap-1.5">
                  <Button size="sm" onClick={searchCustomers} disabled={isSearching} className="w-full justify-center">
                    {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                    조회
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetFilters} className="w-full justify-center">
                    <RotateCcw className="size-3.5" />
                    초기화
                  </Button>
                  {dashboardFilter ? (
                    <button
                      type="button"
                      className="inline-flex h-7 items-center justify-center gap-1 rounded border border-[#bfd2f5] bg-[#eef4ff] px-2 text-[11px] font-semibold text-[#1f4f9f] transition-colors hover:bg-[#e1ecff]"
                      onClick={clearDashboardFilter}
                      aria-label={`${getDashboardFilterLabel(dashboardFilter)} 조건 해제`}
                    >
                      {getDashboardFilterLabel(dashboardFilter)}
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
            <tr>
              <th className="align-middle bg-[#f2f5f9] px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap text-[#69758a]">영업온도</th>
              <td className="align-middle border-r border-[#edf1f6] px-2 py-2">
                <SalesPotentialFilter
                  value={salesPotential}
                  onValueChange={setSalesPotential}
                  values={selectValues.salesPotentialOptions}
                  label={SALES_TEMPERATURE_LABEL}
                />
              </td>
              <th className="align-middle bg-[#f2f5f9] px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap text-[#69758a]">성별</th>
              <td className="align-middle border-r border-[#edf1f6] px-2 py-2">
                <FacetSelect value={gender} onValueChange={setGender} values={facets.genders} label="성별" className="w-full" />
              </td>
              <th className="align-middle bg-[#f2f5f9] px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap text-[#69758a]">나이대</th>
              <td className="align-middle border-r border-[#edf1f6] px-2 py-2">
                <FacetSelect value={ageDecade} onValueChange={setAgeDecade} values={facets.ageDecades} label="나이대" className="w-full" />
              </td>
            </tr>
          </tbody>
        </table>
        {importNotice && (
          <div
            className={
              importNotice.type === "success"
                ? "flex items-center gap-2 border-t border-[#d8e0ea] bg-[#eef4ff] px-3 py-2 text-sm text-[#1f4f9f]"
                : "flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {importNotice.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            <span>{importNotice.message}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{pageInfo.totalCount.toLocaleString()}건</Badge>
          {selectedCount > 0 && (
            <Badge variant="secondary">{selectedCount.toLocaleString()}건 선택</Badge>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={importExcel}
          />
          <Button size="sm" onClick={openCreateDetailDialog}>
            <FilePlus2 className="size-4" />
            추가
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSmsDialogOpen(true)}
            disabled={!selectedCount}
          >
            <MessageSquare className="size-4" />
            문자 전송
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={deleteSelectedCustomers}
            disabled={!selectedCount || isPending}
          >
            <Trash2 className="size-4" />
            삭제
          </Button>
          <div className="h-4 w-px bg-[#d8e0ea]" />
          <Button
            variant="outline"
            size="sm"
            disabled={isDownloadingTemplate}
            onClick={downloadExcelTemplate}
          >
            {isDownloadingTemplate ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            엑셀 템플릿
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
          >
            {isImporting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            엑셀 업로드
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" />
            CSV
          </Button>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const nextPageSize = normalizeClientPageSize(value);
              setPageSize(nextPageSize);
              savePageSize(pageSizeStorageKey, nextPageSize);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setIsOptionDialogOpen(true)}>
            <SlidersHorizontal className="size-4" />
            분류 관리
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_10px_34px_rgba(15,28,48,0.06)]">
        {(isSearching || isPending) && <LoadingOverlay />}
        <div className="ag-theme-quartz crm-grid h-[calc(100vh-18rem)] min-h-[420px] w-full">
          <AgGridReact<CustomerRow>
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            theme="legacy"
            getRowId={getRowId}
            rowSelection={{
              mode: "multiRow",
              checkboxes: true,
              headerCheckbox: true,
              selectAll: "currentPage",
              enableClickSelection: true,
            }}
            selectionColumnDef={{ pinned: "left", width: 48, resizable: false }}
            animateRows={false}
            rowBuffer={12}
            stopEditingWhenCellsLoseFocus
            onGridReady={onGridReady}
            onGridPreDestroyed={() => {
              gridApiRef.current = null;
            }}
            onSelectionChanged={onSelectionChanged}
            onColumnResized={onColumnResized}
            onSortChanged={onSortChanged}
            onCellValueChanged={onCellValueChanged}
          />
        </div>
        {pageSize !== "all" && (
          <div className="flex items-center justify-center gap-2 border-t border-[#edf1f6] bg-white py-2">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              aria-label="이전 페이지"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4rem] text-center text-xs font-medium text-[#5b6575]">
              {currentPage.toLocaleString()} / {Math.ceil(pageInfo.totalCount / effectivePageSize).toLocaleString()}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setCurrentPage((page) => page + 1)}
              disabled={!pageInfo.hasNextPage}
              aria-label="다음 페이지"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-[#d8e0ea] bg-[#f8fafc] px-5 py-4 pr-14">
            <DialogTitle className="text-base text-[#0d1b3d]">고객 분류 관리</DialogTitle>
            <DialogDescription>
              고객 관리에서 사용하는 DB 출처와 상황 값을 관리합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5">
            <CustomerOptionManager
              initialOptions={customerOptions}
              onOptionsChange={syncCustomerOptionFacets}
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isDetailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="crm-customer-surface max-h-[90vh] w-[calc(100vw-1rem)] overflow-visible p-0 sm:max-w-[96vw] 2xl:max-w-[1500px]">
          <div className="max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-[#d8e0ea] bg-[#f8fafc] px-5 py-3 pr-14">
              <DialogTitle className="flex min-w-0 items-center gap-2 text-base text-[#0d1b3d]">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#d8e0ea] bg-white text-[#2f70dc]">
                  <Phone className="size-4" />
                </span>
                <span className="truncate">{isCreatingDetailCustomer ? "고객 추가" : "고객 상세"}</span>
              </DialogTitle>
            </DialogHeader>

            {detailCustomer && detailDraft ? (
              <div className="grid gap-4 p-5">
                {detailNotice ? (
                  <div
                    className={
                      detailNotice.type === "success"
                        ? "flex items-center gap-2 rounded-md border border-[#bfd2f5] bg-[#eef4ff] px-3 py-2 text-sm text-[#1f4f9f]"
                        : "flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    }
                  >
                    {detailNotice.type === "success" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <AlertCircle className="size-4" />
                    )}
                    <span>{detailNotice.message}</span>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[minmax(560px,5fr)_minmax(0,7fr)]">
                  <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_8px_26px_rgba(15,28,48,0.05)]">
                    <div className="flex min-h-14 items-center gap-2 border-b border-[#d8e0ea] bg-[#f8fafc] px-4 py-3">
                      <UserRound className="size-4 text-[#2f70dc]" />
                      <h3 className="text-sm font-semibold text-[#0d1b3d]">기본 정보</h3>
                    </div>
                    <div className="grid gap-px bg-[#edf1f6] p-px sm:grid-cols-2">
                      <CustomerDetailTableRow label="연락처">
                        <Input
                          aria-label="연락처"
                          value={detailDraft.phone}
                          onChange={(event) => updateDetailDraft("phone", event.target.value)}
                          placeholder="전화번호"
                          className="h-8 border-[#d8e0ea] bg-white font-mono text-xs"
                        />
                      </CustomerDetailTableRow>
                      <CustomerDetailTableSelect
                        label="DB출처"
                        value={detailDraft.source || null}
                        values={selectValues.sourceOptions}
                        onValueChange={(value) => updateDetailDraft("source", value ?? "")}
                      />
                      <CustomerDetailTableRow label={SALES_TEMPERATURE_LABEL}>
                        <SalesPotentialSelect
                          value={detailDraft.salesPotential}
                          values={selectValues.salesPotentialOptions}
                          onValueChange={(value) => updateDetailDraft("salesPotential", value)}
                        />
                      </CustomerDetailTableRow>
                      <CustomerDetailTableRow label="마지막 연락">
                        <Input
                          aria-label="마지막 연락"
                          value={detailDraft.lastContactedAt}
                          onChange={(event) => updateDetailDraft("lastContactedAt", event.target.value)}
                          placeholder="YYYY-MM-DD"
                          className="h-8 border-[#d8e0ea] bg-white text-xs"
                        />
                      </CustomerDetailTableRow>
                      <CustomerDetailStaticRow
                        label="담당자"
                        value={detailCustomer.assignedUserName || SELECT_EMPTY_LABEL}
                      />
                      <CustomerDetailTableSelect
                        label="성별"
                        value={detailDraft.gender}
                        values={selectValues.genders}
                        onValueChange={(value) => updateDetailDraft("gender", value)}
                      />
                      <CustomerDetailTableSelect
                        label="나이대"
                        value={detailDraft.ageDecade}
                        values={selectValues.ageDecades}
                        onValueChange={(value) => updateDetailDraft("ageDecade", value)}
                      />
                      <CustomerDetailTableSelect
                        label="상황"
                        value={detailDraft.status}
                        values={selectValues.statusOptions}
                        onValueChange={(value) => updateDetailDraft("status", value)}
                      />
                      <CustomerDetailStaticRow label="등록일" value={formatDateOnly(detailCustomer.createdAt)} />
                      <CustomerDetailStaticRow label="수정일" value={formatDateOnly(detailCustomer.updatedAt)} />
                    </div>
                    <div className="grid gap-3 border-t border-[#edf1f6] p-4">
                      <CustomerDetailMemo
                        label="고객 메모"
                        value={detailDraft.callNote ?? ""}
                        onValueChange={(value) => updateDetailDraft("callNote", value)}
                      />
                      <CustomerDetailMemo
                        label="오더 특이사항"
                        value={detailDraft.orderNote ?? ""}
                        onValueChange={(value) => updateDetailDraft("orderNote", value)}
                      />
                      <CustomerDetailMemo
                        label="비고"
                        value={detailDraft.remark ?? ""}
                        onValueChange={(value) => updateDetailDraft("remark", value)}
                      />
                    </div>
                  </section>

                  <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_8px_26px_rgba(15,28,48,0.05)]">
                    <div className="flex min-h-14 flex-col gap-3 border-b border-[#d8e0ea] bg-[#f8fafc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-[#2f70dc]" />
                        <h3 className="text-sm font-semibold text-[#0d1b3d]">연락 이력</h3>
                        <span className="text-xs text-muted-foreground">
                          {contactActivities.length.toLocaleString()}건
                        </span>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={addContactActivity}>
                        <Plus className="size-4" />
                        행 추가
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[720px]">
                        <div className="grid grid-cols-[130px_150px_minmax(260px,1fr)_48px] border-b border-[#d8e0ea] bg-[#f2f5f9] text-xs font-medium text-[#69758a]">
                          <div className="px-3 py-2.5">연락방법</div>
                          <div className="px-3 py-2.5">연락일자</div>
                          <div className="px-3 py-2.5">연락내용</div>
                          <div className="px-2 py-2.5 text-center">삭제</div>
                        </div>
                        <div className="crm-contact-history-scroll max-h-[560px] overflow-y-scroll">
                          {isLoadingActivities ? (
                            <div className="flex items-center justify-center gap-2 px-3 py-12 text-sm text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" />
                              연락 이력 조회 중
                            </div>
                          ) : contactActivities.length > 0 ? (
                            contactActivities.map((activity) => (
                              <div
                                key={activity.clientId}
                                className="grid grid-cols-[130px_150px_minmax(260px,1fr)_48px] items-start border-b border-[#edf1f6] last:border-b-0 hover:bg-[#fbfcfe]"
                              >
                                <div className="p-2">
                                  <Select
                                    value={activity.method}
                                    onValueChange={(value) =>
                                      updateContactActivity(
                                        activity.clientId,
                                        "method",
                                        value as CustomerContactMethod,
                                      )
                                    }
                                  >
                                    <SelectTrigger size="sm" className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="call">통화</SelectItem>
                                      <SelectItem value="sms">문자</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="p-2">
                                  <Input
                                    type="date"
                                    value={activity.occurredAt}
                                    onChange={(event) =>
                                      updateContactActivity(activity.clientId, "occurredAt", event.target.value)
                                    }
                                    className="h-8"
                                  />
                                </div>
                                <div className="p-2">
                                  <Textarea
                                    value={activity.note}
                                    onChange={(event) =>
                                      updateContactActivity(activity.clientId, "note", event.target.value)
                                    }
                                    placeholder="연락내용을 입력하세요"
                                    className="min-h-16 resize-y border-[#d8e0ea] bg-[#fbfcfe] text-sm"
                                  />
                                </div>
                                <div className="flex justify-center p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => removeContactActivity(activity.clientId)}
                                    aria-label="연락 이력 삭제"
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-12 text-center text-sm text-muted-foreground">
                              등록된 연락 이력이 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : null}

            <DialogFooter className="sticky bottom-0 mx-0 mb-0 rounded-none border-t border-[#d8e0ea] bg-white/95 px-5 backdrop-blur">
              <DialogClose asChild>
                <Button variant="outline">닫기</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  void saveDetailChanges();
                }}
                disabled={!detailCustomer || isSavingDetailDialog || isLoadingActivities}
              >
                {isSavingDetailDialog ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isCreatingDetailCustomer ? "추가" : "저장"}
              </Button>
            </DialogFooter>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="absolute top-1/2 left-2 z-10 size-10 -translate-y-1/2 rounded-full border-[#d8e0ea] bg-white shadow-[0_10px_28px_rgba(15,28,48,0.16)] sm:-left-14"
            onClick={() => moveDetailDialog(-1)}
            disabled={!canOpenPreviousDetail || isLoadingActivities || isSavingDetailDialog}
            aria-label="이전 고객 상세 보기"
            title="이전 고객"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="absolute top-1/2 right-2 z-10 size-10 -translate-y-1/2 rounded-full border-[#d8e0ea] bg-white shadow-[0_10px_28px_rgba(15,28,48,0.16)] sm:-right-14"
            onClick={() => moveDetailDialog(1)}
            disabled={!canOpenNextDetail || isLoadingActivities || isSavingDetailDialog}
            aria-label="다음 고객 상세 보기"
            title="다음 고객"
          >
            <ChevronRight className="size-5" />
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>문자 전송</DialogTitle>
            <DialogDescription>
              {selectedCount.toLocaleString()}건 선택, 전화번호 {smsRecipients.length.toLocaleString()}건
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-md border border-[#d8e0ea] bg-[#f8fafc] px-3 py-2 text-xs text-[#69758a]">
              {smsPreviewPhones.length > 0 ? (
                <span>
                  {smsPreviewPhones.join(", ")}
                  {smsRecipients.length > smsPreviewPhones.length
                    ? ` 외 ${(smsRecipients.length - smsPreviewPhones.length).toLocaleString()}건`
                    : ""}
                </span>
              ) : (
                <span>선택한 고객에 전화번호가 없습니다.</span>
              )}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="customer-sms-message" className="text-xs font-medium text-foreground">
                문자 내용
              </label>
              <Textarea
                id="customer-sms-message"
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                placeholder="문자 내용을 입력하세요"
                className="min-h-36 resize-y text-sm"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{trimmedSmsMessage.length.toLocaleString()}자</span>
                <span>발송 연동 전</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button onClick={sendSmsMessage} disabled={!smsRecipients.length || !trimmedSmsMessage}>
              <Send className="size-4" />
              전송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyFormatter(params: ValueFormatterParams<CustomerRow>) {
  if (params.value === EMPTY || params.value === null || params.value === undefined || params.value === "") {
    return SELECT_EMPTY_LABEL;
  }

  return String(params.value);
}

function salesPotentialFormatter(params: ValueFormatterParams<CustomerRow>) {
  return formatSalesPotential(params.value);
}

function SalesPotentialCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">{SELECT_EMPTY_LABEL}</span>;

  const meta = getSalesPotentialMeta(value);

  return (
    <span
      className="inline-flex max-w-full items-center rounded px-2 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: meta.background,
        border: `1px solid ${meta.border}`,
        color: meta.foreground,
      }}
      title={meta.value}
    >
      <span className="truncate">{meta.value}</span>
    </span>
  );
}

function lastContactedFormatter(params: ValueFormatterParams<CustomerRow>) {
  if (params.data?.lastContactedLabel) return params.data.lastContactedLabel;
  return formatDateOnly(params.value);
}

function CustomerDetailTableRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-12 grid-cols-[96px_minmax(0,1fr)] bg-white text-left text-xs">
      <div className="flex items-center bg-[#f8fafc] px-3 py-2 text-[11px] font-semibold text-[#69758a]">
        {label}
      </div>
      <div className="flex min-w-0 items-center px-3 py-2 font-semibold text-[#0d1b3d]">{children}</div>
    </div>
  );
}

function CustomerDetailStaticRow({ label, value }: { label: string; value: string | null }) {
  return (
    <CustomerDetailTableRow label={label}>
      <div className="truncate">{value || SELECT_EMPTY_LABEL}</div>
    </CustomerDetailTableRow>
  );
}

function CustomerDetailTableSelect({
  label,
  value,
  values,
  onValueChange,
}: {
  label: string;
  value: string | null;
  values: string[];
  onValueChange: (value: string | null) => void;
}) {
  const options = useMemo(() => uniqueStrings(value ? [...values, value] : values), [value, values]);

  return (
    <CustomerDetailTableRow label={label}>
      <Select value={value ?? EMPTY} onValueChange={(nextValue) => onValueChange(nextValue === EMPTY ? null : nextValue)}>
        <SelectTrigger size="sm" className="w-full border-[#d8e0ea] bg-white text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY}>{SELECT_EMPTY_LABEL}</SelectItem>
          {options.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CustomerDetailTableRow>
  );
}

function CustomerDetailMemo({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-32 flex-col">
      <span className="text-xs font-semibold text-[#69758a]">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="입력된 내용 없음"
        className="mt-2 min-h-28 flex-1 resize-y border-[#d8e0ea] bg-[#f8fafc] leading-5 text-[#0d1b3d]"
      />
    </label>
  );
}

function SalesPotentialSelect({
  value,
  onValueChange,
  values,
}: {
  value: string | null;
  onValueChange: (value: string | null) => void;
  values: string[];
}) {
  const options = useMemo(
    () => uniqueSalesPotentialOptions([...SALES_POTENTIAL_OPTIONS, ...values]),
    [values],
  );

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-[#d8e0ea] bg-white p-1">
      <button
        type="button"
        aria-pressed={!value}
        className={cn(
          "h-6 rounded px-2 text-[11px] font-semibold text-[#69758a] transition-colors hover:bg-[#f8fafc]",
          !value && "bg-[#eef4ff] text-[#1f4f9f]",
        )}
        onClick={() => onValueChange(null)}
      >
        없음
      </button>
      {options.map((item) => {
        const meta = getSalesPotentialMeta(item);
        const selected = normalizeSalesPotential(value) === meta.value;

        return (
          <button
            key={item}
            type="button"
            aria-pressed={selected}
            className="h-6 rounded border px-2 text-[11px] font-semibold"
            style={{
              backgroundColor: selected ? meta.background : "#f8fafc",
              borderColor: selected ? meta.border : "#d8e0ea",
              color: selected ? meta.foreground : "#334155",
            }}
            onClick={() => onValueChange(meta.value)}
          >
            {meta.value}
          </button>
        );
      })}
    </div>
  );
}

function DateCellEditor({ value, onValueChange, stopEditing }: CustomCellEditorProps<CustomerRow, string | null>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dateValue, setDateValue] = useState(toDateInputValue(value));

  useEffect(() => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  return (
    <div className="crm-date-editor">
      <input
        ref={inputRef}
        type="date"
        value={dateValue}
        onChange={(event) => {
          setDateValue(event.target.value);
          onValueChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            stopEditing();
          }
        }}
      />
    </div>
  );
}

type StoredColumnWidth = Pick<ColumnState, "colId" | "width">;

type StoredColumnWidthPayload = {
  version: number;
  widths: StoredColumnWidth[];
};

function getColumnWidthStorageKey(userId: string) {
  return `crm:customers:grid-column-widths:v${COLUMN_WIDTH_STORAGE_VERSION}:${userId}`;
}

function getPageSizeStorageKey(userId: string) {
  return `crm:customers:grid-page-size:v${PAGE_SIZE_STORAGE_VERSION}:${userId}`;
}

function normalizeClientPageSize(value: unknown): PageSize {
  if (value === "all") return "all";

  const parsed = Number(value);
  if (parsed === 500 || parsed === 1000 || parsed === 2000) return parsed;

  return 100;
}

function savePageSize(storageKey: string, pageSize: PageSize) {
  try {
    window.localStorage.setItem(storageKey, String(pageSize));
  } catch {
    // localStorage can fail in private browsing or constrained environments.
  }
}

function readStoredPageSize(storageKey: string): PageSize | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;

    return normalizeClientPageSize(stored);
  } catch {
    return null;
  }
}

function restoreColumnWidths(api: GridApi<CustomerRow>, storageKey: string) {
  const payload = readStoredColumnWidths(storageKey);
  if (!payload?.widths.length) return;

  api.applyColumnState({
    state: payload.widths,
    applyOrder: false,
  });
}

function saveColumnWidths(api: GridApi<CustomerRow>, storageKey: string) {
  const widths = api
    .getColumnState()
    .filter((column) => resizableColumnIdSet.has(column.colId) && typeof column.width === "number")
    .map(({ colId, width }) => ({ colId, width }));

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: COLUMN_WIDTH_STORAGE_VERSION,
        widths,
      } satisfies StoredColumnWidthPayload),
    );
  } catch {
    // localStorage can fail in private browsing or constrained environments.
  }
}

function readStoredColumnWidths(storageKey: string): StoredColumnWidthPayload | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<StoredColumnWidthPayload>;
    if (parsed.version !== COLUMN_WIDTH_STORAGE_VERSION || !Array.isArray(parsed.widths)) {
      return null;
    }

    const widths = parsed.widths.filter(
      (item): item is StoredColumnWidth =>
        Boolean(item) &&
        typeof item.colId === "string" &&
        resizableColumnIdSet.has(item.colId) &&
        typeof item.width === "number" &&
        Number.isFinite(item.width) &&
        item.width > 0,
    );

    return { version: COLUMN_WIDTH_STORAGE_VERSION, widths };
  } catch {
    return null;
  }
}

function createDetailCustomerDraft(customer: CustomerRow): DetailCustomerDraft {
  return {
    source: customer.source,
    salesPotential: normalizeSalesPotential(customer.salesPotential),
    phone: customer.phone,
    gender: customer.gender,
    ageDecade: customer.ageDecade,
    status: customer.status,
    callNote: customer.callNote,
    lastContactedAt: toDateInputValue(customer.lastContactedAt) || customer.lastContactedLabel || "",
    orderNote: customer.orderNote,
    remark: customer.remark,
  };
}

function createNewCustomerPlaceholder({
  assignedUserId,
  source,
  status,
}: {
  assignedUserId: string;
  source: string;
  status: string | null;
}): CustomerRow {
  const now = new Date().toISOString();

  return {
    id: `new-customer-${createClientId()}`,
    source,
    salesPotential: null,
    phone: "",
    gender: null,
    ageDecade: null,
    status,
    callNote: null,
    lastContactedAt: null,
    lastContactedLabel: null,
    orderNote: null,
    remark: null,
    tags: [],
    assignedUserId,
    assignedUserName: null,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeEditedValue(field: EditableField, value: unknown) {
  const text = value === EMPTY || value === null || value === undefined ? "" : String(value);
  const trimmed = field === "callNote" || field === "orderNote" ? text : text.trim();

  if (field === "lastContactedAt") {
    return normalizeDateInputValue(trimmed);
  }

  if (field === "source" || field === "phone") {
    return trimmed;
  }

  if (field === "salesPotential") {
    return normalizeSalesPotential(trimmed);
  }

  return trimmed === "" ? null : trimmed;
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function normalizeMemoText(value: string | null | undefined) {
  const text = value ?? "";
  return text.trim() === "" ? null : text;
}

function isSortKey(value: string | undefined): value is SortKey {
  return (
    value === "source" ||
    value === "salesPotential" ||
    value === "phone" ||
    value === "gender" ||
    value === "ageDecade" ||
    value === "status" ||
    value === "lastContacted" ||
    value === "callNote" ||
    value === "orderNote" ||
    value === "remark"
  );
}

function escapeCsvValue(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function uniqueSalesPotentialOptions(values: string[]) {
  const normalizedValues = values
    .map((value) => normalizeSalesPotential(value))
    .filter((value): value is string => Boolean(value));
  const primaryOptions = new Set<string>(SALES_POTENTIAL_OPTIONS);
  const extraOptions = uniqueStrings(normalizedValues.filter((value) => !primaryOptions.has(value)));

  return [...SALES_POTENTIAL_OPTIONS, ...extraOptions];
}

function formatSalesPotential(value: unknown) {
  if (value === EMPTY || value === null || value === undefined || value === "") {
    return SELECT_EMPTY_LABEL;
  }

  return normalizeSalesPotential(String(value)) ?? SELECT_EMPTY_LABEL;
}

function formatLastContacted(row: CustomerRow) {
  if (row.lastContactedLabel) return row.lastContactedLabel;
  if (!row.lastContactedAt) return "";

  const date = new Date(row.lastContactedAt);
  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = seoul.getUTCFullYear();
  const month = String(seoul.getUTCMonth() + 1).padStart(2, "0");
  const day = String(seoul.getUTCDate()).padStart(2, "0");
  const hours = String(seoul.getUTCHours()).padStart(2, "0");
  const minutes = String(seoul.getUTCMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function formatDateOnly(value: unknown) {
  const inputValue = toDateInputValue(value);
  if (!inputValue) return SELECT_EMPTY_LABEL;

  return inputValue.replaceAll("-", ".");
}

function toDateInputValue(value: unknown) {
  if (!value) return "";
  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";

  const seoul = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = seoul.getUTCFullYear();
  const month = String(seoul.getUTCMonth() + 1).padStart(2, "0");
  const day = String(seoul.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDateInputValue(value: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+09:00`).toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function normalizeDetailLastContactedValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { lastContactedAt: null, lastContactedLabel: null };
  }

  const dateValue = normalizeDateInputValue(trimmed);
  if (dateValue) {
    return { lastContactedAt: dateValue, lastContactedLabel: null };
  }

  return { lastContactedAt: null, lastContactedLabel: trimmed };
}

function toIsoDate(value: string) {
  return normalizeDateInputValue(value) ?? new Date().toISOString();
}

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getDashboardFilterLabel(value: CustomerDashboardFilter) {
  switch (value) {
    case "open":
      return "상담 가능";
    case "callbacks":
      return "재연락 대상";
    case "contacted":
      return "연락 완료";
  }
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden rounded-t-lg">
        <div className="crm-progress-bar h-full" />
      </div>
      <div className="absolute inset-0 bg-white/45 backdrop-blur-[0.5px]" />
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-[#dbe3ee] bg-white/95 px-2.5 py-1 shadow-[0_2px_10px_rgba(15,28,48,0.10)]">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">조회 중</span>
      </div>
    </div>
  );
}

function FacetSelect({
  value,
  onValueChange,
  values,
  label,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  values: string[];
  label: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" className={cn("w-32 border-[#d8e0ea] bg-[#f8fafc] focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20", className)}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label} 전체</SelectItem>
        {value === CUSTOMER_EMPTY_FACET ? (
          <SelectItem value={CUSTOMER_EMPTY_FACET}>미분류</SelectItem>
        ) : null}
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SalesPotentialFilter({
  value,
  onValueChange,
  values,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  values: string[];
  label: string;
}) {
  const options = useMemo(
    () => uniqueSalesPotentialOptions([...SALES_POTENTIAL_OPTIONS, ...values]),
    [values],
  );

  return (
    <div
      className="flex min-h-9 max-w-full flex-wrap items-center gap-1 rounded-md border border-[#d8e0ea] bg-[#f8fafc] p-1"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        aria-pressed={value === ALL}
        className={cn(
          "h-7 rounded px-2.5 text-xs font-semibold text-[#69758a] transition-colors hover:bg-white",
          value === ALL && "bg-[#2f70dc] text-white shadow-sm hover:bg-[#2f70dc]",
        )}
        onClick={() => onValueChange(ALL)}
      >
        전체
      </button>
      {value === CUSTOMER_EMPTY_FACET ? (
        <button
          type="button"
          aria-pressed
          className="h-7 rounded border px-2.5 text-xs font-semibold"
          style={{
            backgroundColor: "#eef4ff",
            borderColor: "#bfd2f5",
            color: "#1f4f9f",
          }}
          onClick={() => onValueChange(CUSTOMER_EMPTY_FACET)}
        >
          미분류
        </button>
      ) : null}
      {options.map((item) => {
        const meta = getSalesPotentialMeta(item);
        const selected = normalizeSalesPotential(value) === meta.value;

        return (
          <button
            key={item}
            type="button"
            aria-pressed={selected}
            className="h-7 rounded border px-2.5 text-xs font-semibold transition-transform hover:-translate-y-px"
            style={{
              backgroundColor: selected ? meta.background : "white",
              borderColor: selected ? meta.border : "#d8e0ea",
              color: selected ? meta.foreground : "#334155",
            }}
            onClick={() => onValueChange(meta.value)}
          >
            {meta.value}
          </button>
        );
      })}
    </div>
  );
}
