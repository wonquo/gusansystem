"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CalendarAttendeeOption } from "@/lib/calendar";
import type {
  CalendarEventAttendee,
  CalendarEventCategory,
  CalendarEventRow,
} from "@/lib/types";

const CATEGORIES: CalendarEventCategory[] = ["휴가", "출장", "회의", "교육", "외근", "기타"];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1}월`,
  value: index,
}));

type CalendarForm = {
  title: string;
  category: CalendarEventCategory;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  note: string;
  attendees: CalendarEventAttendee[];
};

const categoryStyles: Record<
  CalendarEventCategory,
  { pill: string; checkbox: string }
> = {
  휴가: {
    pill: "bg-rose-50 text-rose-700 ring-rose-100",
    checkbox: "bg-rose-500",
  },
  출장: {
    pill: "bg-blue-50 text-blue-700 ring-blue-100",
    checkbox: "bg-blue-500",
  },
  회의: {
    pill: "bg-violet-50 text-violet-700 ring-violet-100",
    checkbox: "bg-violet-500",
  },
  교육: {
    pill: "bg-amber-50 text-amber-700 ring-amber-100",
    checkbox: "bg-amber-500",
  },
  외근: {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    checkbox: "bg-emerald-500",
  },
  기타: {
    pill: "bg-slate-50 text-slate-700 ring-slate-100",
    checkbox: "bg-slate-500",
  },
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatShortMonth(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateRangeLabel(startDate: string, endDate: string) {
  if (!startDate && !endDate) {
    return formatDateLabel(todayValue);
  }

  const safeStartDate = startDate || endDate || todayValue;
  const safeEndDate = endDate || safeStartDate;

  return safeStartDate === safeEndDate
    ? formatDateLabel(safeStartDate)
    : `${formatDateLabel(safeStartDate)} - ${formatDateLabel(safeEndDate)}`;
}

const todayValue = toDateInputValue(new Date());

function createEmptyForm(date = todayValue): CalendarForm {
  return {
    title: "",
    category: "회의",
    startDate: date,
    endDate: date,
    allDay: true,
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    note: "",
    attendees: [],
  };
}

function createFormFromEvent(event: CalendarEventRow): CalendarForm {
  return {
    title: event.title,
    category: event.category,
    startDate: event.startDate || event.eventDate,
    endDate: event.endDate || event.startDate || event.eventDate,
    allDay: event.allDay,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? "",
    note: event.note ?? "",
    attendees: event.attendees ?? [],
  };
}

function addDays(dateValue: string, offset: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toDateInputValue(date);
}

function enumerateEventDates(event: CalendarEventRow) {
  const startDate = event.startDate || event.eventDate;
  const endDate = event.endDate || startDate;
  const dates: string[] = [];

  for (let dateValue = startDate; dateValue <= endDate; dateValue = addDays(dateValue, 1)) {
    dates.push(dateValue);
  }

  return dates;
}

function getEventCalendarLabel(event: CalendarEventRow) {
  const attendeeNames = event.attendees
    .map((attendee) => attendee.name.trim())
    .filter(Boolean)
    .join(", ");

  return [attendeeNames, event.title.trim()].filter(Boolean).join(" ");
}

function getEventSpanPosition(event: CalendarEventRow, dateValue: string) {
  const startDate = event.startDate || event.eventDate;
  const endDate = event.endDate || startDate;

  if (startDate === endDate) {
    return "single";
  }

  const day = new Date(`${dateValue}T00:00:00`).getDay();
  const isActualStart = dateValue === startDate;
  const isActualEnd = dateValue === endDate;
  const isWeekStart = day === 0;
  const isWeekEnd = day === 6;

  if ((isActualStart || isWeekStart) && (isActualEnd || isWeekEnd)) {
    return "single";
  }

  if (isActualStart || isWeekStart) {
    return "start";
  }

  if (isActualEnd || isWeekEnd) {
    return "end";
  }

  return "middle";
}

export function CompanyCalendar({
  attendeeOptions,
  initialEvents,
}: {
  attendeeOptions: CalendarAttendeeOption[];
  initialEvents: CalendarEventRow[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<CalendarForm>(() => createEmptyForm());
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [visibleCategories, setVisibleCategories] = useState<CalendarEventCategory[]>(CATEGORIES);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const miniMonthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const visibleCategorySet = useMemo(() => new Set(visibleCategories), [visibleCategories]);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEventRow[]>>((grouped, event) => {
      if (!visibleCategorySet.has(event.category)) {
        return grouped;
      }

      for (const dateValue of enumerateEventDates(event)) {
        grouped[dateValue] = [...(grouped[dateValue] ?? []), event].sort((a, b) => {
          if (a.allDay !== b.allDay) {
            return a.allDay ? -1 : 1;
          }

          return `${a.startTime}${a.title}`.localeCompare(`${b.startTime}${b.title}`);
        });
      }

      return grouped;
    }, {});
  }, [events, visibleCategorySet]);

  const filteredAttendeeOptions = useMemo(() => {
    const selectedIds = new Set((form.attendees ?? []).map((attendee) => attendee.id));
    const query = attendeeQuery.trim().toLowerCase();

    return attendeeOptions
      .filter((attendee) => {
        if (selectedIds.has(attendee.id)) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [attendee.name, attendee.email ?? "", attendee.loginId]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 8);
  }, [attendeeOptions, attendeeQuery, form.attendees]);

  function changeMonth(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function changeYear(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear() + offset, current.getMonth(), 1),
    );
  }

  function selectMonth(month: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), month, 1));
  }

  function toggleCategory(category: CalendarEventCategory) {
    setVisibleCategories((current) =>
      current.includes(category)
        ? current.filter((selected) => selected !== category)
        : [...current, category],
    );
  }

  function toggleAllCategories() {
    setVisibleCategories((current) => (current.length === CATEGORIES.length ? [] : CATEGORIES));
  }

  function openEventForm(dateValue: string) {
    setSelectedDate(dateValue);
    setEditingEventId(null);
    setForm((current) => ({
      ...createEmptyForm(dateValue),
      category: current.category,
    }));
    setAttendeeQuery("");
    setError(null);
    setIsFormOpen(true);
  }

  function openEventEditor(event: CalendarEventRow) {
    setSelectedDate(event.startDate || event.eventDate);
    setEditingEventId(event.id);
    setForm(createFormFromEvent(event));
    setAttendeeQuery("");
    setError(null);
    setIsFormOpen(true);
  }

  function handleFormOpenChange(open: boolean) {
    setIsFormOpen(open);

    if (!open) {
      setEditingEventId(null);
      setAttendeeQuery("");
      setError(null);
    }
  }

  function addAttendee(attendee: CalendarAttendeeOption) {
    setForm((current) => {
      if ((current.attendees ?? []).some((selected) => selected.id === attendee.id)) {
        return current;
      }

      return {
        ...current,
        attendees: [
          ...(current.attendees ?? []),
          { id: attendee.id, name: attendee.name, email: attendee.email },
        ],
      };
    });
    setAttendeeQuery("");
  }

  function removeAttendee(attendeeId: string) {
    setForm((current) => ({
      ...current,
      attendees: (current.attendees ?? []).filter((attendee) => attendee.id !== attendeeId),
    }));
  }

  function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload = {
        ...form,
        startDate: form.startDate || todayValue,
        endDate: form.endDate || form.startDate || todayValue,
        allDay: form.allDay ?? true,
        attendees: form.attendees ?? [],
      };

      const response = await fetch("/api/calendar-events", {
        method: editingEventId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEventId ? { ...payload, id: editingEventId } : payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "일정을 등록하지 못했습니다.");
        return;
      }

      setEvents((current) => {
        const nextEvents = editingEventId
          ? current.map((event) => (event.id === editingEventId ? data.event : event))
          : [...current, data.event];

        return nextEvents.sort((a, b) =>
          `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`),
        );
      });
      setSelectedDate(data.event.startDate);
      setForm((current) => ({
        ...createEmptyForm(current.startDate),
        category: current.category,
      }));
      setEditingEventId(null);
      setAttendeeQuery("");
      setIsFormOpen(false);
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-[#e1e8f2] bg-white shadow-[0_14px_45px_rgba(15,28,48,0.06)] lg:h-[calc(100vh-5.25rem)] lg:min-h-[620px]">
        <div className="grid h-full min-h-[620px] lg:grid-cols-[minmax(0,1fr)_240px] 2xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="flex min-w-0 flex-col px-4 py-4 md:px-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold text-[#111827] md:text-2xl">
                {formatMonth(visibleMonth)}
                <ChevronDown className="size-4 shrink-0 text-[#7b8798]" />
              </h1>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <div className="flex items-center rounded-md border border-[#c9d8ef] bg-[#f8fbff] shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-r-none border-r border-[#dbe6f7] text-[#2f70dc] hover:bg-[#eef5ff] hover:text-[#1d5fc2]"
                    aria-label="이전 달"
                    onClick={() => changeMonth(-1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-l-none text-[#2f70dc] hover:bg-[#eef5ff] hover:text-[#1d5fc2]"
                    aria-label="다음 달"
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="h-8 rounded-md border-[#c9d8ef] bg-[#f8fbff] px-3 text-sm font-semibold text-[#2363c7] shadow-sm hover:bg-[#eef5ff] hover:text-[#184fa3]"
                  onClick={() => {
                    const current = new Date();
                    setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1));
                    setSelectedDate(todayValue);
                  }}
                >
                  오늘
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 gap-1 rounded-md border-[#c9d8ef] bg-[#f8fbff] px-3 text-sm font-semibold text-[#2363c7] shadow-sm hover:bg-[#eef5ff] hover:text-[#184fa3]"
                    >
                      {visibleMonth.getMonth() + 1}월
                      <ChevronDown className="size-4 text-[#6b8fd0]" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 p-2">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-[#2f70dc] hover:bg-[#eef5ff]"
                        aria-label="이전 연도"
                        onClick={() => changeYear(-1)}
                        type="button"
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <span className="text-sm font-bold text-[#111827]">
                        {visibleMonth.getFullYear()}년
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-[#2f70dc] hover:bg-[#eef5ff]"
                        aria-label="다음 연도"
                        onClick={() => changeYear(1)}
                        type="button"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {MONTH_OPTIONS.map((month) => (
                        <DropdownMenuItem
                          className={cn(
                            "justify-center rounded-md px-2 py-2 text-sm font-semibold",
                            visibleMonth.getMonth() === month.value
                              ? "bg-[#2f70dc] text-white focus:bg-[#2f70dc] focus:text-white"
                              : "text-[#3f4654] focus:bg-[#eef5ff] focus:text-[#184fa3]",
                          )}
                          key={month.value}
                          onSelect={() => selectMonth(month.value)}
                        >
                          {month.label}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-md border-[#c9d8ef] bg-[#f8fbff] text-[#2f70dc] shadow-sm hover:bg-[#eef5ff] hover:text-[#1d5fc2]"
                  aria-label="목록 보기"
                >
                  <ListFilter className="size-4" />
                </Button>
                <Button
                  className="h-8 gap-2 rounded-md bg-[#2f70dc] px-3 font-semibold text-white shadow-sm hover:bg-[#1d5fc2]"
                  onClick={() => openEventForm(todayValue)}
                >
                  <Plus className="size-4" />
                  일정 추가
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[40px_repeat(6,minmax(72px,1fr))] overflow-hidden border-t border-l border-[#eef1f5]">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div
                  className="grid place-items-center border-r border-b border-[#eef1f5] text-xs font-semibold text-[#757d8a] md:text-sm"
                  key={day}
                >
                  {day}
                </div>
              ))}

              {monthCells.map((cell) => {
                const dayEvents = eventsByDate[cell.dateValue] ?? [];

                return (
                  <div
                    className={cn(
                      "relative min-h-0 overflow-visible border-r border-b border-[#eef1f5] bg-white p-1.5 text-left align-top transition-colors hover:bg-[#fbfcff]",
                      !cell.isCurrentMonth &&
                        "bg-[#f7f9fc] text-[#a8b1c0] hover:bg-[#f2f6fb]",
                    )}
                    key={cell.dateValue}
                  >
                    <button
                      aria-label={`일정 등록 ${cell.dateValue}`}
                      className={cn(
                        "inline-grid h-5 min-w-5 place-items-center rounded-sm px-1 text-[11px] font-semibold leading-none",
                        cell.isCurrentMonth ? "text-[#2d3340]" : "text-[#aeb7c6]",
                        cell.isToday && "bg-[#2f70dc] text-white shadow-sm",
                      )}
                      onClick={() => openEventForm(cell.dateValue)}
                      type="button"
                    >
                      {cell.date.getDate()}
                    </button>
                    <span className="mt-1 grid gap-1">
                      {dayEvents.slice(0, 2).map((event) => {
                        const spanPosition = getEventSpanPosition(event, cell.dateValue);

                        return (
                          <button
                            aria-label={getEventCalendarLabel(event)}
                            className={cn(
                              "relative z-10 block min-w-0 px-2 py-1 text-left text-xs font-bold leading-tight ring-1",
                              categoryStyles[event.category].pill,
                              spanPosition === "single" && "rounded-md",
                              spanPosition === "start" &&
                                "-mr-1.5 rounded-l-md rounded-r-none border-r-0 pr-1",
                              spanPosition === "middle" &&
                                "-mx-1.5 rounded-none border-x-0 px-1",
                              spanPosition === "end" &&
                                "-ml-1.5 rounded-l-none rounded-r-md border-l-0 pl-1",
                              !cell.isCurrentMonth && "opacity-55 grayscale",
                            )}
                            key={event.id}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              openEventEditor(event);
                            }}
                            type="button"
                          >
                            <span className="block truncate">
                              {spanPosition === "middle" || spanPosition === "end"
                                ? "\u00a0"
                                : getEventCalendarLabel(event)}
                            </span>
                          </button>
                        );
                      })}
                      {dayEvents.length > 2 ? (
                        <span className="rounded-md bg-[#eef5ff] px-2 py-0.5 text-xs font-bold text-[#2363c7]">
                          +{dayEvents.length - 2}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="border-t border-[#eef1f5] bg-[#fcfcfd] px-4 py-5 lg:border-l lg:border-t-0">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111827]">{formatShortMonth(visibleMonth)}</h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-[#2f70dc] hover:bg-[#eef5ff] hover:text-[#1d5fc2]"
                    aria-label="미니 캘린더 이전 달"
                    onClick={() => changeMonth(-1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-[#2f70dc] hover:bg-[#eef5ff] hover:text-[#1d5fc2]"
                    aria-label="미니 캘린더 다음 달"
                    onClick={() => changeMonth(1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-2.5 text-center text-xs">
                {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                  <span className="font-semibold text-[#7c8493]" key={day}>
                    {day}
                  </span>
                ))}
                {miniMonthCells.map((cell) => (
                  <button
                    className={cn(
                      "mx-auto grid size-7 place-items-center rounded-full text-xs font-semibold text-[#2d3340]",
                      !cell.isCurrentMonth && "text-[#b8bec8]",
                      cell.dateValue === selectedDate && "bg-[#2f70dc] text-white",
                    )}
                    key={`mini-${cell.dateValue}`}
                    aria-label={`미니 캘린더 ${cell.dateValue}`}
                    onClick={() => openEventForm(cell.dateValue)}
                    type="button"
                  >
                    {cell.date.getDate()}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-8 border-t border-[#eef1f5] pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111827]">캘린더</h2>
                <button
                  className="text-sm font-semibold text-[#2f70dc] hover:text-[#1d5fc2]"
                  onClick={toggleAllCategories}
                  type="button"
                >
                  {visibleCategories.length === CATEGORIES.length ? "모두 숨기기" : "모두 보기"}
                </button>
              </div>
              <div className="grid gap-3">
                {CATEGORIES.map((category) => {
                  const isVisible = visibleCategorySet.has(category);

                  return (
                    <button
                      className={cn(
                        "flex items-center gap-3 rounded-md px-1 py-1 text-left text-sm font-semibold transition-colors hover:bg-[#eef5ff]",
                        isVisible ? "text-[#3f4654]" : "text-[#a6afbd]",
                      )}
                      key={category}
                      onClick={() => toggleCategory(category)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-md text-[11px] text-white",
                          categoryStyles[category].checkbox,
                          !isVisible && "bg-[#cbd5e1] text-[#f8fafc]",
                        )}
                      >
                        {isVisible ? "✓" : ""}
                      </span>
                      {category}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={submitEvent} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingEventId ? "일정 수정" : "일정 등록"}</DialogTitle>
              <DialogDescription>
                {formatDateRangeLabel(form.startDate, form.endDate)} 업무 일정을{" "}
                {editingEventId ? "수정합니다." : "등록합니다."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="calendar-title">일정명</Label>
                <Input
                  id="calendar-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="예: 고객 미팅"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="calendar-category">일정 유형</Label>
                  <select
                    id="calendar-category"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value as CalendarEventCategory,
                      }))
                    }
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="h-5">시간 설정</Label>
                  <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm font-semibold text-[#374151]">
                    <input
                      checked={form.allDay ?? true}
                      className="size-4 accent-[#2f70dc]"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, allDay: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    종일
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="calendar-start-date">From</Label>
                  <Input
                    id="calendar-start-date"
                    type="date"
                    value={form.startDate || todayValue}
                    onChange={(event) => {
                      const nextStartDate = event.target.value;
                      setForm((current) => ({
                        ...current,
                        startDate: nextStartDate,
                        endDate:
                          current.endDate < nextStartDate ? nextStartDate : current.endDate,
                      }));
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="calendar-end-date">To</Label>
                  <Input
                    id="calendar-end-date"
                    type="date"
                    min={form.startDate || todayValue}
                    value={form.endDate || form.startDate || todayValue}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, endDate: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="calendar-start">시작 시간</Label>
                  <Input
                    disabled={form.allDay ?? true}
                    id="calendar-start"
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startTime: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="calendar-end">종료 시간</Label>
                  <Input
                    disabled={form.allDay ?? true}
                    id="calendar-end"
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, endTime: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="calendar-attendee">대상자</Label>
                <div className="relative">
                  <Input
                    autoComplete="off"
                    id="calendar-attendee"
                    onChange={(event) => setAttendeeQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && filteredAttendeeOptions[0]) {
                        event.preventDefault();
                        addAttendee(filteredAttendeeOptions[0]);
                      }
                    }}
                    placeholder="이름, 이메일, 아이디로 검색"
                    value={attendeeQuery}
                  />
                  {attendeeQuery.trim() ? (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-[#e5e7eb] bg-white py-1 shadow-lg">
                      {filteredAttendeeOptions.length ? (
                        filteredAttendeeOptions.map((attendee) => (
                          <button
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#f6f7fb]"
                            key={attendee.id}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => addAttendee(attendee)}
                            type="button"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-[#111827]">
                                {attendee.name}
                              </span>
                              <span className="block truncate text-xs text-[#6b7280]">
                                {attendee.email ?? attendee.loginId}
                              </span>
                            </span>
                            <Plus className="size-4 shrink-0 text-[#2f70dc]" />
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-[#6b7280]">검색 결과가 없습니다.</p>
                      )}
                    </div>
                  ) : null}
                </div>

                {(form.attendees ?? []).length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(form.attendees ?? []).map((attendee) => (
                      <span
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#f3f4f8] px-2.5 py-1 text-sm font-semibold text-[#374151]"
                        key={attendee.id}
                      >
                        <span className="truncate">{attendee.name}</span>
                        <button
                          aria-label={`${attendee.name} 대상자 삭제`}
                          className="grid size-4 place-items-center rounded-full text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#111827]"
                          onClick={() => removeAttendee(attendee.id)}
                          type="button"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="calendar-location">장소</Label>
                <Input
                  id="calendar-location"
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="회의실 또는 방문지"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="calendar-note">메모</Label>
                <Textarea
                  id="calendar-note"
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="업무 내용을 입력하세요"
                  className="min-h-24 resize-y"
                />
              </div>

              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleFormOpenChange(false)}>
                취소
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="gap-2 bg-[#2f70dc] text-white hover:bg-[#1d5fc2]"
              >
                <Send className="size-4" />
                {isPending
                  ? editingEventId
                    ? "저장 중"
                    : "등록 중"
                  : editingEventId
                    ? "저장"
                    : "등록"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildMonthCells(visibleMonth: Date) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateValue = toDateInputValue(date);

    return {
      date,
      dateValue,
      isCurrentMonth: date.getMonth() === month,
      isToday: dateValue === todayValue,
    };
  });
}
