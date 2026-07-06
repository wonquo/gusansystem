import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import { jsonError } from "@/lib/erp/api";
import { getWhiteboardState, updateWhiteboardState } from "@/lib/whiteboard";

const whiteboardSchema = z
  .object({
    textContent: z.string().max(12_000_000).optional().default(""),
    canvasDataUrl: z.string().max(6_500_000).optional().default(""),
  })
  .strict();

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ state: await getWhiteboardState() });
  } catch (error) {
    return jsonError(error, "화이트보드를 조회하지 못했습니다.");
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const input = whiteboardSchema.parse(await request.json());
    const state = await updateWhiteboardState(input, user.id);

    return NextResponse.json({ state });
  } catch (error) {
    return jsonError(error, "화이트보드를 저장하지 못했습니다.");
  }
}
