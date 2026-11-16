import { BOT_TYPES, type BotType } from "../../supabase/functions/_shared/bots";

/**
 * Colour follows the platform, never its rank: each of the seven most common
 * AI platforms owns a fixed categorical slot; every other platform (and
 * Unknown) shares the neutral "Other" colour so a ninth hue is never invented.
 */
const SLOTS: Record<string, number> = {
  OpenAI: 1,
  Anthropic: 2,
  Google: 3,
  Perplexity: 4,
  Meta: 5,
  ByteDance: 6,
  "Common Crawl": 7,
};

export const STACK_ORDER = [...Object.keys(SLOTS), "Other"];

export function platformColor(platform: string): string {
  const slot = SLOTS[platform];
  return slot ? `var(--series-${slot})` : "var(--series-other)";
}

/** Series key used in stacked charts. */
export function stackKey(platform: string): string {
  return SLOTS[platform] ? platform : "Other";
}

export function botTypeLabel(type: string): string {
  return BOT_TYPES.find((t) => t.value === type)?.label ?? "Unknown";
}

export const BOT_TYPE_HELP: Record<BotType, string> = {
  training: "Collects content to train AI models",
  search: "Indexes pages for AI search answers",
  assistant: "Fetches a page live because a user asked",
  unknown: "Automated client not on the AI crawler list",
};
