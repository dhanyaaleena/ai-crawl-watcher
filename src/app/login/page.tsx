import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-8 w-8" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Sign in to Crawlwatch</h1>
          <p className="mt-1.5 text-sm text-ink-3">See which AI crawlers read your site.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <AuthForm next={typeof next === "string" ? next : "/dashboard"} />
        </div>
      </div>
    </main>
  );
}
