import { and, count, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, noticeComments, notices } from "@/db/schema";
import type { NoticeCommentRow, NoticeDetailRow, NoticeRow } from "./types";

export type NoticeInput = {
  title: string;
  content: string;
  isPinned?: boolean;
  popupEnabled?: boolean;
  popupStartsAt?: string | null;
  popupEndsAt?: string | null;
};

export async function listNotices(): Promise<NoticeRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const rows = await getDb()
    .select({
      notice: notices,
      authorName: appUsers.name,
      commentCount: count(noticeComments.id),
    })
    .from(notices)
    .leftJoin(appUsers, eq(notices.createdBy, appUsers.id))
    .leftJoin(noticeComments, eq(notices.id, noticeComments.noticeId))
    .groupBy(
      notices.id,
      notices.title,
      notices.content,
      notices.isPinned,
      notices.popupEnabled,
      notices.popupStartsAt,
      notices.popupEndsAt,
      notices.createdBy,
      notices.createdAt,
      notices.updatedAt,
      appUsers.name,
    )
    .orderBy(desc(notices.isPinned), desc(notices.createdAt));

  return rows.map(({ notice, authorName, commentCount }) =>
    serializeNotice(notice, authorName, Number(commentCount)),
  );
}

export async function listActivePopupNotices(): Promise<NoticeRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const now = new Date();
  const rows = await getDb()
    .select({
      notice: notices,
      authorName: appUsers.name,
      commentCount: count(noticeComments.id),
    })
    .from(notices)
    .leftJoin(appUsers, eq(notices.createdBy, appUsers.id))
    .leftJoin(noticeComments, eq(notices.id, noticeComments.noticeId))
    .where(
      and(
        eq(notices.popupEnabled, true),
        or(isNull(notices.popupStartsAt), lte(notices.popupStartsAt, now)),
        or(isNull(notices.popupEndsAt), gte(notices.popupEndsAt, now)),
      ),
    )
    .groupBy(
      notices.id,
      notices.title,
      notices.content,
      notices.isPinned,
      notices.popupEnabled,
      notices.popupStartsAt,
      notices.popupEndsAt,
      notices.createdBy,
      notices.createdAt,
      notices.updatedAt,
      appUsers.name,
    )
    .orderBy(desc(notices.isPinned), desc(notices.createdAt))
    .limit(5);

  return rows.map(({ notice, authorName, commentCount }) =>
    serializeNotice(notice, authorName, Number(commentCount)),
  );
}

export async function getNoticeDetail(id: string): Promise<NoticeDetailRow | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const noticeRow = await getDb()
    .select({
      notice: notices,
      authorName: appUsers.name,
      commentCount: count(noticeComments.id),
    })
    .from(notices)
    .leftJoin(appUsers, eq(notices.createdBy, appUsers.id))
    .leftJoin(noticeComments, eq(notices.id, noticeComments.noticeId))
    .where(eq(notices.id, id))
    .groupBy(
      notices.id,
      notices.title,
      notices.content,
      notices.isPinned,
      notices.popupEnabled,
      notices.popupStartsAt,
      notices.popupEndsAt,
      notices.createdBy,
      notices.createdAt,
      notices.updatedAt,
      appUsers.name,
    )
    .limit(1);

  const row = noticeRow[0];
  if (!row) {
    return null;
  }

  const comments = await listNoticeComments(id);

  return {
    ...serializeNotice(row.notice, row.authorName, Number(row.commentCount)),
    comments,
  };
}

export async function createNotice(input: NoticeInput, createdBy: string) {
  const [notice] = await getDb()
    .insert(notices)
    .values({
      ...normalizeNoticeInput(input),
      createdBy,
    })
    .returning();

  return getNoticeDetail(notice.id);
}

export async function updateNotice(id: string, input: NoticeInput) {
  const [notice] = await getDb()
    .update(notices)
    .set({
      ...normalizeNoticeInput(input),
      updatedAt: new Date(),
    })
    .where(eq(notices.id, id))
    .returning();

  if (!notice) {
    return null;
  }

  return getNoticeDetail(notice.id);
}

export async function deleteNotice(id: string) {
  const deleted = await getDb().delete(notices).where(eq(notices.id, id)).returning({ id: notices.id });

  return deleted.length > 0;
}

export async function listNoticeComments(noticeId: string): Promise<NoticeCommentRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const rows = await getDb()
    .select({
      comment: noticeComments,
      authorName: appUsers.name,
    })
    .from(noticeComments)
    .leftJoin(appUsers, eq(noticeComments.createdBy, appUsers.id))
    .where(eq(noticeComments.noticeId, noticeId))
    .orderBy(desc(noticeComments.createdAt));

  return rows.map(({ comment, authorName }) => serializeNoticeComment(comment, authorName));
}

export async function createNoticeComment(noticeId: string, content: string, createdBy: string) {
  const [comment] = await getDb()
    .insert(noticeComments)
    .values({
      noticeId,
      content,
      createdBy,
    })
    .returning();

  const [row] = await getDb()
    .select({
      comment: noticeComments,
      authorName: appUsers.name,
    })
    .from(noticeComments)
    .leftJoin(appUsers, eq(noticeComments.createdBy, appUsers.id))
    .where(eq(noticeComments.id, comment.id))
    .limit(1);

  return serializeNoticeComment(row.comment, row.authorName);
}

function normalizeNoticeInput(input: NoticeInput) {
  return {
    title: input.title.trim(),
    content: input.content.trim(),
    isPinned: Boolean(input.isPinned),
    popupEnabled: Boolean(input.popupEnabled),
    popupStartsAt: parseOptionalDate(input.popupStartsAt),
    popupEndsAt: parseOptionalDate(input.popupEndsAt),
  };
}

function parseOptionalDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function serializeNotice(
  notice: typeof notices.$inferSelect,
  authorName: string | null,
  commentCount: number,
): NoticeRow {
  return {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    isPinned: notice.isPinned,
    popupEnabled: notice.popupEnabled,
    popupStartsAt: notice.popupStartsAt?.toISOString() ?? null,
    popupEndsAt: notice.popupEndsAt?.toISOString() ?? null,
    createdBy: notice.createdBy,
    authorName,
    commentCount,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
  };
}

function serializeNoticeComment(
  comment: typeof noticeComments.$inferSelect,
  authorName: string | null,
): NoticeCommentRow {
  return {
    id: comment.id,
    noticeId: comment.noticeId,
    content: comment.content,
    createdBy: comment.createdBy,
    authorName,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
