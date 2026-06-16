import { notFound } from "next/navigation";
import { BoardDetail } from "@/components/board/board-detail";
import { requireAppUser } from "@/lib/auth";
import { getBoardPostDetail } from "@/lib/board";

export default async function BoardPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const post = await getBoardPostDetail(id);

  if (!post) {
    notFound();
  }

  return <BoardDetail post={post} />;
}
