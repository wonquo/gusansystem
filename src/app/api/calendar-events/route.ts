import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from "@/lib/calendar";

const eventSchema = z
  .object({
    title: z.string().trim().min(1),
    category: z.string().trim().min(1).max(32),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    allDay: z.boolean().default(true),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    location: z.string().trim().max(120).optional(),
    note: z.string().trim().max(1000).optional(),
    attendees: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string().trim().min(1),
          email: z.email().nullable(),
        }),
      )
      .default([]),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.endDate < event.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "종료일은 시작일보다 빠를 수 없습니다.",
      });
    }

    if (!event.allDay && event.startDate === event.endDate && event.endTime <= event.startTime) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "종료 시간은 시작 시간보다 늦어야 합니다.",
      });
    }
  });

const updateEventSchema = eventSchema.extend({
  id: z.uuid(),
});
const deleteEventSchema = z.uuid();

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const events = await listCalendarEvents();

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = eventSchema.parse(await request.json());
    const event = await createCalendarEvent(body, user.id);

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, ...body } = updateEventSchema.parse(await request.json());
    const event = await updateCalendarEvent(id, body);
    if (!event) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = deleteEventSchema.parse(searchParams.get("id"));
    const deleted = await deleteCalendarEvent(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
