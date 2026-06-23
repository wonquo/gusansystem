import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, memos } from "@/db/schema";
import type { BoardAttachment, MemoRow } from "@/lib/types";

export type MemoInput = {
  title: string;
  content?: string;
  attachments?: BoardAttachment[];
};

export async function listMemos(query?: string | null, createdBy?: string): Promise<MemoRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const keyword = query?.trim();
  const conditions = [
    createdBy ? eq(memos.createdBy, createdBy) : undefined,
    keyword ? or(ilike(memos.title, `%${keyword}%`), ilike(memos.content, `%${keyword}%`)) : undefined,
  ].filter((condition) => condition !== undefined);

  const rows = await getDb()
    .select({
      memo: memos,
      authorName: appUsers.name,
    })
    .from(memos)
    .leftJoin(appUsers, eq(memos.createdBy, appUsers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(memos.updatedAt), desc(memos.createdAt))
    .limit(800);

  return rows.map(({ memo, authorName }) => serializeMemo(memo, authorName));
}

export async function getMemo(id: string, createdBy?: string): Promise<MemoRow | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const conditions = [eq(memos.id, id), createdBy ? eq(memos.createdBy, createdBy) : undefined].filter(
    (condition) => condition !== undefined,
  );

  const [row] = await getDb()
    .select({
      memo: memos,
      authorName: appUsers.name,
    })
    .from(memos)
    .leftJoin(appUsers, eq(memos.createdBy, appUsers.id))
    .where(and(...conditions))
    .limit(1);

  return row ? serializeMemo(row.memo, row.authorName) : null;
}

export async function createMemo(input: MemoInput, createdBy: string) {
  const [memo] = await getDb()
    .insert(memos)
    .values({
      title: normalizeTitle(input.title),
      content: sanitizeMemoContent(input.content ?? ""),
      attachments: normalizeAttachments(input.attachments),
      createdBy,
    })
    .returning();

  return getMemo(memo.id, createdBy);
}

export async function updateMemo(id: string, input: MemoInput, createdBy: string) {
  const [memo] = await getDb()
    .update(memos)
    .set({
      title: normalizeTitle(input.title),
      content: sanitizeMemoContent(input.content ?? ""),
      attachments: normalizeAttachments(input.attachments),
      updatedAt: new Date(),
    })
    .where(and(eq(memos.id, id), eq(memos.createdBy, createdBy)))
    .returning();

  if (!memo) {
    throw new Error("메모를 찾지 못했거나 권한이 없습니다.");
  }

  return getMemo(memo.id, createdBy);
}

export async function deleteMemo(id: string, createdBy: string) {
  const [deleted] = await getDb()
    .delete(memos)
    .where(and(eq(memos.id, id), eq(memos.createdBy, createdBy)))
    .returning({ id: memos.id });
  if (!deleted) {
    throw new Error("메모를 찾지 못했거나 권한이 없습니다.");
  }
  return deleted;
}

function normalizeTitle(value: string) {
  const title = value.trim();
  if (!title) {
    throw new Error("메모 제목을 입력해 주세요.");
  }
  return title;
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
  return Array.isArray(value) ? value.filter(isAttachment) : [];
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

function sanitizeMemoContent(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])javascript:[\s\S]*?\2/gi, "");
}

function serializeMemo(memo: typeof memos.$inferSelect, authorName: string | null): MemoRow {
  return {
    id: memo.id,
    title: memo.title,
    content: memo.content,
    attachments: parseAttachments(memo.attachments),
    createdBy: memo.createdBy,
    authorName,
    createdAt: memo.createdAt.toISOString(),
    updatedAt: memo.updatedAt.toISOString(),
  };
}
