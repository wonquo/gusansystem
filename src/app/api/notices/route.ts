import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageNotices, getCurrentAppUser } from "@/lib/auth";
import { createNotice, listNotices } from "@/lib/notices";

const noticeSchema = z
  .object({
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
    isPinned: z.boolean().optional(),
    popupEnabled: z.boolean().optional(),
    popupStartsAt: z.string().datetime().nullable().optional(),
    popupEndsAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notices = await listNotices();

    return NextResponse.json({ notices });
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
    if (!user || !canManageNotices(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = noticeSchema.parse(await request.json());
    const notice = await createNotice(body, user.id);

    return NextResponse.json({ notice }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
