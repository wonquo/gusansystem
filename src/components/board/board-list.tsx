"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { MessageCircle, Paperclip, Plus, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BoardPostRow } from "@/lib/types";
import { CategoryBadge, formatBoardDate, stripHtml } from "./board-editor";

export function BoardList({ posts }: { posts: BoardPostRow[] }) {
  const [query, setQuery] = useState("");

  const filteredPosts = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) {
      return posts;
    }

    return posts.filter((post) =>
      [post.title, stripHtml(post.content), post.category, post.authorName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [posts, query]);

  const attachmentCount = useMemo(
    () => posts.reduce((sum, post) => sum + post.attachments.length, 0),
    [posts],
  );

  function searchBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function resetSearch() {
    setQuery("");
  }

  return (
    <div className="crm-erp-surface mx-auto grid max-w-[1840px] gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-[#0d1b3d]">게시판</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-7 border-[#cfd9e7] bg-white px-2.5 text-xs">
            {filteredPosts.length.toLocaleString()}건
          </Badge>
          <Badge variant="outline" className="h-7 border-[#cfd9e7] bg-white px-2.5 text-xs">
            첨부 {attachmentCount.toLocaleString()}개
          </Badge>
          <Button asChild size="sm" className="bg-[#1f6fff] text-white hover:bg-[#195ed8]">
            <Link href="/board/new">
              <Plus className="size-3.5" />
              글쓰기
            </Link>
          </Button>
        </div>
      </div>

      <form
        onSubmit={searchBoard}
        className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_1px_4px_rgba(15,28,48,0.06)]"
      >
        <div className="grid gap-px bg-[#edf1f6] p-px lg:grid-cols-[88px_minmax(260px,1fr)_auto]">
          <div className="flex items-center bg-[#f2f5f9] px-3 py-2 text-[11px] font-semibold whitespace-nowrap text-[#69758a]">
            조회조건
          </div>
          <div className="bg-white p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 border-[#d8e0ea] bg-white pl-7 text-sm focus-visible:border-[#2f70dc] focus-visible:ring-[#2f70dc]/20"
                placeholder="제목, 작성자, 내용 검색"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 bg-[#f8fafc] p-2 sm:flex-row sm:items-center sm:justify-end lg:min-w-[170px]">
            <Button type="submit" size="sm">
              <Search className="size-3.5" />
              조회
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetSearch} disabled={!query}>
              <RefreshCw className="size-3.5" />
              초기화
            </Button>
          </div>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-[#dbe3ee] bg-white shadow-[0_10px_34px_rgba(20,35,65,0.06)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f4f7fb] hover:bg-[#f4f7fb]">
                <TableHead className="w-[56px] text-center text-xs font-bold text-[#66748a]">No</TableHead>
                <TableHead className="w-[92px]">분류</TableHead>
                <TableHead className="min-w-[360px]">제목</TableHead>
                <TableHead className="w-[120px]">작성자</TableHead>
                <TableHead className="w-[84px] text-center">첨부</TableHead>
                <TableHead className="w-[84px] text-center">댓글</TableHead>
                <TableHead className="w-[132px]">등록일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center text-[#66748a]">
                    게시글이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPosts.map((post, index) => (
                  <TableRow key={post.id} className="hover:bg-[#f8fbff]">
                    <TableCell className="text-center text-xs font-medium text-[#7a869b]">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={post.category} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/board/${post.id}`}
                        className="block max-w-[640px] truncate font-semibold text-[#0d1b3d] hover:text-[#1f6fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6fff]"
                      >
                        {post.title}
                      </Link>
                      <p className="mt-1 line-clamp-1 text-xs text-[#7a869b]">
                        {stripHtml(post.content)}
                      </p>
                    </TableCell>
                    <TableCell className="font-medium text-[#526079]">
                      {post.authorName ?? "알 수 없음"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-[#526079]">
                        <Paperclip className="size-4" />
                        {post.attachments.length.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-[#526079]">
                        <MessageCircle className="size-4" />
                        {post.commentCount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#66748a]">
                      {formatBoardDate(post.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
