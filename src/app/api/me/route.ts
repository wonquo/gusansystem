import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers } from "@/db/schema";
import { getCurrentAppUser, hashPassword, serializeUser, verifyPassword } from "@/lib/auth";
import { getSafeErrorMessage, isUniqueViolation } from "@/lib/db-errors";
import { normalizeProfileImageUrl } from "@/lib/profile-image";

const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력해 주세요.").optional(),
    email: z.email("올바른 이메일을 입력해 주세요.").trim().toLowerCase().optional(),
    profileImageUrl: z.string().trim().max(2048, "이미지 URL이 너무 깁니다.").optional(),
    currentPassword: z.string().optional(),
    password: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다.").optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password && !value.currentPassword) {
      context.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "현재 비밀번호를 입력해 주세요.",
      });
    }
  });

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentAppUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = profileUpdateSchema.parse(await request.json());
    const { currentPassword, password, ...profileBody } = body;
    const patch = {
      ...profileBody,
      ...(Object.hasOwn(profileBody, "profileImageUrl")
        ? { profileImageUrl: normalizeProfileImageUrl(profileBody.profileImageUrl) }
        : {}),
      ...(password ? { passwordHash: hashPassword(password) } : {}),
    };

    if (!hasDatabaseUrl()) {
      const publicPatch = {
        ...profileBody,
        ...(Object.hasOwn(profileBody, "profileImageUrl")
          ? { profileImageUrl: normalizeProfileImageUrl(profileBody.profileImageUrl) }
          : {}),
      };

      return NextResponse.json({
        user: {
          ...currentUser,
          ...publicPatch,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (password) {
      const persistedUser = await getDb().query.appUsers.findFirst({
        where: eq(appUsers.id, currentUser.id),
      });

      if (!persistedUser || !verifyPassword(currentPassword ?? "", persistedUser.passwordHash)) {
        return NextResponse.json(
          { error: "현재 비밀번호가 올바르지 않습니다." },
          { status: 400 },
        );
      }
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
        : isUniqueViolation(error, ["app_users_email_idx"])
          ? "이미 사용 중인 이메일입니다."
          : getSafeErrorMessage(error, "프로필을 수정하지 못했습니다.");

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
