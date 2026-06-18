import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import {
  createWorkDiaryType,
  listWorkDiaryTypes,
} from "@/lib/work-diaries";

const createSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .strict();

export async function GET() {
  try {
    const guard = await requireErpPermission("work-diaries", "view");
    if (guard.response) return guard.response;
    if (guard.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ rows: await listWorkDiaryTypes() });
  } catch (error) {
    return jsonError(error, "업무구분을 조회하지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireErpPermission("work-diaries", "create");
    if (guard.response) return guard.response;
    if (guard.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = createSchema.parse(await request.json());
    const option = await createWorkDiaryType({
      code: body.code ?? body.label,
      label: body.label,
      color: body.color,
    });

    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return jsonError(error, "업무구분을 저장하지 못했습니다.");
  }
}
