import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers } from "@/db/schema";
import { getCurrentAppUser, serializeUser } from "@/lib/auth";
import { normalizeProfileImageUrl } from "@/lib/profile-image";

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력해 주세요.").optional(),
    email: z.email("올바른 이메일을 입력해 주세요.").trim().toLowerCase().optional(),
    profileImageUrl: z.string().trim().max(2048, "이미지 URL이 너무 깁니다.").optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentAppUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = profileUpdateSchema.parse(await request.json());
    const patch = {
      ...body,
      ...(Object.hasOwn(body, "profileImageUrl")
        ? { profileImageUrl: normalizeProfileImageUrl(body.profileImageUrl) }
        : {}),
    };

    if (!hasDatabaseUrl()) {
      return NextResponse.json({
        user: {
          ...currentUser,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const [updated] = await getDb()
      .update(appUsers)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, currentUser.id))
      .returning();

    return NextResponse.json({ user: serializeUser(updated) });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "입력값을 확인해 주세요.")
        : error instanceof Error
          ? error.message
          : "Invalid request";
    const isDuplicate =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      String(error.message).includes("duplicate key");

    return NextResponse.json(
      { error: isDuplicate ? "이미 사용 중인 이메일입니다." : message },
      { status: 400 },
    );
  }
}
