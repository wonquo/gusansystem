"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  BellRing,
  CalendarClock,
  MessageCircle,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { NoticeDetailRow, NoticeRow } from "@/lib/types";

type NoticeFormState = {
  title: string;
  content: string;
  isPinned: boolean;
  popupEnabled: boolean;
  popupStartsAt: string;
  popupEndsAt: string;
};

const emptyForm: NoticeFormState = {
  title: "",
  content: "",
  isPinned: false,
  popupEnabled: false,
  popupStartsAt: "",
  popupEndsAt: "",
};

export function NoticeBoard({
  initialNotices,
  canManage,
}: {
  initialNotices: NoticeRow[];
  canManage: boolean;
}) {
  const [notices, setNotices] = useState(initialNotices);
  const [selected, setSelected] = useState<NoticeDetailRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NoticeFormState>(emptyForm);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const popupCount = useMemo(
    () => notices.filter((notice) => notice.popupEnabled).length,
    [notices],
  );

  function openCreateEditor() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setIsEditorOpen(true);
  }

  function openEditEditor(notice: NoticeRow) {
    setEditingId(notice.id);
    setForm({
      title: notice.title,
      content: notice.content,
      isPinned: notice.isPinned,
      popupEnabled: notice.popupEnabled,
      popupStartsAt: toDatetimeLocal(notice.popupStartsAt),
      popupEndsAt: toDatetimeLocal(notice.popupEndsAt),
    });
    setError(null);
    setIsEditorOpen(true);
  }

  function openDetail(notice: NoticeRow) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/notices/${notice.id}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "공지사항을 불러오지 못했습니다.");
        return;
      }

      setSelected(data.notice);
      setComment("");
      setIsDetailOpen(true);
    });
  }

  function saveNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch(editingId ? `/api/notices/${editingId}` : "/api/notices", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          isPinned: form.isPinned,
          popupEnabled: form.popupEnabled,
          popupStartsAt: toIsoString(form.popupStartsAt),
          popupEndsAt: toIsoString(form.popupEndsAt),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "공지사항을 저장하지 못했습니다.");
        return;
      }

      const saved = stripComments(data.notice);
      setNotices((current) =>
        sortNotices(editingId ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current]),
      );
      if (selected?.id === saved.id) {
        setSelected(data.notice);
      }
      setIsEditorOpen(false);
    });
  }

  function removeNotice(notice: NoticeRow) {
    if (!window.confirm("이 공지사항을 삭제할까요? 댓글도 함께 삭제됩니다.")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/notices/${notice.id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "공지사항을 삭제하지 못했습니다.");
        return;
      }

      setNotices((current) => current.filter((item) => item.id !== notice.id));
      if (selected?.id === notice.id) {
        setSelected(null);
        setIsDetailOpen(false);
      }
    });
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/notices/${selected.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "댓글을 저장하지 못했습니다.");
        return;
      }

      setSelected((current) =>
        current
          ? {
              ...current,
              comments: [data.comment, ...current.comments],
              commentCount: current.commentCount + 1,
            }
          : current,
      );
      setNotices((current) =>
        current.map((item) =>
          item.id === selected.id ? { ...item, commentCount: item.commentCount + 1 } : item,
        ),
      );
      setComment("");
    });
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#0d1b3d]">공지사항</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 rounded border-[#d8e0ea] bg-white px-3 text-[#22304f]">
            팝업 {popupCount.toLocaleString()}건
          </Badge>
          {canManage ? (
            <Button onClick={openCreateEditor} className="bg-[#1f6fff] text-white hover:bg-[#195ed8]">
              <Plus className="size-4" />
              공지 작성
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[#dbe3ee] bg-white shadow-[0_10px_34px_rgba(20,35,65,0.06)]">
        {notices.length === 0 ? (
          <div className="grid min-h-64 place-items-center px-4 text-center">
            <div>
              <BellRing className="mx-auto size-9 text-[#94a3b8]" />
              <p className="mt-3 text-base font-semibold text-[#0d1b3d]">등록된 공지사항이 없습니다</p>
              <p className="mt-1 text-sm text-[#66748a]">새 공지를 작성하면 이곳에 표시됩니다.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#edf2f7]">
            {notices.map((notice) => (
              <article
                key={notice.id}
                className="grid gap-3 px-4 py-4 transition-colors hover:bg-[#f8fbff] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5"
              >
                <button
                  type="button"
                  onClick={() => openDetail(notice)}
                  className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6fff]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {notice.isPinned ? (
                      <Badge className="rounded bg-[#1f6fff] text-white">
                        <Pin className="size-3" />
                        고정
                      </Badge>
                    ) : null}
                    {notice.popupEnabled ? (
                      <Badge variant="outline" className="rounded border-[#f6c453] bg-[#fffbeb] text-[#9a6a00]">
                        <BellRing className="size-3" />
                        팝업
                      </Badge>
                    ) : null}
                    <span className="text-xs font-medium text-[#7a869b]">
                      {notice.authorName ?? "알 수 없음"} · {formatDate(notice.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-2 truncate text-base font-bold text-[#0d1b3d]">{notice.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#526079]">{notice.content}</p>
                </button>
                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#526079]">
                    <MessageCircle className="size-4" />
                    {notice.commentCount.toLocaleString()}
                  </span>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="공지 수정"
                        onClick={() => openEditEditor(notice)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="공지 삭제"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => removeNotice(notice)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={saveNotice} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingId ? "공지 수정" : "공지 작성"}</DialogTitle>
              <DialogDescription>
                팝업을 켜면 지정한 기간 동안 CRM 화면 진입 시 공지가 표시됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="notice-title">제목</Label>
                <Input
                  id="notice-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="notice-content">내용</Label>
                <Textarea
                  id="notice-content"
                  className="min-h-40"
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-3 rounded-lg border border-[#dbe4ef] bg-[#f8fbff] p-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#22304f]">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#1f6fff]"
                    checked={form.isPinned}
                    onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))}
                  />
                  상단 고정
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#22304f]">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#1f6fff]"
                    checked={form.popupEnabled}
                    onChange={(event) => setForm((current) => ({ ...current, popupEnabled: event.target.checked }))}
                  />
                  팝업으로 표시
                </label>
                <div className="grid gap-1.5">
                  <Label htmlFor="popup-start">팝업 시작</Label>
                  <Input
                    id="popup-start"
                    type="datetime-local"
                    value={form.popupStartsAt}
                    onChange={(event) => setForm((current) => ({ ...current, popupStartsAt: event.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="popup-end">팝업 종료</Label>
                  <Input
                    id="popup-end"
                    type="datetime-local"
                    value={form.popupEndsAt}
                    onChange={(event) => setForm((current) => ({ ...current, popupEndsAt: event.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditorOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "저장 중" : "저장"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-3xl">
          {selected ? (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.isPinned ? <Badge className="rounded bg-[#1f6fff] text-white">고정</Badge> : null}
                  {selected.popupEnabled ? (
                    <Badge variant="outline" className="rounded border-[#f6c453] bg-[#fffbeb] text-[#9a6a00]">
                      팝업
                    </Badge>
                  ) : null}
                  <span className="text-xs font-medium text-[#7a869b]">
                    {selected.authorName ?? "알 수 없음"} · {formatDate(selected.createdAt)}
                  </span>
                </div>
                <DialogTitle className="text-xl leading-7">{selected.title}</DialogTitle>
                {selected.popupEnabled ? (
                  <DialogDescription className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    {formatPopupRange(selected.popupStartsAt, selected.popupEndsAt)}
                  </DialogDescription>
                ) : null}
              </DialogHeader>
              <div className="whitespace-pre-wrap rounded-lg border border-[#dbe4ef] bg-[#f8fbff] p-4 text-sm leading-7 text-[#22304f]">
                {selected.content}
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0d1b3d]">댓글 {selected.commentCount.toLocaleString()}</h3>
                </div>
                <form onSubmit={submitComment} className="grid gap-2">
                  <Textarea
                    className="min-h-20"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="댓글을 입력하세요"
                    required
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isPending || comment.trim().length === 0}>
                      댓글 등록
                    </Button>
                  </div>
                </form>
                <div className="space-y-2">
                  {selected.comments.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#dbe4ef] px-4 py-6 text-center text-sm text-[#66748a]">
                      아직 댓글이 없습니다.
                    </div>
                  ) : (
                    selected.comments.map((item) => (
                      <div key={item.id} className="rounded-md border border-[#edf2f7] bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a869b]">
                          <span className="font-bold text-[#22304f]">{item.authorName ?? "알 수 없음"}</span>
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#22304f]">{item.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function stripComments(notice: NoticeDetailRow): NoticeRow {
  const { comments, ...row } = notice;
  void comments;

  return row;
}

function sortNotices(items: NoticeRow[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function toIsoString(value: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPopupRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) {
    return "기간 제한 없음";
  }

  return `${startsAt ? formatDate(startsAt) : "즉시"} - ${endsAt ? formatDate(endsAt) : "종료일 없음"}`;
}
