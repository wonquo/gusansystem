import { and, count, desc, eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, boardComments, boardPosts } from "@/db/schema";
import type {
  BoardAttachment,
  BoardCommentRow,
  BoardPostDetailRow,
  BoardPostRow,
} from "./types";

export type BoardPostInput = {
  title: string;
  content: string;
  category: string;
  attachments?: BoardAttachment[];
};

export type BoardCommentInput = {
  content: string;
  attachments?: BoardAttachment[];
};

export function canManageBoardResource(
  user: { id: string; role: string },
  createdBy: string | null,
) {
  return user.role === "admin" || createdBy === user.id;
}

export async function listBoardPosts(): Promise<BoardPostRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const rows = await getDb()
    .select({
      post: boardPosts,
      authorName: appUsers.name,
      commentCount: count(boardComments.id),
    })
    .from(boardPosts)
    .leftJoin(appUsers, eq(boardPosts.createdBy, appUsers.id))
    .leftJoin(boardComments, eq(boardPosts.id, boardComments.postId))
    .groupBy(
      boardPosts.id,
      boardPosts.title,
      boardPosts.content,
      boardPosts.category,
      boardPosts.attachments,
      boardPosts.createdBy,
      boardPosts.createdAt,
      boardPosts.updatedAt,
      appUsers.name,
    )
    .orderBy(desc(boardPosts.createdAt));

  return rows.map(({ post, authorName, commentCount }) =>
    serializePost(post, authorName, Number(commentCount)),
  );
}

export async function getBoardPostDetail(id: string): Promise<BoardPostDetailRow | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const rows = await getDb()
    .select({
      post: boardPosts,
      authorName: appUsers.name,
      commentCount: count(boardComments.id),
    })
    .from(boardPosts)
    .leftJoin(appUsers, eq(boardPosts.createdBy, appUsers.id))
    .leftJoin(boardComments, eq(boardPosts.id, boardComments.postId))
    .where(eq(boardPosts.id, id))
    .groupBy(
      boardPosts.id,
      boardPosts.title,
      boardPosts.content,
      boardPosts.category,
      boardPosts.attachments,
      boardPosts.createdBy,
      boardPosts.createdAt,
      boardPosts.updatedAt,
      appUsers.name,
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...serializePost(row.post, row.authorName, Number(row.commentCount)),
    comments: await listBoardComments(id),
  };
}

export async function createBoardPost(input: BoardPostInput, createdBy: string) {
  const [post] = await getDb()
    .insert(boardPosts)
    .values({
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category.trim() || "일반",
      attachments: normalizeAttachments(input.attachments),
      createdBy,
    })
    .returning();

  return getBoardPostDetail(post.id);
}

export async function updateBoardPost(id: string, input: BoardPostInput) {
  const [post] = await getDb()
    .update(boardPosts)
    .set({
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category.trim() || "일반",
      attachments: normalizeAttachments(input.attachments),
      updatedAt: new Date(),
    })
    .where(eq(boardPosts.id, id))
    .returning();

  return post ? getBoardPostDetail(post.id) : null;
}

export async function deleteBoardPost(id: string) {
  const [deleted] = await getDb()
    .delete(boardPosts)
    .where(eq(boardPosts.id, id))
    .returning({ id: boardPosts.id });

  return deleted ?? null;
}

export async function listBoardComments(postId: string): Promise<BoardCommentRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const rows = await getDb()
    .select({
      comment: boardComments,
      authorName: appUsers.name,
    })
    .from(boardComments)
    .leftJoin(appUsers, eq(boardComments.createdBy, appUsers.id))
    .where(eq(boardComments.postId, postId))
    .orderBy(desc(boardComments.createdAt));

  return rows.map(({ comment, authorName }) => serializeComment(comment, authorName));
}

export async function createBoardComment(
  postId: string,
  input: BoardCommentInput,
  createdBy: string,
) {
  const [comment] = await getDb()
    .insert(boardComments)
    .values({
      postId,
      content: input.content.trim(),
      attachments: normalizeAttachments(input.attachments),
      createdBy,
    })
    .returning();

  const [row] = await getDb()
    .select({
      comment: boardComments,
      authorName: appUsers.name,
    })
    .from(boardComments)
    .leftJoin(appUsers, eq(boardComments.createdBy, appUsers.id))
    .where(eq(boardComments.id, comment.id))
    .limit(1);

  return serializeComment(row.comment, row.authorName);
}

export async function getBoardComment(postId: string, commentId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const [row] = await getDb()
    .select({
      comment: boardComments,
      authorName: appUsers.name,
    })
    .from(boardComments)
    .leftJoin(appUsers, eq(boardComments.createdBy, appUsers.id))
    .where(and(eq(boardComments.postId, postId), eq(boardComments.id, commentId)))
    .limit(1);

  return row ? serializeComment(row.comment, row.authorName) : null;
}

export async function updateBoardComment(
  postId: string,
  commentId: string,
  input: BoardCommentInput,
) {
  const values: Partial<typeof boardComments.$inferInsert> = {
    content: input.content.trim(),
    updatedAt: new Date(),
  };
  if (input.attachments !== undefined) {
    values.attachments = normalizeAttachments(input.attachments);
  }

  const [comment] = await getDb()
    .update(boardComments)
    .set(values)
    .where(and(eq(boardComments.postId, postId), eq(boardComments.id, commentId)))
    .returning();

  return comment ? getBoardComment(postId, comment.id) : null;
}

export async function deleteBoardComment(postId: string, commentId: string) {
  const [deleted] = await getDb()
    .delete(boardComments)
    .where(and(eq(boardComments.postId, postId), eq(boardComments.id, commentId)))
    .returning({ id: boardComments.id });

  return deleted ?? null;
}

function normalizeAttachments(value?: BoardAttachment[]) {
  return Array.isArray(value)
    ? value.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.type,
        dataUrl: item.dataUrl,
      }))
    : [];
}

function parseAttachments(value: unknown): BoardAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAttachment);
}

function isAttachment(value: unknown): value is BoardAttachment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.size === "number" &&
    typeof item.type === "string" &&
    typeof item.dataUrl === "string"
  );
}

function serializePost(
  post: typeof boardPosts.$inferSelect,
  authorName: string | null,
  commentCount: number,
): BoardPostRow {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    category: post.category,
    attachments: parseAttachments(post.attachments),
    createdBy: post.createdBy,
    authorName,
    commentCount,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function serializeComment(
  comment: typeof boardComments.$inferSelect,
  authorName: string | null,
): BoardCommentRow {
  return {
    id: comment.id,
    postId: comment.postId,
    content: comment.content,
    attachments: parseAttachments(comment.attachments),
    createdBy: comment.createdBy,
    authorName,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
