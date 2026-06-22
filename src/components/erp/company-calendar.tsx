"use client";

import { type CSSProperties, FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Send,
  Settings,
  Trash2,
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

const MAX_VISIBLE_LANES = 3;
const CATEGORY_STORAGE_KEY = "gusan.calendar.categories.v1";
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1}월`,
  value: index,
}));
const CATEGORY_SWATCHES = [
  "#f43f5e",
  "#2563eb",
  "#7c3aed",
  "#f59e0b",
  "#10b981",
  "#64748b",
  "#06b6d4",
  "#ec4899",
];

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

type CalendarCategoryOption = {
  id: string;
  label: CalendarEventCategory;
  color: string;
};

const DEFAULT_CATEGORY_OPTIONS: CalendarCategoryOption[] = [
  { id: "category-vacation", label: "휴가", color: "#f43f5e" },
  { id: "category-trip", label: "출장", color: "#2563eb" },
  { id: "category-meeting", label: "회의", color: "#7c3aed" },
  { id: "category-training", label: "교육", color: "#f59e0b" },
  { id: "category-outside", label: "외근", color: "#10b981" },
  { id: "category-etc", label: "기타", color: "#64748b" },
];

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

function normalizeCategoryLabel(label: string) {
  return label.trim().replace(/\s+/g, " ");
}

function normalizeCategoryColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#64748b";
}

function createCategoryOption(label: string, color = "#64748b"): CalendarCategoryOption {
  const normalizedLabel = normalizeCategoryLabel(label) || "기타";

  return {
    id: `category-${encodeURIComponent(normalizedLabel)}`,
    label: normalizedLabel,
    color: normalizeCategoryColor(color),
  };
}

function getEventCategoryOptions(
  events: CalendarEventRow[],
  existingOptions: CalendarCategoryOption[] = DEFAULT_CATEGORY_OPTIONS,
) {
  const labels = new Set(existingOptions.map((category) => category.label));

  return events.reduce<CalendarCategoryOption[]>((options, event) => {
    const label = normalizeCategoryLabel(event.category);
    if (!label || labels.has(label)) {
      return options;
    }

    labels.add(label);
    options.push(createCategoryOption(label, CATEGORY_SWATCHES[options.length % CATEGORY_SWATCHES.length]));

    return options;
  }, []);
}

function mergeCategoryOptions(...optionGroups: CalendarCategoryOption[][]) {
  const byLabel = new Map<string, CalendarCategoryOption>();

  for (const options of optionGroups) {
    for (const option of options) {
      const label = normalizeCategoryLabel(option.label);
      if (!label) {
        continue;
      }

      byLabel.set(label, {
        id: option.id || createCategoryOption(label).id,
        label,
        color: normalizeCategoryColor(option.color),
      });
    }
  }

  return Array.from(byLabel.values());
}

function buildInitialCategoryOptions(events: CalendarEventRow[]) {
  return mergeCategoryOptions(
    DEFAULT_CATEGORY_OPTIONS,
    getEventCategoryOptions(events, DEFAULT_CATEGORY_OPTIONS),
  );
}

function parseStoredCategoryOptions(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (option): option is CalendarCategoryOption =>
          option &&
          typeof option.id === "string" &&
          typeof option.label === "string" &&
          typeof option.color === "string",
      )
      .map((option) => ({
        id: option.id,
        label: normalizeCategoryLabel(option.label),
        color: normalizeCategoryColor(option.color),
      }))
      .filter((option) => option.label);
  } catch {
    return [];
  }
}

function hexToRgb(color: string) {
  const normalized = normalizeCategoryColor(color).slice(1);

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function getCategoryPillStyle(color: string): CSSProperties {
  const { r, g, b } = hexToRgb(color);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
    boxShadow: `inset 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.22)`,
    color,
  };
}

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
  const initialCategoryOptions = useMemo(
    () => buildInitialCategoryOptions(initialEvents),
    [initialEvents],
  );
  const [events, setEvents] = useState(initialEvents);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [form, setForm] = useState<CalendarForm>(() => createEmptyForm());
  const [categoryOptions, setCategoryOptions] = useState(initialCategoryOptions);
  const [categoryDrafts, setCategoryDrafts] = useState(initialCategoryOptions);
  const [didLoadStoredCategories, setDidLoadStoredCategories] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [visibleCategories, setVisibleCategories] = useState<CalendarEventCategory[]>(
    () => initialCategoryOptions.map((category) => category.label),
  );
  const [error, setError] = useState<string | null>(null);
  const [categoryManagerError, setCategoryManagerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const miniMonthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const categoryLabels = useMemo(
    () => categoryOptions.map((category) => category.label),
    [categoryOptions],
  );
  const categoryOptionByLabel = useMemo(
    () => new Map(categoryOptions.map((category) => [category.label, category])),
    [categoryOptions],
  );
  const visibleCategorySet = useMemo(() => new Set(visibleCategories), [visibleCategories]);

  useEffect(() => {
    const storedCategoryOptions =
      typeof window === "undefined"
        ? []
        : parseStoredCategoryOptions(window.localStorage.getItem(CATEGORY_STORAGE_KEY));
    const baseOptions = storedCategoryOptions.length
      ? storedCategoryOptions
      : DEFAULT_CATEGORY_OPTIONS;
    const nextOptions = mergeCategoryOptions(
      baseOptions,
      getEventCategoryOptions(initialEvents, baseOptions),
    );

    const timeoutId = window.setTimeout(() => {
      setCategoryOptions(nextOptions);
      setCategoryDrafts(nextOptions);
      setVisibleCategories((current) => {
        const currentSet = new Set(current);
        const initialLabels = initialCategoryOptions.map((category) => category.label);
        const hadAllInitialVisible = initialLabels.every((label) => currentSet.has(label));

        return hadAllInitialVisible
          ? nextOptions.map((category) => category.label)
          : nextOptions
              .map((category) => category.label)
              .filter((label) => currentSet.has(label));
      });
      setDidLoadStoredCategories(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialEvents, initialCategoryOptions]);

  useEffect(() => {
    if (!didLoadStoredCategories || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categoryOptions));
  }, [categoryOptions, didLoadStoredCategories]);

  // 연결된(여러 날 이어지는) 일정이 어느 날에서도 같은 행(레인)에 표시되도록
  // 일정마다 고정 레인을 부여한다. 기간이 길수록 위쪽 레인을 차지한다.
  const laneEventsByDate = useMemo(() => {
    const visibleEvents = events.filter((event) => visibleCategorySet.has(event.category));

    const sortedEvents = [...visibleEvents].sort((a, b) => {
      const aSpan = enumerateEventDates(a).length;
      const bSpan = enumerateEventDates(b).length;
      if (aSpan !== bSpan) {
        return bSpan - aSpan;
      }

      const aStart = a.startDate || a.eventDate;
      const bStart = b.startDate || b.eventDate;
      if (aStart !== bStart) {
        return aStart.localeCompare(bStart);
      }

      return `${a.startTime}${a.title}`.localeCompare(`${b.startTime}${b.title}`);
    });

    const occupiedLanes: Record<string, Set<number>> = {};
    const laneByEvent = new Map<string, number>();

    for (const event of sortedEvents) {
      const dates = enumerateEventDates(event);
      let lane = 0;
      while (dates.some((dateValue) => occupiedLanes[dateValue]?.has(lane))) {
        lane += 1;
      }

      for (const dateValue of dates) {
        (occupiedLanes[dateValue] ??= new Set()).add(lane);
      }
      laneByEvent.set(event.id, lane);
    }

    const byDate: Record<string, (CalendarEventRow | null)[]> = {};
    for (const event of sortedEvents) {
      const lane = laneByEvent.get(event.id) ?? 0;
      for (const dateValue of enumerateEventDates(event)) {
        const lanes = (byDate[dateValue] ??= []);
        lanes[lane] = event;
      }
    }

    for (const dateValue of Object.keys(byDate)) {
      const lanes = byDate[dateValue];
      for (let index = 0; index < lanes.length; index += 1) {
        if (lanes[index] === undefined) {
          lanes[index] = null;
        }
      }
    }

    return byDate;
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
    setVisibleCategories((current) =>
      current.length === categoryLabels.length ? [] : categoryLabels,
    );
  }

  function openEventForm(dateValue: string) {
    setSelectedDate(dateValue);
    setEditingEventId(null);
    setForm((current) => ({
      ...createEmptyForm(dateValue),
      category: categoryLabels.includes(current.category)
        ? current.category
        : categoryLabels[0] ?? "기타",
    }));
    setAttendeeQuery("");
    setError(null);
    setIsFormOpen(true);
  }

  function openCategoryManager() {
    setCategoryDrafts(categoryOptions);
    setCategoryManagerError(null);
    setIsCategoryManagerOpen(true);
  }

  function addCategoryDraft() {
    const nextNumber = categoryDrafts.length + 1;

    setCategoryDrafts((current) => [
      ...current,
      createCategoryOption(`새 유형 ${nextNumber}`, CATEGORY_SWATCHES[current.length % CATEGORY_SWATCHES.length]),
    ]);
  }

  function updateCategoryDraft(
    id: string,
    update: Partial<Pick<CalendarCategoryOption, "label" | "color">>,
  ) {
    setCategoryDrafts((current) =>
      current.map((category) =>
        category.id === id
          ? {
              ...category,
              ...update,
            }
          : category,
      ),
    );
  }

  function removeCategoryDraft(id: string) {
    setCategoryDrafts((current) =>
      current.length <= 1 ? current : current.filter((category) => category.id !== id),
    );
  }

  function buildEventPayload(event: CalendarEventRow, category: CalendarEventCategory) {
    return {
      title: event.title,
      category,
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

  function saveCategoryManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryManagerError(null);

    const normalizedDrafts = categoryDrafts.map((category) => ({
      ...category,
      label: normalizeCategoryLabel(category.label),
      color: normalizeCategoryColor(category.color),
    }));
    const duplicateLabels = new Set<string>();
    const seenLabels = new Set<string>();

    for (const category of normalizedDrafts) {
      if (!category.label) {
        setCategoryManagerError("유형 이름을 입력해 주세요.");
        return;
      }

      if (seenLabels.has(category.label)) {
        duplicateLabels.add(category.label);
      }
      seenLabels.add(category.label);
    }

    if (duplicateLabels.size > 0) {
      setCategoryManagerError("같은 이름의 유형이 있습니다.");
      return;
    }

    const nextOptions = mergeCategoryOptions(normalizedDrafts);
    const renameMap = new Map<string, CalendarEventCategory>();

    for (const currentCategory of categoryOptions) {
      const nextCategory = nextOptions.find((category) => category.id === currentCategory.id);
      if (nextCategory && nextCategory.label !== currentCategory.label) {
        renameMap.set(currentCategory.label, nextCategory.label);
      }
    }

    const nextLabelSet = new Set(nextOptions.map((category) => category.label));
    const removedUsedCategory = events.find((calendarEvent) => {
      const nextCategory = renameMap.get(calendarEvent.category) ?? calendarEvent.category;

      return !nextLabelSet.has(nextCategory);
    });
    if (removedUsedCategory) {
      setCategoryManagerError(`${removedUsedCategory.category} 유형은 사용 중이라 삭제할 수 없습니다.`);
      return;
    }

    startTransition(async () => {
      const updatedEvents = new Map<string, CalendarEventRow>();

      for (const [fromCategory, toCategory] of renameMap) {
        const targetEvents = events.filter((calendarEvent) => calendarEvent.category === fromCategory);

        for (const calendarEvent of targetEvents) {
          const response = await fetch("/api/calendar-events", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...buildEventPayload(calendarEvent, toCategory),
              id: calendarEvent.id,
            }),
          });
          const data = await response.json();

          if (!response.ok) {
            setCategoryManagerError(data.error ?? "유형 변경을 저장하지 못했습니다.");
            return;
          }

          updatedEvents.set(calendarEvent.id, data.event);
        }
      }

      setEvents((current) =>
        current.map((calendarEvent) => updatedEvents.get(calendarEvent.id) ?? calendarEvent),
      );
      setCategoryOptions(nextOptions);
      setVisibleCategories((current) => {
        const currentSet = new Set(
          current.map((category) => renameMap.get(category) ?? category),
        );
        const hadAllVisible = categoryOptions.every((category) => currentSet.has(category.label));

        return hadAllVisible
          ? nextOptions.map((category) => category.label)
          : nextOptions
              .map((category) => category.label)
              .filter((label) => currentSet.has(label));
      });
      setForm((current) => ({
        ...current,
        category: renameMap.get(current.category) ?? current.category,
      }));
      setIsCategoryManagerOpen(false);
    });
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

  function deleteEvent() {
    if (!editingEventId) {
      return;
    }

    const title = form.title.trim() || "선택한 일정";
    if (!window.confirm(`${title}을(를) 삭제하시겠습니까?`)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/calendar-events?id=${encodeURIComponent(editingEventId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "일정을 삭제하지 못했습니다.");
        return;
      }

      setEvents((current) => current.filter((event) => event.id !== editingEventId));
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
                const dayLanes = laneEventsByDate[cell.dateValue] ?? [];
                const visibleLanes = dayLanes.slice(0, MAX_VISIBLE_LANES);
                const overflowCount = dayLanes
                  .slice(MAX_VISIBLE_LANES)
                  .filter(Boolean).length;

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
                      {visibleLanes.map((event, laneIndex) => {
                        if (!event) {
                          return (
                            <span
                              aria-hidden
                              className="block px-2 py-1 text-xs leading-tight"
                              key={`lane-empty-${laneIndex}`}
                            >
                              {"\u00a0"}
                            </span>
                          );
                        }

                        const spanPosition = getEventSpanPosition(event, cell.dateValue);
                        const categoryOption =
                          categoryOptionByLabel.get(event.category) ??
                          createCategoryOption(event.category);

                        return (
                          <button
                            aria-label={getEventCalendarLabel(event)}
                            className={cn(
                              "relative z-10 block min-w-0 px-2 py-1 text-left text-xs font-bold leading-tight",
                              spanPosition === "single" && "rounded-md",
                              spanPosition === "start" &&
                                "-mr-1.5 rounded-l-md rounded-r-none border-r-0 pr-1",
                              spanPosition === "middle" &&
                                "-mx-1.5 rounded-none border-x-0 px-1",
                              spanPosition === "end" &&
                                "-ml-1.5 rounded-l-none rounded-r-md border-l-0 pl-1",
                              !cell.isCurrentMonth && "opacity-55 grayscale",
                            )}
                            style={getCategoryPillStyle(categoryOption.color)}
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
                      {overflowCount > 0 ? (
                        <span className="rounded-md bg-[#eef5ff] px-2 py-0.5 text-xs font-bold text-[#2363c7]">
                          +{overflowCount}
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
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-[#111827]">캘린더</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-[#7c8aa0] hover:bg-[#eef5ff] hover:text-[#1d5fc2]"
                    aria-label="캘린더 유형 관리"
                    onClick={openCategoryManager}
                    type="button"
                  >
                    <Settings className="size-4" />
                  </Button>
                </div>
                <button
                  className="text-sm font-semibold text-[#2f70dc] hover:text-[#1d5fc2]"
                  onClick={toggleAllCategories}
                  type="button"
                >
                  {visibleCategories.length === categoryLabels.length ? "모두 숨기기" : "모두 보기"}
                </button>
              </div>
              <div className="grid gap-3">
                {categoryOptions.map((category) => {
                  const isVisible = visibleCategorySet.has(category.label);

                  return (
                    <button
                      className={cn(
                        "flex items-center gap-3 rounded-md px-1 py-1 text-left text-sm font-semibold transition-colors hover:bg-[#eef5ff]",
                        isVisible ? "text-[#3f4654]" : "text-[#a6afbd]",
                      )}
                      key={category.id}
                      onClick={() => toggleCategory(category.label)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-md text-[11px] text-white",
                          !isVisible && "bg-[#cbd5e1] text-[#f8fafc]",
                        )}
                        style={isVisible ? { backgroundColor: category.color } : undefined}
                      >
                        {isVisible ? "✓" : ""}
                      </span>
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
        <DialogContent className="sm:max-w-lg">
          <form className="space-y-4" onSubmit={saveCategoryManager}>
            <DialogHeader>
              <DialogTitle>캘린더 유형 관리</DialogTitle>
              <DialogDescription>
                유형 이름과 색상을 관리합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[52vh] overflow-y-auto rounded-md border border-[#e5e7eb]">
              {categoryDrafts.map((category) => (
                <div
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#eef1f5] px-3 py-2 last:border-b-0"
                  key={category.id}
                >
                  <input
                    aria-label={`${category.label || "새 유형"} 색상`}
                    className="h-8 w-9 cursor-pointer rounded-md border border-[#d7e0ec] bg-white p-1"
                    onChange={(event) =>
                      updateCategoryDraft(category.id, { color: event.target.value })
                    }
                    type="color"
                    value={normalizeCategoryColor(category.color)}
                  />

                  <Input
                    aria-label="캘린더 유형 이름"
                    className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                    onChange={(event) =>
                      updateCategoryDraft(category.id, { label: event.target.value })
                    }
                    value={category.label}
                  />

                  <Button
                    aria-label={`${category.label || "새 유형"} 삭제`}
                    className="size-8 text-[#9aa3b2] hover:bg-[#f3f5f8] hover:text-red-600"
                    disabled={categoryDrafts.length <= 1 || isPending}
                    onClick={() => removeCategoryDraft(category.id)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              className="h-8 gap-2 border-[#d7e0ec] text-[#374151] hover:bg-[#f6f8fb]"
              disabled={isPending}
              onClick={addCategoryDraft}
              type="button"
              variant="outline"
            >
              <Plus className="size-4" />
              유형 추가
            </Button>

            {categoryManagerError ? (
              <p className="text-sm font-medium text-red-600">{categoryManagerError}</p>
            ) : null}

            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={() => setIsCategoryManagerOpen(false)}
                type="button"
                variant="outline"
              >
                취소
              </Button>
              <Button
                className="bg-[#2f70dc] text-white hover:bg-[#1d5fc2]"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "저장 중" : "저장"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.label}>
                        {category.label}
                      </option>
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

            <DialogFooter className="sm:justify-between">
              <div>
                {editingEventId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={deleteEvent}
                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                    {isPending ? "삭제 중" : "삭제"}
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleFormOpenChange(false)}
                >
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
              </div>
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
