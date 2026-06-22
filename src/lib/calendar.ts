import { asc, eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, calendarEvents } from "@/db/schema";
import type {
  CalendarEventAttendee,
  CalendarEventCategory,
  CalendarEventRow,
} from "@/lib/types";

export const CALENDAR_EVENT_CATEGORIES = [
  "휴가",
  "출장",
  "회의",
  "교육",
  "외근",
  "기타",
];

export type CalendarEventInput = {
  title: string;
  category: CalendarEventCategory;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location?: string | null;
  note?: string | null;
  attendees?: CalendarEventAttendee[];
};

export type CalendarAttendeeOption = CalendarEventAttendee & {
  loginId: string;
};

export async function listCalendarEvents(): Promise<CalendarEventRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const rows = await getDb()
    .select({
      event: calendarEvents,
      authorName: appUsers.name,
    })
    .from(calendarEvents)
    .leftJoin(appUsers, eq(calendarEvents.createdBy, appUsers.id))
    .orderBy(asc(calendarEvents.startDate), asc(calendarEvents.startTime))
    .catch((error: unknown) => {
      if (isMissingCalendarTableError(error)) {
        return [];
      }

      throw error;
    });

  return rows.map(({ event, authorName }) => serializeCalendarEvent(event, authorName));
}

export async function listCalendarAttendeeOptions(): Promise<CalendarAttendeeOption[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  return getDb()
    .select({
      id: appUsers.id,
      name: appUsers.name,
      email: appUsers.email,
      loginId: appUsers.loginId,
    })
    .from(appUsers)
    .orderBy(asc(appUsers.name), asc(appUsers.loginId));
}

export async function createCalendarEvent(input: CalendarEventInput, createdBy: string) {
  const [event] = await getDb()
    .insert(calendarEvents)
    .values({
      title: input.title.trim(),
      category: input.category,
      eventDate: input.startDate,
      startDate: input.startDate,
      endDate: input.endDate,
      allDay: input.allDay,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
      attendees: normalizeAttendees(input.attendees),
      createdBy,
    })
    .returning()
    .catch((error: unknown) => {
      if (isMissingCalendarTableError(error)) {
        throw new Error("캘린더 DB 테이블 migration 적용이 필요합니다.");
      }

      throw error;
    });

  return serializeCalendarEvent(event, null);
}

export async function updateCalendarEvent(id: string, input: CalendarEventInput) {
  const [event] = await getDb()
    .update(calendarEvents)
    .set({
      title: input.title.trim(),
      category: input.category,
      eventDate: input.startDate,
      startDate: input.startDate,
      endDate: input.endDate,
      allDay: input.allDay,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
      attendees: normalizeAttendees(input.attendees),
      updatedAt: new Date(),
    })
    .where(eq(calendarEvents.id, id))
    .returning()
    .catch((error: unknown) => {
      if (isMissingCalendarTableError(error)) {
        throw new Error("캘린더 DB 테이블 migration 적용이 필요합니다.");
      }

      throw error;
    });

  if (!event) {
    return null;
  }

  return serializeCalendarEvent(event, null);
}

export async function deleteCalendarEvent(id: string) {
  const [deleted] = await getDb()
    .delete(calendarEvents)
    .where(eq(calendarEvents.id, id))
    .returning({ id: calendarEvents.id })
    .catch((error: unknown) => {
      if (isMissingCalendarTableError(error)) {
        throw new Error("캘린더 DB 테이블 migration 적용이 필요합니다.");
      }

      throw error;
    });

  return Boolean(deleted);
}

function normalizeCategory(value: string): CalendarEventCategory {
  return value.trim() || "기타";
}

function normalizeAttendees(attendees: CalendarEventAttendee[] = []) {
  const seen = new Set<string>();

  return attendees.reduce<CalendarEventAttendee[]>((normalized, attendee) => {
    if (seen.has(attendee.id)) {
      return normalized;
    }

    seen.add(attendee.id);
    normalized.push({
      id: attendee.id,
      name: attendee.name.trim(),
      email: attendee.email?.trim() || null,
    });

    return normalized;
  }, []);
}

function isMissingCalendarTableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('relation "calendar_events" does not exist') ||
    error.message.includes("calendar_events")
  );
}

function serializeCalendarEvent(
  event: typeof calendarEvents.$inferSelect,
  authorName: string | null,
): CalendarEventRow {
  return {
    id: event.id,
    title: event.title,
    category: normalizeCategory(event.category),
    eventDate: event.eventDate,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    note: event.note,
    attendees: Array.isArray(event.attendees)
      ? (event.attendees as CalendarEventAttendee[])
      : [],
    createdBy: event.createdBy,
    authorName,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
