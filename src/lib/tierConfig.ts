import { Tier, TraitOption, TierLevel, LayerDefinition } from "@/types";

export const DEFAULT_TIERS: Tier[] = [
  { level: 1, name: "tier1", label: "Common",    minDonation: 0,     color: "slate",   hexColor: "#94a3b8", description: "Getting started — every dollar counts!" },
  { level: 2, name: "tier2", label: "Uncommon",  minDonation: 5000,  color: "blue",    hexColor: "#3b82f6", description: "Making a real difference." },
  { level: 3, name: "tier3", label: "Rare",      minDonation: 15000, color: "emerald", hexColor: "#10b981", description: "Incredible effort!" },
  { level: 4, name: "tier4", label: "Epic",      minDonation: 35000, color: "purple",  hexColor: "#8b5cf6", description: "Extraordinary fundraising achievement." },
  { level: 5, name: "tier5", label: "Legendary", minDonation: 75000, color: "amber",   hexColor: "#f59e0b", description: "Legendary — champion for children." },
];

export const DEFAULT_LAYERS: LayerDefinition[] = [
  { id: "background", name: "Background", order: 1, required: true },
  { id: "body",       name: "Body",       order: 2, required: true },
  { id: "eyes",       name: "Eyes",       order: 3, required: true },
  { id: "accessory",  name: "Accessory",  order: 4, required: false },
  { id: "special",    name: "Special",    order: 5, required: false },
  { id: "aura",       name: "Aura",       order: 6, required: false },
];

export const TRAIT_POOL: TraitOption[] = [];

export function getTierForDonation(amountCents: number, tiers: Tier[]): Tier {
  const sorted = [...tiers].sort((a, b) => b.minDonation - a.minDonation);
  return sorted.find((t) => amountCents >= t.minDonation) ?? tiers[0];
}

export function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(cents / 100);
}
