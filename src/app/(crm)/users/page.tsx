import { ShieldAlert } from "lucide-react";
import { getCurrentAppUser, canManageUsers } from "@/lib/auth";
import { listUsers } from "@/lib/customers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserManagementTable } from "@/components/admin/user-management-table";

export default async function UsersPage() {
  const currentUser = await getCurrentAppUser();

  if (!currentUser || !canManageUsers(currentUser.role)) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="size-4" />
        <AlertTitle>접근 권한이 없습니다</AlertTitle>
        <AlertDescription>사용자 관리는 관리자 권한이 필요합니다.</AlertDescription>
      </Alert>
    );
  }

  const users = await listUsers();

  return <UserManagementTable initialUsers={users} currentUserId={currentUser.id} />;
}
