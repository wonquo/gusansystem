import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import {
  canManageBoardResource,
  deleteBoardPost,
  getBoardPostDetail,
  updateBoardPost,
} from "@/lib/board";

const attachmentSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    size: z.number().int().nonnegative(),
    type: z.string().trim(),
    dataUrl: z.string().trim().min(1),
  })
  .strict();

const postSchema = z
  .object({
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
    category: z.string().trim().min(1).default("일반"),
    attachments: z.array(attachmentSchema).max(10).optional(),
  })
  .strict();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const post = await getBoardPostDetail(id);
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const currentPost = await getBoardPostDetail(id);
    if (!currentPost) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageBoardResource(user, currentPost.createdBy)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = postSchema.parse(await request.json());
    const post = await updateBoardPost(id, body);
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const currentPost = await getBoardPostDetail(id);
    if (!currentPost) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageBoardResource(user, currentPost.createdBy)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await deleteBoardPost(id);
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
