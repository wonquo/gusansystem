import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, employees } from "@/db/schema";
import {
  canManageUsers,
  getCurrentAppUser,
  hashPassword,
  serializeUser,
} from "@/lib/auth";
import { getSafeErrorMessage, isUniqueViolation } from "@/lib/db-errors";

const userCreateSchema = z
  .object({
    loginId: z.string().trim().min(3, "로그인 ID는 3자 이상이어야 합니다."),
    employeeCode: z.string().trim().max(40, "사원코드는 40자 이하로 입력해 주세요.").optional(),
    email: z.email("올바른 이메일을 입력해 주세요.").trim().toLowerCase(),
    name: z.string().trim().min(1, "이름을 입력해 주세요."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    role: z.enum(["admin", "employee"]).default("employee"),
    status: z.enum(["active", "invited", "disabled"]).default("active"),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentAppUser();
    if (!currentUser || !canManageUsers(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = userCreateSchema.parse(await request.json());
    const employeeCode = normalizeEmployeeCode(body.employeeCode);

    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        {
          user: {
            id: crypto.randomUUID(),
            employeeCode,
            loginId: body.loginId,
            email: body.email,
            name: body.name,
            profileImageUrl: null,
            role: body.role,
            status: body.status,
            lastLoginAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        { status: 201 },
      );
    }

    const db = getDb();
    const existingUser = await db.query.appUsers.findFirst({
      where: or(eq(appUsers.loginId, body.loginId), eq(appUsers.email, body.email)),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: getDuplicateUserMessage(existingUser, body) },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(appUsers)
      .values({
        loginId: body.loginId,
        passwordHash: hashPassword(body.password),
        email: body.email,
        name: body.name,
        role: body.role,
        status: body.status,
      })
      .returning();

    if (employeeCode) {
      const existingEmployee = await db.query.employees.findFirst({
        where: eq(employees.employeeCode, employeeCode),
      });

      if (existingEmployee) {
        await db
          .update(employees)
          .set({
            name: body.name,
            userId: created.id,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(employees.id, existingEmployee.id));
      } else {
        await db.insert(employees).values({
          employeeCode,
          name: body.name,
          userId: created.id,
          status: "active",
        });
      }
    }

    return NextResponse.json(
      { user: { ...serializeUser(created), employeeCode } },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "입력값을 확인해 주세요.")
        : isUniqueViolation(error, ["app_users_login_id_idx", "app_users_email_idx"])
          ? "이미 사용 중인 로그인 ID 또는 이메일입니다."
          : getSafeErrorMessage(error, "사용자를 추가하지 못했습니다.");

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function normalizeEmployeeCode(value: string | undefined) {
  const code = value?.trim();
  return code ? code : null;
}

function getDuplicateUserMessage(
  user: Pick<typeof appUsers.$inferSelect, "loginId" | "email">,
  input: { loginId?: string; email?: string },
) {
  const isLoginIdDuplicate = user.loginId === input.loginId;
  const isEmailDuplicate = user.email === input.email;

  if (isLoginIdDuplicate && isEmailDuplicate) {
    return "이미 사용 중인 로그인 ID와 이메일입니다.";
  }

  if (isLoginIdDuplicate) {
    return "이미 사용 중인 로그인 ID입니다.";
  }

  if (isEmailDuplicate) {
    return "이미 사용 중인 이메일입니다.";
  }

  return "이미 사용 중인 로그인 ID 또는 이메일입니다.";
}
