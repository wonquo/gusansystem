"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BoardCommentRow, BoardPostDetailRow } from "@/lib/types";
import {
  AttachmentList,
  CategoryBadge,
  formatBoardDate,
  sanitizeBoardHtml,
} from "./board-editor";

export function BoardDetail({ post }: { post: BoardPostDetailRow }) {
  const [comments, setComments] = useState(post.comments);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="mx-auto w-full max-w-[1840px] space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0d1b3d]">게시글 상세</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/board">
            <ArrowLeft className="size-4" />
            목록
          </Link>
        </Button>
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
            comments.map((item) => <CommentItem key={item.id} comment={item} />)
          )}
        </div>
      </section>
    </div>
  );
}

function CommentItem({ comment }: { comment: BoardCommentRow }) {
  return (
    <article className="rounded-md border border-[#edf2f7] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7a869b]">
        <span className="font-bold text-[#22304f]">{comment.authorName ?? "알 수 없음"}</span>
        <span>{formatBoardDate(comment.createdAt)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[#22304f]">{comment.content}</p>
    </article>
  );
}
