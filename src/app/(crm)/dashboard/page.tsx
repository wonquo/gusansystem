import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Megaphone,
  MessageCircle,
  Paperclip,
  Users,
} from "lucide-react";
import { listBoardPosts } from "@/lib/board";
import { listCalendarEvents } from "@/lib/calendar";
import type { BoardPostRow, CalendarEventCategory, CalendarEventRow } from "@/lib/types";

const CATEGORY_STYLES: Record<CalendarEventCategory, string> = {
  휴가: "border-emerald-200 bg-emerald-50 text-emerald-700",
  출장: "border-sky-200 bg-sky-50 text-sky-700",
  회의: "border-indigo-200 bg-indigo-50 text-indigo-700",
  교육: "border-amber-200 bg-amber-50 text-amber-700",
  외근: "border-rose-200 bg-rose-50 text-rose-700",
  기타: "border-slate-200 bg-slate-50 text-slate-700",
};

export default async function DashboardPage() {
  const [calendarEvents, boardPosts] = await Promise.all([listCalendarEvents(), listBoardPosts()]);
  const today = getKoreaDateValue();
  const importantEvents = calendarEvents
    .filter((event) => event.endDate >= today)
    .sort(compareCalendarEvents)
    .slice(0, 10);
  const latestNoticePosts = boardPosts.filter((post) => post.category === "공지").slice(0, 10);

  return (
    <main className="min-h-[calc(100vh-120px)] bg-[#f6f8fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-[#dfe6f0] bg-white px-5 py-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#58708f]">
                  Workspace Dashboard
                </p>
                <h1 className="mt-2 text-2xl font-bold text-[#0d1b3d] sm:text-3xl">
                  오늘 확인할 업무 흐름
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66748a]">
                  캘린더 일정과 최신 공지를 한 화면에서 빠르게 확인하세요.
                </p>
              </div>
              <div className="rounded-lg border border-[#e3eaf3] bg-[#f8fafc] px-4 py-3 text-right">
                <p className="text-xs font-medium text-[#66748a]">오늘</p>
                <p className="mt-1 text-lg font-bold text-[#0d1b3d]">{formatFullDate(today)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DashboardMetric
              icon={<CalendarDays className="size-5" />}
              label="주요일정"
              value={importantEvents.length}
              href="/calendar"
            />
            <DashboardMetric
              icon={<Megaphone className="size-5" />}
              label="공지게시글"
              value={latestNoticePosts.length}
              href="/board"
            />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="overflow-hidden rounded-lg border border-[#dfe6f0] bg-white shadow-sm">
            <SectionHeader
              eyebrow="Calendar"
              title="주요일정"
              description="오늘 이후 진행 예정인 캘린더 일정 10개"
              href="/calendar"
            />
            <div className="divide-y divide-[#edf1f6]">
              {importantEvents.length > 0 ? (
                importantEvents.map((event) => <CalendarEventItem key={event.id} event={event} />)
              ) : (
                <EmptyState
                  icon={<CalendarDays className="size-6" />}
                  title="예정된 일정이 없습니다"
                  description="캘린더에 일정을 추가하면 이곳에 표시됩니다."
                />
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#dfe6f0] bg-white shadow-sm">
            <SectionHeader
              eyebrow="Notice"
              title="최신 공지게시글"
              description="게시판 공지 카테고리 최신 기준 10개"
              href="/board"
            />
            <div className="divide-y divide-[#edf1f6]">
              {latestNoticePosts.length > 0 ? (
                latestNoticePosts.map((post) => <NoticePostItem key={post.id} post={post} />)
              ) : (
                <EmptyState
                  icon={<Megaphone className="size-6" />}
                  title="등록된 공지게시글이 없습니다"
                  description="게시판에 공지 카테고리 글을 작성하면 이곳에 표시됩니다."
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardMetric({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-[#dfe6f0] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#b9c7dc] hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-[#eef4ff] text-[#2f70dc]">
          {icon}
        </span>
        <ArrowRight className="size-4 text-[#9aa8bc] transition group-hover:translate-x-0.5 group-hover:text-[#2f70dc]" />
      </div>
      <p className="mt-4 text-sm font-medium text-[#66748a]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[#0d1b3d]">{value}</p>
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  href,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] px-5 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#58708f]">
          {eyebrow}
        </p>
        <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
          <h2 className="text-lg font-bold text-[#0d1b3d]">{title}</h2>
          <p className="text-xs text-[#66748a]">{description}</p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#d6dfeb] px-3 py-2 text-xs font-semibold text-[#274569] transition hover:border-[#aebdd0] hover:bg-[#f8fafc]"
      >
        전체보기
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function CalendarEventItem({ event }: { event: CalendarEventRow }) {
  const attendeeNames = event.attendees.map((attendee) => attendee.name).join(", ");

  return (
    <Link
      href="/calendar"
      className="grid gap-3 px-5 py-4 transition hover:bg-[#f8fbff] sm:grid-cols-[108px_1fr] sm:items-start"
    >
      <div className="flex items-center gap-3 sm:block">
        <div className="w-[76px] rounded-lg border border-[#dce5f0] bg-[#f8fafc] px-3 py-2 text-center">
          <p className="text-xs font-semibold text-[#58708f]">{formatMonth(event.startDate)}</p>
          <p className="mt-0.5 text-2xl font-bold leading-none text-[#0d1b3d]">
            {formatDay(event.startDate)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold sm:mt-2 ${
            CATEGORY_STYLES[event.category]
          }`}
        >
          {event.category}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-bold text-[#0d1b3d]">{event.title}</h3>
          {isMultiDay(event) ? (
            <span className="rounded-md bg-[#eef2f7] px-2 py-0.5 text-[11px] font-semibold text-[#526079]">
              연속 일정
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#66748a]">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            {formatEventSchedule(event)}
          </span>
          {event.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {event.location}
            </span>
          ) : null}
          {attendeeNames ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Users className="size-3.5 shrink-0" />
              <span className="truncate">{attendeeNames}</span>
            </span>
          ) : null}
        </div>
        {event.note ? <p className="mt-2 line-clamp-1 text-xs text-[#7a8799]">{event.note}</p> : null}
      </div>
    </Link>
  );
}

function NoticePostItem({ post }: { post: BoardPostRow }) {
  return (
    <Link href={`/board/${post.id}`} className="block px-5 py-4 transition hover:bg-[#f8fbff]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#2f70dc]">
              공지
            </span>
            {post.attachments.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#f4f7fb] px-2 py-0.5 text-[11px] font-semibold text-[#526079]">
                <Paperclip className="size-3" />
                {post.attachments.length.toLocaleString("ko-KR")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-bold text-[#0d1b3d]">{post.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#66748a]">
            {stripHtml(post.content) || "내용 없음"}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-[#7a8799]">
          <p>{formatShortDate(post.createdAt)}</p>
          <p className="mt-2 inline-flex items-center gap-1">
            <MessageCircle className="size-3.5" />
            {post.commentCount.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#8a96a8]">{post.authorName ?? "알 수 없음"}</p>
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-5 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-[#eef4ff] text-[#2f70dc]">
        {icon}
      </div>
      <p className="mt-4 text-sm font-bold text-[#0d1b3d]">{title}</p>
      <p className="mt-1 text-xs text-[#66748a]">{description}</p>
    </div>
  );
}

function compareCalendarEvents(a: CalendarEventRow, b: CalendarEventRow) {
  const dateCompare = a.startDate.localeCompare(b.startDate);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return a.startTime.localeCompare(b.startTime);
}

function formatEventSchedule(event: CalendarEventRow) {
  const dateLabel = isMultiDay(event)
    ? `${formatShortDate(event.startDate)} - ${formatShortDate(event.endDate)}`
    : formatFullDate(event.startDate);

  if (event.allDay) {
    return `${dateLabel} · 종일`;
  }

  return `${dateLabel} · ${event.startTime} - ${event.endTime}`;
}

function isMultiDay(event: CalendarEventRow) {
  return event.startDate !== event.endDate;
}

function getKoreaDateValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "short",
  }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    day: "2-digit",
  }).format(new Date(value));
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
