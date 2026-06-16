"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Eye, EyeOff, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerOptionRow } from "@/lib/types";

type OptionType = CustomerOptionRow["type"];

const typeLabel: Record<OptionType, string> = {
  source: "DB 출처",
  status: "상황",
};

export function CustomerOptionManager({
  initialOptions,
  onOptionsChange,
}: {
  initialOptions: CustomerOptionRow[];
  onOptionsChange?: (options: CustomerOptionRow[]) => void;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(
    () => ({
      source: options.filter((option) => option.type === "source"),
      status: options.filter((option) => option.type === "status"),
    }),
    [options],
  );

  useEffect(() => {
    onOptionsChange?.(options);
  }, [onOptionsChange, options]);

  function upsertOption(next: CustomerOptionRow) {
    setOptions((current) => {
      const withoutDuplicates = current.filter(
        (option) =>
          option.id !== next.id && !(option.type === next.type && option.label === next.label),
      );

      return [...withoutDuplicates, next].sort(sortOptions);
    });
  }

  function removeOption(id: string) {
    setOptions((current) => current.filter((option) => option.id !== id));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {error ? (
        <div className="xl:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <OptionSection
        type="source"
        rows={grouped.source}
        isPending={isPending}
        onError={setError}
        onStartTransition={startTransition}
        onUpsert={upsertOption}
        onRemove={removeOption}
      />
      <OptionSection
        type="status"
        rows={grouped.status}
        isPending={isPending}
        onError={setError}
        onStartTransition={startTransition}
        onUpsert={upsertOption}
        onRemove={removeOption}
      />
    </div>
  );
}

function OptionSection({
  type,
  rows,
  isPending,
  onError,
  onStartTransition,
  onUpsert,
  onRemove,
}: {
  type: OptionType;
  rows: CustomerOptionRow[];
  isPending: boolean;
  onError: (message: string | null) => void;
  onStartTransition: ReturnType<typeof useTransition>[1];
  onUpsert: (option: CustomerOptionRow) => void;
  onRemove: (id: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  function createOption(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;

    onStartTransition(async () => {
      onError(null);
      const response = await fetch("/api/customer-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label: trimmed }),
      });
      const body = await response.json();

      if (!response.ok) {
        onError(body.error ?? "저장에 실패했습니다.");
        return;
      }

      onUpsert(body.option);
      setNewLabel("");
    });
  }

  function updateOption(option: CustomerOptionRow, body: Partial<CustomerOptionRow>) {
    onStartTransition(async () => {
      onError(null);
      const response = await fetch(`/api/customer-options/${option.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) {
        onError(result.error ?? "수정에 실패했습니다.");
        return;
      }

      onUpsert(result.option);
      setEditingId(null);
    });
  }

  function renameUnmanagedOption(option: CustomerOptionRow, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;

    onStartTransition(async () => {
      onError(null);
      const response = await fetch("/api/customer-options", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: option.type,
          fromLabel: option.label,
          label: trimmed,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        onError(result.error ?? "수정에 실패했습니다.");
        return;
      }

      onRemove(option.id);
      onUpsert(result.option);
      setEditingId(null);
    });
  }

  function deleteOption(option: CustomerOptionRow) {
    if (!window.confirm(`${option.label} 옵션을 삭제할까요? 고객 데이터 값은 유지됩니다.`)) {
      return;
    }

    onStartTransition(async () => {
      onError(null);
      const response = await fetch(`/api/customer-options/${option.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        onError(result.error ?? "삭제에 실패했습니다.");
        return;
      }

      onRemove(option.id);
    });
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{typeLabel[type]} 관리</CardTitle>
          <Badge variant="secondary">{rows.length.toLocaleString()}개</Badge>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            createOption(newLabel);
          }}
        >
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder={`${typeLabel[type]} 추가`}
            className="h-8"
          />
          <Button type="submit" size="sm" disabled={isPending || !newLabel.trim()}>
            <Plus className="size-4" />
            추가
          </Button>
        </form>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{typeLabel[type]}</TableHead>
              <TableHead className="w-24 text-right">고객수</TableHead>
              <TableHead className="w-24">상태</TableHead>
              <TableHead className="w-28 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((option) => {
              const editing = editingId === option.id;

              return (
                <TableRow key={option.id}>
                  <TableCell className="min-w-44">
                    {editing ? (
                      <Input
                        value={draftLabel}
                        onChange={(event) => setDraftLabel(event.target.value)}
                        className="h-8"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        {!option.isManaged ? (
                          <Badge variant="outline" className="text-xs">
                            데이터 값
                          </Badge>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {option.usageCount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {option.isActive ? (
                      <Badge variant="secondary">사용</Badge>
                    ) : (
                      <Badge variant="outline">숨김</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editing ? (
                        <>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            disabled={isPending || !draftLabel.trim()}
                            aria-label="저장"
                            onClick={() => {
                              if (option.isManaged) {
                                updateOption(option, { label: draftLabel });
                                return;
                              }

                              renameUnmanagedOption(option, draftLabel);
                            }}
                          >
                            <Save className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="취소"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : !option.isManaged ? (
                        <>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            disabled={isPending}
                            aria-label="옵션 등록"
                            onClick={() => createOption(option.label)}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={isPending}
                            aria-label="데이터 값 수정"
                            onClick={() => {
                              setEditingId(option.id);
                              setDraftLabel(option.label);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={isPending}
                            aria-label="이름 수정"
                            onClick={() => {
                              setEditingId(option.id);
                              setDraftLabel(option.label);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={isPending}
                            aria-label={option.isActive ? "숨김" : "사용"}
                            onClick={() => updateOption(option, { isActive: !option.isActive })}
                          >
                            {option.isActive ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="destructive"
                            disabled={isPending}
                            aria-label="삭제"
                            onClick={() => deleteOption(option)}
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
      </CardContent>
    </Card>
  );
}

function sortOptions(a: CustomerOptionRow, b: CustomerOptionRow) {
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;

  return a.label.localeCompare(b.label, "ko");
}
