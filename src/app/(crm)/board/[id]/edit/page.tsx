import { notFound } from "next/navigation";
import { BoardPostForm } from "@/components/board/board-post-form";
import { requireAppUser } from "@/lib/auth";
import { canManageBoardResource, getBoardPostDetail } from "@/lib/board";

export default async function EditBoardPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAppUser();
  const { id } = await params;
  const post = await getBoardPostDetail(id);

  if (!post || !canManageBoardResource(user, post.createdBy)) {
    notFound();
  }

  return <BoardPostForm initialPost={post} />;
}
