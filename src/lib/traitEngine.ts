import { TraitOption, TierLevel, GeneratedTraits } from "@/types";

const TIER_WEIGHTS: Record<TierLevel, number> = { 1: 50, 2: 30, 3: 15, 4: 7, 5: 3 };

function weightedRandom<T extends { weight: number }>(items: T[], rng: () => number): T {
  if (!items.length) throw new Error("Empty trait pool");
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) { r -= item.weight; if (r <= 0) return item; }
  return items[items.length - 1];
}

function seededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
  let state = hash >>> 0;
  return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function generateTraits(
  traitPool: TraitOption[],
  categories: string[],
  teamTier: TierLevel,
  seed?: string
): GeneratedTraits {
  if (!traitPool.length || !categories.length) return {};
  const rng = seed ? seededRng(seed) : Math.random;
  const heroCategory = categories[Math.floor(rng() * categories.length)];
  const result: GeneratedTraits = {};

  for (const cat of categories) {
    const isHero = cat === heroCategory;
    const pool = traitPool
      .filter(t => t.category === cat && (isHero ? t.tier === teamTier : t.tier <= teamTier))
      .map(t => ({ ...t, weight: t.weight * TIER_WEIGHTS[t.tier] }));
    if (!pool.length) {
      // fallback: any tier for this category
      const fallback = traitPool.filter(t => t.category === cat).map(t => ({ ...t, weight: t.weight * TIER_WEIGHTS[t.tier] }));
      if (fallback.length) result[cat] = weightedRandom(fallback, rng);
    } else {
      result[cat] = weightedRandom(pool, rng);
    }
  }
  return result;
}

export function traitsToAttributes(traits: GeneratedTraits) {
  const LABELS: Record<TierLevel, string> = { 1: "Common", 2: "Uncommon", 3: "Rare", 4: "Epic", 5: "Legendary" };
  return Object.entries(traits).map(([, t]) => ({
    trait_type: t.category.charAt(0).toUpperCase() + t.category.slice(1),
    value: t.name,
    rarity_tier: t.tier,
    tier_name: LABELS[t.tier as TierLevel] ?? "Common",
  }));
}

export function calculateRarityScore(traits: GeneratedTraits): number {
  const scores: Record<TierLevel, number> = { 1: 5, 2: 15, 3: 35, 4: 65, 5: 100 };
  const vals = Object.values(traits);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((s, t) => s + (scores[t.tier as TierLevel] ?? 5), 0) / vals.length);
}
