import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { listCalendarEvents } from "@/lib/calendar";
import { listNotices } from "@/lib/notices";
import type { CalendarEventCategory, CalendarEventRow, NoticeRow } from "@/lib/types";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const EVENT_COLORS: Record<CalendarEventCategory, string> = {
  휴가: "bg-[#21ad73]",
  출장: "bg-[#2f70dc]",
  회의: "bg-[#2f70dc]",
  교육: "bg-[#f5b23f]",
  외근: "bg-[#21ad73]",
  기타: "bg-[#9aa8bc]",
};

export default async function DashboardPage() {
  const [notices, calendarEvents] = await Promise.all([listNotices(), listCalendarEvents()]);
  const today = getKoreaDateValue();
  const monthStart = today.slice(0, 7);
  const monthCells = createMonthCells(monthStart);
  const selectedEvents = calendarEvents
    .filter((event) => event.startDate <= today && event.endDate >= today)
    .sort(compareCalendarEvents);
  const upcomingEvents = calendarEvents
    .filter((event) => event.endDate >= today)
    .sort(compareCalendarEvents);
  const agendaEvents = selectedEvents.length > 0 ? selectedEvents : upcomingEvents.slice(0, 3);
  const visibleNotices = notices.slice(0, 5);

  return (
    <main className="min-h-[calc(100vh-6rem)] bg-[#f6f7f9] px-2 py-4 sm:px-4 lg:px-6">
      <section className="mx-auto grid max-w-[1180px] gap-5 xl:grid-cols-2">
        <DashboardCard className="min-h-[510px]">
          <div className="flex items-center justify-between border-b border-[#eceff3] pb-5">
            <h1 className="text-xl font-bold tracking-normal text-[#171b26]">공지사항</h1>
            <Link
              href="/notices"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#747d8c] transition hover:text-[#1f6fff]"
            >
              전체보기
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="mt-6 space-y-5">
            {visibleNotices.length > 0 ? (
              visibleNotices.map((notice) => <NoticeListItem key={notice.id} notice={notice} />)
            ) : (
              <EmptyState
                title="등록된 공지사항이 없습니다"
                description="새 공지를 작성하면 이곳에 표시됩니다."
              />
            )}
          </div>
        </DashboardCard>

        <DashboardCard className="min-h-[510px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-normal text-[#171b26]">캘린더</h2>
            <div className="flex items-center gap-5">
              <Link
                href="/calendar"
                className="rounded-md border border-[#e4e9f0] px-4 py-2 text-sm font-bold text-[#373f4f] shadow-sm transition hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
              >
                오늘
              </Link>
              <div className="flex items-center gap-5">
                <Link
                  href="/calendar"
                  className="text-[#4b5565] transition hover:text-[#1f6fff]"
                  aria-label="캘린더로 이동"
                >
                  <ChevronLeft className="size-5" />
                </Link>
                <p className="min-w-[112px] text-center text-lg font-bold text-[#202838]">
                  {formatMonthTitle(monthStart)}
                </p>
                <Link
                  href="/calendar"
                  className="text-[#4b5565] transition hover:text-[#1f6fff]"
                  aria-label="캘린더로 이동"
                >
                  <ChevronRight className="size-5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 text-center text-sm font-bold text-[#545f70]">
            {DAY_LABELS.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center">
            {monthCells.map((cell) => (
              <CalendarDayCell
                key={cell.value}
                cell={cell}
                today={today}
                events={eventsForDate(calendarEvents, cell.value)}
              />
            ))}
          </div>

          <div className="mt-6 border-t border-[#edf0f4] pt-5">
            {agendaEvents.length > 0 ? (
              <div className="space-y-4">
                {agendaEvents.map((event) => <AgendaItem key={event.id} event={event} today={today} />)}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-[#7a8494]">
                <CalendarDays className="size-4" />
                예정된 일정이 없습니다.
              </div>
            )}
            {upcomingEvents.length > agendaEvents.length ? (
              <Link
                href="/calendar"
                className="mt-5 block text-right text-sm font-semibold text-[#7a8494] transition hover:text-[#1f6fff]"
              >
                + {upcomingEvents.length - agendaEvents.length}건 더보기
              </Link>
            ) : null}
          </div>
        </DashboardCard>
      </section>
    </main>
  );
}

function DashboardCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[#eceff3] bg-white px-6 py-7 shadow-[0_14px_34px_rgba(28,39,64,0.08)] sm:px-8 ${className}`}
    >
      {children}
    </div>
  );
}

function NoticeListItem({ notice }: { notice: NoticeRow }) {
  const badge = getNoticeBadge(notice);

  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
      <span
        className={`inline-flex h-8 min-w-12 items-center justify-center rounded-md border px-2 text-sm font-bold ${badge.className}`}
      >
        {badge.label}
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-[#202838]">{notice.title}</h3>
      </div>
      <time className="text-xs font-medium text-[#8a94a6]" dateTime={notice.createdAt}>
        {formatDotDate(notice.createdAt)}
      </time>
    </article>
  );
}

function CalendarDayCell({
  cell,
  today,
  events,
}: {
  cell: MonthCell;
  today: string;
  events: CalendarEventRow[];
}) {
  const isToday = cell.value === today;
  const isSunday = new Date(`${cell.value}T00:00:00+09:00`).getDay() === 0;

  return (
    <div className="flex min-h-11 flex-col items-center justify-center gap-1">
      <span
        className={[
          "grid size-9 place-items-center rounded-full text-sm font-semibold",
          isToday ? "bg-[#1f6fff] text-white shadow-[0_8px_18px_rgba(31,111,255,0.28)]" : "",
          !isToday && cell.isCurrentMonth ? "text-[#202838]" : "",
          !isToday && !cell.isCurrentMonth ? "text-[#c6ccd5]" : "",
          !isToday && isSunday && cell.isCurrentMonth ? "text-[#e2576a]" : "",
        ].join(" ")}
      >
        {Number(cell.value.slice(-2))}
      </span>
      <span className="flex h-1.5 items-center justify-center gap-1">
        {events.slice(0, 3).map((event) => (
          <span key={event.id} className={`size-1.5 rounded-full ${EVENT_COLORS[event.category]}`} />
        ))}
      </span>
    </div>
  );
}

function AgendaItem({ event, today }: { event: CalendarEventRow; today: string }) {
  const timeLabel = event.allDay ? "종일" : event.startTime;

  return (
    <Link href="/calendar" className="grid grid-cols-[auto_auto_1fr] items-center gap-3">
      <span className={`size-2.5 rounded-full ${EVENT_COLORS[event.category]}`} />
      <time className="w-12 text-sm font-semibold text-[#8a94a6]">
        {event.startDate === today ? timeLabel : formatMonthDay(event.startDate)}
      </time>
      <span className="truncate text-sm font-semibold text-[#283142]">{event.title}</span>
    </Link>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-64 place-items-center text-center">
      <div>
        <p className="text-base font-bold text-[#202838]">{title}</p>
        <p className="mt-2 text-sm text-[#7a8494]">{description}</p>
      </div>
    </div>
  );
}

type MonthCell = {
  value: string;
  isCurrentMonth: boolean;
};

function createMonthCells(monthValue: string): MonthCell[] {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const cells: MonthCell[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const value = toDateValue(cursor);
    cells.push({
      value,
      isCurrentMonth: value.startsWith(monthValue),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

function eventsForDate(events: CalendarEventRow[], dateValue: string) {
  return events.filter((event) => event.startDate <= dateValue && event.endDate >= dateValue);
}

function compareCalendarEvents(a: CalendarEventRow, b: CalendarEventRow) {
  const dateCompare = a.startDate.localeCompare(b.startDate);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return a.startTime.localeCompare(b.startTime);
}

function getNoticeBadge(notice: NoticeRow) {
  if (notice.isPinned || notice.popupEnabled) {
    return {
      label: "긴급",
      className: "border-[#ffccd4] bg-[#ff5c6c] text-white",
    };
  }

  return {
    label: "공지",
    className: "border-[#bcd4f9] bg-white text-[#2f70dc]",
  };
}

function getKoreaDateValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonthTitle(value: string) {
  const [year, month] = value.split("-");

  return `${year}년 ${Number(month)}월`;
}

function formatDotDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

function formatMonthDay(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}
