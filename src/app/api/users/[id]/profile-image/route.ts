import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers } from "@/db/schema";
import { canManageUsers, getCurrentAppUser, serializeUser } from "@/lib/auth";
import { getSafeErrorMessage } from "@/lib/db-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentAppUser();
    const { id } = await context.params;
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.id !== id && !canManageUsers(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!hasDatabaseUrl()) {
      return new NextResponse(null, { status: 404 });
    }

    const user = await getDb().query.appUsers.findFirst({
      where: eq(appUsers.id, id),
    });
    if (!user?.profileImageData || !user.profileImageContentType) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(Buffer.from(user.profileImageData, "base64"), {
      headers: {
        "Content-Type": user.profileImageContentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
        Vary: "Cookie",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentAppUser();
    const { id } = await context.params;
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.id !== id && !canManageUsers(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "프로필 사진 저장소가 설정되지 않았습니다." }, { status: 400 });
    }

    const formData = await request.formData();
    const profileImage = formData.get("profileImage");
    if (!(profileImage instanceof File)) {
      return NextResponse.json({ error: "업로드할 프로필 사진을 선택해 주세요." }, { status: 400 });
    }
    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(profileImage.type)) {
      return NextResponse.json(
        { error: "JPG, PNG, WebP, GIF 형식의 이미지만 올릴 수 있습니다." },
        { status: 400 },
      );
    }
    if (profileImage.size === 0 || profileImage.size > MAX_PROFILE_IMAGE_BYTES) {
      return NextResponse.json({ error: "프로필 사진은 2MB 이하로 올려 주세요." }, { status: 400 });
    }

    const [updated] = await getDb()
      .update(appUsers)
      .set({
        profileImageUrl: null,
        profileImageData: Buffer.from(await profileImage.arrayBuffer()).toString("base64"),
        profileImageContentType: profileImage.type,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ user: serializeUser(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: getSafeErrorMessage(error, "프로필 사진을 저장하지 못했습니다.") },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentAppUser();
    const { id } = await context.params;
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.id !== id && !canManageUsers(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "프로필 사진 저장소가 설정되지 않았습니다." }, { status: 400 });
    }

    const [updated] = await getDb()
      .update(appUsers)
      .set({
        profileImageUrl: null,
        profileImageData: null,
        profileImageContentType: null,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ user: serializeUser(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: getSafeErrorMessage(error, "프로필 사진을 삭제하지 못했습니다.") },
      { status: 400 },
    );
  }
}
