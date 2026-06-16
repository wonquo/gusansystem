"use client";

import Image from "next/image";
import { useActionState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)] px-5 py-10 text-[#102033]">
      <section className="w-full max-w-[388px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-lg border border-[#dbe3ed] bg-white shadow-[0_10px_24px_rgba(16,32,51,0.08)]">
            <Image src="/logo.png" alt="거산시스템 로고" width={42} height={42} priority />
          </div>
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-normal">GUSAN ERP</h1>
        </div>

        <form
          action={formAction}
          className="rounded-lg border border-[#dbe3ed] bg-white p-6 shadow-[0_22px_60px_rgba(16,32,51,0.1)]"
        >
          <div className="mb-5 border-b border-[#eef2f6] pb-4">
            <div>
              <h2 className="text-base font-semibold leading-none text-[#102033]">Sign in</h2>
              <p className="mt-2 text-xs font-medium text-[#7a8798]">거산시스템 계정 정보를 입력해주세요.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginId" className="text-xs font-semibold uppercase tracking-normal text-[#526173]">
                ID
              </Label>
              <Input
                id="loginId"
                name="loginId"
                autoComplete="username"
                placeholder="아이디"
                className="h-11 border-[#dbe3ed] bg-[#f8fafc] px-3 text-[#102033] shadow-none placeholder:text-[#9aa6b5] focus-visible:border-[#2f70dc] focus-visible:bg-white focus-visible:ring-[#2f70dc]/15"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-normal text-[#526173]">
                PW
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호"
                className="h-11 border-[#dbe3ed] bg-[#f8fafc] px-3 text-[#102033] shadow-none placeholder:text-[#9aa6b5] focus-visible:border-[#2f70dc] focus-visible:bg-white focus-visible:ring-[#2f70dc]/15"
                required
              />
            </div>
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
              className="mt-1 h-11 w-full bg-[#285fd4] text-white shadow-[0_10px_22px_rgba(40,95,212,0.22)] hover:bg-[#2254bd] focus-visible:ring-[#285fd4]/25"
              disabled={isPending}
            >
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="size-4" aria-hidden="true" />
              )}
              {isPending ? "확인 중" : "로그인"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
