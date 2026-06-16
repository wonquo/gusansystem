"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoardAttachment } from "@/lib/types";
import { FilePicker, RichTextEditor, sanitizeBoardHtml, stripHtml } from "./board-editor";

const categories = ["일반", "공지", "자료", "질문"];

export function BoardPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("일반");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<BoardAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const sanitizedContent = sanitizeBoardHtml(content);
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!stripHtml(sanitizedContent).trim()) {
      setError("내용을 입력해 주세요.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          content: sanitizedContent,
          attachments,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "게시글을 저장하지 못했습니다.");
        return;
      }

      router.push(`/board/${data.post.id}`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1840px] space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0d1b3d]">게시글 작성</h1>
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

      <form
        onSubmit={savePost}
        className="grid gap-5 rounded-lg border border-[#dbe3ee] bg-white p-6 shadow-[0_10px_34px_rgba(20,35,65,0.06)]"
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="grid gap-1.5">
            <Label htmlFor="board-title">제목</Label>
            <Input
              id="board-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="board-category">분류</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="board-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="board-content">내용</Label>
          <RichTextEditor value={content} onChange={setContent} />
        </div>

        <FilePicker attachments={attachments} onChange={setAttachments} />

        <div className="flex justify-end gap-2 border-t border-[#edf2f7] pt-4">
          <Button asChild variant="outline">
            <Link href="/board">취소</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            <Pencil className="size-4" />
            {isPending ? "등록 중" : "등록"}
          </Button>
        </div>
      </form>
    </div>
  );
}
