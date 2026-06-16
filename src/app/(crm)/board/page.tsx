import { BoardList } from "@/components/board/board-list";
import { requireAppUser } from "@/lib/auth";
import { listBoardPosts } from "@/lib/board";

export default async function BoardPage() {
  await requireAppUser();
  const posts = await listBoardPosts();

  return <BoardList posts={posts} />;
}
