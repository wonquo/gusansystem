import { NextResponse } from "next/server";
import { z } from "zod";
import { requireErpPermission } from "@/lib/erp/api";
import {
  createProjectScheduleStatusOption,
  listProjectScheduleStatusOptions,
  renameProjectScheduleStatusValue,
} from "@/lib/project-schedule-status-options";

const createSchema = z.object({
  label: z.string().trim().min(1),
  color: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
});

const renameValueSchema = z
  .object({
    fromLabel: z.string().trim().min(1),
    label: z.string().trim().min(1),
    color: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
  })
  .strict();

export async function GET() {
  try {
    const guard = await requireErpPermission("project-schedules", "view");
    if (guard.response) return guard.response;
    return NextResponse.json({ options: await listProjectScheduleStatusOptions() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireErpPermission("project-schedules", "update");
    if (guard.response) return guard.response;
    const body = createSchema.parse(await request.json());
    const option = await createProjectScheduleStatusOption(body);
    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireErpPermission("project-schedules", "update");
    if (guard.response) return guard.response;
    const body = renameValueSchema.parse(await request.json());
    const option = await renameProjectScheduleStatusValue(body);
    return NextResponse.json({ option });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
