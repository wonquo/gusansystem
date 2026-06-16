"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  GripVertical,
  Loader2,
  Paperclip,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ErpGridDetailHelpers } from "./erp-grid";

type ProjectItemType = "contract" | "payment" | "expense" | "memo";

type DraftItem = {
  localId: string;
  itemType: ProjectItemType;
  orderedOn: string;
  partnerName: string;
  description: string;
  contractAmount: string;
  receivedAmount: string;
  spentAmount: string;
  paymentStatus: PaymentStatus | "";
  paymentDate: string;
  memo: string;
  sourceSheetName?: string;
  sourceRowNumber?: number;
  sortOrder?: number;
};

type DraftAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  addedAt: string;
};

type EditableItemField =
  | "itemType"
  | "orderedOn"
  | "partnerName"
  | "description"
  | "contractAmount"
  | "receivedAmount"
  | "spentAmount"
  | "paymentStatus"
  | "paymentDate"
  | "memo";

type PaymentStatus = "unpaid" | "paid";

const ITEM_TYPE_LABELS: Record<ProjectItemType, string> = {
  contract: "수주",
  payment: "결제",
  expense: "집행",
  memo: "메모",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "미결제",
  paid: "결제완료",
};

const PAYMENT_STATUS_EMPTY = "__empty_payment_status__";

export function ProjectDetail({
  row,
  helpers,
}: {
  row: Record<string, unknown>;
  helpers: ErpGridDetailHelpers;
}) {
  const isNewProject = row.__isNew === true;
  const [projectName, setProjectName] = useState(() => String(row.projectName ?? ""));
  const [clientName, setClientName] = useState(() => String(row.clientName ?? ""));
  const [orderedOn, setOrderedOn] = useState(() => String(row.orderedOn ?? ""));
  const [memo, setMemo] = useState(() => String(row.memo ?? ""));
  const [items, setItems] = useState<DraftItem[]>(() => toDraftItems(row.items));
  const [attachments, setAttachments] = useState<DraftAttachment[]>(() => toDraftAttachments(row.rawData));
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ localId: string; field: EditableItemField } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(
    () => ({
      contractAmount: sumItems(items, "contractAmount"),
      receivedAmount: sumItems(items, "receivedAmount"),
      spentAmount: sumItems(items, "spentAmount"),
      profitAmount: sumItems(items, "receivedAmount") - sumItems(items, "spentAmount"),
    }),
    [items],
  );
  const emptyRowCount = Math.max(0, 5 - items.length);
  const hasScrollableItemGrid = items.length > 8;
  const paymentCompletionRate =
    totals.contractAmount > 0 ? Math.min(100, Math.round((totals.receivedAmount / totals.contractAmount) * 100)) : 0;
  const unpaidPaymentCount = items.filter((item) => item.itemType === "payment" && item.paymentStatus !== "paid").length;

  function updateItem(localId: string, patch: Partial<DraftItem>) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    );
  }

  function addItem(itemType: ProjectItemType) {
    const localId = crypto.randomUUID();
    setItems((currentItems) => [
      ...currentItems,
      {
        localId,
        itemType,
        orderedOn: "",
        partnerName: clientName,
        description: "",
        contractAmount: itemType === "contract" ? "0" : "",
        receivedAmount: itemType === "payment" ? "0" : "",
        spentAmount: itemType === "expense" ? "0" : "",
        paymentStatus: itemType === "payment" ? "unpaid" : "",
        paymentDate: "",
        memo: "",
        sortOrder: currentItems.length,
      },
    ]);
  }

  function removeItem(localId: string) {
    setItems((currentItems) => currentItems.filter((item) => item.localId !== localId));
  }

  function startItemDrag(event: DragEvent<HTMLButtonElement>, localId: string) {
    setDraggingItemId(localId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", localId);
  }

  function dropItem(event: DragEvent<HTMLTableRowElement>, targetLocalId: string) {
    event.preventDefault();
    const draggedLocalId = event.dataTransfer.getData("text/plain") || draggingItemId;
    setDraggingItemId(null);
    if (!draggedLocalId || draggedLocalId === targetLocalId) {
      return;
    }

    setItems((currentItems) => {
      const fromIndex = currentItems.findIndex((item) => item.localId === draggedLocalId);
      const toIndex = currentItems.findIndex((item) => item.localId === targetLocalId);
      if (fromIndex < 0 || toIndex < 0) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [movedItem] = nextItems.splice(fromIndex, 1);
      nextItems.splice(toIndex, 0, movedItem);
      return nextItems.map((item, index) => ({ ...item, sortOrder: index }));
    });
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const nextAttachments = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl: await readFileAsDataUrl(file),
        addedAt: new Date().toISOString(),
      })),
    );
    setAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((currentAttachments) => currentAttachments.filter((attachment) => attachment.id !== id));
  }

  function saveProject() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const payload = {
        projectName,
        clientName,
        orderedOn,
        memo,
        attachments,
        items: items.map((item, index) => ({
          itemType: item.itemType,
          orderedOn: item.orderedOn,
          partnerName: item.partnerName,
          description: item.description,
          contractAmount: item.contractAmount,
          receivedAmount: item.receivedAmount,
          spentAmount: item.spentAmount,
          paymentStatus: item.paymentStatus || null,
          paymentDate: item.paymentDate,
          memo: item.memo,
          sourceSheetName: item.sourceSheetName,
          sourceRowNumber: item.sourceRowNumber,
          sortOrder: index,
        })),
      };
      const response = await fetch("/api/projects", {
        method: isNewProject ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isNewProject ? payload : { id: row.id, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? (isNewProject ? "프로젝트 등록에 실패했습니다." : "프로젝트 저장에 실패했습니다."));
        return;
      }
      helpers.replaceRow(data.row);
      setMessage(isNewProject ? "프로젝트가 등록되었습니다." : "프로젝트가 저장되었습니다.");
    });
  }

  function deleteCurrentProject() {
    if (!window.confirm("선택한 프로젝트를 삭제할까요? 상세 항목도 함께 삭제됩니다.")) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(String(row.id))}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "프로젝트 삭제에 실패했습니다.");
        return;
      }
      helpers.removeRow(String(row.id));
    });
  }

  return (
    <div className="flex flex-col bg-[#eef2f7] text-xs text-[#1f2a3d]">
      <div className="shrink-0 space-y-3 border-b border-[#d7dee9] bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,28,48,0.03)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-[#d7dee9] bg-white shadow-[0_8px_22px_rgba(15,28,48,0.05)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf2] bg-[#f8fafc] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[#cfe0ff] bg-[#eef4ff] text-[#2563eb]">
                  <ClipboardList className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#69758a]">프로젝트 상세</p>
                  <p className="truncate text-sm font-extrabold text-[#0d1b3d]">{projectName || "이름 없는 프로젝트"}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-md border border-[#d8e0ea] bg-white px-2 py-1 font-mono text-[11px] font-bold text-[#475569]">
                  {items.length.toLocaleString()} items
                </span>
                {unpaidPaymentCount ? (
                  <span className="rounded-md border border-[#f3d28a] bg-[#fff7e6] px-2 py-1 text-[11px] font-bold text-[#8a5a05]">
                    미결제 {unpaidPaymentCount}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid gap-px bg-[#e5eaf2] p-px lg:grid-cols-[88px_minmax(220px,1.2fr)_72px_minmax(140px,0.65fr)_72px_188px]">
              <div className="flex items-center gap-1.5 bg-[#f2f5f9] px-3 py-2 text-[11px] font-bold whitespace-nowrap text-[#69758a]">
                <FileText className="size-3.5" />
                프로젝트
              </div>
              <div className="bg-white p-2">
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  className="h-8 border-[#d8e0ea] bg-white text-sm font-semibold focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-[#f2f5f9] px-3 py-2 text-[11px] font-bold whitespace-nowrap text-[#69758a]">
                <Building2 className="size-3.5" />
                업체
              </div>
              <div className="bg-white p-2">
                <Input
                  id="project-client"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  className="h-8 border-[#d8e0ea] bg-white text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-[#f2f5f9] px-3 py-2 text-[11px] font-bold whitespace-nowrap text-[#69758a]">
                <CalendarDays className="size-3.5" />
                일자
              </div>
              <div className="bg-white p-2">
                <Input
                  id="project-date"
                  type="date"
                  value={orderedOn}
                  onChange={(event) => setOrderedOn(event.target.value)}
                  className="h-8 border-[#d8e0ea] bg-white font-mono text-xs focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                />
              </div>
              <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-bold whitespace-nowrap text-[#69758a]">
                비고
              </div>
              <div className="bg-white p-2 lg:col-span-5">
                <Textarea
                  id="project-memo"
                  value={memo}
                  rows={2}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="프로젝트 비고"
                  className="h-14 min-h-14 resize-none overflow-y-auto border-[#d8e0ea] bg-white text-xs leading-5 focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-[#f2f5f9] px-3 py-2 text-[11px] font-bold whitespace-nowrap text-[#69758a]">
                <Paperclip className="size-3.5" />
                첨부파일
              </div>
              <div className="bg-white p-2 lg:col-span-5">
                <div className="grid gap-2">
                  <Input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    className="h-8 border-[#d8e0ea] bg-white text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#eef4ff] file:px-2.5 file:py-1 file:text-[11px] file:font-bold file:text-[#1f4f9f] focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                    onChange={(event) => void addAttachments(event.target.files)}
                  />
                  {attachments.length ? (
                    <div className="grid gap-1">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex min-h-8 items-center justify-between gap-2 rounded border border-[#edf1f6] bg-[#fbfdff] px-2 py-1"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#26344d]">{attachment.name}</p>
                            <p className="text-[10px] text-[#7b8798]">{formatFileSize(attachment.size)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button type="button" size="icon-xs" variant="ghost" title="첨부파일 다운로드" asChild>
                              <a href={attachment.dataUrl} download={attachment.name}>
                                <Download className="size-3.5" />
                              </a>
                            </Button>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              title="첨부파일 삭제"
                              aria-label="첨부파일 삭제"
                              onClick={() => removeAttachment(attachment.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-2 xl:w-[420px] 2xl:w-[560px]">
            <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_10px_28px_rgba(15,28,48,0.07)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf2] bg-[#f8fafc] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-[#0d1b3d]">프로젝트 지표</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#7b8798]">수주, 결제, 집행, 이익 요약</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-extrabold text-[#0d1b3d]">{paymentCompletionRate}%</p>
                  <p className="text-[10px] font-bold text-[#69758a]">결제 진행률</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#edf1f6] sm:grid-cols-4 xl:grid-cols-2">
                {[
                  {
                    label: "수주",
                    value: totals.contractAmount,
                    icon: <ReceiptText className="size-3.5" />,
                    detail: `${items.filter((item) => item.itemType === "contract").length.toLocaleString()}건 등록`,
                    tone: "text-[#2563eb] bg-[#eef4ff]",
                  },
                  {
                    label: "결제",
                    value: totals.receivedAmount,
                    icon: <CreditCard className="size-3.5" />,
                    detail: `수주 대비 ${formatRatioPercent(totals.receivedAmount, totals.contractAmount)}`,
                    tone: "text-[#047857] bg-[#ecfdf5]",
                  },
                  {
                    label: "집행",
                    value: totals.spentAmount,
                    icon: <WalletCards className="size-3.5" />,
                    detail: `결제 대비 ${formatRatioPercent(totals.spentAmount, totals.receivedAmount)}`,
                    tone: "text-[#b45309] bg-[#fff7e6]",
                  },
                  {
                    label: "이익",
                    value: totals.profitAmount,
                    icon: <TrendingUp className="size-3.5" />,
                    detail: `이익률 ${formatRatioPercent(totals.profitAmount, totals.receivedAmount)}`,
                    tone:
                      totals.profitAmount < 0
                        ? "text-[#be123c] bg-[#fff1f2]"
                        : "text-[#0f766e] bg-[#f0fdfa]",
                  },
                ].map((summary) => (
                  <div key={summary.label} className="min-w-0 bg-white px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md",
                            summary.tone,
                          )}
                        >
                          {summary.icon}
                        </span>
                        <p className="truncate text-[11px] font-extrabold text-[#4f5f75]">{summary.label}</p>
                      </div>
                      <p className="shrink-0 text-[10px] font-bold text-[#8a96a8]">{summary.detail}</p>
                    </div>
                    <p
                      className={cn(
                        "mt-2 truncate text-right font-mono text-base font-extrabold leading-none text-[#0d1b3d]",
                        summary.label === "이익" && totals.profitAmount < 0 && "text-[#be123c]",
                      )}
                    >
                      {formatMoney(summary.value)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e5eaf2] bg-[#fbfdff] px-3 py-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-[#e7edf5]">
                  <span
                    className="block h-full rounded-full bg-[#2f70dc]"
                    style={{ width: `${paymentCompletionRate}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {(["contract", "payment", "expense", "memo"] as ProjectItemType[]).map((itemType) => (
                <Button
                  key={itemType}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#cfd9e7] bg-white"
                  onClick={() => addItem(itemType)}
                >
                  <Plus className="size-3.5" />
                  {ITEM_TYPE_LABELS[itemType]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {message ? (
          <Alert className="border-[#bfd2f5] bg-[#eef4ff] text-[#1f4f9f]">
            <AlertTitle className="text-xs">완료</AlertTitle>
            <AlertDescription className="text-xs">{message}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle className="text-xs">확인 필요</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_12px_30px_rgba(15,28,48,0.07)]">
          <div
            className={cn(
              "overflow-x-auto",
              hasScrollableItemGrid && "max-h-[398px] overflow-y-auto [scrollbar-gutter:stable]",
            )}
          >
            <table className="w-full min-w-[1240px] table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-[32px]" />
                <col className="w-[62px]" />
                <col className="w-[210px]" />
                <col className="w-[126px]" />
                <col className="w-[112px]" />
                <col className="w-[104px]" />
                <col className="w-[104px]" />
                <col className="w-[104px]" />
                <col className="w-[84px]" />
                <col className="w-[104px]" />
                <col className="w-[118px]" />
                <col className="w-[36px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#f3f6fa] text-[11px] font-extrabold text-[#5d6b80]">
                <tr className="border-b border-[#d8e0ea]">
                  <th className="px-1 py-2 text-center">순서</th>
                  <th className="px-2 py-2">구분</th>
                  <th className="px-2 py-2">내용</th>
                  <th className="px-2 py-2">업체</th>
                  <th className="px-2 py-2">일자</th>
                  <th className="px-2 py-2 text-right">수주</th>
                  <th className="px-2 py-2 text-right">결제</th>
                  <th className="px-2 py-2 text-right">집행</th>
                  <th className="px-2 py-2">결제상태</th>
                  <th className="px-2 py-2">결제일</th>
                  <th className="px-2 py-2">비고</th>
                  <th className="px-1 py-2 text-center">삭제</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.localId}
                    className={cn(
                      "h-10 border-b border-[#edf1f6] bg-white last:border-b-0 hover:bg-[#f8fbff]",
                      draggingItemId === item.localId && "bg-[#eef4ff] opacity-75",
                    )}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => dropItem(event, item.localId)}
                  >
                    <td className="px-1 py-1 text-center align-middle">
                      <button
                        type="button"
                        draggable
                        title="드래그해서 순서 변경"
                        aria-label="드래그해서 순서 변경"
                        className="inline-flex size-7 cursor-grab items-center justify-center rounded text-[#7b8798] hover:bg-[#eef4ff] hover:text-[#1f4f9f] active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#2f70dc]/20 focus-visible:outline-none"
                        onDragStart={(event) => startItemDrag(event, item.localId)}
                        onDragEnd={() => setDraggingItemId(null)}
                      >
                        <GripVertical className="size-4" />
                      </button>
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="itemType"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="description"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="partnerName"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="orderedOn"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="contractAmount"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="receivedAmount"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="spentAmount"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="paymentStatus"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="paymentDate"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <EditableItemCell
                        item={item}
                        field="memo"
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        updateItem={updateItem}
                      />
                    </td>
                    <td className="px-1 py-1 text-center align-middle">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        title="상세 항목 삭제"
                        aria-label="상세 항목 삭제"
                        onClick={() => removeItem(item.localId)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: emptyRowCount }, (_, index) => (
                  <tr key={`empty-${index}`} className="h-9 border-b border-[#edf1f6] last:border-b-0">
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                    <td className="px-1 py-1" />
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 border-t border-[#b8cdf5] bg-[#f1f6ff] font-extrabold text-[#0d1b3d]">
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-right">
                    합계
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{formatMoney(totals.contractAmount)}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatMoney(totals.receivedAmount)}</td>
                  <td className="px-2 py-2 text-right font-mono">{formatMoney(totals.spentAmount)}</td>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                  <td className="px-1 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#d8e0ea] bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {isNewProject ? (
            <span />
          ) : (
            <Button type="button" variant="destructive" size="sm" onClick={deleteCurrentProject} disabled={isPending}>
              <Trash2 className="size-3.5" />
              삭제
            </Button>
          )}
          <Button type="button" size="sm" onClick={saveProject} disabled={isPending || !projectName.trim()}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {isNewProject ? "등록" : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditableItemCell({
  item,
  field,
  editingCell,
  setEditingCell,
  updateItem,
}: {
  item: DraftItem;
  field: EditableItemField;
  editingCell: { localId: string; field: EditableItemField } | null;
  setEditingCell: (cell: { localId: string; field: EditableItemField } | null) => void;
  updateItem: (localId: string, patch: Partial<DraftItem>) => void;
}) {
  const isEditing = editingCell?.localId === item.localId && editingCell.field === field;
  const isAmount = field === "contractAmount" || field === "receivedAmount" || field === "spentAmount";
  const isPaymentOnlyField = field === "paymentStatus" || field === "paymentDate";
  const isPaymentItem = item.itemType === "payment";
  const isEditable = !isPaymentOnlyField || isPaymentItem;
  const displayValue = getItemDisplayValue(item, field);

  if (isEditing) {
    if (field === "itemType") {
      return (
        <Select
          value={item.itemType}
          onValueChange={(value) => {
            const itemType = value as ProjectItemType;
            updateItem(item.localId, {
              itemType,
              paymentStatus: itemType === "payment" ? item.paymentStatus || "unpaid" : "",
              paymentDate: itemType === "payment" ? item.paymentDate : "",
            });
            setEditingCell(null);
          }}
        >
          <SelectTrigger
            autoFocus
            className="h-7 rounded-md border-[#2f70dc] bg-white px-2 text-xs ring-2 ring-[#2f70dc]/15"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contract">수주</SelectItem>
            <SelectItem value="payment">결제</SelectItem>
            <SelectItem value="expense">집행</SelectItem>
            <SelectItem value="memo">메모</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (field === "paymentStatus") {
      return (
        <Select
          value={item.paymentStatus || PAYMENT_STATUS_EMPTY}
          onValueChange={(value) => {
            updateItem(item.localId, {
              paymentStatus: value === PAYMENT_STATUS_EMPTY ? "" : (value as PaymentStatus),
            });
            setEditingCell(null);
          }}
        >
          <SelectTrigger
            autoFocus
            className="h-7 rounded-md border-[#2f70dc] bg-white px-2 text-xs ring-2 ring-[#2f70dc]/15"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PAYMENT_STATUS_EMPTY} textValue="NULL">
              <span className="block h-5" aria-hidden="true" />
            </SelectItem>
            <SelectItem value="unpaid">미결제</SelectItem>
            <SelectItem value="paid">결제완료</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (isAmount) {
      return (
        <AmountInput
          value={String(item[field] ?? "")}
          placeholder={getFieldPlaceholder(field)}
          autoFocus
          onBlur={() => setEditingCell(null)}
          onChange={(value) => updateItem(item.localId, { [field]: value })}
        />
      );
    }

    return (
      <Input
        autoFocus
        type={field === "orderedOn" || field === "paymentDate" ? "date" : "text"}
        value={String(item[field] ?? "")}
        onBlur={() => setEditingCell(null)}
        onChange={(event) => updateItem(item.localId, { [field]: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.currentTarget.blur();
          }
        }}
        placeholder={getFieldPlaceholder(field)}
        className={cn(
          "h-7 rounded-md border-[#2f70dc] bg-white px-2 text-xs ring-2 ring-[#2f70dc]/15",
          (field === "orderedOn" || field === "paymentDate") && "font-mono",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "block h-7 w-full min-w-0 rounded px-2 text-left leading-7 text-[#26344d] hover:bg-[#eef4ff] focus-visible:ring-2 focus-visible:ring-[#2f70dc]/20 focus-visible:outline-none",
        isAmount && "text-right font-mono font-semibold",
        field === "contractAmount" && "text-[#1f4f9f]",
        field === "receivedAmount" && "text-[#047857]",
        field === "spentAmount" && "text-[#b45309]",
        (field === "orderedOn" || field === "paymentDate") && "font-mono",
        !isEditable && "cursor-default text-[#a3acba] hover:bg-transparent",
      )}
      title={displayValue}
      onDoubleClick={() => {
        if (isEditable) {
          setEditingCell({ localId: item.localId, field });
        }
      }}
    >
      {field === "itemType" ? (
        <span
          className={cn(
            "inline-flex h-5 max-w-full items-center rounded-md border px-1.5 text-[11px] font-bold",
            item.itemType === "contract" && "border-[#bfd2f5] bg-[#eef4ff] text-[#1f4f9f]",
            item.itemType === "payment" && "border-[#bbebcf] bg-[#ecfdf5] text-[#047857]",
            item.itemType === "expense" && "border-[#f1d08a] bg-[#fff7e6] text-[#b45309]",
            item.itemType === "memo" && "border-[#d8e0ea] bg-[#f5f7fa] text-[#475569]",
          )}
        >
          {ITEM_TYPE_LABELS[item.itemType]}
        </span>
      ) : field === "paymentStatus" && isPaymentItem && item.paymentStatus ? (
        <span
          className={cn(
            "inline-flex h-5 max-w-full items-center rounded-md border px-1.5 text-[11px] font-bold",
            item.paymentStatus === "paid"
              ? "border-[#bbebcf] bg-[#ecfdf5] text-[#047857]"
              : "border-[#f1d08a] bg-[#fff7e6] text-[#8a5a05]",
          )}
        >
          {PAYMENT_STATUS_LABELS[item.paymentStatus]}
        </span>
      ) : (
        <span className="block truncate">{displayValue || "-"}</span>
      )}
    </button>
  );
}

function AmountInput({
  value,
  placeholder,
  onChange,
  autoFocus = false,
  onBlur,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onBlur?: () => void;
}) {
  return (
    <Input
      autoFocus={autoFocus}
      inputMode="numeric"
      value={value}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.currentTarget.blur();
        }
      }}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-7 rounded-md border-[#2f70dc] bg-white px-2 text-right font-mono text-xs ring-2 ring-[#2f70dc]/15"
    />
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function toDraftItems(value: unknown): DraftItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item, index) => {
    const row = isRecord(item) ? item : {};
    const rawData = isRecord(row.rawData) ? row.rawData : {};
    return {
      localId: String(row.id ?? crypto.randomUUID()),
      itemType: toItemType(row.itemType),
      orderedOn: String(row.orderedOn ?? ""),
      partnerName: String(row.partnerName ?? ""),
      description: String(row.description ?? ""),
      contractAmount: amountString(row.contractAmount),
      receivedAmount: amountString(row.receivedAmount),
      spentAmount: amountString(row.spentAmount),
      paymentStatus: toPaymentStatus(rawData.paymentStatus ?? row.paymentStatus),
      paymentDate: String(rawData.paymentDate ?? row.paymentDate ?? ""),
      memo: String(row.memo ?? ""),
      sourceSheetName: typeof row.sourceSheetName === "string" ? row.sourceSheetName : undefined,
      sourceRowNumber: typeof row.sourceRowNumber === "number" ? row.sourceRowNumber : undefined,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : index,
    };
  });
}

function toDraftAttachments(value: unknown): DraftAttachment[] {
  const rawData = isRecord(value) ? value : {};
  const attachments = Array.isArray(rawData.attachments) ? rawData.attachments : [];
  return attachments.flatMap((attachment) => {
    if (!isRecord(attachment)) return [];
    const name = typeof attachment.name === "string" ? attachment.name : "";
    const dataUrl = typeof attachment.dataUrl === "string" ? attachment.dataUrl : "";
    if (!name || !dataUrl) return [];
    return [{
      id: typeof attachment.id === "string" ? attachment.id : crypto.randomUUID(),
      name,
      size: typeof attachment.size === "number" ? attachment.size : 0,
      type: typeof attachment.type === "string" ? attachment.type : "application/octet-stream",
      dataUrl,
      addedAt: typeof attachment.addedAt === "string" ? attachment.addedAt : "",
    }];
  });
}

function toItemType(value: unknown): ProjectItemType {
  return value === "contract" || value === "payment" || value === "expense" || value === "memo"
    ? value
    : "memo";
}

function toPaymentStatus(value: unknown): PaymentStatus | "" {
  const text = String(value ?? "").trim();
  if (text === "paid" || text === "결제완료") return "paid";
  if (text === "unpaid" || text === "미결제") return "unpaid";
  return "";
}

function amountString(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number !== 0 ? String(Math.round(number)) : "";
}

function sumItems(items: DraftItem[], field: "contractAmount" | "receivedAmount" | "spentAmount") {
  return items.reduce((total, item) => total + Number(String(item[field]).replace(/[^\d.-]/g, "") || 0), 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatRatioPercent(value: number, base: number) {
  if (!base) return "0%";
  return `${Math.round((value / base) * 100).toLocaleString("ko-KR")}%`;
}

function getItemDisplayValue(item: DraftItem, field: EditableItemField) {
  if (field === "itemType") {
    return ITEM_TYPE_LABELS[item.itemType];
  }
  if ((field === "paymentStatus" || field === "paymentDate") && item.itemType !== "payment") {
    return "";
  }
  if (field === "paymentStatus") {
    return item.paymentStatus ? PAYMENT_STATUS_LABELS[item.paymentStatus] : "";
  }
  if (field === "contractAmount" || field === "receivedAmount" || field === "spentAmount") {
    const value = Number(String(item[field]).replace(/[^\d.-]/g, "") || 0);
    return value ? formatMoney(value) : "";
  }
  if (field === "orderedOn") {
    return formatDateText(item.orderedOn);
  }
  if (field === "paymentDate") {
    return formatDateText(item.paymentDate);
  }
  return String(item[field] ?? "");
}

function getFieldPlaceholder(field: EditableItemField) {
  return {
    itemType: "구분",
    orderedOn: "일자",
    partnerName: "업체",
    description: "내용",
    contractAmount: "수주",
    receivedAmount: "결제",
    spentAmount: "집행",
    paymentStatus: "결제상태",
    paymentDate: "결제일",
    memo: "비고",
  }[field];
}

function formatDateText(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : value;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size}B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)}KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
