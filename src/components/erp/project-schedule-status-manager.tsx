"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Eye, EyeOff, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectScheduleStatusOptionRow } from "@/lib/types";

const DEFAULT_COLOR = "#2f70dc";

export function ProjectScheduleStatusManager({
  initialOptions,
  onOptionsChange,
  onRowsChange,
}: {
  initialOptions: ProjectScheduleStatusOptionRow[];
  onOptionsChange?: (options: ProjectScheduleStatusOptionRow[]) => void;
  onRowsChange?: () => void;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftColor, setDraftColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedOptions = useMemo(() => [...options].sort(sortOptions), [options]);

  useEffect(() => {
    onOptionsChange?.(options);
  }, [onOptionsChange, options]);

  function upsertOption(next: ProjectScheduleStatusOptionRow) {
    setOptions((current) => {
      const withoutDuplicates = current.filter(
        (option) => option.id !== next.id && option.label !== next.label,
      );
      return [...withoutDuplicates, next].sort(sortOptions);
    });
  }

  function removeOption(id: string) {
    setOptions((current) => current.filter((option) => option.id !== id));
  }

  function createOption(label: string, color: string) {
    const trimmed = label.trim();
    if (!trimmed) return;

    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/project-schedule-status-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed, color }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "상태 저장에 실패했습니다.");
        return;
      }
      upsertOption(body.option);
      setNewLabel("");
      setNewColor(DEFAULT_COLOR);
    });
  }

  function updateOption(option: ProjectScheduleStatusOptionRow, body: Partial<ProjectScheduleStatusOptionRow>) {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/project-schedule-status-options/${option.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "상태 수정에 실패했습니다.");
        return;
      }
      upsertOption(result.option);
      if (body.label && body.label !== option.label) {
        onRowsChange?.();
      }
      setEditingId(null);
    });
  }

  function renameUnmanagedOption(option: ProjectScheduleStatusOptionRow, label: string, color: string) {
    const trimmed = label.trim();
    if (!trimmed) return;

    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/project-schedule-status-options", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromLabel: option.label, label: trimmed, color }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "상태 수정에 실패했습니다.");
        return;
      }
      removeOption(option.id);
      upsertOption(result.option);
      onRowsChange?.();
      setEditingId(null);
    });
  }

  function deleteOption(option: ProjectScheduleStatusOptionRow) {
    if (!window.confirm(`${option.label} 상태를 삭제할까요? 프로젝트에 저장된 상태 값은 유지됩니다.`)) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/project-schedule-status-options/${option.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "상태 삭제에 실패했습니다.");
        return;
      }
      removeOption(option.id);
    });
  }

  return (
    <div className="grid gap-3">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle className="text-xs">확인 필요</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="grid gap-2 rounded-lg border border-[#d8e0ea] bg-[#f8fafc] p-3 sm:grid-cols-[minmax(0,1fr)_96px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          createOption(newLabel, newColor);
        }}
      >
        <Input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="상태명 추가"
          className="h-8 border-[#d8e0ea] bg-white"
        />
        <Input
          type="color"
          value={newColor}
          onChange={(event) => setNewColor(event.target.value)}
          aria-label="새 상태 색상"
          className="h-8 border-[#d8e0ea] bg-white p-1"
        />
        <Button type="submit" size="sm" disabled={isPending || !newLabel.trim()}>
          <Plus className="size-3.5" />
          추가
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
        <div className="grid grid-cols-[minmax(180px,1fr)_86px_74px_116px] border-b border-[#edf1f6] bg-[#f3f6fa] px-3 py-2 text-[11px] font-extrabold text-[#5d6b80]">
          <span>상태</span>
          <span className="text-right">프로젝트</span>
          <span>사용</span>
          <span className="text-right">작업</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {sortedOptions.map((option) => {
            const editing = editingId === option.id;
            return (
              <div
                key={option.id}
                className="grid min-h-12 grid-cols-[minmax(180px,1fr)_86px_74px_116px] items-center gap-2 border-b border-[#edf1f6] px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  {editing ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-2">
                      <Input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} className="h-8" autoFocus />
                      <Input type="color" value={draftColor} onChange={(event) => setDraftColor(event.target.value)} aria-label="상태 색상" className="h-8 p-1" />
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: option.color }} />
                      <span className="inline-flex min-w-0 max-w-full items-center rounded-md border px-2 py-1 text-[11px] font-bold" style={statusBadgeStyle(option.color)}>
                        <span className="truncate">{option.label}</span>
                      </span>
                      {!option.isManaged ? (
                        <Badge variant="outline" className="text-[10px]">
                          데이터 값
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="text-right font-mono text-xs text-[#33415c]">{option.usageCount.toLocaleString()}</div>
                <div>{option.isActive ? <Badge variant="secondary">사용</Badge> : <Badge variant="outline">숨김</Badge>}</div>
                <div className="flex justify-end gap-1">
                  {editing ? (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        disabled={isPending || !draftLabel.trim()}
                        aria-label="저장"
                        onClick={() => {
                          if (option.isManaged) {
                            updateOption(option, { label: draftLabel, color: draftColor });
                            return;
                          }
                          renameUnmanagedOption(option, draftLabel, draftColor);
                        }}
                      >
                        <Save className="size-4" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="취소" onClick={() => setEditingId(null)}>
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : !option.isManaged ? (
                    <>
                      <Button type="button" size="icon-sm" variant="outline" disabled={isPending} aria-label="상태 등록" onClick={() => createOption(option.label, option.color)}>
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={isPending}
                        aria-label="데이터 값 수정"
                        onClick={() => {
                          setEditingId(option.id);
                          setDraftLabel(option.label);
                          setDraftColor(option.color);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={isPending}
                        aria-label="이름과 색상 수정"
                        onClick={() => {
                          setEditingId(option.id);
                          setDraftLabel(option.label);
                          setDraftColor(option.color);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" disabled={isPending} aria-label={option.isActive ? "숨김" : "사용"} onClick={() => updateOption(option, { isActive: !option.isActive })}>
                        {option.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                      <Button type="button" size="icon-sm" variant="destructive" disabled={isPending} aria-label="삭제" onClick={() => deleteOption(option)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function statusBadgeStyle(color: string) {
  return {
    backgroundColor: `${color}18`,
    borderColor: `${color}55`,
    color,
  };
}

function sortOptions(left: ProjectScheduleStatusOptionRow, right: ProjectScheduleStatusOptionRow) {
  return left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "ko");
}
