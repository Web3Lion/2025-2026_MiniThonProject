/**
 * Trait Generation Engine
 *
 * Rules:
 * 1. Each NFT has 6 traits: background, body, eyes, accessory, special, aura
 * 2. The team's tier is the "guaranteed tier" — at least ONE trait must be
 *    at exactly that tier level (the "hero trait")
 * 3. The hero trait category is randomly selected
 * 4. Remaining 5 traits are selected from tiers 1..currentTier using
 *    weighted random selection (higher tier = rarer = lower weight)
 * 5. Each category can only have one trait assigned
 */

import {
  TraitOption,
  TierLevel,
  GeneratedTraits,
  TraitCategory,
} from "@/types";
import { TRAIT_POOL } from "./tierConfig";

const CATEGORIES: TraitCategory[] = [
  "background",
  "body",
  "eyes",
  "accessory",
  "special",
  "aura",
];

// Tier rarity multipliers: lower tier = more likely to appear in non-hero slots
const TIER_WEIGHTS: Record<TierLevel, number> = {
  1: 50,
  2: 30,
  3: 15,
  4: 7,
  5: 3,
};

/**
 * Weighted random selection from an array of items with weights
 */
function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Get all traits for a category up to a max tier, with combined weights
 * factoring in both trait weight and tier rarity weight
 */
function getWeightedTraitsForCategory(
  category: TraitCategory,
  maxTier: TierLevel,
  forceTier?: TierLevel
): TraitOption[] {
  const pool = TRAIT_POOL.filter(
    (t) =>
      t.category === category &&
      (forceTier !== undefined ? t.tier === forceTier : t.tier <= maxTier)
  );

  // Apply tier rarity weights on top of individual trait weights
  return pool.map((trait) => ({
    ...trait,
    weight: trait.weight * TIER_WEIGHTS[trait.tier],
  }));
}

/**
 * Main generation function
 *
 * @param teamTier - The team's earned tier (1-5)
 * @param seed - Optional seed string for deterministic generation (team ID)
 */
export function generateTraits(
  teamTier: TierLevel,
  seed?: string
): GeneratedTraits {
  // Use seeded random if seed provided (so same team always gets same NFT)
  // For true randomness per mint, omit seed
  const rng = seed ? createSeededRandom(seed) : Math.random;

  // 1. Pick the "hero" category — this will get the guaranteed top-tier trait
  const heroCategoryIndex = Math.floor(rng() * CATEGORIES.length);
  const heroCategory = CATEGORIES[heroCategoryIndex];

  const result: Partial<GeneratedTraits> = {};

  for (const category of CATEGORIES) {
    if (category === heroCategory) {
      // Hero slot: MUST be exactly teamTier
      const heroOptions = getWeightedTraitsForCategory(
        category,
        teamTier,
        teamTier
      );

      if (heroOptions.length === 0) {
        // Fallback: if no traits at exact tier, use highest available
        const fallback = getWeightedTraitsForCategory(category, teamTier);
        result[category] = weightedRandomWithRng(fallback, rng);
      } else {
        result[category] = weightedRandomWithRng(heroOptions, rng);
      }
    } else {
      // Non-hero slots: pick from tiers 1..teamTier with weighted probability
      const options = getWeightedTraitsForCategory(category, teamTier);
      result[category] = weightedRandomWithRng(options, rng);
    }
  }

  return result as GeneratedTraits;
}

function weightedRandomWithRng<T extends { weight: number }>(
  items: T[],
  rng: () => number
): T {
  if (items.length === 0) throw new Error("No items to select from");
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = rng() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Simple seeded random number generator (Mulberry32)
 * Same seed → same traits every time (useful for previews before minting)
 */
function createSeededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  let state = hash >>> 0;
  return function () {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Preview traits for a team (deterministic — same for same team at same tier)
 */
export function previewTraits(teamId: string, tier: TierLevel): GeneratedTraits {
  return generateTraits(tier, `${teamId}-${tier}`);
}

/**
 * Convert generated traits to HIP-412 compatible attributes array
 */
export function traitsToAttributes(traits: GeneratedTraits) {
  return Object.entries(traits).map(([, trait]) => ({
    trait_type: capitalize(trait.category),
    value: trait.name,
    rarity_tier: trait.tier,
    tier_name: getTierLabel(trait.tier),
  }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getTierLabel(tier: TierLevel): string {
  const labels: Record<TierLevel, string> = {
    1: "Common",
    2: "Uncommon",
    3: "Rare",
    4: "Epic",
    5: "Legendary",
  };
  return labels[tier];
}

/**
 * Calculate rarity score for a set of traits (0-100)
 * Higher tier traits = higher score
 */
export function calculateRarityScore(traits: GeneratedTraits): number {
  const tierScores: Record<TierLevel, number> = {
    1: 5,
    2: 15,
    3: 35,
    4: 65,
    5: 100,
  };
  const values = Object.values(traits);
  const total = values.reduce(
    (sum, trait) => sum + tierScores[trait.tier as TierLevel],
    0
  );
  return Math.round(total / values.length);
}
