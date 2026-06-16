import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import { createBoardPost, listBoardPosts } from "@/lib/board";

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

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const posts = await listBoardPosts();

    return NextResponse.json({ posts });
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

    const body = postSchema.parse(await request.json());
    const post = await createBoardPost(body, user.id);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
