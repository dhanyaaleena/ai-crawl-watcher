import { describe, expect, it } from "vitest";
import {
  anonymizeIp,
  clientIp,
  isIpAddress,
  hostMatchesDomain,
  normalizeDomain,
  normalizePageUrl,
  truncateIp,
} from "../supabase/functions/_shared/track-utils";

describe("normalizePageUrl", () => {
  it("drops query strings and fragments", () => {
    expect(normalizePageUrl("https://Example.com/blog/post-1?token=abc#top")).toEqual({
      url: "https://example.com/blog/post-1",
      path: "/blog/post-1",
      host: "example.com",
    });
  });

  it("decodes the path for display", () => {
    expect(normalizePageUrl("https://example.com/caf%C3%A9")?.path).toBe("/café");
  });

  it("rejects non-http URLs and garbage", () => {
    expect(normalizePageUrl("javascript:alert(1)")).toBeNull();
    expect(normalizePageUrl("not a url")).toBeNull();
    expect(normalizePageUrl(null)).toBeNull();
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["https://www.Example.com/blog?x=1", "example.com"],
    ["example.com:8080", "example.com"],
    ["  shop.example.co.uk. ", "shop.example.co.uk"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe("hostMatchesDomain", () => {
  it("accepts the domain, www and subdomains", () => {
    expect(hostMatchesDomain("example.com", "example.com")).toBe(true);
    expect(hostMatchesDomain("www.example.com", "example.com")).toBe(true);
    expect(hostMatchesDomain("docs.example.com", "example.com")).toBe(true);
  });

  it("rejects look-alike hosts", () => {
    expect(hostMatchesDomain("badexample.com", "example.com")).toBe(false);
    expect(hostMatchesDomain("example.com.evil.io", "example.com")).toBe(false);
  });
});

describe("IP anonymisation", () => {
  it("truncates IPv4 to /24 and IPv6 to /48", () => {
    expect(truncateIp("203.0.113.77")).toBe("203.0.113.0");
    expect(truncateIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::");
    expect(truncateIp("::ffff:198.51.100.9")).toBe("198.51.100.0");
  });

  it("hashes to 64 hex chars, stable within a site and different across sites", async () => {
    const a = await anonymizeIp("203.0.113.77", "site-a", "salt");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await anonymizeIp("203.0.113.5", "site-a", "salt")).toBe(a); // same /24
    expect(await anonymizeIp("203.0.113.77", "site-b", "salt")).not.toBe(a);
  });

  it("prefers proxy headers in order", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "cf-connecting-ip": "2.2.2.2", "x-forwarded-for": "1.1.1.1" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("isIpAddress", () => {
  it("accepts IPv4 and IPv6, rejects anything else", () => {
    for (const ok of ["132.196.86.5", "2001:4860:4801:10::1", "::ffff:1.2.3.4"]) expect(isIpAddress(ok), ok).toBe(true);
    for (const bad of ["", "256.1.1.1", "1.2.3", "example.com", "1.2.3.4; drop", "<script>"]) expect(isIpAddress(bad), bad).toBe(false);
  });
});
