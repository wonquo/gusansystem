"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};
const LOGIN_ID_STORAGE_KEY = "guesan:remembered-login-id";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const loginIdInputRef = useRef<HTMLInputElement>(null);
  const rememberLoginIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const savedLoginId = window.localStorage.getItem(LOGIN_ID_STORAGE_KEY) ?? "";

      if (!state.loginId && savedLoginId && loginIdInputRef.current) {
        loginIdInputRef.current.value = savedLoginId;
      }

      if (rememberLoginIdRef.current) {
        rememberLoginIdRef.current.checked = savedLoginId.length > 0;
      }
    } catch {
      if (rememberLoginIdRef.current) {
        rememberLoginIdRef.current.checked = false;
      }
    }
  }, [state.formKey, state.loginId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const loginId = String(formData.get("loginId") ?? "").trim();
    const shouldRememberLoginId = formData.get("rememberLoginId") === "on";

    try {
      if (shouldRememberLoginId && loginId) {
        window.localStorage.setItem(LOGIN_ID_STORAGE_KEY, loginId);
      } else {
        window.localStorage.removeItem(LOGIN_ID_STORAGE_KEY);
      }
    } catch {
      // Login should still continue even if the browser blocks localStorage.
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)] px-5 py-10 text-[#102033]">
      <section className="w-full max-w-[320px]">
        <form
          key={state.formKey ?? "initial-login-form"}
          action={formAction}
          onSubmit={handleSubmit}
          className="rounded-lg border border-[#dbe3ed] bg-white px-10 py-11 shadow-[0_22px_60px_rgba(16,32,51,0.1)]"
        >
          <div className="mb-9">
            <div className="mb-4 flex items-center gap-2.5">
              <Image src="/logo.png" alt="GUESAN 로고" width={34} height={34} priority />
              <h1 className="text-[1.45rem] font-bold leading-none tracking-normal text-[#102033]">GUESAN ERP</h1>
            </div>
            <p className="text-xs font-medium leading-relaxed text-[#7a8798]">
              회원 서비스 이용을 위해 로그인 해주세요.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="loginId" className="text-xs font-semibold tracking-normal text-[#526173]">
                아이디
              </Label>
              <Input
                id="loginId"
                ref={loginIdInputRef}
                name="loginId"
                defaultValue={state.loginId ?? ""}
                autoComplete="username"
                placeholder="아이디를 입력해주세요."
                className="h-8 rounded-md border-[#dbe3ed] bg-[#f8fafc] px-3 text-sm text-[#102033] shadow-none placeholder:text-xs placeholder:font-medium placeholder:text-[#9aa6b5] focus-visible:border-[#2f70dc] focus-visible:bg-white focus-visible:ring-[#2f70dc]/15"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold tracking-normal text-[#526173]">
                비밀번호
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호를 입력해주세요."
                className="h-8 rounded-md border-[#dbe3ed] bg-[#f8fafc] px-3 text-sm text-[#102033] shadow-none placeholder:text-xs placeholder:font-medium placeholder:text-[#9aa6b5] focus-visible:border-[#2f70dc] focus-visible:bg-white focus-visible:ring-[#2f70dc]/15"
                required
              />
            </div>
            <Label
              htmlFor="rememberLoginId"
              className="flex w-fit items-center gap-2 text-xs font-semibold text-[#526173]"
            >
              <input
                id="rememberLoginId"
                ref={rememberLoginIdRef}
                name="rememberLoginId"
                type="checkbox"
                className="size-4 rounded border-[#dbe3ed] bg-[#f8fafc] accent-[#285fd4]"
              />
              아이디 저장
            </Label>
            <div aria-live="polite">
              {state.error ? (
                <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive">
                  {state.error}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              size="lg"
              className="mt-6 h-9 w-full rounded-md bg-[#285fd4] text-xs font-semibold text-white shadow-[0_10px_22px_rgba(40,95,212,0.22)] hover:bg-[#2254bd] focus-visible:ring-[#285fd4]/25"
              disabled={isPending}
            >
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isPending ? "확인 중" : "로그인"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
