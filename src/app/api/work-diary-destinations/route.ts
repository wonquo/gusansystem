import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import {
  createWorkDiaryDestination,
  listWorkDiaryDestinations,
} from "@/lib/work-diaries";

const createSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
  })
  .strict();

export async function GET() {
  try {
    const guard = await requireErpPermission("work-diaries", "view");
    if (guard.response) return guard.response;

    return NextResponse.json({ rows: await listWorkDiaryDestinations() });
  } catch (error) {
    return jsonError(error, "행선지를 조회하지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireErpPermission("work-diaries", "create");
    if (guard.response) return guard.response;

    const body = createSchema.parse(await request.json());
    const option = await createWorkDiaryDestination({
      code: body.code,
      label: body.label,
    });

    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return jsonError(error, "행선지를 저장하지 못했습니다.");
  }
}
