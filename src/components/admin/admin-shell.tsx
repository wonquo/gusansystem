"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import {
  Bell,
  BookOpenText,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileClock,
  FileText,
  FileSpreadsheet,
  FolderKanban,
  Home,
  ImageIcon,
  Inbox,
  KeyRound,
  LogOut,
  Menu,
  MonitorSmartphone,
  ReceiptText,
  ShieldCheck,
  Settings,
  Star,
  StickyNote,
  UserCircle,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { logoutAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getProfileImageDisplayUrl } from "@/lib/profile-image";
import type { AppUserRow } from "@/lib/types";

const mainNavItems = [
  { href: "/dashboard", label: "대시보드", icon: Home },
  { href: "/board", label: "게시판", icon: BookOpenText },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/work-diaries", label: "업무일지", icon: FileText },
  { href: "/memos", label: "메모", icon: StickyNote },
  { href: "/contacts", label: "연락처", icon: UsersRound },
];

const adminNavItems = [
  { href: "/projects", label: "프로젝트 관리", icon: FolderKanban },
  { href: "/tax-invoices", label: "전자세금계산서", icon: ReceiptText },
  { href: "/bank", label: "법인통장", icon: WalletCards },
  { href: "/payroll", label: "급여대장", icon: ClipboardList },
  { href: "/my-payroll", label: "내 급여명세서", icon: FileSpreadsheet },
  { href: "/imports", label: "업로드 이력", icon: FileClock },
  { href: "/users", label: "사용자 목록", icon: UsersRound },
  { href: "/permissions", label: "권한 관리", icon: Settings },
];

const navItems = [...mainNavItems, ...adminNavItems];
const DESKTOP_VIEW_STORAGE_KEY = "guesan-desktop-view";
const DESKTOP_VIEW_CHANGE_EVENT = "guesan-desktop-view-change";
const DESKTOP_VIEWPORT_CONTENT = "width=1280, initial-scale=0.3, maximum-scale=2, user-scalable=yes";
const MOBILE_VIEWPORT_CONTENT = "width=device-width, initial-scale=1";

export function AdminShell({
  user,
  children,
}: {
  user: AppUserRow;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localUser, setLocalUser] = useState<AppUserRow | null>(null);
  const displayUser = useMemo(() => {
    if (!localUser || localUser.id !== user.id) {
      return user;
    }

    return Date.parse(localUser.updatedAt) >= Date.parse(user.updatedAt) ? localUser : user;
  }, [localUser, user]);
  const sidebarWidth = isCollapsed ? "lg:pl-[84px]" : "lg:pl-[184px]";
  const currentTitle =
    navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ??
    "GUESAN ERP";

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#0d1b3d]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 hidden border-r border-[#e6ecf3] bg-white text-[#0d1b3d] shadow-[16px_0_44px_rgba(15,28,48,0.06)] transition-all duration-200 lg:block",
          isCollapsed ? "w-[84px]" : "w-[184px]",
        )}
      >
        <Sidebar collapsed={isCollapsed} pathname={pathname} user={displayUser} />
      </aside>
      <div className={cn("transition-[padding] duration-200", sidebarWidth)}>
        <header className="sticky top-0 z-30 border-b border-[#d8e0ea] bg-white/92 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 md:px-5">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                className="w-[184px] border-0 bg-white p-0 text-[#0d1b3d]"
              >
                <Sidebar collapsed={false} pathname={pathname} user={displayUser} mobile />
              </SheetContent>
            </Sheet>
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-[#0d1b3d] hover:bg-[#eef4fb] lg:inline-flex"
              aria-label={isCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
              onClick={() => setIsCollapsed((current) => !current)}
            >
              {isCollapsed ? <ChevronRight className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#0d1b3d]">{currentTitle}</p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[#0d1b3d] md:gap-2">
              <HeaderIcon label="알림">
                <Bell className="size-5" />
              </HeaderIcon>
              <HeaderIcon label="메일" badge="12">
                <Inbox className="size-5" />
              </HeaderIcon>
              <HeaderIcon label="즐겨찾기">
                <Star className="size-5" />
              </HeaderIcon>
              <HeaderIcon label="도움말">
                <CircleHelp className="size-5" />
              </HeaderIcon>
              <AccountMenu user={displayUser} onUserChange={setLocalUser} />
            </div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-3.5rem-1px)] px-2 pt-3 pb-[calc(0.75rem+var(--app-bottom-safe-space))] md:px-3">
          {children}
        </main>
      </div>
      <DesktopViewToggle />
    </div>
  );
}

function DesktopViewToggle() {
  const desktopView = useSyncExternalStore(
    subscribeDesktopView,
    getDesktopViewSnapshot,
    getDesktopViewServerSnapshot,
  );

  useEffect(() => {
    applyViewport(desktopView ? DESKTOP_VIEWPORT_CONTENT : MOBILE_VIEWPORT_CONTENT);
    document.documentElement.classList.toggle("guesan-desktop-view", desktopView);

    return () => {
      document.documentElement.classList.remove("guesan-desktop-view");
      applyViewport(MOBILE_VIEWPORT_CONTENT);
    };
  }, [desktopView]);

  return (
    <button
      type="button"
      onClick={() => setDesktopViewPreference(!desktopView)}
      className="desktop-view-toggle fixed right-4 bottom-[var(--desktop-view-toggle-bottom)] z-50 inline-flex h-11 items-center gap-2 rounded-full border border-[#c9d8ee] bg-white/95 px-4 text-xs font-bold text-[#1f4f9f] shadow-[0_12px_32px_rgba(15,28,48,0.18)] backdrop-blur transition hover:border-[#86a9e8] hover:bg-[#eef4ff] focus-visible:ring-2 focus-visible:ring-[#2f70dc]/30 focus-visible:outline-none"
      aria-pressed={desktopView}
    >
      <span className="grid size-7 place-items-center rounded-full bg-[#eaf1fd] text-[#2f70dc]">
        <MonitorSmartphone className="size-4" />
      </span>
      {desktopView ? "모바일 버전으로 보기" : "PC버전으로 보기"}
    </button>
  );
}

function subscribeDesktopView(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DESKTOP_VIEW_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DESKTOP_VIEW_CHANGE_EVENT, onStoreChange);
  };
}

function getDesktopViewSnapshot() {
  return window.localStorage.getItem(DESKTOP_VIEW_STORAGE_KEY) === "true";
}

function getDesktopViewServerSnapshot() {
  return false;
}

function setDesktopViewPreference(enabled: boolean) {
  window.localStorage.setItem(DESKTOP_VIEW_STORAGE_KEY, String(enabled));
  window.dispatchEvent(new Event(DESKTOP_VIEW_CHANGE_EVENT));
}

function applyViewport(content: string) {
  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement("meta");
    viewport.name = "viewport";
    document.head.appendChild(viewport);
  }
  viewport.content = content;
}

function AccountMenu({
  user,
  onUserChange,
}: {
  user: AppUserRow;
  onUserChange: (user: AppUserRow) => void;
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    profileImageUrl: user.profileImageUrl ?? "",
    currentPassword: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openProfileDialog() {
    setForm({
      name: user.name,
      email: user.email,
      profileImageUrl: user.profileImageUrl ?? "",
      currentPassword: "",
      password: "",
    });
    setError(null);
    setIsProfileOpen(true);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          profileImageUrl: form.profileImageUrl,
          ...(form.password.trim()
            ? { currentPassword: form.currentPassword, password: form.password }
            : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "프로필을 저장하지 못했습니다.");
        return;
      }

      onUserChange(data.user);
      setForm((current) => ({ ...current, currentPassword: "", password: "" }));
      setIsProfileOpen(false);
    });
  }

  return (
    <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="ml-1 h-10 gap-2 border-l border-[#e1e7f0] pl-3 pr-2 text-[#0d1b3d] hover:bg-[#eef4fb] sm:ml-2 sm:pl-4"
            aria-label="계정 메뉴 열기"
          >
            <Avatar user={user} className="size-9" />
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-28 truncate text-sm font-semibold">{user.name}</span>
              <span className="block max-w-28 truncate text-xs font-normal text-[#69758a]">
                {roleLabel(user.role)}
              </span>
            </span>
            <ChevronDown className="hidden size-4 text-[#7b869b] sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-md bg-white text-[#0d1b3d]">
          <DropdownMenuLabel className="px-2 py-2">
            <div className="flex items-center gap-3">
              <Avatar user={user} className="size-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0d1b3d]">{user.name}</p>
                <p className="truncate text-xs font-normal text-[#69758a]">{user.email}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 px-2 py-2" onSelect={openProfileDialog}>
            <ImageIcon className="size-4" />
            프로필 사진 변경
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 px-2 py-2" onSelect={openProfileDialog}>
            <UserCircle className="size-4" />
            내 정보 수정
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 px-2 py-2" disabled>
            <ShieldCheck className="size-4" />
            {roleLabel(user.role)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <DropdownMenuItem className="gap-2 px-2 py-2 text-red-600" asChild>
              <button type="submit" className="w-full">
                <LogOut className="size-4" />
                로그아웃
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent className="sm:max-w-md">
        <form onSubmit={saveProfile} className="space-y-4">
          <DialogHeader>
            <DialogTitle>내 프로필</DialogTitle>
            <DialogDescription>
              우측 상단 계정 메뉴에 표시될 기본 정보를 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-lg border border-[#dbe4ef] bg-[#f8fbff] p-3">
            <Avatar
              user={{
                ...user,
                name: form.name || user.name,
                profileImageUrl: form.profileImageUrl || null,
              }}
              className="size-14"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0d1b3d]">
                {form.name || user.name}
              </p>
              <p className="truncate text-xs text-[#69758a]">{form.email || user.email}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-name">이름</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-email">이메일</Label>
              <Input
                id="profile-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-image-url">프로필 사진 URL</Label>
              <Input
                id="profile-image-url"
                type="url"
                value={form.profileImageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, profileImageUrl: event.target.value }))
                }
                placeholder="https://example.com/profile.jpg"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-current-password">현재 비밀번호</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#7c8aa0]" />
                <Input
                  id="profile-current-password"
                  type="password"
                  value={form.currentPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                  autoComplete="current-password"
                  placeholder="비밀번호 변경 시 입력"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-password">새 비밀번호</Label>
              <Input
                id="profile-password"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                autoComplete="new-password"
                minLength={8}
                placeholder="변경할 때만 입력"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsProfileOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중" : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Avatar({
  user,
  className,
}: {
  user: Pick<AppUserRow, "name" | "profileImageUrl"> & { updatedAt?: string | null };
  className?: string;
}) {
  const imageUrl = getProfileImageDisplayUrl(user.profileImageUrl, user.updatedAt);

  if (imageUrl) {
    return (
      <span
        className={cn("block shrink-0 rounded-full bg-cover bg-center ring-1 ring-[#d5e0ee]", className)}
        style={{ backgroundImage: `url("${imageUrl}")` }}
        aria-label={`${user.name} 프로필 사진`}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#e9f0ff] text-sm font-semibold text-[#1f6fff] ring-1 ring-[#d5e0ee]",
        className,
      )}
      aria-label={`${user.name} 프로필 기본 이미지`}
    >
      {user.name.slice(0, 1)}
    </span>
  );
}

function HeaderIcon({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative text-[#0d1b3d] hover:bg-[#eef4fb]"
      aria-label={label}
    >
      {children}
      {badge ? (
        <span className="absolute right-0 top-1 grid min-w-4 place-items-center rounded-full bg-[#1f6fff] px-1 text-[10px] font-semibold leading-4 text-white">
          {badge}
        </span>
      ) : null}
    </Button>
  );
}

function Sidebar({
  collapsed,
  pathname,
  user,
  mobile = false,
}: {
  collapsed: boolean;
  pathname: string;
  user: AppUserRow;
  mobile?: boolean;
}) {
  const [adminOpen, setAdminOpen] = useState(true);
  const adminActive = adminNavItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const brandLink = (
    <Link
      href="/dashboard"
      title={collapsed ? "대시보드" : undefined}
      aria-label="대시보드로 이동"
      className={cn(
        "flex h-16 items-center gap-3 transition-colors hover:bg-[#f1f5fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f70dc]/40",
        collapsed ? "justify-center px-3" : "px-5",
      )}
    >
      <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-white shadow-md shadow-blue-950/20">
        <Image src="/logo.png" alt="GUESAN 로고" width={36} height={36} priority />
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-wide">GUESAN</p>
          <p className="truncate text-[11px] font-medium text-[#718096]">ERP</p>
        </div>
      ) : null}
    </Link>
  );
  const renderNavLink = (item: (typeof navItems)[number], nested = false) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const link = (
      <Link
        key={`${item.label}-${item.href}`}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          "flex items-center rounded-md text-sm font-medium transition-colors",
          collapsed ? "h-10 justify-center px-0" : nested ? "h-10 gap-3 pl-8 pr-3" : "h-11 gap-3 px-4",
          active
            ? "bg-[#eaf1fd] text-[#2f70dc]"
            : "text-[#5b6575] hover:bg-[#f1f5fa] hover:text-[#0d1b3d]",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
      </Link>
    );

    return mobile ? (
      <SheetClose key={`${item.label}-${item.href}`} asChild>
        {link}
      </SheetClose>
    ) : (
      link
    );
  };

  return (
    <div className="flex h-full flex-col">
      {mobile ? <SheetClose asChild>{brandLink}</SheetClose> : brandLink}
      <nav className={cn("flex-1 space-y-1 overflow-y-auto pb-4", collapsed ? "px-3" : "px-4")}>
        {mainNavItems.map((item) => renderNavLink(item))}
        {user.role === "admin" ? (
          <div className="space-y-1 pt-2">
            <button
              type="button"
              title={collapsed ? "관리자" : undefined}
              aria-expanded={adminOpen}
              onClick={() => setAdminOpen((current) => !current)}
              className={cn(
                "flex h-11 w-full items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "gap-3 px-4",
                adminActive
                  ? "bg-[#eaf1fd] text-[#2f70dc]"
                  : "text-[#5b6575] hover:bg-[#f1f5fa] hover:text-[#0d1b3d]",
              )}
            >
              <ShieldCheck className="size-4 shrink-0" />
              {!collapsed ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-left">관리자</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      adminOpen ? "rotate-180" : undefined,
                    )}
                  />
                </>
              ) : null}
            </button>
            {adminOpen ? (
              <div className="space-y-1">{adminNavItems.map((item) => renderNavLink(item, true))}</div>
            ) : null}
          </div>
        ) : null}
      </nav>
      <div className={cn("border-t border-[#e6ecf3] p-4", collapsed ? "px-3" : undefined)}>
        <form action={logoutAction} className="mb-2">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            type="submit"
            className={cn(
              "text-[#5b6575] hover:bg-[#f1f5fa] hover:text-[#0d1b3d]",
              collapsed ? "w-full" : "w-full justify-start",
            )}
            title={collapsed ? "로그아웃" : undefined}
          >
            <LogOut className="size-4" />
            {!collapsed ? "로그아웃" : null}
          </Button>
        </form>
        {mobile ? (
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-[#5b6575] hover:bg-[#f1f5fa] hover:text-[#0d1b3d]"
            >
              <ChevronLeft className="size-4" />
              메뉴 닫기
            </Button>
          </SheetClose>
        ) : null}
      </div>
    </div>
  );
}

function roleLabel(role: AppUserRow["role"]) {
  return {
    admin: "관리자",
    employee: "사원",
  }[role];
}
