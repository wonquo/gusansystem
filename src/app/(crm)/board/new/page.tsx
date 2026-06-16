import { BoardPostForm } from "@/components/board/board-post-form";
import { requireAppUser } from "@/lib/auth";

export default async function NewBoardPostPage() {
  await requireAppUser();

  return <BoardPostForm />;
}
