import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchPublicPage, isPublicAddress } from "@/lib/safe-fetch";

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "104.16.0.1", "2606:4700::1111", "::ffff:8.8.8.8"])("allows public %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::a9fe:a9fe",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
});

describe("fetchPublicPage", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/hop") return void res.writeHead(302, { location: "/page" }).end();
      if (req.url === "/loop") return void res.writeHead(302, { location: "/loop" }).end();
      res.writeHead(200, { "content-type": "text/html" }).end("<script>/* site-123 */</script>");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("refuses hosts that resolve to a private address", async () => {
    await expect(fetchPublicPage(`${base}/page`)).rejects.toThrow(/private or reserved/);
  });

  it("refuses IP literals in private ranges", async () => {
    await expect(fetchPublicPage(base.replace("localhost", "127.0.0.1") + "/page")).rejects.toThrow(/private or reserved/);
  });

  it("re-checks the address on every redirect hop", async () => {
    let lookups = 0;
    const allowFirstOnly = () => ++lookups === 1;
    await expect(fetchPublicPage(`${base}/hop`, { allowAddress: allowFirstOnly })).rejects.toThrow(/private or reserved/);
    expect(lookups).toBe(2);
  });

  it("follows allowed redirects and returns the page", async () => {
    const res = await fetchPublicPage(`${base}/hop`, { allowAddress: () => true });
    expect(res.status).toBe(200);
    expect(res.url).toBe(`${base}/page`);
    expect(res.body).toContain("site-123");
  });

  it("stops after too many redirects", async () => {
    await expect(fetchPublicPage(`${base}/loop`, { allowAddress: () => true })).rejects.toThrow(/more than 3 redirects/);
  });

  it("refuses a redirect to a private IP literal", async () => {
    const redirector = createServer((_, res) => void res.writeHead(301, { location: "http://169.254.169.254/latest/meta-data/" }).end());
    await new Promise<void>((r) => redirector.listen(0, "127.0.0.1", r));
    const url = `http://localhost:${(redirector.address() as AddressInfo).port}/`;
    try {
      await expect(fetchPublicPage(url, { allowAddress: (ip) => ip === "127.0.0.1" || ip === "::1" || isPublicAddress(ip) })).rejects.toThrow(
        /169\.254\.169\.254 is a private/,
      );
    } finally {
      redirector.close();
    }
  });

  it("refuses non-HTTP URLs", async () => {
    await expect(fetchPublicPage("file:///etc/passwd")).rejects.toThrow(/refusing a file: URL/);
  });
});
