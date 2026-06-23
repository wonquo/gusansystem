import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import {
  canManageBoardResource,
  deleteBoardComment,
  getBoardComment,
  updateBoardComment,
} from "@/lib/board";

const commentSchema = z
  .object({
    content: z.string().trim().min(1),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, commentId } = await context.params;
    const currentComment = await getBoardComment(id, commentId);
    if (!currentComment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageBoardResource(user, currentComment.createdBy)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = commentSchema.parse(await request.json());
    const comment = await updateBoardComment(id, commentId, body);
    if (!comment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ comment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, commentId } = await context.params;
    const currentComment = await getBoardComment(id, commentId);
    if (!currentComment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageBoardResource(user, currentComment.createdBy)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await deleteBoardComment(id, commentId);
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
