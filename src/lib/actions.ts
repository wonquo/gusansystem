"use server";

import { redirect } from "next/navigation";
import { clearSession, verifyLogin } from "./auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(_state: LoginState, formData: FormData) {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!loginId || !password) {
    return { error: "ID와 비밀번호를 입력해주세요." };
  }

  const user = await verifyLogin(loginId, password);
  if (!user) {
    return { error: "ID 또는 비밀번호가 올바르지 않습니다." };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
