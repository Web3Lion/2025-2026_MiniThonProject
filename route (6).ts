import { Tier, TraitOption, TierLevel } from "@/types";

// ─── Default Tier Configuration ───────────────────────────────────────────────
// All amounts in USD cents. Customize via admin panel.
export const DEFAULT_TIERS: Tier[] = [
  {
    level: 1,
    name: "tier1",
    label: "Common",
    minDonation: 0,
    color: "slate",
    hexColor: "#94a3b8",
    description: "Getting started — every dollar counts!",
  },
  {
    level: 2,
    name: "tier2",
    label: "Uncommon",
    minDonation: 5000, // $50
    color: "blue",
    hexColor: "#3b82f6",
    description: "Making a real difference.",
  },
  {
    level: 3,
    name: "tier3",
    label: "Rare",
    minDonation: 15000, // $150
    color: "emerald",
    hexColor: "#10b981",
    description: "Incredible effort — the kids thank you!",
  },
  {
    level: 4,
    name: "tier4",
    label: "Epic",
    minDonation: 35000, // $350
    color: "purple",
    hexColor: "#8b5cf6",
    description: "Extraordinary fundraising achievement.",
  },
  {
    level: 5,
    name: "tier5",
    label: "Legendary",
    minDonation: 75000, // $750
    color: "amber",
    hexColor: "#f59e0b",
    description: "Legendary — you're a champion for children.",
  },
];

// ─── Trait Pool ───────────────────────────────────────────────────────────────
// Each trait references an image file in /public/traits/{category}/
// Replace imageFile values with your actual artwork filenames.
// weight = relative probability within the tier (doesn't need to sum to 100)

export const TRAIT_POOL: TraitOption[] = [
  // BACKGROUND traits
  { id: "bg-t1-1", name: "Sky Blue",       category: "background", tier: 1, imageFile: "sky-blue.png",      weight: 10 },
  { id: "bg-t1-2", name: "Soft Green",     category: "background", tier: 1, imageFile: "soft-green.png",    weight: 10 },
  { id: "bg-t2-1", name: "Sunset",         category: "background", tier: 2, imageFile: "sunset.png",        weight: 8  },
  { id: "bg-t2-2", name: "Ocean Depths",   category: "background", tier: 2, imageFile: "ocean-depths.png",  weight: 8  },
  { id: "bg-t3-1", name: "Aurora",         category: "background", tier: 3, imageFile: "aurora.png",        weight: 6  },
  { id: "bg-t3-2", name: "Cosmic Nebula",  category: "background", tier: 3, imageFile: "cosmic-nebula.png", weight: 6  },
  { id: "bg-t4-1", name: "Crystal Cave",  category: "background", tier: 4, imageFile: "crystal-cave.png",  weight: 4  },
  { id: "bg-t4-2", name: "Lava Flow",     category: "background", tier: 4, imageFile: "lava-flow.png",     weight: 4  },
  { id: "bg-t5-1", name: "Divine Light",  category: "background", tier: 5, imageFile: "divine-light.png",  weight: 2  },
  { id: "bg-t5-2", name: "Void Storm",    category: "background", tier: 5, imageFile: "void-storm.png",    weight: 2  },

  // BODY traits
  { id: "body-t1-1", name: "Hoodie",        category: "body", tier: 1, imageFile: "hoodie.png",        weight: 10 },
  { id: "body-t1-2", name: "T-Shirt",       category: "body", tier: 1, imageFile: "t-shirt.png",       weight: 10 },
  { id: "body-t2-1", name: "Jersey",        category: "body", tier: 2, imageFile: "jersey.png",        weight: 8  },
  { id: "body-t2-2", name: "Lab Coat",      category: "body", tier: 2, imageFile: "lab-coat.png",      weight: 8  },
  { id: "body-t3-1", name: "Superhero Suit",category: "body", tier: 3, imageFile: "superhero.png",     weight: 6  },
  { id: "body-t3-2", name: "Wizard Robe",   category: "body", tier: 3, imageFile: "wizard-robe.png",   weight: 6  },
  { id: "body-t4-1", name: "Armor",         category: "body", tier: 4, imageFile: "armor.png",         weight: 4  },
  { id: "body-t4-2", name: "Dragon Scales", category: "body", tier: 4, imageFile: "dragon-scales.png", weight: 4  },
  { id: "body-t5-1", name: "Angel Wings",   category: "body", tier: 5, imageFile: "angel-wings.png",   weight: 2  },
  { id: "body-t5-2", name: "Phoenix Form",  category: "body", tier: 5, imageFile: "phoenix-form.png",  weight: 2  },

  // EYES traits
  { id: "eyes-t1-1", name: "Bright",       category: "eyes", tier: 1, imageFile: "bright.png",       weight: 10 },
  { id: "eyes-t1-2", name: "Kind",         category: "eyes", tier: 1, imageFile: "kind.png",         weight: 10 },
  { id: "eyes-t2-1", name: "Starry",       category: "eyes", tier: 2, imageFile: "starry.png",       weight: 8  },
  { id: "eyes-t2-2", name: "Determined",   category: "eyes", tier: 2, imageFile: "determined.png",   weight: 8  },
  { id: "eyes-t3-1", name: "Glowing",      category: "eyes", tier: 3, imageFile: "glowing.png",      weight: 6  },
  { id: "eyes-t3-2", name: "Crystal",      category: "eyes", tier: 3, imageFile: "crystal.png",      weight: 6  },
  { id: "eyes-t4-1", name: "Flame",        category: "eyes", tier: 4, imageFile: "flame.png",        weight: 4  },
  { id: "eyes-t4-2", name: "Void",         category: "eyes", tier: 4, imageFile: "void.png",         weight: 4  },
  { id: "eyes-t5-1", name: "Omniscient",   category: "eyes", tier: 5, imageFile: "omniscient.png",   weight: 2  },
  { id: "eyes-t5-2", name: "Celestial",    category: "eyes", tier: 5, imageFile: "celestial.png",    weight: 2  },

  // ACCESSORY traits
  { id: "acc-t1-1", name: "Ribbon",        category: "accessory", tier: 1, imageFile: "ribbon.png",        weight: 10 },
  { id: "acc-t1-2", name: "Backpack",      category: "accessory", tier: 1, imageFile: "backpack.png",      weight: 10 },
  { id: "acc-t2-1", name: "Gold Medal",    category: "accessory", tier: 2, imageFile: "gold-medal.png",    weight: 8  },
  { id: "acc-t2-2", name: "Trophy",        category: "accessory", tier: 2, imageFile: "trophy.png",        weight: 8  },
  { id: "acc-t3-1", name: "Magic Staff",   category: "accessory", tier: 3, imageFile: "magic-staff.png",   weight: 6  },
  { id: "acc-t3-2", name: "Shield",        category: "accessory", tier: 3, imageFile: "shield.png",        weight: 6  },
  { id: "acc-t4-1", name: "Crown",         category: "accessory", tier: 4, imageFile: "crown.png",         weight: 4  },
  { id: "acc-t4-2", name: "Energy Blade",  category: "accessory", tier: 4, imageFile: "energy-blade.png",  weight: 4  },
  { id: "acc-t5-1", name: "Halo",          category: "accessory", tier: 5, imageFile: "halo.png",          weight: 2  },
  { id: "acc-t5-2", name: "Infinity Orb",  category: "accessory", tier: 5, imageFile: "infinity-orb.png",  weight: 2  },

  // SPECIAL traits
  { id: "sp-t1-1", name: "Sparkle",        category: "special", tier: 1, imageFile: "sparkle.png",        weight: 10 },
  { id: "sp-t1-2", name: "Hearts",         category: "special", tier: 1, imageFile: "hearts.png",         weight: 10 },
  { id: "sp-t2-1", name: "Confetti",       category: "special", tier: 2, imageFile: "confetti.png",       weight: 8  },
  { id: "sp-t2-2", name: "Music Notes",    category: "special", tier: 2, imageFile: "music-notes.png",    weight: 8  },
  { id: "sp-t3-1", name: "Lightning Bolt", category: "special", tier: 3, imageFile: "lightning.png",      weight: 6  },
  { id: "sp-t3-2", name: "Snowflakes",     category: "special", tier: 3, imageFile: "snowflakes.png",     weight: 6  },
  { id: "sp-t4-1", name: "Black Hole",     category: "special", tier: 4, imageFile: "black-hole.png",     weight: 4  },
  { id: "sp-t4-2", name: "Time Spiral",    category: "special", tier: 4, imageFile: "time-spiral.png",    weight: 4  },
  { id: "sp-t5-1", name: "Big Bang",       category: "special", tier: 5, imageFile: "big-bang.png",       weight: 2  },
  { id: "sp-t5-2", name: "Reality Rift",   category: "special", tier: 5, imageFile: "reality-rift.png",   weight: 2  },

  // AURA traits
  { id: "aura-t1-1", name: "Warm Glow",    category: "aura", tier: 1, imageFile: "warm-glow.png",    weight: 10 },
  { id: "aura-t1-2", name: "Cool Breeze",  category: "aura", tier: 1, imageFile: "cool-breeze.png",  weight: 10 },
  { id: "aura-t2-1", name: "Electric",     category: "aura", tier: 2, imageFile: "electric.png",     weight: 8  },
  { id: "aura-t2-2", name: "Verdant",      category: "aura", tier: 2, imageFile: "verdant.png",      weight: 8  },
  { id: "aura-t3-1", name: "Radiant",      category: "aura", tier: 3, imageFile: "radiant.png",      weight: 6  },
  { id: "aura-t3-2", name: "Shadow",       category: "aura", tier: 3, imageFile: "shadow.png",       weight: 6  },
  { id: "aura-t4-1", name: "Inferno",      category: "aura", tier: 4, imageFile: "inferno.png",      weight: 4  },
  { id: "aura-t4-2", name: "Glacial",      category: "aura", tier: 4, imageFile: "glacial.png",      weight: 4  },
  { id: "aura-t5-1", name: "Transcendent", category: "aura", tier: 5, imageFile: "transcendent.png", weight: 2  },
  { id: "aura-t5-2", name: "Void Walker",  category: "aura", tier: 5, imageFile: "void-walker.png",  weight: 2  },
];

// ─── Helper: Get tier by donation amount ──────────────────────────────────────
export function getTierForDonation(amountCents: number, tiers: Tier[]): Tier {
  const sorted = [...tiers].sort((a, b) => b.minDonation - a.minDonation);
  return sorted.find((t) => amountCents >= t.minDonation) ?? tiers[0];
}

// ─── Helper: cents → formatted USD string ─────────────────────────────────────
export function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

// ─── Helper: Get traits by category and max tier ──────────────────────────────
export function getTraitsByCategory(
  category: TraitOption["category"],
  maxTier: TierLevel
): TraitOption[] {
  return TRAIT_POOL.filter(
    (t) => t.category === category && t.tier <= maxTier
  );
}
