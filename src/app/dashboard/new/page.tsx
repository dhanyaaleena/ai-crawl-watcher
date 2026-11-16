import type { Metadata } from "next";
import { getSites } from "@/lib/queries";
import { SiteForm } from "./site-form";

export const metadata: Metadata = { title: "Add a site" };

const STEPS = ["Add your domain", "Paste the snippet", "See crawlers arrive"];

export default async function NewSitePage() {
  const sites = await getSites();
  return (
    <div className="mx-auto max-w-xl pt-4 md:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight">{sites.length ? "Add another site" : "Track your first site"}</h1>
      <p className="mt-2 text-ink-2">
        Find out which AI platforms (ChatGPT, Claude, Perplexity, Gemini and more) read your pages, and how often.
      </p>
      <ol className="mt-6 flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-ink-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${i === 0 ? "bg-ink text-surface" : "bg-surface-2 text-ink-3"}`}>
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <SiteForm />
      </div>
    </div>
  );
}
