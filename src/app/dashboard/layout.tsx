import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SiteNav } from "@/components/site-nav";
import { TimezoneSync } from "@/components/timezone-sync";
import { getSites, getTimezone } from "@/lib/queries";
import { getUser } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [sites, tz] = await Promise.all([getSites(), getTimezone()]);

  const signOut = (
    <form action="/auth/signout" method="post">
      <button type="submit" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink" title="Sign out">
        <LogOut className="h-4 w-4" />
        <span className="md:sr-only">Sign out</span>
      </button>
    </form>
  );

  return (
    <div className="min-h-screen md:flex">
      <TimezoneSync current={tz} />

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex md:sticky md:top-0 md:h-screen">
        <Link href="/dashboard" className="flex items-center gap-2 px-4 pt-5 pb-4">
          <Logo />
          <span className="font-semibold tracking-tight">Crawlwatch</span>
        </Link>
        <div className="flex-1 overflow-y-auto px-3">
          <Suspense>
            <SiteNav sites={sites} variant="side" />
          </Suspense>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="truncate text-xs text-ink-3" title={user.email}>{user.email}</span>
          {signOut}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="border-b border-line bg-surface px-4 pt-3 pb-2 md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold tracking-tight">Crawlwatch</span>
          </Link>
          {signOut}
        </div>
        <Suspense>
          <SiteNav sites={sites} variant="top" />
        </Suspense>
      </div>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
