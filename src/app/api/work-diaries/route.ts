import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import {
  listWorkDiaryRows,
  normalizeWorkDiaryMonth,
  saveWorkDiaryBulk,
} from "@/lib/work-diaries";

const entrySchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().nullable().optional(),
    workDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).optional(),
    workType: z.string().nullable().optional(),
    workTypeId: z.string().uuid().nullable().optional(),
    primaryWork: z.string().nullable().optional(),
    secondaryWork: z.string().nullable().optional(),
    destinationId: z.string().nullable().optional(),
    memo: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).nullable().optional(),
  })
  .strict();

const bulkSchema = z
  .object({
    created: z.array(entrySchema).optional(),
    updated: z.array(entrySchema).optional(),
    deleted: z.array(z.string()).optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const guard = await requireErpPermission("work-diaries", "view");
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const month = normalizeWorkDiaryMonth(searchParams.get("month"));
    const targetUserId = searchParams.get("userId");

    return NextResponse.json({
      rows: await listWorkDiaryRows({
        currentUserId: guard.user.id,
        currentUserName: guard.user.name,
        role: guard.user.role,
        month,
        targetUserId,
      }),
    });
  } catch (error) {
    return jsonError(error, "업무일지를 조회하지 못했습니다.");
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireErpPermission("work-diaries", "update");
    if (guard.response) return guard.response;

    const input = bulkSchema.parse(await request.json());
    const result = await saveWorkDiaryBulk({
      currentUserId: guard.user.id,
      role: guard.user.role,
      input,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "업무일지를 저장하지 못했습니다.");
  }
}
