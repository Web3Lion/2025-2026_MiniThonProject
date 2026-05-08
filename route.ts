// ─── Tiers ────────────────────────────────────────────────────────────────────
export type TierLevel = 1 | 2 | 3 | 4 | 5;

export interface Tier {
  level: TierLevel;
  name: string;
  label: string; // "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary"
  minDonation: number; // USD cents to avoid float issues
  color: string; // tailwind color class
  hexColor: string;
  description: string;
}

// ─── Traits ───────────────────────────────────────────────────────────────────
export type TraitCategory =
  | "background"
  | "body"
  | "eyes"
  | "accessory"
  | "special"
  | "aura";

export interface TraitOption {
  id: string;
  name: string;
  category: TraitCategory;
  tier: TierLevel;
  imageFile: string; // filename in /public/traits/{category}/
  weight: number; // relative weight within tier (higher = more common within tier)
}

// ─── NFT Metadata (HIP-412 compatible) ────────────────────────────────────────
export interface NFTAttribute {
  trait_type: string;
  value: string;
  rarity_tier: TierLevel;
  tier_name: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string; // IPFS URI
  edition: number;
  attributes: NFTAttribute[];
  properties: {
    team: string;
    teamId: string;
    donationTotal: number; // in cents
    mintedAt: string; // ISO timestamp
    highestTier: TierLevel;
    charity: string;
  };
}

// ─── Teams ────────────────────────────────────────────────────────────────────
export interface TeamMember {
  id: string;
  name: string;
  walletAddress?: string; // Hedera account ID e.g. "0.0.12345"
  mintedNFT?: MintRecord;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  donationTotal: number; // in cents
  currentTier: TierLevel;
  donationLog: DonationEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DonationEntry {
  id: string;
  amount: number; // in cents
  donor?: string;
  note?: string;
  recordedAt: string;
  recordedBy: string; // admin
}

// ─── Minting ──────────────────────────────────────────────────────────────────
export interface MintRecord {
  serialNumber: number;
  tokenId: string; // Hedera token ID e.g. "0.0.99999"
  transactionId: string;
  metadata: NFTMetadata;
  mintedAt: string;
  walletAddress: string;
}

export interface GeneratedTraits {
  background: TraitOption;
  body: TraitOption;
  eyes: TraitOption;
  accessory: TraitOption;
  special: TraitOption;
  aura: TraitOption;
}

// ─── Admin State ──────────────────────────────────────────────────────────────
export interface AdminState {
  teams: Team[];
  tiers: Tier[];
  traitPool: TraitOption[];
  tokenId: string | null; // Hedera HTS token ID for the collection
  collectionName: string;
  totalDonations: number; // aggregate in cents
  lastUpdated: string;
}
