/** Tracking snippets shown on the Settings page. Kept tiny: the PRD budget is 5 KB; the <head> snippet is ~320 bytes. */

export function headSnippet(siteId: string, endpoint: string): string {
  return `<!-- Crawlwatch: AI crawler analytics -->
<script>
(function(s,e){var d=document,g=d.createElement('script');g.async=1;
g.src=e+'?sid='+s+'&u='+encodeURIComponent(location.href);
(d.head||d.documentElement).appendChild(g);})('${siteId}','${endpoint}');
</script>`;
}

export function bodySnippet(siteId: string, endpoint: string): string {
  return `<noscript><img src="${endpoint}?sid=${siteId}&f=gif" width="1" height="1" alt="" referrerpolicy="no-referrer-when-downgrade" style="position:absolute;left:-9999px"></noscript>`;
}

export function serverSnippet(siteId: string, endpoint: string): string {
  return `// middleware.ts (or proxy.ts on Next.js 16+)
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const BOTS = /bot|crawl|spider|GPT|Claude|Perplexity|Bytespider|Google-|NotebookLM|^Google$/i;

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOTS.test(ua)) {
    // Send the crawler's IP, so the stored (hashed) address is the crawler's, not this server's.
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    event.waitUntil(
      fetch("${endpoint}", {
        method: "POST",
        headers: { "user-agent": ua },
        body: JSON.stringify({ sid: "${siteId}", u: req.url, ip }),
      }).catch(() => {}),
    );
  }
  return NextResponse.next();
}`;
}
