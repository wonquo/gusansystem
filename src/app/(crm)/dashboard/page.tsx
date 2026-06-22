import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { requireAppUser } from "@/lib/auth";
import { listBoardPosts } from "@/lib/board";
import { listCalendarEvents } from "@/lib/calendar";
import { listWorkDiaryRows } from "@/lib/work-diaries";
import type { BoardPostRow, CalendarEventRow, WorkDiaryRow } from "@/lib/types";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const EVENT_COLORS: Record<string, string> = {
  휴가: "bg-[#21ad73]",
  출장: "bg-[#2f70dc]",
  회의: "bg-[#2f70dc]",
  교육: "bg-[#f5b23f]",
  외근: "bg-[#21ad73]",
  기타: "bg-[#9aa8bc]",
};
const FALLBACK_EVENT_COLOR = "bg-[#9aa8bc]";

function getEventColorClass(category: string) {
  return EVENT_COLORS[category] ?? FALLBACK_EVENT_COLOR;
}

export default async function DashboardPage() {
  const user = await requireAppUser();
  const today = getKoreaDateValue();
  const monthStart = today.slice(0, 7);
  const workDiaryMonth = monthStart;
  const [boardPosts, calendarEvents, workDiaryRows] = await Promise.all([
    listBoardPosts(),
    listCalendarEvents(),
    listWorkDiaryRows({
      currentUserId: user.id,
      currentUserName: user.name,
      role: user.role,
      month: workDiaryMonth,
      targetUserId: user.id,
    }),
  ]);
  const monthCells = createMonthCells(monthStart);
  const selectedEvents = calendarEvents
    .filter((event) => event.startDate <= today && event.endDate >= today)
    .sort(compareCalendarEvents);
  const upcomingEvents = calendarEvents
    .filter((event) => event.endDate >= today)
    .sort(compareCalendarEvents);
  const agendaEvents = selectedEvents.length > 0 ? selectedEvents : upcomingEvents.slice(0, 3);
  const visibleNotices = boardPosts.filter((post) => post.category === "공지").slice(0, 5);
  const workDiaryStats = getWorkDiaryStats(workDiaryRows, workDiaryMonth, today);

  return (
    <main className="min-h-[calc(100vh-6rem)] bg-[#f6f7f9] py-2">
      <section className="grid w-full gap-3 xl:grid-cols-3">
        <DashboardCard className="min-h-[420px]">
          <div className="flex items-center justify-between border-b border-[#eceff3] pb-3">
            <h1 className="text-lg font-bold tracking-normal text-[#171b26]">공지사항</h1>
            <Link
              href="/board"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#747d8c] transition hover:text-[#1f6fff]"
            >
              전체보기
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="mt-4 space-y-4">
            {visibleNotices.length > 0 ? (
              visibleNotices.map((notice) => <NoticeListItem key={notice.id} notice={notice} />)
            ) : (
              <EmptyState
                title="등록된 공지 게시글이 없습니다"
                description="게시판에서 공지 카테고리 글을 작성하면 이곳에 표시됩니다."
              />
            )}
          </div>
        </DashboardCard>

        <DashboardCard className="min-h-[420px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-normal text-[#171b26]">캘린더</h2>
            <div className="flex items-center gap-3">
              <Link
                href="/calendar"
                className="whitespace-nowrap rounded-md border border-[#e4e9f0] px-3 py-1.5 text-xs font-bold text-[#373f4f] shadow-sm transition hover:border-[#cbd5e1] hover:bg-[#f8fafc]"
              >
                오늘
              </Link>
              <div className="flex items-center gap-3">
                <Link
                  href="/calendar"
                  className="text-[#4b5565] transition hover:text-[#1f6fff]"
                  aria-label="캘린더로 이동"
                >
                  <ChevronLeft className="size-4" />
                </Link>
                <p className="min-w-[96px] text-center text-base font-bold text-[#202838]">
                  {formatMonthTitle(monthStart)}
                </p>
                <Link
                  href="/calendar"
                  className="text-[#4b5565] transition hover:text-[#1f6fff]"
                  aria-label="캘린더로 이동"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 text-center text-xs font-bold text-[#545f70]">
            {DAY_LABELS.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {monthCells.map((cell) => (
              <CalendarDayCell
                key={cell.value}
                cell={cell}
                today={today}
                events={eventsForDate(calendarEvents, cell.value)}
              />
            ))}
          </div>

          <div className="mt-4 border-t border-[#edf0f4] pt-4">
            {agendaEvents.length > 0 ? (
              <div className="space-y-3">
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
                className="mt-4 block text-right text-xs font-semibold text-[#7a8494] transition hover:text-[#1f6fff]"
              >
                + {upcomingEvents.length - agendaEvents.length}건 더보기
              </Link>
            ) : null}
          </div>
        </DashboardCard>

        <DashboardCard className="min-h-[420px]">
          <div className="flex items-center justify-between border-b border-[#eceff3] pb-3">
            <h2 className="text-lg font-bold tracking-normal text-[#171b26]">업무일지</h2>
            <Link
              href="/work-diaries"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#747d8c] transition hover:text-[#1f6fff]"
            >
              작성하기
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="flex min-h-[316px] flex-col items-center justify-center">
            <DonutChart value={workDiaryStats.percent} />
            <p className="mt-5 text-sm font-bold text-[#202838]">
              {formatMonthTitle(workDiaryMonth)} 작성률
            </p>
            <p className="mt-1.5 text-xs font-medium text-[#7a8494]">
              업무일 {workDiaryStats.completedDays.toLocaleString("ko-KR")} /{" "}
              {workDiaryStats.businessDays.toLocaleString("ko-KR")}일 작성
            </p>
            <div className="mt-5 grid w-full grid-cols-2 gap-2">
              <WorkDiaryStat
                label="미작성"
                value={workDiaryStats.remainingDays}
                tooltipTitle="미작성 일자"
                tooltipDates={workDiaryStats.remainingDates}
              />
              <WorkDiaryStat label="오늘" value={workDiaryStats.isTodayWritten ? "작성" : "미작성"} />
            </div>
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
      className={`rounded-lg border border-[#eceff3] bg-white px-4 py-5 shadow-[0_10px_24px_rgba(28,39,64,0.07)] sm:px-5 ${className}`}
    >
      {children}
    </div>
  );
}

function NoticeListItem({ notice }: { notice: BoardPostRow }) {
  const badge = getNoticeBadge(notice);

  return (
    <Link
      href={`/board/${notice.id}`}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md transition hover:bg-[#f8fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6fff]"
    >
      <span
        className={`inline-flex h-7 min-w-11 items-center justify-center rounded-md border px-2 text-xs font-bold ${badge.className}`}
      >
        {badge.label}
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-[#202838]">{notice.title}</h3>
      </div>
      <time className="shrink-0 text-xs font-medium text-[#8a94a6]" dateTime={notice.createdAt}>
        {formatDotDate(notice.createdAt)}
      </time>
    </Link>
  );
}

function DonutChart({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const background = `conic-gradient(#1f6fff ${clamped * 3.6}deg, #edf1f6 0deg)`;

  return (
    <div
      className="grid size-36 place-items-center rounded-full shadow-[0_14px_28px_rgba(31,111,255,0.14)]"
      style={{ background }}
      aria-label={`업무일지 작성률 ${clamped}%`}
    >
      <div className="grid size-24 place-items-center rounded-full bg-white">
        <span className="text-2xl font-bold tracking-normal text-[#1f6fff]">{clamped}%</span>
      </div>
    </div>
  );
}

function WorkDiaryStat({
  label,
  value,
  tooltipTitle,
  tooltipDates,
}: {
  label: string;
  value: number | string;
  tooltipTitle?: string;
  tooltipDates?: string[];
}) {
  const hasTooltip = Boolean(tooltipDates?.length);

  return (
    <div
      className={[
        "group/stat relative rounded-lg border border-[#edf0f4] bg-[#f8fafc] px-3 py-2.5 text-center",
        hasTooltip ? "cursor-default outline-none focus-visible:ring-2 focus-visible:ring-[#2f70dc]/25" : "",
      ].join(" ")}
      tabIndex={hasTooltip ? 0 : undefined}
      aria-label={hasTooltip ? `${label} ${value}일, ${tooltipDates!.map(formatShortDateWithDay).join(", ")}` : undefined}
    >
      <p className="text-xs font-semibold text-[#7a8494]">{label}</p>
      <p className="mt-0.5 text-base font-bold text-[#202838]">
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </p>
      {hasTooltip ? (
        <div
          className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-64 -translate-x-1/2 rounded-lg border border-[#d9e2ee] bg-white px-3 py-2.5 text-left opacity-0 shadow-[0_18px_45px_rgba(15,28,48,0.16)] ring-1 ring-black/[0.02] transition duration-150 ease-out group-hover/stat:-translate-y-0.5 group-hover/stat:opacity-100 group-focus-visible/stat:-translate-y-0.5 group-focus-visible/stat:opacity-100"
          role="tooltip"
        >
          <p className="border-b border-[#eef2f7] pb-2 text-xs font-extrabold text-[#152033]">
            {tooltipTitle ?? label} · {tooltipDates!.length.toLocaleString("ko-KR")}일
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tooltipDates!.map((date) => (
              <span
                key={date}
                className="rounded-md bg-[#f3f6fb] px-2 py-1 text-[11px] font-bold text-[#42526b]"
              >
                {formatShortDateWithDay(date)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
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
  const day = new Date(`${cell.value}T00:00:00+09:00`).getDay();
  const isSunday = day === 0;
  const hasEvents = events.length > 0;
  const tooltipPosition =
    day === 0 ? "left-0" : day === 6 ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div
      className={[
        "group relative flex min-h-9 flex-col items-center justify-center gap-0.5 rounded-md outline-none",
        hasEvents ? "cursor-default focus-visible:ring-2 focus-visible:ring-[#2f70dc]/25" : "",
      ].join(" ")}
      tabIndex={hasEvents ? 0 : undefined}
      aria-label={hasEvents ? `${formatTooltipDate(cell.value)} 일정 ${events.length}건` : undefined}
    >
      <span
        className={[
          "grid size-8 place-items-center rounded-full text-xs font-semibold",
          isToday ? "bg-[#1f6fff] text-white shadow-[0_8px_18px_rgba(31,111,255,0.28)]" : "",
          !isToday && cell.isCurrentMonth ? "text-[#202838]" : "",
          !isToday && !cell.isCurrentMonth ? "text-[#c6ccd5]" : "",
          !isToday && isSunday && cell.isCurrentMonth ? "text-[#e2576a]" : "",
        ].join(" ")}
      >
        {Number(cell.value.slice(-2))}
      </span>
      <span className="flex h-1.5 items-center justify-center gap-0.5">
        {events.slice(0, 3).map((event) => (
          <span key={event.id} className={`size-1.5 rounded-full ${getEventColorClass(event.category)}`} />
        ))}
      </span>
      {hasEvents ? (
        <div
          className={[
            "pointer-events-none absolute bottom-[calc(100%+10px)] z-50 w-72 rounded-lg border border-[#d9e2ee] bg-white px-3 py-2.5 text-left opacity-0 shadow-[0_18px_45px_rgba(15,28,48,0.16)] ring-1 ring-black/[0.02] transition duration-150 ease-out group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100",
            tooltipPosition,
          ].join(" ")}
          role="tooltip"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#eef2f7] pb-2">
            <p className="truncate text-xs font-extrabold text-[#152033]">
              {formatTooltipDate(cell.value)} · 일정 {events.length}건
            </p>
            <span className="shrink-0 text-[10px] font-bold text-[#64748b]">{DAY_LABELS[day]}</span>
          </div>
          <div className="mt-2.5 grid gap-2">
            {events.slice(0, 4).map((event) => {
              const summary = formatTooltipSummary(event, cell.value);
              const meta = formatTooltipMeta(event, cell.value);

              return (
                <div key={event.id} className="flex min-w-0 items-center gap-1.5">
                  <span className={`size-2 shrink-0 rounded-full ${getEventColorClass(event.category)}`} />
                  <p className="min-w-0 truncate text-xs text-[#1f2937]" title={summary}>
                    <span className="font-bold">{event.title}</span>
                    {meta ? <span className="font-medium text-[#6b7585]"> · {meta}</span> : null}
                  </p>
                </div>
              );
            })}
          </div>
          {events.length > 4 ? (
            <div className="mt-2.5 rounded-md bg-[#f8fafc] px-2 py-1.5 text-center text-[11px] font-bold text-[#64748b]">
              + {events.length - 4}건 더보기
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AgendaItem({ event, today }: { event: CalendarEventRow; today: string }) {
  const timeLabel = event.allDay ? "" : event.startTime;

  return (
    <Link href="/calendar" className="grid grid-cols-[auto_auto_1fr] items-center gap-2">
      <span className={`size-2.5 rounded-full ${getEventColorClass(event.category)}`} />
      <time className="w-11 text-xs font-semibold text-[#8a94a6]">
        {event.startDate === today ? timeLabel : formatMonthDay(event.startDate)}
      </time>
      <span className="truncate text-xs font-semibold text-[#283142]">{event.title}</span>
    </Link>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-52 place-items-center text-center">
      <div>
        <p className="text-sm font-bold text-[#202838]">{title}</p>
        <p className="mt-1.5 text-xs text-[#7a8494]">{description}</p>
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

function getNoticeBadge(notice: BoardPostRow) {
  if (notice.title.includes("긴급")) {
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

function getWorkDiaryStats(rows: WorkDiaryRow[], month: string, today: string) {
  const businessDates = listBusinessDatesUntil(month, today);
  const completedDates = new Set(
    rows
      .filter((row) => businessDates.includes(row.workDate) && isWorkDiaryWritten(row))
      .map((row) => row.workDate),
  );
  const businessDays = businessDates.length;
  const completedDays = completedDates.size;
  const remainingDates = businessDates.filter((date) => !completedDates.has(date));
  const percent = businessDays === 0 ? 0 : Math.round((completedDays / businessDays) * 100);

  return {
    businessDays,
    completedDays,
    remainingDays: Math.max(0, businessDays - completedDays),
    remainingDates,
    percent,
    isTodayWritten: completedDates.has(today),
  };
}

function listBusinessDatesUntil(month: string, today: string) {
  return listDatesInMonth(month).filter((date) => date <= today && isBusinessDay(date));
}

function listDatesInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function isBusinessDay(value: string) {
  const day = new Date(`${value}T00:00:00+09:00`).getDay();
  return day !== 0 && day !== 6;
}

function isWorkDiaryWritten(row: WorkDiaryRow) {
  return Boolean(
    !row.isPlaceholder &&
      (row.primaryWork.trim() ||
        row.secondaryWork.trim() ||
        row.memo.trim() ||
        row.destinationId ||
        row.workTypeId),
  );
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

function formatShortDateWithDay(value: string) {
  const day = new Date(`${value}T00:00:00+09:00`).getDay();
  return `${formatMonthDay(value)}(${DAY_LABELS[day]})`;
}

function formatTooltipDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatTooltipTime(event: CalendarEventRow, dateValue: string) {
  const location = event.location ? ` · ${event.location}` : "";

  if (event.allDay) {
    return event.startDate === event.endDate ? event.location : `${formatEventSpan(event)}${location}`;
  }

  if (event.startDate < dateValue && event.endDate > dateValue) {
    return `진행중 · ${formatEventSpan(event)}${location}`;
  }

  if (event.startDate < dateValue) {
    return `종료 ${event.endTime}${location}`;
  }

  if (event.endDate > dateValue) {
    return `${event.startTime} 시작 · ${formatEventSpan(event)}${location}`;
  }

  return `${event.startTime} - ${event.endTime}${location}`;
}

function formatEventSpan(event: CalendarEventRow) {
  return `${formatMonthDay(event.startDate)} - ${formatMonthDay(event.endDate)}`;
}

function formatTooltipAttendees(event: CalendarEventRow) {
  const names = event.attendees.map((attendee) => attendee.name.trim()).filter(Boolean);
  const visibleNames = names.slice(0, 2).join(", ");
  const remainingCount = names.length - 2;

  return remainingCount > 0 ? `${visibleNames} 외 ${remainingCount}명` : visibleNames;
}

function formatTooltipMeta(event: CalendarEventRow, dateValue: string) {
  return [
    formatTooltipTime(event, dateValue),
    event.attendees.length > 0 ? formatTooltipAttendees(event) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatTooltipSummary(event: CalendarEventRow, dateValue: string) {
  return [
    event.category,
    event.title,
    formatTooltipTime(event, dateValue),
    event.attendees.length > 0 ? formatTooltipAttendees(event) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
