import { notFound } from "next/navigation";
import { NoticeDetail } from "@/components/notices/notice-detail";
import { requireAppUser } from "@/lib/auth";
import { getNoticeDetail } from "@/lib/notices";

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const notice = await getNoticeDetail(id);

  if (!notice) {
    notFound();
  }

  return <NoticeDetail notice={notice} />;
}
