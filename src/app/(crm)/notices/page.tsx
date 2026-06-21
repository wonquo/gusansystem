import { NoticeBoard } from "@/components/notices/notice-board";
import { canManageNotices, requireAppUser } from "@/lib/auth";
import { listNotices } from "@/lib/notices";

export default async function NoticesPage() {
  const user = await requireAppUser();
  const notices = await listNotices();

  return <NoticeBoard initialNotices={notices} canManage={canManageNotices(user.role)} />;
}
