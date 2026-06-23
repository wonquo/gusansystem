"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronLeft, ChevronRight } from "lucide-react";
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
import type { NoticeRow } from "@/lib/types";

const DISMISSED_KEY = "crm_notice_popup_dismissed";
const DISMISSED_TODAY_KEY = "crm_notice_popup_dismissed_today";

export function NoticePopup() {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadPopups() {
      if (readTodayDismissed() === getKstDateKey()) {
        return;
      }

      const response = await fetch("/api/notices/popups");
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const dismissed = readDismissed();
      const visible = (data.notices as NoticeRow[]).filter(
        (notice) => dismissed[notice.id] !== notice.updatedAt,
      );

      if (!ignore && visible.length > 0) {
        setNotices(visible);
        setIndex(0);
        setIsOpen(true);
      }
    }

    loadPopups();

    return () => {
      ignore = true;
    };
  }, []);

  const current = notices[index] ?? null;
  const hasMultiple = notices.length > 1;
  const rangeText = useMemo(() => {
    if (!current) {
      return "";
    }

    if (!current.popupEndsAt) {
      return "종료일 없음";
    }

    return `${formatDate(current.popupEndsAt)}까지`;
  }, [current]);

  function dismissCurrent() {
    if (!current) {
      setIsOpen(false);
      return;
    }

    writeDismissed(current);
    const nextNotices = notices.filter((notice) => notice.id !== current.id);
    if (nextNotices.length === 0) {
      setIsOpen(false);
      setNotices([]);
      setIndex(0);
      return;
    }

    setNotices(nextNotices);
    setIndex((currentIndex) => Math.min(currentIndex, nextNotices.length - 1));
  }

  function dismissAll() {
    notices.forEach(writeDismissed);
    setIsOpen(false);
    setNotices([]);
    setIndex(0);
  }

  function dismissToday() {
    writeTodayDismissed();
    setIsOpen(false);
    setNotices([]);
    setIndex(0);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        {current ? (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded bg-[#1f6fff] text-white">
                  <BellRing className="size-3" />
                  공지 팝업
                </Badge>
                <span className="text-xs font-medium text-[#7a869b]">{rangeText}</span>
              </div>
              <DialogTitle className="text-xl leading-7">{current.title}</DialogTitle>
              <DialogDescription>
                {current.authorName ?? "관리자"} · {formatDate(current.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <Link
              href={`/notices/${current.id}`}
              onClick={() => setIsOpen(false)}
              className="block max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#dbe4ef] bg-[#f8fbff] p-4 text-sm leading-7 text-[#22304f] transition hover:border-[#9dbcf0] hover:bg-[#f3f8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6fff]"
            >
              {current.content}
            </Link>
            <DialogFooter className="items-center sm:justify-between">
              <div className="flex items-center gap-1">
                {hasMultiple ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="이전 공지"
                      onClick={() => setIndex((value) => Math.max(0, value - 1))}
                      disabled={index === 0}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 text-xs font-semibold text-[#66748a]">
                      {index + 1} / {notices.length}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="다음 공지"
                      onClick={() => setIndex((value) => Math.min(notices.length - 1, value + 1))}
                      disabled={index === notices.length - 1}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button asChild className="bg-[#1f6fff] text-white hover:bg-[#195ed8]">
                  <Link href={`/notices/${current.id}`} onClick={() => setIsOpen(false)}>
                    공지 조회
                  </Link>
                </Button>
                <Button type="button" variant="outline" onClick={dismissCurrent}>
                  이 공지 닫기
                </Button>
                <Button type="button" variant="outline" onClick={dismissAll}>
                  모두 닫기
                </Button>
                <Button type="button" variant="outline" onClick={dismissToday}>
                  오늘 보지 않기
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function readDismissed() {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeDismissed(notice: NoticeRow) {
  const dismissed = readDismissed();
  dismissed[notice.id] = notice.updatedAt;
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
}

function readTodayDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_TODAY_KEY);
  } catch {
    return null;
  }
}

function writeTodayDismissed() {
  window.localStorage.setItem(DISMISSED_TODAY_KEY, getKstDateKey());
}

function formatDate(value: string) {
  return getKstDateKey(new Date(value));
}

function getKstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}
