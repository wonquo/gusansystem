"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { ArrowLeft, Check, Pencil, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AppUserRow, BoardCommentRow, BoardPostDetailRow } from "@/lib/types";
import {
  AttachmentList,
  CategoryBadge,
  formatBoardDate,
  sanitizeBoardHtml,
} from "./board-editor";

export function BoardDetail({
  post,
  currentUser,
}: {
  post: BoardPostDetailRow;
  currentUser: AppUserRow;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(post.comments);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canManagePost = canManage(currentUser, post.createdBy);

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/board/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "댓글을 저장하지 못했습니다.");
        return;
      }

      setComments((current) => [data.comment, ...current]);
      setCommentCount((current) => current + 1);
      setComment("");
    });
  }

  function removePost() {
    if (!window.confirm("이 게시글을 삭제할까요? 댓글도 함께 삭제됩니다.")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/board/${post.id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "게시글을 삭제하지 못했습니다.");
        return;
      }

      router.push("/board");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1840px] space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0d1b3d]">게시글 상세</h1>
        </div>
        <div className="flex items-center gap-2">
          {canManagePost ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/board/${post.id}/edit`}>
                  <Pencil className="size-4" />
                  수정
                </Link>
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={removePost}
                disabled={isPending}
              >
                <Trash2 className="size-4" />
                삭제
              </Button>
            </>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/board">
              <ArrowLeft className="size-4" />
              목록
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <article className="rounded-lg border border-[#dbe3ee] bg-white p-6 shadow-[0_10px_34px_rgba(20,35,65,0.06)]">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={post.category} />
          <span className="text-xs font-medium text-[#7a869b]">
            {post.authorName ?? "알 수 없음"} · {formatBoardDate(post.createdAt)}
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-bold leading-8 text-[#0d1b3d]">{post.title}</h2>

        <div
          className="mt-5 min-h-[420px] rounded-lg border border-[#dbe4ef] bg-[#f8fbff] p-6 text-sm leading-7 text-[#22304f] [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_strong]:font-bold [&_ul]:ml-5 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: sanitizeBoardHtml(post.content) }}
        />

        <div className="mt-4">
          <AttachmentList attachments={post.attachments} />
        </div>
      </article>

      <section className="rounded-lg border border-[#dbe3ee] bg-white p-4 shadow-[0_6px_20px_rgba(20,35,65,0.05)]">
        <h3 className="text-sm font-bold text-[#0d1b3d]">
          댓글 {commentCount.toLocaleString()}
        </h3>
        <form onSubmit={submitComment} className="mt-2 flex items-start gap-2">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="min-h-12 flex-1 resize-none rounded-md px-3 py-2 text-sm leading-6"
            placeholder="댓글을 입력하세요"
            rows={2}
            required
          />
          <Button
            type="submit"
            size="sm"
            className="h-12 shrink-0"
            disabled={isPending || comment.trim().length === 0}
          >
            <Send className="size-3.5" />
            {isPending ? "등록 중" : "등록"}
          </Button>
        </form>

        <div className="mt-3 grid gap-1.5">
          {comments.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#dbe4ef] px-3 py-3 text-center text-xs text-[#66748a]">
              아직 댓글이 없습니다.
            </div>
          ) : (
            comments.map((item) => (
              <CommentItem
                key={item.id}
                postId={post.id}
                comment={item}
                currentUser={currentUser}
                onError={setError}
                onUpdated={(updated) =>
                  setComments((current) =>
                    current.map((commentItem) =>
                      commentItem.id === updated.id ? updated : commentItem,
                    ),
                  )
                }
                onDeleted={(commentId) => {
                  setComments((current) => current.filter((commentItem) => commentItem.id !== commentId));
                  setCommentCount((current) => Math.max(0, current - 1));
                }}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CommentItem({
  postId,
  comment,
  currentUser,
  onError,
  onUpdated,
  onDeleted,
}: {
  postId: string;
  comment: BoardCommentRow;
  currentUser: AppUserRow;
  onError: (message: string | null) => void;
  onUpdated: (comment: BoardCommentRow) => void;
  onDeleted: (commentId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [isPending, startTransition] = useTransition();
  const canManageComment = canManage(currentUser, comment.createdBy);

  function saveComment() {
    const nextContent = content.trim();
    if (!nextContent) {
      onError("댓글 내용을 입력해 주세요.");
      return;
    }

    onError(null);
    startTransition(async () => {
      const response = await fetch(`/api/board/${postId}/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: nextContent }),
      });
      const data = await response.json();

      if (!response.ok) {
        onError(data.error ?? "댓글을 저장하지 못했습니다.");
        return;
      }

      onUpdated(data.comment);
      setContent(data.comment.content);
      setIsEditing(false);
    });
  }

  function removeComment() {
    if (!window.confirm("이 댓글을 삭제할까요?")) {
      return;
    }

    onError(null);
    startTransition(async () => {
      const response = await fetch(`/api/board/${postId}/comments/${comment.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        onError(data.error ?? "댓글을 삭제하지 못했습니다.");
        return;
      }

      onDeleted(comment.id);
    });
  }

  return (
    <article className="rounded-md border border-[#edf2f7] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#7a869b]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-[#22304f]">{comment.authorName ?? "알 수 없음"}</span>
          <span>{formatBoardDate(comment.createdAt)}</span>
        </div>
        {canManageComment ? (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="댓글 저장"
                  onClick={saveComment}
                  disabled={isPending || content.trim().length === 0}
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="댓글 수정 취소"
                  onClick={() => {
                    setContent(comment.content);
                    setIsEditing(false);
                  }}
                  disabled={isPending}
                >
                  <X className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="댓글 수정"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="댓글 삭제"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={removeComment}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="mt-2 min-h-20 resize-none text-sm leading-5"
          rows={3}
          autoFocus
        />
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[#22304f]">{comment.content}</p>
      )}
      <AttachmentList attachments={comment.attachments} compact />
    </article>
  );
}

function canManage(user: AppUserRow, createdBy: string | null) {
  return user.role === "admin" || createdBy === user.id;
}
