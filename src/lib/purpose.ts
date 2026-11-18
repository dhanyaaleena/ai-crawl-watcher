/**
 * Training vs retrieval split of crawler traffic (PRD FR-2.3 bot types):
 *  - learning: training crawlers that collect content for models
 *  - citing:   search and assistant bots that retrieve pages to answer queries
 * Unknown bots fit neither side and are counted separately.
 */

export interface PurposeInput {
  platform: string;
  bot_name: string;
  bot_type: string;
  visits: number | string;
}

export interface PurposeSide {
  visits: number;
  /** Share of learning + citing visits (Unknown excluded), 0..1. */
  share: number;
  /** Bot names, most visits first. */
  topBots: string[];
}

export interface PlatformPurpose {
  platform: string;
  learning: number;
  citing: number;
}

export interface PurposeSplit {
  learning: PurposeSide;
  citing: PurposeSide & { search: number; assistant: number };
  unknown: number;
  platforms: PlatformPurpose[];
  /** One plain-language sentence describing the split, or null when there is nothing to say. */
  takeaway: string | null;
}

const isLearning = (t: string) => t === "training";
const isCiting = (t: string) => t === "search" || t === "assistant";

export function purposeSplit(rows: PurposeInput[]): PurposeSplit {
  let learning = 0;
  let search = 0;
  let assistant = 0;
  let unknown = 0;
  const learnBots = new Map<string, number>();
  const citeBots = new Map<string, number>();
  const platforms = new Map<string, PlatformPurpose>();

  for (const r of rows) {
    const n = Number(r.visits);
    if (isLearning(r.bot_type)) {
      learning += n;
      learnBots.set(r.bot_name, (learnBots.get(r.bot_name) ?? 0) + n);
    } else if (isCiting(r.bot_type)) {
      if (r.bot_type === "search") search += n;
      else assistant += n;
      citeBots.set(r.bot_name, (citeBots.get(r.bot_name) ?? 0) + n);
    } else {
      unknown += n;
      continue;
    }
    const p = platforms.get(r.platform) ?? { platform: r.platform, learning: 0, citing: 0 };
    if (isLearning(r.bot_type)) p.learning += n;
    else p.citing += n;
    platforms.set(r.platform, p);
  }

  const citing = search + assistant;
  const known = learning + citing;
  const rank = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);

  return {
    learning: { visits: learning, share: known ? learning / known : 0, topBots: rank(learnBots) },
    citing: { visits: citing, share: known ? citing / known : 0, topBots: rank(citeBots), search, assistant },
    unknown,
    platforms: [...platforms.values()].sort(
      (a, b) => b.learning + b.citing - (a.learning + a.citing) || a.platform.localeCompare(b.platform),
    ),
    takeaway: takeaway(learning, citing),
  };
}

function takeaway(learning: number, citing: number): string | null {
  const known = learning + citing;
  if (!known) return null;
  const training = Math.round((learning / known) * 100);
  return `${training}% of classified AI visits are for model training and ${100 - training}% for search and answer retrieval.`;
}
