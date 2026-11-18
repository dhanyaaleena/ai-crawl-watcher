#!/usr/bin/env node
// Creates a demo account with a site and 30 days of realistic crawler traffic,
// so the dashboard can be explored without waiting for real crawlers.
//
//   npm run seed:demo            (local: uses .env.local and a fixed demo password)
//
// Hosted project: pass NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// the environment. The fixed password is refused there; set DEMO_PASSWORD or the
// script asks for one with hidden input. Re-running refreshes the 30 days of data
// (and resets the demo site if a visitor deleted it). The password of an existing
// demo user is only changed when DEMO_RESET_PASSWORD=1.

import { createClient } from "@supabase/supabase-js";
import { generateHistory, loadEnv } from "./lib/demo-traffic.mjs";

const LOCAL_PASSWORD = "crawlwatch-demo";
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@crawlwatch.test";
const DEMO_DOMAIN = process.env.DEMO_DOMAIN ?? "example.com";
const DAYS = 30;

loadEnv(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  process.exit(1);
}
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/.test(url);
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function demoPassword() {
  if (isLocal) return process.env.DEMO_PASSWORD ?? LOCAL_PASSWORD;
  let pw = process.env.DEMO_PASSWORD;
  if (!pw) {
    if (!process.stdin.isTTY) throw new Error("Set DEMO_PASSWORD for a hosted project.");
    pw = await askHidden(`Choose a password for ${DEMO_EMAIL} on ${new URL(url).host}: `);
  }
  if (pw === LOCAL_PASSWORD) throw new Error("The local demo password is public in this repo; choose another one.");
  if (pw.length < 8) throw new Error("Use at least 8 characters for the hosted demo password.");
  return pw;
}

/** Reads a line from the terminal without echoing it. */
function askHidden(question) {
  const stdin = process.stdin;
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return finish(), resolve(value);
        if (ch === "\u0003") return finish(), reject(new Error("Cancelled."));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const PAGES = [
  [14, "/"],
  [10, "/blog/what-ai-crawlers-read"],
  [8, "/docs/getting-started"],
  [7, "/pricing"],
  [6, "/blog/robots-txt-for-ai"],
  [6, "/docs/api/events"],
  [5, "/blog"],
  [4, "/docs/tracking-snippet"],
  [4, "/changelog"],
  [3, "/about"],
  [3, "/blog/llms-txt-explained"],
  [2, "/docs/csv-export"],
  [2, "/careers"],
  [1, "/legal/privacy"],
];

async function main() {
  // 1. Demo user (idempotent)
  const { data: users, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let user = users.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    const password = await demoPassword();
    const { data, error } = await db.auth.admin.createUser({ email: DEMO_EMAIL, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
    console.log(`Created ${DEMO_EMAIL}.`);
  } else if (process.env.DEMO_RESET_PASSWORD === "1") {
    const { error } = await db.auth.admin.updateUserById(user.id, { password: await demoPassword() });
    if (error) throw error;
    console.log(`Updated the password for ${DEMO_EMAIL}.`);
  }

  // 2. Demo site, reset its events
  let { data: site } = await db.from("sites").select("id").eq("user_id", user.id).eq("domain", DEMO_DOMAIN).maybeSingle();
  if (!site) {
    const { data, error } = await db.from("sites").insert({ user_id: user.id, domain: DEMO_DOMAIN }).select("id").single();
    if (error) throw error;
    site = data;
  }
  const { error: clearError } = await db.from("crawler_events").delete().eq("site_id", site.id);
  if (clearError) throw clearError;

  // 3. Events: 30 days, shaped by scripts/lib/demo-traffic.mjs.
  const events = generateHistory({ siteId: site.id, domain: DEMO_DOMAIN, pages: PAGES, days: DAYS });
  for (let i = 0; i < events.length; i += 1000) {
    const { error } = await db.from("crawler_events").insert(events.slice(i, i + 1000));
    if (error) throw error;
  }

  console.log(`Seeded ${events.length} crawler events for ${DEMO_DOMAIN}.`);
  console.log(
    isLocal
      ? `Sign in at http://localhost:3000/login as ${DEMO_EMAIL} / ${process.env.DEMO_PASSWORD ?? LOCAL_PASSWORD}`
      : `Sign in to the deployed app as ${DEMO_EMAIL} with the password you chose.`,
  );
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});
